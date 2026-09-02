import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Space, Type, useSurface } from '@/constants/design';

// The full-width option row.
//
// Chips are right for "pick eight of fifteen allergens" — they are small,
// scannable, and the list is long. They are wrong for "which of these three
// describes you", where each option needs a sentence of explanation and the
// answer is exclusive. This is that control.
//
// WHY SELECTION IS A BORDER AND A DOT, NOT AN INK FILL
//
// Chip selection is a solid ink fill, and at chip size that is right. At full
// width it is a black slab three lines tall, and two of them selected turns
// the page into a barcode. So the row keeps its paper and states selection the
// way a form does: the border goes to ink, and the dot fills. Same vocabulary,
// scaled to the size of the thing.

export function ChoiceCard({
  label,
  hint,
  selected,
  onPress,
  multi = false,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  /** Checkbox semantics and a square marker, when more than one may be chosen. */
  multi?: boolean;
}) {
  const surface = useSurface();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: selected } : { selected }}
      style={[
        styles.card,
        { backgroundColor: surface.card, borderColor: surface.rule },
        selected && { borderColor: surface.ink, borderWidth: 1.5 },
      ]}
    >
      <View style={styles.text}>
        <ThemedText style={[Type.label, { color: surface.ink }]}>{label}</ThemedText>
        {hint ? (
          <ThemedText style={[Type.body, { color: surface.inkMuted }]}>{hint}</ThemedText>
        ) : null}
      </View>

      <View
        style={[
          styles.marker,
          multi && styles.markerSquare,
          { borderColor: selected ? surface.ink : surface.rule },
        ]}
      >
        {selected ? (
          <View
            style={[styles.dot, multi && styles.dotSquare, { backgroundColor: surface.ink }]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.tile,
    paddingVertical: Space.lg,
    paddingHorizontal: Space.lg,
    // Selected rows grow their border from hairline to 1.5, which would shift
    // every sibling by a point. Reserving the difference in padding keeps the
    // list still as the selection moves down it.
    marginVertical: 0,
  },
  text: { flex: 1, gap: Space.xs },

  marker: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerSquare: { borderRadius: 3 },
  dot: { width: 10, height: 10, borderRadius: Radius.pill },
  dotSquare: { borderRadius: 2 },
});
