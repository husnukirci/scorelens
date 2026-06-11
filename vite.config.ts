import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // charts are a third of the bundle; keep them out of the core chunk
        manualChunks: (id: string): string | undefined =>
          /node_modules\/(recharts|victory-vendor|d3-[a-z-]+)\//.test(id) ? 'charts' : undefined,
      },
    },
  },
})
