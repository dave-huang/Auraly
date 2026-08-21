import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnalysisView } from '@/components/analysis-view';
import { RisingSheet } from '@/components/rising-sheet';
import { ShareCard, type ShareFormat } from '@/components/share-card';
import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Radius, Space, Type, useSurface } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import { useLastScan } from '@/lib/scan';
import { captureAndShare, shareLayoutSize } from '@/lib/share';
import { useVerdictCopy } from '@/lib/verdict';

// The verdict card rises over the frozen frame — keeping the still behind it
// is what makes the card read as an object laid over the moment of capture,
// rather than a separate screen the app navigated to.

export default function ResultsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const surface = useSurface();
  // Subscribed rather than read once: the profile switcher re-scores this
  // scan behind the sheet, and the card has to follow.
  const { result, profile, frame } = useLastScan();

  const feedRef = useRef<View>(null);
  const storyRef = useRef<View>(null);
  const [sharing, setSharing] = useState<ShareFormat | null>(null);

  const copy = useVerdictCopy(result ?? ({} as any), profile?.name);

  if (!result) return <Redirect href="/" />;

  async function share(format: ShareFormat) {
    setSharing(format);
    try {
      await captureAndShare(format === 'feed' ? feedRef : storyRef, format);
    } catch (e: any) {
      Alert.alert(t('share.failed'), e?.message ?? t('common.tryAgain'));
    } finally {
      setSharing(null);
    }
  }

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

      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <RisingSheet>
            {/* Controls live inside the card, part 7 of its fixed order: the
                card is the object, and the way out of it belongs to it. */}
            <AnalysisView
              result={result}
              profileName={profile?.name}
              profileAllergens={profile?.allergens}
              onRetake={() => router.replace('/')}
              onPressProfile={() => router.push('/profiles')}
              controls={
                <>
                  <Pressable
                    style={[styles.inkButton, { backgroundColor: surface.ink }]}
                    onPress={() => router.replace('/')}
                  >
                    <ThemedText style={[Type.label, styles.inkLabel, { color: surface.card }]}>
                      {t('results.scanAnother')}
                    </ThemedText>
                  </Pressable>

                  <View style={styles.shareRow}>
                    {(['feed', 'story'] as const).map((format) => (
                      <Pressable
                        key={format}
                        style={[
                          styles.shareButton,
                          { borderColor: surface.rule, backgroundColor: surface.paper },
                        ]}
                        disabled={sharing !== null}
                        onPress={() => void share(format)}
                      >
                        {sharing === format ? (
                          <ActivityIndicator size="small" color={surface.ink} />
                        ) : (
                          <ThemedText style={[Type.label, { color: surface.ink }]}>
                            ↗ {t(format === 'feed' ? 'share.feed' : 'share.story')}
                          </ThemedText>
                        )}
                      </Pressable>
                    ))}
                  </View>
                </>
              }
            />
          </RisingSheet>
        </ScrollView>
      </SafeAreaView>

      {/* Off-screen render targets. Positioned far off-canvas rather than
          hidden with opacity/display, because captureRef needs a laid-out,
          drawable view — a display:none subtree captures blank. */}
      <View style={styles.offscreen} pointerEvents="none">
        <View ref={feedRef} collapsable={false} style={shareLayoutSize('feed')}>
          <ShareCard
            format="feed"
            result={result}
            word={copy.word}
            reason={copy.why}
            sealLines={copy.sealLines}
            profileName={profile?.name}
            profileAllergens={profile?.allergens}
          />
        </View>
        <View ref={storyRef} collapsable={false} style={shareLayoutSize('story')}>
          <ShareCard
            format="story"
            result={result}
            word={copy.word}
            reason={copy.why}
            sealLines={copy.sealLines}
            profileName={profile?.name}
            profileAllergens={profile?.allergens}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#16130F' },
  scrim: { backgroundColor: 'rgba(22,19,15,0.72)' },
  safe: { flex: 1 },
  content: { padding: Gutter, gap: Space.lg, paddingTop: Space.xxl, paddingBottom: Space.xxl },
  shareRow: { flexDirection: 'row', gap: Space.md },
  shareButton: {
    flex: 1,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Space.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  inkButton: { borderRadius: Radius.pill, paddingVertical: Space.lg, alignItems: 'center' },
  // The design specifies the primary control at 600/15, a step up from Type.label.
  inkLabel: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },
  offscreen: { position: 'absolute', left: -10000, top: 0 },
});
