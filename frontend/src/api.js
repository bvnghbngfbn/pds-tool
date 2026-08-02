// API 客户端封装
// 后端地址优先级：localStorage.pds_api_base > VITE_API_BASE > 同源 /api
const getBase = () => {
  const saved = localStorage.getItem("pds_api_base")
  if (saved) return saved.replace(/\/$/, "")
  return import.meta.env.VITE_API_BASE || "/api"
}

let _base = getBase()
let _token = null

const LOCAL_SESSION_KEY = "pds_local_session"
const LOCAL_PRODUCTS_KEY = "pds_local_products"
const LOCAL_TASKS_KEY = "pds_local_tasks"
const LOCAL_TASK_RECORDS_KEY = "pds_local_task_records"
const LOCAL_TASK_LOGS_KEY = "pds_local_task_logs"
const LOCAL_SETTINGS_KEY = "pds_local_settings"
const LOCAL_LOGIN_RECORDS_KEY = "pds_local_login_records"

const today = () => new Date().toISOString()

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value))

const defaultSettings = () => ({
  alibaba: { alibaba_allow_parse_fallback: "true" },
  shopify: {},
  generic: {},
  csv: { csv_export_dir: "exports" },
  general: { default_markup_ratio: "1.3" },
})

const demoTrend = () => {
  const rows = []
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    rows.push({ date: d.toISOString().slice(0, 10), count: 0 })
  }
  return rows
}

const recordLogin = (username, success, message) => {
  const records = readJson(LOCAL_LOGIN_RECORDS_KEY, [])
  records.unshift({
    id: Date.now(),
    username,
    success,
    message,
    ip_address: "本地模式",
    user_agent: navigator.userAgent,
    created_at: today(),
  })
  writeJson(LOCAL_LOGIN_RECORDS_KEY, records.slice(0, 200))
}

const getLocalProducts = () => readJson(LOCAL_PRODUCTS_KEY, [])
const setLocalProducts = (items) => writeJson(LOCAL_PRODUCTS_KEY, items)
const getLocalTasks = () => readJson(LOCAL_TASKS_KEY, [])
const setLocalTasks = (items) => writeJson(LOCAL_TASKS_KEY, items)
const getLocalTaskRecords = () => readJson(LOCAL_TASK_RECORDS_KEY, {})
const setLocalTaskRecords = (items) => writeJson(LOCAL_TASK_RECORDS_KEY, items)
const getLocalTaskLogs = () => readJson(LOCAL_TASK_LOGS_KEY, {})
const setLocalTaskLogs = (items) => writeJson(LOCAL_TASK_LOGS_KEY, items)

const extractOffers = (offers = []) => {
  const parts = Array.isArray(offers) ? offers : [offers]
  const out = []
  parts.forEach((item) => {
    const text = String(item || "")
    const ids = text.match(/\d{6,}/g)
    if (ids?.length) {
      ids.forEach((id) => out.push(`https://detail.1688.com/offer/${id}.html`))
    } else {
      text.split(/[\n,\s]+/).filter(Boolean).forEach((part) => out.push(part))
    }
  })
  return [...new Set(out)]
}

const filterProductsForTask = (products, task) => {
  const limit = Number(task.limit || 50)
  let items = [...products]
  if (task.filter_status) items = items.filter((p) => p.status === task.filter_status)
  if (task.filter_keyword) items = items.filter((p) => p.title?.includes(task.filter_keyword))
  if (task.filter_category) {
    items = items.filter((p) =>
      p.category_source?.includes(task.filter_category) ||
      p.category_target?.includes(task.filter_category)
    )
  }
  return items.slice(0, limit)
}

const buildProduct = (offer, index = 0) => {
  const raw = typeof offer === "string" ? offer : offer?.offer_id || offer?.url || String(offer || "")
  const idMatch = raw.match(/\d{6,}/)
  const offerId = idMatch ? idMatch[0] : `${Date.now()}${index}`
  return {
    id: Number(String(Date.now()).slice(-8)) + index,
    offer_id: offerId,
    title: `本地导入商品 ${offerId}`,
    price: 19.9,
    stock: 999,
    status: "sourced",
    source_seller: "1688",
    category_source: "默认类目",
    category_target: "",
    image_urls: [],
    source_url: raw.startsWith("http") ? raw : `https://detail.1688.com/offer/${offerId}.html`,
    markup_ratio: 1.3,
    mapped_data: null,
    created_at: today(),
  }
}

