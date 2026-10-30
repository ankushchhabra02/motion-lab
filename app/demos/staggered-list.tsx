import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { Icon, type IconName } from '@/components/Icon';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useTheme } from '@/hooks/useTheme';
import { delayed, spring, springs } from '@/lib/motion';

type Flavor = 'rise' | 'slide' | 'pop';

const FLAVORS = [
  { label: 'Rise', value: 'rise' },
  { label: 'Slide', value: 'slide' },
  { label: 'Pop', value: 'pop' },
] as const satisfies readonly { label: string; value: Flavor }[];

type Item = { id: string; icon: IconName; title: string; subtitle: string; time: string };

const ITEMS: Item[] = [
  { id: '1', icon: 'heart', title: 'Mina liked your post', subtitle: 'Spring physics explained', time: '2m' },
  { id: '2', icon: 'chatbubble-ellipses', title: 'New comment', subtitle: '"This is exactly what I needed"', time: '9m' },
  { id: '3', icon: 'person-add', title: 'Jules started following you', subtitle: 'Motion designer · Lisbon', time: '21m' },
  { id: '4', icon: 'star', title: 'Weekly recap is ready', subtitle: '3 demos shipped, 2 favorites', time: '1h' },
  { id: '5', icon: 'cloud-download', title: 'Export finished', subtitle: 'tilt-card.mp4 · 12 MB', time: '2h' },
  { id: '6', icon: 'trophy', title: 'Milestone unlocked', subtitle: '100 taps on Springy Buttons', time: '3h' },
  { id: '7', icon: 'calendar', title: 'Design review tomorrow', subtitle: '10:00 · Room Aurora', time: '5h' },
  { id: '8', icon: 'sparkles', title: 'Try the new Skia effects', subtitle: 'Gradient blobs and confetti', time: '1d' },
  { id: '9', icon: 'shield-checkmark', title: 'Backup complete', subtitle: 'All settings synced', time: '1d' },
];

const STEP_MS = 70;

export default function StaggeredListScreen() {
  const t = useTheme();
  const [flavor, setFlavor] = useState<Flavor>('rise');
  const [run, setRun] = useState(0);

  return (
    <DemoScreen id="staggered-list">
      <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.md }}>
        <SegmentedControl
          options={FLAVORS}
          value={flavor}
          onChange={(next) => {
            setFlavor(next);
            setRun((r) => r + 1);
          }}
          accessibilityLabel="Stagger style"
        />
      </View>
      {/* The key remounts every row, so each flavor change replays the entrance. */}
      <ScrollView
        key={`${flavor}-${run}`}
        contentContainerStyle={{ padding: t.spacing.lg, paddingTop: t.spacing.xs, gap: t.spacing.sm, paddingBottom: t.spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        {ITEMS.map((item, index) => (
          <Row key={item.id} item={item} index={index} flavor={flavor} />
        ))}
      </ScrollView>
    </DemoScreen>
  );
}

/**
 * Each row owns one progress value that springs 0 -> 1 after a delay of
 * index * STEP_MS. The flavor only changes how progress maps to transforms.
 * "Pop" uses a bouncy spring so the overshoot reads as a real pop.
 */
function Row({ item, index, flavor }: { item: Item; index: number; flavor: Flavor }) {
  const t = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = delayed(index * STEP_MS, spring(1, flavor === 'pop' ? springs.bouncy : springs.gentle));
  }, [progress, index, flavor]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = Math.min(1, Math.max(0, p * 1.2));
    if (flavor === 'slide') return { opacity, transform: [{ translateX: (1 - p) * 72 }] };
    if (flavor === 'pop') return { opacity, transform: [{ scale: 0.6 + 0.4 * p }] };
    return { opacity, transform: [{ translateY: (1 - p) * 28 }] };
  });

  return (
    <Animated.View
      style={[
        styles.row,
        {
          backgroundColor: t.colors.surface,
          borderRadius: t.radii.md,
          padding: t.spacing.md,
          gap: t.spacing.md,
          borderColor: t.colors.border,
          borderWidth: t.isDark ? StyleSheet.hairlineWidth : 0,
        },
        t.isDark ? null : t.shadows.card,
        style,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: t.colors.accentSoft, borderRadius: t.radii.sm }]}>
        <Icon name={item.icon} size={18} tone="accent" />
      </View>
      <View style={styles.text}>
        <AppText variant="bodyMedium" numberOfLines={1}>
          {item.title}
        </AppText>
        <AppText variant="caption" tone="secondary" numberOfLines={1}>
          {item.subtitle}
        </AppText>
      </View>
      <AppText variant="caption" tone="tertiary">
        {item.time}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
});
