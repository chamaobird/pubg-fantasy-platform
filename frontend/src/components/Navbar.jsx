// frontend/src/components/Navbar.jsx
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import { STATUS_COLOR, STATUS_LABEL } from '../utils/statusColors'
import '../styles/xm-navbar.css'

function getIsAdmin(token) {
  try { return JSON.parse(atob(token.split('.')[1])).is_admin === true } catch { return false }
}

export default function Navbar({ tournament = null }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { token, logout } = useAuth()
  const isAdmin   = getIsAdmin(token)

  const items = [
    { id: 'dashboard',     label: 'Dashboard',   path: '/dashboard'     },
    { id: 'championships', label: 'Campeonato',  path: '/championships' },
    { id: 'leagues',       label: 'Ligas',        path: '/leagues'       },
    { id: 'profile',       label: 'Perfil',       path: '/profile'       },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', path: '/admin' }] : []),
  ]

  const isActive = (path) =>
    location.pathname === path ||
    (path !== '/dashboard' && location.pathname.startsWith(path))

  return (
    <header className="xm-nav">
      <div className="xm-nav-inner">

        {/* Brand + tournament context */}
        <div className="xm-nav-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <span className="xm-nav-brandmark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="#f97316" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </span>
          <div className="xm-nav-brand-text">
            <div className="xm-nav-brand-title">XAMA</div>
            <div className="xm-nav-brand-sub">FANTASY LEAGUE</div>
          </div>

          {tournament && (
            <div className="xm-nav-tournament">
              <div>
                <div className="xm-nav-tournament-name">{tournament.name}</div>
                <div className="xm-nav-tournament-status"
                     style={{ color: STATUS_COLOR[tournament.status] || 'var(--xm-muted)' }}>
                  <span className="xm-nav-tournament-statusdot"
                        style={{ background: STATUS_COLOR[tournament.status] || 'var(--xm-muted)' }} />
                  {STATUS_LABEL[tournament.status] || tournament.status}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs + Sair */}
        <nav className="xm-nav-tabs">
          {items.map(it => (
            <button
              key={it.id}
              className={`xm-nav-tab${isActive(it.path) ? ' is-active' : ''}`}
              onClick={() => navigate(it.path)}
            >
              {it.label}
            </button>
          ))}
          <button className="xm-nav-logout" onClick={logout}>
            Sair
          </button>
        </nav>

        {/* Status: pill LIVE (hardcoded — ver BACKLOG para dinamização) */}
        <div className="xm-nav-status">
          <span className="xm-nav-live">
            <span className="xm-nav-livedot" />
            LIVE
          </span>
          <span className="xm-nav-tags">PAS 2026 · PEC 2026</span>
        </div>

      </div>
      <div className="xm-nav-rule" />
    </header>
  )
}
