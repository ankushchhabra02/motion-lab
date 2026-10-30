import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';

import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';

type IonName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IonName; activeIcon: IonName }[] = [
  { name: 'gallery', title: 'Gallery', icon: 'grid-outline', activeIcon: 'grid' },
  { name: 'favorites', title: 'Favorites', icon: 'heart-outline', activeIcon: 'heart' },
  { name: 'settings', title: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
];

/**
 * Android (and web) tab bar. iOS uses the system tab bar from `_layout.ios.tsx`;
 * Android can't draw SF Symbols, so this one uses vector icons and an
 * iOS-style flat bar with a hairline top border.
 */
export default function TabsLayout() {
  const t = useTheme();
  const haptics = useHaptics();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.accent,
        tabBarInactiveTintColor: t.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: t.colors.surface,
          borderTopColor: t.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
      screenListeners={{ tabPress: () => haptics.selection() }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? tab.activeIcon : tab.icon} color={typeof color === 'string' ? color : undefined} size={size - 2} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
