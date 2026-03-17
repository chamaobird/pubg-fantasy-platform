// frontend/src/App.jsx
import { useState, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import TournamentSelect from './pages/TournamentSelect'
import TournamentHub from './pages/TournamentHub'

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function RequireAuth({ children }) {
  const { token } = useAuth()
  const location = useLocation()
  if (!token) return <Navigate to="/" state={{ from: location }} replace />
  return children
}

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
          <Route path="/" element={
            token ? <Navigate to="/tournaments" replace /> : <LandingPage />
          } />
          <Route path="/tournaments" element={
            <RequireAuth><TournamentSelect /></RequireAuth>
          } />
          <Route path="/tournament/:id" element={
            <RequireAuth><TournamentHub /></RequireAuth>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}