import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts'
import { Package, Zap, CheckCircle2, TrendingUp, AlertCircle, Plus, ArrowRight } from 'lucide-react'
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

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.stats().then(setData).finally(() => setLoading(false))
    const t = setInterval(() => api.stats().then(setData), 15000)
    return () => clearInterval(t)
  }, [])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">加载中…</div>
      </div>
    )
  }

  const statusData = Object.entries(data.products_by_status).map(([k, v]) => ({
    name: STATUS_LABEL[k] || k, value: v, key: k,
  }))
  const trendData = data.trend.map((t) => ({ ...t, date: t.date.slice(5) }))

  const cards = [
    { label: '商品总数', value: data.product_total, icon: Package, color: 'text-brand-500', bg: 'bg-brand-50' },
    { label: '已铺货', value: data.push_success, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: '成功率', value: `${data.success_rate}%`, icon: TrendingUp, color: 'text-violet-500', bg: 'bg-violet-50' },
    { label: '铺货失败', value: data.push_failed, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
  ]

  return (
    <div className="space-y-5">
      {/* 欢迎区 */}
      <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl p-5 text-white">
        <div className="text-sm opacity-80">铺货通 · 1688 自动铺货</div>
        <div className="text-xl font-bold mt-1">一键铺货，轻松运营</div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => navigate('/sourcing')}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            去选品
          </button>
          <button
            onClick={() => navigate('/tasks')}
            className="flex items-center gap-1.5 bg-white text-brand-700 hover:bg-white/90 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Zap className="w-4 h-4" />
            立即铺货
          </button>
        </div>
      </div>

      {/* 指标卡 - 2x2 网格 */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center`}>
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div className="text-xs text-gray-500">{c.label}</div>
            </div>
            <div className="text-2xl font-bold text-gray-800 mt-2">{c.value}</div>
          </div>
        ))}
      </div>

      {/* 近 7 天趋势 */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="font-semibold text-gray-800 text-sm mb-3">近 7 天铺货趋势</div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3470f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3470f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #eee', fontSize: 12 }} />
            <Area type="monotone" dataKey="count" stroke="#3470f6" strokeWidth={2} fill="url(#g)" name="铺货成功" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 商品状态分布 */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="font-semibold text-gray-800 text-sm mb-3">商品状态分布</div>
        {statusData.length === 0 || statusData.every(s => s.value === 0) ? (
          <div className="h-36 flex flex-col items-center justify-center text-gray-400 text-sm">
            <Package className="w-10 h-10 mb-2 opacity-30" />
            暂无商品，去 1688 选品导入吧
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData.filter(s => s.value > 0)} layout="vertical" margin={{ left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} width={60} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #eee', fontSize: 12 }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {statusData.filter(s => s.value > 0).map((s) => (
                  <Cell key={s.key} fill={STATUS_COLORS[s.key] || '#3470f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 快捷入口 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div
          onClick={() => navigate('/products')}
          className="flex items-center justify-between p-4 border-b border-gray-50 active:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="font-medium text-gray-800 text-sm">商品库</div>
              <div className="text-xs text-gray-400">管理所有采集的商品</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300" />
        </div>
        <div
          onClick={() => navigate('/tasks')}
          className="flex items-center justify-between p-4 border-b border-gray-50 active:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="font-medium text-gray-800 text-sm">铺货任务</div>
              <div className="text-xs text-gray-400">创建并管理铺货任务</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300" />
        </div>
        <div
          onClick={() => navigate('/settings')}
          className="flex items-center justify-between p-4 active:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <div className="font-medium text-gray-800 text-sm">平台设置</div>
              <div className="text-xs text-gray-400">配置 1688 与目标平台</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300" />
        </div>
      </div>
    </div>
  )
}
