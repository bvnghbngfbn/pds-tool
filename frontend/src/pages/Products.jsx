import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Trash2, Wand2, Loader2, Search, X } from 'lucide-react'
import { api } from '../api'

const STATUS_LABEL = {
  sourced: '已采集', mapped: '已映射', pending: '待铺货',
  pushed: '已铺货', failed: '失败', archived: '已归档',
}
const STATUS_STYLE = {
  sourced: 'bg-blue-50 text-blue-600', mapped: 'bg-violet-50 text-violet-600',
  pending: 'bg-amber-50 text-amber-600', pushed: 'bg-emerald-50 text-emerald-600',
  failed: 'bg-red-50 text-red-600', archived: 'bg-gray-100 text-gray-500',
}

export default function Products() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ status: '', keyword: '', category: '' })
  const [selected, setSelected] = useState(new Set())
  const [markup, setMarkup] = useState(1.3)
  const [mapping, setMapping] = useState(false)
  const [detail, setDetail] = useState(null)
  const pageSize = 12

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, page_size: pageSize }
      if (filter.status) params.status = filter.status
      if (filter.keyword) params.keyword = filter.keyword
      if (filter.category) params.category = filter.category
      const data = await api.products(params)
      setItems(data.items)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => { load() }, [load])

  function toggle(id) {
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  async function mapBatch() {
    if (selected.size === 0) return
    setMapping(true)
    try {
      await api.mapBatch({ product_ids: [...selected], markup_ratio: markup })
      setSelected(new Set())
      load()
    } finally {
      setMapping(false)
    }
  }

  async function mapOne(id) {
    setMapping(true)
    try {
      await api.mapProduct(id, { markup_ratio: markup })
      load()
    } finally {
      setMapping(false)
    }
  }

  async function remove(id) {
    if (!confirm('确认删除该商品？')) return
    await api.deleteProduct(id)
    load()
  }

  async function refresh(id) {
    await api.refresh(id)
    load()
  }

  const totalPages = Math.ceil(total / pageSize) || 1

  return (
    <div className="space-y-4 p-4">
      {/* 顶部操作区 */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">共 {total} 个商品</p>
        <div className="flex items-center gap-2">
          <input type="number" step="0.1"
            className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            value={markup}
            onChange={(e) => setMarkup(parseFloat(e.target.value) || 1.3)} />
          <button
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={mapBatch} disabled={mapping || selected.size === 0}>
            {mapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            映射 ({selected.size})
          </button>
        </div>
      </div>

      {/* 筛选 */}
      <div className="bg-white rounded-xl shadow-sm p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            placeholder="搜索标题…"
            value={filter.keyword} onChange={(e) => setFilter({ ...filter, keyword: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())} />
        </div>
        <div className="flex gap-2">
          <select
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            value={filter.status} onChange={(e) => { setFilter({ ...filter, status: e.target.value }); setPage(1) }}>
            <option value="">全部状态</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            placeholder="类目" value={filter.category}
            onChange={(e) => setFilter({ ...filter, category: e.target.value })} />
          <button
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            onClick={() => { setFilter({ status: '', keyword: '', category: '' }); setPage(1) }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 列表 - 卡片式 */}
      {loading ? (
        <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm py-16 text-center text-gray-400 text-sm">
          暂无商品，去「1688 选品」导入吧
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm p-3">
              <div className="flex gap-3">
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                  className="mt-1 shrink-0" />
                <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  {p.image_urls?.[0] && <img src={p.image_urls[0]} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <button className="text-sm text-gray-800 hover:text-brand-600 line-clamp-2 text-left leading-snug"
                    onClick={() => setDetail(p)}>
                    {p.title}
                  </button>
                  <div className="text-xs text-gray-400 mt-0.5">{p.source_seller} · {p.category_source}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pl-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">¥{p.price}</span>
                  <span className="text-xs text-gray-300">→</span>
                  <span className="text-sm font-medium text-brand-600">
                    ¥{(p.price * (p.markup_ratio || markup)).toFixed(2)}
                  </span>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[p.status] || ''}`}>
                  {STATUS_LABEL[p.status] || p.status}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-gray-50">
                <button title="转换映射"
                  className="p-1.5 hover:bg-brand-50 text-brand-600 rounded-lg"
                  onClick={() => mapOne(p.id)}>
                  <Wand2 className="w-4 h-4" />
                </button>
                <button title="刷新"
                  className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg"
                  onClick={() => refresh(p.id)}>
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button title="删除"
                  className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg"
                  onClick={() => remove(p.id)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-center gap-2">
          <button
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
        </div>
      )}

      {/* 详情抽屉 */}
      {detail && <DetailDrawer product={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function DetailDrawer({ product, onClose }) {
  const [full, setFull] = useState(null)
  useEffect(() => {
    api.product(product.id).then(setFull)
  }, [product.id])
  return (
    <div className="fixed inset-0 bg-black/30 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-gray-800 text-sm">商品详情</span>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          {full?.image_urls?.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {full.image_urls.slice(0, 6).map((u, i) => (
                <img key={i} src={u} alt="" className="w-full aspect-square object-cover rounded-lg" />
              ))}
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">标题</div>
            <div className="text-sm text-gray-800">{full?.title}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs font-medium text-gray-500 mb-1">源价</div><span className="text-gray-800">¥{full?.price}</span></div>
            <div><div className="text-xs font-medium text-gray-500 mb-1">库存</div><span className="text-gray-800">{full?.stock}</span></div>
            <div><div className="text-xs font-medium text-gray-500 mb-1">加价倍率</div><span className="text-gray-800">{full?.markup_ratio}</span></div>
            <div><div className="text-xs font-medium text-gray-500 mb-1">目标类目</div><span className="text-gray-800">{full?.category_target || '-'}</span></div>
          </div>
          {full?.mapped_data && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">转换后描述（预览）</div>
              <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                {full.mapped_data.body_html?.replace(/<[^>]*>/g, '').slice(0, 500) || '暂无描述'}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">源链接</div>
            <a href={full?.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline break-all">
              {full?.source_url}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
