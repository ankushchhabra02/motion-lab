import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomOut,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { Icon, type IconName } from '@/components/Icon';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { scaled, spring, springs, timing } from '@/lib/motion';

type Tab = { key: string; label: string; icon: IconName; activeIcon: IconName; blurb: string };

const TABS: Tab[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home', blurb: 'Your feed, fresh from the UI thread.' },
  { key: 'search', label: 'Search', icon: 'search-outline', activeIcon: 'search', blurb: 'Find any demo by name or library.' },
  { key: 'create', label: 'Create', icon: 'add-circle-outline', activeIcon: 'add-circle', blurb: 'Start a new experiment.' },
  { key: 'alerts', label: 'Alerts', icon: 'notifications-outline', activeIcon: 'notifications', blurb: 'Three people liked your tilt card.' },
  { key: 'me', label: 'You', icon: 'person-outline', activeIcon: 'person', blurb: 'Favorites, settings and stats.' },
];

const BAR_H = 64;
const PILL_W = 56;

/**
 * Tab bar with a sliding pill and bouncing icons. `activeIndex` is a shared
 * value; the pill's translateX springs to `index * tabWidth`. Each icon
 * derives a 0..1 "selected" progress for its lift and color, and the tapped
 * icon additionally plays a dip-overshoot-settle scale sequence, which is what
 * makes it feel like it was pressed rather than just highlighted.
 */
export default function AnimatedTabBarScreen() {
  const t = useTheme();
  const haptics = useHaptics();
  const [active, setActive] = useState(0);
  const [seenAlerts, setSeenAlerts] = useState(false);
  const activeIndex = useSharedValue(0);
  const barWidth = useSharedValue(0);

  const select = (index: number) => {
    if (index === active) return;
    haptics.selection();
    setActive(index);
    if (TABS[index]?.key === 'alerts') setSeenAlerts(true);
  };

  const pillStyle = useAnimatedStyle(() => {
    const tabWidth = barWidth.value / TABS.length;
    return {
      transform: [{ translateX: activeIndex.value * tabWidth + (tabWidth - PILL_W) / 2 }],
    };
  });

  const tab = TABS[active] ?? TABS[0]!;

  return (
    <DemoScreen id="animated-tab-bar">
      <View style={styles.flex}>
        <View style={styles.page}>
          <Animated.View
            key={tab.key}
            entering={FadeIn.duration(scaled(220))}
            exiting={FadeOut.duration(scaled(120))}
            style={[styles.pageInner, { padding: t.spacing.xl }]}
          >
            <View style={[styles.pageIcon, { backgroundColor: t.colors.accentSoft }]}>
              <Icon name={tab.activeIcon} size={40} tone="accent" />
            </View>
            <AppText variant="title" style={{ marginTop: t.spacing.xl }}>
              {tab.label}
            </AppText>
            <AppText tone="secondary" style={{ marginTop: t.spacing.sm, textAlign: 'center' }}>
              {tab.blurb}
            </AppText>
          </Animated.View>
        </View>

        <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.xl }}>
          <View
            onLayout={(e) => {
              barWidth.value = e.nativeEvent.layout.width;
            }}
            style={[
              styles.bar,
              {
                height: BAR_H,
                backgroundColor: t.colors.surface,
                borderRadius: t.radii.xl,
                borderColor: t.colors.border,
                borderWidth: t.isDark ? StyleSheet.hairlineWidth : 0,
              },
              t.isDark ? null : t.shadows.floating,
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[styles.pill, { width: PILL_W, backgroundColor: t.colors.accentSoft, borderRadius: t.radii.md }, pillStyle]}
            />
            {TABS.map((item, index) => (
              <TabButton
                key={item.key}
                tab={item}
                index={index}
                active={index === active}
                activeIndex={activeIndex}
                badge={item.key === 'alerts' && !seenAlerts ? 3 : 0}
                onSelect={() => select(index)}
              />
            ))}
          </View>
        </View>
      </View>
    </DemoScreen>
  );
}

function TabButton({
  tab,
  index,
  active,
  activeIndex,
  badge,
  onSelect,
}: {
  tab: Tab;
  index: number;
  active: boolean;
  activeIndex: SharedValue<number>;
  badge: number;
  onSelect: () => void;
}) {
  const t = useTheme();
  const bounce = useSharedValue(1);
  const wiggle = useSharedValue(0);
  const selected = useDerivedValue(() => spring(activeIndex.value === index ? 1 : 0, springs.snappy));

  const press = useTapGesture({
    maxDuration: 6000,
    maxDistance: 24,
    onBegin: () => {
      'worklet';
      bounce.value = spring(0.85, springs.press);
    },
    onActivate: () => {
      'worklet';
      activeIndex.value = spring(index, springs.snappy);
      bounce.value = withSequence(timing(0.8, 60), spring(1.2, springs.bouncy), spring(1, springs.snappy));
      wiggle.value = withSequence(timing(-12, 60), spring(0, springs.jelly));
      scheduleOnRN(onSelect);
    },
    onFinalize: (e) => {
      'worklet';
      if (e.canceled) bounce.value = spring(1, springs.snappy);
    },
  });

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -selected.value * 6 },
      { scale: bounce.value },
      { rotate: `${wiggle.value}deg` },
    ],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: selected.value,
    transform: [{ translateY: (1 - selected.value) * 6 }],
  }));

  return (
    <GestureDetector gesture={press}>
      <View
        accessible
        accessibilityRole="tab"
        accessibilityLabel={tab.label}
        accessibilityState={{ selected: active }}
        style={styles.tab}
      >
        <Animated.View style={iconStyle}>
          <Icon name={active ? tab.activeIcon : tab.icon} size={24} tone={active ? 'accent' : 'tertiary'} />
          {badge > 0 ? (
            <Animated.View
              exiting={ZoomOut.duration(scaled(200))}
              style={[styles.badge, { backgroundColor: t.colors.heart, borderColor: t.colors.surface }]}
            >
              <AppText variant="label" tone="onAccent" style={styles.badgeText}>
                {badge}
              </AppText>
            </Animated.View>
          ) : null}
        </Animated.View>
        <Animated.Text style={[t.typography.label, styles.label, { color: t.colors.accent }, labelStyle]}>
          {tab.label}
        </Animated.Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: {
    flex: 1,
  },
  pageInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    position: 'absolute',
    top: 8,
    left: 0,
    bottom: 8,
  },
  tab: {
    flex: 1,
    height: BAR_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    bottom: 6,
    fontSize: 10,
    lineHeight: 12,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
  },
});
