// pages/admin/Modal.jsx — Modal reutilizável para o painel admin
export function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#13161d', border: '1px solid rgba(249,115,22,0.3)',
          borderRadius: 14, padding: '28px 28px 24px',
          width: '100%', maxWidth: width,
          maxHeight: '88vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, color: 'var(--color-xama-muted)',
              fontSize: 18, cursor: 'pointer', width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-xama-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--color-xama-muted)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

export const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
  color: 'var(--color-xama-text)', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
}

export const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
}

export function Msg({ msg }) {
  if (!msg) return null
  const isErr = msg.startsWith('!')
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
      background: isErr ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)',
      border: `1px solid ${isErr ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.3)'}`,
      color: isErr ? '#f87171' : 'var(--color-xama-green)',
    }}>
      {isErr ? msg.slice(1) : msg}
    </div>
  )
}

export function ActBtn({ children, onClick, danger, small, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? '5px 10px' : '7px 14px',
        borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: small ? 12 : 13, fontWeight: 600,
        border: '1px solid',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.15s',
        ...(danger
          ? { background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.35)', color: '#f87171' }
          : { background: 'rgba(249,115,22,0.1)', borderColor: 'rgba(249,115,22,0.35)', color: 'var(--color-xama-orange)' }
        ),
      }}
    >
      {children}
    </button>
  )
}

export function SaveBtn({ loading, label = 'Salvar', onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        width: '100%', padding: '10px', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: 14, fontWeight: 700,
        background: loading ? 'rgba(249,115,22,0.3)' : 'var(--color-xama-orange)',
        border: 'none', color: '#fff', transition: 'opacity 0.15s',
        opacity: loading ? 0.7 : 1,
        marginTop: 8,
      }}
    >
      {loading ? 'Salvando...' : label}
    </button>
  )
}

export function SectionHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-xama-text)' }}>{title}</div>
      {action}
    </div>
  )
}

export function SearchBar({ value, onChange, placeholder = 'Buscar...' }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...inputStyle, marginBottom: 14 }}
    />
  )
}

export const tableStyle = {
  width: '100%', borderCollapse: 'collapse', fontSize: 13,
}
export const thStyle = {
  textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid var(--color-xama-border)',
  fontSize: 11, fontWeight: 700, color: 'var(--color-xama-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
}
export const tdStyle = {
  padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
  color: 'var(--color-xama-text)', verticalAlign: 'middle',
}

export function StatusBadge({ status }) {
  const map = {
    open:    { bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.35)',  color: 'var(--color-xama-green)',  label: 'ABERTO' },
    preview: { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)', color: 'var(--color-xama-orange)', label: 'PREVIEW' },
    live:    { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)', color: 'var(--color-xama-orange)', label: 'AO VIVO' },
    closed:  { bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)', color: 'var(--color-xama-muted)',  label: 'FECHADO' },
    locked:  { bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)', color: 'var(--color-xama-muted)',  label: 'ENCERRADO' },
  }
  const s = map[status] ?? map.closed
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
      fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em',
    }}>
      {s.label}
    </span>
  )
}
