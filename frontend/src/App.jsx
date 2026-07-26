import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Search, Package, Zap, Settings, ShoppingCart,
} from 'lucide-react'
import Dashboard from './pages/Dashboard.jsx'
import Sourcing from './pages/Sourcing.jsx'
import Products from './pages/Products.jsx'
import Tasks from './pages/Tasks.jsx'
import SettingsPage from './pages/Settings.jsx'

const tabs = [
  { to: '/', label: '首页', icon: LayoutDashboard, end: true },
  { to: '/sourcing', label: '选品', icon: Search },
  { to: '/products', label: '商品', icon: Package },
  { to: '/tasks', label: '铺货', icon: Zap },
  { to: '/settings', label: '设置', icon: Settings },
]

export default function App() {
  const location = useLocation()

  // 获取当前页面标题
  const currentTab = tabs.find(t =>
    t.end ? location.pathname === t.to : location.pathname.startsWith(t.to)
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-[640px] mx-auto">
      {/* 顶栏 - 显示当前页面标题 */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 h-14 flex items-center justify-center shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-800">{currentTab?.label || '铺货通'}</span>
        </div>
      </header>

      {/* 主内容 - 底部留出 Tab 栏高度 */}
      <main className="flex-1 pb-20 overflow-y-auto">
        <div className="p-4">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sourcing" element={<Sourcing />} />
            <Route path="/products" element={<Products />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>

      {/* 底部 Tab 导航 - APP 风格 */}
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
