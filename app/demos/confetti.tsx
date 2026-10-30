import { Atlas, Canvas, Skia, useRSXformBuffer, useRectBuffer, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { Icon } from '@/components/Icon';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { easings, motionScale, spring, springs, timing } from '@/lib/motion';

const COUNT = 180;
const SPRITE = 32;
const LIFE_MS = 2300;

type Burst = { id: number; x: number; y: number; seed: number };

/**
 * Confetti. Every tap spawns an independent burst: 180 sprites from a small
 * atlas, each with its own launch angle in an upward cone, speed, spin and
 * flutter. Position is closed-form in time (drag-limited launch velocity plus
 * gravity), so there is no per-frame physics state, just a 0..1 progress.
 */
export default function ConfettiScreen() {
  const t = useTheme();
  const haptics = useHaptics();
  const reduceMotion = useReducedMotion();
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [claimed, setClaimed] = useState(0);

  const rootRef = useAnimatedRef<View>();
  const buttonRef = useAnimatedRef<View>();
  const buttonScale = useSharedValue(1);
  const checkPop = useSharedValue(0);

  const onPress = haptics.light;
  const spawn = (x: number, y: number) => {
    setTimeout(() => haptics.success(), 250);
    setBursts((b) => [...b, { id: Date.now() + Math.random(), x, y, seed: Math.floor(Math.random() * 100000) }]);
    setClaimed((c) => c + 1);
    checkPop.value = withSequence(timing(1.3, 120, easings.out), spring(1, springs.bouncy));
  };

  const tap = useTapGesture({
    maxDuration: 6000,
    maxDistance: 24,
    onBegin: () => {
      'worklet';
      buttonScale.value = spring(0.92, springs.press);
    },
    onActivate: () => {
      'worklet';
      const button = measure(buttonRef);
      const root = measure(rootRef);
      if (button && root) {
        scheduleOnRN(spawn, button.pageX - root.pageX + button.width / 2, button.pageY - root.pageY + button.height / 2);
      }
      scheduleOnRN(onPress);
    },
    onFinalize: () => {
      'worklet';
      buttonScale.value = spring(1, springs.jelly);
    },
  });

  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: buttonScale.value }] }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkPop.value }] }));

  const colors = useMemo(
    () => [t.colors.accent, t.colors.heart, t.colors.warning, t.colors.success, t.colors.info, t.colors.accentStrong],
    [t],
  );
  const sheet = useMemo(() => makeSheet(colors), [colors]);

  return (
    <DemoScreen id="confetti">
      <View ref={rootRef} collapsable={false} style={styles.flex}>
        <View style={[styles.center, { padding: t.spacing.xl }]}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: t.colors.surface,
                borderRadius: t.radii.xl,
                padding: t.spacing.xl,
                borderColor: t.colors.border,
                borderWidth: t.isDark ? StyleSheet.hairlineWidth : 0,
              },
              t.isDark ? null : t.shadows.card,
            ]}
          >
            <View style={[styles.reward, { backgroundColor: t.colors.accentSoft }]}>
              <Icon name="gift" size={40} tone="accent" />
              {claimed > 0 ? (
                <Animated.View style={[styles.check, { backgroundColor: t.colors.success, borderColor: t.colors.surface }, checkStyle]}>
                  <Icon name="checkmark" size={14} tone="onAccent" />
                </Animated.View>
              ) : null}
            </View>
            <AppText variant="title" style={[styles.centerText, { marginTop: t.spacing.lg }]}>
              {claimed === 0 ? 'You earned a reward' : `Claimed ${claimed}×`}
            </AppText>
            <AppText tone="secondary" style={[styles.centerText, { marginTop: t.spacing.sm }]}>
              {claimed === 0 ? 'Seven days of shipping demos in a row.' : 'Keep tapping. Every burst is independent.'}
            </AppText>
            <GestureDetector gesture={tap}>
              <Animated.View
                ref={buttonRef}
                collapsable={false}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Claim reward"
                style={[styles.button, { backgroundColor: t.colors.accent, borderRadius: t.radii.pill, marginTop: t.spacing.xl }, buttonStyle]}
              >
                <Icon name="sparkles" size={18} tone="onAccent" />
                <AppText variant="bodySemibold" tone="onAccent">
                  {claimed === 0 ? 'Claim reward' : 'Celebrate again'}
                </AppText>
              </Animated.View>
            </GestureDetector>
          </View>
        </View>

        {!reduceMotion ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {bursts.map((burst) => (
              <BurstCanvas key={burst.id} burst={burst} sheet={sheet} onDone={() => setBursts((b) => b.filter((x) => x.id !== burst.id))} />
            ))}
          </View>
        ) : null}
      </View>
    </DemoScreen>
  );
}

