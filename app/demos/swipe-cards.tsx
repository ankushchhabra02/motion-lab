import { BlurMask, Canvas, Circle, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useLayoutEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { EmptyState } from '@/components/EmptyState';
import { GlassSurface } from '@/components/GlassSurface';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { spring, springs } from '@/lib/motion';

type Profile = { id: string; name: string; tagline: string; icon: IconName };

const PROFILES: Profile[] = [
  { id: 'aurora', name: 'Aurora', tagline: 'Northern lights, 02:14', icon: 'sparkles' },
  { id: 'nimbus', name: 'Nimbus', tagline: 'Cloud study, afternoon', icon: 'cloud' },
  { id: 'ember', name: 'Ember', tagline: 'Campfire, long exposure', icon: 'flame' },
  { id: 'tide', name: 'Tide', tagline: 'Low tide, golden hour', icon: 'water' },
  { id: 'orbit', name: 'Orbit', tagline: 'ISS pass, 19:40', icon: 'planet' },
];

type Direction = 'like' | 'nope';

export default function SwipeCardsScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const cardW = Math.min(width - t.spacing.xl * 2, 340);
  const cardH = cardW * 1.3;

  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Direction[]>([]);
  // How far the top card is toward leaving (0..1). Cards behind read it to grow into place.
  const topProgress = useSharedValue(0);
  // +1 / -1 asks the top card to fly out; it resets the value to 0 when consumed.
  const command = useSharedValue(0);

  // Reset synchronously after the stack re-renders so the new top card starts clean.
  useLayoutEffect(() => {
    topProgress.value = 0;
  }, [index, topProgress]);

  const visible = PROFILES.slice(index, index + 3);
  const palettes: [string, string][] = [
    [t.colors.accent, t.colors.heart],
    [t.colors.info, t.colors.accent],
    [t.colors.warning, t.colors.heart],
    [t.colors.success, t.colors.info],
    [t.colors.accentStrong, t.colors.info],
  ];

  const onSwiped = (direction: Direction) => {
    setHistory((h) => [...h, direction]);
    setIndex((i) => i + 1);
  };

  const likes = history.filter((h) => h === 'like').length;

  return (
    <DemoScreen id="swipe-cards">
      <View style={styles.flex}>
        <View style={styles.stackArea}>
          {visible.length === 0 ? (
            <EmptyState
              icon="albums-outline"
              title="You're all caught up"
              message={`${likes} liked · ${history.length - likes} passed`}
              actionLabel="Start over"
              onAction={() => {
                setIndex(0);
                setHistory([]);
              }}
            />
          ) : (
            <View style={{ width: cardW, height: cardH + 28 }}>
              {[...visible].reverse().map((profile, reversedIndex) => {
                const position = visible.length - 1 - reversedIndex;
                const paletteIndex = (index + position) % palettes.length;
                return (
                  <SwipeCard
                    key={profile.id}
                    profile={profile}
                    colors={palettes[paletteIndex] ?? palettes[0]!}
                    position={position}
                    isTop={position === 0}
                    topProgress={topProgress}
                    command={command}
                    width={cardW}
                    height={cardH}
                    onSwiped={onSwiped}
                  />
                );
              })}
            </View>
          )}
        </View>
        <View style={[styles.actions, { gap: t.spacing.xl, paddingBottom: t.spacing.xxl }]}>
          <ActionButton
            icon="close"
            color={t.colors.danger}
            label="Pass"
            disabled={visible.length === 0}
            onPress={() => {
              command.value = -1;
            }}
          />
          <ActionButton
            icon="heart"
            color={t.colors.success}
            label="Like"
            disabled={visible.length === 0}
            onPress={() => {
              command.value = 1;
            }}
          />
        </View>
      </View>
    </DemoScreen>
  );
}

function ActionButton({
  icon,
  color,
  label,
  disabled,
  onPress,
}: {
  icon: IconName;
  color: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <PressableScale onPress={onPress} disabled={disabled} scaleTo={0.88} haptic="medium" accessibilityLabel={label}>
      <GlassSurface radius={32} interactive style={styles.actionButton}>
        <Icon name={icon} size={28} color={disabled ? t.colors.textTertiary : color} />
      </GlassSurface>
    </PressableScale>
  );
}

type CardProps = {
  profile: Profile;
  colors: [string, string];
  position: number;
  isTop: boolean;
  topProgress: SharedValue<number>;
  command: SharedValue<number>;
  width: number;
  height: number;
  onSwiped: (direction: Direction) => void;
};

/**
 * Each card owns its own translation, so promoting the next card never
 * requires copying state. Rotation follows horizontal drag, and its sign flips
 * depending on whether you grabbed the top or bottom half, like a real card
 * pivoting around your finger. Past the threshold (or on a fast flick) the card
 * flies out along its current direction; otherwise it springs home with the
 * release velocity.
 */
