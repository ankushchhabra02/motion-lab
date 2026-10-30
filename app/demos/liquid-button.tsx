import { Canvas, Circle, Path, usePathValue, type SkPathBuilder } from '@shopify/react-native-skia';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { Icon } from '@/components/Icon';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { spring, springs } from '@/lib/motion';

const RADIUS = 46;
const DROP_RADIUS = 30;
const MAX_PULL = 170;
const SCENE_H = 420;

/**
 * Metaball bridge between two circles (after Hiroyuki Sato's classic). Finds
 * the tangent points on both circles, pulls Bezier handles toward each other,
 * and appends the bridge as a closed shape. Returns false when the circles are
 * too far apart to connect, which is what makes the droplet "snap off".
 */
function addBridge(b: SkPathBuilder, r1: number, r2: number, c1x: number, c1y: number, c2x: number, c2y: number, handle: number, v: number) {
  'worklet';
  const dx = c2x - c1x;
  const dy = c2y - c1y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const maxDist = r1 + r2 * 2.5;
  if (r1 <= 0 || r2 <= 0 || d > maxDist || d <= Math.abs(r1 - r2)) return false;

  let u1 = 0;
  let u2 = 0;
  if (d < r1 + r2) {
    u1 = Math.acos((r1 * r1 + d * d - r2 * r2) / (2 * r1 * d));
    u2 = Math.acos((r2 * r2 + d * d - r1 * r1) / (2 * r2 * d));
  }
  const angle = Math.atan2(dy, dx);
  const maxSpread = Math.acos((r1 - r2) / d);
  const a1a = angle + u1 + (maxSpread - u1) * v;
  const a1b = angle - u1 - (maxSpread - u1) * v;
  const a2a = angle + Math.PI - u2 - (Math.PI - u2 - maxSpread) * v;
  const a2b = angle - Math.PI + u2 + (Math.PI - u2 - maxSpread) * v;

  const p1ax = c1x + Math.cos(a1a) * r1;
  const p1ay = c1y + Math.sin(a1a) * r1;
  const p1bx = c1x + Math.cos(a1b) * r1;
  const p1by = c1y + Math.sin(a1b) * r1;
  const p2ax = c2x + Math.cos(a2a) * r2;
  const p2ay = c2y + Math.sin(a2a) * r2;
  const p2bx = c2x + Math.cos(a2b) * r2;
  const p2by = c2y + Math.sin(a2b) * r2;

  const total = r1 + r2;
  const d2 = Math.min(v * handle, Math.hypot(p1ax - p2ax, p1ay - p2ay) / total) * Math.min(1, (d * 2) / total);
  const r1h = r1 * d2;
  const r2h = r2 * d2;
  const half = Math.PI / 2;

  b.moveTo(p1ax, p1ay);
  b.cubicTo(
    p1ax + Math.cos(a1a - half) * r1h,
    p1ay + Math.sin(a1a - half) * r1h,
    p2ax + Math.cos(a2a + half) * r2h,
    p2ay + Math.sin(a2a + half) * r2h,
    p2ax,
    p2ay,
  );
  b.lineTo(p2bx, p2by);
  b.cubicTo(
    p2bx + Math.cos(a2b - half) * r2h,
    p2by + Math.sin(a2b - half) * r2h,
    p1bx + Math.cos(a1b + half) * r1h,
    p1by + Math.sin(a1b + half) * r1h,
    p1bx,
    p1by,
  );
  b.close();
  return true;
}

