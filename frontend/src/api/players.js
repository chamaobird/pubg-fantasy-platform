import api from './axios'

export const getPlayers = async (params = {}) => {
  const response = await api.get('/players/', { params })
  return response.data
}

export const getPlayer = async (id) => {
  const response = await api.get(`/players/${id}`)
  return response.data
}
