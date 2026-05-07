import { defineConfig, transformWithEsbuild } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    // Plugin pré-transform: trata arquivos .js com JSX (ex: icons.js) como .jsx
    // antes que o vite:build-import-analysis tente parsear JSX como JS puro.
    {
      name: 'treat-src-js-as-jsx',
      enforce: 'pre',
      async transform(code, id) {
        if (!id.match(/src\/.*\.js$/)) return null
        return transformWithEsbuild(code, id, { loader: 'jsx' })
      },
    },
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
})
