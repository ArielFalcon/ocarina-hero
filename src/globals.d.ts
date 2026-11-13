/** Vite's public base path, always ending in '/'. */
interface ImportMetaEnv { readonly BASE_URL: string }
interface ImportMeta { readonly env: ImportMetaEnv }

/** Vite asset URL import. */
declare module '*?url' { const url: string; export default url; }
