import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Players from './pages/Players'
import CreateTeam from './pages/CreateTeam'
import TeamDetail from './pages/TeamDetail'
import MyTeams from './pages/MyTeams'
import Leaderboard from './pages/Leaderboard'
import Tournaments from './pages/Tournaments'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <div className="min-h-screen bg-bg text-white">
            <Navbar />
            <Routes>
              {/* Public */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/players" element={<Players />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/leaderboard/:tournament_id" element={<Leaderboard />} />

              {/* Protected */}
              <Route path="/dashboard" element={
                <ProtectedRoute><Dashboard /></ProtectedRoute>
              } />
              <Route path="/create-team" element={
                <ProtectedRoute><CreateTeam /></ProtectedRoute>
              } />
              <Route path="/teams/:id" element={
                <ProtectedRoute><TeamDetail /></ProtectedRoute>
              } />
              <Route path="/my-teams" element={
                <ProtectedRoute><MyTeams /></ProtectedRoute>
              } />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
