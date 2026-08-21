import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
} from '@expo-google-fonts/instrument-sans';
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';

import { useSurface } from '@/constants/design';
import { AuthProvider } from '@/lib/auth-context';
import { I18nProvider } from '@/lib/i18n';

SplashScreen.preventAutoHideAsync();

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
    <I18nProvider>
      <AuthProvider>
        <View style={{ flex: 1, backgroundColor: surface.paper }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: surface.paper },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
            <Stack.Screen name="onboarding" />
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
    </I18nProvider>
  );
}
