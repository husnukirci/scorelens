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
        // Per-directory thresholds from CLAUDE.md §7; domain/** attaches when
        // it gains code — a glob matching zero covered files fails the run.
        thresholds: {
          'src/api/**': { lines: 90, branches: 85 },
          'src/state/**': { lines: 90, branches: 85 },
          'src/utils/**': { lines: 95, branches: 90 },
          'src/config.ts': { lines: 95, branches: 90 },
        },
      },
    },
  }),
)
