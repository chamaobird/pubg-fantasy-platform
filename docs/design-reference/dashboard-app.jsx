// dashboard-app.jsx — composição final dos 3 estados em design canvas
const { useState: useAppState } = React

const CHAMPS = {
  PEC: { name: 'PUBG EMEA Championship 2026 Spring', short: 'PEC', logo: 'assets/tournaments/PECshort.png' },
  PAS: { name: 'PUBG Americas Series 2 2026', short: 'PAS', logo: 'assets/tournaments/PASshort.png' },
  PAS2:{ name: 'PAS2 Spring 2026',                 short: 'PAS', logo: 'assets/tournaments/PASshort.png' },
  PAS1:{ name: 'PAS1 Spring 2026',                 short: 'PAS', logo: 'assets/tournaments/PASshort.png' },
  PGS: { name: 'PUBG Global Series 3',              short: 'PGS', logo: 'assets/tournaments/PGS.png' },
}

function StateActiveDashboard() {
  const [pecExp, setPecExp] = useAppState(false)
  const [pasExp, setPasExp] = useAppState(false)

  return (
    <>
      <XamaNavbar active="dashboard"/>
      <main className="dash-container">
        <DashHero
          name="BIRDAO"
          stats={{ bestRank: 1, totalStages: 13, lastPts: 458.06, lastRank: 3 }}
        />

        <FaceoffBanner voted={2} total={5}/>

        <div className="dash-section">
          <SectionHead icon="flame" label="Lineup Aberta" count={2} tone="orange"/>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <OpenCard
              stage={{ name: 'PEC Springs Finals 2 — Dia 1' }}
              champ={CHAMPS.PEC}
              dateLabel="Sex, 30 mai · 12:00"
              countdown={{ tone: 'muted', label: 'Fecha em 1d 6h' }}
              previewCount={2}
              expanded={pecExp}
              onPreviewExpand={() => setPecExp(v => !v)}
            />
            {pecExp && (
              <>
                <PreviewCard
                  stage={{ name: 'PEC Springs Finals 2 — Dia 2' }}
                  champ={CHAMPS.PEC}
                  dateLabel="Sáb, 31 mai · 12:00"
                  opensIn="1d 6h"
                />
                <PreviewCard
                  stage={{ name: 'PEC Springs Finals 2 — Dia 3' }}
                  champ={CHAMPS.PEC}
                  dateLabel="Dom, 01 jun · 12:00"
                  opensIn="2d 6h"
                />
              </>
            )}
            <OpenCard
              stage={{ name: 'PAS1 — Finals 2 — Dia 1' }}
              champ={CHAMPS.PAS}
              dateLabel="Sex, 30 mai · 19:00"
              countdown={{ tone: 'urgent', label: 'Fecha em 18h 24min' }}
              previewCount={2}
              expanded={pasExp}
              onPreviewExpand={() => setPasExp(v => !v)}
            />
          </div>
        </div>

        <div className="dash-section">
          <SectionHead icon="unlock" label="Abrindo em Breve" count={2} tone="muted"/>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PreviewCard
              stage={{ name: 'PAS2 — Group Stage — Dia 1' }}
              champ={CHAMPS.PAS2}
              dateLabel="Qui, 12 jun · 19:00"
              opensIn="6d 12h"
            />
            <PreviewCard
              stage={{ name: 'PGS3 — Lobby Open' }}
              champ={CHAMPS.PGS}
              dateLabel="Seg, 23 jun · 14:00"
              opensIn="17d 8h"
            />
          </div>
        </div>

        <div className="dash-section">
          <SectionHead icon="bar-chart" label="Resultados" count={26} tone="muted" toggle={{ onClick: ()=>{} }} expanded={false}/>
        </div>
      </main>
      <footer className="dash-footer">XAMA Fantasy League · Todos os reais do PUBG Esports</footer>
    </>
  )
}

function StateOffseasonDashboard() {
  return (
    <>
      <XamaNavbar active="dashboard"/>
      <main className="dash-container">
        <DashHero
          name="BIRDAO"
          stats={{ bestRank: 1, totalStages: 13, lastPts: 458.06, lastRank: 3 }}
        />

        <div className="dash-offseason-stack">
          <AchievementHero
            rank={1}
            champName="PAS1 Spring 2026"
            points="458,06"
            stages={9}
            totalRank={3}
          />
          <AnticipationCard champ={CHAMPS.PAS2} days={12} hours={4}/>
          <ReplayCard
            stage={{ name: 'PAS1 Finals — Dia 3' }}
            champ={CHAMPS.PAS1}
            dateLabel="Dom, 18 mai · 19:00"
            score={62.4}
            rank={5}
          />
        </div>

        <div className="dash-section">
          <SectionHead icon="bar-chart" label="Resultados" count={26} tone="muted" toggle={{ onClick: ()=>{} }} expanded={false}/>
        </div>
      </main>
      <footer className="dash-footer">XAMA Fantasy League · Todos os reais do PUBG Esports</footer>
    </>
  )
}

function StateMobileDashboard() {
  return (
    <div style={{maxWidth: 420, margin: '0 auto', overflow: 'hidden'}}>
      <StateActiveDashboard/>
    </div>
  )
}

// ── Render in Design Canvas ──────────────────────────────────────────────
function App() {
  return (
    <DesignCanvas initialZoom={0.7}>
      <DCSection id="states" title="XAMA Dashboard — Estados">
        <DCArtboard id="active"    label="Estado 1 · Lineup Aberta (mais comum)" width={1280} height={1700}>
          <div className="xama-bg-shell">
            <div className="xm-bg-hex"></div>
            <div className="xm-bg-radial"></div>
            <div className="xm-scan-line"></div>
            <StateActiveDashboard/>
          </div>
        </DCArtboard>
        <DCArtboard id="offseason" label="Estado 2 · Offseason"             width={1280} height={1500}>
          <div className="xama-bg-shell">
            <div className="xm-bg-hex"></div>
            <div className="xm-bg-radial"></div>
            <div className="xm-scan-line"></div>
            <StateOffseasonDashboard/>
          </div>
        </DCArtboard>
        <DCArtboard id="mobile"    label="Estado 3 · Mobile (≤640px)"        width={420}  height={1900}>
          <div className="xama-bg-shell">
            <div className="xm-bg-hex"></div>
            <div className="xm-bg-radial"></div>
            <div className="xm-scan-line"></div>
            <StateActiveDashboard/>
          </div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>)
