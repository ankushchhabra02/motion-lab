import { BlurMask, Canvas, Circle, LinearGradient, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/hooks/useTheme';

type Place = { id: string; title: string; subtitle: string; icon: IconName; peaks: number[]; sun: number };

const PLACES: Place[] = [
  { id: 'dolomites', title: 'Dolomites', subtitle: 'Alta Via 1 · 7 days', icon: 'trail-sign', peaks: [0.55, 0.2, 0.62, 0.35, 0.7], sun: 0.72 },
  { id: 'faroe', title: 'Faroe Islands', subtitle: 'Sea cliffs · 4 days', icon: 'boat', peaks: [0.4, 0.52, 0.3, 0.6, 0.45], sun: 0.3 },
  { id: 'atacama', title: 'Atacama', subtitle: 'Star desert · 5 days', icon: 'telescope', peaks: [0.7, 0.5, 0.75, 0.55, 0.65], sun: 0.55 },
  { id: 'kyoto', title: 'Kyoto', subtitle: 'Temple trails · 3 days', icon: 'leaf', peaks: [0.62, 0.45, 0.5, 0.68, 0.58], sun: 0.8 },
  { id: 'lofoten', title: 'Lofoten', subtitle: 'Midnight sun · 6 days', icon: 'snow', peaks: [0.35, 0.6, 0.28, 0.5, 0.4], sun: 0.2 },
];

const GAP = 16;

/**
 * Parallax carousel. The ScrollView snaps every `interval` points. Each card
 * computes its distance from center as `(scrollX - i * interval) / interval`
 * and interpolates scale and opacity from it. The artwork is drawn wider than
 * the card and translated by a fraction of that distance in the opposite
 * direction, so it appears to move slower than the card, which is parallax.
 */
export default function ParallaxCarouselScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const cardW = width - 80;
  const cardH = Math.round(cardW * 1.25);
  const interval = cardW + GAP;
  const sidePadding = (width - cardW) / 2;

  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  const palettes = useMemo<[string, string][]>(
    () => [
      [t.colors.accent, t.colors.heart],
      [t.colors.info, t.colors.accent],
      [t.colors.warning, t.colors.heart],
      [t.colors.success, t.colors.info],
      [t.colors.accentStrong, t.colors.info],
    ],
    [t],
  );

  // Ambient glow behind the carousel cross-fades to the centered card's color.
  const ambientStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      scrollX.value / interval,
      PLACES.map((_, i) => i),
      palettes.map((p) => p[0]),
    ),
  }));

  return (
    <DemoScreen id="parallax-carousel">
      <View style={styles.flex}>
        <Animated.View pointerEvents="none" style={[styles.ambient, { top: cardH * 0.25, height: cardH * 0.7 }, ambientStyle]} />
        <View style={styles.center}>
          <Animated.ScrollView
            horizontal
            onScroll={onScroll}
            scrollEventThrottle={16}
            snapToInterval={interval}
            decelerationRate="fast"
            disableIntervalMomentum
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: sidePadding, gap: GAP, alignItems: 'center' }}
            style={{ flexGrow: 0 }}
          >
            {PLACES.map((place, index) => (
              <Card
                key={place.id}
                place={place}
                index={index}
                colors={palettes[index % palettes.length] ?? palettes[0]!}
                width={cardW}
                height={cardH}
                interval={interval}
                scrollX={scrollX}
              />
            ))}
          </Animated.ScrollView>
          <View style={[styles.dots, { marginTop: t.spacing.xl, gap: t.spacing.sm }]}>
            {PLACES.map((place, index) => (
              <Dot key={place.id} index={index} interval={interval} scrollX={scrollX} />
            ))}
          </View>
        </View>
      </View>
    </DemoScreen>
  );
}

