// frontend/src/components/AppBackground.jsx
// Background atmosférico idêntico à Landing — renderizado via RequireAuth
// Usa classes .xm-bg-* de xm-tokens.css (Fase C do redesign)

export default function AppBackground() {
  return (
    <>
      <div className="xm-bg-base" />
      <div className="xm-bg-hex" />
      <div className="xm-bg-radial" />
    </>
  )
}
