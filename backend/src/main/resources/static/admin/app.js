const TOKEN_KEY = 'checkin_admin_token'
const USER_KEY = 'checkin_admin_user'

const state = {
  token: localStorage.getItem(TOKEN_KEY) || '',
  user: null,
  overview: null,
  tasks: [],
  view: 'overview',
  filter: 'all',
  search: '',
  detailTaskId: null,
  detailStats: null,
  secondsLeft: 0,
  tickHandle: null,
  tickCount: 0,
  qrRefreshing: false,
  qrEnded: false,
  toastHandle: null
}

const STATUS = {
  PENDING: { text: '未开始', cls: 'wait' },
  ONGOING: { text: '进行中', cls: 'active' },
  ENDED: { text: '已结束', cls: 'done' }
}

const $ = selector => document.querySelector(selector)

document.addEventListener('DOMContentLoaded', init)

function init() {
  bindEvents()
  if (state.token) {
    api('GET', '/api/users/me')
      .then(user => {
        if (user.role === 'ADMIN') {
          state.user = user
          enterApp()
        } else {
          clearAuth()
          showLogin('该账号没有管理权限')
        }
      })
      .catch(() => showLogin())
  } else {
    showLogin()
  }
}

function bindEvents() {
  $('#loginForm').addEventListener('submit', onLogin)
  $('#logoutBtn').addEventListener('click', logout)
  $('#refreshBtn').addEventListener('click', () => {
    loadAll().then(() => toast('数据已刷新')).catch(err => toast(err.message, true))
  })
  $('#newTaskBtn').addEventListener('click', openCreate)
  $('#modalClose').addEventListener('click', closeCreate)
  $('#cancelCreate').addEventListener('click', closeCreate)
  $('#modalMask').addEventListener('click', event => {
    if (event.target === $('#modalMask')) closeCreate()
  })
  $('#createForm').addEventListener('submit', onCreate)
  $('#drawerClose').addEventListener('click', () => closeDetail(true))
  $('#drawerMask').addEventListener('click', () => closeDetail(true))
  $('#qrRefresh').addEventListener('click', () => refreshQr(true))

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.view))
  })

  $('#filterGroup').addEventListener('click', event => {
    const chip = event.target.closest('.chip')
    if (!chip) return
    state.filter = chip.dataset.filter
    document.querySelectorAll('#filterGroup .chip').forEach(c => {
      c.classList.toggle('active', c === chip)
    })
    renderTasks()
  })

  $('#searchInput').addEventListener('input', event => {
    state.search = event.target.value.trim()
    renderTasks()
  })

  $('#taskTableBody').addEventListener('click', event => {
    const btn = event.target.closest('.link-btn')
    if (btn) openDetail(Number(btn.dataset.id))
  })

  $('#recentList').addEventListener('click', event => {
    const item = event.target.closest('.recent-item')
    if (item) openDetail(Number(item.dataset.id))
  })
}

/* ---------- 登录与会话 ---------- */

async function onLogin(event) {
  event.preventDefault()
  const code = $('#loginCode').value.trim()
  const errorBox = $('#loginError')
  const button = $('#loginBtn')
  errorBox.textContent = ''
  if (!code) {
    errorBox.textContent = '请输入管理员登录码'
    return
  }
  button.disabled = true
  button.textContent = '登录中...'
  try {
    const data = await api('POST', '/api/auth/login', { code }, { auth: false })
    if (data.user.role !== 'ADMIN') {
      throw makeError('FORBIDDEN', '该账号没有管理权限')
    }
    state.token = data.token
    state.user = data.user
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    enterApp()
  } catch (err) {
    errorBox.textContent = err.message || '登录失败'
  } finally {
    button.disabled = false
    button.textContent = '进入管理端'
  }
}

function enterApp() {
  $('#loginView').classList.add('hidden')
  $('#appView').classList.remove('hidden')
  $('#sideUserName').textContent = state.user.nickname
  $('#sideAvatar').textContent = (state.user.nickname || '管').slice(0, 1)
  navigate('overview')
  loadAll().catch(err => toast(err.message, true))
}

function logout() {
  clearAuth()
  state.user = null
  state.overview = null
  state.tasks = []
  closeDetail(false)
  $('#appView').classList.add('hidden')
  showLogin()
}

