// H5 端配置：后端服务地址与开发调试身份
// 默认指向开发机局域网 IP，可在「我的」页（或登录页）修改，保存在 localStorage。
var CONFIG = {
  // 后端服务地址（可被 localStorage 中的 checkin_api_base 覆盖）
  API_BASE: 'http://192.168.1.9:8080',
  API_BASE_KEY: 'checkin_api_base',
  TOKEN_KEY: 'checkin_token',
  USER_KEY: 'checkin_user',
  // 签到记录分页大小（page 从 1 开始）
  PAGE_SIZE: 20,
  // 开发模式可选身份（与后端 dev-mode 保持一致）
  DEV_IDENTITIES: [
    { code: 'dev-admin', label: '管理员 · 蓝老师' },
    { code: 'dev-user', label: '用户 · 蓝功凯' },
    { code: 'dev-user-2', label: '用户 · 张同学' },
    { code: 'dev-user-3', label: '用户 · 李同学' }
  ]
};
