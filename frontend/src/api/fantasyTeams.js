import api from './axios'

export const getTeams = async () => {
  const response = await api.get('/fantasy-teams/')
  return response.data
}

export const createTeam = async (data) => {
  const response = await api.post('/fantasy-teams/', data)
  return response.data
}

export const getTeam = async (id) => {
  const response = await api.get(`/fantasy-teams/${id}`)
  return response.data
}

export const addPlayerToTeam = async (teamId, playerId) => {
  const response = await api.post(`/fantasy-teams/${teamId}/players`, { player_id: playerId })
  return response.data
}

export const removePlayerFromTeam = async (teamId, playerId) => {
  const response = await api.delete(`/fantasy-teams/${teamId}/players/${playerId}`)
  return response.data
}

export const getLeaderboard = async (tournamentId) => {
  const response = await api.get(`/leaderboard/${tournamentId}`)
  return response.data
}

export const recalculatePrices = async () => {
  const response = await api.post('/admin/calculate-prices')
  return response.data
}
