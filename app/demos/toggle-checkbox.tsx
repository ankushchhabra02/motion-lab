import { Canvas, Path, RoundedRect, Skia, interpolateColors } from '@shopify/react-native-skia';
import { useMemo, type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { easings, spring, springs, timing } from '@/lib/motion';

export default function ToggleCheckboxScreen() {
  const t = useTheme();
  return (
    <DemoScreen id="toggle-checkbox">
      <ScrollView
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.xl, paddingBottom: t.spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <Card title="Toggle" hint="The knob stretches while pressed and springs across the track.">
          <ToggleRow label="Wi-Fi" initial />
          <Divider />
          <ToggleRow label="Bluetooth" />
          <Divider />
          <ToggleRow label="Airplane mode" />
        </Card>
        <Card title="Checkbox" hint="The box fills, then the checkmark draws itself along a Skia path.">
          <View style={styles.hero}>
            <CheckboxHero />
          </View>
          <Divider />
          <TaskRow title="Design the home screen" initial />
          <Divider />
          <TaskRow title="Build the demo wrapper" />
          <Divider />
          <TaskRow title="Ship Phase 1" />
        </Card>
      </ScrollView>
    </DemoScreen>
  );
}

function Card({ title, hint, children }: PropsWithChildren<{ title: string; hint: string }>) {
  const t = useTheme();
  return (
    <View
      style={[
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
      <AppText variant="caption" tone="secondary" style={{ marginTop: 2, marginBottom: t.spacing.sm }}>
        {hint}
      </AppText>
      {children}
    </View>
  );
}

function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border }} />;
}

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------

const TRACK_W = 64;
const TRACK_H = 38;
const KNOB = 30;
const PAD = (TRACK_H - KNOB) / 2;
const STRETCH = 10;

/**
 * Toggle. `progress` (0..1) drives the track color and the knob position.
 * `stretch` (0..1) widens the knob while the finger is down, and the travel
 * distance is recomputed from the current knob width so the knob always stays
 * inside the track. The knob widens toward the direction it will travel.
 */
function ToggleRow({ label, initial = false }: { label: string; initial?: boolean }) {
  const t = useTheme();
  const haptics = useHaptics();
  const onToggle = haptics.selection;

  const on = useSharedValue(initial ? 1 : 0);
  const progress = useSharedValue(initial ? 1 : 0);
  const stretch = useSharedValue(0);

  const tap = useTapGesture({
    maxDuration: 6000,
    maxDistance: 30,
    onBegin: () => {
      'worklet';
      stretch.value = spring(1, springs.press);
    },
    onActivate: () => {
      'worklet';
      on.value = on.value === 1 ? 0 : 1;
      progress.value = spring(on.value, springs.snappy);
      scheduleOnRN(onToggle);
    },
    onFinalize: () => {
      'worklet';
      stretch.value = spring(0, springs.bouncy);
    },
  });

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [t.colors.borderStrong, t.colors.accent]),
  }));

  const knobStyle = useAnimatedStyle(() => {
    const width = KNOB + stretch.value * STRETCH;
    const x = interpolate(progress.value, [0, 1], [PAD, TRACK_W - PAD - width]);
    return { width, transform: [{ translateX: x }] };
  });

  return (
    <GestureDetector gesture={tap}>
      <View accessible accessibilityRole="switch" style={[styles.row, { paddingVertical: t.spacing.md }]}>
        <AppText variant="bodyMedium">{label}</AppText>
        <Animated.View style={[styles.track, trackStyle]}>
          <Animated.View
            style={[
              styles.knob,
              { backgroundColor: t.colors.onAccent },
              t.isDark ? null : t.shadows.card,
              knobStyle,
            ]}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

// ---------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------

/**
 * Builds the checkmark as a Skia path in a `size` x `size` box. Skia 2.x paths
 * are immutable, so we draw with PathBuilder and `build()` once per size.
 */
function useCheckPath(size: number) {
  return useMemo(() => {
    const s = size / 28;
    return Skia.PathBuilder.Make()
      .moveTo(7 * s, 14.5 * s)
      .lineTo(12 * s, 19.5 * s)
      .lineTo(21.5 * s, 9 * s)
      .build();
  }, [size]);
}

type SkiaCheckboxProps = {
  /** 0 = unchecked, 1 = checked. Drive it with a timing for the draw-on effect. */
  progress: SharedValue<number>;
  /** Scale pop on toggle. */
  pop: SharedValue<number>;
  size?: number;
};

/**
 * The check animation is one progress value split into two phases:
 * 0 -> 0.5 fades the fill in, 0.35 -> 1 extends the path's `end` so the
 * checkmark draws itself. Skia accepts shared values directly as props, so
 * nothing here touches React state.
 */
function SkiaCheckbox({ progress, pop, size = 28 }: SkiaCheckboxProps) {
  const t = useTheme();
  const path = useCheckPath(size);
  const radius = size * 0.29;
  const strokeWidth = Math.max(2, size * 0.085);

  const boxColor = useDerivedValue(() =>
    interpolateColors(progress.value, [0, 1], [t.colors.borderStrong, t.colors.accent]),
  );
  const fillOpacity = useDerivedValue(() => interpolate(progress.value, [0, 0.5], [0, 1], Extrapolation.CLAMP));
  const checkEnd = useDerivedValue(() => interpolate(progress.value, [0.35, 1], [0, 1], Extrapolation.CLAMP));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Animated.View style={popStyle}>
      <Canvas style={{ width: size, height: size }}>
        <RoundedRect
          x={1}
          y={1}
          width={size - 2}
          height={size - 2}
          r={radius}
          color={t.colors.accent}
          opacity={fillOpacity}
        />
        <RoundedRect
          x={1}
          y={1}
          width={size - 2}
          height={size - 2}
          r={radius}
          color={boxColor}
          style="stroke"
          strokeWidth={2}
        />
        <Path
          path={path}
          color={t.colors.onAccent}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
          strokeJoin="round"
          start={0}
          end={checkEnd}
        />
      </Canvas>
    </Animated.View>
  );
}

