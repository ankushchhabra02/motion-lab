import { useRouter } from 'expo-router';
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
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { findDemo, type Demo } from '@/data/demos';
import { useFavorites } from '@/hooks/useFavorites';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { fadeOut, layoutSpring, spring, springs, staggerIn } from '@/lib/motion';

export default function FavoritesScreen() {
  const t = useTheme();
  const router = useRouter();
  const { favorites, remove } = useFavorites();
  const demos = favorites.map(findDemo).filter((d): d is Demo => d !== undefined);

  return (
    <View style={[styles.flex, { backgroundColor: t.colors.background }]}>
      {demos.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="No favorites yet"
          message="Tap the heart on any demo and it will be saved here for quick access."
          actionLabel="Browse demos"
          onAction={() => router.navigate('/gallery' as never)}
        />
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md, paddingBottom: t.spacing.xxxl * 2 }}
          showsVerticalScrollIndicator={false}
        >
          <AppText variant="caption" tone="tertiary" style={{ marginBottom: t.spacing.xs }}>
            Swipe left on a card to remove it
          </AppText>
          {demos.map((demo, index) => (
            <FavoriteRow
              key={demo.id}
              demo={demo}
              index={index}
              onOpen={() => router.push(demo.route as never)}
              onRemove={() => remove(demo.id)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const REMOVE_FRACTION = 0.4;
const FLICK_VELOCITY = -900;

/**
 * Swipe-to-remove row. The pan only activates after 12pt of horizontal travel
 * and fails after 10pt of vertical travel, so the ScrollView keeps vertical
 * scrolling. Release past 40% of the width (or a fast flick) springs the card
 * out carrying the release velocity, then removes it; anything else springs
 * back with that same velocity so the motion never restarts from rest.
 */
function FavoriteRow({ demo, index, onOpen, onRemove }: { demo: Demo; index: number; onOpen: () => void; onRemove: () => void }) {
  const t = useTheme();
  const haptics = useHaptics();
  const onCrossThreshold = haptics.light;
  const { width } = useWindowDimensions();
  const rowWidth = width - t.spacing.lg * 2;

  const translateX = useSharedValue(0);
  const pastThreshold = useSharedValue(0);

  const finishRemove = () => {
    haptics.medium();
    onRemove();
  };

  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-10, 10],
    onUpdate: (e) => {
      'worklet';
      translateX.value = e.translationX < 0 ? e.translationX : e.translationX * 0.15;
      const past = -e.translationX > rowWidth * REMOVE_FRACTION ? 1 : 0;
      if (past !== pastThreshold.value) {
        pastThreshold.value = past;
        if (past === 1) scheduleOnRN(onCrossThreshold);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      const shouldRemove = !e.canceled && (-e.translationX > rowWidth * REMOVE_FRACTION || e.velocityX < FLICK_VELOCITY);
      if (shouldRemove) {
        translateX.value = spring(-rowWidth * 1.15, springs.stiff, e.velocityX, (finished) => {
          if (finished) scheduleOnRN(finishRemove);
        });
      } else {
        pastThreshold.value = 0;
        translateX.value = spring(0, springs.snappy, e.velocityX);
      }
    },
  });

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(-translateX.value, [0, 32], [0, 1], Extrapolation.CLAMP),
  }));
  const trashScale = useDerivedValue(() => spring(pastThreshold.value === 1 ? 1.25 : 1, springs.bouncy));
  const trashStyle = useAnimatedStyle(() => ({ transform: [{ scale: trashScale.value }] }));

  return (
    <Animated.View entering={staggerIn(index)} exiting={fadeOut()} layout={layoutSpring()}>
      <View style={{ borderRadius: t.radii.lg, overflow: 'hidden' }}>
        <Animated.View pointerEvents="none" style={[styles.backdrop, { backgroundColor: t.colors.danger, paddingRight: t.spacing.xl }, backdropStyle]}>
          <Animated.View style={trashStyle}>
            <Icon name="trash-outline" size={22} tone="onAccent" />
          </Animated.View>
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View style={cardStyle}>
            <PressableScale
              onPress={onOpen}
              scaleTo={0.98}
              accessibilityLabel={`Open ${demo.title}`}
              style={[
                styles.card,
                {
                  backgroundColor: t.colors.surface,
                  borderRadius: t.radii.lg,
                  padding: t.spacing.lg,
                  gap: t.spacing.md,
                  borderColor: t.colors.border,
                  borderWidth: t.isDark ? StyleSheet.hairlineWidth : 0,
                },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: t.colors.accentSoft, borderRadius: t.radii.sm }]}>
                <Icon name={demo.icon} size={20} tone="accent" />
              </View>
              <View style={styles.flex}>
                <AppText variant="bodySemibold" numberOfLines={1}>
                  {demo.title}
                </AppText>
                <AppText variant="caption" tone="secondary">
                  {demo.category}
                </AppText>
              </View>
              <Icon name="chevron-forward" size={18} tone="tertiary" />
            </PressableScale>
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