function clearAuth() {
  state.token = ''
  state.user = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

function showLogin(message) {
  $('#loginView').classList.remove('hidden')
  $('#appView').classList.add('hidden')
  $('#loginError').textContent = message || ''
}

/* ---------- 数据加载 ---------- */

async function api(method, path, body, options) {
  const opts = options || {}
  const useAuth = opts.auth !== false
  const headers = {}
  if (useAuth && state.token) headers.Authorization = 'Bearer ' + state.token
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let response
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  } catch (err) {
    throw makeError('NETWORK_ERROR', '无法连接后端服务，请确认服务已启动')
  }
  let data = {}
  try {
    data = await response.json()
  } catch (err) {
    data = {}
  }
  if (!response.ok) {
    if (response.status === 401 && useAuth) {
      clearAuth()
      showLogin('登录状态已失效，请重新登录')
    }
    throw makeError(data.code || 'REQUEST_FAILED', data.message || `请求失败（${response.status}）`, response.status)
  }
  return data
}

function makeError(code, message, status) {
  const err = new Error(message)
  err.code = code
  err.status = status
  return err
}

async function loadAll() {
  const [overview, tasks] = await Promise.all([
    api('GET', '/api/stats/overview'),
    api('GET', '/api/tasks')
  ])
  state.overview = overview
  state.tasks = tasks
  renderOverview()
  renderTasks()
  if (state.detailTaskId) {
    const task = tasks.find(t => t.id === state.detailTaskId)
    if (task) {
      $('#drawerTitle').textContent = task.title
      $('#drawerTime').textContent = formatRange(task.startTime, task.endTime)
    }
  }
}

/* ---------- 概览 ---------- */

function renderOverview() {
  const data = state.overview
  if (!data) return
  $('#statUsers').textContent = data.totalUsers
  $('#statTasks').textContent = data.totalTasks
  $('#statCheckins').textContent = data.totalCheckins
  $('#statToday').textContent = data.todayCheckins
  $('#ongoingTag').textContent = `进行中 ${data.ongoingTasks}`

  const list = $('#recentList')
  if (!data.recentTasks.length) {
    list.innerHTML = '<div class="table-empty"><strong>暂无任务</strong><span>点击右上角新建签到任务</span></div>'
    return
  }
  list.innerHTML = data.recentTasks.map(task => {
    const status = STATUS[task.status] || STATUS.ENDED
    const percent = task.expectedCount > 0
      ? Math.min(100, Math.round(task.checkedCount * 100 / task.expectedCount)) : 0
    return `
      <div class="recent-item" data-id="${task.id}">
        <div class="recent-main">
          <span class="recent-title">${escapeHtml(task.title)}</span>
          <span class="recent-time">${formatRange(task.startTime, task.endTime)}</span>
        </div>
        <span class="badge ${status.cls}">${status.text}</span>
        <div class="recent-progress">
          <span class="recent-count">${task.checkedCount} / ${task.expectedCount}</span>
          <div class="progress-track"><div class="progress-bar" style="width:${percent}%"></div></div>
        </div>
      </div>
    `
  }).join('')
}

/* ---------- 任务列表 ---------- */

function renderTasks() {
  const filtered = state.tasks.filter(task => {
    const statusOk = state.filter === 'all' || task.status === state.filter
    const searchOk = !state.search || task.title.toLowerCase().includes(state.search.toLowerCase())
    return statusOk && searchOk
  })

  const body = $('#taskTableBody')
  body.innerHTML = filtered.map(task => {
    const status = STATUS[task.status] || STATUS.ENDED
    const percent = task.expectedCount > 0
      ? Math.min(100, Math.round(task.checkedCount * 100 / task.expectedCount)) : 0
    return `
      <tr>
        <td>
          <div class="table-task-title">${escapeHtml(task.title)}</div>
          <div class="table-task-loc">${escapeHtml(task.location || '未设置地点')}</div>
        </td>
        <td>${formatRange(task.startTime, task.endTime)}</td>
        <td><span class="badge ${status.cls}">${status.text}</span></td>
        <td class="progress-cell">
          <div class="progress-row">
            <div class="progress-track"><div class="progress-bar" style="width:${percent}%"></div></div>
            <span>${task.checkedCount} / ${task.expectedCount}</span>
          </div>
        </td>
        <td class="right"><button class="link-btn" data-id="${task.id}">查看二维码</button></td>
      </tr>
    `
  }).join('')

  $('#taskEmpty').classList.toggle('hidden', filtered.length > 0)
}

