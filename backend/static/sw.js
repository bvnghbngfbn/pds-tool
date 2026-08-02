// 电商铺货工具 PWA Service Worker
const CACHE_NAME = 'pds-v20260802-platform-sdk'
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, '')
const ASSETS = [
  `${SCOPE_PATH}/`,
  `${SCOPE_PATH}/index.html`,
  `${SCOPE_PATH}/manifest.json`,
  `${SCOPE_PATH}/icons/icon-192.png`,
  `${SCOPE_PATH}/icons/icon-512.png`,
  `${SCOPE_PATH}/icons/icon.svg`,
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// 缓存策略：
// - 静态资源：缓存优先
// - API 请求：网络优先（不缓存，保证数据实时）
// - 导航请求：网络优先，失败回退到缓存的 index.html
self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  // 只缓存同源请求
  if (url.origin !== self.location.origin) return
  // 不缓存 API
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    // 导航请求：网络优先
    e.respondWith(
      fetch(request).catch(() => caches.match(`${SCOPE_PATH}/index.html`))
    )
    return
  }

  // 静态资源：缓存优先，失败再网络
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((resp) => {
        // 只缓存 GET 且成功的响应
        if (request.method === 'GET' && resp.ok && resp.type === 'basic') {
          const clone = resp.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {})
        }
        return resp
      }).catch(() => cached)
    })
  )
})
