import { BlurMask, Canvas, Circle, Group, LinearGradient, Path, RoundedRect, Skia, vec } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';

type Slide = { key: string; title: string; body: string; icon: IconName };

const SLIDES: Slide[] = [
  { key: 'move', title: 'Everything moves', body: 'Springs, timings and gestures that run on the UI thread, at the refresh rate of your screen.', icon: 'sparkles' },
  { key: 'touch', title: 'Built for touch', body: 'Drag, swipe, press and hold. Every gesture answers with motion and a matching haptic.', icon: 'hand-left' },
  { key: 'draw', title: 'Drawn with Skia', body: 'Gradients, glare, particles and charts rendered straight on the GPU.', icon: 'color-palette' },
  { key: 'ship', title: 'Ready to explore', body: 'Favorite the demos you love and study them in slow motion from Settings.', icon: 'rocket' },
];

const ART_H = 300;
const RING = 64;
const RING_STROKE = 3;

/**
 * Onboarding with multi-layer parallax. Each slide's distance from center is
 * `d = (scrollX - index * width) / width`. Every illustration layer offsets
 * itself by a different fraction of `d * width`: background layers counteract
 * the page movement (so they move slower), the front layer adds to it (so it
 * moves faster). The ring around the Next button fills with overall progress,
 * and the button widens into "Get started" on the last slide.
 */
export default function OnboardingScreen() {
  const t = useTheme();
  const haptics = useHaptics();
  const { width } = useWindowDimensions();
  const count = SLIDES.length;
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [page, setPage] = useState(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  useAnimatedReaction(
    () => Math.round(scrollX.value / width),
    (current, previous) => {
      if (previous !== null && current !== previous) scheduleOnRN(setPage, current);
    },
  );

  const goTo = (index: number) => {
    haptics.selection();
    scrollTo(scrollRef, Math.max(0, Math.min(count - 1, index)) * width, 0, true);
  };

  const palettes = useMemo<[string, string][]>(
    () => [
      [t.colors.accent, t.colors.heart],
      [t.colors.info, t.colors.accent],
      [t.colors.success, t.colors.info],
      [t.colors.warning, t.colors.heart],
    ],
    [t],
  );

  // Ring progress: 1/4 on the first slide, full on the last.
  const ringProgress = useDerivedValue(() => interpolate(scrollX.value / width + 1, [0, count], [0, 1], Extrapolation.CLAMP));
  const ringPath = useMemo(
    () => Skia.Path.Circle(RING / 2, RING / 2, RING / 2 - RING_STROKE),
    [],
  );
  const ringTransform = useMemo(() => [{ rotate: -Math.PI / 2 }], []);

  const lastStart = width * (count - 2);
  const lastEnd = width * (count - 1);
  const nextStyle = useAnimatedStyle(() => ({
    width: interpolate(scrollX.value, [lastStart, lastEnd], [RING, 168], Extrapolation.CLAMP),
  }));
  const arrowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [lastStart, lastStart + width * 0.5], [1, 0], Extrapolation.CLAMP),
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [lastStart + width * 0.5, lastEnd], [0, 1], Extrapolation.CLAMP),
  }));
  const skipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [lastStart, lastEnd], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <DemoScreen id="onboarding">
      <View style={styles.flex}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          bounces={false}
        >
          {SLIDES.map((slide, index) => (
            <SlideView key={slide.key} slide={slide} index={index} width={width} scrollX={scrollX} colors={palettes[index] ?? palettes[0]!} />
          ))}
        </Animated.ScrollView>

        <Animated.View style={[styles.skip, { top: t.spacing.sm, right: t.spacing.lg }, skipStyle]}>
          <PressableScale onPress={() => goTo(count - 1)} scaleTo={0.92} haptic="none" accessibilityLabel="Skip onboarding" style={styles.skipButton}>
            <AppText variant="caption" tone="secondary">
              Skip
            </AppText>
          </PressableScale>
        </Animated.View>

        <View style={[styles.footer, { paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing.xl }]}>
          <View style={[styles.dots, { gap: t.spacing.sm }]}>
            {SLIDES.map((slide, index) => (
              <Dot key={slide.key} index={index} width={width} scrollX={scrollX} />
            ))}
          </View>
          <PressableScale
            onPress={() => {
              if (page >= count - 1) {
                haptics.success();
                goTo(0);
              } else {
                goTo(page + 1);
              }
            }}
            scaleTo={0.92}
            haptic="none"
            accessibilityLabel={page >= count - 1 ? 'Get started' : 'Next slide'}
          >
            <Animated.View style={[styles.next, { height: RING, borderRadius: RING / 2, backgroundColor: t.colors.accent }, nextStyle]}>
              <Animated.View style={[StyleSheet.absoluteFill, styles.center, arrowStyle]}>
                <Icon name="arrow-forward" size={24} tone="onAccent" />
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, styles.center, ctaStyle]}>
                <AppText variant="bodySemibold" tone="onAccent">
                  Get started
                </AppText>
              </Animated.View>
            </Animated.View>
            <View pointerEvents="none" style={[styles.ring, { width: RING, height: RING }]}>
              <Canvas style={{ width: RING, height: RING }}>
                <Group origin={vec(RING / 2, RING / 2)} transform={ringTransform}>
                  <Path path={ringPath} color={t.colors.accentSoft} style="stroke" strokeWidth={RING_STROKE} />
                  <Path path={ringPath} color={t.colors.onAccent} style="stroke" strokeWidth={RING_STROKE} strokeCap="round" start={0} end={ringProgress} />
                </Group>
              </Canvas>
            </View>
          </PressableScale>
        </View>
      </View>
    </DemoScreen>
  );
}

