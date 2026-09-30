import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fund_transparency_access')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401) {
    localStorage.removeItem('fund_transparency_access')
    localStorage.removeItem('fund_transparency_user')
    if (!['/login', '/register'].includes(window.location.pathname)) window.location.assign('/login')
  }
  return Promise.reject(error)
})

export function getFriendlyError(error, fallback = 'Something went wrong. Please try again.') {
  const status = error.response?.status
  const message = error.response?.data?.error || error.response?.data?.detail || error.response?.data?.message
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return "You don't have permission to perform this action."
  if (status === 404) return 'The requested record was not found.'
  if (status >= 500) return 'The service could not complete your request. Please try again shortly.'
  if (error.code === 'ERR_NETWORK') return 'Cannot reach the Django API. Confirm the backend is running at 127.0.0.1:8000.'
  return typeof message === 'string' ? message : fallback
}