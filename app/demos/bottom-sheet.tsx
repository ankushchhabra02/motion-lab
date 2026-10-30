import { BlurMask, Canvas, Circle, LinearGradient, Line, Rect, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { GlassGroup, GlassSurface } from '@/components/GlassSurface';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { spring, springs } from '@/lib/motion';

const PEEK_HEIGHT = 132;
const OVERDRAG = 0.18;

/**
 * Bottom sheet with three snap points. `y` is the sheet's translateY: 0 is
 * fully open, larger values slide it down. On release we project where the
 * finger's velocity would carry the sheet (y + v * 0.18s) and snap to the
 * nearest point from there, so a flick jumps a whole snap while a slow drag
 * settles to the closest one. The backdrop opacity is read straight off `y`.
 */
export default function BottomSheetScreen() {
  const t = useTheme();
  const haptics = useHaptics();
  const onSettle = haptics.light;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const sheetHeight = Math.round(height * 0.88);
  const snaps = useMemo(
    () => [sheetHeight - (PEEK_HEIGHT + insets.bottom), Math.round(sheetHeight * 0.48), 0] as const,
    [sheetHeight, insets.bottom],
  );
  const peek = snaps[0];
  const half = snaps[1];

  const y = useSharedValue(peek);
  const startY = useSharedValue(peek);

  const snapTo = (target: number, velocity: number) => {
    'worklet';
    y.value = spring(target, springs.gentle, velocity);
    scheduleOnRN(onSettle);
  };

  const pan = usePanGesture({
    activeOffsetY: [-6, 6],
    onBegin: () => {
      'worklet';
      startY.value = y.value;
    },
    onUpdate: (e) => {
      'worklet';
      const raw = startY.value + e.translationY;
      // Rubber-band past both ends instead of stopping dead.
      if (raw < 0) y.value = raw * OVERDRAG;
      else if (raw > peek) y.value = peek + (raw - peek) * OVERDRAG;
      else y.value = raw;
    },
    onDeactivate: (e) => {
      'worklet';
      const projected = y.value + e.velocityY * 0.18;
      let best: number = peek;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const s of snaps) {
        const d = Math.abs(s - projected);
        if (d < bestDistance) {
          bestDistance = d;
          best = s;
        }
      }
      snapTo(best, e.velocityY);
    },
  });

  const backdropTap = useTapGesture({
    onActivate: () => {
      'worklet';
      snapTo(peek, 0);
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [peek, half, 0], [0, 0.45, 0.7], Extrapolation.CLAMP),
  }));
  // Let taps through to the map while the sheet is peeking.
  const backdropProps = useAnimatedProps(() => ({
    pointerEvents: (y.value < peek - 2 ? 'auto' : 'none') as 'auto' | 'none',
  }));
  const detailsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [peek, half], [0, 1], Extrapolation.CLAMP),
  }));
  const handleStyle = useAnimatedStyle(() => ({
    width: interpolate(y.value, [peek, 0], [40, 56], Extrapolation.CLAMP),
  }));

  const rows: { icon: IconName; title: string; value: string }[] = [
    { icon: 'navigate-outline', title: 'Pickup', value: 'Harbor Steps' },
    { icon: 'flag-outline', title: 'Drop-off', value: 'Studio 14, Pier District' },
    { icon: 'time-outline', title: 'Arrives in', value: '4 min' },
    { icon: 'card-outline', title: 'Payment', value: '•••• 4821' },
  ];

  return (
    <DemoScreen id="bottom-sheet">
      <View style={styles.flex}>
        <View style={StyleSheet.absoluteFill}>
          <MapArt width={width} height={height} />
          <GlassGroup spacing={12} style={[styles.mapButtons, { padding: t.spacing.lg, gap: t.spacing.sm }]}>
            {(
              [
                ['Peek', peek],
                ['Half', half],
                ['Full', 0],
              ] as const
            ).map(([label, target]) => (
              <PressableScale
                key={label}
                onPress={() => {
                  y.value = spring(target, springs.gentle);
                  onSettle();
                }}
                scaleTo={0.94}
                accessibilityLabel={`Open sheet to ${label}`}
              >
                <GlassSurface radius={t.radii.pill} interactive style={[styles.mapButton, { paddingHorizontal: t.spacing.lg }]}>
                  <AppText variant="caption">{label}</AppText>
                </GlassSurface>
              </PressableScale>
            ))}
          </GlassGroup>
        </View>

        <GestureDetector gesture={backdropTap}>
          <Animated.View
            animatedProps={backdropProps}
            style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.overlay }, backdropStyle]}
          />
        </GestureDetector>

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.sheet,
              {
                height: sheetHeight,
                backgroundColor: t.colors.surface,
                borderTopLeftRadius: t.radii.xl,
                borderTopRightRadius: t.radii.xl,
                borderColor: t.colors.border,
                borderWidth: t.isDark ? StyleSheet.hairlineWidth : 0,
                paddingBottom: insets.bottom,
              },
              t.isDark ? null : t.shadows.floating,
              sheetStyle,
            ]}
          >
            <View style={styles.handleRow}>
              <Animated.View style={[styles.handle, { backgroundColor: t.colors.borderStrong }, handleStyle]} />
            </View>
            <View style={{ paddingHorizontal: t.spacing.xl }}>
              <View style={styles.peekRow}>
                <View style={[styles.avatar, { backgroundColor: t.colors.accent }]}>
                  <Icon name="car-sport" size={22} tone="onAccent" />
                </View>
                <View style={styles.flex}>
                  <AppText variant="heading">Your ride is on its way</AppText>
                  <AppText variant="caption" tone="secondary">
                    Silver sedan · ML 2026 · 4.9 ★
                  </AppText>
                </View>
                <View style={[styles.eta, { backgroundColor: t.colors.accentSoft, borderRadius: t.radii.sm }]}>
                  <AppText variant="bodySemibold" tone="accent">
                    4
                  </AppText>
                  <AppText variant="label" tone="accent">
                    MIN
                  </AppText>
                </View>
              </View>

              <Animated.View style={[{ marginTop: t.spacing.xl }, detailsStyle]}>
                {rows.map((row, i) => (
                  <View
                    key={row.title}
                    style={[
                      styles.detailRow,
                      {
                        paddingVertical: t.spacing.md,
                        gap: t.spacing.md,
                        borderBottomWidth: i === rows.length - 1 ? 0 : StyleSheet.hairlineWidth,
                        borderBottomColor: t.colors.border,
                      },
                    ]}
                  >
                    <Icon name={row.icon} size={20} tone="secondary" />
                    <AppText tone="secondary" style={styles.flex}>
                      {row.title}
                    </AppText>
                    <AppText variant="bodyMedium">{row.value}</AppText>
                  </View>
                ))}
                <PressableScale
                  onPress={() => {
                    y.value = spring(peek, springs.gentle);
                    onSettle();
                  }}
                  scaleTo={0.97}
                  haptic="medium"
                  style={[
                    styles.primary,
                    { backgroundColor: t.colors.accent, borderRadius: t.radii.md, marginTop: t.spacing.xl },
                  ]}
                  accessibilityLabel="Share trip status"
                >
                  <Icon name="share-outline" size={18} tone="onAccent" />
                  <AppText variant="bodySemibold" tone="onAccent">
                    Share trip status
                  </AppText>
                </PressableScale>
                <AppText variant="caption" tone="tertiary" style={{ marginTop: t.spacing.lg, textAlign: 'center' }}>
                  Drag the sheet, flick it, or tap the dimmed map to collapse.
                </AppText>
              </Animated.View>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </DemoScreen>
  );
}

