// frontend/src/App.jsx
import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Championships from './pages/Championships'
import TournamentHub from './pages/TournamentHub'
import Profile from './pages/Profile'
import Dashboard from './pages/Dashboard'
import LineupResultsPage from './pages/LineupResultsPage'
import AuthVerified from './pages/AuthVerified'
import AuthCallback from './pages/AuthCallback'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SetupUsername from './pages/SetupUsername'
import AppBackground from './components/AppBackground'
import Admin from './pages/Admin'
import Leagues from './pages/Leagues'
import LeagueDetail from './pages/LeagueDetail'

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function isTokenExpired(token) {
  if (!token) return true
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

function loadValidToken() {
  const t = localStorage.getItem('wf_token')
  if (!t || isTokenExpired(t)) {
    localStorage.removeItem('wf_token')
    localStorage.removeItem('wf_redirect')
    return ''
  }
  return t
}

function RequireAuth({ children }) {
  const { token } = useAuth()
  const location = useLocation()
  if (!token) return <Navigate to="/" state={{ from: location }} replace />
  return (
    <>
      <AppBackground />
      <div style={{ position: 'relative', zIndex: 2 }}>
        {children}
      </div>
    </>
  )
}

function LandingWithRedirect() {
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname || '/dashboard'
  return <LandingPage redirectTo={redirectTo} />
}

export default function App() {
  const [token, setToken] = useState(() => loadValidToken())
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState('')

  const handleSetToken = (t, redirectTo) => {
    localStorage.setItem('wf_token', t)
    if (redirectTo && redirectTo !== '/dashboard') {
      localStorage.setItem('wf_redirect', redirectTo)
    }
    setSessionExpiredMsg('')
    setToken(t)
  }

  const handleLogout = () => {
    localStorage.removeItem('wf_token')
    localStorage.removeItem('wf_redirect')
    setToken('')
  }

  // Escuta o evento global de sessão expirada (disparado por qualquer fetch que receba 401)
  useEffect(() => {
    const onUnauthorized = () => {
      handleLogout()
      setSessionExpiredMsg('Sua sessão expirou. Por favor, faça login novamente.')
    }
    window.addEventListener('auth:session-expired', onUnauthorized)
    return () => window.removeEventListener('auth:session-expired', onUnauthorized)
  }, [])

  const pendingRedirect = localStorage.getItem('wf_redirect')

  return (
    <AuthContext.Provider value={{ token, setToken: handleSetToken, logout: handleLogout, sessionExpiredMsg, clearSessionMsg: () => setSessionExpiredMsg('') }}>
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

          {/* Ligas Privadas */}
          <Route path="/leagues" element={
            <RequireAuth><Leagues /></RequireAuth>
          } />
          <Route path="/leagues/:id" element={
            <RequireAuth><LeagueDetail /></RequireAuth>
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

          <Route path="/auth/callback" element={
            <AuthCallback />
          } />

          <Route path="/setup-username" element={
            <RequireAuth><SetupUsername /></RequireAuth>
          } />

          <Route path="/auth/reset-password" element={
            <ResetPasswordPage />
          } />

          {/* Admin */}
          <Route path="/admin" element={
            <RequireAuth><Admin /></RequireAuth>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
