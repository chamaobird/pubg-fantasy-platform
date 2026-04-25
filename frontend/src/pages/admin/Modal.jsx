// pages/admin/Modal.jsx — Modal reutilizável para o painel admin
import { useState, useRef, useEffect } from 'react'

// ── Sorting hook ──────────────────────────────────────────────────────────────

export function useSorting(initialCol = null, initialDir = 'asc') {
  const [sort, setSort] = useState({ col: initialCol, dir: initialDir })
  const toggle = (col) => setSort(prev => ({
    col,
    dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc',
  }))
  const apply = (data, accessors) => {
    if (!sort.col || !accessors[sort.col]) return data
    return [...data].sort((a, b) => {
      const va = accessors[sort.col](a) ?? ''
      const vb = accessors[sort.col](b) ?? ''
      const cmp = typeof va === 'string'
        ? va.localeCompare(vb, 'pt-BR', { sensitivity: 'base' })
        : (va < vb ? -1 : va > vb ? 1 : 0)
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }
  return { sort, toggle, apply }
}

// ── Team logo ─────────────────────────────────────────────────────────────────

// Mapeamento region → pasta de logos (os arquivos foram organizados por liga)
const REGION_LOGO_FOLDER = {
  'Americas': 'PAS',
  'EMEA': 'PEC',
}

export function TeamLogo({ tag, region, size = 22 }) {
  const folder = REGION_LOGO_FOLDER[region] || region  // fallback para o próprio valor
  const base = folder && tag ? `/logos/${folder}/${tag.toLowerCase()}` : null
  const [ext, setExt] = useState('png')
  const [failed, setFailed] = useState(false)
  if (!base || failed) return <span style={{ display: 'inline-block', width: size, height: size }} />
  return (
    <img
      src={`${base}.${ext}`}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: 'contain', borderRadius: 2, flexShrink: 0, verticalAlign: 'middle' }}
      onError={() => ext === 'png' ? setExt('jpeg') : setFailed(true)}
    />
  )
}

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
  background: '#1a1d2a',
  cursor: 'pointer',
  colorScheme: 'dark',
}

/**
 * SearchableSelect — dropdown com campo de busca embutido.
 *
 * Props:
 *   value      — valor selecionado atualmente (string | number | null)
 *   onChange   — (value) => void
 *   options    — [{ value, label }]
 *   placeholder — texto do input vazio
 *   style      — estilo adicional no container
 */
export function SearchableSelect({ value, onChange, options = [], placeholder = 'Buscar...', style }) {
  const [query, setQuery]           = useState('')
  const [open, setOpen]             = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef(null)

  const selectedOption = options.find(o => String(o.value) === String(value))

  // Ao fechar, limpa a query; ao abrir, mostra todas as opções
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (opt) => {
    onChange(opt.value)
    setOpen(false)
    setQuery('')
  }

  const handleFocus = () => {
    setOpen(true)
    setQuery('')
    setHighlighted(0)
  }

  const handleChange = (e) => {
    setQuery(e.target.value)
    setOpen(true)
    setHighlighted(0)
  }

  const handleKeyDown = (e) => {
    if (!open) { if (e.key === 'Enter' || e.key === 'ArrowDown') setOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlighted]) handleSelect(filtered[highlighted]) }
    else if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  // O que mostrar no input: se aberto, mostra a query digitada; se fechado, mostra o label selecionado
  const displayValue = open ? query : (selectedOption?.label ?? '')

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      <input
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={open ? 'Digite para filtrar...' : placeholder}
        autoComplete="off"
        style={{ ...inputStyle, paddingRight: 28, width: '100%', boxSizing: 'border-box' }}
      />
      <span style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        color: 'var(--color-xama-muted)', fontSize: 10, pointerEvents: 'none',
        transition: 'transform 0.15s',
        ...(open ? { transform: 'translateY(-50%) rotate(180deg)' } : {}),
      }}>▼</span>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 500,
          background: '#1a1d2a', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, maxHeight: 240, overflowY: 'auto',
          boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--color-xama-muted)' }}>
              Nenhum resultado para "{query}"
            </div>
          ) : filtered.map((opt, i) => (
            <div
              key={opt.value}
              onMouseDown={() => handleSelect(opt)}
              onMouseEnter={() => setHighlighted(i)}
              style={{
                padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                color: String(opt.value) === String(value) ? 'var(--color-xama-orange)' : 'var(--color-xama-text)',
                background: i === highlighted ? 'rgba(249,115,22,0.1)' : 'transparent',
                borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                fontWeight: String(opt.value) === String(value) ? 600 : 400,
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
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

export function SortableHeader({ label, col, sort, onSort, style }) {
  const active = sort.col === col
  return (
    <th
      style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
      onClick={() => onSort(col)}
    >
      {label}
      <span style={{ marginLeft: 4, fontSize: 9, opacity: active ? 1 : 0.25 }}>
        {active && sort.dir === 'desc' ? '▼' : '▲'}
      </span>
    </th>
  )
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
