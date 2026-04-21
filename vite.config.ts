import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sharedConfig } from './vite.shared';

/**
 * Standalone Vite config for the dev harness (`pnpm dev:ui`).
 * Serves `src/dev/` as the root so index.html + standalone.tsx boot
 * the UI against a MockAdapter with no extension context.
 *
 * WXT uses wxt.config.ts with @wxt-dev/module-react — that path does
 * NOT go through this file. Both configs share `sharedConfig` for
 * aliases.
 */
export default defineConfig({
  ...sharedConfig,
  root: 'src/dev',
  plugins: [
    ...(sharedConfig.plugins ?? []),
    react(),
  ],
});
