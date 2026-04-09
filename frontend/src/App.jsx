// frontend/src/App.jsx
import { useState, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Championships from './pages/Championships'
import TournamentHub from './pages/TournamentHub'
import Profile from './pages/Profile'
import Dashboard from './pages/Dashboard'
import LineupResultsPage from './pages/LineupResultsPage'
import AuthVerified from './pages/AuthVerified'

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function RequireAuth({ children }) {
  const { token } = useAuth()
  const location = useLocation()
  if (!token) return <Navigate to="/" state={{ from: location }} replace />
  return children
}

function LandingWithRedirect() {
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname || '/dashboard'
  return <LandingPage redirectTo={redirectTo} />
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('wf_token') || '')

  const handleSetToken = (t, redirectTo) => {
    localStorage.setItem('wf_token', t)
    if (redirectTo && redirectTo !== '/dashboard') {
      localStorage.setItem('wf_redirect', redirectTo)
    }
    setToken(t)
  }

  const handleLogout = () => {
    localStorage.removeItem('wf_token')
    localStorage.removeItem('wf_redirect')
    setToken('')
  }

  const pendingRedirect = localStorage.getItem('wf_redirect')

  return (
    <AuthContext.Provider value={{ token, setToken: handleSetToken, logout: handleLogout }}>
      <BrowserRouter>
        <Routes>
          {/* Pública */}
          <Route path="/" element={
            token
              ? <Navigate to={pendingRedirect || '/dashboard'} replace />
              : <LandingWithRedirect />
          } />

          {/* Dashboard — página inicial pós-login */}
          <Route path="/dashboard" element={
            <RequireAuth><Dashboard /></RequireAuth>
          } />

          {/* Perfil */}
          <Route path="/profile" element={
            <RequireAuth><Profile /></RequireAuth>
          } />

          {/* Campeonatos */}
          <Route path="/championships" element={
            <RequireAuth><Championships /></RequireAuth>
          } />

          {/* Redirect legado */}
          <Route path="/tournaments" element={<Navigate to="/championships" replace />} />

          <Route path="/tournament/:id" element={
            <RequireAuth><TournamentHub /></RequireAuth>
          } />

          <Route path="/stages/:stageId/results" element={
            <LineupResultsPage token={token} />
          } />

          <Route path="/auth/verified" element={
            <AuthVerified />
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
