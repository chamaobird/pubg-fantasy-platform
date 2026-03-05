import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTeams } from '../api/fantasyTeams'
import { getTournaments } from '../api/tournaments'
import LoadingSpinner from '../components/LoadingSpinner'
import TournamentCard from '../components/TournamentCard'

export default function Dashboard() {
  const { user } = useAuth()
  const [teams, setTeams] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsData, tournamentsData] = await Promise.all([
          getTeams().catch(() => []),
          getTournaments().catch(() => []),
        ])
        setTeams(Array.isArray(teamsData) ? teamsData : [])
        setTournaments(Array.isArray(tournamentsData) ? tournamentsData.slice(0, 3) : [])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Page header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px w-8 bg-accent" />
            <span className="font-mono text-xs text-accent uppercase tracking-widest">Command Center</span>
          </div>
          <h1 className="section-title">
            WELCOME BACK,{' '}
            <span>{user?.username?.toUpperCase() || 'COMMANDER'}</span>
          </h1>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard
            label="Fantasy Teams"
            value={teams.length}
            icon="🎯"
            link="/my-teams"
            linkText="View All"
          />
          <StatCard
            label="Tournaments"
            value={tournaments.length}
            icon="🏆"
            link="/tournaments"
            linkText="Browse"
          />
          <StatCard
            label="Budget Available"
            value="500cr"
            icon="💰"
            link="/create-team"
            linkText="Create Team"
          />
          <StatCard
            label="Active Leagues"
            value={tournaments.filter(t => t.status === 'live' || t.status === 'active').length}
            icon="⚡"
            link="/tournaments"
            linkText="Go Live"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Teams */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold uppercase text-xl text-white tracking-wide">
                My Fantasy Teams
              </h2>
              <Link to="/create-team" className="btn-primary text-xs py-2">
                + New Team
              </Link>
            </div>

            {teams.length === 0 ? (
              <EmptyState
                icon="🎮"
                title="No teams yet"
                desc="Create your first fantasy team to get started."
                actionLabel="Create Team"
                actionTo="/create-team"
              />
            ) : (
              <div className="space-y-3">
                {teams.map(team => (
                  <TeamRow key={team.id} team={team} />
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Tournaments */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold uppercase text-xl text-white tracking-wide">
                Tournaments
              </h2>
              <Link to="/tournaments" className="font-mono text-xs text-accent hover:text-white transition-colors uppercase">
                View all →
              </Link>
            </div>

            {tournaments.length === 0 ? (
              <EmptyState
                icon="🏆"
                title="No tournaments"
                desc="No tournaments available yet."
                actionLabel="Check Later"
                actionTo="/tournaments"
              />
            ) : (
              <div className="space-y-3">
                {tournaments.map(t => (
                  <TournamentCard key={t.id} tournament={t} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <QuickAction
            icon="👥"
            title="Browse Players"
            desc="Check stats and prices for all registered players."
            to="/players"
          />
          <QuickAction
            icon="🏆"
            title="View Tournaments"
            desc="Regional and global tournaments available now."
            to="/tournaments"
          />
          <QuickAction
            icon="📊"
            title="Leaderboards"
            desc="See where your teams rank across all tournaments."
            to="/tournaments"
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, link, linkText }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <Link to={link} className="font-mono text-[10px] text-accent hover:text-white transition-colors uppercase tracking-wider">
          {linkText} →
        </Link>
      </div>
      <div className="font-display font-black text-3xl text-white">{value}</div>
      <div className="font-mono text-xs text-text-secondary uppercase tracking-wider mt-1">{label}</div>
    </div>
  )
}

function TeamRow({ team }) {
  const playerCount = team.players?.length || 0
  const budget = team.budget_remaining ?? (500 - (team.total_spent || 0))

  return (
    <Link to={`/teams/${team.id}`} className="card p-4 flex items-center justify-between group hover:border-accent/50 hover:bg-card-hover transition-all duration-200">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 border border-border-color flex items-center justify-center bg-bg group-hover:border-accent/40 transition-colors"
             style={{ clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)' }}>
          <span className="font-display font-black text-accent text-sm">
            {(team.name || 'T')[0].toUpperCase()}
          </span>
        </div>
        <div>
          <h3 className="font-display font-bold text-white uppercase tracking-wide group-hover:text-accent transition-colors">
            {team.name}
          </h3>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="font-mono text-xs text-muted">{playerCount}/8 players</span>
            {team.tournament_name && (
              <span className="font-mono text-xs text-text-secondary">{team.tournament_name}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="font-mono text-sm text-accent font-bold">{budget}cr</div>
          <div className="font-mono text-[10px] text-muted uppercase">remaining</div>
        </div>
        <svg className="w-4 h-4 text-muted group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}

function EmptyState({ icon, title, desc, actionLabel, actionTo }) {
  return (
    <div className="card p-8 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="font-display font-bold uppercase text-white text-xl mb-2">{title}</h3>
      <p className="text-text-secondary text-sm font-body mb-4">{desc}</p>
      <Link to={actionTo} className="btn-primary text-xs">{actionLabel}</Link>
    </div>
  )
}

function QuickAction({ icon, title, desc, to }) {
  return (
    <Link
      to={to}
      className="card p-5 flex items-start gap-4 hover:border-accent/50 hover:bg-card-hover transition-all duration-200 group"
    >
      <div className="text-2xl">{icon}</div>
      <div>
        <h3 className="font-display font-bold uppercase text-white tracking-wide group-hover:text-accent transition-colors">
          {title}
        </h3>
        <p className="font-body text-text-secondary text-sm mt-1">{desc}</p>
      </div>
    </Link>
  )
}
