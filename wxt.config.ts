import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'Chess Calc',
    description: 'Externalize your chess calculation tree during live play.',
    permissions: [],
    host_permissions: ['https://lichess.org/*'],
  },
});
