import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts'
import {
  Package, Zap, CheckCircle2, TrendingUp, AlertCircle, Plus, ArrowRight,
  Sparkles, RadioTower, Store, Layers3, Wand2, ShieldCheck, Activity,
} from 'lucide-react'
import { api } from '../api'
import { useNavigate } from 'react-router-dom'

const STATUS_COLORS = {
  sourced: '#3470f6', mapped: '#8b5cf6', pending: '#f59e0b',
  pushed: '#10b981', failed: '#ef4444', archived: '#9ca3af',
}
const STATUS_LABEL = {
  sourced: '已采集', mapped: '已映射', pending: '待铺货',
  pushed: '已铺货', failed: '失败', archived: '已归档',
}

const PLATFORM_FLOW = [
  { key: 'pdd', label: '拼多多', tone: 'from-orange-400 to-red-500', meta: '低价爆品渠道' },
  { key: 'douyin', label: '抖音商店', tone: 'from-slate-900 to-pink-500', meta: '内容电商渠道' },
  { key: 'kuaishou', label: '快手小店', tone: 'from-amber-400 to-orange-600', meta: '直播分销渠道' },
  { key: 'csv', label: 'CSV 导出', tone: 'from-emerald-400 to-teal-600', meta: '批量模板备份' },
]

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activePlatform, setActivePlatform] = useState('douyin')
  const navigate = useNavigate()

  useEffect(() => {
    api.stats().then(setData).finally(() => setLoading(false))
    const t = setInterval(() => api.stats().then(setData), 15000)
    return () => clearInterval(t)
  }, [])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-72">
        <div className="lux-card rounded-3xl px-6 py-5 text-center animate-rise-in">
          <Sparkles className="w-6 h-6 text-brand-500 mx-auto mb-2 animate-pulse" />
          <div className="text-slate-500 text-sm">正在唤醒运营中枢…</div>
        </div>
      </div>
    )
  }

  const statusData = Object.entries(data.products_by_status).map(([k, v]) => ({
    name: STATUS_LABEL[k] || k, value: v, key: k,
  }))
  const trendData = data.trend.map((t) => ({ ...t, date: t.date.slice(5) }))

  const cards = [
    { label: '商品资产', value: data.product_total, hint: '当前商品池', icon: Package, color: 'text-brand-600', bg: 'bg-brand-50' },
    { label: '成功铺货', value: data.push_success, hint: '已完成发布', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '成功率', value: `${data.success_rate}%`, hint: '任务健康度', icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: '异常项', value: data.push_failed, hint: '需人工处理', icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
  ]
  const active = PLATFORM_FLOW.find((p) => p.key === activePlatform) || PLATFORM_FLOW[0]

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white p-5 sm:p-7 shadow-2xl shadow-slate-900/20 animate-rise-in">
        <div className="absolute -right-14 -top-16 w-52 h-52 rounded-full bg-brand-500/35 blur-3xl" />
        <div className="absolute -left-20 bottom-0 w-64 h-64 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-white/78">
              <span className="live-dot w-2 h-2 rounded-full bg-emerald-300" />
              自动铺货系统在线
            </div>
            <div className="rounded-2xl bg-white/10 p-2">
              <RadioTower className="w-5 h-5 text-emerald-200" />
            </div>
          </div>
          <div className="mt-6 max-w-xl">
            <p className="text-sm text-brand-100/80">电商铺货工具</p>
            <h1 className="mt-2 text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              从货源到多平台发布，一屏掌控。
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-300 leading-6">
              采集、映射、配置、铺货、追踪全部串起来，让每一次上架都有状态、有反馈、有记录。
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/sourcing')}
              className="inline-flex items-center gap-2 rounded-2xl bg-white text-slate-950 px-4 py-3 text-sm font-bold shadow-xl shadow-white/10 hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              导入货源
            </button>
            <button
              onClick={() => navigate('/tasks')}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 text-white px-4 py-3 text-sm font-bold shadow-xl shadow-brand-500/25 hover:bg-brand-400 hover:-translate-y-0.5 transition-all"
            >
              <Zap className="w-4 h-4" />
              一键铺货
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-rise-in delay-1">
        {cards.map((c, index) => (
          <div key={c.label} className="lux-card rounded-3xl p-4 transition-all" style={{ animationDelay: `${80 + index * 55}ms` }}>
            <div className="relative z-10">
              <div className={`w-11 h-11 rounded-2xl ${c.bg} flex items-center justify-center`}>
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div className="mt-4 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">{c.value}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">{c.label}</div>
              <div className="text-[11px] text-slate-400">{c.hint}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="lux-card rounded-[2rem] p-4 sm:p-5 animate-rise-in delay-2">
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs text-brand-600 font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                互动铺货路线
              </div>
              <h2 className="text-lg font-black text-slate-900 mt-1">选择目标平台，预览铺货策略</h2>
            </div>
            <button onClick={() => navigate('/settings')} className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-600">
              配置接口 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PLATFORM_FLOW.map((p) => (
              <button
                key={p.key}
                onClick={() => setActivePlatform(p.key)}
                className={`group rounded-2xl p-3 text-left border transition-all ${
                  activePlatform === p.key
                    ? 'border-slate-900 bg-slate-950 text-white shadow-xl shadow-slate-900/15'
                    : 'border-slate-100 bg-white/72 text-slate-700 hover:border-brand-200 hover:-translate-y-0.5'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${p.tone} mb-3 shadow-lg`} />
                <div className="text-sm font-black">{p.label}</div>
                <div className={`text-[11px] mt-0.5 ${activePlatform === p.key ? 'text-white/58' : 'text-slate-400'}`}>{p.meta}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-3xl bg-slate-50/90 p-4 border border-white">
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${active.tone} flex items-center justify-center shadow-lg`}>
                <Store className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-black text-slate-900">{active.label} 发布预案</div>
                <p className="text-xs text-slate-500 leading-5 mt-1">
                  系统会先完成标题清洗、价格加价、类目映射与图片检查，再调用目标平台配置的 API 端口生成铺货记录。
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['标题优化', '类目校验', '库存同步', '失败追踪'].map((tag) => (
                    <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500 shadow-sm">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lux-card rounded-[2rem] p-4 sm:p-5 animate-rise-in delay-3">
        <div className="relative z-10 flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-slate-400 font-bold">近 7 天</div>
            <div className="font-black text-slate-900">铺货趋势</div>
          </div>
          <Activity className="w-5 h-5 text-brand-500" />
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2054eb" stopOpacity={0.34} />
                <stop offset="95%" stopColor="#3470f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eef8" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
            <Tooltip contentStyle={{ borderRadius: 18, border: '1px solid #e8eef8', fontSize: 12, boxShadow: '0 20px 50px rgba(31,56,97,.14)' }} />
            <Area type="monotone" dataKey="count" stroke="#2054eb" strokeWidth={3} fill="url(#g)" name="铺货成功" />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="lux-card rounded-[2rem] p-4 sm:p-5 animate-rise-in delay-4">
        <div className="relative z-10 flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-slate-400 font-bold">商品流转</div>
            <div className="font-black text-slate-900">状态分布</div>
          </div>
          <Layers3 className="w-5 h-5 text-violet-500" />
        </div>
        {statusData.length === 0 || statusData.every(s => s.value === 0) ? (
          <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-sm rounded-3xl bg-slate-50/80">
            <Package className="w-10 h-10 mb-2 opacity-30" />
            暂无商品，去货源导入页添加商品吧
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData.filter(s => s.value > 0)} layout="vertical" margin={{ left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8eef8" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} width={60} />
              <Tooltip contentStyle={{ borderRadius: 18, border: '1px solid #e8eef8', fontSize: 12, boxShadow: '0 20px 50px rgba(31,56,97,.14)' }} />
              <Bar dataKey="value" radius={[0, 12, 12, 0]}>
                {statusData.filter(s => s.value > 0).map((s) => (
                  <Cell key={s.key} fill={STATUS_COLORS[s.key] || '#3470f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="grid sm:grid-cols-3 gap-3 animate-rise-in delay-4">
        {[
          { title: '货源清洗', desc: '清理营销噪音词，保留可发布标题', icon: Wand2, tone: 'bg-brand-50 text-brand-600' },
          { title: '类目映射', desc: '把 1688 类目转成目标平台类目', icon: Layers3, tone: 'bg-violet-50 text-violet-600' },
          { title: '发布风控', desc: '校验库存、价格、图片和失败记录', icon: ShieldCheck, tone: 'bg-emerald-50 text-emerald-600' },
        ].map((item) => (
          <button
            key={item.title}
            onClick={() => navigate('/products')}
            className="lux-card rounded-3xl p-4 text-left transition-all"
          >
            <div className={`w-10 h-10 rounded-2xl ${item.tone} flex items-center justify-center`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div className="mt-3 text-sm font-black text-slate-900">{item.title}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">{item.desc}</div>
          </button>
        ))}
      </section>

      <section className="lux-card rounded-[2rem] overflow-hidden animate-rise-in delay-4">
        <div
          onClick={() => navigate('/products')}
          className="interactive-row flex items-center justify-between p-4 border-b border-white/80 active:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="font-black text-slate-900 text-sm">商品库</div>
              <div className="text-xs text-slate-400">管理所有采集的商品</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300" />
        </div>
        <div
          onClick={() => navigate('/tasks')}
          className="interactive-row flex items-center justify-between p-4 border-b border-white/80 active:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="font-black text-slate-900 text-sm">铺货任务</div>
              <div className="text-xs text-slate-400">创建并管理铺货任务</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300" />
        </div>
        <div
          onClick={() => navigate('/settings')}
          className="interactive-row flex items-center justify-between p-4 active:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="font-black text-slate-900 text-sm">平台设置</div>
              <div className="text-xs text-slate-400">配置货源接口与目标平台</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300" />
        </div>
      </section>
    </div>
  )
}
