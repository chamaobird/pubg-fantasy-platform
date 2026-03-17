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

function LandingWithRedirect() {
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname || '/tournaments'
  return <LandingPage redirectTo={redirectTo} />
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('wf_token') || '')

  const handleSetToken = (t, redirectTo) => {
    localStorage.setItem('wf_token', t)
    if (redirectTo && redirectTo !== '/tournaments') {
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
          <Route path="/" element={
            token
              ? <Navigate to={pendingRedirect || '/tournaments'} replace />
              : <LandingWithRedirect />
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
