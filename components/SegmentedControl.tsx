import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { spring, springs } from '@/lib/motion';

const PAD = 4;
const HEIGHT = 36;

export type SegmentOption<T> = { label: string; value: T };

type Props<T> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

/**
 * iOS-style segmented control. The thumb's translateX is `animatedIndex *
 * segmentWidth`, so it springs between segments and still lands correctly if
 * the control is re-measured mid-animation.
 */
export function SegmentedControl<T extends string | number>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const t = useTheme();
  const haptics = useHaptics();
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const count = options.length;

  const innerWidth = useSharedValue(0);
  const animatedIndex = useSharedValue(index);

  useEffect(() => {
    animatedIndex.value = spring(index, springs.snappy);
  }, [index, animatedIndex]);

  const thumbStyle = useAnimatedStyle(() => {
    const segment = innerWidth.value / count;
    return { width: segment, transform: [{ translateX: animatedIndex.value * segment }] };
  });

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => {
        innerWidth.value = e.nativeEvent.layout.width - PAD * 2;
      }}
      style={[styles.track, { backgroundColor: t.colors.background, borderRadius: t.radii.md }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          { backgroundColor: t.colors.surface, borderRadius: t.radii.sm },
          t.isDark ? { borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.borderStrong } : t.shadows.card,
          thumbStyle,
        ]}
      />
      {options.map((option, i) => (
        <Segment
          key={String(option.value)}
          label={option.label}
          index={i}
          animatedIndex={animatedIndex}
          selected={i === index}
          onPress={() => {
            if (i !== index) {
              haptics.selection();
              onChange(option.value);
            }
          }}
        />
      ))}
    </View>
  );
}

function Segment({
  label,
  index,
  animatedIndex,
  selected,
  onPress,
}: {
  label: string;
  index: number;
  animatedIndex: SharedValue<number>;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  // Distance from the thumb (0..1) picks the label color, so labels cross-fade as the thumb passes.
  const textStyle = useAnimatedStyle(() => {
    const distance = Math.min(1, Math.abs(animatedIndex.value - index));
    return { color: interpolateColor(distance, [0, 1], [t.colors.text, t.colors.textSecondary]) };
  });

  return (
    <PressableScale
      onPress={onPress}
      haptic="none"
      scaleTo={0.96}
      accessibilityLabel={label}
      style={styles.segment}
    >
      <View accessibilityRole="radio" accessibilityState={{ selected }}>
        <Animated.Text style={[t.typography.caption, textStyle]}>{label}</Animated.Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: PAD,
  },
  thumb: {
    position: 'absolute',
    top: PAD,
    left: PAD,
    height: HEIGHT,
  },
  segment: {
    flex: 1,
    height: HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
