// GitHub Pages 部署版配置：后端地址由登录页填写（必须 https，否则会被浏览器拦截）
var CONFIG = {
  API_BASE: '',
  API_BASE_KEY: 'checkin_api_base',
  TOKEN_KEY: 'checkin_token',
  USER_KEY: 'checkin_user',
  PAGE_SIZE: 20,
  DEV_IDENTITIES: [
    { code: 'dev-admin', label: '管理员 · 蓝老师' },
    { code: 'dev-user', label: '用户 · 蓝功凯' },
    { code: 'dev-user-2', label: '用户 · 张同学' },
    { code: 'dev-user-3', label: '用户 · 李同学' }
  ]
};
