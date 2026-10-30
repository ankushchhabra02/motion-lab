import { Canvas, Circle, Group, Line, LinearGradient, Path, Skia, rect, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { ReText } from '@/components/ReText';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { delayed, easings, spring, springs, timing } from '@/lib/motion';

const DATA = [42, 48, 45, 60, 58, 72, 69, 80, 76, 88, 84, 95, 90, 102, 98, 110, 105, 118, 112, 125, 121, 134, 128, 140];
const CHART_H = 200;
const PAD_Y = 14;
const RINGS = [
  { label: 'Steps', target: 0.82, color: 'accent' as const },
  { label: 'Focus', target: 0.64, color: 'heart' as const },
  { label: 'Sleep', target: 0.46, color: 'info' as const },
];
const RING_STROKE = 13;
const RING_GAP = 6;
const RING_OUTER = 64;

/**
 * Charts. The line is a Catmull-Rom spline through 24 points, drawn on by
 * animating the Path's `end`, with the area fill revealed by a clip that grows
 * with the same progress. Because control points sit at exactly 1/3 and 2/3
 * between samples, x is linear in the Bezier parameter, so the scrubber can
 * evaluate the curve's y at any x without searching.
 */
export default function AnimatedChartsScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const chartW = width - t.spacing.lg * 2 - t.spacing.lg * 2;

  return (
    <DemoScreen id="animated-charts">
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <Card title="Steps per hour" subtitle="Drag across the chart to scrub">
          <LineChart width={chartW} />
        </Card>
        <Card title="Today's goals" subtitle="Rings draw in with a stagger">
          <Rings />
        </Card>
      </ScrollView>
    </DemoScreen>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
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
      <AppText variant="caption" tone="secondary" style={{ marginTop: 2, marginBottom: t.spacing.lg }}>
        {subtitle}
      </AppText>
      {children}
    </View>
  );
}

