import { useEffect, useState } from 'react'
import { Save, Loader2, CheckCircle2, AlertCircle, Plug } from 'lucide-react'
import { api } from '../api'

export default function SettingsPage() {
  const [settings, setSettings] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [test, setTest] = useState({})

  useEffect(() => { api.settings().then(setSettings) }, [])

  function update(category, key, value) {
    setSettings((s) => ({ ...s, [category]: { ...(s[category] || {}), [key]: value } }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    try {
      await Promise.all(
        Object.entries(settings).map(([cat, items]) => api.setSettings(items, cat))
      )
      setSaved(true)
    } finally { setSaving(false) }
  }

  async function testConn(platform) {
    setTest((s) => ({ ...s, [platform]: { loading: true } }))
    try {
      const r = await api.testConnection(platform)
      setTest((s) => ({ ...s, [platform]: r }))
    } catch (e) {
      setTest((s) => ({ ...s, [platform]: { configured: false, message: e.message } }))
    }
  }

  const val = (cat, key) => settings[cat]?.[key] ?? ''

  return (
    <div className="space-y-4 p-4">
      {/* 顶部操作区 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">配置平台凭证，保存后即时生效</p>
        <button
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? '已保存' : '保存'}
        </button>
      </div>

      {/* 货源开放平台 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800 text-sm">货源开放平台（供货端口）</div>
          <button
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            onClick={() => testConn('alibaba')}>
            <Plug className="w-3.5 h-3.5" /> 测试
          </button>
        </div>
        <TestBadge result={test.alibaba} />
        <div className="space-y-3 mt-3">
          <Field label="App Key" value={val('alibaba', 'alibaba_app_key')}
            onChange={(v) => update('alibaba', 'alibaba_app_key', v)} />
          <Field label="App Secret" type="password" value={val('alibaba', 'alibaba_app_secret')}
            onChange={(v) => update('alibaba', 'alibaba_app_secret', v)} />
          <Field label="Access Token" type="password" value={val('alibaba', 'alibaba_access_token')}
            onChange={(v) => update('alibaba', 'alibaba_access_token', v)} />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">允许页面解析兜底</label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              value={val('alibaba', 'alibaba_allow_parse_fallback')}
              onChange={(e) => update('alibaba', 'alibaba_allow_parse_fallback', e.target.value)}>
              <option value="true">开启（无凭证时用页面解析）</option>
              <option value="false">关闭</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          申请入口：open.1688.com → 创建应用 → 获取 App Key/Secret，并授权获取 Access Token。
          沙箱可用页面解析兜底采集。
        </p>
      </div>

      {/* 拼多多 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800 text-sm">拼多多（铺货目标）</div>
          <button
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            onClick={() => testConn('pdd')}>
            <Plug className="w-3.5 h-3.5" /> 测试
          </button>
        </div>
        <TestBadge result={test.pdd} />
        <div className="space-y-3 mt-3">
          <Field label="Client ID" value={val('pdd', 'pdd_client_id')}
            onChange={(v) => update('pdd', 'pdd_client_id', v)} />
          <Field label="Client Secret" type="password" value={val('pdd', 'pdd_client_secret')}
            onChange={(v) => update('pdd', 'pdd_client_secret', v)} />
          <Field label="Access Token" type="password" value={val('pdd', 'pdd_access_token')}
            onChange={(v) => update('pdd', 'pdd_access_token', v)} />
          <Field label="Mall ID" value={val('pdd', 'pdd_mall_id')}
            onChange={(v) => update('pdd', 'pdd_mall_id', v)} />
          <Field label="叶子类目 ID" value={val('pdd', 'pdd_category_id')}
            onChange={(v) => update('pdd', 'pdd_category_id', v)} />
          <Field label="运费模板 ID" value={val('pdd', 'pdd_logistics_template_id')}
            onChange={(v) => update('pdd', 'pdd_logistics_template_id', v)} />
          <Field label="API 地址" placeholder="https://gw-api.pinduoduo.com/api/router" value={val('pdd', 'pdd_api_url')}
            onChange={(v) => update('pdd', 'pdd_api_url', v)} />
        </div>
        <p className="text-xs text-gray-400 mt-3">
          拼多多发布商品需先获取店铺可发布叶子类目、平台图片、类目规则和运费模板；当前调用 pdd.goods.add。
        </p>
      </div>

      {/* 抖音商店 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800 text-sm">抖音商店（铺货目标）</div>
          <button
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            onClick={() => testConn('douyin')}>
            <Plug className="w-3.5 h-3.5" /> 测试
          </button>
        </div>
        <TestBadge result={test.douyin} />
        <div className="space-y-3 mt-3">
          <Field label="App Key" value={val('douyin', 'douyin_app_key')}
            onChange={(v) => update('douyin', 'douyin_app_key', v)} />
          <Field label="App Secret" type="password" value={val('douyin', 'douyin_app_secret')}
            onChange={(v) => update('douyin', 'douyin_app_secret', v)} />
          <Field label="Access Token" type="password" value={val('douyin', 'douyin_access_token')}
            onChange={(v) => update('douyin', 'douyin_access_token', v)} />
          <Field label="Shop ID" value={val('douyin', 'douyin_shop_id')}
            onChange={(v) => update('douyin', 'douyin_shop_id', v)} />
          <Field label="类目 ID" value={val('douyin', 'douyin_category_id')}
            onChange={(v) => update('douyin', 'douyin_category_id', v)} />
          <Field label="运费模板 ID" value={val('douyin', 'douyin_freight_id')}
            onChange={(v) => update('douyin', 'douyin_freight_id', v)} />
          <Field label="接口 Method" placeholder="product.addV2" value={val('douyin', 'douyin_method')}
            onChange={(v) => update('douyin', 'douyin_method', v)} />
          <Field label="API 地址" placeholder="https://openapi-fxg.jinritemai.com" value={val('douyin', 'douyin_api_url')}
            onChange={(v) => update('douyin', 'douyin_api_url', v)} />
        </div>
        <p className="text-xs text-gray-400 mt-3">
          抖店接口使用公共参数签名，默认 method 为 product.addV2；如使用即时零售，可按开放平台文档切换 method。
        </p>
      </div>

      {/* 快手小店 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800 text-sm">快手小店（铺货目标）</div>
          <button
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            onClick={() => testConn('kuaishou')}>
            <Plug className="w-3.5 h-3.5" /> 测试
          </button>
        </div>
        <TestBadge result={test.kuaishou} />
        <div className="space-y-3 mt-3">
          <Field label="App ID" value={val('kuaishou', 'kuaishou_app_id')}
            onChange={(v) => update('kuaishou', 'kuaishou_app_id', v)} />
          <Field label="App Secret" type="password" value={val('kuaishou', 'kuaishou_app_secret')}
            onChange={(v) => update('kuaishou', 'kuaishou_app_secret', v)} />
          <Field label="Sign Secret" type="password" value={val('kuaishou', 'kuaishou_sign_secret')}
            onChange={(v) => update('kuaishou', 'kuaishou_sign_secret', v)} />
          <Field label="Access Token" type="password" value={val('kuaishou', 'kuaishou_access_token')}
            onChange={(v) => update('kuaishou', 'kuaishou_access_token', v)} />
          <Field label="Shop ID" value={val('kuaishou', 'kuaishou_shop_id')}
            onChange={(v) => update('kuaishou', 'kuaishou_shop_id', v)} />
          <Field label="类目 ID" value={val('kuaishou', 'kuaishou_category_id')}
            onChange={(v) => update('kuaishou', 'kuaishou_category_id', v)} />
          <Field label="运费模板 ID" value={val('kuaishou', 'kuaishou_express_template_id')}
            onChange={(v) => update('kuaishou', 'kuaishou_express_template_id', v)} />
          <Field label="接口 Method" placeholder="open.item.new" value={val('kuaishou', 'kuaishou_method')}
            onChange={(v) => update('kuaishou', 'kuaishou_method', v)} />
          <Field label="签名算法" placeholder="HMAC_SHA256" value={val('kuaishou', 'kuaishou_sign_method')}
            onChange={(v) => update('kuaishou', 'kuaishou_sign_method', v)} />
          <Field label="API 地址" placeholder="https://openapi.kwaixiaodian.com" value={val('kuaishou', 'kuaishou_api_url')}
            onChange={(v) => update('kuaishou', 'kuaishou_api_url', v)} />
        </div>
        <p className="text-xs text-gray-400 mt-3">
          快手 open.item.new 要求平台图片 URL、类目 ID、SKU、服务规则和运费模板；外网图片需先转为快手素材 URL。
        </p>
      </div>

      {/* Shopify */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800 text-sm">Shopify（铺货目标）</div>
          <button
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            onClick={() => testConn('shopify')}>
            <Plug className="w-3.5 h-3.5" /> 测试
          </button>
        </div>
        <TestBadge result={test.shopify} />
        <div className="space-y-3 mt-3">
          <Field label="店铺地址" placeholder="your-shop.myshopify.com" value={val('shopify', 'shopify_shop_url')}
            onChange={(v) => update('shopify', 'shopify_shop_url', v)} />
          <Field label="Access Token" type="password" value={val('shopify', 'shopify_access_token')}
            onChange={(v) => update('shopify', 'shopify_access_token', v)} />
          <Field label="Location ID（可选）" value={val('shopify', 'shopify_location_id')}
            onChange={(v) => update('shopify', 'shopify_location_id', v)} />
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Shopify 后台 → 设置 → 应用和销售渠道 → 开发应用 → 创建自定义应用 → 配置 products/inventory 权限 → 生成 Admin API Token。
        </p>
      </div>

      {/* Generic */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800 text-sm">通用 API（铺货目标）</div>
          <button
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            onClick={() => testConn('generic')}>
            <Plug className="w-3.5 h-3.5" /> 测试
          </button>
        </div>
        <TestBadge result={test.generic} />
        <div className="space-y-3 mt-3">
          <Field label="API URL" placeholder="https://your-store.com/api/products" value={val('generic', 'generic_api_url')}
            onChange={(v) => update('generic', 'generic_api_url', v)} />
          <Field label="API Key" type="password" value={val('generic', 'generic_api_key')}
            onChange={(v) => update('generic', 'generic_api_key', v)} />
        </div>
      </div>

      {/* CSV / 通用 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="font-semibold text-gray-800 text-sm mb-3">通用参数</div>
        <div className="space-y-3">
          <Field label="CSV 导出目录" value={val('csv', 'csv_export_dir')}
            onChange={(v) => update('csv', 'csv_export_dir', v)} />
          <Field label="默认加价倍率" value={val('general', 'default_markup_ratio')}
            onChange={(v) => update('general', 'default_markup_ratio', v)} />
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input type={type}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function TestBadge({ result }) {
  if (!result || result.loading) return null
  return (
    <div className={`flex items-center gap-2 text-xs ${result.configured ? 'text-emerald-600' : 'text-amber-600'}`}>
      {result.configured ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {result.message}
    </div>
  )
}
