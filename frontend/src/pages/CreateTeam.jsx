import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPlayers } from '../api/players'
import { getTournaments } from '../api/tournaments'
import { createTeam, addPlayerToTeam } from '../api/fantasyTeams'
import { useToast } from '../components/Toast'
import PlayerCard from '../components/PlayerCard'
import TeamBudgetBar from '../components/TeamBudgetBar'
import LoadingSpinner from '../components/LoadingSpinner'

const TOTAL_BUDGET = 500
const MAX_PLAYERS = 8

export default function CreateTeam() {
  const toast = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState(1) // 1: setup, 2: pick players, 3: review
  const [teamName, setTeamName] = useState('')
  const [selectedTournament, setSelectedTournament] = useState('')

  const [players, setPlayers] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [search, setSearch] = useState('')
  const [regionFilter, setRegionFilter] = useState('ALL')

  useEffect(() => {
    Promise.all([
      getPlayers().catch(() => []),
      getTournaments().catch(() => []),
    ]).then(([p, t]) => {
      setPlayers(Array.isArray(p) ? p : [])
      setTournaments(Array.isArray(t) ? t : [])
    }).finally(() => setLoadingData(false))
  }, [])

  const spent = useMemo(() =>
    selectedPlayers.reduce((sum, p) => sum + (p.price || 0), 0),
    [selectedPlayers]
  )
  const remaining = TOTAL_BUDGET - spent

  const filteredPlayers = useMemo(() => {
    let result = [...players]
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        (p.name || p.username || '').toLowerCase().includes(q) ||
        (p.team || '').toLowerCase().includes(q)
      )
    }
    if (regionFilter !== 'ALL') {
      result = result.filter(p => (p.region || '').toUpperCase() === regionFilter)
    }
    return result.sort((a, b) => (b.price || 0) - (a.price || 0))
  }, [players, search, regionFilter])

  const regions = useMemo(() => {
    const r = new Set(players.map(p => p.region).filter(Boolean).map(r => r.toUpperCase()))
    return ['ALL', ...Array.from(r).sort()]
  }, [players])

  const togglePlayer = (player) => {
    const isSelected = selectedPlayers.some(p => p.id === player.id)
    if (isSelected) {
      setSelectedPlayers(prev => prev.filter(p => p.id !== player.id))
    } else {
      if (selectedPlayers.length >= MAX_PLAYERS) {
        toast.warning(`Max ${MAX_PLAYERS} players per team.`)
        return
      }
      if (spent + (player.price || 0) > TOTAL_BUDGET) {
        toast.error(`Not enough budget! Need ${player.price}cr, have ${remaining}cr.`)
        return
      }
      setSelectedPlayers(prev => [...prev, player])
    }
  }

  const handleSubmit = async () => {
    if (!teamName.trim()) {
      toast.error('Please enter a team name.')
      return
    }
    if (!selectedTournament) {
      toast.error('Please select a tournament.')
      return
    }
    if (selectedPlayers.length === 0) {
      toast.error('Please add at least one player.')
      return
    }

    setSubmitting(true)
    try {
      const team = await createTeam({
        name: teamName.trim(),
        tournament_id: parseInt(selectedTournament),
      })

      // Add players sequentially
      for (const player of selectedPlayers) {
        try {
          await addPlayerToTeam(team.id, player.id)
        } catch (e) {
          console.warn(`Failed to add player ${player.id}`, e)
        }
      }

      toast.success(`Team "${teamName}" created!`)
      navigate(`/teams/${team.id}`)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to create team.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <LoadingSpinner size="lg" text="Loading data..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px w-8 bg-accent" />
            <span className="font-mono text-xs text-accent uppercase tracking-widest">Team Builder</span>
          </div>
          <h1 className="section-title">CREATE <span>YOUR TEAM</span></h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {['Setup', 'Pick Players', 'Review'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 cursor-pointer`} onClick={() => step > i + 1 && setStep(i + 1)}>
                <div className={`w-7 h-7 flex items-center justify-center font-mono text-xs font-bold
                                 transition-all duration-200
                                 ${step === i + 1 ? 'bg-accent text-bg' : step > i + 1 ? 'bg-success text-bg' : 'border border-muted text-muted'}`}
                     style={{ clipPath: 'polygon(3px 0%, 100% 0%, calc(100% - 3px) 100%, 0% 100%)' }}>
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                <span className={`font-display font-bold text-sm uppercase tracking-wide hidden sm:block
                                  ${step === i + 1 ? 'text-white' : step > i + 1 ? 'text-success' : 'text-muted'}`}>
                  {label}
                </span>
              </div>
              {i < 2 && <div className={`h-px w-8 ${step > i + 1 ? 'bg-success' : 'bg-border-color'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Setup */}
        {step === 1 && (
          <div className="max-w-lg animate-fade-in">
            <div className="card p-6 space-y-5">
              <div>
                <label className="block font-display font-bold uppercase text-xs tracking-widest text-text-secondary mb-2">
                  Team Name
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  placeholder="e.g. Chicken Dinner Kings"
                  className="input-field"
                  maxLength={40}
                />
              </div>

              <div>
                <label className="block font-display font-bold uppercase text-xs tracking-widest text-text-secondary mb-2">
                  Tournament
                </label>
                <select
                  value={selectedTournament}
                  onChange={e => setSelectedTournament(e.target.value)}
                  className="input-field bg-bg cursor-pointer"
                >
                  <option value="">— Select tournament —</option>
                  {tournaments.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.region ? `[${t.region}]` : ''} — {t.status || 'upcoming'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="card p-4 border-accent/20 bg-accent-dim/30">
                <h4 className="font-display font-bold uppercase text-sm text-accent mb-2">Budget Rules</h4>
                <ul className="space-y-1 font-body text-sm text-text-secondary">
                  <li>• Total budget: <span className="text-white font-semibold">500 credits</span></li>
                  <li>• Max players: <span className="text-white font-semibold">{MAX_PLAYERS}</span></li>
                  <li>• Prices based on transparent formula</li>
                  <li>• Mix stars + value picks for best ROI</li>
                </ul>
              </div>

              <button
                onClick={() => {
                  if (!teamName.trim()) { toast.error('Enter a team name.'); return }
                  if (!selectedTournament) { toast.error('Select a tournament.'); return }
                  setStep(2)
                }}
                className="btn-primary w-full text-center"
              >
                Next: Pick Players →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Pick players */}
        {step === 2 && (
          <div className="animate-fade-in">
            {/* Budget bar */}
            <div className="mb-4">
              <TeamBudgetBar spent={spent} maxBudget={TOTAL_BUDGET} />
            </div>

            {/* Selected summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-white">
                  <span className="text-accent font-bold">{selectedPlayers.length}</span>/{MAX_PLAYERS} players
                </span>
                {selectedPlayers.length > 0 && (
                  <div className="flex -space-x-1">
                    {selectedPlayers.slice(0, 5).map(p => (
                      <div
                        key={p.id}
                        className="w-7 h-7 bg-accent-dim border border-accent flex items-center justify-center text-[10px] font-display font-bold text-accent"
                        title={p.name || p.username}
                      >
                        {(p.name || p.username || '?')[0].toUpperCase()}
                      </div>
                    ))}
                    {selectedPlayers.length > 5 && (
                      <div className="w-7 h-7 bg-muted/20 border border-muted flex items-center justify-center text-[10px] font-mono text-muted">
                        +{selectedPlayers.length - 5}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="btn-ghost text-xs">← Back</button>
                <button
                  onClick={() => setStep(3)}
                  disabled={selectedPlayers.length === 0}
                  className="btn-primary text-xs"
                >
                  Review Team →
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="card p-3 mb-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search players..."
                  className="input-field pl-10 py-2"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {regions.map(r => (
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

            {/* Player grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredPlayers.map(player => {
                const isSelected = selectedPlayers.some(p => p.id === player.id)
                const canAfford = remaining >= (player.price || 0)
                const atMax = selectedPlayers.length >= MAX_PLAYERS
                const disabled = !isSelected && (!canAfford || atMax)

                return (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    isSelected={isSelected}
                    showSelect
                    disabled={disabled}
                    onSelect={togglePlayer}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="max-w-2xl animate-fade-in">
            <div className="card p-6 mb-4">
              <h2 className="font-display font-black uppercase text-2xl text-white mb-1">{teamName}</h2>
              <p className="font-mono text-xs text-muted mb-4">
                {tournaments.find(t => t.id === parseInt(selectedTournament))?.name}
              </p>

              <TeamBudgetBar spent={spent} maxBudget={TOTAL_BUDGET} />
            </div>

            {/* Players list */}
            <div className="card p-4 mb-4">
              <h3 className="font-display font-bold uppercase text-lg text-white mb-3 tracking-wide">
                Selected Players ({selectedPlayers.length})
              </h3>
              <div className="space-y-2">
                {selectedPlayers.map(player => (
                  <div key={player.id} className="flex items-center justify-between py-2 border-b border-border-color/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-accent-dim border border-accent/30 flex items-center justify-center font-display font-bold text-accent text-sm"
                           style={{ clipPath: 'polygon(3px 0%, 100% 0%, calc(100% - 3px) 100%, 0% 100%)' }}>
                        {(player.name || player.username || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-display font-bold text-white text-sm uppercase">
                          {player.name || player.username}
                        </div>
                        <div className="font-mono text-xs text-muted">{player.team || player.region}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="price-badge text-xs">{player.price}cr</span>
                      <button
                        onClick={() => setSelectedPlayers(prev => prev.filter(p => p.id !== player.id))}
                        className="text-muted hover:text-danger transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-3 mt-1">
                <span className="font-mono text-sm text-text-secondary uppercase tracking-wider">Total spent</span>
                <span className="font-mono font-bold text-accent">{spent} / {TOTAL_BUDGET} credits</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn-ghost flex-1">
                ← Edit Roster
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || spent > TOTAL_BUDGET}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Creating...</span>
                  </>
                ) : (
                  '🎯 Create Team'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