export default function LiquidButtonScreen() {
  const t = useTheme();
  const haptics = useHaptics();
  const onDetach = haptics.medium;
  const onMerge = haptics.light;
  const onRelease = haptics.soft;
  const { width } = useWindowDimensions();
  const cx = width / 2;
  const cy = SCENE_H / 2;

  const pullX = useSharedValue(0);
  const pullY = useSharedValue(0);
  const pressed = useSharedValue(0);
  const attached = useSharedValue(1);

  const pan = usePanGesture({
    minDistance: 0,
    onBegin: () => {
      'worklet';
      pressed.value = spring(1, springs.press);
    },
    onUpdate: (e) => {
      'worklet';
      // Soft limit: the droplet can only be pulled so far.
      const d = Math.hypot(e.translationX, e.translationY);
      const k = d > 0 ? Math.min(d, MAX_PULL * (1 - Math.exp(-d / MAX_PULL))) / d : 0;
      pullX.value = e.translationX * k;
      pullY.value = e.translationY * k;
    },
    onFinalize: () => {
      'worklet';
      pressed.value = spring(0, springs.gentle);
      pullX.value = spring(0, springs.jelly);
      pullY.value = spring(0, springs.jelly);
      scheduleOnRN(onRelease);
    },
  });

  // Body: anchored, leans a little toward the pull and swells while pressed.
  const bodyX = useDerivedValue(() => cx + pullX.value * 0.18);
  const bodyY = useDerivedValue(() => cy + pullY.value * 0.18);
  const bodyR = useDerivedValue(() => RADIUS * (1 + pressed.value * 0.08));
  // Droplet: follows the finger and thins out as it stretches.
  const dropX = useDerivedValue(() => cx + pullX.value);
  const dropY = useDerivedValue(() => cy + pullY.value);
  const pull = useDerivedValue(() => Math.hypot(pullX.value, pullY.value));
  const dropR = useDerivedValue(() => DROP_RADIUS * (1 - 0.45 * Math.min(1, pull.value / MAX_PULL)));

  const blob = usePathValue((b) => {
    'worklet';
    const r1 = bodyR.value;
    const r2 = dropR.value;
    b.addCircle(bodyX.value, bodyY.value, r1);
    if (pull.value > 1) {
      b.addCircle(dropX.value, dropY.value, r2);
      const connected = addBridge(b, r1, r2, bodyX.value, bodyY.value, dropX.value, dropY.value, 2.4, 0.5);
      attached.value = connected ? 1 : 0;
    } else {
      attached.value = 1;
    }
  });

  useAnimatedReaction(
    () => attached.value,
    (now, previous) => {
      if (previous === null || now === previous) return;
      if (now === 0) scheduleOnRN(onDetach);
      else scheduleOnRN(onMerge);
    },
  );

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pullX.value * 0.18 },
      { translateY: pullY.value * 0.18 },
      { scale: 1 + pressed.value * 0.08 },
      { rotate: `${pressed.value * 45}deg` },
    ],
  }));
  const hintStyle = useAnimatedStyle(() => ({ opacity: 1 - pressed.value }));

  return (
    <DemoScreen id="liquid-button">
      <View style={styles.flex}>
        <GestureDetector gesture={pan}>
          <View style={{ height: SCENE_H }} accessible accessibilityRole="button" accessibilityLabel="Liquid button. Press and drag to stretch.">
            <Canvas style={StyleSheet.absoluteFill}>
              <Path path={blob} color={t.colors.accent} />
              <Circle
                cx={useDerivedValue(() => bodyX.value - bodyR.value * 0.3)}
                cy={useDerivedValue(() => bodyY.value - bodyR.value * 0.35)}
                r={useDerivedValue(() => bodyR.value * 0.28)}
                color={t.colors.glare}
              />
            </Canvas>
            <Animated.View pointerEvents="none" style={[styles.icon, { left: cx - 14, top: cy - 14 }, iconStyle]}>
              <Icon name="add" size={28} tone="onAccent" />
            </Animated.View>
          </View>
        </GestureDetector>
        <Animated.View style={[styles.hint, { paddingHorizontal: t.spacing.xl }, hintStyle]}>
          <AppText variant="heading" style={styles.centerText}>
            Press and pull
          </AppText>
          <AppText tone="secondary" style={[styles.centerText, { marginTop: t.spacing.sm }]}>
            The droplet stretches with your finger and snaps off if you pull too far. Let go and it wobbles back.
          </AppText>
        </Animated.View>
      </View>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  icon: {
    position: 'absolute',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    alignItems: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
});
