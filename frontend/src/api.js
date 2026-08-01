// API 客户端封装
// 后端地址优先级：localStorage.pds_api_base > VITE_API_BASE > 同源 /api
const getBase = () => {
  const saved = localStorage.getItem("pds_api_base")
  if (saved) return saved.replace(/\/$/, "")
  return import.meta.env.VITE_API_BASE || "/api"
}

let _base = getBase()
let _token = null

// 动态更新 base（设置新地址后调用）
export const setApiBase = (url) => {
  if (url) {
    localStorage.setItem("pds_api_base", url.replace(/\/$/, ""))
  } else {
    localStorage.removeItem("pds_api_base")
  }
  _base = getBase()
}

export const getApiBase = () => _base

async function request(path, options = {}) {
  const opts = {
    headers: { "Content-Type": "application/json" },
    credentials: "include", // 发送 httpOnly Cookie
    ...options,
  }
  // 自动附加 token（兼容不支持 Cookie 的场景）
  if (_token) {
    opts.headers["Authorization"] = `Bearer ${_token}`
  }
  if (opts.body && typeof opts.body !== "string") {
    opts.body = JSON.stringify(opts.body)
  }
  // 请求超时保护（30秒）
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)
  opts.signal = controller.signal
  try {
    const res = await fetch(`${_base}${path}`, opts)
    if (!res.ok) {
      let msg = `HTTP ${res.status}`
      try { const j = await res.json(); msg = j.detail || j.message || msg } catch { /* ignore */ }
      throw new Error(msg)
    }
    const ct = res.headers.get("content-type") || ""
    return ct.includes("application/json") ? res.json() : res.text()
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("请求超时，请检查网络或稍后重试")
    }
    // Failed to fetch 时给出更友好的提示
    if (err.message === "Failed to fetch") {
      throw new Error(`无法连接后端 (${_base})，请检查后端地址是否正确`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

export const api = {
  // === 认证 ===
  setToken: (token) => { _token = token },
  // 用户名密码
  login: (username, password) =>
    request("/auth/login", { method: "POST", body: { username, password } }),
  register: (username, password) =>
    request("/auth/register", { method: "POST", body: { username, password } }),
  // 邮箱验证码
  sendEmailCode: (email) =>
    request("/auth/send-email-code", { method: "POST", body: { email } }),
  loginEmail: (email, code) =>
    request("/auth/login-email", { method: "POST", body: { email, code } }),
  registerEmail: (email, code, password) =>
    request("/auth/register-email", { method: "POST", body: { email, code, password } }),
  // 手机号验证码
  sendSmsCode: (phone) =>
    request("/auth/send-sms-code", { method: "POST", body: { phone } }),
  loginPhone: (phone, code) =>
    request("/auth/login-phone", { method: "POST", body: { phone, code } }),
  registerPhone: (phone, code, password) =>
    request("/auth/register-phone", { method: "POST", body: { phone, code, password } }),
  me: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),
  loginRecords: (page = 1, pageSize = 50) =>
    request(`/auth/login-records?page=${page}&page_size=${pageSize}`),
  loginStats: () => request("/auth/login-stats"),
  // === dashboard ===
  stats: () => request("/dashboard/stats"),
  // === sourcing ===
  search: (body) => request("/sourcing/search", { method: "POST", body }),
  importOffer: (offer) => request("/sourcing/import", { method: "POST", body: { offer } }),
  batchImport: (offers) => request("/sourcing/import/batch", { method: "POST", body: { offers } }),
  refresh: (id) => request(`/sourcing/refresh/${id}`, { method: "POST" }),
  // === products ===
  products: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/products${q ? "?" + q : ""}`)
  },
  product: (id) => request(`/products/${id}`),
  updateProduct: (id, body) => request(`/products/${id}`, { method: "PATCH", body }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),
  mapProduct: (id, body) => request(`/products/${id}/map`, { method: "POST", body }),
  mapBatch: (body) => request("/products/map/batch", { method: "POST", body }),
  productStats: () => request("/products/stats/summary"),
  // === tasks ===
  tasks: () => request("/tasks"),
  task: (id) => request(`/tasks/${id}`),
  createTask: (body) => request("/tasks", { method: "POST", body }),
  updateTask: (id, body) => request(`/tasks/${id}`, { method: "PATCH", body }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: "DELETE" }),
  runTask: (id) => request(`/tasks/${id}/run`, { method: "POST" }),
  taskRecords: (id, params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/tasks/${id}/records${q ? "?" + q : ""}`)
  },
  taskLogs: (id) => request(`/tasks/${id}/logs`),
  // === settings ===
  settings: () => request("/settings"),
  setSettings: (items, category) => request("/settings", { method: "PUT", body: { items, category } }),
  testConnection: (platform) => request(`/settings/test/${platform}`),
}
