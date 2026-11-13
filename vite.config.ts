import { defineConfig } from 'vite';
import { createMelodyPlugin } from './server/melody';

export default defineConfig({
  // Optional subfolder hosting; ocarinahero.app and local development use '/'.
  base: process.env.BASE_PATH ?? '/',
  plugins: [createMelodyPlugin()],
  define: {
    // Static hosting (MELODY_SERVER=off) has no /api/melody, so the build drops that mode.
    __MELODY_SERVER__: JSON.stringify(process.env.MELODY_SERVER !== 'off'),
  },
  server: {
    host: true,
    port: 5173,
    // tailscale serve proxies with the tailnet hostname as Host header.
    allowedHosts: ['.ts.net'],
  },
});
