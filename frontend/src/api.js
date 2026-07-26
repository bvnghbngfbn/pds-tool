// API 客户端封装
const BASE = '/api'

async function request(path, options = {}) {
  const opts = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  }
  if (opts.body && typeof opts.body !== 'string') {
    opts.body = JSON.stringify(opts.body)
  }
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { const j = await res.json(); msg = j.detail || j.message || msg } catch { /* ignore */ }
    throw new Error(msg)
  }
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res.text()
}

export const api = {
  // dashboard
  stats: () => request('/dashboard/stats'),

  // sourcing
  search: (body) => request('/sourcing/search', { method: 'POST', body }),
  importOffer: (offer) => request('/sourcing/import', { method: 'POST', body: { offer } }),
  batchImport: (offers) => request('/sourcing/import/batch', { method: 'POST', body: { offers } }),
  refresh: (id) => request(`/sourcing/refresh/${id}`, { method: 'POST' }),

  // products
  products: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/products${q ? '?' + q : ''}`)
  },
  product: (id) => request(`/products/${id}`),
  updateProduct: (id, body) => request(`/products/${id}`, { method: 'PATCH', body }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  mapProduct: (id, body) => request(`/products/${id}/map`, { method: 'POST', body }),
  mapBatch: (body) => request('/products/map/batch', { method: 'POST', body }),
  productStats: () => request('/products/stats/summary'),

  // tasks
  tasks: () => request('/tasks'),
  task: (id) => request(`/tasks/${id}`),
  createTask: (body) => request('/tasks', { method: 'POST', body }),
  updateTask: (id, body) => request(`/tasks/${id}`, { method: 'PATCH', body }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  runTask: (id) => request(`/tasks/${id}/run`, { method: 'POST' }),
  taskRecords: (id, params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/tasks/${id}/records${q ? '?' + q : ''}`)
  },
  taskLogs: (id) => request(`/tasks/${id}/logs`),

  // settings
  settings: () => request('/settings'),
  setSettings: (items, category) => request('/settings', { method: 'PUT', body: { items, category } }),
  testConnection: (platform) => request(`/settings/test/${platform}`),
}
