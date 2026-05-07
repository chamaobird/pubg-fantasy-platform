// Navbar — barra superior do XAMA Fantasy
const { useState: useNavState } = React

function XamaNavbar({ active = 'dashboard' }) {
  const items = [
    { id: 'dashboard',  label: 'Dashboard'  },
    { id: 'campeonato', label: 'Campeonato' },
    { id: 'ligas',      label: 'Ligas'      },
    { id: 'perfil',     label: 'Perfil',  icon: 'eye' },
    { id: 'admin',      label: 'Admin'    },
  ]

  return (
    <header className="xm-nav">
      <div className="xm-nav-inner">
        {/* Brand lockup */}
        <div className="xm-nav-brand">
          <span className="xm-nav-brandmark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </span>
          <div className="xm-nav-brand-text">
            <div className="xm-nav-brand-title">XAMA</div>
            <div className="xm-nav-brand-sub">FANTASY LEAGUE</div>
          </div>
        </div>

        {/* Tabs */}
        <nav className="xm-nav-tabs">
          {items.map(it => (
            <button key={it.id} className={`xm-nav-tab ${active === it.id ? 'is-active' : ''}`}>
              {it.label}
            </button>
          ))}
        </nav>

        {/* Status */}
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

window.XamaNavbar = XamaNavbar
