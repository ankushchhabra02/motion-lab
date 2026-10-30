import { useEffect, useRef, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/hooks/useTheme';
import { spring, springs, timing } from '@/lib/motion';

type ChipLayout = { x: number; width: number };

type Props = {
  items: readonly string[];
  selected: number;
  onSelect: (index: number) => void;
};

const CHIP_HEIGHT = 34;

/**
 * Filter chips in the style of the App Store and Music: separate gray
 * capsules in a horizontal scroll, with the selected one filled in the tint
 * color. One accent pill slides between chips; each chip's gray background
 * fades out when selected so the pill shows through.
 *
 * Each chip reports its x/width via onLayout into a shared record, and one
 * `useAnimatedReaction` springs the pill to the selected chip (jumping on the
 * very first layout so it never flies in from the edge).
 */
export function CategoryChips({ items, selected, onSelect }: Props) {
  const t = useTheme();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const layouts = useSharedValue<Record<number, ChipLayout>>({});
  const selectedSV = useSharedValue(selected);
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);
  const pillOpacity = useSharedValue(0);

  useEffect(() => {
    selectedSV.value = selected;
    // Keep the selected chip in view when it sits near an edge.
    const layout = layouts.get()[selected];
    if (layout) scrollRef.current?.scrollTo({ x: Math.max(0, layout.x - 48), animated: true });
  }, [selected, selectedSV, layouts]);

  useAnimatedReaction(
    () => ({ index: selectedSV.value, layout: layouts.value[selectedSV.value] }),
    (current, previous) => {
      if (!current.layout) return;
      if (previous === null || !previous.layout) {
        pillX.value = current.layout.x;
        pillW.value = current.layout.width;
        pillOpacity.value = timing(1, 150);
      } else {
        pillX.value = spring(current.layout.x, springs.snappy);
        pillW.value = spring(current.layout.width, springs.snappy);
      }
    },
  );

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
    width: pillW.value,
    transform: [{ translateX: pillX.value }],
  }));

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingHorizontal: t.spacing.lg, gap: t.spacing.sm }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.pill, { left: 0, backgroundColor: t.colors.accent, borderRadius: CHIP_HEIGHT / 2 }, pillStyle]}
      />
      {items.map((label, index) => (
        <Chip
          key={label}
          label={label}
          index={index}
          selectedSV={selectedSV}
          onPress={() => onSelect(index)}
          onLayout={(e: LayoutChangeEvent) => {
            const { x, width } = e.nativeEvent.layout;
            layouts.value = { ...layouts.value, [index]: { x, width } };
          }}
        />
      ))}
    </ScrollView>
  );
}

type ChipProps = {
  label: string;
  index: number;
  selectedSV: SharedValue<number>;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
};

function Chip({ label, index, selectedSV, onPress, onLayout }: ChipProps) {
  const t = useTheme();
  const progress = useDerivedValue(() => timing(selectedSV.value === index ? 1 : 0, 180));
  const backgroundStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [t.colors.text, t.colors.onAccent]),
  }));

  return (
    <View onLayout={onLayout}>
      <PressableScale
        onPress={onPress}
        scaleTo={0.94}
        haptic="selection"
        accessibilityLabel={`Filter ${label}`}
        style={[styles.chip, { paddingHorizontal: t.spacing.lg }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.fill, borderRadius: CHIP_HEIGHT / 2 }, backgroundStyle]}
        />
        <Animated.Text style={[t.typography.caption, styles.label, textStyle]}>{label}</Animated.Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
  },
  pill: {
    position: 'absolute',
    top: 0,
    height: CHIP_HEIGHT,
  },
  chip: {
    height: CHIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '500',
  },
});