function LineChart({ width }: { width: number }) {
  const t = useTheme();
  const haptics = useHaptics();
  const onTick = haptics.selection;
  const n = DATA.length;
  const min = Math.min(...DATA);
  const max = Math.max(...DATA);
  const stepX = width / (n - 1);

  const ys = useMemo(() => DATA.map((v) => CHART_H - PAD_Y - ((v - min) / (max - min)) * (CHART_H - PAD_Y * 2)), [min, max]);

  const { line, area } = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    b.moveTo(0, ys[0] ?? 0);
    for (let i = 0; i < n - 1; i++) {
      const y0 = ys[Math.max(0, i - 1)] ?? 0;
      const y1 = ys[i] ?? 0;
      const y2 = ys[i + 1] ?? 0;
      const y3 = ys[Math.min(n - 1, i + 2)] ?? 0;
      const x1 = i * stepX;
      const x2 = (i + 1) * stepX;
      b.cubicTo(x1 + stepX / 3, y1 + (y2 - y0) / 6, x2 - stepX / 3, y2 - (y3 - y1) / 6, x2, y2);
    }
    const linePath = b.build();
    const areaBuilder = Skia.PathBuilder.MakeFromPath(linePath);
    areaBuilder.lineTo(width, CHART_H).lineTo(0, CHART_H).close();
    return { line: linePath, area: areaBuilder.build() };
  }, [ys, n, stepX, width]);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = delayed(200, timing(1, 1500, easings.inOut));
  }, [progress]);

  const active = useSharedValue(0);
  const scrubX = useSharedValue(width);
  const lastIndex = useSharedValue(-1);

  const pan = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      active.value = spring(1, springs.snappy);
      scrubX.value = Math.max(0, Math.min(width, e.x));
    },
    onUpdate: (e) => {
      'worklet';
      scrubX.value = Math.max(0, Math.min(width, e.x));
      const index = Math.round(scrubX.value / stepX);
      if (index !== lastIndex.value) {
        lastIndex.value = index;
        scheduleOnRN(onTick);
      }
    },
    onFinalize: () => {
      'worklet';
      active.value = spring(0, springs.snappy);
      lastIndex.value = -1;
    },
  });

  // Evaluate the spline's y at an x by finding the segment and its Bezier parameter.
  const scrubY = useDerivedValue(() => {
    const x = scrubX.value;
    const i = Math.min(n - 2, Math.max(0, Math.floor(x / stepX)));
    const u = Math.min(1, Math.max(0, (x - i * stepX) / stepX));
    const y0 = ys[Math.max(0, i - 1)] ?? 0;
    const y1 = ys[i] ?? 0;
    const y2 = ys[i + 1] ?? 0;
    const y3 = ys[Math.min(n - 1, i + 2)] ?? 0;
    const c1 = y1 + (y2 - y0) / 6;
    const c2 = y2 - (y3 - y1) / 6;
    const m = 1 - u;
    return m * m * m * y1 + 3 * m * m * u * c1 + 3 * m * u * u * c2 + u * u * u * y2;
  });
  const scrubPoint = useDerivedValue(() => vec(scrubX.value, scrubY.value));
  const scrubTop = useDerivedValue(() => vec(scrubX.value, 0));
  const scrubBottom = useDerivedValue(() => vec(scrubX.value, CHART_H));
  const valueText = useDerivedValue(() => {
    const value = min + ((CHART_H - PAD_Y - scrubY.value) / (CHART_H - PAD_Y * 2)) * (max - min);
    return `${Math.round(value)}`;
  });
  const hourText = useDerivedValue(() => `${Math.round(scrubX.value / stepX)}:00`);
  const clip = useDerivedValue(() => rect(0, -10, progress.value * width + 2, CHART_H + 20));
  const endDot = useDerivedValue(() => vec(width, ys[n - 1] ?? 0));
  const endDotOpacity = useDerivedValue(() => interpolate(progress.value, [0.95, 1], [0, 1], Extrapolation.CLAMP) * (1 - active.value));

  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [
      { translateX: Math.max(0, Math.min(width - 72, scrubX.value - 36)) },
      { translateY: scrubY.value - 64 },
      { scale: 0.8 + active.value * 0.2 },
    ],
  }));

  return (
    <View>
      <GestureDetector gesture={pan}>
        <View style={{ height: CHART_H }} accessible accessibilityRole="adjustable" accessibilityLabel="Steps per hour chart">
          <Canvas style={{ width, height: CHART_H }}>
            <Group clip={clip}>
              <Path path={area} opacity={0.5}>
                <LinearGradient start={vec(0, 0)} end={vec(0, CHART_H)} colors={[t.colors.accent, t.colors.glareClear]} />
              </Path>
            </Group>
            <Path path={line} color={t.colors.accent} style="stroke" strokeWidth={3} strokeCap="round" strokeJoin="round" start={0} end={progress} />
            <Circle c={endDot} r={5} color={t.colors.accent} opacity={endDotOpacity} />
            <Group opacity={active}>
              <Line p1={scrubTop} p2={scrubBottom} color={t.colors.borderStrong} strokeWidth={1} />
              <Circle c={scrubPoint} r={9} color={t.colors.accent} opacity={0.25} />
              <Circle c={scrubPoint} r={6} color={t.colors.accent} />
              <Circle c={scrubPoint} r={2.5} color={t.colors.onAccent} />
            </Group>
          </Canvas>
          <Animated.View
            pointerEvents="none"
            style={[styles.tooltip, { backgroundColor: t.colors.text, borderRadius: t.radii.sm }, tooltipStyle]}
          >
            <ReText text={valueText} style={[t.typography.bodySemibold, { color: t.colors.background, textAlign: 'center' }]} />
            <ReText text={hourText} style={[t.typography.label, { color: t.colors.background, textAlign: 'center', opacity: 0.8 }]} />
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={[styles.axis, { marginTop: t.spacing.sm }]}>
        {['0:00', '6:00', '12:00', '18:00', '23:00'].map((label) => (
          <AppText key={label} variant="label" tone="tertiary">
            {label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

function Rings() {
  const t = useTheme();
  const size = RING_OUTER * 2 + RING_STROKE;
  const center = size / 2;
  const values = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];

  useEffect(() => {
    values.forEach((value, i) => {
      value.value = delayed(200 + i * 160, timing(RINGS[i]?.target ?? 0, 1300, easings.inOut));
    });
    // Shared values are created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const texts = values.map((value) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => `${Math.round(value.value * 100)}%`),
  );

  return (
    <View
      style={[styles.ringsRow, { gap: t.spacing.xl }]}
      accessible
      accessibilityLabel={`Goal rings. ${RINGS.map((r) => `${r.label} ${Math.round(r.target * 100)} percent`).join(', ')}`}
    >
      <Canvas style={{ width: size, height: size }}>
        <Group origin={vec(center, center)} transform={[{ rotate: -Math.PI / 2 }]}>
          {RINGS.map((ring, i) => {
            const r = RING_OUTER - i * (RING_STROKE + RING_GAP);
            const path = Skia.Path.Circle(center, center, r);
            return (
              <Group key={ring.label}>
                <Path path={path} color={t.colors[ring.color]} opacity={0.18} style="stroke" strokeWidth={RING_STROKE} />
                <Path path={path} color={t.colors[ring.color]} style="stroke" strokeWidth={RING_STROKE} strokeCap="round" start={0} end={values[i] ?? values[0]!} />
              </Group>
            );
          })}
        </Group>
      </Canvas>
      <View style={[styles.legend, { gap: t.spacing.md }]}>
        {RINGS.map((ring, i) => (
          <View key={ring.label} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: t.colors[ring.color] }]} />
            <View style={styles.flex}>
              <AppText variant="caption" tone="secondary">
                {ring.label}
              </AppText>
              <ReText text={texts[i] ?? texts[0]!} style={[t.typography.heading, { color: t.colors.text }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tooltip: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 72,
    paddingVertical: 6,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ringsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legend: {
    flex: 1,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
