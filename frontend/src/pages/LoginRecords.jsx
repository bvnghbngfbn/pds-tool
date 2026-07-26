import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { api } from '../api.js'
import { Shield, LogIn, LogOut, Users, Clock, Globe, Monitor, CheckCircle, XCircle } from 'lucide-react'

export default function LoginRecords() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const pageSize = 30

  useEffect(() => {
    loadData()
  }, [page])

  const loadData = async () => {
    setLoading(true)
    try {
      const [s, r] = await Promise.all([
        api.loginStats(),
        api.loginRecords(page, pageSize),
      ])
      setStats(s)
      setRecords(r.items || [])
      setTotal(r.total || 0)
    } catch (err) {
      console.error('加载登录数据失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  const formatTime = (iso) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }

  const truncateUA = (ua) => {
    if (!ua) return '-'
    // 提取浏览器和系统信息
    const match = ua.match(/\((.*?)\)/)
    if (match) return match[1].substring(0, 40)
    return ua.substring(0, 40)
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-brand-500" />
              <span className="text-xs text-gray-500">用户总数</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">{stats.total_users}</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <LogIn className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500">成功登录</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.success_logins}</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <LogOut className="w-4 h-4 text-red-500" />
              <span className="text-xs text-gray-500">失败登录</span>
            </div>
            <div className="text-2xl font-bold text-red-500">{stats.failed_logins}</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500">今日登录</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{stats.today_logins}</div>
          </div>
        </div>
      )}

      {/* 登录记录列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-brand-500" />
          <span className="font-medium text-gray-800 text-sm">登录记录</span>
          <span className="text-xs text-gray-400 ml-auto">共 {total} 条</span>
        </div>

        {records.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">暂无登录记录</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {records.map((r) => (
              <div key={r.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.success ? (
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{r.username}</span>
                        <span className="text-xs text-gray-500">{formatTime(r.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {r.ip_address}
                        </span>
                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                          <Monitor className="w-3 h-3 shrink-0" />
                          {truncateUA(r.user_agent)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    r.success ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {r.message || (r.success ? '成功' : '失败')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-gray-100">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 text-sm rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
            >
              上一页
            </button>
            <span className="text-sm text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 text-sm rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  )
}