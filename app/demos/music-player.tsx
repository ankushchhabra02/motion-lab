import { BlurMask, Canvas, Circle, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { GlassSurface } from '@/components/GlassSurface';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { ReText } from '@/components/ReText';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { spring, springs, timing } from '@/lib/motion';

const MINI_H = 72;
const MINI_ART = 48;
const TRACK_SEC = 214;
const TRACK_MS = TRACK_SEC * 1000;

const TRACKS: { title: string; artist: string; icon: IconName }[] = [
  { title: 'Spring Constant', artist: 'The Worklets', icon: 'musical-notes' },
  { title: 'Sixty Frames', artist: 'Reanimated Youth', icon: 'pulse' },
  { title: 'Ease Out Cubic', artist: 'Bezier & Sons', icon: 'analytics' },
  { title: 'Haptic Heart', artist: 'Taptic Engine', icon: 'heart' },
  { title: 'Overshoot', artist: 'Damping Ratio', icon: 'trending-up' },
  { title: 'Shared Value', artist: 'UI Thread', icon: 'git-branch' },
];

function formatTime(seconds: number) {
  'worklet';
  const whole = Math.max(0, Math.floor(seconds));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Player with two states driven by one `expand` value (0 = mini bar, 1 = full).
 * The pan converts vertical drag into expand units and snaps by velocity.
 * The artwork is rendered once at full size and moved with translate+scale,
 * so the Skia canvas never resizes during the transition. Mini and full text
 * blocks cross-fade instead of morphing, which keeps the layout math small.
 */
export default function MusicPlayerScreen() {
  const t = useTheme();
  const haptics = useHaptics();
  const onSnap = haptics.light;
  const reduceMotion = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The player floats with a margin, like the system mini player.
  const sideMargin = t.spacing.md;
  const bottomOffset = insets.bottom + t.spacing.md;
  const width = windowWidth - sideMargin * 2;

  const areaHeight = useSharedValue(640);
  const expand = useSharedValue(0);
  const startExpand = useSharedValue(0);

  const [playing, setPlaying] = useState(false);
  const playingSV = useSharedValue(0);
  const position = useSharedValue(0.32); // 0..1 through the track
  const scrubbing = useSharedValue(0);
  const spin = useSharedValue(0);

  const fullArt = Math.min(width - t.spacing.xxl * 2, 300);
  const fullArtTop = 48;

  // --- Playback --------------------------------------------------------------

  const play = (from: number) => {
    'worklet';
    position.value = from;
    // Playback position is content time, not decoration: it ignores Reduce Motion
    // and the slow-motion setting so the track always plays at real speed.
    const real = { easing: Easing.linear, reduceMotion: ReduceMotion.Never };
    position.value = withSequence(
      ReduceMotion.Never,
      withTiming(1, { duration: (1 - from) * TRACK_MS, ...real }),
      withRepeat(
        withSequence(ReduceMotion.Never, withTiming(0, { duration: 0, ...real }), withTiming(1, { duration: TRACK_MS, ...real })),
        -1,
        false,
        undefined,
        ReduceMotion.Never,
      ),
    );
  };

  useEffect(() => {
    playingSV.value = playing ? 1 : 0;
    if (playing) {
      play(position.get());
      if (!reduceMotion) {
        spin.value = withRepeat(withTiming(spin.get() + 360, { duration: 7000, easing: Easing.linear }), -1, false);
      }
    } else {
      cancelAnimation(position);
      cancelAnimation(spin);
    }
    // `play` and the shared values are stable for the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, reduceMotion]);

  const togglePlay = () => setPlaying((p) => !p);
  const skip = (direction: 1 | -1) => {
    haptics.medium();
    cancelAnimation(position);
    if (playing) play(0);
    else position.value = timing(0, 250);
    if (direction === 1) spin.value = spring(spin.get() + 40, springs.gentle);
    else spin.value = spring(spin.get() - 40, springs.gentle);
  };

  // --- Expand / collapse ------------------------------------------------------

  const snapExpand = (target: number, velocity: number) => {
    'worklet';
    expand.value = spring(target, springs.gentle, velocity);
    scheduleOnRN(onSnap);
  };

  const pan = usePanGesture({
    activeOffsetY: [-8, 8],
    onBegin: () => {
      'worklet';
      startExpand.value = expand.value;
    },
    onUpdate: (e) => {
      'worklet';
      const range = areaHeight.value - MINI_H - bottomOffset - t.spacing.md;
      expand.value = Math.max(0, Math.min(1, startExpand.value - e.translationY / range));
    },
    onDeactivate: (e) => {
      'worklet';
      const range = areaHeight.value - MINI_H - bottomOffset - t.spacing.md;
      const velocity = -e.velocityY / range;
      const target = e.velocityY < -400 ? 1 : e.velocityY > 400 ? 0 : expand.value > 0.5 ? 1 : 0;
      snapExpand(target, velocity);
    },
  });

  const tapMini = useTapGesture({
    onActivate: () => {
      'worklet';
      if (expand.value < 0.5) snapExpand(1, 0);
    },
  });

  // --- Seek bar ------------------------------------------------------------------

  const barWidth = useSharedValue(1);
  const seek = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      scrubbing.value = spring(1, springs.press);
      cancelAnimation(position);
      position.value = Math.max(0, Math.min(1, e.x / barWidth.value));
    },
    onUpdate: (e) => {
      'worklet';
      position.value = Math.max(0, Math.min(1, e.x / barWidth.value));
    },
    onFinalize: () => {
      'worklet';
      scrubbing.value = spring(0, springs.bouncy);
      if (playingSV.value === 1) play(position.value);
    },
  });

  const elapsed = useDerivedValue(() => formatTime(position.value * TRACK_SEC));
  const remaining = useDerivedValue(() => `-${formatTime((1 - position.value) * TRACK_SEC)}`);

  // --- Styles ----------------------------------------------------------------------

  const containerStyle = useAnimatedStyle(() => ({
    height: MINI_H + expand.value * (areaHeight.value - MINI_H - bottomOffset - t.spacing.md),
  }));

  const artStyle = useAnimatedStyle(() => {
    const p = expand.value;
    const miniScale = MINI_ART / fullArt;
    const fullCx = width / 2;
    const fullCy = fullArtTop + fullArt / 2;
    const miniCx = t.spacing.lg + MINI_ART / 2;
    const miniCy = MINI_H / 2;
    return {
      transform: [
        { translateX: (miniCx - fullCx) * (1 - p) },
        { translateY: (miniCy - fullCy) * (1 - p) },
        { scale: miniScale + (1 - miniScale) * p },
        { rotate: `${spin.value}deg` },
      ],
    };
  });

  const miniStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expand.value, [0, 0.35], [1, 0], Extrapolation.CLAMP),
  }));
  const fullStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expand.value, [0.45, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: (1 - expand.value) * 40 }],
  }));
  const miniProgressStyle = useAnimatedStyle(() => ({
    width: `${position.value * 100}%`,
    opacity: interpolate(expand.value, [0, 0.2], [1, 0], Extrapolation.CLAMP),
  }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${position.value * 100}%` }));
  const knobStyle = useAnimatedStyle(() => ({
    left: `${position.value * 100}%`,
    transform: [{ translateX: -10 }, { scale: 1 + scrubbing.value * 0.6 }],
  }));
  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: 1 + scrubbing.value * 0.8 }],
  }));

  const track = TRACKS[0]!;

  return (
    <DemoScreen id="music-player">
      <View
        style={styles.flex}
        onLayout={(e) => {
          areaHeight.value = e.nativeEvent.layout.height;
        }}
      >
        {/* Library behind the player */}
        <View style={{ padding: t.spacing.lg, gap: t.spacing.sm }}>
          <AppText variant="heading" style={{ marginBottom: t.spacing.sm }}>
            Up next
          </AppText>
          {TRACKS.slice(1).map((item) => (
            <View
              key={item.title}
              style={[
                styles.libraryRow,
                { backgroundColor: t.colors.surface, borderRadius: t.radii.md, padding: t.spacing.md, gap: t.spacing.md },
                t.isDark ? { borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border } : t.shadows.card,
              ]}
            >
              <View style={[styles.libraryArt, { backgroundColor: t.colors.accentSoft, borderRadius: t.radii.sm }]}>
                <Icon name={item.icon} size={18} tone="accent" />
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyMedium">{item.title}</AppText>
                <AppText variant="caption" tone="secondary">
                  {item.artist}
                </AppText>
              </View>
              <Icon name="ellipsis-horizontal" size={18} tone="tertiary" />
            </View>
          ))}
        </View>

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.player,
              { left: sideMargin, right: sideMargin, bottom: bottomOffset, borderRadius: t.radii.xl },
              containerStyle,
            ]}
          >
            <GlassSurface radius={t.radii.xl} tint="surface" style={StyleSheet.absoluteFill} />
            <Animated.View style={[styles.miniProgress, { backgroundColor: t.colors.accent }, miniProgressStyle]} />

            {/* Full-screen content */}
            <Animated.View style={[StyleSheet.absoluteFill, fullStyle]} pointerEvents="box-none">
              <View style={[styles.fullContent, { top: fullArtTop + fullArt + t.spacing.xl, paddingHorizontal: t.spacing.xl }]}>
                <AppText variant="title">{track.title}</AppText>
                <AppText tone="secondary">{track.artist}</AppText>

                <GestureDetector gesture={seek}>
                  <View
                    style={[styles.seekArea, { marginTop: t.spacing.xl }]}
                    onLayout={(e) => {
                      barWidth.value = e.nativeEvent.layout.width;
                    }}
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel="Seek"
                  >
                    <Animated.View style={[styles.seekTrack, { backgroundColor: t.colors.border }, trackStyle]}>
                      <Animated.View style={[styles.seekFill, { backgroundColor: t.colors.accent }, fillStyle]} />
                    </Animated.View>
                    <Animated.View style={[styles.knob, { backgroundColor: t.colors.accent }, t.shadows.card, knobStyle]} />
                  </View>
                </GestureDetector>
                <View style={styles.times}>
                  <ReText text={elapsed} style={[t.typography.caption, { color: t.colors.textSecondary }]} />
                  <ReText text={remaining} style={[t.typography.caption, { color: t.colors.textSecondary, textAlign: 'right' }]} />
                </View>

                <View style={[styles.controls, { marginTop: t.spacing.xl, gap: t.spacing.xxl }]}>
                  <PressableScale onPress={() => skip(-1)} scaleTo={0.85} haptic="none" accessibilityLabel="Previous">
                    <Icon name="play-skip-back" size={30} />
                  </PressableScale>
                  <PressableScale
                    onPress={togglePlay}
                    scaleTo={0.9}
                    haptic="medium"
                    accessibilityLabel={playing ? 'Pause' : 'Play'}
                    style={[styles.playButton, { backgroundColor: t.colors.accent }]}
                  >
                    <Icon name={playing ? 'pause' : 'play'} size={32} tone="onAccent" />
                  </PressableScale>
                  <PressableScale onPress={() => skip(1)} scaleTo={0.85} haptic="none" accessibilityLabel="Next">
                    <Icon name="play-skip-forward" size={30} />
                  </PressableScale>
                </View>

                <PressableScale
                  onPress={() => {
                    expand.value = spring(0, springs.gentle);
                    onSnap();
                  }}
                  scaleTo={0.9}
                  accessibilityLabel="Collapse player"
                  style={[styles.collapse, { marginTop: t.spacing.xl }]}
                >
                  <Icon name="chevron-down" size={22} tone="tertiary" />
                </PressableScale>
              </View>
            </Animated.View>

            {/* Mini bar content */}
            <GestureDetector gesture={tapMini}>
              <Animated.View style={[styles.miniRow, { paddingLeft: t.spacing.lg + MINI_ART + t.spacing.md }, miniStyle]}>
                <View style={styles.flex}>
                  <AppText variant="bodySemibold" numberOfLines={1}>
                    {track.title}
                  </AppText>
                  <AppText variant="caption" tone="secondary" numberOfLines={1}>
                    {track.artist}
                  </AppText>
                </View>
                <Equalizer playing={playing && !reduceMotion} />
                <PressableScale
                  onPress={togglePlay}
                  scaleTo={0.85}
                  haptic="medium"
                  hitSlop={8}
                  accessibilityLabel={playing ? 'Pause' : 'Play'}
                  style={styles.miniPlay}
                >
                  <Icon name={playing ? 'pause' : 'play'} size={24} />
                </PressableScale>
              </Animated.View>
            </GestureDetector>

            {/* Vinyl artwork: rendered once at full size, moved with transforms */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.art,
                { width: fullArt, height: fullArt, borderRadius: fullArt / 2, left: (width - fullArt) / 2, top: fullArtTop },
                artStyle,
              ]}
            >
              <Canvas style={{ width: fullArt, height: fullArt }}>
                <Circle cx={fullArt / 2} cy={fullArt / 2} r={fullArt / 2}>
                  <LinearGradient start={vec(0, 0)} end={vec(fullArt, fullArt)} colors={[t.colors.accentStrong, t.colors.accent, t.colors.heart]} />
                </Circle>
                <Circle cx={fullArt * 0.3} cy={fullArt * 0.3} r={fullArt * 0.22} color={t.colors.glare}>
                  <BlurMask blur={fullArt * 0.12} style="normal" />
                </Circle>
                {[0.82, 0.7, 0.58].map((ring) => (
                  <Circle key={ring} cx={fullArt / 2} cy={fullArt / 2} r={(fullArt / 2) * ring} color={t.colors.glare} style="stroke" strokeWidth={1} />
                ))}
                <Circle cx={fullArt / 2} cy={fullArt / 2} r={fullArt * 0.16} color={t.colors.surface} />
                <Circle cx={fullArt / 2} cy={fullArt / 2} r={fullArt * 0.035} color={t.colors.text} />
                <Rect x={0} y={0} width={fullArt} height={fullArt}>
                  <LinearGradient start={vec(0, fullArt)} end={vec(fullArt, 0)} colors={[t.colors.glareClear, t.colors.glare]} positions={[0.5, 1]} />
                </Rect>
              </Canvas>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
    </DemoScreen>
  );
}

/** Three bars that dance while playing and rest flat when paused. */
function Equalizer({ playing }: { playing: boolean }) {
  const t = useTheme();
  const bars = [useSharedValue(0.3), useSharedValue(0.6), useSharedValue(0.45)];

  useEffect(() => {
    bars.forEach((bar, i) => {
      if (playing) {
        bar.value = withRepeat(
          withSequence(
            withTiming(0.9 - i * 0.1, { duration: 260 + i * 70, easing: Easing.inOut(Easing.quad) }),
            withTiming(0.25 + i * 0.1, { duration: 300 + i * 50, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
          true,
        );
      } else {
        cancelAnimation(bar);
        bar.value = timing(0.2, 250);
      }
    });
    // Bars are stable shared values created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  return (
    <View style={styles.eq}>
      {bars.map((bar, i) => (
        <EqBar key={i} value={bar} color={t.colors.accent} />
      ))}
    </View>
  );
}

function EqBar({ value, color }: { value: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => ({ height: 4 + value.value * 18 }));
  return <Animated.View style={[styles.eqBar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  libraryArt: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  player: {
    position: 'absolute',
    overflow: 'hidden',
  },
  miniProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 2,
  },
  miniRow: {
    height: MINI_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    gap: 12,
  },
  miniPlay: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eq: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 22,
  },
  eqBar: {
    width: 4,
    borderRadius: 2,
  },
  art: {
    position: 'absolute',
    overflow: 'hidden',
  },
  fullContent: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  seekArea: {
    height: 36,
    justifyContent: 'center',
  },
  seekTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  seekFill: {
    height: '100%',
    borderRadius: 2,
  },
  knob: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapse: {
    alignSelf: 'center',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
