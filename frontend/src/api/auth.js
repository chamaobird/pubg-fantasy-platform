import api from './axios';

// Login uses email + password as JSON (backend expects LoginRequest schema)
export const login = async (email, password) => {
  const response = await api.post('/users/login', { email, password })
  return response.data
}

export const register = async (username, email, password) => {
  const response = await api.post('/users/register', { username, email, password })
  return response.data
}

export const getMe = async () => {
  const response = await api.get('/users/me')
  return response.data
}