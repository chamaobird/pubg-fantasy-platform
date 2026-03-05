import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/')
    setMenuOpen(false)
  }

  const navLinkClass = ({ isActive }) =>
    `font-display font-bold uppercase tracking-widest text-sm transition-colors duration-200 py-1
     ${isActive
       ? 'text-accent border-b border-accent'
       : 'text-text-secondary hover:text-white'}`

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg/90 backdrop-blur-md border-b border-border-color">
      {/* Top accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-60" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 border border-accent flex items-center justify-center bg-accent-dim group-hover:bg-accent/20 transition-colors"
                 style={{ clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)' }}>
              <span className="text-accent font-mono font-bold text-xs">WF</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-black uppercase text-white text-lg leading-none tracking-wider">
                WARZONE
              </span>
              <span className="font-display font-light uppercase text-accent text-xs leading-none tracking-[0.3em]">
                FANTASY
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <NavLink to="/tournaments" className={navLinkClass}>Tournaments</NavLink>
            <NavLink to="/players" className={navLinkClass}>Players</NavLink>
            {isAuthenticated && (
              <>
                <NavLink to="/dashboard" className={navLinkClass}>Dashboard</NavLink>
                <NavLink to="/my-teams" className={navLinkClass}>My Teams</NavLink>
              </>
            )}
          </div>

          {/* Auth */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1 border border-border-color">
                  <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                  <span className="font-mono text-xs text-text-secondary uppercase">{user?.username}</span>
                </div>
                <button onClick={handleLogout} className="btn-ghost text-xs">
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-ghost text-xs">Login</Link>
                <Link to="/register" className="btn-primary text-xs">Register</Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-text-secondary hover:text-accent transition-colors p-2"
          >
            <div className="w-5 flex flex-col gap-1">
              <span className={`h-px bg-current transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
              <span className={`h-px bg-current transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`h-px bg-current transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-card border-t border-border-color animate-fade-in">
          <div className="px-4 py-4 flex flex-col gap-3">
            <NavLink to="/tournaments" className={navLinkClass} onClick={() => setMenuOpen(false)}>Tournaments</NavLink>
            <NavLink to="/players" className={navLinkClass} onClick={() => setMenuOpen(false)}>Players</NavLink>
            {isAuthenticated && (
              <>
                <NavLink to="/dashboard" className={navLinkClass} onClick={() => setMenuOpen(false)}>Dashboard</NavLink>
                <NavLink to="/my-teams" className={navLinkClass} onClick={() => setMenuOpen(false)}>My Teams</NavLink>
              </>
            )}
            <div className="pt-2 border-t border-border-color flex flex-col gap-2">
              {isAuthenticated ? (
                <>
                  <span className="font-mono text-xs text-text-secondary uppercase">{user?.username}</span>
                  <button onClick={handleLogout} className="btn-ghost text-xs w-full text-left">Logout</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn-ghost text-xs" onClick={() => setMenuOpen(false)}>Login</Link>
                  <Link to="/register" className="btn-primary text-xs text-center" onClick={() => setMenuOpen(false)}>Register</Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