/** A stylized map: soft gradient, faint grid, two "roads" and a route with pins. */
function MapArt({ width, height }: { width: number; height: number }) {
  const t = useTheme();
  const gridLines = useMemo(() => {
    const lines: { p1: { x: number; y: number }; p2: { x: number; y: number } }[] = [];
    for (let x = 0; x < width; x += 48) lines.push({ p1: vec(x, 0), p2: vec(x, height) });
    for (let y = 0; y < height; y += 48) lines.push({ p1: vec(0, y), p2: vec(width, y) });
    return lines;
  }, [width, height]);

  return (
    <Canvas style={{ width, height }}>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={[t.colors.background, t.colors.accentSoft]} />
      </Rect>
      {gridLines.map((l, i) => (
        <Line key={i} p1={l.p1} p2={l.p2} color={t.colors.border} strokeWidth={1} />
      ))}
      <Line p1={vec(-20, height * 0.18)} p2={vec(width + 20, height * 0.42)} color={t.colors.surface} strokeWidth={26} strokeCap="round" />
      <Line p1={vec(width * 0.3, -20)} p2={vec(width * 0.62, height * 0.7)} color={t.colors.surface} strokeWidth={22} strokeCap="round" />
      <Line p1={vec(width * 0.22, height * 0.23)} p2={vec(width * 0.58, height * 0.5)} color={t.colors.accent} strokeWidth={5} strokeCap="round" />
      <Circle cx={width * 0.22} cy={height * 0.23} r={10} color={t.colors.accent}>
        <BlurMask blur={8} style="outer" />
      </Circle>
      <Circle cx={width * 0.22} cy={height * 0.23} r={8} color={t.colors.accent} />
      <Circle cx={width * 0.22} cy={height * 0.23} r={3.5} color={t.colors.onAccent} />
      <Circle cx={width * 0.58} cy={height * 0.5} r={8} color={t.colors.heart} />
      <Circle cx={width * 0.58} cy={height * 0.5} r={3.5} color={t.colors.onAccent} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mapButtons: {
    position: 'absolute',
    right: 0,
    top: 0,
    alignItems: 'flex-end',
  },
  mapButton: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 14,
  },
  handle: {
    height: 5,
    borderRadius: 3,
  },
  peekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eta: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primary: {
    height: 54,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