/** Shared toggle logic for anything that owns a checkbox. */
function useCheckbox(initial: boolean) {
  const haptics = useHaptics();
  const onCheck = haptics.success;
  const onUncheck = haptics.light;

  const checked = useSharedValue(initial ? 1 : 0);
  const progress = useSharedValue(initial ? 1 : 0);
  const pop = useSharedValue(1);

  const tap = useTapGesture({
    maxDuration: 6000,
    maxDistance: 30,
    onBegin: () => {
      'worklet';
      pop.value = spring(0.9, springs.press);
    },
    onActivate: () => {
      'worklet';
      checked.value = checked.value === 1 ? 0 : 1;
      progress.value = spring(checked.value, springs.gentle);
      pop.value = withSequence(timing(0.82, 70, easings.out), spring(1, springs.bouncy));
      scheduleOnRN(checked.value === 1 ? onCheck : onUncheck);
    },
    onFinalize: () => {
      'worklet';
      pop.value = spring(1, springs.bouncy);
    },
  });

  return { tap, checked, progress, pop };
}

function CheckboxHero() {
  const { tap, progress, pop } = useCheckbox(false);
  return (
    <GestureDetector gesture={tap}>
      <View accessible accessibilityRole="checkbox" style={styles.heroBox}>
        <SkiaCheckbox progress={progress} pop={pop} size={64} />
      </View>
    </GestureDetector>
  );
}

/** Task row: checkbox plus a title that dims and gets struck through. */
function TaskRow({ title, initial = false }: { title: string; initial?: boolean }) {
  const t = useTheme();
  const { tap, progress, pop } = useCheckbox(initial);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0.45]),
  }));
  // The strike line grows from the left: scaleX with the origin pinned to the left edge.
  const strikeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <GestureDetector gesture={tap}>
      <View accessible accessibilityRole="checkbox" style={[styles.taskRow, { paddingVertical: t.spacing.md }]}>
        <SkiaCheckbox progress={progress} pop={pop} />
        <View style={styles.taskTitle}>
          <Animated.Text style={[t.typography.bodyMedium, { color: t.colors.text }, titleStyle]}>{title}</Animated.Text>
          <Animated.View
            pointerEvents="none"
            style={[styles.strike, { backgroundColor: t.colors.textSecondary, transformOrigin: 'left' }, strikeStyle]}
          />
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    left: 0,
    height: KNOB,
    borderRadius: KNOB / 2,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  heroBox: {
    padding: 12,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  taskTitle: {
    flex: 1,
    justifyContent: 'center',
  },
  strike: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    top: '50%',
  },
});
