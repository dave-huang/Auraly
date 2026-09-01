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
                <Stack.Screen name="results" options={{ animation: 'fade', animationDuration: 140 }} />
                <Stack.Screen name="history" />
                <Stack.Screen name="scan-detail" />
                <Stack.Screen name="account" />
                <Stack.Screen name="profiles" options={{ presentation: 'modal' }} />
                <Stack.Screen name="profile-edit" options={{ presentation: 'modal' }} />
                <Stack.Screen name="ingredient" options={{ presentation: 'modal' }} />
                <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
              </Stack>
            </View>
          </AuthProvider>
        </TranslatedErrorBoundary>
      </I18nProvider>
    </ErrorBoundary>
  );
}
