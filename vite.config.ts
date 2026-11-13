import { defineConfig } from 'vite';

export default defineConfig({
  // Optional subfolder hosting; ocarinahero.app and local development use '/'.
  base: process.env.BASE_PATH ?? '/',
  server: {
    host: true,
    port: 5173,
    // tailscale serve proxies with the tailnet hostname as Host header.
    allowedHosts: ['.ts.net'],
  },
});
