import { StyleSheet, View } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/Icon';
import { useFavorites } from '@/hooks/useFavorites';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { easings, spring, springs, timing } from '@/lib/motion';

const SIZE = 34;

/**
 * Favorite toggle with a pop, sized to sit inside the native header toolbar.
 * Favoriting runs a three-step scale sequence (dip, overshoot, settle) and
 * fires an expanding ring; unfavoriting just settles back. `active` is
 * captured from the render that received the tap, so the worklet knows which
 * direction the toggle is going.
 */
export function HeartButton({ id }: { id: string }) {
  const t = useTheme();
  const haptics = useHaptics();
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(id);

  const scale = useSharedValue(1);
  const ring = useSharedValue(1); // 1 = finished and hidden

  const onToggle = () => {
    const nowActive = toggle(id);
    if (nowActive) haptics.success();
    else haptics.light();
  };

  const tap = useTapGesture({
    maxDuration: 6000,
    maxDistance: 24,
    onBegin: () => {
      'worklet';
      scale.value = spring(0.82, springs.press);
    },
    onActivate: () => {
      'worklet';
      if (active) {
        scale.value = spring(1, springs.snappy);
      } else {
        scale.value = withSequence(timing(0.7, 60, easings.out), spring(1.35, springs.bouncy), spring(1, springs.snappy));
        ring.value = 0;
        ring.value = timing(1, 520, easings.out);
      }
      scheduleOnRN(onToggle);
    },
    onFinalize: (e) => {
      'worklet';
      if (e.canceled) scale.value = spring(1, springs.snappy);
    },
  });

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - ring.value,
    transform: [{ scale: 0.6 + ring.value * 1.2 }],
  }));

  return (
    <GestureDetector gesture={tap}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={active ? 'Remove from favorites' : 'Add to favorites'}
        accessibilityState={{ selected: active }}
        hitSlop={6}
        style={styles.button}
      >
        <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: t.colors.heart }, ringStyle]} />
        <Animated.View style={iconStyle}>
          <Icon name={active ? 'heart' : 'heart-outline'} size={22} color={active ? t.colors.heart : t.colors.accent} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
  },
});
