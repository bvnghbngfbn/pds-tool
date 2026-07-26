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
        .then((u) => {
          setUser(u)
        })
        .catch(() => {
          localStorage.removeItem('pds_token')
          api.setToken(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (username, password) => {
    const result = await api.login(username, password)
    localStorage.setItem('pds_token', result.access_token)
    api.setToken(result.access_token)
    setUser({ id: 0, username: result.username, role: result.role })
    return result
  }, [])

  const register = useCallback(async (username, password) => {
    const result = await api.register(username, password)
    localStorage.setItem('pds_token', result.access_token)
    api.setToken(result.access_token)
    setUser({ id: 0, username: result.username, role: result.role })
    return result
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('pds_token')
    api.setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}