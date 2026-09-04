import { useState } from 'react';
import { Modal, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Radius, Space, Type, useSurface } from '@/constants/design';
import {
  LANGUAGE_CODES,
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  useTranslation,
} from '@/lib/i18n';

/**
 * Change the app's language from a screen you can reach without an account.
 *
 * The full control lives on the Account screen, which is the right home for it
 * — language is a set-once choice, not something to trip over. But Account is
 * behind a sign-in, and someone who cannot read the sign-in screen cannot get
 * to the setting that would fix it. That is a closed loop, and this opens it.
 *
 * NOT A FLAG. A flag is a country and a language is not: English is not the
 * United States to the several hundred million people who speak it elsewhere,
 * and Spain's flag on Spanish tells nine of every ten Spanish speakers the app
 * was not built with them in mind. The code is set in each language's own
 * script, in the mono face this system already uses for the machine's voice —
 * which is what a language tag is.
 *
 * A sheet rather than a tap-to-cycle: with three languages, cycling costs up
 * to three taps and never shows what the options are, so somebody who cannot
 * read the screen has to guess how many more times to press.
 */
export function LanguagePicker({ style }: { style?: StyleProp<ViewStyle> }) {
  const surface = useSurface();
  const { language, setLanguage, t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={[styles.trigger, { borderColor: surface.rule }, style]}
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`${t('account.languageLabel')}: ${LANGUAGE_NAMES[language]}`}
      >
        <ThemedText style={[styles.code, { color: surface.inkMuted }]}>
          {LANGUAGE_CODES[language]}
        </ThemedText>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        {/* The backdrop is its own dismiss target. A sheet with no way out but
            a small ✕ is the thing that traps the exact person this control
            exists for. */}
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel={t('common.close')}
        >
          <Pressable
            style={[styles.sheet, { backgroundColor: surface.card, borderTopColor: surface.rule }]}
            // Swallows taps so pressing the sheet itself does not dismiss it.
            onPress={() => {}}
          >
            {/* The eyebrow alone. A line under it used to explain that the
                ingredient explanations arrive in this language too, which is
                worth saying on the Account screen, where somebody is reading
                their settings. Here they are mid-tap on a control whose three
                options are already visible below it. */}
            <ThemedText style={[Type.eyebrow, styles.eyebrow, { color: surface.inkFaint }]}>
              {t('account.languageLabel')}
            </ThemedText>

            {SUPPORTED_LANGUAGES.map((code) => {
              const active = code === language;
              return (
                <Pressable
                  key={code}
                  style={[styles.option, { borderColor: active ? surface.ink : surface.rule }]}
                  onPress={() => {
                    setLanguage(code);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  {/* Each language named in ITSELF, never translated into the
                      one currently showing. Somebody hunting for Spanish is
                      looking for the word "Español", not for "Spanish" spelled
                      out in a script they cannot read. */}
                  <ThemedText style={[Type.label, styles.optionName, { color: surface.ink }]}>
                    {LANGUAGE_NAMES[code]}
                  </ThemedText>
                  {active ? (
                    <ThemedText style={[styles.check, { color: surface.ink }]}>✓</ThemedText>
                  ) : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Round, because it is a control you press — the one thing roundness means
  // in this system besides a sheet.
  trigger: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: 6,
    minWidth: 52,
    alignItems: 'center',
  },
  code: {
    fontFamily: Font.monoMedium,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.2,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(22,19,15,0.45)',
  },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Gutter,
    paddingTop: Space.xl,
    paddingBottom: Space.xxl + Space.lg,
    gap: Space.sm,
  },
  // Matches the sign-in drawer, which holds the same gap the same way.
  eyebrow: { marginBottom: Space.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.lg,
  },
  optionName: { flex: 1 },
  check: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },
});
