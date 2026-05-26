// pages/admin/AdminStages.jsx — Stages com mudança de status inline + criação/edição
import { useState, useEffect, useCallback, Fragment, useRef } from 'react'
import { API_BASE_URL } from '../../config'
import {
  Modal, Field, Msg, ActBtn, SaveBtn, SectionHeader,
  inputStyle, selectStyle, tableStyle, thStyle, tdStyle,
  useSorting, SortableHeader, TeamLogo, SearchableSelect,
} from './Modal'

const api = (token) => async (method, path, body) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    const detail = Array.isArray(e.detail)
      ? e.detail.map(d => d.msg || JSON.stringify(d)).join('; ')
      : (e.detail || `HTTP ${res.status}`)
    throw new Error(detail)
  }
  return res.status === 204 ? null : res.json()
}

const LINEUP_STATUS_OPTIONS = ['closed', 'open', 'locked']
const STAGE_PHASE_OPTIONS = ['upcoming', 'preview', 'live', 'finished']
const BLANK = {
  championship_id: '', name: '', short_name: '', shard: 'steam',
  lineup_status: 'closed', stage_phase: 'upcoming',
  lineup_open_at: '', lineup_close_at: '',
  start_date: '', end_date: '',
  lineup_size: 4, captain_multiplier: 1.3,
  price_min: 12, price_max: 35,
  pubg_tournament_id: '',
  independent_lineups: false,
}

// ── Timezone helpers ──────────────────────────────────────────────────────────

