import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // 初始化时从 localStorage 恢复 token
  useEffect(() => {
    const token = localStorage.getItem('pds_token')
    if (token) {
      api.setToken(token)
      api.me()
        .then((u) => setUser(u))
        .catch(() => {
          localStorage.removeItem('pds_token')
          api.setToken(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const _persist = (result) => {
    localStorage.setItem('pds_token', result.access_token)
    api.setToken(result.access_token)
    setUser({ id: 0, username: result.username, role: result.role })
    return result
  }

  const login = useCallback(async (username, password) => _persist(await api.login(username, password)), [])
  const register = useCallback(async (username, password) => _persist(await api.register(username, password)), [])

  const loginEmail = useCallback(async (email, code) => _persist(await api.loginEmail(email, code)), [])
  const registerEmail = useCallback(async (email, code, password) => _persist(await api.registerEmail(email, code, password)), [])

  const loginPhone = useCallback(async (phone, code) => _persist(await api.loginPhone(phone, code)), [])
  const registerPhone = useCallback(async (phone, code, password) => _persist(await api.registerPhone(phone, code, password)), [])

  const logout = useCallback(() => {
    localStorage.removeItem('pds_token')
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