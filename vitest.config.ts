import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      // config.ts must be importable in tests; parseConfig is tested against
      // hand-built env objects, these only satisfy the module-level parse.
      env: {
        VITE_API_BASE_URL: 'http://localhost:3001',
        VITE_SSE_BASE_URL: 'http://localhost:3002',
      },
      coverage: {
        provider: 'v8',
        include: ['src/**'],
        exclude: [
          'src/app/**',
          'src/test/**',
          'src/**/*.test.{ts,tsx}',
          'src/**/*.css',
          'src/vite-env.d.ts',
          'src/api/types.gen.ts',
        ],
        // Per-directory thresholds from CLAUDE.md §7 (api 90/85, utils+domain
        // 95/90, state 90/85) are added as each directory gains code in Phase 2+.
        thresholds: {
          'src/config.ts': { lines: 95, branches: 90 },
        },
      },
    },
  }),
)
