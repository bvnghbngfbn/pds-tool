import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import {
  LayoutDashboard, Search, Package, Zap, Settings, ShoppingCart, Shield, LogOut,
} from 'lucide-react'
import { useAuth } from './contexts/AuthContext.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Sourcing from './pages/Sourcing.jsx'
import Products from './pages/Products.jsx'
import Tasks from './pages/Tasks.jsx'
import SettingsPage from './pages/Settings.jsx'
import Login from './pages/Login.jsx'
import LoginRecords from './pages/LoginRecords.jsx'

const tabs = [
  { to: '/', label: '首页', icon: LayoutDashboard, end: true },
  { to: '/sourcing', label: '选品', icon: Search },
  { to: '/products', label: '商品', icon: Package },
  { to: '/tasks', label: '铺货', icon: Zap },
  { to: '/settings', label: '设置', icon: Settings },
]

// 路由守卫组件
function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const location = useLocation()
  const { user, loading, logout } = useAuth()

  // 认证加载中 → 全屏 loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-200 mb-4">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-400 text-sm">加载中...</p>
        </div>
      </div>
    )
  }

  // 未登录 → 显示登录页
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // 已登录用户不应该看到登录页
  if (location.pathname === '/login') {
    return <Navigate to="/" replace />
  }

  // 获取当前页面标题
  const currentTab = tabs.find(t =>
    t.end ? location.pathname === t.to : location.pathname.startsWith(t.to)
  )
  const isLoginRecords = location.pathname === '/login-records'

  return (
    <div className="min-h-screen app-shell-bg">
      <div className="relative z-10 min-h-screen flex flex-col max-w-[760px] mx-auto px-3 sm:px-5">
      {/* 顶栏 */}
      <header className="sticky top-3 z-20 surface-panel rounded-3xl h-16 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-slate-900 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <ShoppingCart className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="block font-black tracking-tight text-slate-900 leading-none">
              {isLoginRecords ? '登录记录' : currentTab?.label || '电商铺货工具'}
            </span>
            <span className="text-[11px] text-slate-400">Multi-channel Listing Console</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {user.role === 'admin' && (
            <NavLink
              to="/login-records"
              className={`p-2 rounded-2xl transition-all ${
                isLoginRecords ? 'text-brand-600 bg-brand-50 shadow-inner' : 'text-slate-500 hover:bg-white/80 hover:text-slate-800'
              }`}
              title="登录记录"
            >
              <Shield className="w-5 h-5" strokeWidth={1.8} />
            </NavLink>
          )}
          <button
            onClick={logout}
            className="p-2 rounded-2xl text-slate-500 hover:bg-white/80 hover:text-slate-800 transition-all"
            title="退出登录"
          >
            <LogOut className="w-5 h-5" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 pb-24 overflow-y-auto">
        <div className="pt-5 pb-4">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/sourcing" element={<ProtectedRoute><Sourcing /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/login-records" element={<ProtectedRoute><LoginRecords /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      {/* 底部 Tab 导航 */}
      <nav className="fixed bottom-3 left-0 right-0 z-30 safe-area-bottom px-3">
        <div className="max-w-[720px] mx-auto h-16 surface-panel rounded-3xl flex items-center justify-around px-2">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-1 flex-1 h-12 rounded-2xl transition-all ${
                  isActive ? 'text-white bg-slate-950 shadow-xl shadow-slate-900/15' : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
                }`
              }
            >
              <t.icon className="w-5 h-5" strokeWidth={1.9} />
              <span className="text-[11px] font-medium">{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      </div>
    </div>
  )
}
