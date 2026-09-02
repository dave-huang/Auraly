import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InkWashPlate, type PlateName } from '@/components/inkwash-plate';
import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Radius, Space, Type, useSurface } from '@/constants/design';

// The frame every onboarding step is poured into.
//
// It exists because the flow went from four steps to eleven. Four steps could
// live as four branches inside one screen; eleven cannot, and the moment the
// chrome is copied per step it starts drifting — a title one size larger here,
// a footer one gap tighter there — which is exactly how a flow stops feeling
// like one flow.
//
// WHY THE HEADER CARRIES BACK, AND THE FOOTER DOES NOT
//
// Back used to sit in the footer next to Next, so the two most different
// actions on the screen were adjacent and the same size. It is now top-left,
// where a back control lives on every other screen of every other app, and the
// footer belongs entirely to the one thing we want pressed.
//
// WHY THE PROGRESS BAR IS CONTINUOUS
//
// It was segmented, borrowing the confidence meter's language. That reads well
// at four segments and reads as a barcode at eleven — and the flow's length is
// no longer fixed anyway (the strictness step only appears if there is
// something to be strict about). A filled proportion states the same fact and
// survives the count changing.

/**
 * Step titles are bigger than Type.title.
 *
 * Type.title is 22 and is sized to sit INSIDE a card, next to other things. An
 * onboarding step is one question alone on a page, and at 22 it looked like a
 * section heading for content that never arrived. Scoped here rather than
 * added to the type scale: this is a property of this flow, not a new rung
 * every screen may reach for.
 */
export const StepType = {
  title: { fontFamily: Font.sansSemi, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
} as const;

export function StepFrame({
  progress,
  onLeft,
  leftGlyph = '‹',
  leftLabel,
  title,
  body,
  plate,
  children,
  cta,
  onCta,
  ctaDisabled,
  secondary,
}: {
  /** 0 to 1. Drawn, never announced as "step N of M" — the count is unstable. */
  progress: number;
  onLeft: () => void;
  leftGlyph?: '‹' | '✕';
  leftLabel: string;
  title: string;
  body?: string;
  plate?: PlateName;
  children?: ReactNode;
  cta: string;
  onCta: () => void;
  ctaDisabled?: boolean;
  /** A quieter action under the button — "Skip", "Not now". */
  secondary?: { label: string; onPress: () => void };
}) {
  const surface = useSurface();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
      {/* Each plate carries its own measured opacity, so no screen sets one. */}
      {plate ? <InkWashPlate name={plate} /> : null}

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={onLeft}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel={leftLabel}
            style={[styles.leftControl, { borderColor: surface.rule, backgroundColor: surface.card }]}
          >
            <ThemedText style={[styles.leftGlyph, { color: surface.ink }]}>{leftGlyph}</ThemedText>
          </Pressable>

          <View style={[styles.track, { backgroundColor: surface.rule }]}>
            <View
              style={[
                styles.fill,
                { backgroundColor: surface.ink, width: `${Math.round(clamp(progress) * 100)}%` },
              ]}
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ThemedText style={[StepType.title, { color: surface.ink }]}>{title}</ThemedText>
          {body ? (
            <ThemedText style={[Type.reason, { color: surface.inkMuted }]}>{body}</ThemedText>
          ) : null}
          {children ? <View style={styles.slot}>{children}</View> : null}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: surface.rule }]}>
          <Pressable
            style={[styles.primary, { backgroundColor: surface.ink }, ctaDisabled && styles.disabled]}
            disabled={ctaDisabled}
            onPress={onCta}
            accessibilityRole="button"
          >
            <ThemedText style={[styles.primaryLabel, { color: surface.card }]}>{cta}</ThemedText>
          </Pressable>

          {secondary ? (
            <Pressable
              onPress={secondary.onPress}
              hitSlop={12}
              style={styles.secondary}
              accessibilityRole="button"
            >
              <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
                {secondary.label}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
    paddingHorizontal: Gutter,
    paddingTop: Space.md,
  },
  // A round control, which is the one place this flow rounds anything that is
  // not a button — it IS a button, and Cal-AI-style flows put it in a circle
  // because at 36pt a square back arrow reads as a card with a glyph in it.
  leftControl: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftGlyph: { fontFamily: Font.sansMedium, fontSize: 17, lineHeight: 20 },

  track: { flex: 1, height: 3, overflow: 'hidden' },
  fill: { height: 3 },

  content: {
    paddingHorizontal: Gutter,
    paddingTop: Space.xl,
    paddingBottom: Space.xxl,
    gap: Space.md,
  },
  slot: { marginTop: Space.lg, gap: Space.md },

  footer: {
    paddingHorizontal: Gutter,
    paddingTop: Space.md,
    paddingBottom: Space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Space.xs,
  },
  primary: { borderRadius: Radius.pill, paddingVertical: Space.lg, alignItems: 'center' },
  primaryLabel: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },
  disabled: { opacity: 0.4 },
  secondary: { alignItems: 'center', paddingVertical: Space.md },
});
