import { StyleSheet, View } from 'react-native';

import { RiskSignal } from '@/constants/design';
import type { RiskLevel } from '@/lib/types';

/**
 * The risk mark on an ingredient row: green, amber or red.
 *
 * ONE SHAPE, THREE COLOURS.
 *
 * This mark has been through both mistakes. It began as three verdict inks and
 * nothing else, which failed on measurement: avoid against caution is 1.65:1
 * and avoid against safe is 1.16:1, so at 10pt in a list of thirty the colour
 * was decorative and the levels were indistinguishable. The fix was to give
 * each level its own silhouette — a disc, a ring, a rule — and that worked, but
 * it bought legibility with a vocabulary nobody arrives already knowing. A ring
 * does not mean "middling" to anyone who has not been told, and the shapes made
 * three levels look like three different kinds of thing rather than three
 * points on one scale.
 *
 * A traffic light is the one visual convention every person on earth already
 * has. So the shapes are gone and the marks are three identical discs, which is
 * what a scale looks like: same object, moved along it. The work the shapes
 * were doing is now done by the hues themselves, which were rebuilt for this in
 * `RiskSignal` — see the note there for why the amber is a gold and not the
 * yellow it wants to be.
 *
 * COLOUR IS NOT THE ONLY CHANNEL, and it must not be. Red against amber is the
 * most common colour confusion there is, affecting around one man in twelve,
 * and three identical discs give that reader nothing. What saves the row is not
 * this component: it is the note beside it. Every row in the list ends in words
 * that name the level — "No concern", "Worth watching", "Regulated" — so the
 * list stays readable with the colour removed entirely. If that note is ever
 * dropped from a row, this mark has to grow a second channel again.
 */
export function RiskMark({ level }: { level: RiskLevel }) {
  return <View style={[styles.disc, { backgroundColor: RiskSignal[level].ink }]} />;
}

const styles = StyleSheet.create({
  // 12pt rather than the 10 it started at: a hue needs a little more area than
  // a silhouette does before the eye will name it.
  disc: { width: 12, height: 12, borderRadius: 6 },
});
