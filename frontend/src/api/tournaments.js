import api from './axios'

export const getTournaments = async (params = {}) => {
  const response = await api.get('/tournaments/', { params })
  return response.data
}

export const getTournament = async (id) => {
  const response = await api.get(`/tournaments/${id}`)
  return response.data
}

export const createTournament = async (data) => {
  const response = await api.post('/tournaments/', data)
  return response.data
}
