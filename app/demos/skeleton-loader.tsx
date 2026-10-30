import { Canvas, Circle, LinearGradient, RoundedRect, vec } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/hooks/useTheme';
import { delayed, easings, timing } from '@/lib/motion';

const CARD_H = 116;
const THUMB = 84;
const PAD = 16;
const LOAD_AFTER_MS = 1700;
const CARD_STAGGER_MS = 170;

type Article = { id: string; title: string; meta: string; tag: string; colors: [string, string] };

export default function SkeletonLoaderScreen() {
  const [run, setRun] = useState(0);
  return (
    <DemoScreen id="skeleton-loader">
      {/* Remounting restarts the shimmer and the fake network delay. */}
      <Feed key={run} onReload={() => setRun((r) => r + 1)} />
    </DemoScreen>
  );
}

function Feed({ onReload }: { onReload: () => void }) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const cardW = width - t.spacing.lg * 2;

  const articles: Article[] = [
    { id: 'a', title: 'Designing springs that feel physical', meta: 'Motion · 6 min read', tag: 'Guide', colors: [t.colors.accent, t.colors.heart] },
    { id: 'b', title: 'Why 120fps changes how you animate', meta: 'Performance · 4 min read', tag: 'Deep dive', colors: [t.colors.info, t.colors.accent] },
    { id: 'c', title: 'Skia shaders for the impatient', meta: 'Graphics · 9 min read', tag: 'Tutorial', colors: [t.colors.success, t.colors.info] },
    { id: 'd', title: 'Haptics: the invisible half of UI', meta: 'Interaction · 5 min read', tag: 'Essay', colors: [t.colors.warning, t.colors.heart] },
  ];

  // One shimmer phase shared by every card so the sweep is in sync. 0..1 loops forever.
  const shimmer = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      shimmer.value = 0.5;
      return;
    }
    shimmer.value = withRepeat(timing(1, 1400, easings.inOut), -1, false);
    return () => cancelAnimation(shimmer);
  }, [shimmer, reduceMotion]);

  // Header status cross-fades once the first card has loaded.
  const loadedAny = useSharedValue(0);
  useEffect(() => {
    loadedAny.value = delayed(LOAD_AFTER_MS, timing(1, 300));
  }, [loadedAny]);

  // Stop the shimmer loop once every card has its content; no point burning frames on hidden skeletons.
  useEffect(() => {
    const allLoadedAt = LOAD_AFTER_MS + articles.length * CARD_STAGGER_MS + 600;
    const handle = setTimeout(() => cancelAnimation(shimmer), allLoadedAt);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const loadingStyle = useAnimatedStyle(() => ({ opacity: 1 - loadedAny.value }));
  const doneStyle = useAnimatedStyle(() => ({ opacity: loadedAny.value }));

  return (
    <ScrollView
      contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md, paddingBottom: t.spacing.xxxl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.statusRow}>
        <Animated.View style={[styles.statusAbs, loadingStyle]}>
          <AppText variant="caption" tone="tertiary">
            Loading your feed…
          </AppText>
        </Animated.View>
        <Animated.View style={[styles.statusAbs, doneStyle]}>
          <AppText variant="caption" tone="success">
            Updated just now
          </AppText>
        </Animated.View>
      </View>
      {articles.map((article, index) => (
        <ArticleCard key={article.id} article={article} index={index} width={cardW} shimmer={shimmer} />
      ))}
      <PressableScale
        onPress={onReload}
        scaleTo={0.96}
        style={[
          styles.reload,
          { backgroundColor: t.colors.accentSoft, borderRadius: t.radii.pill, paddingVertical: t.spacing.md },
        ]}
        accessibilityLabel="Reload feed"
      >
        <Icon name="refresh" size={18} tone="accent" />
        <AppText variant="bodySemibold" tone="accent">
          Reload
        </AppText>
      </PressableScale>
    </ScrollView>
  );
}

