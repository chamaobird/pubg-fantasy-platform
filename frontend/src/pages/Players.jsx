import { useState, useEffect, useMemo } from 'react'
import { getPlayers } from '../api/players'
import PlayerCard from '../components/PlayerCard'
import LoadingSpinner from '../components/LoadingSpinner'

const REGIONS = ['ALL', 'NA', 'EU', 'EMEA', 'APAC', 'BR', 'SA', 'CIS', 'KR', 'GLOBAL']
const SORT_OPTIONS = [
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'kills_desc', label: 'Kills: High → Low' },
  { value: 'damage_desc', label: 'Damage: High → Low' },
  { value: 'name_asc', label: 'Name: A → Z' },
]

export default function Players() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('ALL')
  const [sort, setSort] = useState('price_desc')
  const [viewMode, setViewMode] = useState('grid')

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const data = await getPlayers()
        setPlayers(Array.isArray(data) ? data : [])
      } catch (err) {
        setError('Failed to load players. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchPlayers()
  }, [])

  const filtered = useMemo(() => {
    let result = [...players]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        (p.name || p.username || '').toLowerCase().includes(q) ||
        (p.team || '').toLowerCase().includes(q)
      )
    }

    if (region !== 'ALL') {
      result = result.filter(p =>
        (p.region || '').toUpperCase() === region.toUpperCase()
      )
    }

    result.sort((a, b) => {
      switch (sort) {
        case 'price_desc': return (b.price || 0) - (a.price || 0)
        case 'price_asc': return (a.price || 0) - (b.price || 0)
        case 'kills_desc': return (b.kills_avg || b.avg_kills || 0) - (a.kills_avg || a.avg_kills || 0)
        case 'damage_desc': return (b.damage_avg || b.avg_damage || 0) - (a.damage_avg || a.avg_damage || 0)
        case 'name_asc': return (a.name || a.username || '').localeCompare(b.name || b.username || '')
        default: return 0
      }
    })

    return result
  }, [players, search, region, sort])

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px w-8 bg-accent" />
            <span className="font-mono text-xs text-accent uppercase tracking-widest">Roster</span>
          </div>
          <h1 className="section-title">
            ALL <span>PLAYERS</span>
          </h1>
          <p className="text-text-secondary font-body mt-2">
            {players.length} players • Prices calculated from live stats
          </p>
        </div>

        {/* Filters bar */}
        <div className="card p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search player or team..."
                className="input-field pl-10"
              />
            </div>

            {/* Sort */}
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="input-field sm:w-52 bg-bg cursor-pointer"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* View toggle */}
            <div className="flex border border-border-color">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 transition-colors ${viewMode === 'grid' ? 'bg-accent-dim text-accent' : 'text-muted hover:text-white'}`}
                title="Grid view"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 transition-colors ${viewMode === 'table' ? 'bg-accent-dim text-accent' : 'text-muted hover:text-white'}`}
                title="Table view"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          {/* Region filter */}
          <div className="flex flex-wrap gap-2 mt-3">
            {REGIONS.map(r => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className={`region-tag border text-xs transition-all duration-150 cursor-pointer
                            ${region === r
                              ? 'border-accent text-accent bg-accent-dim'
                              : 'border-muted text-muted hover:border-accent/50 hover:text-accent/70'
                            }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-xs text-muted uppercase tracking-wider">
            {filtered.length} players found
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <LoadingSpinner size="lg" text="Loading players..." />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card p-6 border-danger/40 text-center">
            <p className="text-danger font-body">{error}</p>
            <button onClick={() => window.location.reload()} className="btn-secondary mt-4 text-xs">
              Retry
            </button>
          </div>
        )}

        {/* Grid view */}
        {!loading && !error && viewMode === 'grid' && (
          filtered.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="font-display font-bold uppercase text-white text-xl mb-2">No players found</h3>
              <p className="text-text-secondary text-sm">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(player => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>
          )
        )}

        {/* Table view */}
        {!loading && !error && viewMode === 'table' && (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-color">
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted">Player</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted">Region</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-red-400">K/G</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-orange-400">DMG</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-yellow-400">PLACE</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-green-400">SURV</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-accent">PRICE</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((player, i) => (
                  <tr
                    key={player.id}
                    className={`border-b border-border-color/50 hover:bg-card-hover transition-colors
                                ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-display font-bold text-white uppercase tracking-wide">
                        {player.name || player.username}
                      </div>
                      {player.team && (
                        <div className="font-mono text-xs text-muted">{player.team}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="region-tag border border-muted text-muted text-xs">
                        {player.region || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-red-400">
                      {(player.kills_avg || player.avg_kills || 0).toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-orange-400">
                      {Math.round(player.damage_avg || player.avg_damage || 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-yellow-400">
                      #{(player.placement_avg || player.avg_placement || 0).toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-green-400">
                      {(player.survival_time_avg || player.avg_survival_time || 0).toFixed(0)}m
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="price-badge text-xs">{player.price || 0}cr</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
