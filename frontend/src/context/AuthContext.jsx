import { useState } from 'react'
import { AuthContext } from './auth-context.js'
const TOKEN_KEY = 'fund_transparency_access'
const USER_KEY = 'fund_transparency_user'

function readUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null }
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(readUser)

  function login(payload) {
    localStorage.setItem(TOKEN_KEY, payload.access)
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user))
    setAccessToken(payload.access)
    setUser(payload.user)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setAccessToken(null)
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, accessToken, role: user?.role, isAuthenticated: Boolean(accessToken && user), login, logout }}>{children}</AuthContext.Provider>
}
