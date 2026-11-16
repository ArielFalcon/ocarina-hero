import { defineConfig } from 'astro/config';
import { SITE_URL } from './src/site/config';

export default defineConfig({
  site: SITE_URL,
  // Optional subfolder hosting; ocarinahero.app and local development use '/'.
  base: process.env.BASE_PATH ?? '/',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // public/_headers caches /assets/* as immutable.
    assets: 'assets',
    // The CSP is script-src 'self': every script and stylesheet is a file.
    inlineStylesheets: 'never',
  },
  compressHTML: false,
  vite: {
    build: { assetsInlineLimit: 0 },
    // tailscale serve proxies with the tailnet hostname as Host header.
    server: { allowedHosts: ['.ts.net'] },
  },
  server: { host: true, port: 5173 },
});
