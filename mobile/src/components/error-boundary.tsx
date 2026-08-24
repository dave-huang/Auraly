import * as Clipboard from 'expo-clipboard';
import { Component, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Radius, Space, Type, useSurface } from '@/constants/design';
import { reportCrash, type CrashReport } from '@/lib/crash';
import { useTranslation } from '@/lib/i18n';

/**
 * The screen a person gets instead of a white one.
 *
 * Before this, an error thrown during render unmounted the tree and left the
 * app showing nothing — no message, no way back, and no reason for the person
 * to think it would ever work again. Force-quitting was the only move, and
 * nobody would guess that.
 *
 * THE FALLBACK MUST NOT DEPEND ON WHAT MAY HAVE JUST FAILED
 *
 * This is the trap in the whole idea, and the first version of this file walked
 * straight into it. The fallback read its wording through `useTranslation`,
 * which throws outside an `I18nProvider` — so a boundary placed above the
 * providers, precisely to catch a provider failing at startup, would itself
 * throw while rendering its own error screen, and land the person on the white
 * screen this file exists to abolish.
 *
 * So the fallback takes its strings as props and defaults them to English.
 * `useSurface` is the only hook it calls, and that one reads the OS colour
 * scheme and needs no provider. `TranslatedErrorBoundary` below adds the
 * translations and belongs INSIDE the providers; the plain one belongs outside,
 * where English is the honest best effort.
 *
 * Two things it deliberately does not do.
 *
 * It does not show the error text. A stack trace tells the person nothing they
 * can act on, and here it can leak: the message may quote a profile name or a
 * line off a label. The details are copyable instead — a deliberate act, by
 * someone who has decided to send them.
 *
 * And it does not offer to retry the thing that just failed. `reset` clears the
 * boundary and returns to the start of the app, because whatever state produced
 * the error is still there, and retrying into it just fails again in front of
 * someone who has now been told it was fixed.
 */

export interface CrashStrings {
  title: string;
  body: string;
  restart: string;
  copy: string;
}

const ENGLISH: CrashStrings = {
  title: 'Something went wrong',
  body: 'The app hit an unexpected problem and had to stop what it was doing. Your scans and profiles are safe.',
  restart: 'Start over',
  copy: 'Copy error details',
};

interface Props {
  children: ReactNode;
  /** Route name for the report. Never route params — they carry scan data. */
  screen?: string;
  /** Called after a reset, to return the app to a known-good state. */
  onReset?: () => void;
  /** Defaults to English so the fallback needs no provider to render. */
  strings?: CrashStrings;
}

interface State {
  report: CrashReport | null;
  /** Set when the fallback ITSELF threw. */
  fallbackFailed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { report: null, fallbackFailed: false };

  componentDidCatch(error: Error): void {
    // A second error while the fallback is on screen means the fallback is the
    // thing that is broken. Reporting it again would loop; the last resort is
    // bare text with no styling and no hooks at all.
    if (this.state.report) {
      this.setState({ fallbackFailed: true });
      return;
    }
    const report = reportCrash(error, 'render', { fatal: false, screen: this.props.screen });
    this.setState({ report });
  }

  reset = (): void => {
    this.setState({ report: null, fallbackFailed: false });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (!this.state.report) return this.props.children;
    if (this.state.fallbackFailed) {
      return (
        <View style={styles.lastResort}>
          <ThemedText style={styles.lastResortText}>{ENGLISH.title}</ThemedText>
        </View>
      );
    }
    return (
      <CrashScreen
        report={this.state.report}
        strings={this.props.strings ?? ENGLISH}
        onReset={this.reset}
      />
    );
  }
}

/**
 * The same boundary, wired to the app's translations.
 *
 * Belongs inside `I18nProvider`. Use the plain `ErrorBoundary` above it.
 */
export function TranslatedErrorBoundary({ children, ...rest }: Omit<Props, 'strings'>) {
  const { t } = useTranslation();
  return (
    <ErrorBoundary
      {...rest}
      strings={{
        title: t('crash.title'),
        body: t('crash.body'),
        restart: t('crash.restart'),
        copy: t('crash.copy'),
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

function CrashScreen({
  report,
  strings,
  onReset,
}: {
  report: CrashReport;
  strings: CrashStrings;
  onReset: () => void;
}) {
  const surface = useSurface();

  async function copyDetails() {
    // Already scrubbed on the way into the report; this is the same text a sink
    // would receive, which is the point — nothing is shown to a person that we
    // would not have been willing to send.
    const lines = [
      report.message,
      report.stack ?? '',
      `${report.origin}${report.screen ? ` · ${report.screen}` : ''}`,
      `v${report.appVersion} (${report.buildVersion}) · ${report.platform} ${report.osVersion}`,
      new Date(report.at).toISOString(),
    ];
    await Clipboard.setStringAsync(lines.filter(Boolean).join('\n'));
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: surface.paper }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <ThemedText style={[Type.title, { color: surface.ink }]}>{strings.title}</ThemedText>
          <ThemedText style={[Type.body, { color: surface.inkMuted }]}>{strings.body}</ThemedText>
        </View>

        <Pressable
          style={[styles.primary, { backgroundColor: surface.ink }]}
          onPress={onReset}
          accessibilityRole="button"
        >
          <ThemedText style={[styles.primaryLabel, { color: surface.card }]}>
            {strings.restart}
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => void copyDetails()}
          hitSlop={10}
          style={styles.copy}
          accessibilityRole="button"
        >
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>{strings.copy}</ThemedText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Gutter,
    paddingVertical: Space.xxl,
    gap: Space.xl,
  },
  head: { gap: Space.md },
  primary: { borderRadius: Radius.pill, paddingVertical: Space.lg, alignItems: 'center' },
  primaryLabel: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },
  copy: { alignItems: 'center', paddingVertical: Space.sm },
  // No tokens, no hooks: this renders when everything above it has failed.
  lastResort: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F1E7' },
  lastResortText: { color: '#16130F', fontSize: 16 },
});
