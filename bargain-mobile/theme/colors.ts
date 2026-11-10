// BargainHuntrs mobile palette — matches bargainhuntrs.com:
//   neutrals  zinc ramp (site body is white/zinc-950 dark)
//   brand     emerald-500 #10b981 — logo-dark tile, hero gradient, CTAs
// On emerald fills the glyph color is zinc-950 #09090b (the logo's dark
// variant) — never white-on-emerald small text.
// App is dark-only (userInterfaceStyle: 'dark' in app.json) — one palette.

export const colors = {
  bg: '#09090b',
  card: '#18181b',
  cardSoft: '#232328',
  input: '#18181b',

  text: '#fafafa',
  muted: '#a1a1aa',
  faint: '#71717a',

  brand: '#10b981',
  brandLight: '#34d399',
  brandInk: '#09090b',
  brandTint: 'rgba(16,185,129,0.14)',

  border: 'rgba(161,161,170,0.14)',
  borderStrong: 'rgba(161,161,170,0.28)',

  success: '#10b981',
  successTint: 'rgba(16,185,129,0.14)',
  warning: '#f59e0b',
  warningTint: 'rgba(245,158,11,0.14)',
  danger: '#ef4444',
  dangerTint: 'rgba(239,68,68,0.14)',

  tabBar: '#0c0c0e',
  overlay: 'rgba(9,9,11,0.7)',
} as const;

export type ColorToken = keyof typeof colors;
