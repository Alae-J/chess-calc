import { fileURLToPath } from 'node:url';
import type { UserConfig } from 'vite';

/**
 * Shared Vite config concerns for both the WXT extension build
 * (wxt.config.ts) and the standalone dev harness (vite.config.ts).
 *
 * WXT manages its own React plugin via @wxt-dev/module-react, so we DO NOT
 * include @vitejs/plugin-react here — the dev-harness vite.config.ts adds
 * it separately. Tailwind and PostCSS are auto-discovered from
 * tailwind.config.ts and postcss.config.js at the project root.
 */
export const sharedConfig: UserConfig = {
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
};
