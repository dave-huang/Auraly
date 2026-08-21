import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Font, Motion, Space } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/reduced-motion';

// The frozen frame. On capture the photo freezes full-bleed and a scan line
// sweeps it exactly ONCE — the design is explicit that a looping scanner
// reads as "still trying". When the sweep is done but analysis is still
// running, the frame simply holds with a mono status line, which is the
// honest signal that work continues without implying repeated attempts.

export function ScanProgress({
  imageUri,
  phase,
  ingredientCount,
}: {
  imageUri?: string;
  phase: 'reading' | 'analyzing';
  ingredientCount?: number;
}) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();

  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    sweep.value = 0;
    sweep.value = withTiming(1, {
      duration: Motion.sweep.ms,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
    // No repeat: the sweep is a single pass, by design.
  }, [reduced, sweep]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sweep.value * height }],
    opacity: sweep.value > 0 && sweep.value < 1 ? 1 : 0,
  }));

  const status =
    phase === 'analyzing'
      ? ingredientCount
        ? t('scan.foundIngredients', { count: ingredientCount })
        : t('scan.analyzing')
      : t('scan.reading');

  return (
    <View style={styles.container}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
      <View style={styles.scrim} />

      {!reduced ? <Animated.View style={[styles.sweepLine, sweepStyle]} /> : null}

      <View style={styles.statusWrap}>
        <ThemedText style={styles.status}>{status}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFill, backgroundColor: '#16130F' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(22,19,15,0.55)' },
  sweepLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: '#F6F1E7',
    shadowColor: '#F6F1E7',
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  statusWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Space.xxl * 2,
    alignItems: 'center',
  },
  status: {
    fontFamily: Font.mono,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#F6F1E7',
    backgroundColor: 'rgba(22,19,15,0.72)',
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    overflow: 'hidden',
  },
});
