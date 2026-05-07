// dashboard-parts.jsx — pedaços do Dashboard XAMA
const { useState, useEffect } = React

// ── Hero HUD SVG (radar concêntrico + ticks) ──────────────────────────────
function HeroHud() {
  return (
    <svg className="dash-hero-hud-svg" width="100%" height="100%" viewBox="0 0 800 360" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="hud-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(249,115,22,0.18)"/>
          <stop offset="60%" stopColor="rgba(249,115,22,0.05)"/>
          <stop offset="100%" stopColor="rgba(249,115,22,0)"/>
        </radialGradient>
        <linearGradient id="hud-line" x1="0" x2="1">
          <stop offset="0" stopColor="rgba(249,115,22,0)"/>
          <stop offset="0.4" stopColor="rgba(249,115,22,0.55)"/>
          <stop offset="1" stopColor="rgba(249,115,22,0)"/>
        </linearGradient>
      </defs>

      <g transform="translate(640, 180)" opacity="0.85">
        {/* radar circles */}
        <circle r="160" fill="none" stroke="rgba(249,115,22,0.12)" strokeWidth="1"/>
        <circle r="120" fill="none" stroke="rgba(249,115,22,0.16)" strokeWidth="1" strokeDasharray="2 4"/>
        <circle r="80"  fill="none" stroke="rgba(249,115,22,0.22)" strokeWidth="1"/>
        <circle r="40"  fill="none" stroke="rgba(249,115,22,0.3)"  strokeWidth="1" strokeDasharray="2 3"/>
        <circle r="160" fill="url(#hud-grad)" />
        {/* ticks */}
        {Array.from({length: 36}).map((_,i) => {
          const a = (i * 10) * Math.PI / 180
          const r1 = 160, r2 = i % 3 === 0 ? 152 : 156
          const x1 = Math.cos(a)*r1, y1 = Math.sin(a)*r1
          const x2 = Math.cos(a)*r2, y2 = Math.sin(a)*r2
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(249,115,22,0.4)" strokeWidth="1"/>
        })}
        {/* sweep line */}
        <line x1="0" y1="0" x2="160" y2="0" stroke="url(#hud-line)" strokeWidth="1.5">
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="9s" repeatCount="indefinite"/>
        </line>
        {/* center dot */}
        <circle r="3" fill="#f97316"/>
        <circle r="6" fill="none" stroke="rgba(249,115,22,0.4)" strokeWidth="1"/>
        {/* coordinate readout */}
        <text x="-176" y="-176" fill="rgba(249,115,22,0.55)" fontFamily="JetBrains Mono, monospace" fontSize="9" letterSpacing="2">P.01.X / 26.05</text>
        <text x="-176" y="184"  fill="rgba(249,115,22,0.4)"  fontFamily="JetBrains Mono, monospace" fontSize="9" letterSpacing="2">SECTOR 04</text>
        <text x="100"  y="184"  fill="rgba(249,115,22,0.4)"  fontFamily="JetBrains Mono, monospace" fontSize="9" letterSpacing="2">N: 82°</text>
      </g>

      {/* progress bars decorativos */}
      <g transform="translate(560, 60)" opacity="0.55">
        <text x="0" y="0" fill="rgba(249,115,22,0.55)" fontFamily="JetBrains Mono, monospace" fontSize="8" letterSpacing="2">XP_TRACK</text>
        <rect x="0" y="6" width="120" height="2" fill="rgba(249,115,22,0.12)"/>
        <rect x="0" y="6" width="78"  height="2" fill="rgba(249,115,22,0.7)"/>
        <text x="0" y="22" fill="rgba(249,115,22,0.4)" fontFamily="JetBrains Mono, monospace" fontSize="7" letterSpacing="2">RANK_DELTA</text>
        <rect x="0" y="28" width="120" height="2" fill="rgba(249,115,22,0.08)"/>
        <rect x="0" y="28" width="42"  height="2" fill="rgba(249,115,22,0.5)"/>
      </g>
    </svg>
  )
}