/* ---------- 任务详情与二维码 ---------- */

async function openDetail(id) {
  const task = state.tasks.find(t => t.id === id)
  if (!task) return
  state.detailTaskId = id
  state.detailStats = null
  state.secondsLeft = 0
  state.qrEnded = false
  state.qrRefreshing = true
  $('#drawerTitle').textContent = task.title
  $('#drawerTime').textContent = formatRange(task.startTime, task.endTime)
  $('#qrImage').removeAttribute('src')
  $('#qrImage').classList.remove('hidden')
  $('#qrError').classList.add('hidden')
  $('#qrCountdown').textContent = '--'
  $('#qrCountdown').classList.remove('urgent')
  $('#recordsBody').innerHTML = ''
  $('#recordsEmpty').classList.add('hidden')
  $('#drawerMask').classList.remove('hidden')
  $('#detailDrawer').classList.remove('hidden')
  startTicker()
  try {
    await Promise.all([loadStats(), loadQr()])
  } catch (err) {
    toast(err.message, true)
  }
}

function closeDetail(refresh) {
  stopTicker()
  state.detailTaskId = null
  state.detailStats = null
  $('#detailDrawer').classList.add('hidden')
  $('#drawerMask').classList.add('hidden')
  if (refresh) {
    loadAll().catch(() => {})
  }
}

async function loadStats() {
  const id = state.detailTaskId
  if (!id) return
  const stats = await api('GET', `/api/tasks/${id}/stats`)
  if (state.detailTaskId !== id) return
  state.detailStats = stats
  $('#drawerExpected').textContent = stats.expectedCount
  $('#drawerChecked').textContent = stats.checkedCount
  $('#drawerAbsent').textContent = stats.absentCount
  $('#drawerRate').textContent = stats.attendanceRate.toFixed(1) + '%'
  $('#drawerRecordCount').textContent = `共 ${stats.checkedCount} 人`

  const rows = stats.records.map(record => `
    <tr>
      <td>
        <div class="record-user">
          <div class="record-avatar">${escapeHtml((record.nickname || '?').slice(0, 1))}</div>
          <span>${escapeHtml(record.nickname)}</span>
        </div>
      </td>
      <td>${formatDateTime(record.checkinTime)}</td>
      <td>${record.method === 'QR' ? '二维码' : escapeHtml(record.method)}</td>
    </tr>
  `).join('')
  $('#recordsBody').innerHTML = rows
  $('#recordsEmpty').classList.toggle('hidden', stats.records.length > 0)
}

async function loadQr() {
  const id = state.detailTaskId
  if (!id) return
  state.qrEnded = false
  $('#qrError').classList.add('hidden')
  $('#qrImage').classList.remove('hidden')
  try {
    const qr = await api('GET', `/api/tasks/${id}/qr`)
    if (state.detailTaskId !== id) return
    $('#qrImage').src = qr.imageUrl
    $('#qrTtl').textContent = qr.ttlSeconds
    const expires = parseServerDate(qr.expiresAt).getTime()
    state.secondsLeft = Math.max(0, Math.round((expires - Date.now()) / 1000))
    updateCountdown()
    state.qrRefreshing = false
  } catch (err) {
    state.qrRefreshing = false
    if (err.code === 'TASK_ENDED') {
      state.qrEnded = true
      $('#qrImage').classList.add('hidden')
      $('#qrError').classList.remove('hidden')
      $('#qrCountdown').textContent = '已结束'
      state.secondsLeft = 0
    } else {
      throw err
    }
  }
}

function updateCountdown() {
  const el = $('#qrCountdown')
  el.textContent = state.secondsLeft + 's'
  el.classList.toggle('urgent', state.secondsLeft <= 5)
}

async function refreshQr(manual) {
  if (state.qrRefreshing || !state.detailTaskId) return
  state.qrRefreshing = true
  try {
    await loadQr()
    if (manual) toast('二维码已刷新')
  } catch (err) {
    toast(err.message, true)
  }
}

