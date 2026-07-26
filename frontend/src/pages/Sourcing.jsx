import { useState } from 'react'
import { Search, Download, Loader2, ExternalLink, AlertTriangle } from 'lucide-react'
import { api } from '../api'

export default function Sourcing() {
  const [keyword, setKeyword] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [warning, setWarning] = useState('')
  const [importing, setImporting] = useState({})
  const [offerInput, setOfferInput] = useState('')
  const [importMsg, setImportMsg] = useState('')

  async function handleSearch(e) {
    e.preventDefault()
    setSearching(true)
    setWarning('')
    try {
      const data = await api.search({
        keyword, price_min: priceMin || undefined, price_max: priceMax || undefined,
      })
      setResults(data)
      setWarning(data.warning || '')
    } catch (err) {
      setWarning(err.message)
    } finally {
      setSearching(false)
    }
  }

  async function handleImport(offerId, title) {
    setImporting((s) => ({ ...s, [offerId]: true }))
    try {
      await api.importOffer(offerId)
      setImportMsg(`✓ 已导入「${title}」到商品库`)
      setTimeout(() => setImportMsg(''), 3000)
    } catch (err) {
      setImportMsg(`✗ 导入失败: ${err.message}`)
    } finally {
      setImporting((s) => ({ ...s, [offerId]: false }))
    }
  }

  async function handleBatchImport() {
    const offers = offerInput.split(/[\n,\s]+/).filter(Boolean)
    if (!offers.length) return
    setImporting({ batch: true })
    try {
      const data = await api.batchImport(offers)
      const ok = data.filter((d) => d.ok).length
      setImportMsg(`批量导入完成：成功 ${ok} / ${data.length}`)
      setTimeout(() => setImportMsg(''), 4000)
    } catch (err) {
      setImportMsg(`✗ 批量导入失败: ${err.message}`)
    } finally {
      setImporting({})
    }
  }

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-gray-500">搜索 1688 商品或直接导入 offer 链接 / ID</p>

      {warning && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{warning}</span>
        </div>
      )}

      {/* 搜索 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              placeholder="输入关键词搜索 1688 商品…"
              value={keyword} onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              placeholder="最低价" value={priceMin} onChange={(e) => setPriceMin(e.target.value)}
            />
            <input
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              placeholder="最高价" value={priceMax} onChange={(e) => setPriceMax(e.target.value)}
            />
            <button type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={searching}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              搜索
            </button>
          </div>
          <p className="text-xs text-gray-400">
            搜索需在「平台设置」配置 1688 开放平台 App Key / Secret。未配置时可用下方 offer 导入。
          </p>
        </form>
      </div>

      {/* 直接导入 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="font-semibold text-gray-800 mb-2 text-sm">按 offer 导入</div>
        <textarea
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent h-20 resize-none"
          placeholder="粘贴 1688 商品链接或 offerId，多个用换行/逗号分隔&#10;例: https://detail.1688.com/offer/123456789.html"
          value={offerInput} onChange={(e) => setOfferInput(e.target.value)}
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">无 API 凭证时自动降级为页面解析</span>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleBatchImport} disabled={!offerInput.trim() || importing.batch}>
            {importing.batch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            批量导入
          </button>
        </div>
      </div>

      {importMsg && (
        <div className="p-3 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 text-sm">{importMsg}</div>
      )}

      {/* 搜索结果 */}
      {results && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-gray-800 text-sm">搜索结果</div>
            <span className="text-xs text-gray-500">共 {results.total} 件</span>
          </div>
          {results.items.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">暂无结果</div>
          ) : (
            <div className="space-y-3">
              {results.items.map((it) => (
                <div key={it.offer_id} className="flex gap-3 bg-gray-50 rounded-xl overflow-hidden">
                  <div className="w-24 h-24 shrink-0 bg-white">
                    {it.image_urls[0] ? (
                      <img src={it.image_urls[0]} alt={it.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">无图</div>
                    )}
                  </div>
                  <div className="flex-1 py-2 pr-3 flex flex-col justify-between min-w-0">
                    <div className="text-sm text-gray-800 line-clamp-2 leading-snug">{it.title}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-brand-600 font-bold text-sm">¥{it.price}</span>
                      <span className="text-xs text-gray-400">库存 {it.stock}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleImport(it.offer_id, it.title)}
                        disabled={importing[it.offer_id]}
                      >
                        {importing[it.offer_id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        导入
                      </button>
                      <a href={it.url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
