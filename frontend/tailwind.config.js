/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0f',
        card: '#12121a',
        'card-hover': '#1a1a26',
        accent: '#f5a623',
        'accent-dark': '#c4841a',
        'accent-dim': 'rgba(245,166,35,0.15)',
        muted: '#4a4a6a',
        'text-secondary': '#8888aa',
        danger: '#e05252',
        success: '#52e0a0',
        'border-color': 'rgba(245,166,35,0.2)',
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        body: ['"Rajdhani"', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'monospace'],
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(245,166,35,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(245,166,35,0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
    },
  },
  plugins: [],
}
