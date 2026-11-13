// Applies the saved theme before first paint (CSP forbids inline scripts). Key: THEME_STORAGE in src/ui/theme.ts.
try { if (localStorage.getItem('ocarina-hero:theme') === 'retro') document.documentElement.dataset.theme = 'retro'; } catch {}
