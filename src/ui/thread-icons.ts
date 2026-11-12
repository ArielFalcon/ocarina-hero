const paths = {
  previous: 'M14 5 7 12l7 7M7 12h13',
  next: 'm10 5 7 7-7 7M17 12H4',
  play: 'm8 4 12 8-12 8Z',
  stop: 'M6 6h12v12H6Z',
  reset: 'M5 9a8 8 0 1 1-1 6M5 3v6h6',
  speed: 'M3 17a9 9 0 0 1 18 0M12 17l5-7M7 13h.01M12 9h.01',
  keyboard: 'M3 5h18v14H3ZM6 9h1m3 0h1m3 0h1m3 0h1M6 12h1m3 0h1m3 0h1m3 0h1M7 16h10',
  music: 'M10 17V5l10-2v12M10 7l10-2M10 17c0 4-7 4-7 1s7-4 7-1m10-2c0 4-7 4-7 1s7-4 7-1',
  star: 'm12 2 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z',
  heart: 'M12 21 3 12C-2 4 8 0 12 7c4-7 14-3 9 5Z',
  pokeball: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM2 12h20M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  songbook: 'M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15M6 8h2m-2 4h2m8-4h2m-2 4h2',
  gamepad: 'M7 6h10c3 0 4 3 5 10 0 3-2 4-4 1l-2-2H8l-2 2c-2 3-4 2-4-1C3 9 4 6 7 6Zm0 3v5m-2.5-2.5h5M16 10h.1m3 3h.1',
  anime: 'M2 13c5-7 15-7 20 0-5 7-15 7-20 0ZM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8M3 5l2 3m14-3-2 3M12 2v3',
  film: 'M3 8h18v13H3ZM3 8 2 4l18-3 1 4ZM7 3l3 4m4-5 3 4M7 12h10m-10 4h7',
  microphone: 'M9 4a3 3 0 0 1 6 0v9a3 3 0 0 1-6 0Zm-3 7v2a6 6 0 0 0 12 0v-2M12 19v3m-4 0h8M9 7h6m-6 3h6',
  lyre: 'M5 3c-4 5-2 9 1 12l2 4h8l2-4c3-3 5-7 1-12M5 3l3 4h8l3-4M8 7v12m4-12v12m4-12v12M7 22h10',
  collection: 'M3 5h7l2 3h9v13H3ZM3 5V3h6l2 2M8 12h8m-8 4h5',
  triforce: 'm12 2 5 9H7ZM7 11l5 9H2Zm10 0 5 9H12Z',
  tetromino: 'M8 2h7v7h7v7H1V9h7Zm0 7h7m-7 0v7m7-7v7',
  ring: 'M12 2C0 2 0 22 12 22S24 2 12 2Zm0 4c-7 0-7 12 0 12s7-12 0-12M5 7l3 2m8 6 3 2',
  meteor: 'm8 18 14-15-5 13-6 6M2 17a5 5 0 1 0 10 0 5 5 0 0 0-10 0m7-7L17 2M6 10l5-7',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 3v6l4 3M12 1v2M3 12h2m14 0h2M12 19v2',
  remote: 'M8 2h8v20H8ZM12 5h.1M12 8v5m-2.5-2.5h5M12 16h.1M11 19h2',
  mushroom: 'M2 13C2-2 22-2 22 13H2Zm5 0v6c0 4 10 4 10 0v-6M9 17v2m6-2v2M10 3v5h4V3M3 8l4 3m14-3-4 3',
  grassBlock: 'm12 2 10 5v10l-10 5-10-5V7Zm0 10v10M2 7l10 5 10-5M5 9v4l3 1v-3m10-2v4l-3 1v-3',
  leaf: 'M8 8c7-5 15 0 11 7-3 6-11 6-14 1C1 10 4 4 10 3m1 5c-5 0-7 7-2 9 5 2 8-5 3-7-2-1-4 1-2 3M5 16l-3 5 7-1',
  unit: 'm12 1 3 7 6-3-2 12-7 6-7-6L3 5l6 3Zm0 7v7m-5-4 3 2m7-2-3 2M8 17l4 2 4-2',
  lily: 'M12 13C3 15 1 8 2 5c7 0 9 3 10 8Zm0 0C21 15 23 8 22 5c-7 0-9 3-10 8Zm0 0C5 7 10 1 12 1c2 0 7 6 0 12Zm0 0v9m-6-4 6 2 6-2',
  notebook: 'M4 3h13v19H4Zm3-2v4m4-4v4M7 9h6m-6 4h4m2 3 7-10 2 2-7 10-3 2Z',
  moon: 'M17 3C1-2-4 19 11 22c5 1 9-2 11-6-12 6-18-8-5-13ZM18 6l1 2 3 1-3 1-1 3-1-3-3-1 3-1Z',
  dragonball: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8 7v4m-2-2h4m6-2v4m-2-2h4m-10 2v4m-2-2h4m6-2v4m-2-2h4',
  wings: 'M11 21 2 16V3l9 7v11Zm2 0 9-5V3l-9 7v11ZM2 7l9 7M2 11l9 7M22 7l-9 7m9-3-9 7',
  forestSpirit: 'M4 10 5 2l5 5h4l5-5 1 8c6 15-22 15-16 0ZM8 11h.1m8 0h.1M10 14h4m-7 4 2-1 2 1m2 0 2-1 2 1',
  hunter: 'M4 21 16 3l5-1-1 5L8 19Zm1-9 7 5M3 17l4 4M3 3l1 2 3 1-3 1-1 2-1-2-1-1 1-1Z',
  empire: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v6m0 8v6M3.4 7l5.2 3m6.8 4 5.2 3M3.4 17l5.2-3m6.8-4 5.2-3',
  pirate: 'M7 14V9C7 1 17 1 17 9v5l-3 1v3h-4v-3Zm2-5h.1m6 0h.1M2 17l20 5M2 22l20-5M11 13h2',
  wizard: 'M10 15a4 4 0 1 0-8 0 4 4 0 0 0 8 0Zm12 0a4 4 0 1 0-8 0 4 4 0 0 0 8 0Zm-12 0h4M13 1l-5 6h5l-2 4',
  cassette: 'M2 5h20v15H2Zm4 0v7h12V5M8 8h.1m8 0h.1M6 20l2-5h8l2 5M10 8h4',
  rocket: 'M8 16C6 8 13 2 21 2c0 8-6 15-14 13Zm7-11a2 2 0 1 0 0 4 2 2 0 0 0 0-4M8 9H4l-3 7 7-1m7 1v4l-7 3 1-7M5 18l-3 4',
  waveform: 'M2 12h3l2-8 4 16 3-16 3 12 2-4h3',
  flower: 'M12 8c-7-10-15 3-5 5-6 9 10 14 10 4 11 2 10-14 1-10-1-9-14-7-12 1m6 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  hourglass: 'M5 2h14M5 22h14M7 2v4c0 3 10 9 10 12v4M17 2v4c0 3-10 9-10 12v4M8 19h8M9 6h6',
  cake: 'M3 12h18v10H3Zm0 4c3 4 4-4 7 0s4-4 7 0 4 0 4 0M7 12V9m5 3V7m5 5V9M7 5v1m5-3v1m5 1v1',
} as const;

export type ThreadIcon = keyof typeof paths;

/** Layered cord and small running stitches share the app's thread colors. */
export function threadIcon(name: ThreadIcon): string {
  return `<svg class="thread-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="icon-cord" d="${paths[name]}"/><path class="icon-stitches" d="${paths[name]}"/></svg>`;
}

