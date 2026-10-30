import { BlurMask, Canvas, Circle, useClock } from '@shopify/react-native-skia';
import { GlassContainer, GlassView } from 'expo-glass-effect';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { GlassSurface } from '@/components/GlassSurface';
import { Icon, type IconName } from '@/components/Icon';
import { useGlass } from '@/hooks/useGlass';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { motionScale, spring, springs } from '@/lib/motion';

const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

const PANEL_W = 176;
const PANEL_H = 104;
const PAD = 16;

/**
 * Glass Lab. Three experiments on top of drifting Skia blobs: static glass
 * cards (regular and clear), a GlassContainer whose middle button you can drag
 * into its neighbors so the system merges them, and a draggable glass panel
 * that snaps to the nearest corner using the release velocity. Every move is
 * a transform; nothing animates the glass views' opacity.
 */
export default function GlassLabScreen() {
  const t = useTheme();
  const glass = useGlass();
  const { width } = useWindowDimensions();
  const areaHeight = useSharedValue(600);

  return (
    <DemoScreen id="glass-lab">
      <View
        style={styles.flex}
        onLayout={(e) => {
          areaHeight.value = e.nativeEvent.layout.height;
        }}
      >
        <Blobs width={width} height={areaHeight} />
        <View style={{ padding: t.spacing.lg, gap: t.spacing.md }}>
          {!glass.liquidGlass ? (
            <GlassSurface radius={t.radii.md} style={{ padding: t.spacing.md }}>
              <AppText variant="caption" tone="secondary">
                {glass.reduceTransparency
                  ? 'Reduce Transparency is on, so surfaces are solid.'
                  : 'Liquid Glass needs iOS 26. Showing the blur fallback.'}
              </AppText>
            </GlassSurface>
          ) : null}
          <GlassSurface radius={t.radii.xl} interactive style={{ padding: t.spacing.xl }}>
            <View style={styles.cardHeader}>
              <Icon name="sparkles" size={18} tone="accent" />
              <AppText variant="heading">Regular glass</AppText>
            </View>
            <AppText tone="secondary" style={{ marginTop: t.spacing.xs }}>
              Blurs and tints what moves behind it. Press to see the interactive highlight.
            </AppText>
          </GlassSurface>
          <GlassSurface radius={t.radii.xl} variant="clear" style={{ padding: t.spacing.xl }}>
            <View style={styles.cardHeader}>
              <Icon name="eye-outline" size={18} tone="accent" />
              <AppText variant="heading">Clear glass</AppText>
            </View>
            <AppText tone="secondary" style={{ marginTop: t.spacing.xs }}>
              Less frosting, more of the scene. Best over bold color.
            </AppText>
          </GlassSurface>
        </View>

        <View style={{ paddingHorizontal: t.spacing.lg, marginTop: t.spacing.sm }}>
          <AppText variant="label" tone="tertiary" style={{ marginBottom: t.spacing.sm }}>
            DRAG THE MIDDLE BUTTON INTO ITS NEIGHBORS
          </AppText>
          <MergeRow />
        </View>

        <DraggablePanel width={width} areaHeight={areaHeight} />
      </View>
    </DemoScreen>
  );
}

/** Slow drifting color blobs so the glass has something to refract. */
function Blobs({ width, height }: { width: number; height: SharedValue<number> }) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const clock = useClock();
  const time = useDerivedValue(() => (reduceMotion ? 0 : clock.value / motionScale.value));

  const a = useDerivedValue(() => ({ x: width * 0.3 + Math.sin(time.value * 0.00025) * width * 0.25, y: height.value * 0.3 + Math.cos(time.value * 0.0002) * height.value * 0.18 }));
  const b = useDerivedValue(() => ({ x: width * 0.7 + Math.cos(time.value * 0.0003 + 2) * width * 0.22, y: height.value * 0.55 + Math.sin(time.value * 0.00022 + 1) * height.value * 0.2 }));
  const c = useDerivedValue(() => ({ x: width * 0.5 + Math.sin(time.value * 0.00018 + 4) * width * 0.3, y: height.value * 0.8 + Math.cos(time.value * 0.00027 + 3) * height.value * 0.15 }));

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Circle c={a} r={width * 0.34} color={t.colors.accent} opacity={0.8}>
        <BlurMask blur={50} style="normal" />
      </Circle>
      <Circle c={b} r={width * 0.3} color={t.colors.heart} opacity={0.75}>
        <BlurMask blur={55} style="normal" />
      </Circle>
      <Circle c={c} r={width * 0.32} color={t.colors.info} opacity={0.7}>
        <BlurMask blur={60} style="normal" />
      </Circle>
    </Canvas>
  );
}

const BUTTON = 56;
const BUTTON_GAP = 52;
const MERGE_SPACING = 40;

/**
 * Three glass buttons in one GlassContainer. Dragging the middle one toward a
 * neighbor lets the system merge their shapes once they come within
 * `spacing` points. The draggable button must be a direct child of the
 * container, so in glass mode it is an animated GlassView itself.
 */
