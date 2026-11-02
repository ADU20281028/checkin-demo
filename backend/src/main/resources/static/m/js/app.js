'use strict';

/* ================================================================
 * 微信签到 H5（打包进 Android WebView 使用）
 * 单页应用：所有视图在同一个 HTML 内，由 JS 切换
 * 接口契约与小程序端保持一致（见 miniprogram/utils/api.js）
 * ================================================================ */

/* ---------------- 工具函数（沿用小程序 utils/util.js） ---------------- */

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    return new Date(value.replace(/-/g, '/'));
  }
  return new Date(value);
}

function formatDateTime(value) {
  const d = toDate(value);
  if (!d || isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(value) {
  const d = toDate(value);
  if (!d || isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(value) {
  const d = toDate(value);
  if (!d || isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRange(start, end) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return '';
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay) {
    return `${s.getMonth() + 1}月${s.getDate()}日 ${pad(s.getHours())}:${pad(s.getMinutes())} - ${pad(e.getHours())}:${pad(e.getMinutes())}`;
  }
  return `${formatDateTime(start)} - ${formatDateTime(end)}`;
}

function statusInfo(status) {
  if (status === 'ONGOING') return { text: '进行中', cls: 'active' };
  if (status === 'PENDING') return { text: '未开始', cls: 'wait' };
  return { text: '已结束', cls: 'done' };
}

function todayText() {
  const d = new Date();
  const weeks = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weeks[d.getDay()]}`;
}

function progressOf(checked, expected) {
  if (!expected || expected <= 0) return 0;
  return Math.min(100, Math.round((checked * 100) / expected));
}

function initialOf(nickname) {
  if (!nickname) return '?';
  return nickname.slice(0, 1);
}

function errorText(err) {
  if (!err) return '操作失败';
  return err.message || '操作失败';
}

function esc(value) {
  return String(value === null || value === undefined ? '' : value).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

/* ---------------- 配置与会话 ---------------- */

function apiBase() {
  return localStorage.getItem(CONFIG.API_BASE_KEY) || CONFIG.API_BASE;
}

function setApiBase(value) {
  localStorage.setItem(CONFIG.API_BASE_KEY, value);
}

function getToken() {
  return localStorage.getItem(CONFIG.TOKEN_KEY) || '';
}

function setSession(token, user) {
  localStorage.setItem(CONFIG.TOKEN_KEY, token);
  localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user || null));
}

function clearSession() {
  localStorage.removeItem(CONFIG.TOKEN_KEY);
  localStorage.removeItem(CONFIG.USER_KEY);
}

function getCachedUser() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

function loginByCode(code, nickname) {
  return request('POST', '/api/auth/login', { code: code, nickname: nickname || '' }, { auth: false }).then(data => {
    setSession(data.token, data.user);
    return data.user;
  });
}

function ensureLogin() {
  const token = getToken();
  const user = getCachedUser();
  if (token && user) {
    state.user = user;
    return Promise.resolve(user);
  }
  return Promise.reject({ code: 'NO_SESSION', message: '请先登录' });
}

/* ---------------- 网络请求 ---------------- */

function normalizeError(statusCode, body) {
  if (body && body.code) {
    return { status: statusCode, code: body.code, message: body.message || '请求失败' };
  }
  return { status: statusCode, code: 'REQUEST_FAILED', message: '请求失败，请稍后重试' };
}

function request(method, path, data, options) {
  const opts = options || {};
  const auth = opts.auth !== false;
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  const init = { method: method, headers: headers };
  if (data !== undefined && data !== null) {
    init.body = JSON.stringify(data);
  }
  return fetch(apiBase() + path, init)
    .then(res => {
      const ct = res.headers.get('content-type') || '';
      const parse =
        ct.indexOf('application/json') >= 0
          ? res.json()
          : res.text().then(t => (t ? JSON.parse(t) : null));
      return parse.then(body => {
        if (res.ok) return body;
        if (res.status === 401) {
          clearSession();
          showLogin();
        }
        throw normalizeError(res.status, body);
      });
    })
    .catch(err => {
      if (err && err.code) throw err;
      throw { code: 'NETWORK_ERROR', message: '网络连接失败，请检查后端服务是否启动' };
    });
}

/* ---------------- 全局状态 ---------------- */

const state = {
  view: 'login',
  tab: 'home',
  user: null,

  // 首页
  tasks: [],
  filter: 'all',
  homeLoading: false,
  homeError: '',

  // 记录
  records: [],
  page: 0,
  total: 0,
  hasMore: true,
  recordsLoading: false,
  recordsLoadingMore: false,
  recordsError: '',

  // 我的
  mineStats: { total: 0, taskCount: 0, ongoing: 0 },
  mineLoading: false,
  mineError: '',

  // 任务详情
  taskId: null,
  task: null,
  taskLoading: false,
  taskError: '',
  taskTimer: null,
  taskRemaining: '',
  taskCanCheckin: false,

  // 扫码
  scanContext: 'home',

  // 管理控制台
  adminLoading: false,
  adminError: '',
  adminNoPermission: false,
  overview: null,
  adminTasks: [],
  showForm: false,
  submitting: false,
  form: {},

  // 二维码投屏
  atId: null,
  atFrom: 'admin',
  atLoading: false,
  atError: '',
  atNoPermission: false,
  stats: null,
  qr: null,
  qrError: '',
  secondsLeft: 0,
  refreshing: false,
  atTimer: null,
  atTick: 0,

  // 消息弹层回调
  msgAfter: null
};

const VIEW_IDS = ['view-login', 'view-main', 'view-task', 'view-admin', 'view-admintask'];

/* ---------------- 视图切换 ---------------- */

function showView(name) {
  if (state.view === 'task' && name !== 'task') stopTaskTimer();
  if (state.view === 'admintask' && name !== 'admintask') stopAtTimer();
  state.view = name;
  VIEW_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById('view-' + name);
  if (target) target.classList.remove('hidden');
}

function showLogin() {
  stopTaskTimer();
  stopAtTimer();
  state.view = 'login';
  document.getElementById('login-api').value = apiBase();
  document.getElementById('login-error').classList.add('hidden');
  showView('login');
}

function switchTab(tab) {
  state.tab = tab;
  const titles = { home: '微信签到', records: '签到记录', mine: '我的' };
  document.getElementById('topbar-title').textContent = titles[tab] || '微信签到';
  ['home', 'records', 'mine'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('hidden', t !== tab);
  });
  document.querySelectorAll('.tab-item').forEach(btn => {
    btn.classList.toggle('tab-active', btn.dataset.tab === tab);
  });
  document.getElementById('main-scroll').scrollTop = 0;
  if (tab === 'home') loadHome();
  else if (tab === 'records') loadRecords(true);
  else loadMine();
}

/* ---------------- 通用 UI ---------------- */

function showLoading(text) {
  document.getElementById('loading-text').textContent = text || '请稍候';
  document.getElementById('loading-mask').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading-mask').classList.add('hidden');
}

function showMsg(title, content, after) {
  document.getElementById('msg-title').textContent = title;
  document.getElementById('msg-content').textContent = content || '';
  state.msgAfter = after || null;
  document.getElementById('modal-msg').classList.remove('hidden');
}

function closeMsg() {
  document.getElementById('modal-msg').classList.add('hidden');
  const after = state.msgAfter;
  state.msgAfter = null;
  if (after) after();
}

function loadingBlock(text) {
  return `<div class="loading">${esc(text)}</div>`;
}

function stateBlock(title, desc, action) {
  return (
    `<div class="state-block"><span class="state-title">${esc(title)}</span>` +
    `<span class="state-desc">${esc(desc)}</span>` +
    (action
      ? `<button class="btn-ghost retry-btn" type="button" data-action="${action}">重新加载</button>`
      : '') +
    `</div>`
  );
}

function emptyBlock(title, desc) {
  return (
    `<div class="empty"><div class="empty-ring"></div>` +
    `<span class="empty-title">${esc(title)}</span>` +
    `<span class="empty-desc">${esc(desc)}</span></div>`
  );
}

function topbarHtml(action, title) {
  return (
    `<header class="topbar">` +
    `<button class="back-btn" type="button" data-action="${action}">‹</button>` +
    `<span class="topbar-title">${esc(title)}</span></header>`
  );
}

/* ---------------- 登录 ---------------- */

function renderLoginIdentities() {
  const box = document.getElementById('login-identities');
  box.innerHTML = CONFIG.DEV_IDENTITIES.map(
    it =>
      `<button class="identity-btn" type="button" data-action="login-identity" data-code="${esc(it.code)}">` +
      `<span>${esc(it.label)}</span><span class="identity-code">${esc(it.code)}</span></button>`
  ).join('');
}

function saveLoginApi() {
  const input = document.getElementById('login-api');
  const value = (input.value || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(value)) {
    showLoginError('服务地址需以 http:// 或 https:// 开头');
    return;
  }
  setApiBase(value);
  document.getElementById('login-error').classList.add('hidden');
}

function showLoginError(text) {
  const box = document.getElementById('login-error');
  box.textContent = text;
  box.classList.remove('hidden');
}

function doLogin(code) {
  if (!apiBase()) {
    showLoginError('请先在上方填写后端服务地址并点“保存”');
    return;
  }
  showLoading('登录中…');
  loginByCode(code)
    .then(user => {
      hideLoading();
      localStorage.setItem('checkin_last_code', code);
      state.user = user;
      resetAppState();
      showView('main');
      switchTab('home');
    })
    .catch(err => {
      hideLoading();
      showLoginError(errorText(err));
    });
}

function resetAppState() {
  state.tasks = [];
  state.filter = 'all';
  state.records = [];
  state.page = 0;
  state.total = 0;
  state.hasMore = true;
  state.task = null;
  state.taskId = null;
  state.overview = null;
  state.adminTasks = [];
  state.showForm = false;
  state.stats = null;
  state.qr = null;
}

function logout() {
  clearSession();
  state.user = null;
  resetAppState();
  showLogin();
}

/* ---------------- 首页：任务列表 ---------------- */

function decorateTasks(tasks) {
  return (tasks || []).map(task => {
    const info = statusInfo(task.status);
    return Object.assign({}, task, {
      statusText: info.text,
      statusClass: info.cls,
      timeText: formatRange(task.startTime, task.endTime),
      progress: progressOf(task.checkedCount, task.expectedCount)
    });
  });
}

function loadHome() {
  state.homeLoading = true;
  state.homeError = '';
  renderHome();
  return ensureLogin()
    .then(user => {
      state.user = user;
      renderHero(user);
      return request('GET', '/api/tasks');
    })
    .then(tasks => {
      state.tasks = decorateTasks(tasks);
      state.homeLoading = false;
      state.homeError = '';
      renderHero(state.user);
      renderHome();
    })
    .catch(err => {
      state.homeLoading = false;
      state.homeError = errorText(err);
      renderHome();
    });
}

function renderHero(user) {
  const u = user || {};
  document.getElementById('home-greeting').textContent = '你好，' + (u.nickname || '同学');
  document.getElementById('home-date').textContent = todayText();
  const avatar = document.getElementById('home-avatar');
  if (u.avatarUrl) {
    avatar.innerHTML = `<img src="${esc(u.avatarUrl)}" alt="">`;
  } else {
    avatar.textContent = initialOf(u.nickname);
  }
  document.getElementById('home-ongoing').textContent = state.tasks.filter(t => t.status === 'ONGOING').length;
  document.getElementById('home-upcoming').textContent = state.tasks.filter(t => t.status === 'PENDING').length;
  document.getElementById('home-checked').textContent = state.tasks.filter(t => t.myChecked).length;
}

function filteredTasks() {
  const source = state.tasks;
  if (state.filter === 'ongoing') return source.filter(t => t.status === 'ONGOING');
  if (state.filter === 'upcoming') return source.filter(t => t.status === 'PENDING');
  if (state.filter === 'ended') return source.filter(t => t.status === 'ENDED');
  return source;
}

function taskCardHtml(t) {
  let mine = '';
  if (t.myChecked) mine = `<span class="mine-tag done">已签到</span>`;
  else if (t.status === 'ONGOING') mine = `<span class="mine-tag todo">待签到</span>`;
  return (
    `<div class="card task-card" data-action="open-task" data-id="${t.id}">` +
    `<div class="card-top"><span class="task-title">${esc(t.title)}</span>` +
    `<span class="badge badge-${t.statusClass}">${esc(t.statusText)}</span></div>` +
    (t.location
      ? `<div class="task-meta"><span class="meta-dot"></span><span class="meta-text">${esc(t.location)}</span></div>`
      : '') +
    `<div class="task-meta"><span class="meta-dot"></span><span class="meta-text">${esc(t.timeText)}</span></div>` +
    `<div class="card-bottom"><div class="progress-wrap">` +
    `<div class="progress-track"><div class="progress-bar" style="width:${t.progress}%"></div></div>` +
    `<span class="progress-text">${t.checkedCount} / ${t.expectedCount} 人已签到</span></div>` +
    mine +
    `</div></div>`
  );
}

function renderHome() {
  renderHero(state.user);
  document.querySelectorAll('#home-tabs .tab').forEach(btn => {
    btn.classList.toggle('tab-active', btn.dataset.filter === state.filter);
  });
  const body = document.getElementById('home-body');
  if (state.homeLoading && !state.tasks.length) {
    body.innerHTML = loadingBlock('正在加载签到任务...');
    return;
  }
  if (state.homeError) {
    body.innerHTML = stateBlock('加载失败', state.homeError, 'home-retry');
    return;
  }
  const view = filteredTasks();
  if (!view.length) {
    body.innerHTML = emptyBlock('暂无签到任务', '切换筛选条件，或等待老师发布新的签到');
    return;
  }
  body.innerHTML = view.map(taskCardHtml).join('');
}

/* ---------------- 记录：分页加载 ---------------- */

function decorateRecord(record) {
  const d = toDate(record.checkinTime) || new Date();
  return Object.assign({}, record, {
    dayText: pad(d.getDate()),
    monthText: `${d.getMonth() + 1}月`,
    timeText: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    weekday: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()],
    methodText: record.method === 'QR' ? '二维码签到' : '已签到'
  });
}

function recordCardHtml(r) {
  return (
    `<div class="card record-card" data-action="open-task" data-id="${r.taskId}">` +
    `<div class="record-date"><span class="record-day">${esc(r.dayText)}</span>` +
    `<span class="record-month">${esc(r.monthText)} ${esc(r.weekday)}</span></div>` +
    `<div class="record-divider"></div>` +
    `<div class="record-main"><span class="record-title">${esc(r.taskTitle)}</span>` +
    `<div class="record-meta"><span class="record-time">${esc(r.timeText)}</span>` +
    `<span class="record-tag">${esc(r.methodText)}</span></div></div>` +
    `<div class="record-check">✓</div></div>`
  );
}

function loadRecords(reset) {
  if (reset) {
    if (state.recordsLoading) return Promise.resolve();
    state.recordsLoading = true;
    state.recordsError = '';
    if (!state.records.length) renderRecords();
  } else {
    if (state.recordsLoading || state.recordsLoadingMore || !state.hasMore) return Promise.resolve();
    state.recordsLoadingMore = true;
    renderRecords();
  }
  const page = reset ? 1 : state.page + 1;
  return ensureLogin()
    .then(() =>
      request('GET', `/api/checkins/my?page=${page}&size=${CONFIG.PAGE_SIZE}`)
    )
    .then(result => {
      const items = (result.list || []).map(decorateRecord);
      const list = reset ? items : state.records.concat(items);
      state.records = list;
      state.page = page;
      state.total = result.total;
      state.hasMore = list.length < result.total;
      state.recordsLoading = false;
      state.recordsLoadingMore = false;
      state.recordsError = '';
      renderRecords();
    })
    .catch(err => {
      state.recordsLoading = false;
      state.recordsLoadingMore = false;
      state.recordsError = errorText(err);
      renderRecords();
    });
}

function renderRecords() {
  document.getElementById('records-count').textContent = `累计 ${state.total} 次`;
  const body = document.getElementById('records-body');
  if (state.recordsLoading && !state.records.length) {
    body.innerHTML = loadingBlock('正在加载记录...');
    return;
  }
  if (state.recordsError) {
    body.innerHTML = stateBlock('加载失败', state.recordsError, 'records-retry');
    return;
  }
  if (!state.records.length) {
    body.innerHTML = emptyBlock('还没有签到记录', '完成第一次扫码签到后，记录会显示在这里');
    return;
  }
  let html = `<div class="record-list">${state.records.map(recordCardHtml).join('')}</div>`;
  if (state.recordsLoadingMore) {
    html += `<div class="loading-more">加载更多...</div>`;
  } else if (state.hasMore) {
    html += `<div class="record-list"><button class="btn-ghost load-more-btn" type="button" data-action="records-more">加载更多</button></div>`;
  } else {
    html += `<div class="record-list"><div class="no-more">已经到底了</div></div>`;
  }
  body.innerHTML = html;
}

/* ---------------- 我的 ---------------- */

function renderMine() {
  const u = state.user || {};
  const isAdmin = u.role === 'ADMIN';
  const stats = state.mineStats;
  const avatar = u.avatarUrl
    ? `<img src="${esc(u.avatarUrl)}" alt="">`
    : esc(initialOf(u.nickname));

  let html = '';
  html += `<div class="profile-card"><div class="profile-row">`;
  html += `<div class="profile-avatar">${avatar}</div>`;
  html += `<div class="profile-info"><div class="profile-name">${esc(u.nickname || '未登录')}</div>`;
  html += `<span class="role-chip${isAdmin ? ' role-admin' : ''}">${isAdmin ? '管理员' : '普通用户'}</span></div>`;
  html += `</div><div class="profile-stats">`;
  html += `<div class="p-stat"><span class="p-num">${stats.total}</span><span class="p-label">累计签到</span></div>`;
  html += `<div class="p-divider"></div>`;
  html += `<div class="p-stat"><span class="p-num">${stats.taskCount}</span><span class="p-label">全部任务</span></div>`;
  html += `<div class="p-divider"></div>`;
  html += `<div class="p-stat"><span class="p-num">${stats.ongoing}</span><span class="p-label">进行中</span></div>`;
  html += `</div></div>`;

  if (state.mineLoading && !stats.taskCount && !state.mineError) {
    html += loadingBlock('正在加载个人信息...');
  }

  if (state.mineError) {
    html += stateBlock('加载失败', state.mineError, 'mine-retry');
  }

  if (isAdmin) {
    html +=
      `<button class="card menu-card" type="button" data-action="mine-admin">` +
      `<span class="menu-icon">管</span><span class="menu-main">` +
      `<span class="menu-title">签到管理</span>` +
      `<span class="menu-desc">创建签到任务、投屏二维码、查看统计</span></span>` +
      `<span class="menu-arrow">›</span></button>`;
  }

  html +=
    `<div class="card menu-card">` +
    `<span class="menu-icon dev-icon">调</span><span class="menu-main">` +
    `<span class="menu-title">身份切换</span>` +
    `<span class="menu-desc">开发模式演示身份，点击即可重新登录</span>` +
    `<span class="identity-inline">` +
    CONFIG.DEV_IDENTITIES.map(it => {
      const active = u.openid === it.code || it.code === localStorage.getItem('checkin_last_code');
      return `<button class="identity-chip${active ? ' chip-active' : ''}" type="button" data-action="mine-switch" data-code="${esc(it.code)}">${esc(it.label.split(' · ')[0])} ${esc(it.label.split(' · ')[1] || '')}</button>`;
    }).join('') +
    `</span></span></div>`;

  html +=
    `<div class="card menu-card">` +
    `<span class="menu-icon">址</span><span class="menu-main">` +
    `<span class="menu-title">服务地址</span>` +
    `<span class="menu-desc">切换网络后可在此调整后端地址</span>` +
    `<span class="api-row"><input id="mine-api" class="field-input" type="text" value="${esc(apiBase())}">` +
    `<button class="mini-btn" type="button" data-action="mine-api-save">保存</button></span></span></div>`;

  html +=
    `<button class="card menu-card" type="button" data-action="mine-logout">` +
    `<span class="menu-icon danger-icon">退</span><span class="menu-main">` +
    `<span class="menu-title">退出登录</span>` +
    `<span class="menu-desc">清除本地登录状态并返回登录页</span></span>` +
    `<span class="menu-arrow">›</span></button>`;

  html +=
    `<div class="foot-info"><span>微信签到 H5</span>` +
    `<span>服务地址：${esc(apiBase())}</span>` +
    `<span>版本 1.0.0 · 本科毕业设计</span></div>`;

  document.getElementById('mine-body').innerHTML = html;
}

function loadMine() {
  state.mineLoading = true;
  state.mineError = '';
  renderMine();
  ensureLogin()
    .then(user =>
      Promise.all([
        request('GET', '/api/checkins/my?page=1&size=1'),
        request('GET', '/api/tasks'),
        Promise.resolve(user)
      ])
    )
    .then(([records, tasks, user]) => {
      state.user = user;
      state.mineStats = {
        total: records.total,
        taskCount: tasks.length,
        ongoing: tasks.filter(t => t.status === 'ONGOING').length
      };
      state.mineLoading = false;
      state.mineError = '';
      renderMine();
    })
    .catch(err => {
      state.mineLoading = false;
      state.mineError = errorText(err);
      renderMine();
    });
}

function saveMineApi() {
  const input = document.getElementById('mine-api');
  if (!input) return;
  const value = (input.value || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(value)) {
    showMsg('地址无效', '服务地址需以 http:// 或 https:// 开头');
    return;
  }
  setApiBase(value);
  showMsg('已保存', '服务地址：' + value, () => loadMine());
}

function switchIdentity(code) {
  showLoading('切换中…');
  loginByCode(code)
    .then(user => {
      localStorage.setItem('checkin_last_code', code);
      hideLoading();
      state.user = user;
      resetAppState();
      showMsg('已切换身份', '当前身份：' + (user.role === 'ADMIN' ? '管理员' : '普通用户') + '（' + user.nickname + '）', () =>
        loadMine()
      );
    })
    .catch(err => {
      hideLoading();
      showMsg('切换失败', errorText(err));
    });
}

/* ---------------- 任务详情 ---------------- */

function decorateDetail(task) {
  const info = statusInfo(task.status);
  return Object.assign({}, task, {
    statusText: info.text,
    statusClass: info.cls,
    timeText: formatRange(task.startTime, task.endTime),
    progress: progressOf(task.checkedCount, task.expectedCount),
    myCheckinText: task.myChecked ? formatDateTime(task.myCheckinTime) : '',
    isAdmin: !!state.user && state.user.role === 'ADMIN'
  });
}

function openTask(id) {
  state.taskId = id;
  state.task = null;
  state.taskError = '';
  showView('task');
  renderTask();
  loadTask();
}

function closeTask() {
  stopTaskTimer();
  showView('main');
  switchTab(state.tab);
}

function loadTask() {
  const had = !!state.task;
  state.taskLoading = true;
  state.taskError = '';
  if (!had) renderTask();
  request('GET', '/api/tasks/' + state.taskId)
    .then(task => {
      state.task = decorateDetail(task);
      state.taskLoading = false;
      state.taskError = '';
      renderTask();
      startTaskTimer();
    })
    .catch(err => {
      state.taskLoading = false;
      state.taskError = errorText(err);
      renderTask();
    });
}

function infoRowHtml(label, value, success) {
  return (
    `<div class="info-row"><span class="info-label">${esc(label)}</span>` +
    `<span class="info-value${success ? ' success' : ''}">${esc(value)}</span></div>`
  );
}

function renderTask() {
  const el = document.getElementById('view-task');
  if (state.taskLoading && !state.task) {
    el.innerHTML = topbarHtml('task-back', '任务详情') + `<div class="scroll">${loadingBlock('正在加载签到详情...')}</div>`;
    return;
  }
  if (state.taskError && !state.task) {
    el.innerHTML =
      topbarHtml('task-back', '任务详情') + `<div class="scroll">${stateBlock('加载失败', state.taskError, 'task-retry')}</div>`;
    return;
  }
  const t = state.task;
  if (!t) return;

  let h = topbarHtml('task-back', '任务详情');
  h += `<div class="scroll pad-bottom">`;
  h += `<div class="detail-hero">`;
  h += `<span id="task-badge" class="badge badge-${t.statusClass}">${esc(t.statusText)}</span>`;
  h += `<div class="detail-title">${esc(t.title)}</div>`;
  if (t.description) h += `<div class="detail-desc">${esc(t.description)}</div>`;
  h += `<div class="countdown">`;
  h += `<div id="task-remaining" class="countdown-label">${esc(state.taskRemaining || '计算中…')}</div>`;
  h += `<div class="countdown-track"><div id="task-progress-fill" class="countdown-fill" style="width:${t.progress}%"></div></div>`;
  h += `<div class="countdown-sub">${t.checkedCount} / ${t.expectedCount} 人已签到</div>`;
  h += `</div></div>`;

  h += `<div class="card info-card">`;
  h += infoRowHtml('签到时间', t.timeText);
  h += infoRowHtml('签到地点', t.location || '未设置地点');
  h += infoRowHtml('发布人', t.createdByName || '—');
  if (t.myChecked) h += infoRowHtml('我的签到', t.myCheckinText, true);
  h += `</div>`;

  h += `<div class="action-area">`;
  if (t.myChecked) {
    h +=
      `<div class="signed-card"><div class="signed-icon">✓</div><div class="signed-text">` +
      `<span class="signed-title">签到成功</span>` +
      `<span class="signed-desc">记录已保存，可在「记录」页查看</span></div></div>`;
  } else {
    h += `<button id="task-scan-btn" class="btn-primary scan-action" type="button" data-action="task-scan">扫描二维码签到</button>`;
  }
  h += `<div class="hint">二维码由发布人动态生成，过期后会自动刷新，请使用最新二维码签到</div>`;
  h += `</div>`;

  if (t.isAdmin) {
    h +=
      `<div class="card admin-entry" data-action="task-admin">` +
      `<div><span class="admin-title">管理这个签到</span>` +
      `<span class="admin-desc">查看二维码、实时签到名单与缺勤统计</span></div>` +
      `<span class="arrow">›</span></div>`;
  }

  h += `</div>`;
  el.innerHTML = h;
}

function durationText(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function taskTick() {
  const task = state.task;
  if (!task) return;
  const now = Date.now();
  const start = toDate(task.startTime).getTime();
  const end = toDate(task.endTime).getTime();
  let status = 'ENDED';
  let remainingText = '签到已结束';
  if (now < start) {
    status = 'PENDING';
    remainingText = '距开始 ' + durationText(start - now);
  } else if (now <= end) {
    status = 'ONGOING';
    remainingText = '距结束 ' + durationText(end - now);
  }
  const info = statusInfo(status);
  const canCheckin = status === 'ONGOING' && !task.myChecked;
  state.taskRemaining = remainingText;
  state.taskCanCheckin = canCheckin;

  const badge = document.getElementById('task-badge');
  if (badge) {
    badge.textContent = info.text;
    badge.className = 'badge badge-' + info.cls;
  }
  const remain = document.getElementById('task-remaining');
  if (remain) remain.textContent = remainingText;
  const btn = document.getElementById('task-scan-btn');
  if (btn) {
    btn.textContent = canCheckin ? '扫描二维码签到' : '当前不可签到';
    btn.classList.toggle('scan-disabled', !canCheckin);
  }
}

function startTaskTimer() {
  stopTaskTimer();
  taskTick();
  state.taskTimer = setInterval(taskTick, 1000);
}

function stopTaskTimer() {
  if (state.taskTimer) {
    clearInterval(state.taskTimer);
    state.taskTimer = null;
  }
}

function onTaskScan() {
  const task = state.task;
  if (!task) return;
  if (!state.taskCanCheckin) {
    if (task.myChecked) showMsg('提示', '你已完成签到');
    else showMsg('提示', '当前不在签到时间内');
    return;
  }
  openScanModal('task');
}

/* ---------------- 扫码签到 ---------------- */

function openScanModal(context) {
  state.scanContext = context || 'home';
  const nativeBtn = document.getElementById('scan-native-btn');
  const tip = document.getElementById('scan-bridge-tip');
  const hasBridge = !!window.AndroidBridge && typeof window.AndroidBridge.scanQR === 'function';
  nativeBtn.classList.toggle('hidden', !hasBridge);
  tip.classList.toggle('hidden', hasBridge);
  document.getElementById('scan-token-input').value = '';
  document.getElementById('modal-scan').classList.remove('hidden');
}

function closeScanModal() {
  document.getElementById('modal-scan').classList.add('hidden');
}

/**
 * 调用 Android 原生扫码：window.AndroidBridge.scanQR()
 * 兼容三种返回方式：Promise / 同步字符串 / 回调参数
 */
function nativeScan() {
  return new Promise((resolve, reject) => {
    const bridge = window.AndroidBridge;
    if (!bridge || typeof bridge.scanQR !== 'function') {
      reject({ code: 'NO_SCAN', message: '当前环境不支持摄像头扫码' });
      return;
    }
    let settled = false;
    const ok = value => {
      if (settled) return;
      settled = true;
      if (typeof value === 'string') resolve(value);
      else if (value && typeof value.result === 'string') resolve(value.result);
      else resolve('');
    };
    const fail = err => {
      if (settled) return;
      settled = true;
      reject(err && err.code ? err : { code: 'SCAN_FAILED', message: (err && err.message) || '扫码失败，请重试' });
    };
    let ret;
    try {
      // 原生桥（Android APK）为无参方法，结果经 window.__scanOk / __scanFail 回传
      if (bridge.scanQR.length === 0) {
        window.__scanOk = ok;
        window.__scanFail = fail;
        bridge.scanQR();
        return;
      }
      ret = bridge.scanQR(ok);
    } catch (e) {
      fail({ code: 'SCAN_FAILED', message: '调起扫码失败，请重试' });
      return;
    }
    if (ret && typeof ret.then === 'function') {
      ret.then(ok, fail);
    } else if (typeof ret === 'string') {
      ok(ret);
    }
    setTimeout(() => {
      fail({ code: 'SCAN_TIMEOUT', message: '扫码超时，请重试或手动输入令牌' });
    }, 60000);
  });
}

function onNativeScan() {
  showLoading('正在打开扫码…');
  nativeScan()
    .then(token => {
      hideLoading();
      if (!token) {
        showMsg('扫码失败', '未识别到二维码内容，请重试或手动输入令牌');
        return;
      }
      submitCheckin(token);
    })
    .catch(err => {
      hideLoading();
      if (err.code === 'NO_SCAN') {
        document.getElementById('scan-native-btn').classList.add('hidden');
        document.getElementById('scan-bridge-tip').classList.remove('hidden');
      } else {
        showMsg('扫码失败', errorText(err));
      }
    });
}

function onManualSubmit() {
  const input = document.getElementById('scan-token-input');
  const token = (input.value || '').trim();
  if (!token) {
    showMsg('提示', '请输入二维码令牌内容');
    return;
  }
  submitCheckin(token);
}

function submitCheckin(token) {
  showLoading('签到中…');
  request('POST', '/api/checkins', { qrToken: token })
    .then(result => {
      hideLoading();
      closeScanModal();
      showMsg(
        '签到成功',
        `任务：${result.taskTitle}\n签到时间：${formatDateTime(result.checkinTime)}`,
        () => {
          if (state.scanContext === 'task' && state.view === 'task') loadTask();
          else loadHome();
        }
      );
    })
    .catch(err => {
      hideLoading();
      showMsg('签到失败', errorText(err));
    });
}

/* ---------------- 管理控制台 ---------------- */

function openAdmin() {
  state.adminLoading = true;
  state.adminError = '';
  state.adminNoPermission = false;
  state.overview = null;
  state.adminTasks = [];
  showView('admin');
  renderAdmin();
  loadAdmin();
}

function closeAdmin() {
  showView('main');
  switchTab('mine');
}

function loadAdmin() {
  state.adminLoading = true;
  state.adminError = '';
  state.adminNoPermission = false;
  renderAdmin();
  ensureLogin()
    .then(user => {
      if (user.role !== 'ADMIN') {
        state.adminLoading = false;
        state.adminNoPermission = true;
        renderAdmin();
        return null;
      }
      return Promise.all([request('GET', '/api/stats/overview'), request('GET', '/api/tasks')]).then(
        ([overview, tasks]) => {
          state.overview = overview;
          state.adminTasks = decorateTasks(tasks);
          state.adminLoading = false;
          state.adminError = '';
          renderAdmin();
        }
      );
    })
    .catch(err => {
      state.adminLoading = false;
      state.adminError = errorText(err);
      renderAdmin();
    });
}

function initAdminForm() {
  const start = new Date(Date.now() + 5 * 60 * 1000);
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  state.form = {
    title: '',
    location: '',
    description: '',
    expectedCount: '0',
    qrTtlSeconds: '60',
    startDate: formatDate(start),
    startTime: formatTime(start),
    endDate: formatDate(end),
    endTime: formatTime(end)
  };
}

function adminFormHtml() {
  const f = state.form;
  return (
    `<div class="card form-card">` +
    `<span class="form-title">新建签到任务</span>` +
    `<div class="field"><label class="field-label">签到主题</label>` +
    `<input class="field-input" type="text" maxlength="80" placeholder="例如：数据结构课程签到" data-field="title" value="${esc(f.title)}"></div>` +
    `<div class="field"><label class="field-label">签到地点</label>` +
    `<input class="field-input" type="text" maxlength="120" placeholder="选填，例如：教学楼 A302" data-field="location" value="${esc(f.location)}"></div>` +
    `<div class="field"><label class="field-label">签到说明</label>` +
    `<textarea class="field-textarea" rows="3" maxlength="500" placeholder="选填，补充签到要求" data-field="description">${esc(f.description)}</textarea></div>` +
    `<div class="field"><label class="field-label">开始时间</label><div class="picker-row">` +
    `<input class="field-input" type="date" data-field="startDate" value="${esc(f.startDate)}">` +
    `<input class="field-input" type="time" data-field="startTime" value="${esc(f.startTime)}"></div></div>` +
    `<div class="field"><label class="field-label">结束时间</label><div class="picker-row">` +
    `<input class="field-input" type="date" data-field="endDate" value="${esc(f.endDate)}">` +
    `<input class="field-input" type="time" data-field="endTime" value="${esc(f.endTime)}"></div></div>` +
    `<div class="field-row">` +
    `<div class="field field-half"><label class="field-label">应到人数</label>` +
    `<input class="field-input" type="number" placeholder="0 表示全部用户" data-field="expectedCount" value="${esc(f.expectedCount)}"></div>` +
    `<div class="field field-half"><label class="field-label">二维码有效期(秒)</label>` +
    `<input class="field-input" type="number" placeholder="30 - 600" data-field="qrTtlSeconds" value="${esc(f.qrTtlSeconds)}"></div>` +
    `</div>` +
    `<button class="btn-primary submit-btn" type="button" data-action="admin-submit"${state.submitting ? ' disabled' : ''}>` +
    `${state.submitting ? '创建中…' : '创建并生成二维码'}</button>` +
    `<span class="form-hint">创建后将自动生成动态签到二维码</span>` +
    `</div>`
  );
}

function adminTaskCardHtml(t) {
  return (
    `<div class="card admin-task" data-action="admin-open-task" data-id="${t.id}">` +
    `<div class="admin-task-top"><span class="admin-task-title">${esc(t.title)}</span>` +
    `<span class="badge badge-${t.statusClass}">${esc(t.statusText)}</span></div>` +
    `<span class="admin-task-time">${esc(t.timeText)}</span>` +
    `<div class="admin-task-foot">` +
    `<span class="admin-task-count">${t.checkedCount} / ${t.expectedCount} 人已签到</span>` +
    `<span class="admin-task-link">查看二维码与统计 ›</span></div></div>`
  );
}

function renderAdmin() {
  const el = document.getElementById('view-admin');
  if (state.adminNoPermission) {
    el.innerHTML =
      topbarHtml('admin-back', '签到管理') +
      `<div class="scroll">${stateBlock('无管理权限', '当前账号不是管理员，可在「我的」页切换演示身份')}</div>`;
    return;
  }
  if (state.adminLoading && !state.overview) {
    el.innerHTML = topbarHtml('admin-back', '签到管理') + `<div class="scroll">${loadingBlock('正在加载管理数据...')}</div>`;
    return;
  }
  if (state.adminError && !state.overview) {
    el.innerHTML =
      topbarHtml('admin-back', '签到管理') +
      `<div class="scroll">${stateBlock('加载失败', state.adminError, 'admin-retry')}</div>`;
    return;
  }
  const o = state.overview || {};
  let h = topbarHtml('admin-back', '签到管理');
  h += `<div class="scroll pad-bottom">`;
  h += `<div class="admin-hero"><div class="admin-eyebrow">管理控制台</div><div class="admin-title">签到任务与数据</div>`;
  h += `<div class="overview-grid">`;
  h += `<div class="overview-item"><span class="overview-num">${o.totalUsers || 0}</span><span class="overview-label">注册用户</span></div>`;
  h += `<div class="overview-item"><span class="overview-num">${o.totalTasks || 0}</span><span class="overview-label">签到任务</span></div>`;
  h += `<div class="overview-item"><span class="overview-num">${o.ongoingTasks || 0}</span><span class="overview-label">进行中</span></div>`;
  h += `<div class="overview-item"><span class="overview-num">${o.totalCheckins || 0}</span><span class="overview-label">累计签到</span></div>`;
  h += `</div></div>`;

  h += `<div class="toolbar"><span class="toolbar-title">签到任务</span>` +
    `<button class="create-btn" type="button" data-action="admin-toggle-form">${state.showForm ? '收起' : '+ 新建签到'}</button></div>`;

  if (state.showForm) h += adminFormHtml();

  h += `<div class="task-list">`;
  h += state.adminTasks.length
    ? state.adminTasks.map(adminTaskCardHtml).join('')
    : emptyBlock('还没有签到任务', '点击「新建签到」发布第一个任务');
  h += `</div></div>`;
  el.innerHTML = h;
}

function toggleAdminForm() {
  state.showForm = !state.showForm;
  if (state.showForm) initAdminForm();
  renderAdmin();
}

function onAdminInput(e) {
  const el = e.target.closest('[data-field]');
  if (el) state.form[el.dataset.field] = el.value;
}

function submitAdminForm() {
  const form = state.form;
  if (!form.title || !form.title.trim()) {
    showMsg('提示', '请填写签到主题');
    return;
  }
  const startText = `${form.startDate} ${form.startTime}:00`;
  const endText = `${form.endDate} ${form.endTime}:00`;
  if (toDate(endText).getTime() <= toDate(startText).getTime()) {
    showMsg('提示', '结束时间需晚于开始时间');
    return;
  }
  state.submitting = true;
  renderAdmin();
  request('POST', '/api/tasks', {
    title: form.title.trim(),
    location: (form.location || '').trim(),
    description: (form.description || '').trim(),
    startTime: startText,
    endTime: endText,
    expectedCount: Number(form.expectedCount) || 0,
    qrTtlSeconds: Number(form.qrTtlSeconds) || 60
  })
    .then(task => {
      state.submitting = false;
      state.showForm = false;
      renderAdmin();
      showMsg('签到任务已创建', '即将打开展示二维码投屏页', () => openAdminTask(task.id, 'admin'));
    })
    .catch(err => {
      state.submitting = false;
      renderAdmin();
      showMsg('创建失败', errorText(err));
    });
}

/* ---------------- 二维码投屏 ---------------- */

function openAdminTask(id, from) {
  state.atId = id;
  state.atFrom = from || 'admin';
  state.atLoading = true;
  state.atError = '';
  state.atNoPermission = false;
  state.stats = null;
  state.qr = null;
  state.qrError = '';
  showView('admintask');
  renderAdminTask();
  loadAdminTask();
}

function closeAdminTask() {
  stopAtTimer();
  if (state.atFrom === 'task') {
    showView('task');
    renderTask();
    startTaskTimer();
    loadTask();
  } else {
    showView('admin');
    renderAdmin();
    loadAdmin();
  }
}

function loadAdminTask() {
  state.atLoading = true;
  state.atError = '';
  state.atNoPermission = false;
  renderAdminTask();
  ensureLogin()
    .then(user => {
      if (user.role !== 'ADMIN') {
        state.atLoading = false;
        state.atNoPermission = true;
        renderAdminTask();
        return null;
      }
      return Promise.all([
        request('GET', `/api/tasks/${state.atId}/stats`),
        request('GET', `/api/tasks/${state.atId}/qr`)
      ]).then(([stats, qr]) => {
        applyAtStats(stats);
        applyQr(qr);
        state.atLoading = false;
        state.atError = '';
        renderAdminTask();
        startAtTimer();
      });
    })
    .catch(err => {
      state.atLoading = false;
      state.atError = errorText(err);
      renderAdminTask();
    });
}

function applyAtStats(stats) {
  const info = statusInfo(stats.status);
  state.stats = stats;
  state.atStatusText = info.text;
  state.atStatusClass = info.cls;
  state.atTimeText = formatRange(stats.startTime, stats.endTime);
  state.atRateText = (Number(stats.attendanceRate) || 0).toFixed(1) + '%';
}

function atRecordsHtml() {
  const records = (state.stats && state.stats.records) || [];
  if (!records.length) {
    return emptyBlock('暂无签到记录', '学生扫码签到后，名单会实时更新');
  }
  return records
    .map(r =>
      `<div class="at-record">` +
      `<div class="at-avatar">${esc(initialOf(r.nickname))}</div>` +
      `<div class="at-record-main"><span class="at-name">${esc(r.nickname)}</span>` +
      `<span class="at-time">${esc(formatDateTime(r.checkinTime))}</span></div>` +
      `<span class="at-done">已签到</span></div>`
    )
    .join('');
}

function qrBodyHtml() {
  if (state.qrError) {
    return `<div class="qr-error">${esc(state.qrError)}</div>`;
  }
  if (!state.qr) return '';
  const src = apiBase() + '/api/qr/' + encodeURIComponent(state.qr.token);
  return (
    `<div class="qr-body">` +
    `<img id="at-qr-img" class="qr-image" src="${esc(src)}" alt="签到二维码">` +
    `<span class="qr-tip">请使用投屏或另一台设备展示，学生扫码即可签到</span></div>`
  );
}

function renderAdminTask() {
  const el = document.getElementById('view-admintask');
  if (state.atNoPermission) {
    el.innerHTML =
      topbarHtml('at-back', '二维码投屏') +
      `<div class="scroll">${stateBlock('无管理权限', '当前账号不是管理员，无法查看签到二维码与统计')}</div>`;
    return;
  }
  if (state.atLoading && !state.stats) {
    el.innerHTML = topbarHtml('at-back', '二维码投屏') + `<div class="scroll">${loadingBlock('正在加载签到数据...')}</div>`;
    return;
  }
  if (state.atError && !state.stats) {
    el.innerHTML =
      topbarHtml('at-back', '二维码投屏') + `<div class="scroll">${stateBlock('加载失败', state.atError, 'at-retry')}</div>`;
    return;
  }
  const s = state.stats;
  if (!s) return;

  let h = topbarHtml('at-back', '二维码投屏');
  h += `<div class="scroll pad-bottom">`;
  h += `<div class="head-card"><div class="head-top">` +
    `<span class="head-title">${esc(s.title)}</span>` +
    `<span id="at-status" class="badge badge-${state.atStatusClass}">${esc(state.atStatusText)}</span></div>` +
    `<span id="at-time" class="head-time">${esc(state.atTimeText)}</span></div>`;

  h += `<div class="card qr-card"><div class="qr-head"><div>` +
    `<span class="qr-title">签到二维码</span>` +
    `<span class="qr-sub">每 ${state.qr ? state.qr.ttlSeconds : '—'} 秒自动刷新，防止截图复用</span></div>` +
    `<span id="at-seconds" class="qr-countdown${state.secondsLeft <= 5 ? ' urgent' : ''}">${state.secondsLeft}s</span></div>`;
  h += `<div id="at-qr-body">${qrBodyHtml()}</div>`;
  h += `<button id="at-refresh-btn" class="btn-ghost refresh-btn" type="button" data-action="at-refresh-qr">` +
    `${state.refreshing ? '刷新中…' : '立即刷新二维码'}</button>`;
  h += `</div>`;

  h += `<div class="stat-grid">`;
  h += `<div class="stat-cell"><span id="at-expected" class="cell-num">${s.expectedCount}</span><span class="cell-label">应到人数</span></div>`;
  h += `<div class="stat-cell highlight"><span id="at-checked" class="cell-num">${s.checkedCount}</span><span class="cell-label">已签到</span></div>`;
  h += `<div class="stat-cell warn"><span id="at-absent" class="cell-num">${s.absentCount}</span><span class="cell-label">缺勤</span></div>`;
  h += `<div class="stat-cell"><span id="at-rate" class="cell-num">${esc(state.atRateText)}</span><span class="cell-label">出勤率</span></div>`;
  h += `</div>`;

  h += `<div class="record-section"><div class="record-head">` +
    `<span class="record-title">签到名单</span>` +
    `<span id="at-record-count" class="record-count">共 ${s.checkedCount} 人</span></div>` +
    `<div id="at-record-list">${atRecordsHtml()}</div></div>`;

  h += `</div>`;
  el.innerHTML = h;
}

function applyQr(qr) {
  state.qr = qr;
  state.qrError = '';
  const expires = toDate(qr.expiresAt).getTime();
  state.secondsLeft = Math.max(0, Math.round((expires - Date.now()) / 1000));
}

function updateQrBody() {
  const box = document.getElementById('at-qr-body');
  if (box) box.innerHTML = qrBodyHtml();
  const seconds = document.getElementById('at-seconds');
  if (seconds) {
    seconds.textContent = state.secondsLeft + 's';
    seconds.classList.toggle('urgent', state.secondsLeft <= 5);
  }
  const btn = document.getElementById('at-refresh-btn');
  if (btn) btn.textContent = state.refreshing ? '刷新中…' : '立即刷新二维码';
}

function updateAtStatsNodes() {
  const s = state.stats;
  if (!s) return;
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set('at-expected', s.expectedCount);
  set('at-checked', s.checkedCount);
  set('at-absent', s.absentCount);
  set('at-rate', state.atRateText);
  set('at-record-count', `共 ${s.checkedCount} 人`);
  const badge = document.getElementById('at-status');
  if (badge) {
    badge.textContent = state.atStatusText;
    badge.className = 'badge badge-' + state.atStatusClass;
  }
  set('at-time', state.atTimeText);
  const list = document.getElementById('at-record-list');
  if (list) list.innerHTML = atRecordsHtml();
}

function refreshQr(silent) {
  state.refreshing = true;
  updateQrBody();
  request('GET', `/api/tasks/${state.atId}/qr`)
    .then(qr => {
      state.refreshing = false;
      applyQr(qr);
      updateQrBody();
    })
    .catch(err => {
      state.refreshing = false;
      if (err.code === 'TASK_ENDED') {
        stopAtTimer();
        state.qrError = '签到已结束，二维码不再刷新';
      } else {
        state.secondsLeft = 5;
        if (!silent) showMsg('刷新失败', errorText(err));
      }
      updateQrBody();
    });
}

function loadAtStats() {
  request('GET', `/api/tasks/${state.atId}/stats`)
    .then(stats => {
      applyAtStats(stats);
      updateAtStatsNodes();
    })
    .catch(() => {});
}

function atTimerTick() {
  state.secondsLeft = Math.max(0, state.secondsLeft - 1);
  const seconds = document.getElementById('at-seconds');
  if (seconds) {
    seconds.textContent = state.secondsLeft + 's';
    seconds.classList.toggle('urgent', state.secondsLeft <= 5);
  }
  if (state.secondsLeft <= 0 && !state.refreshing && !state.qrError) {
    refreshQr(true);
  }
  state.atTick += 1;
  if (state.atTick % 10 === 0) {
    loadAtStats();
  }
}

function startAtTimer() {
  stopAtTimer();
  state.atTick = 0;
  state.atTimer = setInterval(atTimerTick, 1000);
}

function stopAtTimer() {
  if (state.atTimer) {
    clearInterval(state.atTimer);
    state.atTimer = null;
  }
}

/* ---------------- 下拉刷新（记录页） ---------------- */

function setupPullRefresh() {
  const scroller = document.getElementById('main-scroll');
  const indicator = document.getElementById('pull-indicator');
  let startY = 0;
  let pulling = false;

  scroller.addEventListener(
    'touchstart',
    e => {
      if (state.tab !== 'records') return;
      if (scroller.scrollTop <= 0) {
        startY = e.touches[0].clientY;
        pulling = true;
      } else {
        pulling = false;
      }
    },
    { passive: true }
  );

  scroller.addEventListener(
    'touchmove',
    e => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0 && scroller.scrollTop <= 0) {
        indicator.textContent = dy > 60 ? '松开立即刷新' : '下拉刷新';
        indicator.classList.add('show');
      }
    },
    { passive: true }
  );

  scroller.addEventListener(
    'touchend',
    e => {
      if (!pulling) return;
      pulling = false;
      indicator.classList.remove('show');
      const dy = e.changedTouches[0].clientY - startY;
      if (dy > 60) loadRecords(true);
    },
    { passive: true }
  );
}

/* ---------------- 事件绑定 ---------------- */

const ACTIONS = {
  'login-api-save': () => saveLoginApi(),
  'login-identity': el => doLogin(el.dataset.code),
  tab: el => switchTab(el.dataset.tab),
  'home-filter': el => {
    state.filter = el.dataset.filter;
    renderHome();
  },
  'home-retry': () => loadHome(),
  'scan-open': el => openScanModal(el.dataset.context),
  'scan-native': () => onNativeScan(),
  'scan-manual': () => onManualSubmit(),
  'modal-close': () => closeScanModal(),
  'msg-close': () => closeMsg(),
  'open-task': el => openTask(Number(el.dataset.id)),
  'task-back': () => closeTask(),
  'task-retry': () => loadTask(),
  'task-scan': () => onTaskScan(),
  'task-admin': () => openAdminTask(state.taskId, 'task'),
  'records-refresh': () => loadRecords(true),
  'records-more': () => loadRecords(false),
  'records-retry': () => loadRecords(true),
  'mine-retry': () => loadMine(),
  'mine-api-save': () => saveMineApi(),
  'mine-switch': el => switchIdentity(el.dataset.code),
  'mine-logout': () => logout(),
  'mine-admin': () => openAdmin(),
  'admin-back': () => closeAdmin(),
  'admin-toggle-form': () => toggleAdminForm(),
  'admin-submit': () => submitAdminForm(),
  'admin-retry': () => loadAdmin(),
  'admin-open-task': el => openAdminTask(Number(el.dataset.id), 'admin'),
  'at-back': () => closeAdminTask(),
  'at-refresh-qr': () => refreshQr(false),
  'at-retry': () => loadAdminTask()
};

function bindEvents() {
  document.getElementById('app').addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = ACTIONS[el.dataset.action];
    if (fn) {
      e.preventDefault();
      fn(el, e);
    }
  });
  document.getElementById('view-admin').addEventListener('input', onAdminInput);
  document.getElementById('scan-token-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onManualSubmit();
    }
  });
  setupPullRefresh();
}

/* ---------------- 启动 ---------------- */

function init() {
  renderLoginIdentities();
  bindEvents();
  if (getToken() && getCachedUser()) {
    state.user = getCachedUser();
    showView('main');
    switchTab('home');
  } else {
    showLogin();
  }
}

init();
