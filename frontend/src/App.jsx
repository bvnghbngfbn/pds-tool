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
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-[640px] mx-auto">
      {/* 顶栏 */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-800">
            {isLoginRecords ? '登录记录' : currentTab?.label || '铺货通'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {user.role === 'admin' && (
            <NavLink
              to="/login-records"
              className={`p-2 rounded-lg transition-colors ${
                isLoginRecords ? 'text-brand-600 bg-brand-50' : 'text-gray-500 hover:bg-gray-100'
              }`}
              title="登录记录"
            >
              <Shield className="w-5 h-5" strokeWidth={1.8} />
            </NavLink>
          )}
          <button
            onClick={logout}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            title="退出登录"
          >
            <LogOut className="w-5 h-5" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 pb-20 overflow-y-auto">
        <div className="p-4">
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
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="max-w-[640px] mx-auto h-16 flex items-center justify-around px-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
                  isActive ? 'text-brand-600' : 'text-gray-500'
                }`
              }
            >
              <t.icon className="w-6 h-6" strokeWidth={1.8} />
              <span className="text-[11px] font-medium">{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}