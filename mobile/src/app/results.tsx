import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnalysisView } from '@/components/analysis-view';
import { RisingSheet } from '@/components/rising-sheet';
import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Paper, Radius, Space, Type, useSurface } from '@/constants/design';
import { useAuth } from '@/lib/auth-context';
import { isPlaceholderName, useTranslation } from '@/lib/i18n';
import { goHome } from '@/lib/navigation';
import { useLastScan } from '@/lib/scan';

// The verdict card rises over the frozen frame — keeping the still behind it
// is what makes the card read as an object laid over the moment of capture,
// rather than a separate screen the app navigated to.
//
// It carries no back chevron for that reason, and for a while it had no way
// out at all except "Scan another product" at the foot of the card — which
// forces a decision ("do I want to shoot another label?") on someone who only
// wanted to put the card down. The ✕ sits in the top corner OVER the frame
// rather than on the card, because it dismisses the card and is not part of
// it, and it stays pinned while the card scrolls under it.
//
// Tapping the darkened frame does NOT dismiss. It would be the natural gesture
// for a card laid over a photo, but in React Native a tap on the card's own
// blank space — between rows, beside the seal — bubbles to the backdrop unless
// every one of those areas claims the touch. Losing a verdict mid-read is a
// far worse failure than having to reach for the ✕.
//
// Every exit here is goHome(), not `back`: the frozen frame is a moment that
// has passed, and leaving it on the stack would let a swipe resurrect a
// verdict the person just dismissed. goHome() unwinds to the viewfinder that
// is already underneath rather than building a second one — see
// lib/navigation, and the pile of cameras that got this written down.

export default function ResultsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const surface = useSurface();
  // Subscribed rather than read once: the profile switcher re-scores this
  // scan behind the sheet, and the card has to follow.
  const { result, profile, frame } = useLastScan();


  function dismiss() {
    goHome();
  }

  if (!result) return <Redirect href="/" />;

  return (
    <View style={styles.root}>
      {frame ? (
        <>
          <Image source={{ uri: frame }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={[StyleSheet.absoluteFill, styles.scrim]} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: surface.paper }]} />
      )}

      <SafeAreaView style={styles.safe} pointerEvents="box-none">
        <View style={styles.topBar} pointerEvents="box-none">
          <Pressable
            style={styles.closeButton}
            onPress={dismiss}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <ThemedText style={styles.closeGlyph}>✕</ThemedText>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <RisingSheet>
            {/* Controls live inside the card, part 7 of its fixed order: the
                card is the object, and the way out of it belongs to it. */}
            <AnalysisView
              result={result}
              profileName={profile?.name}
              profileAllergens={profile?.allergens}
              onRetake={goHome}
              onPressProfile={() => router.push('/profiles')}
              controls={
                <>
                  {/* The sign-in ask, and the only place it belongs.
                      Onboarding no longer opens with it: this is the moment
                      someone has a profile they built and a verdict they
                      wanted, which is the first point at which "keep this" is
                      a true sentence rather than a toll gate. Shown only to
                      someone with no account. */}
                  {!user && (
                    <View style={[styles.saveCard, { borderColor: surface.rule }]}>
                      <ThemedText style={[Type.label, { color: surface.ink }]}>
                        {t('signIn.saveTitle')}
                      </ThemedText>
                      <ThemedText style={[Type.body, { color: surface.inkMuted }]}>
                        {isPlaceholderName(profile?.name)
                          ? t('signIn.saveBodyYours')
                          : t('signIn.saveBody', { name: profile!.name })}
                      </ThemedText>
                      <Pressable
                        style={[styles.inkButton, { backgroundColor: surface.ink }]}
                        onPress={() =>
                          router.push({
                            pathname: '/sign-in',
                            params: { mode: 'save', name: profile?.name ?? '' },
                          })
                        }
                        accessibilityRole="button"
                      >
                        <ThemedText style={[Type.label, styles.inkLabel, { color: surface.card }]}>
                          {t('signIn.saveCta')}
                        </ThemedText>
                      </Pressable>
                    </View>
                  )}

                  <Pressable
                    style={[styles.inkButton, { backgroundColor: surface.ink }]}
                    onPress={goHome}
                  >
                    <ThemedText style={[Type.label, styles.inkLabel, { color: surface.card }]}>
                      {t('results.scanAnother')}
                    </ThemedText>
                  </Pressable>
                </>
              }
            />
          </RisingSheet>
        </ScrollView>
      </SafeAreaView>

    </View>
  );
}

const styles = StyleSheet.create({
  saveCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    padding: Space.lg,
    gap: Space.md,
    marginBottom: Space.md,
  },
  root: { flex: 1, backgroundColor: '#16130F' },
  scrim: { backgroundColor: 'rgba(22,19,15,0.72)' },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  // Chrome over the frame, not over paper: it takes lamplight colours the same
  // way the viewfinder's controls do.
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Gutter, paddingTop: Space.sm },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(14,12,10,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(246,241,231,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20, color: Paper.paper },
  content: { padding: Gutter, gap: Space.lg, paddingTop: Space.lg, paddingBottom: Space.xxl },
  inkButton: { borderRadius: Radius.pill, paddingVertical: Space.lg, alignItems: 'center' },
  // The design specifies the primary control at 600/15, a step up from Type.label.
  inkLabel: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },
  offscreen: { position: 'absolute', left: -10000, top: 0 },
});
