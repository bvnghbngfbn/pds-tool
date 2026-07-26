import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Eye, EyeOff, User, Lock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Login() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) {
      setError('请填写用户名和密码')
      return
    }
    if (password.length < 4) {
      setError('密码至少 4 位')
      return
    }
    setLoading(true)
    try {
      if (isRegister) {
        await register(username.trim(), password)
      } else {
        await login(username.trim(), password)
      }
      navigate('/')
    } catch (err) {
      setError(err.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-200 mb-4">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">铺货通</h1>
          <p className="text-sm text-gray-500 mt-1">1688 自动铺货工具</p>
        </div>

        {/* 表单卡片 */}
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {isRegister ? '注册账号' : '登录'}
          </h2>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">用户名</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-medium text-sm hover:from-brand-600 hover:to-brand-700 transition-all disabled:opacity-60 shadow-md shadow-brand-200"
            >
              {loading ? '处理中...' : isRegister ? '注册' : '登录'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError('') }}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}