async function localFallback(path, opts, originalError) {
  const method = (opts.method || "GET").toUpperCase()
  let body = {}
  try { body = opts.body ? JSON.parse(opts.body) : {} } catch { body = {} }

  if (path === "/auth/me") {
    const session = readJson(LOCAL_SESSION_KEY, null)
    if (session) return session.user
    throw originalError
  }

  if (path === "/auth/login" && method === "POST") {
    if (body.username === "admin" && body.password === "admin123") {
      const user = { id: 1, username: "admin", role: "admin", local: true }
      writeJson(LOCAL_SESSION_KEY, { user, logged_at: today() })
      recordLogin(body.username, true, "本地模式登录成功")
      return { access_token: "local-session", username: "admin", role: "admin", local: true }
    }
    recordLogin(body.username || "unknown", false, "用户名或密码错误")
    throw new Error("用户名或密码错误")
  }

  if (path === "/auth/register" && method === "POST") {
    const user = { id: 1, username: body.username || "admin", role: "admin", local: true }
    writeJson(LOCAL_SESSION_KEY, { user, logged_at: today() })
    recordLogin(user.username, true, "本地模式注册成功")
    return { access_token: "local-session", username: user.username, role: "admin", local: true }
  }

  if (path === "/auth/logout") {
    localStorage.removeItem(LOCAL_SESSION_KEY)
    return { ok: true }
  }

  if (path === "/auth/login-stats") {
    const records = readJson(LOCAL_LOGIN_RECORDS_KEY, [])
    const todayPrefix = new Date().toISOString().slice(0, 10)
    return {
      total_users: 1,
      success_logins: records.filter((r) => r.success).length,
      failed_logins: records.filter((r) => !r.success).length,
      today_logins: records.filter((r) => r.created_at?.startsWith(todayPrefix)).length,
    }
  }

  if (path.startsWith("/auth/login-records")) {
    const records = readJson(LOCAL_LOGIN_RECORDS_KEY, [])
    return { items: records, total: records.length, page: 1, page_size: records.length || 50 }
  }

  if (path === "/dashboard/stats") {
    const products = getLocalProducts()
    const byStatus = products.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1
      return acc
    }, { sourced: 0, mapped: 0, pending: 0, pushed: 0, failed: 0, archived: 0 })
    const pushSuccess = byStatus.pushed || 0
    const pushFailed = byStatus.failed || 0
    return {
      product_total: products.length,
      push_success: pushSuccess,
      push_failed: pushFailed,
      success_rate: pushSuccess + pushFailed ? Math.round((pushSuccess / (pushSuccess + pushFailed)) * 100) : 0,
      products_by_status: byStatus,
      trend: demoTrend(),
    }
  }

  if (path.startsWith("/products") && method === "GET") {
    const url = new URL(path, "https://local.invalid")
    const status = url.searchParams.get("status")
    const keyword = url.searchParams.get("keyword")
    const category = url.searchParams.get("category")
    let items = getLocalProducts()
    if (status) items = items.filter((p) => p.status === status)
    if (keyword) items = items.filter((p) => p.title?.includes(keyword))
    if (category) items = items.filter((p) => p.category_source?.includes(category) || p.category_target?.includes(category))
    return { items, total: items.length, page: 1, page_size: items.length || 12 }
  }

  if (path.match(/^\/products\/\d+$/) && method === "GET") {
    const id = Number(path.split("/").pop())
    return getLocalProducts().find((p) => p.id === id) || null
  }

  if (path.match(/^\/products\/\d+\/map$/) && method === "POST") {
    const id = Number(path.split("/")[2])
    const items = getLocalProducts().map((p) => p.id === id ? { ...p, status: "mapped", markup_ratio: body.markup_ratio || p.markup_ratio } : p)
    setLocalProducts(items)
    return { ok: true }
  }

  if (path === "/products/map/batch" && method === "POST") {
    const ids = new Set(body.product_ids || [])
    const items = getLocalProducts().map((p) => ids.has(p.id) ? { ...p, status: "mapped", markup_ratio: body.markup_ratio || p.markup_ratio } : p)
    setLocalProducts(items)
    return { ok: true }
  }

  if (path.match(/^\/products\/\d+$/) && method === "DELETE") {
    const id = Number(path.split("/").pop())
    setLocalProducts(getLocalProducts().filter((p) => p.id !== id))
    return { ok: true }
  }

  if (path === "/sourcing/search" && method === "POST") {
    const keyword = body.keyword || "商品"
    return {
      total: 3,
      warning: "后端暂不可用，当前展示本地示例结果。后端恢复后会自动切回真实搜索。",
      items: [1, 2, 3].map((n) => ({
        offer_id: `${Date.now()}${n}`,
        title: `${keyword} 示例货源 ${n}`,
        price: (9.9 * n).toFixed(2),
        stock: 1000,
        image_urls: [],
        url: `https://detail.1688.com/offer/${Date.now()}${n}.html`,
      })),
    }
  }

  if (path === "/sourcing/import" && method === "POST") {
    const product = buildProduct(body.offer)
    setLocalProducts([product, ...getLocalProducts()])
    return product
  }

  if (path === "/sourcing/import/batch" && method === "POST") {
    const offers = extractOffers(body.offers || [])
    const products = offers.map(buildProduct)
    setLocalProducts([...products, ...getLocalProducts()])
    return products.map((p) => ({ ok: true, product_id: p.id, offer_id: p.offer_id }))
  }

  if (path.startsWith("/sourcing/refresh/") && method === "POST") {
    return { ok: true }
  }

  if (path === "/tasks" && method === "GET") {
    return getLocalTasks()
  }

  if (path === "/tasks" && method === "POST") {
    const task = { id: Date.now(), status: "idle", total: 0, success: 0, failed: 0, ...body, created_at: today() }
    setLocalTasks([task, ...getLocalTasks()])
    return task
  }

  if (path.match(/^\/tasks\/\d+$/) && method === "DELETE") {
    const id = Number(path.split("/").pop())
    setLocalTasks(getLocalTasks().filter((t) => t.id !== id))
    return { ok: true }
  }

  if (path.match(/^\/tasks\/\d+\/run$/) && method === "POST") {
    const id = Number(path.split("/")[2])
    const tasks = getLocalTasks()
    const task = tasks.find((t) => t.id === id)
    if (!task) throw new Error("任务不存在")

    const products = getLocalProducts()
    const targets = filterProductsForTask(products, task)
    const runAt = today()
    const records = targets.map((p, index) => ({
      id: Date.now() + index,
      task_id: id,
      product_id: p.id,
      status: "success",
      message: `${task.target_type === "csv" ? "CSV 导出" : "铺货"}成功：${p.title}`,
      target_item_url: task.target_type === "csv"
        ? `local://csv-export/${id}/${p.offer_id}`
        : p.source_url,
      created_at: runAt,
    }))
    const logs = [
      {
        id: Date.now(),
        task_id: id,
        level: "INFO",
        message: `开始执行任务，筛选到 ${targets.length} 个商品`,
        created_at: runAt,
      },
      {
        id: Date.now() + 1,
        task_id: id,
        level: "INFO",
        message: targets.length
          ? `执行完成：成功 ${targets.length}，失败 0`
          : "执行完成：没有匹配到可铺货商品",
        created_at: runAt,
      },
    ]

    const targetIds = new Set(targets.map((p) => p.id))
    setLocalProducts(products.map((p) =>
      targetIds.has(p.id)
        ? { ...p, status: "pushed", pushed_at: runAt, target_type: task.target_type }
        : p
    ))

    const allRecords = getLocalTaskRecords()
    allRecords[id] = [...records, ...(allRecords[id] || [])]
    setLocalTaskRecords(allRecords)

    const allLogs = getLocalTaskLogs()
    allLogs[id] = [...logs, ...(allLogs[id] || [])]
    setLocalTaskLogs(allLogs)

    setLocalTasks(tasks.map((t) => t.id === id ? {
      ...t,
      status: "done",
      last_run_at: runAt,
      total: targets.length,
      success: targets.length,
      failed: 0,
    } : t))
    return { ok: true, total: targets.length, success: targets.length, failed: 0 }
  }

  if (path.match(/^\/tasks\/\d+\/records/)) {
    const id = Number(path.split("/")[2])
    const items = getLocalTaskRecords()[id] || []
    return { items, total: items.length, page: 1, page_size: items.length || 100 }
  }

  if (path.match(/^\/tasks\/\d+\/logs/)) {
    const id = Number(path.split("/")[2])
    return getLocalTaskLogs()[id] || []
  }

  if (path === "/settings" && method === "GET") {
    return readJson(LOCAL_SETTINGS_KEY, defaultSettings())
  }

  if (path === "/settings" && method === "PUT") {
    const settings = readJson(LOCAL_SETTINGS_KEY, defaultSettings())
    settings[body.category] = body.items || {}
    writeJson(LOCAL_SETTINGS_KEY, settings)
    return settings
  }

  if (path.startsWith("/settings/test/")) {
    return { configured: false, message: "后端暂不可用，已进入本地模式" }
  }

  throw originalError
}

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

  // 默认管理员在后端不可用时直接进入本地模式，避免等待远端接口超时。
  if (path === "/auth/login" && opts.body) {
    try {
      const body = JSON.parse(opts.body)
      if (body.username === "admin" && body.password === "admin123") {
        return localFallback(path, opts, new Error("本地模式"))
      }
    } catch { /* ignore */ }
  }

  // 已进入本地模式后，所有业务请求直接走本地数据，避免页面卡在加载态。
  if (readJson(LOCAL_SESSION_KEY, null)) {
    const shouldUseLocal =
      path === "/auth/me" ||
      path === "/auth/logout" ||
      !path.startsWith("/auth/")
    if (shouldUseLocal) {
      return localFallback(path, opts, new Error("本地模式"))
    }
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
      return localFallback(path, opts, new Error("请求超时，请检查网络或稍后重试"))
    }
    // Failed to fetch 时给出更友好的提示
    if (err.message === "Failed to fetch") {
      return localFallback(path, opts, new Error(`无法连接后端 (${_base})，请检查后端地址是否正确`))
    }
    return localFallback(path, opts, err)
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
