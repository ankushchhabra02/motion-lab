import { Stack, useRouter } from 'expo-router';
import { useState, type PropsWithChildren } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeartButton } from '@/components/HeartButton';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { getDemo, type DemoId } from '@/data/demos';
import { useGlass } from '@/hooks/useGlass';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';

/** Compact navigation bar height on iOS. */
const NAV_BAR_HEIGHT = 44;

type Props = PropsWithChildren<{
  id: DemoId;
  /** Screen color behind the header and content. Defaults to the grouped gray. */
  background?: string;
}>;

/**
 * Shared chrome for every demo, now the native iOS header: system back
 * button, title, and a header toolbar with Info (opens a native form sheet),
 * Replay, and the animated heart. On iOS 26 the header is transparent Liquid
 * Glass, so the content is padded below it; older iOS gets an opaque header
 * that already lays the content out underneath.
 *
 * Replay remounts the children with a new React key, resetting every shared
 * value inside the demo without any bespoke reset logic.
 */
export function DemoScreen({ id, background, children }: Props) {
  const t = useTheme();
  const router = useRouter();
  const haptics = useHaptics();
  const { liquidGlass } = useGlass();
  const insets = useSafeAreaInsets();
  const demo = getDemo(id);
  const [replayKey, setReplayKey] = useState(0);

  const replay = () => {
    haptics.light();
    setReplayKey((k) => k + 1);
  };
  const openInfo = () => {
    haptics.light();
    router.push({ pathname: '/demo-info', params: { id: demo.id } } as never);
  };

  return (
    <View style={[styles.flex, { backgroundColor: background ?? t.colors.background, paddingTop: liquidGlass ? insets.top + NAV_BAR_HEIGHT : 0 }]}>
      {Platform.OS === 'ios' ? (
        <>
          {/* iOS: native toolbar items with SF Symbols (Liquid Glass on iOS 26). */}
          <Stack.Screen options={{ title: demo.title }} />
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button icon="info.circle" accessibilityLabel="About this demo" onPress={openInfo} />
            <Stack.Toolbar.Button icon="arrow.counterclockwise" accessibilityLabel="Replay animation" onPress={replay} />
            <Stack.Toolbar.View>
              <HeartButton id={demo.id} />
            </Stack.Toolbar.View>
          </Stack.Toolbar>
        </>
      ) : (
        // Android: plain header buttons; Stack.Toolbar needs a module Expo Go may not ship there.
        <Stack.Screen
          options={{
            title: demo.title,
            headerRight: () => (
              <View style={styles.actions}>
                <HeaderAction icon="information-circle-outline" label="About this demo" onPress={openInfo} />
                <HeaderAction icon="refresh" label="Replay animation" onPress={replay} />
                <HeartButton id={demo.id} />
              </View>
            ),
          }}
        />
      )}
      <View key={replayKey} style={styles.flex}>
        {children}
      </View>
    </View>
  );
}

function HeaderAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.85} haptic="none" hitSlop={6} accessibilityLabel={label} style={styles.action}>
      <Icon name={icon} size={22} tone="accent" />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  action: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
