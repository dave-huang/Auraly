import { useColorScheme } from 'react-native';

export type VerdictLevel = 'safe' | 'caution' | 'avoid';

// Revely design system — "a field guide, not a dashboard".
// Tokens are the handoff block from the Revely Design System doc.
//
// The governing rule: paper and ink are ~90% of the interface, and the three
// verdict inks are the ONLY saturated colour in the product. They may appear
// on a verdict card, an ingredient dot, and a history tile edge — nowhere
// else. Buttons are ink. Links are ink. A colour outside a verdict is a bug.

export const Paper = {
  // Light, as a surface. Not a glow — a glow is chrome, and this system has
  // none. Light here is simply the brightest ground in the palette, used only
  // inside an aperture to say "this part is resolved".
  lift: '#FFFFFF',
  card: '#FFFCF6',
  paper: '#F6F1E7',
  sunk: '#EDE6D8',
  rule: '#DDD4C2',
  inkFaint: '#8A8175',
  inkMuted: '#5C554A',
  ink: '#16130F',
} as const;

// Lamplight — the same logic, read by lamp.
export const Lamplight = {
  // Lifted by lamp: still the brightest ground here, but reached by opening
  // up rather than by adding white, so the dark theme never goes grey.
  lift: '#2A241C',
  card: '#1E1A15',
  paper: '#16130F',
  sunk: '#241F19',
  rule: '#332C24',
  inkFaint: '#8A8175',
  inkMuted: '#A79E90',
  ink: '#F6F1E7',
} as const;

export interface Surface {
  lift: string;
  card: string;
  paper: string;
  sunk: string;
  rule: string;
  inkFaint: string;
  inkMuted: string;
  ink: string;
}

export interface VerdictTone { ink: string; wash: string }
export type VerdictPalette = Record<VerdictLevel, VerdictTone>;

export const Verdict = {
  // Deep field green — a botanist's ink, not a wellness gradient.
  safe: { ink: '#3F6B4C', wash: '#E4EBE1' },
  // The middle tier always names the specific doubt, never "moderate risk".
  caution: { ink: '#A96C12', wash: '#F3E6CE' },
  // Oxide red, not emergency red: serious without being a siren in the hand.
  avoid: { ink: '#A5291F', wash: '#F1DED8' },
} as const;

export const VerdictDark = {
  safe: { ink: '#6E9C79', wash: '#232C25' },
  caution: { ink: '#D69B3E', wash: '#2E2619' },
  avoid: { ink: '#D96154', wash: '#2E1E1B' },
} as const;

export const onVerdictInk = '#F6F1E7';

/** The app's risk levels map onto the design's verdict vocabulary. */
export const RISK_TO_VERDICT = {
  low: 'safe',
  moderate: 'caution',
  high: 'avoid',
} as const satisfies Record<'low' | 'moderate' | 'high', VerdictLevel>;

// Three faces, strict jobs. Newsreader never appears in a button or a label.
export const Font = {
  display: 'Newsreader_400Regular',
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansSemi: 'InstrumentSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const Type = {
  // lineHeight must stay >= fontSize; see verdictTextStyle for why.
  verdict: { fontFamily: Font.display, fontSize: 56, lineHeight: 70, letterSpacing: -1.7 },
  reason: { fontFamily: Font.sans, fontSize: 17, lineHeight: 24 },
  title: { fontFamily: Font.sansSemi, fontSize: 22, lineHeight: 27 },
  body: { fontFamily: Font.sans, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: Font.sansMedium, fontSize: 14, lineHeight: 18 },
  meta: { fontFamily: Font.mono, fontSize: 11, lineHeight: 15 },
  eyebrow: {
    fontFamily: Font.monoMedium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
} as const;

/**
 * The verdict word's type.
 *
 * The design specifies 56/50 — a line height BELOW the font size. That is a
 * CSS-web spec, where a too-small line box merely overlaps neighbours and the
 * glyph still paints. React Native CLIPS instead: the Text lays out to the
 * line height and shears anything taller. Newsreader is a serif with tall
 * ascenders, so 56/50 cut the top off "Safe" and off 避免 alike — this is not
 * a CJK problem, it is a line-box problem that CJK merely made obvious.
 *
 * So: line height is never below font size here. The design's optical
 * tightness is recovered with margin on the block, which moves the text
 * without shrinking the box it is painted in.
 *
 * Size still adapts to the string: long Latin words ("Precaucion", "No es
 * seguro") would otherwise wrap beside the seal. Keyed off the rendered text
 * rather than the UI language, so a new language needs no change here.
 */
export function verdictTextStyle(word: string) {
  const hasCJK = /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/.test(word);

  if (hasCJK) {
    // No display face for CJK — the system fallback carries its own metrics.
    return { fontSize: 52, lineHeight: 66, letterSpacing: 0 };
  }
  if (word.length > 8) {
    return { fontFamily: Font.display, fontSize: 38, lineHeight: 48, letterSpacing: -0.9 };
  }
  return { fontFamily: Font.display, fontSize: 56, lineHeight: 70, letterSpacing: -1.7 };
}

export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// Square by default — flat rules and square panels do the field-guide work.
// Only two things round: the rising verdict sheet, and controls you press.
export const Radius = { flat: 0, tile: 4, sheet: 28, pill: 999 } as const;

export const Gutter = 24;

export const Motion = {
  /**
   * The scan line's pass over the frozen frame.
   *
   * `ms` down, `back` up — ONE round trip, still not a loop. The design's rule
   * is that a looping scan line reads as "still trying", and that holds; a
   * single return pass reads as the eye going back over the label once, which
   * is what a person does. The return is quicker than the pass so it reads as
   * coming back rather than as a second scan.
   */
  sweep: { ms: 1100, back: 850, loops: 1 },
  /**
   * The reveal — an aperture travelling once down a block of content, which
   * resolves as it passes.
   *
   * `settle` is not optional decoration. A permanently masked block is
   * permanently unreadable, so the reveal must always END fully resolved; the
   * aperture is a transition into clarity, never a state the reader is left
   * in.
   */
  reveal: { ms: 900, settle: 320, window: 132 },
  rise: { ms: 420, dy: 46 },
  seal: { ms: 450, delay: 200, rotate: -4 },
  press: { ms: 120 },
} as const;

export function useSurface(): Surface {
  return useColorScheme() === 'dark' ? Lamplight : Paper;
}

export function useVerdictColors(): VerdictPalette {
  return useColorScheme() === 'dark' ? VerdictDark : Verdict;
}

/** Below three of five confidence segments, show the uncertain state. */
export const CONFIDENCE_SEGMENTS = 5;
export const MIN_CONFIDENT_SEGMENTS = 3;

/**
 * Segments for a known read confidence, or `null` when it is UNKNOWN.
 *
 * Unknown is not the same as low. Scans replayed from history carry no
 * confidence (it isn't persisted), and treating that absence as a poor read
 * made every stored scan display "Not sure" — overriding the verdict it was
 * actually saved with. Absence of evidence must not manufacture doubt.
 */
export function confidenceSegments(confidence?: 'high' | 'medium' | 'low'): number | null {
  if (confidence === 'high') return 5;
  if (confidence === 'medium') return 3;
  if (confidence === 'low') return 2;
  return null;
}
