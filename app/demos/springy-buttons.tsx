import { useState, type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { Icon, type IconName } from '@/components/Icon';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { easings, progressTiming, spring, springs, timing } from '@/lib/motion';

export default function SpringyButtonsScreen() {
  const t = useTheme();
  return (
    <DemoScreen id="springy-buttons">
      <ScrollView
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.xl, paddingBottom: t.spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <Section title="Squish" hint="Shrinks the instant your finger lands, bounces back on release.">
          <SquishButton />
        </Section>
        <Section title="Push" hint="A raised face that sinks onto its edge, like a real key.">
          <PushButton />
        </Section>
        <Section title="Jelly" hint="Squash and stretch: wider while pressed, wobbles on release.">
          <JellyButton />
        </Section>
        <Section title="Icon bounce" hint="Round buttons that overshoot and twist as they settle.">
          <View style={styles.row}>
            <IconBounceButton icon="heart-outline" activeIcon="heart" />
            <IconBounceButton icon="star-outline" activeIcon="star" />
            <IconBounceButton icon="bookmark-outline" activeIcon="bookmark" />
          </View>
        </Section>
        <Section title="Hold to confirm" hint="Fills while you hold. Let go early and it drains back.">
          <HoldButton />
        </Section>
      </ScrollView>
    </DemoScreen>
  );
}

function Section({ title, hint, children }: PropsWithChildren<{ title: string; hint: string }>) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: t.colors.surface,
          borderRadius: t.radii.lg,
          padding: t.spacing.lg,
          borderColor: t.colors.border,
          borderWidth: t.isDark ? StyleSheet.hairlineWidth : 0,
        },
        t.isDark ? null : t.shadows.card,
      ]}
    >
      <AppText variant="heading">{title}</AppText>
      <AppText variant="caption" tone="secondary" style={{ marginTop: 2, marginBottom: t.spacing.lg }}>
        {hint}
      </AppText>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

/** Classic squish: scale toward 0.92 with a quick spring, release with a bouncy one. */
function SquishButton() {
  const t = useTheme();
  const haptics = useHaptics();
  const onTap = haptics.medium;
  const scale = useSharedValue(1);

  const tap = useTapGesture({
    maxDuration: 6000,
    maxDistance: 24,
    onBegin: () => {
      'worklet';
      scale.value = spring(0.92, springs.press);
    },
    onActivate: () => {
      'worklet';
      scheduleOnRN(onTap);
    },
    onFinalize: () => {
      'worklet';
      scale.value = spring(1, springs.bouncy);
    },
  });

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        accessible
        accessibilityRole="button"
        style={[styles.wideButton, { backgroundColor: t.colors.accent, borderRadius: t.radii.md }, style]}
      >
        <AppText variant="bodySemibold" tone="onAccent">
          Continue
        </AppText>
      </Animated.View>
    </GestureDetector>
  );
}

const EDGE = 6;

/**
 * Push button: two stacked views. The darker "edge" sits EDGE px lower; the
 * face translates down by `depth * EDGE` so at full depth it covers the edge
 * and reads as pressed flat. Press uses a short timing (keys don't bounce on
 * the way down); release uses a spring so it pops back up.
 */
function PushButton() {
  const t = useTheme();
  const haptics = useHaptics();
  const onTap = haptics.rigid;
  const depth = useSharedValue(0);

  const tap = useTapGesture({
    maxDuration: 6000,
    maxDistance: 24,
    onBegin: () => {
      'worklet';
      depth.value = timing(1, 90, easings.out);
    },
    onActivate: () => {
      'worklet';
      scheduleOnRN(onTap);
    },
    onFinalize: () => {
      'worklet';
      depth.value = spring(0, springs.bouncy);
    },
  });

  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: depth.value * EDGE }] }));

  return (
    <GestureDetector gesture={tap}>
      <View accessible accessibilityRole="button" style={{ height: 56 + EDGE, width: 220 }}>
        <View
          style={[
            StyleSheet.absoluteFill,
            { top: EDGE, backgroundColor: t.colors.accentStrong, borderRadius: t.radii.md },
          ]}
        />
        <Animated.View
          style={[styles.wideButton, { backgroundColor: t.colors.accent, borderRadius: t.radii.md }, faceStyle]}
        >
          <AppText variant="bodySemibold" tone="onAccent">
            Press me
          </AppText>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/**
 * Jelly: squash and stretch. While pressed the button gets wider and shorter
 * (scaleX up, scaleY down, so the "volume" roughly stays the same). On release
 * both axes spring back with a low-damped spring, which is what makes it wobble.
 */
function JellyButton() {
  const t = useTheme();
  const haptics = useHaptics();
  const onTap = haptics.light;
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);

  const tap = useTapGesture({
    maxDuration: 6000,
    maxDistance: 24,
    onBegin: () => {
      'worklet';
      sx.value = spring(1.1, springs.press);
      sy.value = spring(0.86, springs.press);
    },
    onActivate: () => {
      'worklet';
      scheduleOnRN(onTap);
    },
    onFinalize: () => {
      'worklet';
      sx.value = spring(1, springs.jelly);
      sy.value = spring(1, springs.jelly);
    },
  });

  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: sx.value }, { scaleY: sy.value }] }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        accessible
        accessibilityRole="button"
        style={[
          styles.wideButton,
          { backgroundColor: t.colors.accentSoft, borderRadius: t.radii.pill, width: 200 },
          style,
        ]}
      >
        <AppText variant="bodySemibold" tone="accent">
          Wobble
        </AppText>
      </Animated.View>
    </GestureDetector>
  );
}

