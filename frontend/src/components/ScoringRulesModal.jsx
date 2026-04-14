// frontend/src/components/ScoringRulesModal.jsx
// Modal com a fórmula de pontuação XAMA — acessível pelo botão ? no LineupBuilder

export default function ScoringRulesModal({ captainMultiplier = 1.30, onClose }) {
  const mult = Number(captainMultiplier).toFixed(2)

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 201,
        transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--color-xama-surface)',
        border: '1px solid var(--color-xama-border)',
        borderRadius: 14,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Barra laranja topo */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 60%)', borderRadius: '14px 14px 0 0' }} />

        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🔥</span>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-xama-text)', letterSpacing: '0.04em' }}>
              Fórmula de Pontuação XAMA
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-xama-muted)', fontSize: 20, lineHeight: 1,
              padding: '4px 8px', borderRadius: 6,
            }}>
            ×
          </button>
        </div>

        <div style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Seção 1 — Pontos base */}
          <div>
            <SectionTitle>Pontos por Partida</SectionTitle>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-xama-border)' }}>
                  <Th left>Ação</Th>
                  <Th>Pontos</Th>
                  <Th left>Observação</Th>
                </tr>
              </thead>
              <tbody>
                <Row label="Kill"           value="+10"  note="Por eliminação" color="var(--color-xama-orange)" />
                <Row label="Assist"         value="+1"   note="Por assistência" />
                <Row label="Knock"          value="+1"   note="Por derrubada" />
                <Row label="Dano"           value="+0.03" note="Por ponto de dano causado" color="var(--color-xama-gold)" />
                <Row label="Morte precoce"  value="−15"  note="Morreu antes de 10 min sem nenhum kill" color="var(--color-xama-red)" />
              </tbody>
            </table>
          </div>

          {/* Seção 2 — Late game */}
          <div>
            <SectionTitle>Bônus de Sobrevivência (Late Game)</SectionTitle>
            <p style={{ fontSize: 13, color: 'var(--color-xama-muted)', margin: '0 0 12px', lineHeight: 1.6 }}>
              Recompensa jogadores que sobreviveram até o final da partida.
              O bônus depende de quantos jogadores do time vencedor estavam vivos nos últimos 60 segundos.
            </p>

            {/* Sobreviventes do vencedor */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 12,
            }}>
              <span style={{ fontSize: 18 }}>🏆</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-xama-orange)' }}>
                  Sobreviventes do time vencedor
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-xama-muted)', marginTop: 2 }}>
                  Cada jogador vivo nos últimos 60s da partida recebe <strong style={{ color: 'var(--color-xama-text)' }}>+10 pts</strong>
                </div>
              </div>
            </div>

            {/* Tabela de bônus por N */}
            <p style={{ fontSize: 12, color: 'var(--color-xama-muted)', margin: '0 0 8px' }}>
              Os demais jogadores que duraram mais tempo também recebem bônus decrescentes:
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-xama-border)' }}>
                  <Th left>Sobreviventes do vencedor</Th>
                  <Th left>Bônus para os próximos (por ordem de sobrevivência)</Th>
                </tr>
              </thead>
              <tbody>
                {[
                  { n: 4, bonuses: '2, 2, 1, 1' },
                  { n: 3, bonuses: '4, 2, 2, 1, 1' },
                  { n: 2, bonuses: '5, 4, 2, 2, 1, 1' },
                  { n: 1, bonuses: '6, 5, 4, 2, 2, 1, 1' },
                ].map(({ n, bonuses }) => (
                  <tr key={n} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={tdStyle}><span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-gold)', fontWeight: 700 }}>{n} jogador{n > 1 ? 'es' : ''}</span></td>
                    <td style={tdStyle}><span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-text)', fontSize: 13 }}>{bonuses}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Seção 3 — Capitão */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'rgba(240,192,64,0.06)', border: '1px solid rgba(240,192,64,0.2)',
            borderRadius: 8, padding: '14px 16px',
          }}>
            <span style={{ fontSize: 22 }}>⭐</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-xama-gold)' }}>
                Capitão — ×{mult}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-xama-muted)', marginTop: 3 }}>
                O capitão do seu lineup recebe um multiplicador de <strong style={{ color: 'var(--color-xama-text)' }}>×{mult}</strong> sobre todos os seus pontos. Escolha bem!
              </div>
            </div>
          </div>

          {/* Seção 4 — Exemplo */}
          <div>
            <SectionTitle>Exemplo Prático</SectionTitle>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-xama-border)', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, color: 'var(--color-xama-muted)', marginBottom: 10 }}>
                Jogador com: <strong style={{ color: 'var(--color-xama-text)' }}>3 kills · 1 assist · 200 dano · sobreviveu até o top 3</strong>
              </div>
              {[
                { label: '3 kills',       calc: '3 × 10',    pts: '+30',  color: 'var(--color-xama-orange)' },
                { label: '1 assist',      calc: '1 × 1',     pts: '+1',   color: 'var(--color-xama-text)' },
                { label: '200 dano',      calc: '200 × 0.03',pts: '+6',   color: 'var(--color-xama-gold)' },
                { label: 'Late game',     calc: 'bônus',     pts: '+4',   color: 'var(--color-xama-blue)' },
              ].map(({ label, calc, pts, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-xama-muted)' }}>{label}</span>
                  <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>{calc}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color }}>{pts}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--color-xama-border)' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-xama-text)' }}>Total</span>
                <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-orange)' }}>41 pts</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--color-xama-gold)' }}>⭐ Como capitão (×{mult})</span>
                <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-gold)' }}>{(41 * Number(mult)).toFixed(1)} pts</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ── Sub-componentes locais ────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--color-xama-orange)', fontFamily: "'JetBrains Mono', monospace",
      marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

const tdStyle = { padding: '8px 10px', fontSize: 13, color: 'var(--color-xama-text)' }
const thStyle = (left) => ({
  padding: '7px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--color-xama-muted)',
  textAlign: left ? 'left' : 'right',
})

function Th({ children, left }) {
  return <th style={thStyle(left)}>{children}</th>
}

function Row({ label, value, note, color }) {
  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <td style={{ ...tdStyle, fontWeight: 600 }}>{label}</td>
      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: color || 'var(--color-xama-text)' }}>{value}</td>
      <td style={{ ...tdStyle, color: 'var(--color-xama-muted)', fontSize: 12 }}>{note}</td>
    </tr>
  )
}
