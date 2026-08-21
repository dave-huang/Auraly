// Revely design tokens — drop into mobile/src/constants/design.ts
// Source of truth: "Revely Design System.dc.html" §06 Handoff

export const Paper = {
  card:       '#FFFCF6',
  paper:      '#F6F1E7',
  sunk:       '#EDE6D8',
  rule:       '#DDD4C2',
  inkFaint:   '#8A8175',
  inkMuted:   '#5C554A',
  ink:        '#16130F',
} as const;

// The ONLY saturated colour in the app.
// Legal outside a verdict surface: nowhere.
export const Verdict = {
  safe:    { ink: '#3F6B4C', wash: '#E4EBE1' },
  caution: { ink: '#A96C12', wash: '#F3E6CE' },
  avoid:   { ink: '#A5291F', wash: '#F1DED8' },
} as const;

export const VerdictWord = {
  safe: 'Safe', caution: 'Caution', avoid: 'Avoid',
} as const;

export const Type = {
  display: 'Newsreader',       // verdict word only
  sans:    'InstrumentSans',   // everything
  mono:    'IBMPlexMono',      // machine voice
  verdict: { size: 56, line: 50, tracking: -1.7 },
  reason:  { size: 17, line: 24 },
  title:   { size: 22, line: 27, weight: '600' },
  body:    { size: 15, line: 22 },
  label:   { size: 14, line: 18, weight: '500' },
  meta:    { size: 11, line: 15 },
  eyebrow: { size: 10, line: 10, tracking: 1.4, upper: true },
} as const;

// Lamplight — same logic, read by lamp.
export const Lamplight = {
  ground: '#16130F', surface: '#1E1A15', sunk: '#241F19',
  rule: '#332C24', inkFaint: '#8A8175',
  inkMuted: '#A79E90', ink: '#F6F1E7',
} as const;

export const VerdictDark = {
  safe:    { ink: '#6E9C79', wash: '#232C25' },
  caution: { ink: '#D69B3E', wash: '#2E2619' },
  avoid:   { ink: '#D96154', wash: '#2E1E1B' },
} as const;

// Share export is ALWAYS light theme.
export const Share = {
  feed:  { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
  theme: 'light', pixelRatio: 3,
} as const;

export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const Radius = { flat: 0, tile: 4, sheet: 28, pill: 999 };
export const Gutter = 24;

export const Motion = {
  sweep:  { ms: 1100, easing: 'cubic-bezier(.4,0,.2,1)', loops: 1 },
  rise:   { ms: 420,  easing: 'cubic-bezier(.16,1,.3,1)', dy: 46 },
  seal:   { ms: 450,  delay: 200, rotate: -4 },
  press:  { ms: 120 },
} as const;

export const Haptics = {
  safe:    ['impactLight'],
  caution: ['impactMedium', 90, 'impactLight'],
  avoid:   ['impactHeavy', 60, 'impactHeavy'],
  unsure:  [],
} as const;
