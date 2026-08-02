import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Eye, EyeOff, User, Lock, Mail, Smartphone, Timer, Settings, X, Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { api, setApiBase, getApiBase } from '../api.js'

const TABS = [
  { key: 'account', label: '账号登录', icon: User },
  { key: 'email', label: '邮箱登录', icon: Mail },
  { key: 'phone', label: '手机登录', icon: Smartphone },
]

export default function Login() {
  const { login, register, loginEmail, registerEmail, loginPhone, registerPhone } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('account')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 后端地址设置
  const [showSettings, setShowSettings] = useState(false)
  const [apiBaseInput, setApiBaseInput] = useState('')
  const [apiSaved, setApiSaved] = useState(false)

  useEffect(() => {
    setApiBaseInput(getApiBase())
  }, [])

  const handleSaveApiBase = () => {
    const url = apiBaseInput.trim()
    if (!url) {
      setApiBase('')
      setApiSaved(true)
      setTimeout(() => setApiSaved(false), 2000)
      return
    }
    // 自动补全 https
    let finalUrl = url
    if (!finalUrl.startsWith('http')) {
      finalUrl = 'https://' + finalUrl
    }
    // 自动补全 /api
    if (!finalUrl.endsWith('/api') && !finalUrl.includes('/api/')) {
      finalUrl = finalUrl.replace(/\/$/, '') + '/api'
    }
    setApiBase(finalUrl)
    setApiBaseInput(finalUrl)
    setApiSaved(true)
    setTimeout(() => setApiSaved(false), 2000)
  }

  const handleTestConnection = async () => {
    try {
      const res = await fetch(`${apiBaseInput.replace(/\/$/, '')}/health`)
      if (res.ok) {
        const data = await res.json()
        alert(`连接成功！服务版本: ${data.version || '未知'}`)
      } else {
        alert(`连接失败: HTTP ${res.status}`)
      }
    } catch (err) {
      alert(`连接失败: ${err.message}`)
    }
  }

  // 账号登录
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  // 邮箱
  const [email, setEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailPwd, setEmailPwd] = useState('')
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [emailCooldown, setEmailCooldown] = useState(0)
  const emailTimerRef = useRef(null)
  // 手机号
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [phonePwd, setPhonePwd] = useState('')
  const [smsCodeSent, setSmsCodeSent] = useState(false)
  const [smsCooldown, setSmsCooldown] = useState(0)
  const smsTimerRef = useRef(null)

  // 倒计时
  const startCooldown = (setter, timerRef) => {
    setter(60)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setter((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // 发送邮箱验证码
  const handleSendEmailCode = async () => {
    if (!email.trim()) { setError('请输入邮箱地址'); return }
    setError('')
    setLoading(true)
    try {
      await api.sendEmailCode(email.trim())
      setEmailCodeSent(true)
      startCooldown(setEmailCooldown, emailTimerRef)
    } catch (err) {
      setError(err.message || '发送失败，请检查网络或后端邮箱配置')
    } finally {
      setLoading(false)
    }
  }

  // 发送短信验证码
  const handleSendSmsCode = async () => {
    if (!phone.trim()) { setError('请输入手机号'); return }
    setError('')
    setLoading(true)
    try {
      await api.sendSmsCode(phone.trim())
      setSmsCodeSent(true)
      startCooldown(setSmsCooldown, smsTimerRef)
    } catch (err) {
      setError(err.message || '发送失败，请检查网络或短信配置')
    } finally {
      setLoading(false)
    }
  }

  // 账号登录/注册
  const handleAccountSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) { setError('请填写用户名和密码'); return }
    if (password.length < 8) { setError('密码至少 8 位，需包含大小写字母和数字'); return }
    setLoading(true)
    try {
      isRegister ? await register(username.trim(), password) : await login(username.trim(), password)
      navigate('/')
    } catch (err) { setError(err.message || '登录失败，请检查网络或后端地址') }
    finally { setLoading(false) }
  }

  // 邮箱登录/注册
  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !emailCode.trim()) { setError('请填写邮箱和验证码'); return }
    if (isRegister && emailPwd.length < 8) { setError('密码至少 8 位，需包含大小写字母和数字'); return }
    setLoading(true)
    try {
      if (isRegister) {
        await registerEmail(email.trim(), emailCode.trim(), emailPwd)
      } else {
        await loginEmail(email.trim(), emailCode.trim())
      }
      navigate('/')
    } catch (err) { setError(err.message || '操作失败，请检查网络或验证码') }
    finally { setLoading(false) }
  }

  // 手机号登录/注册
  const handlePhoneSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!phone.trim() || !smsCode.trim()) { setError('请填写手机号和验证码'); return }
    if (isRegister && phonePwd.length < 8) { setError('密码至少 8 位，需包含大小写字母和数字'); return }
    setLoading(true)
    try {
      if (isRegister) {
        await registerPhone(phone.trim(), smsCode.trim(), phonePwd)
      } else {
        await loginPhone(phone.trim(), smsCode.trim())
      }
      navigate('/')
    } catch (err) { setError(err.message || '操作失败，请检查网络或验证码') }
    finally { setLoading(false) }
  }

  const switchTab = (key) => {
    setTab(key)
    setError('')
    setIsRegister(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo + 设置按钮 */}
        <div className="text-center mb-6 relative">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-200 mb-4">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">电商铺货工具</h1>
          <p className="text-sm text-gray-500 mt-1">多平台自动铺货管理</p>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="absolute right-0 top-0 p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="后端地址设置"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* 后端地址设置面板 */}
        {showSettings && (
          <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">后端地址设置</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">API 地址</label>
                <input
                  type="text"
                  value={apiBaseInput}
                  onChange={(e) => setApiBaseInput(e.target.value)}
                  placeholder="https://your-backend.com/api"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  填入你的后端地址，如 https://xxx.up.railway.app/api
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveApiBase}
                  className="flex-1 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors flex items-center justify-center gap-1"
                >
                  {apiSaved ? <><Check className="w-4 h-4" /> 已保存</> : '保存'}
                </button>
                <button
                  onClick={handleTestConnection}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  测试连接
                </button>
              </div>
              <button
                onClick={() => { setApiBase(''); setApiBaseInput('/api'); }}
                className="w-full text-xs text-gray-400 hover:text-gray-600"
              >
                恢复默认
              </button>
            </div>
          </div>
        )}

        {/* Tab 切换 */}
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 overflow-hidden">
          <div className="flex border-b border-gray-100">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => switchTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? 'text-brand-600 border-b-2 border-brand-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
          <div className="p-6">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
                {error}
              </div>
            )}
            {/* ===== 账号登录 ===== */}
            {tab === 'account' && (
              <form onSubmit={handleAccountSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">用户名</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                      placeholder="请输入用户名" autoComplete="username"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">密码</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showPwd ? 'text' : 'password'} value={password}
                      onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码"
                      autoComplete={isRegister ? 'new-password' : 'current-password'}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-medium text-sm hover:from-brand-600 hover:to-brand-700 transition-all disabled:opacity-60 shadow-md shadow-brand-200">
                  {loading ? (isRegister ? '注册中...' : '登录中...') : isRegister ? '注册' : '登录'}
                </button>
                <div className="text-center">
                  <button type="button" onClick={() => { setIsRegister(!isRegister); setError('') }}
                    className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                    {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
                  </button>
                </div>
              </form>
            )}
            {/* ===== 邮箱登录 ===== */}
            {tab === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">邮箱地址</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="请输入邮箱" autoComplete="email"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">验证码</label>
                  <div className="flex gap-2">
                    <input type="text" value={emailCode} onChange={(e) => setEmailCode(e.target.value)}
                      placeholder="6位验证码" maxLength={6}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" />
                    <button type="button" onClick={handleSendEmailCode}
                      disabled={emailCooldown > 0 || loading}
                      className="shrink-0 px-4 py-2.5 rounded-xl bg-brand-50 text-brand-600 text-sm font-medium hover:bg-brand-100 transition-colors disabled:opacity-50 flex items-center gap-1">
                      {loading ? '发送中...' : emailCooldown > 0 ? (
                        <><Timer className="w-3.5 h-3.5" />{emailCooldown}s</>
                      ) : emailCodeSent ? '重新发送' : '获取验证码'}
                    </button>
                  </div>
                </div>
                {isRegister && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">设置密码</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="password" value={emailPwd} onChange={(e) => setEmailPwd(e.target.value)}
                        placeholder="设置登录密码" autoComplete="new-password"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" />
                    </div>
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-medium text-sm hover:from-brand-600 hover:to-brand-700 transition-all disabled:opacity-60 shadow-md shadow-brand-200">
                  {loading ? (isRegister ? '注册中...' : '登录中...') : isRegister ? '注册' : '登录'}
                </button>
                <div className="text-center">
                  <button type="button" onClick={() => { setIsRegister(!isRegister); setError('') }}
                    className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                    {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
                  </button>
                </div>
              </form>
            )}
            {/* ===== 手机号登录 ===== */}
            {tab === 'phone' && (
              <form onSubmit={handlePhoneSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">手机号</label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="请输入手机号" autoComplete="tel"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">短信验证码</label>
                  <div className="flex gap-2">
                    <input type="text" value={smsCode} onChange={(e) => setSmsCode(e.target.value)}
                      placeholder="6位验证码" maxLength={6}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" />
                    <button type="button" onClick={handleSendSmsCode}
                      disabled={smsCooldown > 0 || loading}
                      className="shrink-0 px-4 py-2.5 rounded-xl bg-brand-50 text-brand-600 text-sm font-medium hover:bg-brand-100 transition-colors disabled:opacity-50 flex items-center gap-1">
                      {loading ? '发送中...' : smsCooldown > 0 ? (
                        <><Timer className="w-3.5 h-3.5" />{smsCooldown}s</>
                      ) : smsCodeSent ? '重新发送' : '获取验证码'}
                    </button>
                  </div>
                </div>
                {isRegister && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">设置密码</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="password" value={phonePwd} onChange={(e) => setPhonePwd(e.target.value)}
                        placeholder="设置登录密码" autoComplete="new-password"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" />
                    </div>
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-medium text-sm hover:from-brand-600 hover:to-brand-700 transition-all disabled:opacity-60 shadow-md shadow-brand-200">
                  {loading ? (isRegister ? '注册中...' : '登录中...') : isRegister ? '注册' : '登录'}
                </button>
                <div className="text-center">
                  <button type="button" onClick={() => { setIsRegister(!isRegister); setError('') }}
                    className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                    {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
