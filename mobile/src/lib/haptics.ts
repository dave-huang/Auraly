import * as Haptics from 'expo-haptics';

import type { RiskLevel } from './types';
import { MIN_CONFIDENT_SEGMENTS, confidenceSegments } from '@/constants/design';

// Haptic patterns from the design system. Each verdict has its own signature
// so the answer registers in the hand before the card is readable — and so
// the three verdicts stay distinguishable without looking at the screen.
//
// The uncertain state is deliberately silent: buzzing for "I don't know"
// would read as an answer.

const PATTERNS: Record<RiskLevel, () => Promise<void>> = {
  // One soft tap, timed to the card seating.
  low: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  // Tap, 90ms gap, lighter tap — the warning notification pattern.
  moderate: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await wait(90);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  // Sharp double, 60ms apart.
  high: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await wait(60);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fireVerdictHaptic(
  risk: RiskLevel,
  confidence?: 'high' | 'medium' | 'low',
): Promise<void> {
  // Silent only on a KNOWN poor read. Unknown confidence (a replayed scan)
  // still deserves its haptic — the verdict stands.
  const segments = confidenceSegments(confidence);
  if (segments !== null && segments < MIN_CONFIDENT_SEGMENTS) return;
  try {
    await PATTERNS[risk]();
  } catch {
    // Haptics are unavailable on simulators and some Android devices —
    // never let a missing motor break the scan flow.
  }
}
