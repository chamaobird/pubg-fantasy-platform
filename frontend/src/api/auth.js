import api from './axios'

export const login = async (username, password) => {
  // FastAPI OAuth2 expects form data
  const formData = new URLSearchParams()
  formData.append('username', username)
  formData.append('password', password)

  const response = await api.post('/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return response.data
}

export const register = async (username, email, password) => {
  const response = await api.post('/auth/register', { username, email, password })
  return response.data
}

export const getMe = async () => {
  const response = await api.get('/auth/me')
  return response.data
}