function BurstCanvas({ burst, sheet, onDone }: { burst: Burst; sheet: SkImage | null; onDone: () => void }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: LIFE_MS * motionScale.get(), easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(onDone);
    });
    // One shot per burst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const particles = useMemo(() => makeParticles(burst.seed), [burst.seed]);

  const sprites = useRectBuffer(COUNT, (rect, i) => {
    'worklet';
    rect.setXYWH((i % 6) * SPRITE, 0, SPRITE, SPRITE);
  });

  const transforms = useRSXformBuffer(COUNT, (xform, i) => {
    'worklet';
    const u = progress.value;
    const seconds = u * (LIFE_MS / 1000);
    const vx = particles.vx[i] ?? 0;
    const vy = particles.vy[i] ?? 0;
    const spin = particles.spin[i] ?? 0;
    const size = particles.size[i] ?? 1;
    const flutter = particles.flutter[i] ?? 1;
    const drag = 2.4;
    // Drag-limited launch: velocity decays exponentially; gravity adds a parabola.
    const reach = (1 - Math.exp(-drag * seconds)) / drag;
    const x = burst.x + vx * reach;
    const y = burst.y + vy * reach + 0.5 * 760 * seconds * seconds;
    const fade = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
    // Flutter: a strip seen edge-on looks thinner, approximated with a scale pulse.
    const scale = size * fade * (0.55 + 0.45 * Math.abs(Math.cos(flutter * seconds + i)));
    const rotation = spin * seconds;
    const scos = scale * Math.cos(rotation);
    const ssin = scale * Math.sin(rotation);
    const half = SPRITE / 2;
    xform.set(scos, ssin, x - (scos * half - ssin * half), y - (ssin * half + scos * half));
  });

  if (!sheet) return null;
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Atlas image={sheet} sprites={sprites} transforms={transforms} />
    </Canvas>
  );
}

function makeParticles(seed: number) {
  let s = seed || 1;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const vx: number[] = [];
  const vy: number[] = [];
  const spin: number[] = [];
  const size: number[] = [];
  const flutter: number[] = [];
  for (let i = 0; i < COUNT; i++) {
    const angle = -Math.PI / 2 + (rand() - 0.5) * 1.5; // cone pointing up
    const speed = 700 + rand() * 900;
    vx.push(Math.cos(angle) * speed);
    vy.push(Math.sin(angle) * speed);
    spin.push((rand() - 0.5) * 14);
    size.push(0.45 + rand() * 0.6);
    flutter.push(6 + rand() * 10);
  }
  return { vx, vy, spin, size, flutter };
}

/** Six sprites: rounded strips and circles, one per color. */
function makeSheet(colors: string[]): SkImage | null {
  const surface = Skia.Surface.Make(SPRITE * colors.length, SPRITE);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  colors.forEach((color, i) => {
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(color));
    const x = i * SPRITE;
    if (i % 2 === 0) {
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x + 4, 10, SPRITE - 8, 12), 3, 3), paint);
    } else {
      canvas.drawCircle(x + SPRITE / 2, SPRITE / 2, 7, paint);
    }
  });
  surface.flush();
  return surface.makeImageSnapshot();
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  card: {
    alignItems: 'center',
  },
  reward: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    height: 52,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
