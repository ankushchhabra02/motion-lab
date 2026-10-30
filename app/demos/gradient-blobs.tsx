import {
  BackdropBlur,
  BlurMask,
  Canvas,
  Fill,
  Path,
  RoundedRect,
  interpolateColors,
  rect,
  rrect,
  useClock,
  usePathValue,
  type SkPathBuilder,
} from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useDerivedValue, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { motionScale, spring, springs } from '@/lib/motion';

const POINTS = 8;

/**
 * Appends a closed, smoothly wobbling blob to the builder. The outline is
 * POINTS samples around a circle whose radius breathes with two sine waves of
 * different frequency, joined with Catmull-Rom cubics so there are no corners.
 */
function addBlob(b: SkPathBuilder, cx: number, cy: number, radius: number, time: number, phase: number, wobble: number) {
  'worklet';
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < POINTS; i++) {
    const a = (i / POINTS) * Math.PI * 2;
    const r =
      radius *
      (1 + wobble * Math.sin(time * 0.0011 + phase + i * 1.9) + wobble * 0.5 * Math.cos(time * 0.0007 - phase + i * 2.7));
    xs.push(cx + Math.cos(a) * r);
    ys.push(cy + Math.sin(a) * r);
  }
  for (let i = 0; i < POINTS; i++) {
    const i0 = (i - 1 + POINTS) % POINTS;
    const i2 = (i + 1) % POINTS;
    const i3 = (i + 2) % POINTS;
    const p0x = xs[i0] ?? 0, p0y = ys[i0] ?? 0;
    const p1x = xs[i] ?? 0, p1y = ys[i] ?? 0;
    const p2x = xs[i2] ?? 0, p2y = ys[i2] ?? 0;
    const p3x = xs[i3] ?? 0, p3y = ys[i3] ?? 0;
    if (i === 0) b.moveTo(p1x, p1y);
    b.cubicTo(p1x + (p2x - p0x) / 6, p1y + (p2y - p0y) / 6, p2x - (p3x - p1x) / 6, p2y - (p3y - p1y) / 6, p2x, p2y);
  }
  b.close();
}

const BLOBS = [
  { phase: 0.0, fx: 0.00021, fy: 0.00017, ax: 0.28, ay: 0.22, radius: 0.34, wobble: 0.2 },
  { phase: 2.1, fx: 0.00016, fy: 0.00024, ax: 0.32, ay: 0.26, radius: 0.3, wobble: 0.24 },
  { phase: 4.2, fx: 0.00027, fy: 0.00013, ax: 0.26, ay: 0.3, radius: 0.27, wobble: 0.18 },
] as const;

export default function GradientBlobsScreen() {
  const t = useTheme();
  const haptics = useHaptics();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const [paletteIndex, setPaletteIndex] = useState(0);
  const palette = useSharedValue(0);

  const palettes: [string, string, string][] = [
    [t.colors.accent, t.colors.heart, t.colors.info],
    [t.colors.success, t.colors.info, t.colors.accent],
    [t.colors.warning, t.colors.heart, t.colors.accentStrong],
  ];

  const clock = useClock();
  // Slow-motion setting applies here too: divide the clock by the multiplier.
  const time = useDerivedValue(() => (reduceMotion ? 0 : clock.value / motionScale.value));

  const slotA = palettes.map((p) => p[0]);
  const slotB = palettes.map((p) => p[1]);
  const slotC = palettes.map((p) => p[2]);
  const colorA = useDerivedValue(() => interpolateColors(palette.value, [0, 1, 2], slotA));
  const colorB = useDerivedValue(() => interpolateColors(palette.value, [0, 1, 2], slotB));
  const colorC = useDerivedValue(() => interpolateColors(palette.value, [0, 1, 2], slotC));

  return (
    <DemoScreen id="gradient-blobs">
      <View style={styles.flex}>
        <Scene width={width} time={time} colors={[colorA, colorB, colorC]} />
        <View style={[styles.footer, { padding: t.spacing.lg, paddingBottom: t.spacing.xl }]}>
          <PressableScale
            onPress={() => {
              const next = (paletteIndex + 1) % palettes.length;
              setPaletteIndex(next);
              palette.value = spring(next, springs.gentle);
              haptics.selection();
            }}
            scaleTo={0.95}
            haptic="none"
            accessibilityLabel="Shuffle colors"
            style={[styles.shuffle, { backgroundColor: t.colors.surface, borderRadius: t.radii.pill, paddingHorizontal: t.spacing.xl }, t.isDark ? { borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border } : t.shadows.card]}
          >
            <Icon name="color-palette-outline" size={18} tone="accent" />
            <AppText variant="bodySemibold">Shuffle colors</AppText>
          </PressableScale>
        </View>
      </View>
    </DemoScreen>
  );
}

