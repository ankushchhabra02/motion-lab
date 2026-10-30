import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/** Native stack inside the tab so the screen gets a real large-title header. */
export default function TabStackLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerLargeTitleShadowVisible: false,
        headerTintColor: t.colors.accent,
        headerTitleStyle: { color: t.colors.text },
        headerLargeTitleStyle: { color: t.colors.text },
        contentStyle: { backgroundColor: t.colors.background },
        ...(Platform.OS === 'android'
          ? { headerStyle: { backgroundColor: t.colors.background }, headerShadowVisible: false }
          : null),
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
    </Stack>
  );
}
