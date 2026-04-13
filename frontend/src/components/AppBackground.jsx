// frontend/src/components/AppBackground.jsx
// Background atmosférico idêntico à Landing — renderizado via RequireAuth

export default function AppBackground() {
  return (
    <>
      {/* Fundo base */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: '#08090d',
      }} />

      {/* Grade hexagonal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        opacity: 0.045,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='52'%3E%3Cpolygon points='30,2 58,17 58,35 30,50 2,35 2,17' fill='none' stroke='%23f97316' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: '60px 52px',
      }} />

      {/* Gradiente radial laranja */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 65% 80% at 18% 55%, rgba(249,115,22,0.13) 0%, transparent 65%),
          radial-gradient(ellipse 35% 50% at 82% 45%, rgba(249,115,22,0.05) 0%, transparent 65%)
        `,
      }} />
    </>
  )
}
