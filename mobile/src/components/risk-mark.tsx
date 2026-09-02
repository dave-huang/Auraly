import { StyleSheet, View } from 'react-native';

import { RiskSignal } from '@/constants/design';
import type { RiskLevel } from '@/lib/types';

/**
 * The risk mark on an ingredient row: green, amber or red.
 *
 * COLOUR CARRIES THE LEVEL, AND SO DOES SHAPE.
 *
 * The first version of this leaned entirely on the three verdict inks, and
 * measured against each other they cannot do the job at this size: avoid
 * against caution is a contrast ratio of 1.65:1, avoid against safe is 1.16:1,
 * where 3:1 is the usual floor for telling two graphics apart. They are three
 * dark, similarly heavy inks. Distinguishable side by side in a swatch, and not
 * at 10pt in a list of thirty, which is the only place they actually appear.
 *
 * The fix at the time was to let SHAPE say it instead, and to accept that the
 * colour was decorative. That was half right. A traffic light is the one visual
 * convention every person on earth already knows, and throwing it away in a
 * list whose entire job is "is this a problem" gave up more than it gained.
 *
 * So both channels now carry it. The ink comes from RiskSignal, which is
 * pushed until the hues genuinely separate, and the form stays:
 *
 *   high     a filled disc, the heaviest mark on the row
 *   moderate a ring, open in the middle: look at this
 *   low      a short rule, quiet and level
 *
 * Shape is not belt and braces here, it is the accessible channel. Red against
 * amber is the single most common colour confusion there is and it affects
 * around one man in twelve, so the list has to stay readable with the colour
 * removed entirely.
 *
 * The mark is 12pt rather than the 10 it started at, because a hue needs a
 * little more area than a silhouette does before the eye will name it.
 */
export function RiskMark({ level }: { level: RiskLevel }) {
  const tone = RiskSignal[level];

  if (level === 'high') {
    return <View style={[styles.disc, { backgroundColor: tone.ink }]} />;
  }
  if (level === 'moderate') {
    // Washed inside as well as ringed: an open circle at 12pt carries very
    // little of its own colour, and the wash is what makes it read amber at a
    // glance rather than just "not filled in".
    return (
      <View style={[styles.ring, { borderColor: tone.ink, backgroundColor: tone.wash }]} />
    );
  }
  return <View style={[styles.rule, { backgroundColor: tone.ink }]} />;
}

const styles = StyleSheet.create({
  // One 12pt box for all three, so the rows' text stays on a single left edge.
  disc: { width: 12, height: 12, borderRadius: 6 },
  ring: { width: 12, height: 12, borderRadius: 6, borderWidth: 3 },
  rule: { width: 12, height: 3, borderRadius: 1.5, marginVertical: 4.5 },
});