// Converte ISO UTC → valor para input datetime-local (fuso do browser)
function utcToLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const offset = d.getTimezoneOffset() // minutos, positivo = atrás do UTC
  const local = new Date(d.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

// Converte valor de datetime-local (fuso do browser) → ISO UTC
function localInputToUtc(localStr) {
  if (!localStr) return null
  return new Date(localStr).toISOString()
}

// Detecta fuso do browser e formata "America/New_York (UTC-4)"
function detectTzLabel() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const offsetMin = new Date().getTimezoneOffset()
  const offsetH = -offsetMin / 60
  const sign = offsetH >= 0 ? '+' : ''
  const abbr = new Intl.DateTimeFormat('en', { timeZoneName: 'short' })
    .formatToParts(new Date())
    .find(p => p.type === 'timeZoneName')?.value ?? ''
  return `${tz}${abbr ? ` · ${abbr}` : ''} (UTC${sign}${offsetH}h)`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ── Painel de roster (visualização + edição) ──────────────────────────────────

function RosterPanel({ stage, token }) {
  const call = useCallback(api(token), [token])
  const [roster, setRoster] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [teamMap, setTeamMap] = useState({}) // tag → { region }
  // add player
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [addTeam, setAddTeam] = useState('')
  const searchRef = useRef(null)
  // edit inline
  const [editingId, setEditingId] = useState(null)
  const [editTeam, setEditTeam] = useState('')
  // reprocess
  const [reprocessing, setReprocessing] = useState(false)
  const [reprocessResult, setReprocessResult] = useState(null)
  // preflight
  const [preflighting, setPreflighting] = useState(false)
  const [preflightResult, setPreflightResult] = useState(null)
  const autoPreflightDone = useRef(false)
  // scan unresolved
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  // change log
  const [loadingLog, setLoadingLog] = useState(false)
  const [changeLog, setChangeLog] = useState(null)

  const refresh = useCallback(() => {
    setLoading(true)
    call('GET', `/admin/stages/${stage.id}/roster?include_unavailable=true`)
      .then(data => setRoster(Array.isArray(data) ? data : []))
      .catch(() => setRoster([]))
      .finally(() => setLoading(false))
  }, [call, stage.id])

  // Carrega mapa de times para exibir logos
  useEffect(() => {
    call('GET', '/admin/teams')
      .then(data => {
        if (!Array.isArray(data)) return
        const map = {}
        data.forEach(t => { map[t.tag] = t })
        setTeamMap(map)
      })
      .catch(() => {})
  }, [call])

  useEffect(() => { refresh() }, [refresh])

  // Auto-preflight na carga inicial — mostra banner silencioso se houver issues
  useEffect(() => {
    if (loading || autoPreflightDone.current) return
    autoPreflightDone.current = true
    call('GET', `/admin/stages/${stage.id}/roster/preflight`)
      .then(res => { if (!res.ok) setPreflightResult(res) })
      .catch(() => {})
  }, [loading, call, stage.id])

  // busca persons com debounce
  useEffect(() => {
    if (searchQ.length < 2) { setSearchResults([]); return }
    const t = setTimeout(() => {
      setSearching(true)
      call('GET', `/admin/persons?search=${encodeURIComponent(searchQ)}`)
        .then(data => setSearchResults(Array.isArray(data) ? data.slice(0, 8) : []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false))
    }, 280)
    return () => clearTimeout(t)
  }, [call, searchQ])

  const handleToggleAvailable = async (r) => {
    try {
      await call('PATCH', `/admin/stages/${stage.id}/roster/${r.id}`, { is_available: !r.is_available })
      setRoster(prev => prev.map(x => x.id === r.id ? { ...x, is_available: !r.is_available } : x))
    } catch (e) { setMsg('!' + e.message) }
  }

  const handleRemove = async (r) => {
    if (!confirm(`Remover ${r.person_name} (${r.team_name}) do roster?`)) return
    try {
      await call('DELETE', `/admin/stages/${stage.id}/roster/${r.id}`)
      setRoster(prev => prev.filter(x => x.id !== r.id))
    } catch (e) { setMsg('!' + e.message) }
  }

  const handleSaveTeam = async (r) => {
    try {
      await call('PATCH', `/admin/stages/${stage.id}/roster/${r.id}`, { team_name: editTeam || null })
      setRoster(prev => prev.map(x => x.id === r.id ? { ...x, team_name: editTeam || null } : x))
      setEditingId(null)
    } catch (e) { setMsg('!' + e.message) }
  }

  const handlePreflight = async () => {
    setPreflighting(true); setPreflightResult(null)
    try {
      const res = await call('GET', `/admin/stages/${stage.id}/roster/preflight`)
      setPreflightResult(res)
    } catch (e) { setMsg('!' + e.message) }
    finally { setPreflighting(false) }
  }

  const handleReprocessAll = async () => {
    if (!confirm(`Reprocessar TODAS as partidas do stage "${stage.name}"?\nIsso rebusca cada partida da API da PUBG e recalcula as stats com o roster atual.`)) return
    setReprocessing(true); setReprocessResult(null); setMsg('')
    try {
      const res = await call('POST', `/admin/stages/${stage.id}/reprocess-all-matches`)
      setReprocessResult(res)
      const skipped = res.players_skipped_total > 0 ? `, ${res.players_skipped_total} jogadores não resolvidos` : ''
      const errs = res.matches_errored > 0 ? `, ${res.matches_errored} erros` : ''
      setMsg(`${res.matches_ok}/${res.matches_total} partidas reprocessadas${skipped}${errs}`)
    } catch (e) { setMsg('!' + e.message) }
    finally { setReprocessing(false) }
  }

  const handleScanUnresolved = async () => {
    setScanning(true); setScanResult(null)
    try {
      const res = await call('POST', `/admin/stages/${stage.id}/scan-unresolved`, {})
      setScanResult(res)
    } catch (e) { setMsg('!' + e.message) }
    finally { setScanning(false) }
  }

  const handleLoadChanges = async () => {
    setLoadingLog(true)
    try {
      const res = await call('GET', `/admin/stages/${stage.id}/roster/changes`)
      setChangeLog(res)
    } catch (e) { setMsg('!' + e.message) }
    finally { setLoadingLog(false) }
  }

  const handleAddPlayer = async (person) => {
    if (!addTeam.trim()) { setMsg('!Informe o nome do time antes de adicionar.'); return }
    try {
      const entry = await call('POST', `/admin/stages/${stage.id}/roster`, {
        person_id: person.id,
        team_name: addTeam.trim(),
      })
      setRoster(prev => [...prev, { ...entry, person_name: person.display_name }])
      setSearchQ(''); setSearchResults([]); setMsg(`${person.display_name} adicionado.`)
    } catch (e) { setMsg('!' + e.message) }
  }

  // agrupa por time
  const byTeam = roster.reduce((acc, r) => {
    const key = r.team_name || '(sem time)'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})
  const teams = Object.keys(byTeam).sort()

  const totalAvailable = roster.filter(r => r.is_available).length
  const totalAll = roster.length

  return (
    <div style={{ padding: '18px 24px 20px', background: 'rgba(74,222,128,0.02)', borderTop: '1px solid rgba(74,222,128,0.12)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--xm-text)' }}>Roster</span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
          background: 'rgba(74,222,128,0.1)', color: 'var(--xm-green)',
          border: '1px solid rgba(74,222,128,0.3)', fontFamily: 'JetBrains Mono, monospace',
        }}>
          {teams.length} times · {totalAvailable}/{totalAll} jogadores
        </span>
        {msg && (
          <span style={{
            fontSize: 12, padding: '3px 9px', borderRadius: 6,
            background: msg.startsWith('!') ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)',
            color: msg.startsWith('!') ? '#f87171' : 'var(--xm-green)',
            border: `1px solid ${msg.startsWith('!') ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.3)'}`,
          }}>
            {msg.startsWith('!') ? msg.slice(1) : msg}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => { setMsg(''); refresh() }} style={{ fontSize: 11, color: 'var(--xm-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            ↺ Recarregar
          </button>
          <button
            onClick={handlePreflight}
            disabled={preflighting}
            style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
              background: preflighting ? 'rgba(249,115,22,0.03)' : 'rgba(249,115,22,0.08)',
              color: 'var(--xm-orange)', border: '1px solid rgba(249,115,22,0.35)',
              cursor: preflighting ? 'default' : 'pointer', transition: 'all 0.15s',
            }}
          >
            {preflighting ? '⚙ Verificando...' : '⚙ Preflight'}
          </button>
          <button
            onClick={handleReprocessAll}
            disabled={reprocessing}
            style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
              background: reprocessing ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.1)',
              color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.35)',
              cursor: reprocessing ? 'default' : 'pointer', transition: 'all 0.15s',
            }}
          >
            {reprocessing ? '⟳ Reprocessando...' : '⟳ Reprocessar Partidas'}
          </button>
          <button
            onClick={handleScanUnresolved}
            disabled={scanning}
            style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
              background: scanning ? 'rgba(239,68,68,0.03)' : 'rgba(239,68,68,0.08)',
              color: '#f87171', border: '1px solid rgba(239,68,68,0.35)',
              cursor: scanning ? 'default' : 'pointer', transition: 'all 0.15s',
            }}
          >
            {scanning ? '⚙ Verificando...' : '🔍 Scan Unresolved'}
          </button>
          <button
            onClick={handleLoadChanges}
            disabled={loadingLog}
            style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
              background: loadingLog ? 'rgba(99,102,241,0.03)' : 'rgba(99,102,241,0.08)',
              color: '#818cf8', border: '1px solid rgba(99,102,241,0.35)',
              cursor: loadingLog ? 'default' : 'pointer', transition: 'all 0.15s',
            }}
          >
            {loadingLog ? '⟳ Carregando...' : '📋 Histórico'}
          </button>
        </div>
      </div>

      {/* Resultado do preflight */}
      {preflightResult && (
        <div style={{
          marginBottom: 12, padding: '10px 14px', borderRadius: 8,
          background: preflightResult.ok ? 'rgba(74,222,128,0.05)' : 'rgba(249,115,22,0.07)',
          border: `1px solid ${preflightResult.ok ? 'rgba(74,222,128,0.25)' : 'rgba(249,115,22,0.35)'}`,
          fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (preflightResult.issues?.length > 0 || preflightResult.config_warnings?.length > 0) ? 8 : 0 }}>
            <span style={{ fontWeight: 700, color: preflightResult.ok ? 'var(--xm-green)' : 'var(--xm-orange)' }}>
              {preflightResult.ok
                ? `✓ Preflight OK — ${preflightResult.total_active} jogadores com conta ${preflightResult.shard} vinculada`
                : `⚠ ${preflightResult.issues_count} jogador${preflightResult.issues_count !== 1 ? 'es' : ''} sem conta ${preflightResult.shard} válida`
              }
            </span>
            <button onClick={() => setPreflightResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--xm-muted)', fontSize: 13 }}>✕</button>
          </div>
          {preflightResult.issues?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {preflightResult.issues.map(issue => (
                <div key={issue.roster_id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 8px', borderRadius: 6,
                  background: issue.status === 'pendente' ? 'rgba(249,115,22,0.06)' : 'rgba(239,68,68,0.06)',
                  border: `1px solid ${issue.status === 'pendente' ? 'rgba(249,115,22,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                  <span style={{ fontWeight: 700, color: issue.status === 'pendente' ? 'var(--xm-orange)' : '#f87171', minWidth: 68 }}>
                    {issue.status === 'pendente' ? 'PENDENTE' : 'SEM CONTA'}
                  </span>
                  <span style={{ color: 'var(--xm-text)', flex: 1 }}>{issue.person_name}</span>
                  <span style={{ color: 'var(--xm-muted)' }}>{issue.team_name}</span>
                  {issue.pending_ids?.length > 0 && (
                    <span style={{ color: 'rgba(249,115,22,0.6)', fontSize: 10 }}>{issue.pending_ids[0]}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {preflightResult.config_warnings?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: preflightResult.issues?.length > 0 ? 6 : 0 }}>
              {preflightResult.config_warnings.map(w => (
                <div key={w.check} style={{
                  padding: '5px 8px', borderRadius: 6,
                  background: 'rgba(234,179,8,0.06)',
                  border: '1px solid rgba(234,179,8,0.25)',
                  color: '#fbbf24',
                }}>
                  ⚠ {w.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resultado do reprocess */}
      {reprocessResult && (
        <div style={{
          marginBottom: 12, padding: '10px 14px', borderRadius: 8,
          background: reprocessResult.matches_errored > 0 ? 'rgba(239,68,68,0.07)' : 'rgba(99,102,241,0.07)',
          border: `1px solid ${reprocessResult.matches_errored > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.25)'}`,
          fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
          color: reprocessResult.matches_errored > 0 ? '#f87171' : '#a5b4fc',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {reprocessResult.matches_ok}/{reprocessResult.matches_total} partidas OK
            {reprocessResult.players_skipped_total > 0 && ` · ${reprocessResult.players_skipped_total} skippados`}
            {reprocessResult.matches_errored > 0 && ` · ${reprocessResult.matches_errored} erros`}
          </div>
          <div style={{ color: 'var(--xm-muted)', marginBottom: reprocessResult.unresolved_players?.length > 0 ? 6 : 0 }}>
            Total XAMA: {reprocessResult.total_pts?.toFixed(2)} pts
          </div>
          {reprocessResult.unresolved_players?.length > 0 && (
            <div>
              <div style={{ color: '#f87171', fontWeight: 700, marginBottom: 4 }}>
                ⚠ {reprocessResult.unresolved_players.length} alias não resolvido{reprocessResult.unresolved_players.length !== 1 ? 's' : ''} (sem conta mapeada):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {reprocessResult.unresolved_players.map(alias => (
                  <span key={alias} style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11,
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#f87171',
                  }}>{alias}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resultado do scan unresolved */}
      {scanResult && (
        <div style={{
          marginBottom: 12, padding: '10px 14px', borderRadius: 8,
          background: scanResult.unique_unresolved_players === 0 ? 'rgba(74,222,128,0.05)' : 'rgba(239,68,68,0.07)',
          border: `1px solid ${scanResult.unique_unresolved_players === 0 ? 'rgba(74,222,128,0.25)' : 'rgba(239,68,68,0.3)'}`,
          fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: scanResult.unique_unresolved_players > 0 ? 8 : 0 }}>
            <span style={{ fontWeight: 700, color: scanResult.unique_unresolved_players === 0 ? 'var(--xm-green)' : '#f87171' }}>
              {scanResult.unique_unresolved_players === 0
                ? `✓ Nenhum alias não resolvido nos últimos ${scanResult.matches_scanned} matches.`
                : `⚠ ${scanResult.unique_unresolved_players} alias${scanResult.unique_unresolved_players !== 1 ? 'es' : ''} não resolvido${scanResult.unique_unresolved_players !== 1 ? 's' : ''} (${scanResult.matches_scanned} matches escaneados)`
              }
            </span>
            <button onClick={() => setScanResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--xm-muted)', fontSize: 13 }}>✕</button>
          </div>
          {scanResult.unresolved?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {scanResult.unresolved.map(u => (
                  <span key={u.account_id} style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11,
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#f87171',
                  }} title={`account_id: ${u.account_id} | first seen: ${u.first_seen_match}`}>
                    {u.alias} <span style={{ opacity: 0.6, fontSize: 10 }}>{u.account_id.slice(0, 12)}…</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {scanResult.next_steps && (
            <div style={{ color: 'var(--xm-muted)', fontSize: 11, marginTop: 4 }}>{scanResult.next_steps}</div>
          )}
        </div>
      )}

      {/* Histórico de alterações do roster */}
      {changeLog !== null && (
        <div style={{
          marginBottom: 12, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(99,102,241,0.05)',
          border: '1px solid rgba(99,102,241,0.25)',
          fontSize: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: '#818cf8' }}>Histórico de alterações (últimas 200)</span>
            <button onClick={() => setChangeLog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--xm-muted)', fontSize: 13 }}>✕</button>
          </div>
          {changeLog.length === 0 ? (
            <div style={{ color: 'var(--xm-muted)', fontSize: 12 }}>Nenhuma alteração registrada.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {changeLog.map(log => (
                <div key={log.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                  padding: '4px 8px', borderRadius: 5,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                }}>
                  <span style={{ color: 'var(--xm-muted)', minWidth: 110, flexShrink: 0 }}>
                    {new Date(log.changed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  <span style={{ color: 'var(--xm-text)', flex: '0 0 auto', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.person_name}
                  </span>
                  <span style={{
                    padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, flexShrink: 0,
                    background: log.change_type === 'created' ? 'rgba(74,222,128,0.1)' : log.change_type === 'updated' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)',
                    color: log.change_type === 'created' ? 'var(--xm-green)' : log.change_type === 'updated' ? '#fbbf24' : '#f87171',
                    border: `1px solid ${log.change_type === 'created' ? 'rgba(74,222,128,0.3)' : log.change_type === 'updated' ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}>
                    {log.change_type.toUpperCase()}
                  </span>
                  {log.field_name && (
                    <span style={{ color: 'var(--xm-muted)', flexShrink: 0 }}>{log.field_name}:</span>
                  )}
                  {(log.old_value !== null || log.new_value !== null) && (
                    <span style={{ color: 'var(--xm-text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.old_value ?? '—'} → {log.new_value ?? '—'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--xm-muted)', marginBottom: 16 }}>Carregando...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: 20 }}>
          {teams.map(teamName => (
            <div key={teamName} style={{
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8, overflow: 'hidden',
            }}>
              {/* cabeçalho do time */}
              <div style={{
                padding: '6px 10px', background: 'rgba(255,255,255,0.04)',
                fontSize: 12, fontWeight: 700, color: 'var(--xm-orange)',
                fontFamily: 'JetBrains Mono, monospace',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <TeamLogo tag={teamName} region={teamMap[teamName]?.region} size={18} />
                  <span>{teamName}</span>
                </div>
                <span style={{ color: 'var(--xm-muted)', fontWeight: 400 }}>
                  {byTeam[teamName].filter(r => r.is_available).length}/{byTeam[teamName].length}
                </span>
              </div>
              {/* jogadores */}
              {byTeam[teamName].map(r => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px',
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                  opacity: r.is_available ? 1 : 0.45,
                }}>
                  {/* nome / edição de time */}
                  {editingId === r.id ? (
                    <input
                      autoFocus
                      value={editTeam}
                      onChange={e => setEditTeam(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveTeam(r); if (e.key === 'Escape') setEditingId(null) }}
                      style={{ ...inputStyle, fontSize: 11, padding: '2px 6px', flex: 1, height: 24 }}
                      placeholder="tag do time"
                    />
                  ) : (
                    <span
                      style={{ fontSize: 12, flex: 1, color: 'var(--xm-text)', cursor: 'default' }}
                      title={`ID pessoa: ${r.person_id}`}
                    >
                      {r.person_name}
                    </span>
                  )}

                  {/* custo */}
                  <span style={{ fontSize: 11, color: 'var(--xm-muted)', fontFamily: 'JetBrains Mono, monospace', minWidth: 28, textAlign: 'right' }}>
                    {r.effective_cost != null ? r.effective_cost : '—'}
                  </span>

                  {/* ações */}
                  {editingId === r.id ? (
                    <>
                      <button onClick={() => handleSaveTeam(r)} title="Salvar" style={iconBtnStyle('#4ade80')}>✓</button>
                      <button onClick={() => setEditingId(null)} title="Cancelar" style={iconBtnStyle('#9ca3af')}>✕</button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setEditingId(r.id); setEditTeam(r.team_name || '') }}
                        title="Editar time"
                        style={iconBtnStyle('var(--xm-muted)')}
                      >✎</button>
                      <button
                        onClick={() => handleToggleAvailable(r)}
                        title={r.is_available ? 'Desativar' : 'Ativar'}
                        style={iconBtnStyle(r.is_available ? 'var(--xm-green)' : '#6b7280')}
                      >{r.is_available ? '●' : '○'}</button>
                      <button
                        onClick={() => handleRemove(r)}
                        title="Remover do roster"
                        style={iconBtnStyle('#f87171')}
                      >✕</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Adicionar jogador */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--xm-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Adicionar jogador
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '0 0 240px' }} ref={searchRef}>
            <input
              style={{ ...inputStyle, width: '100%' }}
              placeholder="Buscar por nome..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
            {(searchResults.length > 0 || searching) && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: '#1a1d2a', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6, marginTop: 2, overflow: 'hidden',
              }}>
                {searching && <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--xm-muted)' }}>Buscando...</div>}
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleAddPlayer(p)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 12px', background: 'none', border: 'none',
                      fontSize: 12, color: 'var(--xm-text)', cursor: 'pointer',
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    {p.display_name}
                    {p.id && <span style={{ color: 'var(--xm-muted)', marginLeft: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>#{p.id}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            style={{ ...inputStyle, flex: '0 0 120px' }}
            placeholder="Tag do time"
            value={addTeam}
            onChange={e => setAddTeam(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

const iconBtnStyle = (color) => ({
  background: 'none', border: 'none', cursor: 'pointer',
  color, fontSize: 13, padding: '0 2px', lineHeight: 1,
  opacity: 0.7, transition: 'opacity 0.1s',
})

// ── Painel de importação de times ─────────────────────────────────────────────

function ImportPanel({ stage, stages, token }) {
  const call = useCallback(api(token), [token])
  const [sourceId, setSourceId] = useState('')
  const [sourceTeams, setSourceTeams] = useState([])
  const [targetTeamNames, setTargetTeamNames] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loadingSource, setLoadingSource] = useState(false)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState('')

  // Carrega times já no roster destino
  const refreshTarget = useCallback(() => {
    call('GET', `/admin/stages/${stage.id}/roster/teams`)
      .then(data => setTargetTeamNames(data.map(t => t.team_name)))
      .catch(() => {})
  }, [call, stage.id])

  useEffect(() => { refreshTarget() }, [refreshTarget])

  // Carrega times da stage de origem quando selecionada
  useEffect(() => {
    if (!sourceId) { setSourceTeams([]); setSelected(new Set()); return }
    setLoadingSource(true)
    call('GET', `/admin/stages/${sourceId}/roster/teams`)
      .then(data => { setSourceTeams(data); setSelected(new Set()) })
      .catch(() => setSourceTeams([]))
      .finally(() => setLoadingSource(false))
  }, [call, sourceId])

  const toggle = (name) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(name)) { next.delete(name) } else { next.add(name) }
    return next
  })

  const selectAll = () => {
    const notYetIn = sourceTeams.filter(t => !targetTeamNames.includes(t.team_name))
    setSelected(new Set(notYetIn.map(t => t.team_name)))
  }

  const handleImport = async () => {
    if (!selected.size) return
    setImporting(true); setMsg('')
    try {
      const res = await call('POST', `/admin/stages/${stage.id}/roster/copy-from-stage`, {
        source_stage_id: parseInt(sourceId),
        team_names: [...selected],
      })
      setMsg(`${res.added_teams} times importados — ${res.added_players} jogadores adicionados` +
        (res.skipped_players ? `, ${res.skipped_players} já existiam` : ''))
      setSelected(new Set())
      refreshTarget()
    } catch (e) {
      setMsg('!' + e.message)
    } finally {
      setImporting(false)
    }
  }

  const newCount = selected.size
  const availableToSelect = sourceTeams.filter(t => !targetTeamNames.includes(t.team_name))

  return (
    <div style={{
      padding: '18px 24px 20px',
      background: 'rgba(249,115,22,0.03)',
      borderTop: '1px solid rgba(249,115,22,0.15)',
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--xm-text)' }}>
          Importar Times
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
          background: targetTeamNames.length >= 16 ? 'rgba(74,222,128,0.12)' : 'rgba(249,115,22,0.12)',
          color: targetTeamNames.length >= 16 ? 'var(--xm-green)' : 'var(--xm-orange)',
          border: `1px solid ${targetTeamNames.length >= 16 ? 'rgba(74,222,128,0.3)' : 'rgba(249,115,22,0.3)'}`,
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {targetTeamNames.length} / 16 times no roster
        </span>
      </div>

      {/* Seletor de stage de origem */}
      <div style={{ maxWidth: 440, marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--xm-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Stage de origem
        </label>
        <SearchableSelect
          value={sourceId}
          onChange={setSourceId}
          options={[
            { value: '', label: 'Selecione uma stage...' },
            ...stages.filter(s => s.id !== stage.id).map(s => ({ value: String(s.id), label: `${s.id} — ${s.name}` })),
          ]}
          placeholder="Buscar stage de origem..."
        />
      </div>

      {/* Lista de times */}
      {loadingSource && (
        <div style={{ fontSize: 13, color: 'var(--xm-muted)', marginBottom: 12 }}>Carregando times...</div>
      )}
      {sourceTeams.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--xm-muted)' }}>
              {sourceTeams.length} times na stage de origem
            </span>
            {availableToSelect.length > 0 && (
              <button
                onClick={selectAll}
                style={{ fontSize: 11, color: 'var(--xm-orange)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                selecionar todos disponíveis
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 7, marginBottom: 16 }}>
            {sourceTeams.map(t => {
              const alreadyIn = targetTeamNames.includes(t.team_name)
              const isSel = selected.has(t.team_name)
              return (
                <label
                  key={t.team_name}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '8px 11px', borderRadius: 8,
                    cursor: alreadyIn ? 'default' : 'pointer',
                    border: `1px solid ${alreadyIn ? 'rgba(74,222,128,0.3)' : isSel ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.07)'}`,
                    background: alreadyIn ? 'rgba(74,222,128,0.05)' : isSel ? 'rgba(249,115,22,0.07)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.12s',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={alreadyIn || isSel}
                    disabled={alreadyIn}
                    onChange={() => !alreadyIn && toggle(t.team_name)}
                    style={{ accentColor: 'var(--xm-orange)', width: 14, height: 14, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13, flex: 1, color: alreadyIn ? 'var(--xm-green)' : 'var(--xm-text)' }}>
                    {t.team_name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--xm-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {alreadyIn ? '✓' : `${t.player_count}j`}
                  </span>
                </label>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <ActBtn onClick={handleImport} disabled={!newCount || importing}>
              {importing ? 'Importando...' : newCount > 0 ? `Importar ${newCount} time${newCount !== 1 ? 's' : ''}` : 'Selecione times'}
            </ActBtn>
            {msg && (
              <span style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 6,
                background: msg.startsWith('!') ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)',
                color: msg.startsWith('!') ? '#f87171' : 'var(--xm-green)',
                border: `1px solid ${msg.startsWith('!') ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.3)'}`,
              }}>
                {msg.startsWith('!') ? msg.slice(1) : msg}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Seatlon Assignment Panel ───────────────────────────────────────────────────

const SYNC_INTERVALS = [5, 15, 30, 60, 120]

function SeatlonPanel({ token, stages, onAssigned }) {
  const call = useCallback(api(token), [token])
  const [unassigned, setUnassigned] = useState(null)
  const [loadingIds, setLoadingIds] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [selectedStage, setSelectedStage] = useState({})
  const [assigning, setAssigning] = useState(null)
  const [assignErr, setAssignErr] = useState({})

  // Sync config modal state
  const [syncTarget, setSyncTarget] = useState(null) // { tournamentId, stageId, stageName }
  const [syncForm, setSyncForm] = useState({ intervalMin: 15, useRunFrom: false, runFrom: '', runUntil: '', notes: '' })
  const [creatingSync, setCreatingSync] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const load = useCallback(async () => {
    setLoadingIds(true)
    try {
      const data = await call('GET', '/admin/seatlon/unassigned')
      setUnassigned(data.unassigned || [])
      if ((data.count || 0) > 0) setExpanded(true)
    } catch { setUnassigned([]) }
    finally { setLoadingIds(false) }
  }, [call])

  useEffect(() => { load() }, [load])

  const handleAssign = async (t) => {
    const stageId = selectedStage[t.tournament_id]
    if (!stageId) return
    setAssigning(t.tournament_id)
    setAssignErr(prev => ({ ...prev, [t.tournament_id]: '' }))
    try {
      await call('PATCH', `/admin/stages/${stageId}`, { pubg_tournament_id: t.tournament_id })
      const stageName = stages.find(s => String(s.id) === String(stageId))?.name || `Stage #${stageId}`
      setSyncTarget({ tournamentId: t.tournament_id, stageId, stageName })
      setSyncForm({ intervalMin: 15, useRunFrom: false, runFrom: '', runUntil: '', notes: '' })
      setSyncMsg('')
      await load()
      onAssigned?.()
    } catch (e) {
      setAssignErr(prev => ({ ...prev, [t.tournament_id]: e.message }))
    } finally { setAssigning(null) }
  }

  const handleCreateSync = async () => {
    if (!syncForm.runUntil) { setSyncMsg('!Defina o horário de término do sync.'); return }
    setCreatingSync(true); setSyncMsg('')
    try {
      await call('POST', '/admin/stage-sync', {
        stage_id: parseInt(syncTarget.stageId),
        tournament_id: syncTarget.tournamentId,
        interval_min: syncForm.intervalMin,
        run_from: syncForm.useRunFrom && syncForm.runFrom ? localInputToUtc(syncForm.runFrom) : null,
        run_until: localInputToUtc(syncForm.runUntil),
        notes: syncForm.notes?.trim() || null,
      })
      setSyncMsg('ok')
      setTimeout(() => setSyncTarget(null), 1200)
    } catch (e) { setSyncMsg('!' + e.message) }
    finally { setCreatingSync(false) }
  }

  if (unassigned === null) return null
  if (unassigned.length === 0 && !loadingIds) return null

  const stagesWithoutId = stages.filter(s => !s.pubg_tournament_id)
  const sf = k => e => setSyncForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <>
      <div style={{ marginBottom: 16, border: '1px solid rgba(234,179,8,0.35)', borderRadius: 10, background: 'rgba(234,179,8,0.04)' }}>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--xm-text)', textAlign: 'left' }}
        >
          <span style={{ color: '#eab308', fontSize: 15 }}>⚠</span>
          <strong style={{ color: '#eab308', fontSize: 13 }}>
            {loadingIds ? '…' : `${unassigned.length} tournament ID${unassigned.length !== 1 ? 's' : ''} não atribuído${unassigned.length !== 1 ? 's' : ''}`}
          </strong>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--xm-muted)' }}>{expanded ? '▼' : '▶'}</span>
        </button>

        {expanded && (
          <div style={{ padding: '0 16px 14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Tournament ID', 'Matches', 'Criado em', 'Atribuir a Stage', ''].map(h => (
                    <th key={h} style={{ ...thStyle, textAlign: h === 'Matches' || h === 'Criado em' ? 'center' : 'left', padding: '6px 10px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unassigned.map(t => (
                  <tr key={t.tournament_id}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#eab308', padding: '7px 10px' }}>{t.tournament_id}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', padding: '7px 10px' }}>{t.matches_count}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--xm-muted)', padding: '7px 10px' }}>{t.pubg_created_at || '—'}</td>
                    <td style={{ ...tdStyle, padding: '7px 10px' }}>
                      <select
                        style={{ ...selectStyle, width: '100%', fontSize: 12 }}
                        value={selectedStage[t.tournament_id] || ''}
                        onChange={e => setSelectedStage(prev => ({ ...prev, [t.tournament_id]: e.target.value }))}
                      >
                        <option value="">Selecione stage…</option>
                        {stagesWithoutId.map(s => (
                          <option key={s.id} value={s.id}>#{s.id} — {s.name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ ...tdStyle, padding: '7px 10px', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => handleAssign(t)}
                        disabled={!selectedStage[t.tournament_id] || assigning === t.tournament_id}
                        style={{
                          background: selectedStage[t.tournament_id] ? '#4ade80' : '#374151',
                          color: selectedStage[t.tournament_id] ? '#000' : '#6b7280',
                          border: 'none', borderRadius: 6, padding: '5px 12px',
                          cursor: selectedStage[t.tournament_id] ? 'pointer' : 'default',
                          fontSize: 12, fontWeight: 700,
                        }}
                      >
                        {assigning === t.tournament_id ? '…' : 'Atribuir'}
                      </button>
                      {assignErr[t.tournament_id] && (
                        <span style={{ marginLeft: 6, color: '#f87171', fontSize: 11 }}>{assignErr[t.tournament_id]}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 11, color: 'var(--xm-muted)', marginTop: 8, marginBottom: 0 }}>
              Stages sem tournament ID aparecem no seletor. Após atribuir, um modal pergunta se quer configurar sync automático.
            </p>
          </div>
        )}
      </div>

      {/* Modal de configuração de sync pós-atribuição */}
      {syncTarget && (
        <Modal
          title={`Sync automático — ${syncTarget.tournamentId}`}
          onClose={() => setSyncTarget(null)}
          width={520}
        >
          <div style={{ fontSize: 13, color: 'var(--xm-muted)', marginBottom: 16 }}>
            Tournament ID atribuído a <strong style={{ color: 'var(--xm-text)' }}>{syncTarget.stageName}</strong>.
            Configure um scheduler para buscar partidas e atualizar stats automaticamente.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Intervalo entre runs">
              <select style={selectStyle} value={syncForm.intervalMin} onChange={sf('intervalMin')}>
                {SYNC_INTERVALS.map(m => (
                  <option key={m} value={m}>{m} minutos</option>
                ))}
              </select>
            </Field>
            <Field label="Parar em (horário local)">
              <input style={inputStyle} type="datetime-local" value={syncForm.runUntil} onChange={sf('runUntil')} />
            </Field>
          </div>

          <Field label="">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={syncForm.useRunFrom}
                onChange={e => setSyncForm(p => ({ ...p, useRunFrom: e.target.checked }))}
              />
              Início diferido (janela futura — ex: Final em 2 dias)
            </label>
          </Field>

          {syncForm.useRunFrom && (
            <Field label="Iniciar em (horário local)">
              <input style={inputStyle} type="datetime-local" value={syncForm.runFrom} onChange={sf('runFrom')} />
            </Field>
          )}

          <Field label="Observação (opcional)">
            <input style={inputStyle} value={syncForm.notes} onChange={sf('notes')} placeholder="ex: WS Final D2" />
          </Field>

          {syncMsg === 'ok' && (
            <div style={{ color: '#4ade80', fontSize: 13, marginBottom: 8 }}>Sync criado com sucesso.</div>
          )}
          {syncMsg.startsWith('!') && (
            <div style={{ color: '#f87171', fontSize: 13, marginBottom: 8 }}>{syncMsg.slice(1)}</div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <SaveBtn loading={creatingSync} onClick={handleCreateSync} label="Criar Sync" />
            <button
              onClick={() => setSyncTarget(null)}
              style={{ background: 'transparent', border: '1px solid var(--xm-border)', color: 'var(--xm-muted)', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13 }}
            >
              Pular (sem sync)
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Sync Schedules Panel ───────────────────────────────────────────────────────

const STATUS_COLOR = {
  pending:   '#a78bfa',
  active:    '#4ade80',
  completed: '#6b7280',
  cancelled: '#f87171',
}

function SyncSchedulesPanel({ token }) {
  const call = useCallback(api(token), [token])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [running, setRunning] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [editingUntil, setEditingUntil] = useState(null) // schedule id
  const [newUntil, setNewUntil] = useState('')
  const [actionMsg, setActionMsg] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await call('GET', '/admin/stage-sync')
      setSchedules(Array.isArray(data) ? data : [])
    } catch { setSchedules([]) }
    finally { setLoading(false) }
  }, [call])

  useEffect(() => { load() }, [load])

  const active = schedules.filter(s => s.status === 'pending' || s.status === 'active')

  if (schedules.length === 0 && !loading) return null

  const handleRunNow = async (s) => {
    setRunning(s.id); setActionMsg(p => ({ ...p, [s.id]: '' }))
    try {
      const r = await call('POST', `/admin/stage-sync/${s.id}/run-now`)
      setActionMsg(p => ({ ...p, [s.id]: `ok run#${r.runs_count}` }))
      await load()
    } catch (e) { setActionMsg(p => ({ ...p, [s.id]: '!' + e.message })) }
    finally { setRunning(null) }
  }

  const handleCancel = async (s) => {
    if (!confirm(`Cancelar sync #${s.id} (${s.tournament_id})?`)) return
    setCancelling(s.id)
    try {
      await call('POST', `/admin/stage-sync/${s.id}/cancel`)
      await load()
    } catch (e) { setActionMsg(p => ({ ...p, [s.id]: '!' + e.message })) }
    finally { setCancelling(null) }
  }

  const handleSaveUntil = async (s) => {
    if (!newUntil) return
    try {
      await call('PATCH', `/admin/stage-sync/${s.id}`, { run_until: localInputToUtc(newUntil) })
      setEditingUntil(null)
      await load()
    } catch (e) { setActionMsg(p => ({ ...p, [s.id]: '!' + e.message })) }
  }

  const fmtDt = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'

  return (
    <div style={{ marginBottom: 16, border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, background: 'rgba(99,102,241,0.03)' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--xm-text)', textAlign: 'left' }}
      >
        <span style={{ color: '#a78bfa', fontSize: 14 }}>⏱</span>
        <strong style={{ color: '#a78bfa', fontSize: 13 }}>
          {loading ? '…' : `Sync Schedulers — ${active.length} ativo${active.length !== 1 ? 's' : ''} / ${schedules.length} total`}
        </strong>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--xm-muted)' }}>{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 14px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
            <thead>
              <tr>
                {['#', 'Stage', 'Tournament ID', 'Intervalo', 'Início', 'Fim', 'Último run', 'Runs', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ ...thStyle, padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s.id} style={{ opacity: s.status === 'cancelled' ? 0.5 : 1 }}>
                  <td style={{ ...tdStyle, padding: '7px 8px', color: 'var(--xm-muted)' }}>{s.id}</td>
                  <td style={{ ...tdStyle, padding: '7px 8px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.stage_name || `#${s.stage_id}`}</td>
                  <td style={{ ...tdStyle, padding: '7px 8px', fontFamily: 'monospace', color: '#eab308' }}>{s.tournament_id}</td>
                  <td style={{ ...tdStyle, padding: '7px 8px', textAlign: 'center' }}>{s.interval_min}min</td>
                  <td style={{ ...tdStyle, padding: '7px 8px', color: 'var(--xm-muted)', whiteSpace: 'nowrap' }}>{s.run_from ? fmtDt(s.run_from) : 'imediato'}</td>
                  <td style={{ ...tdStyle, padding: '7px 8px', whiteSpace: 'nowrap' }}>
                    {editingUntil === s.id ? (
                      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type="datetime-local"
                          style={{ ...inputStyle, padding: '2px 6px', fontSize: 11, width: 160 }}
                          value={newUntil}
                          onChange={e => setNewUntil(e.target.value)}
                        />
                        <button onClick={() => handleSaveUntil(s)} style={{ background: '#4ade80', color: '#000', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>✓</button>
                        <button onClick={() => setEditingUntil(null)} style={{ background: 'transparent', border: 'none', color: 'var(--xm-muted)', cursor: 'pointer', fontSize: 11 }}>✕</button>
                      </span>
                    ) : (
                      <span
                        onClick={() => s.status !== 'completed' && s.status !== 'cancelled' && (setEditingUntil(s.id), setNewUntil(utcToLocalInput(s.run_until)))}
                        style={{ cursor: s.status === 'active' || s.status === 'pending' ? 'pointer' : 'default', textDecoration: s.status === 'active' || s.status === 'pending' ? 'underline dotted' : 'none' }}
                        title={s.status === 'active' || s.status === 'pending' ? 'Clique para editar' : ''}
                      >
                        {fmtDt(s.run_until)}
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, padding: '7px 8px', color: 'var(--xm-muted)', whiteSpace: 'nowrap' }}>{fmtDt(s.last_run_at)}</td>
                  <td style={{ ...tdStyle, padding: '7px 8px', textAlign: 'center' }}>{s.runs_count}</td>
                  <td style={{ ...tdStyle, padding: '7px 8px' }}>
                    <span style={{ color: STATUS_COLOR[s.status] || '#fff', fontWeight: 600, fontSize: 11 }}>{s.status}</span>
                  </td>
                  <td style={{ ...tdStyle, padding: '7px 8px', whiteSpace: 'nowrap' }}>
                    {(s.status === 'pending' || s.status === 'active') && (
                      <>
                        <button
                          onClick={() => handleRunNow(s)}
                          disabled={running === s.id}
                          style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700, marginRight: 5 }}
                        >
                          {running === s.id ? '…' : 'Run Now'}
                        </button>
                        <button
                          onClick={() => handleCancel(s)}
                          disabled={cancelling === s.id}
                          style={{ background: 'transparent', border: '1px solid #f87171', color: '#f87171', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}
                        >
                          {cancelling === s.id ? '…' : 'Cancelar'}
                        </button>
                      </>
                    )}
                    {actionMsg[s.id]?.startsWith('ok') && (
                      <span style={{ color: '#4ade80', fontSize: 11, marginLeft: 4 }}>{actionMsg[s.id]}</span>
                    )}
                    {actionMsg[s.id]?.startsWith('!') && (
                      <span style={{ color: '#f87171', fontSize: 11, marginLeft: 4 }}>{actionMsg[s.id].slice(1)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {schedules.some(s => s.notes) && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--xm-muted)' }}>
              {schedules.filter(s => s.notes).map(s => (
                <div key={s.id}><strong>#{s.id}:</strong> {s.notes}</div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 11, color: 'var(--xm-muted)', marginTop: 6, marginBottom: 0 }}>
            O scheduler roda a cada 5 min. "Fim" sublinhado = clique para editar. Stage precisa ter stage_days com match_schedule configurado.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function AdminStages({ token }) {
  const call = useCallback(api(token), [token])

  const [stages, setStages] = useState([])
  const [championships, setChampionships] = useState([])
  const [champFilter, setChampFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusChanging, setStatusChanging] = useState(null) // stage id
  // expandedStage: { id, panel: 'roster' | 'import' } | null
  const [expandedStage, setExpandedStage]     = useState(null)
  const [finishedExpanded, setFinishedExpanded] = useState(false)

  const togglePanel = (stageId, panel) => {
    setExpandedStage(prev =>
      prev?.id === stageId && prev?.panel === panel ? null : { id: stageId, panel }
    )
  }

  const { sort: stSort, toggle: stToggle, apply: stApply } = useSorting('id', 'desc')

  const loadChampionships = useCallback(async () => {
    try {
      const data = await call('GET', '/admin/championships?include_inactive=true')
      setChampionships(Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [])
    } catch {}
  }, [call])

  const loadStages = useCallback(async () => {
    setLoading(true)
    try {
      const params = champFilter ? `?championship_id=${champFilter}` : ''
      const data = await call('GET', `/admin/stages${params}`)
      setStages(Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [])
    } catch { setStages([]) }
    finally { setLoading(false) }
  }, [call, champFilter])

  useEffect(() => { loadChampionships() }, [loadChampionships])
  useEffect(() => { loadStages() }, [loadStages])

  const openCreate = () => {
    setForm({ ...BLANK, championship_id: champFilter || '' })
    setMsg(''); setModal({ mode: 'create' })
  }
  const openEdit = (s) => {
    setForm({
      championship_id: s.championship_id,
      name: s.name, short_name: s.short_name || '', shard: s.shard,
      lineup_status: s.lineup_status,
      stage_phase: s.stage_phase ?? 'upcoming',
      lineup_open_at: utcToLocalInput(s.lineup_open_at),
      lineup_close_at: utcToLocalInput(s.lineup_close_at),
      start_date: utcToLocalInput(s.start_date),
      end_date: utcToLocalInput(s.end_date),
      lineup_size: s.lineup_size ?? 4,
      captain_multiplier: s.captain_multiplier ?? 1.3,
      price_min: s.price_min ?? 12,
      price_max: s.price_max ?? 35,
      pubg_tournament_id: s.pubg_tournament_id || '',
      independent_lineups: s.independent_lineups ?? false,
    })
    setMsg(''); setModal({ mode: 'edit', data: s })
  }

  const handleSave = async () => {
    setSaving(true); setMsg('')
    try {
      const body = {
        ...form,
        championship_id: parseInt(form.championship_id),
        lineup_size: parseInt(form.lineup_size),
        captain_multiplier: parseFloat(form.captain_multiplier),
        price_min: parseFloat(form.price_min),
        price_max: parseFloat(form.price_max),
        lineup_open_at: localInputToUtc(form.lineup_open_at),
        lineup_close_at: localInputToUtc(form.lineup_close_at),
        start_date: localInputToUtc(form.start_date),
        end_date: localInputToUtc(form.end_date),
        pubg_tournament_id: form.pubg_tournament_id?.trim() || null,
      }
      if (modal.mode === 'create') {
        await call('POST', '/admin/stages', body)
        setMsg('Stage criada.')
        setModal(null)
      } else {
        await call('PATCH', `/admin/stages/${modal.data.id}`, body)
        setMsg('Stage atualizada.')
      }
      await loadStages()
    } catch (e) { setMsg('!' + e.message) }
    finally { setSaving(false) }
  }

  const changeLineupStatus = async (stage, newStatus) => {
    setStatusChanging(stage.id + '_lineup')
    try {
      await call('PATCH', `/admin/stages/${stage.id}`, { lineup_status: newStatus })
      await loadStages()
    } catch (e) { alert('Erro: ' + e.message) }
    finally { setStatusChanging(null) }
  }

  const changePhase = async (stage, newPhase) => {
    setStatusChanging(stage.id + '_phase')
    try {
      await call('PATCH', `/admin/stages/${stage.id}`, { stage_phase: newPhase })
      await loadStages()
    } catch (e) { alert('Erro: ' + e.message) }
    finally { setStatusChanging(null) }
  }

  const champName = (id) => championships.find(c => c.id === id)?.short_name || id
  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div>
      <SectionHeader
        title="Stages"
        action={<ActBtn onClick={openCreate}>+ Nova Stage</ActBtn>}
      />

      {/* Filtro por championship */}
      <SearchableSelect
        value={champFilter}
        onChange={setChampFilter}
        options={[
          { value: '', label: 'Todos os championships' },
          ...championships.map(c => ({ value: String(c.id), label: c.name })),
        ]}
        placeholder="Filtrar por championship..."
        style={{ maxWidth: 320, marginBottom: 14 }}
      />

      <SeatlonPanel token={token} stages={stages} onAssigned={loadStages} />
      <SyncSchedulesPanel token={token} />

      <div style={{ background: 'rgba(18,21,28,0.9)', border: '1px solid var(--xm-border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--xm-muted)' }}>Carregando...</div>
        ) : stages.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--xm-muted)' }}>Nenhuma stage encontrada.</div>
        ) : (() => {
          const sorted = stApply(stages, {
            id: s => s.id,
            champ: s => champName(s.championship_id),
            name: s => s.name,
            start: s => s.start_date || s.lineup_open_at || '',
            status: s => s.lineup_status,
          })
          const activeStages   = sorted.filter(s => s.stage_phase !== 'finished')
          const finishedStages = sorted.filter(s => s.stage_phase === 'finished')

          const renderRow = (s, dimmed = false) => (
            <Fragment key={s.id}>
              <tr style={dimmed ? { opacity: 0.55 } : {}}>
                <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--xm-muted)' }}>{s.id}</td>
                <td style={{ ...tdStyle, color: 'var(--xm-muted)', fontSize: 12 }}>{champName(s.championship_id)}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{s.name}</td>
                <td style={{ ...tdStyle, color: 'var(--xm-muted)', fontSize: 12 }}>{fmtDate(s.start_date || s.lineup_open_at)}</td>
                <td style={tdStyle}>
                  <select
                    value={s.lineup_status}
                    disabled={!!statusChanging}
                    onChange={e => changeLineupStatus(s, e.target.value)}
                    style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                      fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
                      border: '1px solid rgba(249,115,22,0.35)',
                      background: 'rgba(249,115,22,0.08)', color: 'var(--xm-orange)',
                      outline: 'none', colorScheme: 'dark',
                    }}
                  >
                    {LINEUP_STATUS_OPTIONS.map(st => <option key={st} value={st}>{st.toUpperCase()}</option>)}
                  </select>
                </td>
                <td style={tdStyle}>
                  <select
                    value={s.stage_phase ?? 'upcoming'}
                    disabled={!!statusChanging}
                    onChange={e => changePhase(s, e.target.value)}
                    style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                      fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
                      border: '1px solid rgba(99,102,241,0.4)',
                      background: 'rgba(99,102,241,0.08)', color: '#a5b4fc',
                      outline: 'none', colorScheme: 'dark',
                    }}
                  >
                    {STAGE_PHASE_OPTIONS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                  </select>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <ActBtn
                      small
                      onClick={() => togglePanel(s.id, 'roster')}
                      style={expandedStage?.id === s.id && expandedStage?.panel === 'roster'
                        ? { borderColor: 'rgba(74,222,128,0.5)', color: 'var(--xm-green)' } : {}}
                    >
                      {expandedStage?.id === s.id && expandedStage?.panel === 'roster' ? '▲ Roster' : 'Roster'}
                    </ActBtn>
                    <ActBtn
                      small
                      onClick={() => togglePanel(s.id, 'import')}
                      style={expandedStage?.id === s.id && expandedStage?.panel === 'import'
                        ? { borderColor: 'rgba(249,115,22,0.6)', color: 'var(--xm-orange)' } : {}}
                    >
                      {expandedStage?.id === s.id && expandedStage?.panel === 'import' ? '▲ Importar' : '↓ Importar'}
                    </ActBtn>
                    <ActBtn small onClick={() => openEdit(s)}>Editar</ActBtn>
                  </div>
                </td>
              </tr>
              {expandedStage?.id === s.id && (
                <tr>
                  <td colSpan={6} style={{ padding: 0, borderBottom: '1px solid var(--xm-border)' }}>
                    {expandedStage.panel === 'roster'
                      ? <RosterPanel stage={s} token={token} />
                      : <ImportPanel stage={s} stages={stages} token={token} />
                    }
                  </td>
                </tr>
              )}
            </Fragment>
          )

          return (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <SortableHeader label="ID" col="id" sort={stSort} onSort={stToggle} />
                  <SortableHeader label="Champ." col="champ" sort={stSort} onSort={stToggle} />
                  <SortableHeader label="Nome" col="name" sort={stSort} onSort={stToggle} />
                  <SortableHeader label="Início" col="start" sort={stSort} onSort={stToggle} />
                  <SortableHeader label="Lineup" col="status" sort={stSort} onSort={stToggle} />
                  <th style={thStyle}>Fase</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {activeStages.map(s => renderRow(s, false))}

                {finishedStages.length > 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <button
                        onClick={() => setFinishedExpanded(p => !p)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 16px', background: 'rgba(255,255,255,0.02)',
                          border: 'none', borderTop: '1px solid var(--xm-border)',
                          cursor: 'pointer', color: 'var(--xm-muted)', fontSize: 12,
                          fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                        }}
                      >
                        <span style={{ fontSize: 10 }}>{finishedExpanded ? '▼' : '▶'}</span>
                        {finishedStages.length} stage{finishedStages.length !== 1 ? 's' : ''} finalizadas
                      </button>
                    </td>
                  </tr>
                )}

                {finishedExpanded && finishedStages.map(s => renderRow(s, true))}
              </tbody>
            </table>
          )
        })()}
      </div>

      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'Nova Stage' : `Editar — ${modal.data?.name}`}
          onClose={() => setModal(null)}
          width={620}
        >
          <Msg msg={msg} />

          <Field label="Championship">
            <SearchableSelect
              value={String(form.championship_id)}
              onChange={v => setForm(prev => ({ ...prev, championship_id: v }))}
              options={[
                { value: '', label: 'Selecione...' },
                ...championships.map(c => ({ value: String(c.id), label: c.name })),
              ]}
              placeholder="Buscar championship..."
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Field label="Nome">
              <input style={inputStyle} value={form.name} onChange={f('name')} placeholder="ex: PAS1 2026 - Day 1" />
            </Field>
            <Field label="Short name">
              <input style={inputStyle} value={form.short_name} onChange={f('short_name')} placeholder="ex: D1" />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Shard">
              <select style={selectStyle} value={form.shard} onChange={f('shard')}>
                <option value="steam">steam</option>
                <option value="pc-tournament">pc-tournament</option>
              </select>
            </Field>
            <Field label="Lineup Status">
              <select style={selectStyle} value={form.lineup_status} onChange={f('lineup_status')}>
                {LINEUP_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Fase (dashboard)">
              <select style={selectStyle} value={form.stage_phase ?? 'upcoming'} onChange={f('stage_phase')}>
                {STAGE_PHASE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Tournament ID (PUBG API)">
            <input
              style={inputStyle}
              value={form.pubg_tournament_id}
              onChange={f('pubg_tournament_id')}
              placeholder="ex: as-pgs4ws — deixe vazio para remover"
            />
          </Field>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              type="checkbox"
              checked={!!form.independent_lineups}
              onChange={e => setForm(p => ({ ...p, independent_lineups: e.target.checked }))}
              style={{ accentColor: 'var(--xm-orange)', width: 16, height: 16 }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Lineups independentes por dia</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Finals multi-dia: cada StageDay exige escalação própria, sem replicação automática do dia anterior.</div>
            </div>
          </label>

          {/* Badge de timezone + hint */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px' }}>
            <span style={{ fontSize: 15, flexShrink: 0 }}>🕐</span>
            <div style={{ fontSize: 11, color: 'var(--xm-muted)', lineHeight: 1.6 }}>
              <span style={{ color: '#a5b4fc', fontWeight: 700 }}>Fuso detectado: {detectTzLabel()}</span>
              <br />
              Todos os horários abaixo devem ser inseridos no <strong style={{ color: 'var(--xm-text)' }}>seu fuso local</strong> — a conversão para UTC é feita automaticamente ao salvar.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Lineup abre em (quando users podem montar)">
              <input style={inputStyle} type="datetime-local" value={form.lineup_open_at} onChange={f('lineup_open_at')} />
            </Field>
            <Field label="Lineup fecha em (prazo final de edição)">
              <input style={inputStyle} type="datetime-local" value={form.lineup_close_at} onChange={f('lineup_close_at')} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Data/hora da 1ª partida">
              <input style={inputStyle} type="datetime-local" value={form.start_date} onChange={f('start_date')} />
            </Field>
            <Field label="Data/hora da última partida">
              <input style={inputStyle} type="datetime-local" value={form.end_date} onChange={f('end_date')} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Field label="Jogadores (lineup_size)">
              <input style={inputStyle} type="number" min="1" max="10" value={form.lineup_size} onChange={f('lineup_size')} />
            </Field>
            <Field label="Mult. capitão">
              <input style={inputStyle} type="number" step="0.05" min="1" max="3" value={form.captain_multiplier} onChange={f('captain_multiplier')} />
            </Field>
            <Field label="Preço mín.">
              <input style={inputStyle} type="number" min="1" value={form.price_min} onChange={f('price_min')} />
            </Field>
            <Field label="Preço máx.">
              <input style={inputStyle} type="number" min="1" value={form.price_max} onChange={f('price_max')} />
            </Field>
          </div>

          <SaveBtn loading={saving} onClick={handleSave} label={modal.mode === 'create' ? 'Criar Stage' : 'Salvar'} />
        </Modal>
      )}
    </div>
  )
}
