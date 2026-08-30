import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApertureMark, RevelyLockup } from '@/components/aperture-mark';
import { ScanProgress } from '@/components/scan-progress';
import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Lamplight, Paper, Radius, Space, Type, useSurface } from '@/constants/design';
import { useAuth } from '@/lib/auth-context';
import { useEntitlement } from '@/lib/entitlement';
import { fireVerdictHaptic } from '@/lib/haptics';
import { saveScan } from '@/lib/history';
import { useTranslation } from '@/lib/i18n';
import { getActiveProfileId, listProfiles } from '@/lib/profiles';
import { pollAnalysis, prepareImage, setLastResult, submitScan } from '@/lib/scan';
import type { Profile, ProductType } from '@/lib/types';
import { localizeAllergen } from '@/lib/verdict';

// Screen 01 — Launch · Viewfinder.
//
// Camera first, zero taps: cold start lands on a live frame, with no splash
// beyond the held one and no home tab. Everything the deleted home screen
// carried reaches the user from this screen's chrome.
//
// Geometry is the handoff's, transcribed at 393 × 852. The reticle sits at a
// fixed offset rather than being centred in the leftover space, because the
// design puts it high — a label held at arm's length lands in the upper half
// of the frame, and centring it makes people crouch.
const RETICLE = { top: 250, inset: 44, height: 290, bracket: 30, stroke: 2 };
const SHUTTER = { size: 78, ring: 3, fill: 62 };
const SIDE_CONTROL = 46;

// Viewfinder chrome is always lamplight: it floats over a camera feed, so it
// takes its colours from the frame, not from the device theme.
const OVER_FRAME = {
  ink: Paper.paper,
  muted: Lamplight.inkMuted,
  scrim: 'rgba(14,12,10,0.6)',
  hairline: 'rgba(246,241,231,0.18)',
};

