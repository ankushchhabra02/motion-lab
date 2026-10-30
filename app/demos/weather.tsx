import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  Rect,
  Skia,
  interpolateColors,
  useClock,
  usePathValue,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { Icon, type IconName } from '@/components/Icon';
import { ReText } from '@/components/ReText';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useTheme } from '@/hooks/useTheme';
import { spring, springs, staggerIn, timing } from '@/lib/motion';

type Condition = 'sunny' | 'cloudy' | 'rainy';

const CONDITIONS = [
  { label: 'Sunny', value: 'sunny' },
  { label: 'Cloudy', value: 'cloudy' },
  { label: 'Rainy', value: 'rainy' },
] as const satisfies readonly { label: string; value: Condition }[];

const INFO: Record<Condition, { temp: number; title: string; detail: string; icon: IconName; hourly: number[] }> = {
  sunny: { temp: 27, title: 'Clear skies', detail: 'UV index high · light breeze', icon: 'sunny', hourly: [25, 27, 28, 27, 24] },
  cloudy: { temp: 19, title: 'Overcast', detail: 'Clouds clearing by evening', icon: 'cloudy', hourly: [18, 19, 20, 19, 17] },
  rainy: { temp: 14, title: 'Showers', detail: '80% chance of rain until 6pm', icon: 'rainy', hourly: [15, 14, 14, 13, 13] },
};

const SCENE_H = 300;
const DROPS = 40;
const HOURS = ['Now', '1pm', '2pm', '3pm', '4pm'];

/**
 * Weather scene. A Skia clock drives all motion (ray rotation, cloud drift,
 * falling rain). Three spring-animated values say how "sunny", "cloudy" and
 * "rainy" the scene is; everything else (sky colors, sun position, cloud color,
 * rain opacity) is interpolated from them, so switching conditions morphs the
 * scene instead of swapping it.
 */
