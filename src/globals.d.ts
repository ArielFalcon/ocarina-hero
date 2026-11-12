/** False in static builds without the local /api/melody server. */
declare const __MELODY_SERVER__: boolean;

/** Vite's public base path, always ending in '/'. */
interface ImportMetaEnv { readonly BASE_URL: string }
interface ImportMeta { readonly env: ImportMetaEnv }

/** Vite asset URL import. */
declare module '*?url' { const url: string; export default url; }
