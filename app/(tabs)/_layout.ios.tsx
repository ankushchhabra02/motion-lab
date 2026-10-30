import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/hooks/useTheme';

/**
 * System tab bar. On iOS 26 this is the Liquid Glass bar drawn by UIKit, which
 * minimizes as you scroll down. Icons are SF Symbols so no native assets or
 * development build are needed.
 */
export default function TabsLayout() {
  const t = useTheme();
  return (
    <NativeTabs tintColor={t.colors.accent} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="gallery">
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} />
        <NativeTabs.Trigger.Label>Gallery</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="favorites">
        <NativeTabs.Trigger.Icon sf={{ default: 'heart', selected: 'heart.fill' }} />
        <NativeTabs.Trigger.Label>Favorites</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
