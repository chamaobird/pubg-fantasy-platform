// frontend/src/pages/Admin.jsx — Página principal do painel admin
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import Navbar from '../components/Navbar'
import AppBackground from '../components/AppBackground'
import AdminPersons from './admin/AdminPersons'
import AdminChampionships from './admin/AdminChampionships'
import AdminStages from './admin/AdminStages'
import AdminTeams from './admin/AdminTeams'

const SECTIONS = [
  { key: 'persons',       label: 'Jogadores',      icon: '👤', desc: 'Persons e contas PUBG' },
  { key: 'teams',         label: 'Times',           icon: '🏆', desc: 'Elencos e membros' },
  { key: 'championships', label: 'Championships',   icon: '🎯', desc: 'Campeonatos' },
  { key: 'stages',        label: 'Stages',          icon: '📅', desc: 'Fases e status' },
]

function getIsAdmin(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.is_admin === true
  } catch {
    return false
  }
}

export default function Admin() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [section, setSection] = useState('persons')

  if (!token || !getIsAdmin(token)) {
    navigate('/dashboard')
    return null
  }

  const renderSection = () => {
    switch (section) {
      case 'persons':       return <AdminPersons token={token} />
      case 'teams':         return <AdminTeams token={token} />
      case 'championships': return <AdminChampionships token={token} />
      case 'stages':        return <AdminStages token={token} />
      default:              return null
    }
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', colorScheme: 'dark' }}>
      <AppBackground />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <Navbar />
        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '32px 24px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>

          {/* Sidebar */}
          <div style={{ width: 210, flexShrink: 0, position: 'sticky', top: 24 }}>
            <div style={{
              background: 'rgba(18,21,28,0.92)', border: '1px solid var(--color-xama-border)',
              borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-xama-border)' }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
                  color: 'var(--color-xama-orange)', textTransform: 'uppercase',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  Admin Panel
                </div>
              </div>
              {SECTIONS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '12px 18px',
                    background: section === s.key ? 'rgba(249,115,22,0.1)' : 'transparent',
                    borderLeft: `2px solid ${section === s.key ? 'var(--color-xama-orange)' : 'transparent'}`,
                    border: 'none', borderRadius: 0,
                    color: section === s.key ? 'var(--color-xama-text)' : 'var(--color-xama-muted)',
                    fontSize: 14, fontWeight: section === s.key ? 600 : 400,
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
                  <div>
                    <div>{s.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-xama-muted)', marginTop: 1 }}>{s.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Conteúdo */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {renderSection()}
          </div>
        </div>
      </div>
    </div>
  )
}
