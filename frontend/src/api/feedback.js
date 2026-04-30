// frontend/src/api/feedback.js
import { API_BASE_URL } from '../config'

export async function submitFeedback({ message, rating, page }, token = '') {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE_URL}/feedback`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      rating: rating || null,
      page: page || null,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function listFeedback(token, { skip = 0, limit = 50 } = {}) {
  const res = await fetch(`${API_BASE_URL}/admin/feedback?skip=${skip}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