function SwipeCard({ profile, colors, position, isTop, topProgress, command, width, height, onSwiped }: CardProps) {
  const t = useTheme();
  const haptics = useHaptics();
  const onCross = haptics.light;
  const onLeave = haptics.medium;
  const threshold = width * 0.38;

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const grabSign = useSharedValue(1);
  const passed = useSharedValue(0);
  const flying = useSharedValue(0);

  const finish = (direction: number) => onSwiped(direction > 0 ? 'like' : 'nope');

  // The card leaves on a spring seeded with the release velocity, so a hard
  // flick exits faster than a slow push and the motion never restarts.
  const flyOut = (direction: number, velocityX: number, velocityY: number) => {
    'worklet';
    flying.value = 1;
    tx.value = spring(direction * width * 1.6, springs.stiff, velocityX, (finished) => {
      if (finished) scheduleOnRN(finish, direction);
    });
    ty.value = spring(ty.value + velocityY * 0.15, springs.gentle, velocityY);
    scheduleOnRN(onLeave);
  };

  const pan = usePanGesture({
    enabled: isTop,
    onBegin: (e) => {
      'worklet';
      grabSign.value = e.y < height / 2 ? 1 : -1;
    },
    onUpdate: (e) => {
      'worklet';
      if (flying.value === 1) return;
      tx.value = e.translationX;
      ty.value = e.translationY;
      const past = Math.abs(e.translationX) > threshold ? 1 : 0;
      if (past !== passed.value) {
        passed.value = past;
        if (past === 1) scheduleOnRN(onCross);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      if (flying.value === 1) return;
      const flick = Math.abs(e.velocityX) > 900;
      if (!e.canceled && (Math.abs(e.translationX) > threshold || flick)) {
        const direction = Math.abs(e.translationX) > threshold ? Math.sign(e.translationX) : Math.sign(e.velocityX);
        flyOut(direction || 1, e.velocityX, e.velocityY);
      } else {
        passed.value = 0;
        tx.value = spring(0, springs.gentle, e.velocityX);
        ty.value = spring(0, springs.gentle, e.velocityY);
      }
    },
  });

  // Report progress to the stack while this card is on top.
  useAnimatedReaction(
    () => tx.value,
    (x) => {
      if (isTop) topProgress.value = Math.min(1, Math.abs(x) / threshold);
    },
  );

  // Button-triggered swipes.
  useAnimatedReaction(
    () => command.value,
    (c) => {
      if (!isTop || c === 0 || flying.value === 1) return;
      command.value = 0;
      flyOut(c, c * 1400, 0);
    },
  );

  const cardStyle = useAnimatedStyle(() => {
    const rel = Math.max(0, position - topProgress.value);
    const rotate = isTop ? interpolate(tx.value, [-width, width], [-14, 14]) * grabSign.value : 0;
    return {
      transform: [
        { translateX: isTop ? tx.value : 0 },
        { translateY: isTop ? ty.value : rel * 14 },
        { rotate: `${rotate}deg` },
        { scale: isTop ? 1 : interpolate(rel, [0, 1, 2], [1, 0.95, 0.9], Extrapolation.CLAMP) },
      ],
    };
  });
  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [12, threshold], [0, 1], Extrapolation.CLAMP),
  }));
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-threshold, -12], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessible
        accessibilityLabel={`${profile.name}. ${profile.tagline}`}
        style={[
          styles.card,
          { width, height, borderRadius: t.radii.xl, backgroundColor: t.colors.surface },
          t.isDark ? null : t.shadows.floating,
          cardStyle,
        ]}
      >
        <View style={[styles.cardClip, { borderRadius: t.radii.xl }]}>
          <Canvas style={{ width, height }}>
            <Rect x={0} y={0} width={width} height={height}>
              <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={colors} />
            </Rect>
            <Circle cx={width * 0.78} cy={height * 0.28} r={width * 0.26} color={t.colors.glare}>
              <BlurMask blur={40} style="normal" />
            </Circle>
            <Circle cx={width * 0.2} cy={height * 0.72} r={width * 0.3} color={colors[1]}>
              <BlurMask blur={50} style="normal" />
            </Circle>
            <Rect x={0} y={height * 0.55} width={width} height={height * 0.45}>
              <LinearGradient start={vec(0, height * 0.55)} end={vec(0, height)} colors={[t.colors.glareClear, t.colors.overlay]} />
            </Rect>
          </Canvas>
          <View style={[styles.cardText, { padding: t.spacing.xl }]}>
            <View style={[styles.iconChip, { backgroundColor: t.colors.glare, borderRadius: t.radii.pill }]}>
              <Icon name={profile.icon} size={16} color={t.colors.onAccent} />
            </View>
            <AppText variant="title" tone="onAccent" style={{ marginTop: t.spacing.sm }}>
              {profile.name}
            </AppText>
            <AppText variant="caption" tone="onAccent" style={{ opacity: 0.85 }}>
              {profile.tagline}
            </AppText>
          </View>
          <Animated.View style={[styles.stamp, styles.stampLeft, { borderColor: t.colors.success }, likeStyle]}>
            <AppText variant="heading" style={{ color: t.colors.success }}>
              LIKE
            </AppText>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.stampRight, { borderColor: t.colors.danger }, nopeStyle]}>
            <AppText variant="heading" style={{ color: t.colors.danger }}>
              NOPE
            </AppText>
          </Animated.View>
        </View>
        <RoundedRectBorder radius={t.radii.xl} color={t.colors.glare} />
      </Animated.View>
    </GestureDetector>
  );
}

/** Thin inner highlight along the card edge, drawn with a View so it clips with the card. */
function RoundedRectBorder({ radius, color }: { radius: number; color: string }) {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: StyleSheet.hairlineWidth, borderColor: color }]}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stackArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  cardClip: {
    flex: 1,
    overflow: 'hidden',
  },
  cardText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  iconChip: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stamp: {
    position: 'absolute',
    top: 28,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stampLeft: {
    left: 24,
    transform: [{ rotate: '-14deg' }],
  },
  stampRight: {
    right: 24,
    transform: [{ rotate: '14deg' }],
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
