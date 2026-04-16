import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://pubg-fantasy-platform.onrender.com'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - attach JWT if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('wf_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle 401 (expired/invalid token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('auth:session-expired'))
    }
    return Promise.reject(error)
  }
)

export default api