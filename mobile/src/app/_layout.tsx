import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
} from '@expo-google-fonts/instrument-sans';
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';

import { ErrorBoundary, TranslatedErrorBoundary } from '@/components/error-boundary';
import { useSurface } from '@/constants/design';
import { AuthProvider } from '@/lib/auth-context';
import { apiCrashSink, installCrashHandlers, setCrashSink } from '@/lib/crash';
import { I18nProvider } from '@/lib/i18n';

SplashScreen.preventAutoHideAsync();

// Installed at module load, before any component renders, so an error thrown
// on the way up is still caught. Inside an effect it would miss exactly the
// startup failures that are hardest to reproduce.
setCrashSink(apiCrashSink);
installCrashHandlers();

export default function RootLayout() {
  const surface = useSurface();
  const [fontsLoaded] = useFonts({
    Newsreader_400Regular,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Hold the splash rather than flashing system fonts — the three faces carry
  // most of the brand, and a swap mid-read is worse than a beat of splash.
  if (!fontsLoaded) return null;

  return (
    // Two boundaries, and the nesting is the point.
    //
    // The outer one sits above the providers, because a boundary below them
    // cannot catch an error thrown by the providers themselves — and auth and
    // i18n both do work at mount, which is exactly where a cold-start crash
    // comes from. It falls back to English, because reading a translation is
    // the very thing that may have just failed.
    //
    // The inner one gets the translations, and covers everything a person is
    // actually likely to hit: a screen throwing while they use the app.
    <ErrorBoundary onReset={() => router.replace('/')}>
      <I18nProvider>
        <TranslatedErrorBoundary onReset={() => router.replace('/')}>
          <AuthProvider>
            <View style={{ flex: 1, backgroundColor: surface.paper }}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: surface.paper },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
                <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="demo" options={{ animation: 'fade' }} />
                <Stack.Screen name="trial" options={{ animation: 'fade' }} />
                <Stack.Screen name="reminder" options={{ animation: 'fade' }} />
                <Stack.Screen name="results" options={{ animation: 'fade', animationDuration: 140 }} />
                <Stack.Screen name="history" />
                <Stack.Screen name="scan-detail" />
                <Stack.Screen name="account" />
                <Stack.Screen name="profiles" options={{ presentation: 'modal' }} />
                <Stack.Screen name="profile-edit" options={{ presentation: 'modal' }} />
                <Stack.Screen name="ingredient" options={{ presentation: 'modal' }} />
                {/* A CARD, NOT A SHEET, and it was a sheet for a long time.
                    The subscription screen is the last of the onboarding
                    steps — it is reached by replacing the reminder, it carries
                    the same round ‹ the other eleven carry, and it fades in
                    the way trial and reminder do. Presenting the last step of
                    a flow as a modal made it the one screen whose chrome
                    changed shape at the end, and it is what made a second
                    paywall stacked on the first visibly an overlay.

                    No back gesture, because a card presentation offers one and
                    the paywall is the one screen that must not honour it. A
                    swipe would bypass the screen's own close, which is
                    deliberate about where a gate goes back to; and at a gate
                    reached from the camera it would pop to a viewfinder that
                    redirects straight back here, so the gesture would visibly
                    fight itself. The steps either side of it have no gesture
                    either — nothing is behind them. */}
                <Stack.Screen
                  name="paywall"
                  options={{ animation: 'fade', gestureEnabled: false }}
                />
              </Stack>
            </View>
          </AuthProvider>
        </TranslatedErrorBoundary>
      </I18nProvider>
    </ErrorBoundary>
  );
}
