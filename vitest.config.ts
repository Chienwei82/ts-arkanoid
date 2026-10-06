import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      // Only shipped source counts; CSS and config files are not executable logic.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.css', 'src/main.tsx', 'src/vite-env.d.ts'],
      /**
       * Floors measured against the current suite, per layer. There is no global
       * `src/**` floor on purpose: the aggregate would be dragged down by the
       * GPU-bound layer, whose coverage is reported but cannot execute headless.
       * That layer is exercised by the manual smoke test documented in the README.
       */
      thresholds: {
        'src/core/**': { statements: 90, branches: 75, functions: 90, lines: 90 },
        'src/systems/**': { statements: 95, branches: 85, functions: 95, lines: 95 },
        'src/entities/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'src/levels/**': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'src/utils/**': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'src/platform/**': { statements: 95, branches: 85, functions: 95, lines: 95 },
        'src/bridge/**': { statements: 90, branches: 55, functions: 90, lines: 90 },
        'src/ui/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/rendering/**': { statements: 0, branches: 0, functions: 0, lines: 0 },
      },
    },
  },
})