function Card({
  place,
  index,
  colors,
  width,
  height,
  interval,
  scrollX,
}: {
  place: Place;
  index: number;
  colors: [string, string];
  width: number;
  height: number;
  interval: number;
  scrollX: SharedValue<number>;
}) {
  const t = useTheme();
  const artW = width * 1.4; // wider than the card so it can slide without showing edges
  const parallax = width * 0.2;

  const cardStyle = useAnimatedStyle(() => {
    const distance = (scrollX.value - index * interval) / interval; // 0 when centered
    return {
      opacity: interpolate(distance, [-1, 0, 1], [0.55, 1, 0.55], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(distance, [-1, 0, 1], [0.9, 1, 0.9], Extrapolation.CLAMP) }],
    };
  });
  const artStyle = useAnimatedStyle(() => {
    const distance = (scrollX.value - index * interval) / interval;
    return {
      transform: [{ translateX: -(artW - width) / 2 + interpolate(distance, [-1, 1], [-parallax, parallax], Extrapolation.CLAMP) }],
    };
  });
  const textStyle = useAnimatedStyle(() => {
    const distance = (scrollX.value - index * interval) / interval;
    return {
      opacity: interpolate(distance, [-0.6, 0, 0.6], [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(distance, [-1, 0, 1], [16, 0, 16], Extrapolation.CLAMP) }],
    };
  });

  const mountains = useMemo(() => {
    const builder = Skia.PathBuilder.Make().moveTo(0, height);
    const step = artW / (place.peaks.length - 1);
    place.peaks.forEach((peak, i) => {
      builder.lineTo(i * step, height * (1 - peak * 0.55));
    });
    return builder.lineTo(artW, height).close().build();
  }, [artW, height, place.peaks]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: t.radii.xl,
          backgroundColor: t.colors.surface,
        },
        t.isDark ? null : t.shadows.floating,
        cardStyle,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: t.radii.xl, overflow: 'hidden' }]}>
        <Animated.View style={[{ width: artW, height }, artStyle]}>
          <Canvas style={{ width: artW, height }}>
            <Rect x={0} y={0} width={artW} height={height}>
              <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[colors[0], colors[1]]} />
            </Rect>
            <Circle cx={artW * place.sun} cy={height * 0.3} r={width * 0.16} color={t.colors.glare}>
              <BlurMask blur={18} style="normal" />
            </Circle>
            <Circle cx={artW * place.sun} cy={height * 0.3} r={width * 0.11} color={t.colors.onAccent} />
            <Path path={mountains} color={t.colors.overlay} />
            <Rect x={0} y={height * 0.55} width={artW} height={height * 0.45}>
              <LinearGradient start={vec(0, height * 0.55)} end={vec(0, height)} colors={[t.colors.glareClear, t.colors.overlay]} />
            </Rect>
          </Canvas>
        </Animated.View>
        <Animated.View style={[styles.cardText, { padding: t.spacing.xl }, textStyle]}>
          <View style={[styles.chip, { backgroundColor: t.colors.glare, borderRadius: t.radii.pill, paddingHorizontal: t.spacing.md }]}>
            <Icon name={place.icon} size={14} color={t.colors.onAccent} />
            <AppText variant="label" tone="onAccent">
              {place.subtitle.toUpperCase()}
            </AppText>
          </View>
          <AppText variant="title" tone="onAccent" style={{ marginTop: t.spacing.sm }}>
            {place.title}
          </AppText>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/** Page dot that stretches into a pill as its page centers. */
function Dot({ index, interval, scrollX }: { index: number; interval: number; scrollX: SharedValue<number> }) {
  const t = useTheme();
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value / interval - index);
    return {
      width: interpolate(distance, [0, 1], [24, 8], Extrapolation.CLAMP),
      opacity: interpolate(distance, [0, 1], [1, 0.35], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: t.colors.accent }, style]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  ambient: {
    position: 'absolute',
    left: 40,
    right: 40,
    borderRadius: 999,
    opacity: 0.35,
    transform: [{ scaleX: 1.2 }],
  },
  cardText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
