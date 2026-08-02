import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // 初始化时通过 httpOnly Cookie 验证登录状态
  useEffect(() => {
    api.me()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const _persist = (result) => {
    // Token 已通过 httpOnly Cookie 自动存储，无需手动管理
    // 仅保留内存中的 token 引用作为 Authorization header 的备用方案
    api.setToken(result.access_token)
    setUser({ id: 0, username: result.username, role: result.role })
    return result
  }

  const login = useCallback(async (username, password, turnstileToken) => _persist(await api.login(username, password, turnstileToken)), [])
  const register = useCallback(async (username, password, turnstileToken) => _persist(await api.register(username, password, turnstileToken)), [])

  const loginEmail = useCallback(async (email, code, turnstileToken) => _persist(await api.loginEmail(email, code, turnstileToken)), [])
  const registerEmail = useCallback(async (email, code, password, turnstileToken) => _persist(await api.registerEmail(email, code, password, turnstileToken)), [])

  const loginPhone = useCallback(async (phone, code, turnstileToken) => _persist(await api.loginPhone(phone, code, turnstileToken)), [])
  const registerPhone = useCallback(async (phone, code, password, turnstileToken) => _persist(await api.registerPhone(phone, code, password, turnstileToken)), [])

  const logout = useCallback(async () => {
    try { await api.logout() } catch { /* ignore */ }
    api.setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{
      user, loading, login, register,
      loginEmail, registerEmail,
      loginPhone, registerPhone,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
