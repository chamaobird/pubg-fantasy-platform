import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const FEATURES = [
  {
    icon: '🌍',
    title: 'Regional Tournaments',
    desc: 'NA, EU, APAC, BR, CIS — compete in YOUR region, not just global events. Support for scrims and qualifier rounds.',
    tag: 'vs Twire: Only global',
  },
  {
    icon: '📊',
    title: 'Transparent Pricing',
    desc: 'Every player price is calculated from visible stats. See exactly why a player costs what they cost — kills, damage, placement, survival.',
    tag: 'vs Twire: Black box pricing',
  },
  {
    icon: '⚡',
    title: 'Live Scrims Support',
    desc: 'Fantasy leagues for scrimmage matches and qualifiers. Get the edge before the pros even hit the main stage.',
    tag: 'vs Twire: No scrim support',
  },
  {
    icon: '💸',
    title: 'Budget Strategy',
    desc: '500 credit budget. Mix stars and value picks. The formula is open — master it to win.',
    tag: 'Fair & open formula',
  },
]

const STATS = [
  { value: '12+', label: 'Regions Supported' },
  { value: '100%', label: 'Transparent Pricing' },
  { value: '0', label: 'Hidden Fees' },
  { value: '∞', label: 'Scrim Leagues' },
]

export default function Landing() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-30" />

        {/* Diagonal accent bar */}
        <div
          className="absolute top-0 right-0 w-1/3 h-full opacity-5"
          style={{
            background: 'linear-gradient(135deg, transparent 40%, #f5a623 40%)',
          }}
        />

        {/* Scan line effect */}
        <div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent"
          style={{ top: '30%' }}
        />
        <div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent"
          style={{ top: '70%' }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-32 pt-40">
          <div className="max-w-4xl">
            {/* Label */}
            <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
              <div className="h-px w-12 bg-accent" />
              <span className="font-mono text-xs text-accent uppercase tracking-[0.3em]">
                PUBG Fantasy Platform
              </span>
              <div className="h-px w-12 bg-accent" />
            </div>

            {/* Main headline */}
            <h1 className="font-display font-black uppercase text-white mb-6 animate-fade-in-up stagger-1"
                style={{ fontSize: 'clamp(3rem, 8vw, 7rem)', lineHeight: 0.9 }}>
              FANTASY
              <br />
              <span className="text-gradient">THAT SHOWS</span>
              <br />
              ITS WORK.
            </h1>

            {/* Subhead */}
            <p className="font-body text-text-secondary text-xl max-w-xl mb-8 animate-fade-in-up stagger-2"
               style={{ fontWeight: 500 }}>
              The only PUBG fantasy platform with{' '}
              <span className="text-white font-semibold">transparent pricing</span>,{' '}
              <span className="text-white font-semibold">regional leagues</span>, and{' '}
              <span className="text-white font-semibold">scrim support</span>.
              No black boxes. No excuses.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 mb-12 animate-fade-in-up stagger-3">
              {isAuthenticated ? (
                <>
                  <Link to="/dashboard" className="btn-primary text-base">
                    Go to Dashboard
                  </Link>
                  <Link to="/players" className="btn-secondary text-base">
                    Browse Players
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/register" className="btn-primary text-base">
                    Start for Free
                  </Link>
                  <Link to="/tournaments" className="btn-secondary text-base">
                    View Tournaments
                  </Link>
                </>
              )}
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-in-up stagger-4">
              {STATS.map((s) => (
                <div key={s.label} className="border border-border-color p-3 bg-card/50">
                  <div className="font-display font-black text-2xl text-accent glow-accent">{s.value}</div>
                  <div className="font-mono text-[10px] text-text-secondary uppercase tracking-wider mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-bg to-transparent" />
      </section>

      {/* "What Twire gets wrong" section */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-8 bg-accent" />
              <span className="font-mono text-xs text-accent uppercase tracking-widest">Why Switch</span>
            </div>
            <h2 className="section-title">BUILT FOR <span>REAL</span> PLAYERS</h2>
            <p className="text-text-secondary mt-3 font-body max-w-xl">
              We looked at what existing platforms get wrong and built the opposite.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={`card p-6 hover:border-accent/50 hover:bg-card-hover transition-all duration-300
                            animate-fade-in-up`}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl flex-shrink-0">{f.icon}</div>
                  <div>
                    <h3 className="font-display font-bold text-xl text-white uppercase tracking-wide mb-2">
                      {f.title}
                    </h3>
                    <p className="text-text-secondary text-sm mb-3">{f.desc}</p>
                    <span className="font-mono text-xs text-accent/70 uppercase tracking-wider border border-accent/20 px-2 py-0.5">
                      {f.tag}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Price Formula callout */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-card/30" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px w-8 bg-accent" />
                <span className="font-mono text-xs text-accent uppercase tracking-widest">Open Formula</span>
              </div>
              <h2 className="section-title mb-4">NO <span>HIDDEN</span> MATH</h2>
              <p className="text-text-secondary font-body mb-6">
                Every player's price is derived from a public formula. You can see the exact calculation,
                understand why expensive players cost more, and build smarter teams.
              </p>
              <Link to="/players" className="btn-primary">
                See Player Prices
              </Link>
            </div>

            {/* Formula card */}
            <div className="card p-6 font-mono text-sm border-accent/40">
              <div className="text-accent font-bold mb-4 text-xs uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                Price Calculation Engine
              </div>
              <div className="space-y-1 text-text-secondary">
                <div className="text-muted text-xs mb-2">// Visible formula. Always.</div>
                <div><span className="text-green-400">kills_avg</span> × <span className="text-accent">2.0</span> = kills score</div>
                <div><span className="text-orange-400">damage_avg</span> × <span className="text-accent">0.05</span> = damage score</div>
                <div><span className="text-yellow-400">placement</span> × <span className="text-accent">3.0</span> = placement score</div>
                <div><span className="text-blue-400">survival_min</span> × <span className="text-accent">0.1</span> = survival score</div>
                <div className="mt-3 pt-3 border-t border-border-color">
                  <span className="text-white">total_score</span> = base(<span className="text-accent">10</span>) + all scores
                </div>
                <div>
                  <span className="text-accent font-bold">price_credits</span> = total_score ÷ <span className="text-accent">2</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border-color flex justify-between text-xs">
                <span className="text-muted uppercase tracking-wider">Result range</span>
                <span className="text-accent font-bold">1 – 100 credits</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-display font-black uppercase text-white mb-6"
              style={{ fontSize: 'clamp(2rem, 5vw, 4rem)' }}>
            READY TO <span className="text-gradient">DOMINATE</span>?
          </h2>
          <p className="text-text-secondary font-body text-lg mb-8 max-w-md mx-auto">
            Register free, pick your regional tournament, and build your fantasy roster in minutes.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {isAuthenticated ? (
              <Link to="/create-team" className="btn-primary text-lg px-10 py-4">
                Create a Team
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn-primary text-lg px-10 py-4">
                  Create Free Account
                </Link>
                <Link to="/login" className="btn-secondary text-lg px-10 py-4">
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-color py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="font-display font-black text-lg text-white tracking-wide">
            WARZONE <span className="text-accent">FANTASY</span>
          </div>
          <p className="font-mono text-xs text-muted text-center">
            Not affiliated with PUBG Corporation. Fan-made fantasy platform.
          </p>
          <div className="flex gap-4">
            <Link to="/tournaments" className="font-mono text-xs text-muted hover:text-accent transition-colors uppercase">Tournaments</Link>
            <Link to="/players" className="font-mono text-xs text-muted hover:text-accent transition-colors uppercase">Players</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
