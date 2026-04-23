import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environmentMatchGlobs: [
      ['src/ui/**/*.test.{ts,tsx}', 'jsdom'],
      ['src/state/**/*.test.ts', 'jsdom'],
      ['src/adapters/lichess*.test.ts', 'jsdom'],
    ],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/adapters/**', 'src/state/**', 'src/ui/**'],
      exclude: [
        'src/core/types.ts',
        'src/adapters/adapter.ts',
        'src/ui/Chessground.tsx',
        'src/ui/MiniBoard.tsx',
        'src/ui/Overlay.tsx',
        'src/**/*.test.{ts,tsx}',
        'src/dev/**',
      ],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90,
      },
      reporter: ['text', 'html'],
    },
  },
});
