// frontend/src/App.jsx
import { useState, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import TournamentSelect from './pages/TournamentSelect'
import TournamentHub from './pages/TournamentHub'

// ── Auth context — shared across all pages ────────────────────────────────────
export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('wf_token') || '')

  const handleSetToken = (t) => {
    localStorage.setItem('wf_token', t)
    setToken(t)
  }

  const handleLogout = () => {
    localStorage.removeItem('wf_token')
    setToken('')
  }

  return (
    <AuthContext.Provider value={{ token, setToken: handleSetToken, logout: handleLogout }}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={
            token ? <Navigate to="/tournaments" replace /> : <LandingPage />
          } />

          {/* Protected */}
          <Route path="/tournaments" element={
            token ? <TournamentSelect /> : <Navigate to="/" replace />
          } />

          <Route path="/tournament/:id" element={
            token ? <TournamentHub /> : <Navigate to="/" replace />
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
