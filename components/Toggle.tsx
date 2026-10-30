import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { spring, springs } from '@/lib/motion';

const TRACK_W = 56;
const TRACK_H = 34;
const KNOB = 26;
const PAD = (TRACK_H - KNOB) / 2;
const STRETCH = 8;

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel?: string;
};

/**
 * Controlled toggle. The knob stretches while the finger is down and the
 * position spring follows `value`, so the same component works for app
 * settings and for optimistic UI.
 */
export function Toggle({ value, onValueChange, accessibilityLabel }: Props) {
  const t = useTheme();
  const haptics = useHaptics();
  const onSelect = haptics.selection;

  const progress = useSharedValue(value ? 1 : 0);
  const stretch = useSharedValue(0);

  useEffect(() => {
    progress.value = spring(value ? 1 : 0, springs.snappy);
  }, [value, progress]);

  const change = () => onValueChange(!value);

  const tap = useTapGesture({
    maxDuration: 6000,
    maxDistance: 30,
    onBegin: () => {
      'worklet';
      stretch.value = spring(1, springs.press);
    },
    onActivate: () => {
      'worklet';
      scheduleOnRN(onSelect);
      scheduleOnRN(change);
    },
    onFinalize: () => {
      'worklet';
      stretch.value = spring(0, springs.bouncy);
    },
  });

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [t.colors.borderStrong, t.colors.accent]),
  }));
  const knobStyle = useAnimatedStyle(() => {
    const width = KNOB + stretch.value * STRETCH;
    return {
      width,
      transform: [{ translateX: interpolate(progress.value, [0, 1], [PAD, TRACK_W - PAD - width]) }],
    };
  });

  return (
    <GestureDetector gesture={tap}>
      <View
        accessible
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked: value }}
        hitSlop={8}
      >
        <Animated.View style={[styles.track, trackStyle]}>
          <Animated.View
            style={[styles.knob, { backgroundColor: t.colors.onAccent }, t.isDark ? null : t.shadows.card, knobStyle]}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    left: 0,
    height: KNOB,
    borderRadius: KNOB / 2,
  },
});