function SlideView({
  slide,
  index,
  width,
  scrollX,
  colors,
}: {
  slide: Slide;
  index: number;
  width: number;
  scrollX: SharedValue<number>;
  colors: [string, string];
}) {
  const t = useTheme();
  const distance = useDerivedValue(() => (scrollX.value - index * width) / width);

  // Background moves at half speed, middle at three quarters, front faster than the page.
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: distance.value * width * 0.5 }, { scale: 1 - Math.abs(distance.value) * 0.2 }],
    opacity: 1 - Math.abs(distance.value) * 0.5,
  }));
  const midStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: distance.value * width * 0.25 }, { rotate: `${distance.value * 25}deg` }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -distance.value * width * 0.2 }, { scale: 1 - Math.abs(distance.value) * 0.35 }],
    opacity: 1 - Math.abs(distance.value) * 0.8,
  }));
  const sparkStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -distance.value * width * 0.45 }, { translateY: distance.value * 30 }],
    opacity: 1 - Math.abs(distance.value),
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(distance.value, [-0.7, 0, 0.7], [0, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: Math.abs(distance.value) * 24 }],
  }));

  const sparkles = useMemo(
    () => [
      { x: width * 0.22, y: ART_H * 0.22, r: 5 },
      { x: width * 0.78, y: ART_H * 0.3, r: 7 },
      { x: width * 0.7, y: ART_H * 0.78, r: 4 },
      { x: width * 0.26, y: ART_H * 0.74, r: 6 },
    ],
    [width],
  );

  return (
    <View style={{ width }}>
      <View style={{ height: ART_H }}>
        <Animated.View style={[StyleSheet.absoluteFill, backStyle]}>
          <Canvas style={{ width, height: ART_H }}>
            <Circle cx={width / 2} cy={ART_H / 2} r={120} color={colors[0]} opacity={0.5}>
              <BlurMask blur={48} style="normal" />
            </Circle>
          </Canvas>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, midStyle]}>
          <Canvas style={{ width, height: ART_H }}>
            <Group origin={vec(width / 2, ART_H / 2)} transform={[{ rotate: 0.2 }]}>
              <RoundedRect x={width / 2 - 90} y={ART_H / 2 - 90} width={180} height={180} r={44}>
                <LinearGradient start={vec(width / 2 - 90, ART_H / 2 - 90)} end={vec(width / 2 + 90, ART_H / 2 + 90)} colors={colors} />
              </RoundedRect>
            </Group>
          </Canvas>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, frontStyle]}>
          <View style={[styles.iconCircle, { backgroundColor: t.colors.surface }, t.isDark ? null : t.shadows.floating]}>
            <Icon name={slide.icon} size={44} color={colors[0]} />
          </View>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, sparkStyle]} pointerEvents="none">
          <Canvas style={{ width, height: ART_H }}>
            {sparkles.map((s, i) => (
              <Circle key={i} cx={s.x} cy={s.y} r={s.r} color={i % 2 === 0 ? colors[1] : t.colors.onAccent} />
            ))}
          </Canvas>
        </Animated.View>
      </View>
      <Animated.View style={[{ paddingHorizontal: t.spacing.xxl, marginTop: t.spacing.lg }, textStyle]}>
        <AppText variant="title" style={styles.centerText}>
          {slide.title}
        </AppText>
        <AppText tone="secondary" style={[styles.centerText, { marginTop: t.spacing.sm }]}>
          {slide.body}
        </AppText>
      </Animated.View>
    </View>
  );
}

function Dot({ index, width, scrollX }: { index: number; width: number; scrollX: SharedValue<number> }) {
  const t = useTheme();
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value / width - index);
    return {
      width: interpolate(distance, [0, 1], [26, 8], Extrapolation.CLAMP),
      opacity: interpolate(distance, [0, 1], [1, 0.3], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: t.colors.accent }, style]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  iconCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skip: {
    position: 'absolute',
  },
  skipButton: {
    paddingHorizontal: 12,
    height: 36,
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  next: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