export default function ViewfinderScreen() {
  const router = useRouter();
  const surface = useSurface();
  const { t, language } = useTranslation();
  const { user, isLoading } = useAuth();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  /**
   * Whether the camera session should be running.
   *
   * iOS interrupts the capture session when the app leaves the foreground and
   * does not resume it on return, which left the preview frozen on a stale
   * frame — live enough to look working, dead enough that takePictureAsync
   * rejects. `active` is expo-camera's own switch for exactly this: it tears
   * the session down and builds a fresh one rather than leaving an interrupted
   * one on screen.
   *
   * Screen focus counts too: the camera has no business holding the hardware
   * while someone reads a verdict on another screen.
   */
  const [appForeground, setAppForeground] = useState(AppState.currentState === 'active');
  const [screenFocused, setScreenFocused] = useState(true);
  const cameraActive = appForeground && screenFocused;

  /** Guards against a second shutter press before the first photo returns. */
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setAppForeground(next === 'active');
      // A capture in flight when the app backgrounds never settles, and a
      // stuck flag is indistinguishable from a broken button.
      if (next !== 'active') setCapturing(false);
    });
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );
  const [productType, setProductType] = useState<ProductType>('food');
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'reading' | 'analyzing' | null>(null);
  const [ingredientCount, setIngredientCount] = useState<number | undefined>();
  const [previewUri, setPreviewUri] = useState<string | undefined>();
  const [menuOpen, setMenuOpen] = useState(false);
  // Only meaningful with an account — the anonymous grant is counted per device
  // on the server, and this endpoint requires a token.
  const { entitlement } = useEntitlement(Boolean(user));

  useFocusEffect(
    useCallback(() => {
      // Runs signed in OR not. Before sign-in `listProfiles` returns the one
      // profile onboarding built on this device, which is what lets the very
      // first scan be about a person rather than about the average human.
      // Gating this on `user` was what made onboarding unreachable.
      Promise.all([listProfiles(), getActiveProfileId()])
        .then(([list, stored]) => {
          setProfiles(list);
          setActiveId(
            (stored && list.some((p) => p.id === stored) ? stored : null) ??
              list.find((p) => p.isDefault)?.id ??
              list[0]?.id ??
              null,
          );
        })
        .catch(() => setProfiles([]));
    }, []),
  );

  const activeProfile = profiles?.find((p) => p.id === activeId) ?? null;

  async function analyze(uri: string) {
    try {
      setPreviewUri(uri);
      setPhase('reading');
      setIngredientCount(undefined);
      const imageDataUrl = await prepareImage(uri);
      const requestId = await submitScan({
        imageDataUrl,
        productType,
        language,
        profileId: activeId ?? undefined,
      });
      const result = await pollAnalysis(requestId, (status) => {
        if (status.status === 'ocr_complete') {
          setPhase('analyzing');
          setIngredientCount(status.ingredientCount);
        }
      });
      setLastResult(
        result,
        activeProfile
          ? {
              id: activeProfile.id,
              name: activeProfile.name,
              allergens: activeProfile.allergens.map((a) => a.allergen),
            }
          : null,
        uri,
      );
      // Haptic fires before the card is readable — the body knows the answer
      // a beat before the eyes do.
      void fireVerdictHaptic(result.overallRisk, result.readConfidence);
      saveScan({ result, productType, language }).catch((e) =>
        console.warn('[SCAN] Failed to save to history:', e?.message),
      );
      setPhase(null);
      router.push('/results');
    } catch (error: any) {
      setPhase(null);

      // Out of scans. Not a failure, and it must not read as one — the app is
      // working exactly as designed, and an "Error" alert here trains people to
      // dismiss alerts. Straight to the paywall instead.
      if (error?.status === 402 || error?.code === 'no_scans') {
        router.push('/paywall');
        return;
      }
      // A claimed device signed out on this install: the person HAS an account
      // and the useful answer is to get them back into it, not to sell them a
      // second subscription.
      if (error?.code === 'sign_in_required') {
        router.push('/sign-in');
        return;
      }

      // "No label found" is the one failure the person can actually fix, and
      // it is common — so it gets a written sentence in their language, not the
      // server's English "OCR failed:" prose. Anything else is genuinely
      // unexpected and falls back to the raw message, which is at least
      // specific.
      const body =
        error?.code === 'no_label_found'
          ? t('scan.noLabelFound')
          : (error?.message ?? t('common.tryAgain'));
      Alert.alert(t('scan.failed'), body);
    }
  }

  async function capture() {
    // Two ways this used to do nothing at all. The camera could be mid-restart
    // after the app came back, so takePictureAsync rejected — and the rejection
    // went nowhere, because the caller is `void capture()`. And a double tap
    // fired a second capture over the first. Both looked identical from the
    // outside: a shutter that swallows presses.
    if (capturing || !cameraActive) return;
    setCapturing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const photo = await cameraRef.current?.takePictureAsync({ quality: 1 });
      if (photo?.uri) await analyze(photo.uri);
    } catch (error: any) {
      // analyze() handles its own failures; reaching here means the camera
      // itself refused. Say so rather than leaving the button looking broken.
      console.warn('[CAMERA] capture failed', error?.message);
      Alert.alert(t('scan.failed'), t('camera.captureFailed'));
    } finally {
      setCapturing(false);
    }
  }

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const uri = result.assets?.[0]?.uri;
    if (uri) await analyze(uri);
  }

  function openProfiles() {
    if (profiles && profiles.length === 0) router.push('/onboarding');
    else router.push('/profiles');
  }

  if (isLoading) return <View style={{ flex: 1, backgroundColor: surface.paper }} />;

  // The first launch is the whole argument for this block.
  //
  // This used to be `if (!user) return <Redirect href="/sign-in" />` — cold
  // start went straight to "Continue with Apple", before the app had shown a
  // single verdict, and /onboarding was reachable only by tapping a chip that
  // said "Set up first". Most people never saw it.
  //
  // Now: no account and no profile means they have not been through welcome,
  // so send them there. No account WITH a profile is the normal state during
  // onboarding — they scan anonymously, and the sign-in ask comes after the
  // first verdict, when there is something worth saving.
  //
  // `profiles === null` means the read has not finished. Holding the blank
  // frame for a beat is right: routing on an unloaded list would bounce someone
  // who has a profile out to welcome every cold start.
  if (profiles === null) return <View style={{ flex: 1, backgroundColor: surface.paper }} />;
  if (!user && profiles.length === 0) return <Redirect href="/welcome" />;

  // Camera priming.
  //
  // iOS gives an app exactly one chance at the system dialog. A denial is
  // effectively permanent — it can only be undone in Settings, which almost
  // nobody finds — so the ask is explained BEFORE it is made, and the two
  // states are told apart: `canAskAgain` false means the dialog is spent and
  // the honest next step is Settings, not a button that does nothing.
  if (!permission?.granted) {
    const spent = permission != null && !permission.canAskAgain;
    return (
      <SafeAreaView style={[styles.permission, { backgroundColor: surface.paper }]}>
        <RevelyLockup size={22} color={surface.ink} />
        <ThemedText style={[Type.title, styles.center, { color: surface.ink }]}>
          {t('camera.title')}
        </ThemedText>
        <ThemedText style={[Type.body, styles.center, { color: surface.inkMuted }]}>
          {spent ? t('camera.deniedBody') : t('camera.body')}
        </ThemedText>
        <Pressable
          style={[styles.inkButton, { backgroundColor: surface.ink }]}
          onPress={() => (spent ? void Linking.openSettings() : void requestPermission())}
          accessibilityRole="button"
        >
          <ThemedText style={[Type.label, { color: surface.card }]}>
            {spent ? t('camera.settings') : t('camera.allow')}
          </ThemedText>
        </Pressable>
        {/* hitSlop and padding are not decoration here. This is 11px mono type,
            which gives a tap target about 15 points tall against Apple's 44pt
            minimum — and it is the ONLY way forward for someone who has denied
            the camera. Missing it looks to them like the app is simply broken. */}
        <Pressable
          onPress={() => void pickFromLibrary()}
          hitSlop={{ top: 16, bottom: 16, left: 24, right: 24 }}
          style={styles.permissionSecondary}
          accessibilityRole="button"
        >
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
            {t('camera.library')}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" active={cameraActive} />

      {/* Vignette — pulls the eye to the middle of the frame and gives the
          paper chrome something to sit on at the edges. */}
      <View style={[StyleSheet.absoluteFill, styles.vignette]} pointerEvents="none" />

      {/* Reticle — four detached brackets, never a full box: it frames without
          caging, and it is the same shape as the app's mark. */}
      <View style={styles.reticle} pointerEvents="none">
        <View style={[styles.bracket, styles.tl]} />
        <View style={[styles.bracket, styles.tr]} />
        <View style={[styles.bracket, styles.bl]} />
        <View style={[styles.bracket, styles.br]} />
      </View>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        {/* Profile chip — mandatory here. It is the single element proving the
            answer will be about a person, not a product. */}
        <View style={styles.topBar}>
          <Pressable style={styles.profileChip} onPress={openProfiles}>
            <ApertureMark size={18} color={OVER_FRAME.ink} />
            <View style={styles.chipText}>
              <ThemedText style={styles.chipName} numberOfLines={1}>
                {activeProfile?.name ?? t('scan.setupFirst')}
              </ThemedText>
              <ThemedText style={styles.chipMeta} numberOfLines={1}>
                {/* Localized, not raw: the stored value is a matcher key like
                    "tree_nuts", and printing it here leaks the machine's
                    vocabulary into the one chip that names a person. */}
                {activeProfile?.allergens.map((a) => localizeAllergen(t, a.allergen)).join(' · ') ||
                  t('verdict.noAllergens')}
              </ThemedText>
            </View>
          </Pressable>
        </View>

        <View style={styles.bottomBar}>
          <View style={styles.typeToggle}>
            {(['food', 'personal_care'] as const).map((type) => (
              <Pressable
                key={type}
                style={[styles.typeOption, productType === type && styles.typeOptionActive]}
                onPress={() => setProductType(type)}
              >
                <ThemedText
                  style={[styles.typeLabel, productType === type && styles.typeLabelActive]}
                >
                  {type === 'food' ? t('scan.food') : t('scan.personalCare')}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText style={styles.hint}>{t('scan.hint')}</ThemedText>

          <View style={styles.captureRow}>
            {/* Gallery tile — a square, because it stands for a photo. */}
            <Pressable
              style={styles.galleryTile}
              onPress={() => void pickFromLibrary()}
              accessibilityLabel={t('scan.library')}
            >
              <View style={styles.galleryBack} />
              <View style={styles.galleryFront} />
            </Pressable>

            <Pressable
              style={[styles.shutter, (capturing || !cameraActive) && styles.shutterBusy]}
              onPress={() => void capture()}
              disabled={capturing || !cameraActive}
              accessibilityRole="button"
              accessibilityState={{ disabled: capturing || !cameraActive }}
            >
              <View style={styles.shutterInner} />
            </Pressable>

            <Pressable
              style={styles.menuCircle}
              onPress={() => setMenuOpen(true)}
              accessibilityLabel={t('scan.menu')}
            >
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.menuDot} />
              ))}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {phase ? (
        <ScanProgress imageUri={previewUri} phase={phase} ingredientCount={ingredientCount} />
      ) : null}

      <Modal visible={menuOpen} animationType="fade" transparent onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuBackdrop}>
          {/* The dismiss target sits behind the sheet rather than wrapping it,
              so a tap on the sheet's own padding doesn't close the menu. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
          <View style={styles.menuSheet}>
            {(
              [
                ['history.title', () => router.push('/history')],
                ['scan.switchProfile', openProfiles],
                [
                  // Subscribers see "Subscription"; everyone else sees
                  // "Subscribe". There is no count to show any more — the free
                  // grant is zero, so the row names the door instead of what is
                  // left behind it.
                  entitlement?.subscription.active
                    ? 'paywall.menuItemPlus'
                    : 'paywall.menuItem',
                  () => router.push('/paywall'),
                ],
                // Sign-out moved inside Account: deletion needs a screen that
                // can say what it removes before it removes it, and a menu row
                // cannot.
                ['account.menuItem', () => router.push('/account')],
              ] as const
            ).map(([key, action], i) => (
              <Pressable
                key={key}
                style={[styles.menuRow, i > 0 && styles.menuRowDivided]}
                onPress={() => {
                  setMenuOpen(false);
                  action();
                }}
              >
                <ThemedText style={[Type.label, { color: Lamplight.ink }]}>{t(key)}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  vignette: {
    experimental_backgroundImage:
      'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)',
  },
  overlay: { flex: 1, justifyContent: 'space-between' },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.lg,
    padding: Space.xl,
  },
  permissionSecondary: { paddingVertical: Space.md, paddingHorizontal: Space.xl },
  center: { textAlign: 'center' },
  inkButton: { paddingHorizontal: Space.xl, paddingVertical: Space.md, borderRadius: Radius.pill },

  topBar: { flexDirection: 'row', paddingHorizontal: Space.lg, paddingTop: Space.sm },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    backgroundColor: OVER_FRAME.scrim,
    borderWidth: 1,
    borderColor: OVER_FRAME.hairline,
    paddingLeft: Space.md,
    paddingRight: Space.lg,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    maxWidth: '100%',
  },
  chipText: { flexShrink: 1 },
  chipName: { fontFamily: Font.sansSemi, fontSize: 13, lineHeight: 17, color: OVER_FRAME.ink },
  // Allergens are the machine's readout of who this scan is for, so mono.
  chipMeta: { fontFamily: Font.mono, fontSize: 10, lineHeight: 14, color: OVER_FRAME.muted },

  reticle: {
    position: 'absolute',
    top: RETICLE.top,
    left: RETICLE.inset,
    right: RETICLE.inset,
    height: RETICLE.height,
  },
  bracket: {
    position: 'absolute',
    width: RETICLE.bracket,
    height: RETICLE.bracket,
    borderColor: OVER_FRAME.ink,
  },
  tl: { top: 0, left: 0, borderTopWidth: RETICLE.stroke, borderLeftWidth: RETICLE.stroke },
  tr: { top: 0, right: 0, borderTopWidth: RETICLE.stroke, borderRightWidth: RETICLE.stroke },
  bl: { bottom: 0, left: 0, borderBottomWidth: RETICLE.stroke, borderLeftWidth: RETICLE.stroke },
  br: { bottom: 0, right: 0, borderBottomWidth: RETICLE.stroke, borderRightWidth: RETICLE.stroke },

  bottomBar: { alignItems: 'center', gap: Space.lg, paddingBottom: Space.xl },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: OVER_FRAME.scrim,
    borderWidth: 1,
    borderColor: OVER_FRAME.hairline,
    borderRadius: Radius.pill,
    padding: 3,
  },
  typeOption: { paddingHorizontal: Space.lg, paddingVertical: 7, borderRadius: Radius.pill },
  typeOptionActive: { backgroundColor: OVER_FRAME.ink },
  typeLabel: { fontFamily: Font.sansMedium, fontSize: 13, lineHeight: 17, color: OVER_FRAME.ink },
  typeLabelActive: { color: Paper.ink },
  hint: { fontFamily: Font.mono, fontSize: 11, lineHeight: 15, color: OVER_FRAME.ink },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: Space.xxl,
  },

  galleryTile: {
    width: SIDE_CONTROL,
    height: SIDE_CONTROL,
    borderRadius: Radius.tile,
    backgroundColor: OVER_FRAME.scrim,
    borderWidth: 1,
    borderColor: OVER_FRAME.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryBack: {
    position: 'absolute',
    width: 16,
    height: 16,
    left: 13,
    top: 13,
    borderWidth: 1.5,
    borderColor: OVER_FRAME.muted,
  },
  galleryFront: {
    position: 'absolute',
    width: 16,
    height: 16,
    left: 18,
    top: 18,
    borderWidth: 1.5,
    borderColor: OVER_FRAME.ink,
    backgroundColor: OVER_FRAME.scrim,
  },

  shutter: {
    width: SHUTTER.size,
    height: SHUTTER.size,
    borderRadius: Radius.pill,
    borderWidth: SHUTTER.ring,
    borderColor: OVER_FRAME.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Visibly unavailable while the session restarts or a capture is in flight.
  // A shutter that refuses a press must look like it is refusing.
  shutterBusy: { opacity: 0.4 },
  shutterInner: {
    width: SHUTTER.fill,
    height: SHUTTER.fill,
    borderRadius: Radius.pill,
    backgroundColor: OVER_FRAME.ink,
  },

  menuCircle: {
    width: SIDE_CONTROL,
    height: SIDE_CONTROL,
    borderRadius: Radius.pill,
    backgroundColor: OVER_FRAME.scrim,
    borderWidth: 1,
    borderColor: OVER_FRAME.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  menuDot: { width: 3, height: 3, borderRadius: Radius.pill, backgroundColor: OVER_FRAME.ink },

  menuBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(14,12,10,0.5)' },
  menuSheet: {
    backgroundColor: Lamplight.card,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    paddingBottom: Space.xxl,
    paddingTop: Space.sm,
  },
  menuRow: { paddingHorizontal: Gutter, paddingVertical: Space.lg },
  menuRowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Lamplight.rule },
});
