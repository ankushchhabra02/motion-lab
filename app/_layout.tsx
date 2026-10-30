import { Asset } from 'expo-asset';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplash, LOGO_SOURCE } from '@/components/AnimatedSplash';
import { ErrorState } from '@/components/ErrorState';
import { FavoritesProvider, useFavorites } from '@/hooks/useFavorites';
import { GlassProvider } from '@/hooks/useGlass';
import { SettingsProvider, useSettings } from '@/hooks/useSettings';
import { SplashContext, splashStateFor, type SplashPhase } from '@/hooks/useSplash';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';

// Keep the native splash up until fonts, persisted state and the logo are ready.
// Must run at module scope, before the first render.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Deep links into a demo still get the tab bar underneath to go back to.
export const unstable_settings = { anchor: '(tabs)' };

/**
 * Catches render errors anywhere in the app and offers a retry. Expo Router
 * renders this *instead of* the layout, so it must bring its own providers.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <SettingsProvider>
          <ThemeProvider>
            <GlassProvider>
              <ErrorState error={error} onRetry={() => void retry()} />
            </GlassProvider>
          </ThemeProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <KeyboardProvider>
      <SafeAreaProvider>
        <SettingsProvider>
          <FavoritesProvider>
            <ThemeProvider>
              <GlassProvider>
                <AppGate />
              </GlassProvider>
            </ThemeProvider>
          </FavoritesProvider>
        </SettingsProvider>
      </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Splash handoff:
 * 1. Wait for fonts, settings, favorites and the logo bitmap.
 * 2. Mount the app and the in-app splash (same frame as the native one) on top.
 * 3. When the in-app splash has painted its logo, hide the native splash and
 *    start the timeline. If the paint callback never arrives, proceed anyway.
 */
function AppGate() {
  const { hydrated: settingsReady } = useSettings();
  const { hydrated: favoritesReady } = useFavorites();
  const theme = useTheme();

  const [logoReady, setLogoReady] = useState(false);
  const [overlayPainted, setOverlayPainted] = useState(false);
  const [phase, setPhase] = useState<SplashPhase>('pending');

  useEffect(() => {
    let mounted = true;
    Asset.loadAsync(LOGO_SOURCE)
      .catch(() => {})
      .finally(() => {
        if (mounted) setLogoReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const ready = settingsReady && favoritesReady && logoReady;

  useEffect(() => {
    if (!ready || overlayPainted) return;
    const fallback = setTimeout(() => setOverlayPainted(true), 1500);
    return () => clearTimeout(fallback);
  }, [ready, overlayPainted]);

  // Both flags only ever flip to true, so "started" can be derived rather than stored.
  const started = ready && overlayPainted;

  useEffect(() => {
    if (started) SplashScreen.hide();
  }, [started]);

  // Root view color behind every screen, so theme switches never flash white.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => {});
  }, [theme.colors.background]);

  // The native navigation theme must match ours, or Liquid Glass chrome flickers in dark mode.
  const navigationTheme = useMemo(() => {
    const base = theme.isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: theme.isDark,
      colors: {
        ...base.colors,
        primary: theme.colors.accent,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.heart,
      },
    };
  }, [theme]);

  const splashState = useMemo(() => splashStateFor(phase), [phase]);

  if (!ready) return null;

  return (
    <SplashContext.Provider value={splashState}>
      <NavigationThemeProvider value={navigationTheme}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} animated />
        <Stack
          screenOptions={{
            headerTintColor: theme.colors.accent,
            headerBackButtonDisplayMode: 'minimal',
            headerTitleStyle: { color: theme.colors.text },
            contentStyle: { backgroundColor: theme.colors.background },
            // Android has no iOS-style header glass; give it a flat themed bar and the iOS push.
            ...(Platform.OS === 'android'
              ? { headerStyle: { backgroundColor: theme.colors.background }, headerShadowVisible: false, animation: 'ios_from_right' as const }
              : null),
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Motion Lab' }} />
          <Stack.Screen
            name="demo-info"
            options={{
              presentation: 'formSheet',
              headerShown: false,
              sheetAllowedDetents: 'fitToContents',
              sheetGrabberVisible: true,
              sheetCornerRadius: 28,
              contentStyle: { backgroundColor: theme.colors.surface },
            }}
          />
        </Stack>
        {phase !== 'done' ? (
          <AnimatedSplash
            start={started}
            onReady={() => setOverlayPainted(true)}
            onReveal={() => setPhase('revealed')}
            onDone={() => setPhase('done')}
          />
        ) : null}
      </NavigationThemeProvider>
    </SplashContext.Provider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