// ── Hero da saudação ──────────────────────────────────────────────────────
function DashHero({ name = 'BIRDAO', stats }) {
  return (
    <div className="dash-hero">
      <div className="dash-hero-hud"><HeroHud /></div>
      <div className="dash-hero-content">
        <div className="dash-hero-eyebrow">XAMA · Painel do jogador</div>
        <h1 className="dash-hello">
          Olá, <span className="dash-hello-name">{name}</span>
          <span className="dash-hello-wave" role="img" aria-label="aceno">👋</span>
        </h1>
        <p className="dash-hero-sub">
          Bem-vindo ao XAMA Fantasy — aqui está o resumo do seu fantasy.
        </p>

        {stats && (
          <div className="dash-stat-chips">
            {stats.bestRank && (
              <span className="dash-chip dash-chip-gold">
                <span className="dash-chip-icon"><DashIcon name="trophy" size={14}/></span>
                <span className="dash-chip-text">
                  <span className="l">Melhor</span>
                  <span className="v">#{stats.bestRank}</span>
                </span>
              </span>
            )}
            <span className="dash-chip dash-chip-muted">
              <span className="dash-chip-icon"><DashIcon name="calendar" size={14}/></span>
              <span className="dash-chip-text">
                <span className="v">{stats.totalStages}</span>
                <span className="l">Stages</span>
              </span>
            </span>
            {stats.lastPts != null && (
              <span className="dash-chip dash-chip-orange">
                <span className="dash-chip-icon"><DashIcon name="target" size={14}/></span>
                <span className="dash-chip-text">
                  <span className="v">{stats.lastPts.toFixed(2)}</span>
                  <span className="l">pts · #{stats.lastRank}</span>
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Faceoff banner (teal) ─────────────────────────────────────────────────
function FaceoffBanner({ voted, total }) {
  return (
    <div className="dash-faceoff" role="button" tabIndex={0}>
      <div className="dash-faceoff-icon">
        <DashIcon name="swords" size={22} strokeWidth={1.6}/>
      </div>
      <div className="dash-faceoff-body">
        <div className="dash-faceoff-title">Team Faceoff está aberto!</div>
        <div className="dash-faceoff-sub">
          <b>{voted}/{total}</b> confrontos votados · Clique para participar
        </div>
      </div>
      <div className="dash-faceoff-cta">
        Votar agora
        <DashIcon name="arrow-right" size={14}/>
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────
function SectionHead({ icon, label, count, tone = 'orange', toggle, expanded }) {
  const toneCls = tone === 'muted' ? 'is-muted' : tone === 'gold' ? 'is-gold' : ''
  return (
    <div className="dash-section-head">
      <div className={`dash-section-icon ${toneCls}`}>
        <DashIcon name={icon} size={16}/>
      </div>
      <div className={`dash-section-label ${tone === 'orange' ? 'is-orange' : tone === 'muted' ? 'is-muted' : 'is-gold'}`}>
        {label}
      </div>
      {count != null && (
        <div className={`dash-section-counter ${tone === 'muted' ? 'is-muted' : ''}`}>{String(count).padStart(2,'0')}</div>
      )}
      <div className="dash-section-spacer" />
      {toggle && (
        <button className="dash-section-toggle" onClick={toggle.onClick}>
          {expanded ? 'Recolher' : 'Expandir'}
          <DashIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={12}/>
        </button>
      )}
    </div>
  )
}

// ── Open Lineup Card ──────────────────────────────────────────────────────
function OpenCard({ stage, champ, dateLabel, countdown, previewCount = 0, expanded, onToggle, onPreviewExpand }) {
  return (
    <div className="dash-open-card">
      <div className="dash-open-logo">
        <img src={champ.logo} alt={champ.name}/>
      </div>
      <div className="dash-open-body">
        <h3 className="dash-open-title">{stage.name}</h3>
        <div className="dash-open-meta">
          <span className="champ">{champ.name}</span>
          <span className="sep">·</span>
          <span>{dateLabel}</span>
        </div>
        <span className={`dash-open-countdown ${countdown.tone === 'muted' ? 'is-muted' : countdown.tone === 'urgent' ? 'is-urgent' : ''}`}>
          <DashIcon name="clock" size={11}/>
          {countdown.label}
        </span>
      </div>
      <div className="dash-open-actions">
        <span className="dash-badge-open">
          <span className="dash-badge-dot"/>
          Aberta
        </span>
        <button className="dash-cta-primary">
          Montar lineup
          <span className="arrow">→</span>
        </button>
      </div>

      {previewCount > 0 && (
        <div className="dash-open-expand">
          <button className="dash-open-expand-btn" onClick={onPreviewExpand}>
            <DashIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={11}/>
            {expanded
              ? 'Ocultar etapas seguintes'
              : `Ver ${previewCount} etapa${previewCount>1?'s':''} seguinte${previewCount>1?'s':''}`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Preview card ─────────────────────────────────────────────────────────
function PreviewCard({ stage, champ, dateLabel, opensIn }) {
  return (
    <div className="dash-preview-card">
      <div className="dash-preview-logo">
        <img src={champ.logo} alt=""/>
      </div>
      <div className="dash-preview-body">
        <div className="dash-preview-meta">
          <span className="dash-preview-name">{stage.name}</span>
        </div>
        <div className="dash-preview-date">
          <span style={{color:'rgba(249,115,22,0.65)', fontWeight:700, marginRight:6}}>{champ.short}</span>
          {dateLabel}
        </div>
      </div>
      <span className="dash-preview-countdown">
        <DashIcon name="unlock" size={10}/>
        Abre em {opensIn}
      </span>
    </div>
  )
}

// ── Stage row (results) ──────────────────────────────────────────────────
function StageRow({ stage, champ, dateLabel, score, rank, empty }) {
  return (
    <div className="dash-stage-row">
      <div className="dash-stage-logo">
        <img src={champ.logo} alt=""/>
      </div>
      <div className="dash-stage-body">
        <div className="dash-stage-name">{stage.name}</div>
        <div className="dash-stage-meta">
          <span className="champ">{champ.name}</span>
          <span>·</span>
          <span>{dateLabel}</span>
        </div>
      </div>
      <div className="dash-stage-result">
        {empty ? (
          <span className="dash-stage-empty">Sem lineup</span>
        ) : (
          <>
            <span className="dash-stage-pts">{score.toFixed(1)} pts</span>
            <span className="dash-stage-rank">#{rank}</span>
          </>
        )}
      </div>
    </div>
  )
}

// ── Achievement Hero (offseason) ──────────────────────────────────────────
function AchievementHero({ rank, champName, points, stages, totalRank }) {
  const isTop = rank <= 3
  return (
    <div className="dash-achievement">
      <div className="dash-achievement-rank">
        <div className={`dash-achievement-rank-num ${!isTop ? 'is-fade' : ''}`}>#{rank}</div>
      </div>
      <div className="dash-achievement-body">
        <div className="dash-achievement-eyebrow">Conquista · Última temporada</div>
        <h2 className="dash-achievement-title">
          Você terminou em <em>1º</em> no <em>{champName}</em>
        </h2>
        <div className="dash-achievement-stats">
          <span><b>{points}</b> pontos</span>
          <span className="sep">·</span>
          <span><b>{stages}</b> stages jogadas</span>
          <span className="sep">·</span>
          <span><b>#{totalRank}º</b> lugar geral</span>
        </div>
      </div>
      <button className="dash-achievement-cta">
        Ver retrospectiva
        <DashIcon name="chevron-right" size={12}/>
      </button>
    </div>
  )
}

// ── Anticipation Card ────────────────────────────────────────────────────
function AnticipationCard({ champ, days, hours }) {
  return (
    <div className="dash-anticipation">
      <div className="dash-anticipation-logo">
        <img src={champ.logo} alt=""/>
      </div>
      <div className="dash-anticipation-body">
        <div className="dash-anticipation-eyebrow">Próximo torneio</div>
        <div className="dash-anticipation-name">{champ.name}</div>
        <div className="dash-anticipation-countdown">
          Começa em <b>{days}</b> dias <b>{hours}</b> horas
        </div>
      </div>
      <div className="dash-anticipation-actions">
        <button className="dash-cta-secondary">
          Ver detalhes
          <DashIcon name="chevron-right" size={12}/>
        </button>
      </div>
    </div>
  )
}

// ── Replay Card ──────────────────────────────────────────────────────────
function ReplayCard({ stage, champ, dateLabel, score, rank }) {
  return (
    <div className="dash-replay">
      <div className="dash-replay-logo">
        <img src={champ.logo} alt=""/>
      </div>
      <div className="dash-replay-body">
        <div className="dash-replay-eyebrow">Última stage jogada</div>
        <div className="dash-replay-name">{stage.name} <span style={{color:'rgba(249,115,22,0.6)', fontFamily:'JetBrains Mono, monospace', fontSize:11, marginLeft:8}}>{champ.short}</span></div>
        <div className="dash-replay-date">{dateLabel}</div>
      </div>
      <div className="dash-replay-result">
        <span className="dash-replay-pts">{score.toFixed(1)} pts</span>
        <span className="dash-replay-rank">#{rank}</span>
      </div>
    </div>
  )
}

Object.assign(window, {
  DashHero, FaceoffBanner, SectionHead,
  OpenCard, PreviewCard, StageRow,
  AchievementHero, AnticipationCard, ReplayCard,
})
