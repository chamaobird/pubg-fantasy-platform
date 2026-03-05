const TOTAL_BUDGET = 500

export default function TeamBudgetBar({ spent = 0, maxBudget = TOTAL_BUDGET }) {
  const remaining = maxBudget - spent
  const pct = Math.min(100, (spent / maxBudget) * 100)
  const isNearLimit = pct > 80
  const isOverBudget = spent > maxBudget

  const barColor = isOverBudget
    ? 'bg-danger'
    : isNearLimit
      ? 'bg-accent animate-pulse-glow'
      : 'bg-accent'

  return (
    <div className="card p-4">
      {/* Labels */}
      <div className="flex justify-between items-center mb-2">
        <span className="font-display font-bold uppercase text-sm tracking-wider text-text-secondary">
          Budget
        </span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted">
            {spent}cr spent
          </span>
          <span className={`font-mono font-bold text-sm ${isOverBudget ? 'text-danger' : isNearLimit ? 'text-accent' : 'text-success'}`}>
            {remaining}cr left
          </span>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-3 bg-bg border border-border-color overflow-hidden">
        {/* Fill */}
        <div
          className={`h-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
        {/* Tick marks */}
        {[25, 50, 75].map(tick => (
          <div
            key={tick}
            className="absolute top-0 bottom-0 w-px bg-border-color"
            style={{ left: `${tick}%` }}
          />
        ))}
      </div>

      {/* Budget breakdown */}
      <div className="flex justify-between mt-1">
        <span className="font-mono text-[10px] text-muted">0</span>
        <span className="font-mono text-[10px] text-muted">{maxBudget / 2}</span>
        <span className="font-mono text-[10px] text-muted">{maxBudget}</span>
      </div>

      {isOverBudget && (
        <p className="mt-2 text-danger font-display font-bold text-xs uppercase tracking-wider animate-pulse">
          ⚠ Over budget — remove a player
        </p>
      )}
    </div>
  )
}
