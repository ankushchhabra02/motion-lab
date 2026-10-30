import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { Icon } from '@/components/Icon';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { spring, springs } from '@/lib/motion';

const ITEM_H = 68;
const GAP = 8;
const SLOT = ITEM_H + GAP;

type Track = { id: string; title: string; artist: string; duration: string };

const TRACKS: Track[] = [
  { id: 't1', title: 'Spring Constant', artist: 'The Worklets', duration: '3:42' },
  { id: 't2', title: 'Sixty Frames', artist: 'Reanimated Youth', duration: '2:58' },
  { id: 't3', title: 'Ease Out Cubic', artist: 'Bezier & Sons', duration: '4:11' },
  { id: 't4', title: 'Haptic Heart', artist: 'Taptic Engine', duration: '3:05' },
  { id: 't5', title: 'Overshoot', artist: 'Damping Ratio', duration: '3:37' },
  { id: 't6', title: 'Shared Value', artist: 'UI Thread', duration: '2:44' },
  { id: 't7', title: 'Snap Point', artist: 'Velocity Club', duration: '3:19' },
];

type Positions = Record<string, number>;

/**
 * Drag to reorder. Every row is absolutely positioned at `index * SLOT`, and
 * the current index of each row lives in one shared `positions` map. While a
 * row is being dragged it follows the finger; whenever its center crosses into
 * another slot we shift the rows in between by one and spring them to their
 * new slots. React state only changes on drop, so the tree never reorders
 * mid-gesture (which would detach the gesture on the new Gesture Handler).
 */
export default function DragReorderScreen() {
  const t = useTheme();
  const positions = useSharedValue<Positions>(Object.fromEntries(TRACKS.map((track, i) => [track.id, i])));
  const [order, setOrder] = useState(TRACKS.map((track) => track.id));

  const commitOrder = () => {
    const current = positions.get();
    setOrder([...TRACKS.map((track) => track.id)].sort((a, b) => (current[a] ?? 0) - (current[b] ?? 0)));
  };

  const firstTrack = TRACKS.find((track) => track.id === order[0]);

  return (
    <DemoScreen id="drag-reorder">
      <View style={{ padding: t.spacing.lg, flex: 1 }}>
        <AppText variant="caption" tone="secondary">
          Long-press a track, then drag it to a new spot.
        </AppText>
        <View style={{ height: TRACKS.length * SLOT, marginTop: t.spacing.lg }}>
          {TRACKS.map((track, index) => (
            <Row key={track.id} track={track} initialIndex={index} positions={positions} count={TRACKS.length} onDrop={commitOrder} />
          ))}
        </View>
        <View
          style={[
            styles.nowPlaying,
            { backgroundColor: t.colors.accentSoft, borderRadius: t.radii.md, padding: t.spacing.md, gap: t.spacing.md },
          ]}
        >
          <Icon name="play-circle" size={28} tone="accent" />
          <View style={styles.flex}>
            <AppText variant="label" tone="accent">
              UP NEXT
            </AppText>
            <AppText variant="bodyMedium" numberOfLines={1}>
              {firstTrack?.title ?? '—'}
            </AppText>
          </View>
        </View>
      </View>
    </DemoScreen>
  );
}

function Row({
  track,
  initialIndex,
  positions,
  count,
  onDrop,
}: {
  track: Track;
  initialIndex: number;
  positions: SharedValue<Positions>;
  count: number;
  onDrop: () => void;
}) {
  const t = useTheme();
  const haptics = useHaptics();
  const onLift = haptics.medium;
  const onShift = haptics.selection;
  const onRelease = haptics.light;

  const top = useSharedValue(initialIndex * SLOT);
  const startTop = useSharedValue(0);
  const active = useSharedValue(0);
  const lift = useDerivedValue(() => spring(active.value, springs.snappy));

  // Follow the slot assigned to us, unless we're the one being dragged.
  useAnimatedReaction(
    () => positions.value[track.id] ?? 0,
    (index, previous) => {
      if (previous === null || index === previous || active.value === 1) return;
      top.value = spring(index * SLOT, springs.snappy);
    },
  );

  const pan = usePanGesture({
    activateAfterLongPress: 220,
    onActivate: () => {
      'worklet';
      active.value = 1;
      startTop.value = top.value;
      scheduleOnRN(onLift);
    },
    onUpdate: (e) => {
      'worklet';
      const maxTop = (count - 1) * SLOT;
      const next = startTop.value + e.translationY;
      // Small overdrag at both ends, with resistance.
      top.value = next < 0 ? next * 0.3 : next > maxTop ? maxTop + (next - maxTop) * 0.3 : next;

      const target = Math.max(0, Math.min(count - 1, Math.round(top.value / SLOT)));
      const current = positions.value[track.id] ?? 0;
      if (target === current) return;

      // Shift every row between the old and new slot by one toward the old slot.
      const direction = target > current ? 1 : -1;
      const updated: Positions = { ...positions.value };
      for (const id in updated) {
        if (id === track.id) continue;
        const index = updated[id] ?? 0;
        const inRange = direction === 1 ? index > current && index <= target : index < current && index >= target;
        if (inRange) updated[id] = index - direction;
      }
      updated[track.id] = target;
      positions.value = updated;
      scheduleOnRN(onShift);
    },
    onDeactivate: () => {
      'worklet';
      active.value = 0;
      top.value = spring((positions.value[track.id] ?? 0) * SLOT, springs.snappy);
      scheduleOnRN(onRelease);
      scheduleOnRN(onDrop);
    },
  });

  const style = useAnimatedStyle(() => ({
    top: top.value,
    zIndex: active.value === 1 ? 10 : 0,
    transform: [{ scale: 1 + lift.value * 0.04 }],
    shadowOpacity: 0.06 + lift.value * 0.22,
    shadowRadius: 10 + lift.value * 14,
  }));
  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + lift.value * 0.2 }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessible
        accessibilityLabel={`${track.title} by ${track.artist}. Long press and drag to reorder.`}
        style={[
          styles.row,
          {
            height: ITEM_H,
            backgroundColor: t.colors.surface,
            borderRadius: t.radii.md,
            paddingHorizontal: t.spacing.md,
            gap: t.spacing.md,
            borderColor: t.colors.border,
            borderWidth: t.isDark ? StyleSheet.hairlineWidth : 0,
            shadowColor: t.shadows.floating.shadowColor,
            shadowOffset: { width: 0, height: 8 },
          },
          style,
        ]}
      >
        <View style={[styles.art, { backgroundColor: t.colors.accentSoft, borderRadius: t.radii.sm }]}>
          <Icon name="musical-note" size={18} tone="accent" />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyMedium" numberOfLines={1}>
            {track.title}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {track.artist} · {track.duration}
          </AppText>
        </View>
        <Animated.View style={handleStyle}>
          <Icon name="reorder-three-outline" size={24} tone="tertiary" />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  art: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowPlaying: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
  },
});
