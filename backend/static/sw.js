// 电商铺货工具 PWA Service Worker
const CACHE_NAME = 'pds-v1'
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon.svg',
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
      fetch(request).catch(() => caches.match('/index.html'))
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