function startTicker() {
  stopTicker()
  state.tickCount = 0
  state.tickHandle = setInterval(() => {
    if (state.secondsLeft > 0) {
      state.secondsLeft -= 1
      updateCountdown()
    }
    if (state.secondsLeft <= 0 && !state.qrRefreshing && !state.qrEnded && state.detailTaskId) {
      refreshQr(false)
    }
    state.tickCount += 1
    if (state.tickCount % 10 === 0 && state.detailTaskId) {
      loadStats().catch(() => {})
    }
  }, 1000)
}

function stopTicker() {
  if (state.tickHandle) {
    clearInterval(state.tickHandle)
    state.tickHandle = null
  }
}

/* ---------- 新建任务 ---------- */

function openCreate() {
  $('#createForm').reset()
  const start = new Date(Date.now() + 5 * 60 * 1000)
  start.setSeconds(0, 0)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  $('#fStart').value = toLocalInput(start)
  $('#fEnd').value = toLocalInput(end)
  $('#fExpected').value = '0'
  $('#fTtl').value = '60'
  $('#createError').textContent = ''
  $('#modalMask').classList.remove('hidden')
  setTimeout(() => $('#fTitle').focus(), 50)
}

function closeCreate() {
  $('#modalMask').classList.add('hidden')
}

async function onCreate(event) {
  event.preventDefault()
  const errorBox = $('#createError')
  errorBox.textContent = ''
  const title = $('#fTitle').value.trim()
  const start = $('#fStart').value
  const end = $('#fEnd').value
  if (!title) {
    errorBox.textContent = '请填写签到主题'
    return
  }
  if (!start || !end || new Date(end) <= new Date(start)) {
    errorBox.textContent = '结束时间必须晚于开始时间'
    return
  }
  const button = $('#createBtn')
  button.disabled = true
  button.textContent = '创建中...'
  try {
    const task = await api('POST', '/api/tasks', {
      title,
      location: $('#fLocation').value.trim(),
      description: $('#fDesc').value.trim(),
      startTime: toServerDateTime(start),
      endTime: toServerDateTime(end),
      expectedCount: Number($('#fExpected').value) || 0,
      qrTtlSeconds: Number($('#fTtl').value) || 60
    })
    closeCreate()
    toast('签到任务已创建')
    await loadAll()
    openDetail(task.id)
  } catch (err) {
    errorBox.textContent = err.message || '创建失败'
  } finally {
    button.disabled = false
    button.textContent = '创建并查看二维码'
  }
}

/* ---------- 视图切换 ---------- */

function navigate(view) {
  state.view = view
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view)
  })
  $('#overviewView').classList.toggle('hidden', view !== 'overview')
  $('#tasksView').classList.toggle('hidden', view !== 'tasks')
  if (view === 'overview') {
    $('#pageTitle').textContent = '数据概览'
    $('#pageSub').textContent = '签到任务运行情况与今日数据'
  } else {
    $('#pageTitle').textContent = '签到任务'
    $('#pageSub').textContent = '创建、投屏二维码并跟踪签到进度'
  }
}

/* ---------- 工具函数 ---------- */

function parseServerDate(value) {
  return new Date(String(value).replace(' ', 'T'))
}

function pad(value) {
  return value < 10 ? '0' + value : String(value)
}

function formatRange(start, end) {
  const s = parseServerDate(start)
  const e = parseServerDate(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return ''
  const sameDay = s.toDateString() === e.toDateString()
  if (sameDay) {
    return `${s.getMonth() + 1}月${s.getDate()}日 ${pad(s.getHours())}:${pad(s.getMinutes())} - ${pad(e.getHours())}:${pad(e.getMinutes())}`
  }
  return `${formatDateTime(start)} - ${formatDateTime(end)}`
}

function formatDateTime(value) {
  const d = parseServerDate(value)
  if (isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toLocalInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toServerDateTime(localValue) {
  return localValue.replace('T', ' ') + ':00'
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function toast(message, isError) {
  const el = $('#toast')
  el.textContent = message
  el.classList.toggle('error', Boolean(isError))
  el.classList.add('show')
  clearTimeout(state.toastHandle)
  state.toastHandle = setTimeout(() => el.classList.remove('show'), 2400)
}
