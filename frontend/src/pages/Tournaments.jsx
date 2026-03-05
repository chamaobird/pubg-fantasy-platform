import { useState, useEffect } from 'react'
import { getTournaments, createTournament } from '../api/tournaments'
import { recalculatePrices } from '../api/fantasyTeams'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import TournamentCard from '../components/TournamentCard'
import LoadingSpinner from '../components/LoadingSpinner'

const REGIONS = ['ALL', 'NA', 'EU', 'EMEA', 'APAC', 'BR', 'SA', 'CIS', 'KR', 'GLOBAL']
const STATUS_FILTERS = ['ALL', 'upcoming', 'live', 'finished']
const TOURNAMENT_TYPES = ['regional', 'scrims', 'qualifier', 'global', 'weekly']

export default function Tournaments() {
  const { isAuthenticated } = useAuth()
  const toast = useToast()

  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [regionFilter, setRegionFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [recalcLoading, setRecalcLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    region: 'NA',
    type: 'regional',
    status: 'upcoming',
    start_date: '',
    end_date: '',
    prize_pool: '',
    description: '',
  })
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    fetchTournaments()
  }, [])

  const fetchTournaments = async () => {
    try {
      const data = await getTournaments()
      setTournaments(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Failed to load tournaments.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = tournaments.filter(t => {
    const matchRegion = regionFilter === 'ALL' || (t.region || '').toUpperCase() === regionFilter
    const matchStatus = statusFilter === 'ALL' || (t.status || '').toLowerCase() === statusFilter.toLowerCase()
    return matchRegion && matchStatus
  })

  const handleFormChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Tournament name is required.')
      return
    }

    setFormLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        region: form.region,
        type: form.type,
        status: form.status,
        description: form.description || undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        prize_pool: form.prize_pool ? parseFloat(form.prize_pool) : undefined,
      }
      await createTournament(payload)
      toast.success(`Tournament "${form.name}" created!`)
      setShowCreateForm(false)
      setForm({ name: '', region: 'NA', type: 'regional', status: 'upcoming', start_date: '', end_date: '', prize_pool: '', description: '' })
      fetchTournaments()
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail || 'Failed to create tournament.'
      toast.error(msg)
    } finally {
      setFormLoading(false)
    }
  }

  const handleRecalcPrices = async () => {
    setRecalcLoading(true)
    try {
      await recalculatePrices()
      toast.success('Player prices recalculated!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to recalculate prices.')
    } finally {
      setRecalcLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px w-8 bg-accent" />
              <span className="font-mono text-xs text-accent uppercase tracking-widest">Competition</span>
            </div>
            <h1 className="section-title">TOURNAMENTS</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isAuthenticated && (
              <>
                <button
                  onClick={handleRecalcPrices}
                  disabled={recalcLoading}
                  className="btn-ghost text-xs flex items-center gap-1"
                >
                  {recalcLoading ? <LoadingSpinner size="sm" /> : '🔄'}
                  Recalc Prices
                </button>
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className={showCreateForm ? 'btn-ghost text-xs' : 'btn-primary text-xs'}
                >
                  {showCreateForm ? '✕ Cancel' : '+ Create Tournament'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div className="card p-6 mb-6 border-accent/40 animate-fade-in">
            <h2 className="font-display font-bold uppercase text-xl text-white mb-4 tracking-wide">
              New Tournament
            </h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block font-display font-bold uppercase text-xs tracking-widest text-text-secondary mb-2">
                  Tournament Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="e.g. PUBG NA Regional — Spring 2025"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block font-display font-bold uppercase text-xs tracking-widest text-text-secondary mb-2">
                  Region
                </label>
                <select name="region" value={form.region} onChange={handleFormChange} className="input-field bg-bg cursor-pointer">
                  {REGIONS.filter(r => r !== 'ALL').map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-display font-bold uppercase text-xs tracking-widest text-text-secondary mb-2">
                  Type
                </label>
                <select name="type" value={form.type} onChange={handleFormChange} className="input-field bg-bg cursor-pointer">
                  {TOURNAMENT_TYPES.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-display font-bold uppercase text-xs tracking-widest text-text-secondary mb-2">
                  Status
                </label>
                <select name="status" value={form.status} onChange={handleFormChange} className="input-field bg-bg cursor-pointer">
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="finished">Finished</option>
                </select>
              </div>

              <div>
                <label className="block font-display font-bold uppercase text-xs tracking-widest text-text-secondary mb-2">
                  Prize Pool (USD)
                </label>
                <input
                  type="number"
                  name="prize_pool"
                  value={form.prize_pool}
                  onChange={handleFormChange}
                  placeholder="10000"
                  className="input-field"
                  min="0"
                />
              </div>

              <div>
                <label className="block font-display font-bold uppercase text-xs tracking-widest text-text-secondary mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={handleFormChange}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block font-display font-bold uppercase text-xs tracking-widest text-text-secondary mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={form.end_date}
                  onChange={handleFormChange}
                  className="input-field"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-display font-bold uppercase text-xs tracking-widest text-text-secondary mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  placeholder="Tournament details..."
                  className="input-field h-20 resize-none"
                />
              </div>

              <div className="sm:col-span-2 flex gap-3">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="btn-primary flex items-center gap-2"
                >
                  {formLoading ? <><LoadingSpinner size="sm" /> Creating...</> : '+ Create Tournament'}
                </button>
                <button type="button" onClick={() => setShowCreateForm(false)} className="btn-ghost">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">Region</p>
              <div className="flex flex-wrap gap-1.5">
                {REGIONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setRegionFilter(r)}
                    className={`region-tag border text-xs transition-all duration-150 cursor-pointer
                                ${regionFilter === r
                                  ? 'border-accent text-accent bg-accent-dim'
                                  : 'border-muted text-muted hover:border-accent/50 hover:text-accent/70'
                                }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:border-l sm:border-border-color sm:pl-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`region-tag border text-xs transition-all duration-150 cursor-pointer uppercase
                                ${statusFilter === s
                                  ? 'border-accent text-accent bg-accent-dim'
                                  : 'border-muted text-muted hover:border-accent/50 hover:text-accent/70'
                                }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-xs text-muted uppercase tracking-wider">
            {filtered.length} tournament{filtered.length !== 1 ? 's' : ''} found
          </span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <LoadingSpinner size="lg" text="Loading tournaments..." />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-3">🏆</div>
            <h2 className="font-display font-bold uppercase text-xl text-white mb-2">No tournaments found</h2>
            <p className="text-text-secondary font-body">
              {isAuthenticated ? 'Create the first tournament using the button above!' : 'Check back later or adjust your filters.'}
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(t => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
