import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useHaptics, type HapticKind } from '@/hooks/useHaptics';
import { spring, springs } from '@/lib/motion';

type Props = PropsWithChildren<{
  onPress?: () => void;
  /** Scale while the finger is down. */
  scaleTo?: number;
  haptic?: HapticKind | 'none';
  disabled?: boolean;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}>;

/**
 * The app's standard tappable surface. The tap gesture runs on the UI thread:
 * `onBegin` squishes the view the moment the finger lands, `onFinalize` springs
 * it back whether the tap succeeded or was cancelled by a scroll, and
 * `onActivate` hops to the JS thread once to fire haptics and `onPress`.
 */
export function PressableScale({
  children,
  onPress,
  scaleTo = 0.96,
  haptic = 'light',
  disabled = false,
  hitSlop,
  style,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const scale = useSharedValue(1);
  const haptics = useHaptics();
  const fireHaptic = haptic === 'none' ? undefined : haptics[haptic];

  const tap = useTapGesture({
    enabled: !disabled,
    maxDuration: 6000,
    maxDistance: 24,
    hitSlop,
    onBegin: () => {
      'worklet';
      scale.value = spring(scaleTo, springs.press);
    },
    onActivate: () => {
      'worklet';
      if (fireHaptic) scheduleOnRN(fireHaptic);
      if (onPress) scheduleOnRN(onPress);
    },
    onFinalize: () => {
      'worklet';
      scale.value = spring(1, springs.bouncy);
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        style={[style, animatedStyle]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