function MergeRow() {
  const t = useTheme();
  const { mode } = useGlass();
  const haptics = useHaptics();
  const onNear = haptics.selection;
  const onRelease = haptics.light;

  const dragX = useSharedValue(0);
  const near = useSharedValue(0);
  const limit = BUTTON + BUTTON_GAP;

  const pan = usePanGesture({
    activeOffsetX: [-6, 6],
    onUpdate: (e) => {
      'worklet';
      dragX.value = Math.max(-limit, Math.min(limit, e.translationX));
      const isNear = Math.abs(dragX.value) > BUTTON_GAP - MERGE_SPACING ? 1 : 0;
      if (isNear !== near.value) {
        near.value = isNear;
        if (isNear === 1) scheduleOnRN(onNear);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      near.value = 0;
      dragX.value = spring(0, springs.bouncy, e.velocityX);
      scheduleOnRN(onRelease);
    },
  });

  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }] }));
  const icons: IconName[] = ['heart', 'move', 'star'];

  if (mode === 'glass') {
    return (
      <GlassContainer spacing={MERGE_SPACING} style={[styles.mergeRow, { gap: BUTTON_GAP }]}>
        <GlassView style={styles.glassButton} isInteractive colorScheme={t.scheme}>
          <Icon name={icons[0] ?? 'heart'} size={22} tone="accent" />
        </GlassView>
        <GestureDetector gesture={pan}>
          <AnimatedGlassView style={[styles.glassButton, dragStyle]} isInteractive colorScheme={t.scheme}>
            <Icon name={icons[1] ?? 'move'} size={22} tone="accent" />
          </AnimatedGlassView>
        </GestureDetector>
        <GlassView style={styles.glassButton} isInteractive colorScheme={t.scheme}>
          <Icon name={icons[2] ?? 'star'} size={22} tone="accent" />
        </GlassView>
      </GlassContainer>
    );
  }

  return (
    <View style={[styles.mergeRow, { gap: BUTTON_GAP }]}>
      <GlassSurface radius={BUTTON / 2} style={styles.glassButton}>
        <Icon name={icons[0] ?? 'heart'} size={22} tone="accent" />
      </GlassSurface>
      <GestureDetector gesture={pan}>
        <Animated.View style={dragStyle}>
          <GlassSurface radius={BUTTON / 2} style={styles.glassButton}>
            <Icon name={icons[1] ?? 'move'} size={22} tone="accent" />
          </GlassSurface>
        </Animated.View>
      </GestureDetector>
      <GlassSurface radius={BUTTON / 2} style={styles.glassButton}>
        <Icon name={icons[2] ?? 'star'} size={22} tone="accent" />
      </GlassSurface>
    </View>
  );
}

/**
 * A glass panel you can throw around. On release the finger's velocity is
 * projected forward (~150ms) and the panel springs to whichever corner is
 * nearest to that projected point, so a flick lands it across the screen.
 */
function DraggablePanel({ width, areaHeight }: { width: number; areaHeight: SharedValue<number> }) {
  const t = useTheme();
  const haptics = useHaptics();
  const onSettle = haptics.light;

  const x = useSharedValue(width - PANEL_W - PAD);
  const y = useSharedValue(420);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const lifted = useSharedValue(0);

  const pan = usePanGesture({
    onBegin: () => {
      'worklet';
      startX.value = x.value;
      startY.value = y.value;
    },
    onActivate: () => {
      'worklet';
      lifted.value = spring(1, springs.press);
    },
    onUpdate: (e) => {
      'worklet';
      x.value = startX.value + e.translationX;
      y.value = startY.value + e.translationY;
    },
    onDeactivate: (e) => {
      'worklet';
      lifted.value = spring(0, springs.gentle);
      const maxX = width - PANEL_W - PAD;
      const maxY = areaHeight.value - PANEL_H - PAD;
      const projectedX = x.value + e.velocityX * 0.15;
      const projectedY = y.value + e.velocityY * 0.15;
      const targetX = projectedX + PANEL_W / 2 < width / 2 ? PAD : maxX;
      const targetY = projectedY + PANEL_H / 2 < areaHeight.value / 2 ? PAD : maxY;
      x.value = spring(targetX, springs.gentle, e.velocityX);
      y.value = spring(targetY, springs.gentle, e.velocityY);
      scheduleOnRN(onSettle);
    },
  });

  // Keep the panel inside the area once we know its real height.
  useAnimatedReaction(
    () => areaHeight.value,
    (h) => {
      const maxY = h - PANEL_H - PAD;
      if (lifted.value === 0 && y.value > maxY) y.value = maxY;
    },
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: 1 + lifted.value * 0.04 }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.panel, style]} accessible accessibilityLabel="Draggable glass panel. Drag and release to snap to a corner.">
        <GlassSurface radius={t.radii.lg} interactive style={[styles.panelInner, { padding: t.spacing.md }]}>
          <Icon name="move" size={20} tone="accent" />
          <AppText variant="bodySemibold" style={{ marginTop: t.spacing.xs }}>
            Drag me
          </AppText>
          <AppText variant="caption" tone="secondary">
            Flick to a corner
          </AppText>
        </GlassSurface>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mergeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: BUTTON + 16,
  },
  glassButton: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: PANEL_W,
    height: PANEL_H,
  },
  panelInner: {
    flex: 1,
    justifyContent: 'center',
  },
});