/**
 * Two layers stacked in a fixed-height card: a Skia skeleton and the real
 * content. `loaded` goes 0 -> 1 after a staggered delay; the skeleton fades
 * and shrinks slightly while the content fades in and rises, so the swap
 * reads as the content "arriving" rather than snapping.
 */
function ArticleCard({
  article,
  index,
  width,
  shimmer,
}: {
  article: Article;
  index: number;
  width: number;
  shimmer: SharedValue<number>;
}) {
  const t = useTheme();
  const loaded = useSharedValue(0);

  useEffect(() => {
    loaded.value = delayed(LOAD_AFTER_MS + index * CARD_STAGGER_MS, timing(1, 420, easings.out));
  }, [loaded, index]);

  // The shimmer band is a diagonal gradient whose start/end slide across the card.
  const band = width * 0.9;
  const start = useDerivedValue(() => vec(-band + shimmer.value * (width + band * 2), 0));
  const end = useDerivedValue(() => vec(start.value.x + band, CARD_H));
  const shimmerColors = [t.colors.skeleton, t.colors.skeletonHighlight, t.colors.skeleton];

  const skeletonStyle = useAnimatedStyle(() => ({
    opacity: 1 - loaded.value,
    transform: [{ scale: 1 - loaded.value * 0.03 }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: loaded.value,
    transform: [{ translateY: (1 - loaded.value) * 10 }],
  }));

  const textX = PAD + THUMB + PAD;
  const textW = width - textX - PAD;

  return (
    <View
      style={[
        {
          width,
          height: CARD_H,
          backgroundColor: t.colors.surface,
          borderRadius: t.radii.lg,
          borderColor: t.colors.border,
          borderWidth: t.isDark ? StyleSheet.hairlineWidth : 0,
          overflow: 'hidden',
        },
        t.isDark ? null : t.shadows.card,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, skeletonStyle]} pointerEvents="none">
        <Canvas style={{ width, height: CARD_H }}>
          {[
            { x: PAD, y: PAD, w: THUMB, h: THUMB, r: 14 },
            { x: textX, y: PAD + 4, w: textW * 0.5, h: 12, r: 6 },
            { x: textX, y: PAD + 28, w: textW, h: 14, r: 7 },
            { x: textX, y: PAD + 50, w: textW * 0.7, h: 14, r: 7 },
            { x: textX, y: PAD + 78, w: textW * 0.35, h: 10, r: 5 },
          ].map((rect, i) => (
            <RoundedRect key={i} x={rect.x} y={rect.y} width={rect.w} height={rect.h} r={rect.r}>
              <LinearGradient start={start} end={end} colors={shimmerColors} positions={[0, 0.5, 1]} />
            </RoundedRect>
          ))}
        </Canvas>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, styles.content, { padding: PAD, gap: PAD }, contentStyle]}>
        <Canvas style={{ width: THUMB, height: THUMB }}>
          <RoundedRect x={0} y={0} width={THUMB} height={THUMB} r={14}>
            <LinearGradient start={vec(0, 0)} end={vec(THUMB, THUMB)} colors={article.colors} />
          </RoundedRect>
          <Circle cx={THUMB * 0.68} cy={THUMB * 0.34} r={THUMB * 0.2} color={t.colors.glare} />
        </Canvas>
        <View style={styles.textCol}>
          <AppText variant="label" tone="accent">
            {article.tag.toUpperCase()}
          </AppText>
          <AppText variant="bodySemibold" numberOfLines={2} style={{ marginTop: 4 }}>
            {article.title}
          </AppText>
          <AppText variant="caption" tone="secondary" style={{ marginTop: 4 }}>
            {article.meta}
          </AppText>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    height: 18,
  },
  statusAbs: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  content: {
    flexDirection: 'row',
  },
  textCol: {
    flex: 1,
    justifyContent: 'center',
  },
  reload: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
});