/** Round icon button: shrinks and twists on press, overshoots back and swaps to the filled glyph. */
function IconBounceButton({ icon, activeIcon }: { icon: IconName; activeIcon: IconName }) {
  const t = useTheme();
  const haptics = useHaptics();
  const onTap = haptics.light;
  const [active, setActive] = useState(false);
  const toggle = () => setActive((v) => !v);
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  const tap = useTapGesture({
    maxDuration: 6000,
    maxDistance: 24,
    onBegin: () => {
      'worklet';
      scale.value = spring(0.78, springs.press);
      rotate.value = spring(-14, springs.press);
    },
    onActivate: () => {
      'worklet';
      scheduleOnRN(onTap);
      scheduleOnRN(toggle);
    },
    onFinalize: () => {
      'worklet';
      scale.value = spring(1, springs.bouncy);
      rotate.value = spring(0, springs.jelly);
    },
  });

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={[
          styles.roundButton,
          {
            backgroundColor: active ? t.colors.accentSoft : t.colors.background,
            borderColor: active ? t.colors.accent : t.colors.border,
          },
          style,
        ]}
      >
        <Icon name={active ? activeIcon : icon} size={24} tone={active ? 'accent' : 'secondary'} />
      </Animated.View>
    </GestureDetector>
  );
}

const HOLD_MS = 900;

/**
 * Hold to confirm. On touch-down a linear timing fills the bar over HOLD_MS.
 * An animated reaction watches for progress reaching 1 and flips `done`,
 * firing a success haptic once. Releasing early springs the bar back to empty.
 */
function HoldButton() {
  const t = useTheme();
  const haptics = useHaptics();
  const onSuccess = haptics.success;
  const progress = useSharedValue(0);
  const done = useSharedValue(0);
  const scale = useSharedValue(1);

  const tap = useTapGesture({
    maxDuration: 10000,
    maxDistance: 30,
    shouldCancelWhenOutside: true,
    onBegin: () => {
      'worklet';
      if (done.value === 1) {
        // Tapping a confirmed button resets it.
        done.value = 0;
        progress.value = timing(0, 250);
        return;
      }
      scale.value = spring(0.97, springs.press);
      // Functional progress: must take real time even with Reduce Motion on.
      progress.value = progressTiming(1, HOLD_MS);
    },
    onFinalize: () => {
      'worklet';
      scale.value = spring(1, springs.bouncy);
      if (done.value === 0) progress.value = timing(0, 250);
    },
  });

  useAnimatedReaction(
    () => progress.value,
    (value, previous) => {
      if (value >= 1 && previous !== null && previous < 1) {
        done.value = 1;
        scheduleOnRN(onSuccess);
      }
    },
  );

  const doneProgress = useDerivedValue(() => timing(done.value, 220));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(doneProgress.value, [0, 1], [t.colors.accentSoft, t.colors.accent]),
  }));
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
    opacity: 1 - doneProgress.value,
  }));
  const holdLabelStyle = useAnimatedStyle(() => ({ opacity: 1 - doneProgress.value }));
  const doneLabelStyle = useAnimatedStyle(() => ({
    opacity: doneProgress.value,
    transform: [{ scale: 0.8 + doneProgress.value * 0.2 }],
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityHint="Press and hold to confirm"
        style={[styles.wideButton, { width: 240, borderRadius: t.radii.pill, overflow: 'hidden' }, containerStyle]}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: t.colors.accent, opacity: 0.35, transformOrigin: 'left' },
            fillStyle,
          ]}
        />
        <Animated.View style={[styles.absoluteCenter, holdLabelStyle]}>
          <AppText variant="bodySemibold" tone="accent">
            Hold to confirm
          </AppText>
        </Animated.View>
        <Animated.View style={[styles.absoluteCenter, styles.row, doneLabelStyle]}>
          <Icon name="checkmark" size={20} tone="onAccent" />
          <AppText variant="bodySemibold" tone="onAccent">
            Confirmed
          </AppText>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  section: {},
  center: { alignItems: 'center' },
  row: { flexDirection: 'row', gap: 16, alignItems: 'center', justifyContent: 'center' },
  wideButton: {
    height: 56,
    width: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  absoluteCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
