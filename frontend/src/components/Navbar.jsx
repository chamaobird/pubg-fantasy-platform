// frontend/src/components/Navbar.jsx
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../App'

const STATUS_COLOR = {
  active: '#4ade80', upcoming: '#f97316', finished: '#6b7280',
  open: '#4ade80', closed: '#f97316', locked: '#6b7280',
}
const STATUS_LABEL = {
  active: 'AO VIVO', upcoming: 'EM BREVE', finished: 'ENCERRADO',
  open: 'ABERTA', closed: 'EM BREVE', locked: 'ENCERRADO',
}

export default function Navbar({ tournament = null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()

  const isActive = (path) => location.pathname === path

  return (
    <header style={{
      background: 'var(--color-xama-surface)',
      borderBottom: '1px solid var(--color-xama-border)',
      position: 'relative',
      flexShrink: 0,
      zIndex: 10,
    }}>
      <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 50%)' }} />

      <div style={{
        maxWidth: '1200px', margin: '0 auto', padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: '12px', height: '70px',
      }}>

        {/* Logo */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flexShrink: 0 }}
          onClick={() => navigate('/dashboard')}
        >
          <div style={{
            width: '40px', height: '40px', fontSize: '20px',
            background: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.05))',
            border: '1px solid rgba(249,115,22,0.3)', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>🔥</div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-xama-text)', letterSpacing: '0.06em', lineHeight: 1 }}>XAMA</div>
            <div style={{ fontSize: '11px', color: 'var(--color-xama-orange)', letterSpacing: '0.16em', textTransform: 'uppercase', lineHeight: 1 }}>Fantasy</div>
          </div>
        </div>

        {/* Contexto do torneio */}
        {tournament && (
          <>
            <div style={{ width: '1px', height: '32px', background: 'var(--color-xama-border)', flexShrink: 0 }} />
            <div style={{ flexShrink: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '19px', fontWeight: 700, color: 'var(--color-xama-text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '320px',
              }}>
                {tournament.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: STATUS_COLOR[tournament.status] || '#6b7280', flexShrink: 0,
                }} />
                <span style={{
                  fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em',
                  color: STATUS_COLOR[tournament.status] || '#6b7280', textTransform: 'uppercase',
                }}>
                  {STATUS_LABEL[tournament.status] || tournament.status}
                </span>
              </div>
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Nav links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {[
            { label: 'Dashboard',    path: '/dashboard'     },
            { label: 'Campeonatos', path: '/championships' },
            { label: '👤 Perfil',   path: '/profile'       },
          ].map(({ label, path }) => {
            const active = isActive(path)
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                style={{
                  background: active ? 'rgba(249,115,22,0.1)' : 'none',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--color-xama-orange)' : '2px solid transparent',
                  borderRadius: '0',
                  padding: '8px 16px',
                  fontSize: '17px', fontWeight: active ? 700 : 600,
                  letterSpacing: '0.04em',
                  color: active ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
                  cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif",
                  transition: 'color 0.15s, border-color 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--color-xama-text)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--color-xama-muted)' }}
              >
                {label}
              </button>
            )
          })}
          <button
            onClick={logout}
            style={{
              background: 'none', border: '1px solid var(--color-xama-border)',
              borderRadius: '6px', padding: '8px 18px', marginLeft: '4px',
              fontSize: '16px', fontWeight: 600, letterSpacing: '0.06em',
              color: 'var(--color-xama-muted)', cursor: 'pointer',
              fontFamily: "'Rajdhani', sans-serif",
            }}
          >
            Sair
          </button>
        </nav>

      </div>
    </header>
  )
}