export default function WeatherScreen() {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const sceneW = width - t.spacing.lg * 2;
  const [condition, setCondition] = useState<Condition>('sunny');

  const sunny = useSharedValue(1);
  const cloudy = useSharedValue(0);
  const rainy = useSharedValue(0);
  const temp = useSharedValue(INFO.sunny.temp);

  useEffect(() => {
    sunny.value = spring(condition === 'sunny' ? 1 : 0, springs.gentle);
    cloudy.value = spring(condition === 'cloudy' ? 1 : 0, springs.gentle);
    rainy.value = spring(condition === 'rainy' ? 1 : 0, springs.gentle);
    temp.value = timing(INFO[condition].temp, 700);
  }, [condition, sunny, cloudy, rainy, temp]);

  const clock = useClock();
  const time = useDerivedValue(() => (reduceMotion ? 0 : clock.value));
  // 0 = sunny, 1 = cloudy, 2 = rainy, blended during transitions.
  const mood = useDerivedValue(() => cloudy.value + rainy.value * 2);

  const skyTop = useDerivedValue(() =>
    interpolateColors(mood.value, [0, 1, 2], [t.colors.info, t.colors.textTertiary, t.colors.textSecondary]),
  );
  const skyBottom = useDerivedValue(() =>
    interpolateColors(mood.value, [0, 1, 2], [t.colors.accentSoft, t.colors.border, t.colors.textTertiary]),
  );
  const skyColors = useDerivedValue(() => [skyTop.value, skyBottom.value]);

  // Sun
  const sunCenter = useDerivedValue(() =>
    vec(sceneW * 0.72, interpolate(mood.value, [0, 1, 2], [SCENE_H * 0.32, SCENE_H * 0.42, SCENE_H * 0.2])),
  );
  const sunRadius = useDerivedValue(() => 30 + sunny.value * 14);
  const sunOpacity = useDerivedValue(() => interpolate(mood.value, [0, 1, 2], [1, 0.7, 0.12]));
  const rayTransform = useDerivedValue(() => [{ rotate: time.value * 0.0003 }]);
  const rays = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const inner = 58;
      const outer = 78;
      b.moveTo(Math.cos(a) * inner, Math.sin(a) * inner).lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    }
    return b.build();
  }, []);
  const rayOpacity = useDerivedValue(() => sunny.value * 0.9);

  // Clouds: unions of circles, drifting with the clock.
  const cloudColor = useDerivedValue(() =>
    interpolateColors(mood.value, [0, 1, 2], [t.colors.onAccent, t.colors.surface, t.colors.textSecondary]),
  );
  const cloudOpacity = useDerivedValue(() => 0.55 + Math.max(cloudy.value, rainy.value) * 0.45);
  const backCloud = usePathValue((b) => {
    'worklet';
    const drift = Math.sin(time.value / 3800) * 16;
    const cx = sceneW * 0.3 + drift;
    const cy = SCENE_H * 0.4 - cloudy.value * 10;
    b.addCircle(cx - 44, cy + 8, 26).addCircle(cx - 12, cy - 12, 36).addCircle(cx + 30, cy, 30).addCircle(cx + 56, cy + 12, 22);
    b.addRect(Skia.XYWHRect(cx - 44, cy + 2, 100, 32));
  });
  const frontCloud = usePathValue((b) => {
    'worklet';
    const drift = Math.sin(time.value / 2900 + 1.5) * 22;
    const cx = sceneW * 0.62 + drift;
    const cy = SCENE_H * 0.58 - cloudy.value * 6;
    b.addCircle(cx - 56, cy + 10, 30).addCircle(cx - 16, cy - 16, 44).addCircle(cx + 36, cy - 2, 36).addCircle(cx + 68, cy + 14, 26);
    b.addRect(Skia.XYWHRect(cx - 56, cy + 4, 124, 36));
  });

  // Rain: one path with every drop, rebuilt each frame from the clock.
  const drops = useMemo(() => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return Array.from({ length: DROPS }, (_, i) => ({
      x: (i / DROPS) * sceneW + rand() * 14,
      speed: 0.28 + rand() * 0.22,
      phase: rand() * (SCENE_H + 60),
      length: 10 + rand() * 10,
    }));
  }, [sceneW]);
  const rain = usePathValue((b) => {
    'worklet';
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      if (!d) continue;
      const y = ((time.value * d.speed + d.phase) % (SCENE_H + 60)) - 30;
      b.moveTo(d.x, y).lineTo(d.x - 3, y + d.length);
    }
  });
  const rainOpacity = useDerivedValue(() => rainy.value * 0.85);

  const tempText = useDerivedValue(() => `${Math.round(temp.value)}°`);
  const info = INFO[condition];

  return (
    <DemoScreen id="weather">
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <SegmentedControl options={CONDITIONS} value={condition} onChange={setCondition} accessibilityLabel="Weather condition" />

        <View style={[styles.scene, { width: sceneW, height: SCENE_H, borderRadius: t.radii.xl }, t.isDark ? null : t.shadows.card]}>
          <Canvas style={{ width: sceneW, height: SCENE_H }}>
            <Rect x={0} y={0} width={sceneW} height={SCENE_H}>
              <LinearGradient start={vec(0, 0)} end={vec(0, SCENE_H)} colors={skyColors} />
            </Rect>
            <Group opacity={sunOpacity}>
              <Circle c={sunCenter} r={90} color={t.colors.warning}>
                <BlurMask blur={50} style="normal" />
              </Circle>
              <Group transform={rayTransform} origin={sunCenter} opacity={rayOpacity}>
                <Group transform={useDerivedValue(() => [{ translateX: sunCenter.value.x }, { translateY: sunCenter.value.y }])}>
                  <Path path={rays} color={t.colors.warning} style="stroke" strokeWidth={5} strokeCap="round" />
                </Group>
              </Group>
              <Circle c={sunCenter} r={sunRadius} color={t.colors.warning} />
              <Circle c={sunCenter} r={useDerivedValue(() => sunRadius.value * 0.7)} color={t.colors.onAccent} opacity={0.35} />
            </Group>
            <Group opacity={cloudOpacity}>
              <Path path={backCloud} color={cloudColor} opacity={0.7} />
              <Path path={frontCloud} color={cloudColor} />
            </Group>
            <Path path={rain} color={t.colors.info} opacity={rainOpacity} style="stroke" strokeWidth={2.5} strokeCap="round" />
          </Canvas>
          <View style={[styles.sceneText, { padding: t.spacing.xl }]}>
            <ReText text={tempText} style={[t.typography.display, { color: t.colors.onAccent, fontSize: 64, lineHeight: 72 }]} />
            <AppText variant="heading" tone="onAccent">
              {info.title}
            </AppText>
            <AppText variant="caption" tone="onAccent" style={{ opacity: 0.85 }}>
              {info.detail}
            </AppText>
          </View>
        </View>

        <View key={condition} style={[styles.hourly, { gap: t.spacing.sm }]}>
          {HOURS.map((hour, i) => (
            <Animated.View
              key={hour}
              entering={staggerIn(i, 50, 5, 320)}
              style={[
                styles.hourCard,
                {
                  backgroundColor: t.colors.surface,
                  borderRadius: t.radii.md,
                  paddingVertical: t.spacing.md,
                  borderColor: t.colors.border,
                  borderWidth: t.isDark ? StyleSheet.hairlineWidth : 0,
                },
                t.isDark ? null : t.shadows.card,
              ]}
            >
              <AppText variant="caption" tone="secondary">
                {hour}
              </AppText>
              <Icon name={info.icon} size={22} tone={condition === 'sunny' ? 'accent' : 'secondary'} />
              <AppText variant="bodySemibold">{info.hourly[i]}°</AppText>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  scene: {
    overflow: 'hidden',
  },
  sceneText: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
  hourly: {
    flexDirection: 'row',
  },
  hourCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
});