function Scene({
  width,
  time,
  colors,
}: {
  width: number;
  time: SharedValue<number>;
  colors: [SharedValue<number[]>, SharedValue<number[]>, SharedValue<number[]>];
}) {
  const t = useTheme();
  const height = useSharedValue(600);

  const [cfgA, cfgB, cfgC] = BLOBS;
  const blobA = usePathValue((b) => {
    'worklet';
    const now = time.value;
    const h = height.value;
    addBlob(b, width / 2 + width * cfgA.ax * Math.sin(now * cfgA.fx + cfgA.phase), h / 2 + h * cfgA.ay * Math.cos(now * cfgA.fy + cfgA.phase), width * cfgA.radius, now, cfgA.phase, cfgA.wobble);
  });
  const blobB = usePathValue((b) => {
    'worklet';
    const now = time.value;
    const h = height.value;
    addBlob(b, width / 2 + width * cfgB.ax * Math.sin(now * cfgB.fx + cfgB.phase), h / 2 + h * cfgB.ay * Math.cos(now * cfgB.fy + cfgB.phase), width * cfgB.radius, now, cfgB.phase, cfgB.wobble);
  });
  const blobC = usePathValue((b) => {
    'worklet';
    const now = time.value;
    const h = height.value;
    addBlob(b, width / 2 + width * cfgC.ax * Math.sin(now * cfgC.fx + cfgC.phase), h / 2 + h * cfgC.ay * Math.cos(now * cfgC.fy + cfgC.phase), width * cfgC.radius, now, cfgC.phase, cfgC.wobble);
  });

  const cardW = width - t.spacing.xl * 2;
  const cardH = 190;
  const cardClip = useDerivedValue(() => rrect(rect(t.spacing.xl, height.value / 2 - cardH / 2, cardW, cardH), 28, 28));
  const cardX = t.spacing.xl;
  const cardY = useDerivedValue(() => height.value / 2 - cardH / 2);

  const stats: { icon: IconName; label: string; value: string }[] = [
    { icon: 'water-outline', label: 'Blur', value: '24px' },
    { icon: 'shapes-outline', label: 'Blobs', value: '3' },
    { icon: 'speedometer-outline', label: 'Frame', value: '8ms' },
  ];

  return (
    <View
      style={styles.flex}
      onLayout={(e) => {
        height.value = e.nativeEvent.layout.height;
      }}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill color={t.colors.background} />
        <Path path={blobA} color={colors[0]} opacity={0.9}>
          <BlurMask blur={42} style="normal" />
        </Path>
        <Path path={blobB} color={colors[1]} opacity={0.85}>
          <BlurMask blur={48} style="normal" />
        </Path>
        <Path path={blobC} color={colors[2]} opacity={0.8}>
          <BlurMask blur={54} style="normal" />
        </Path>
        <BackdropBlur blur={24} clip={cardClip}>
          <Fill color={t.colors.glass} />
        </BackdropBlur>
        <RoundedRect
          x={cardX}
          y={cardY}
          width={cardW}
          height={cardH}
          r={28}
          color={t.colors.glassBorder}
          style="stroke"
          strokeWidth={1.5}
        />
      </Canvas>
      <View style={[styles.cardContent, { width: cardW, height: cardH, left: t.spacing.xl, padding: t.spacing.xl }]} pointerEvents="none">
        <View style={styles.cardHeader}>
          <View style={[styles.glassIcon, { backgroundColor: t.colors.glass, borderColor: t.colors.glassBorder }]}>
            <Icon name="sparkles" size={18} tone="primary" />
          </View>
          <View>
            <AppText variant="heading">Frosted glass</AppText>
            <AppText variant="caption" tone="secondary">
              BackdropBlur samples the blobs behind it
            </AppText>
          </View>
        </View>
        <View style={[styles.stats, { marginTop: 'auto', gap: t.spacing.sm }]}>
          {stats.map((s) => (
            <View key={s.label} style={[styles.stat, { backgroundColor: t.colors.glass, borderColor: t.colors.glassBorder, borderRadius: t.radii.md }]}>
              <Icon name={s.icon} size={16} tone="secondary" />
              <AppText variant="bodySemibold">{s.value}</AppText>
              <AppText variant="label" tone="secondary">
                {s.label.toUpperCase()}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  shuffle: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardContent: {
    position: 'absolute',
    top: '50%',
    marginTop: -95,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  glassIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
});
