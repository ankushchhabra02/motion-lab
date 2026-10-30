import { Atlas, Canvas, Skia, useRSXformBuffer, useRectBuffer, type SkImage } from '@shopify/react-native-skia';
import { isRunningInExpoGo } from 'expo';
import { useEffect, useMemo } from 'react';
import { Image, StyleSheet, View, useColorScheme, useWindowDimensions } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import logo from '@/assets/icon.png';
import { darkColors, expoGoSplash, lightColors, nativeSplash } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { motionScale } from '@/lib/motion';

export const LOGO_SOURCE = logo;

type Props = {
  /** The first frame is painted (logo decoded). Safe to hide the native splash. */
  onReady: () => void;
  /** Flip to true once the native splash has been hidden to start the timeline. */
  start: boolean;
  /** The burst began; the app behind can start its entrance animations. */
  onReveal: () => void;
  /** Everything is finished; unmount me. */
  onDone: () => void;
};

// Timeline (ms, before the slow-motion multiplier).
// Expo Go cross-fades its own splash out over 500ms, so we hold the identical
// frame for that long before moving anything. Native builds cut straight over.
const HOLD_EXPO_GO = 520;
const HOLD_BUILD = 120;
const PULSE = 380;
const BURST = 900;
const BACKGROUND_FADE = 420;

const PARTICLES = 170;
const SPRITE_PX = 48;
const SPRITE_BASE_SIZE = 13;

/**
 * In-app splash that starts from the exact frame the native splash left
 * behind, pulses the logo, then bursts it into Skia particles while the
 * background fades to reveal the home screen. Tap anywhere to skip.
 *
 * One shared value `t` (milliseconds) drives everything. Every visual is a
 * pure function of `t`, so skipping is just a matter of jumping `t` forward.
 */
export function AnimatedSplash({ onReady, start, onReveal, onDone }: Props) {
  const theme = useTheme();
  const systemScheme = useColorScheme();
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const expoGo = useMemo(() => isRunningInExpoGo(), []);

  // Geometry of the native frame we must match on the first frame.
  const frame = useMemo(() => {
    if (expoGo) {
      const stackHeight = expoGoSplash.iconSize + expoGoSplash.iconToLabelGap + expoGoSplash.labelLineHeight;
      const top = (height - stackHeight) / 2;
      return {
        background: expoGoSplash.background,
        logoSize: expoGoSplash.iconSize,
        radius: expoGoSplash.iconRadius,
        logoTop: top,
        labelTop: top + expoGoSplash.iconSize + expoGoSplash.iconToLabelGap,
        // UIKit's default label color is dynamic: black in light, white in dark (invisible on white).
        showName: systemScheme !== 'dark',
      };
    }
    const size = nativeSplash.imageWidth;
    return {
      background: systemScheme === 'dark' ? darkColors.background : lightColors.background,
      logoSize: size,
      radius: size * nativeSplash.cornerRatio,
      logoTop: (height - size) / 2,
      labelTop: 0,
      showName: false,
    };
  }, [expoGo, height, systemScheme]);

  const hold = expoGo ? HOLD_EXPO_GO : HOLD_BUILD;
  const burstAt = hold + PULSE;
  const total = burstAt + BURST;
  const cx = width / 2;
  const cy = frame.logoTop + frame.logoSize / 2;

  const t = useSharedValue(0);
  const revealed = useSharedValue(0);

  useEffect(() => {
    if (!start) return;
    if (reduceMotion) {
      // No pulse, no particles: a plain cross-fade into the app.
      t.value = burstAt;
      t.value = withTiming(total, { duration: 350, easing: Easing.linear });
      return;
    }
    t.value = withTiming(total, { duration: total * motionScale.get(), easing: Easing.linear });
  }, [start, reduceMotion, burstAt, total, t]);

  useAnimatedReaction(
    () => t.value,
    (now, previous) => {
      if (now >= burstAt && revealed.value === 0) {
        revealed.value = 1;
        scheduleOnRN(onReveal);
      }
      if (now >= total && previous !== null && previous < total) {
        scheduleOnRN(onDone);
      }
    },
  );

  const tap = useTapGesture({
    onActivate: () => {
      'worklet';
      const now = t.value;
      cancelAnimation(t);
      if (now < burstAt) {
        // Jump straight to the burst and play it quickly.
        t.value = burstAt;
        t.value = withTiming(total, { duration: BURST * 0.6, easing: Easing.linear });
      } else {
        t.value = withTiming(total, { duration: 160, easing: Easing.linear });
      }
    },
  });

  // --- Logo, label, ring, background -------------------------------------

  const logoStyle = useAnimatedStyle(() => {
    const now = t.value;
    if (now < burstAt) {
      const p = Math.max(0, (now - hold) / PULSE);
      // Swell, then a quick anticipation squash right before the burst.
      const scale =
        p < 0.6
          ? 1 + 0.07 * Math.sin((p / 0.6) * Math.PI)
          : 1 - 0.1 * Math.pow((p - 0.6) / 0.4, 2);
      return { opacity: 1, transform: [{ scale }] };
    }
    const u = Math.min(1, (now - burstAt) / BURST);
    return {
      opacity: interpolate(u, [0, 0.16], [1, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(u, [0, 0.25], [0.9, 1.7], Extrapolation.CLAMP) }],
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const p = interpolate(t.value, [hold, hold + PULSE * 0.6], [0, 1], Extrapolation.CLAMP);
    return { opacity: 1 - p, transform: [{ translateY: p * 10 }] };
  });

  const ringStyle = useAnimatedStyle(() => {
    const r = interpolate(t.value, [burstAt - 100, burstAt + 450], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: r === 0 || r === 1 ? 0 : (1 - r) * 0.55,
      transform: [{ scale: 1 + r * 2.4 }],
    };
  });

  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [burstAt + 60, burstAt + 60 + BACKGROUND_FADE], [1, 0], Extrapolation.CLAMP),
  }));

  // --- Particles -----------------------------------------------------------

  const sheet = useMemo(
    () =>
      makeSpriteSheet([
        theme.colors.accent,
        theme.colors.heart,
        theme.colors.accentStrong,
        theme.colors.warning,
        theme.colors.accent,
        theme.colors.info,
      ]),
    [theme],
  );

  const particles = useMemo(() => makeParticles(PARTICLES, width), [width]);
  const baseScale = (SPRITE_BASE_SIZE / SPRITE_PX) * (frame.logoSize / expoGoSplash.iconSize);
  const skipParticles = reduceMotion;

  const sprites = useRectBuffer(PARTICLES, (rect, i) => {
    'worklet';
    rect.setXYWH((i % 6) * SPRITE_PX, 0, SPRITE_PX, SPRITE_PX);
  });

  const transforms = useRSXformBuffer(PARTICLES, (xform, i) => {
    'worklet';
    const u = (t.value - burstAt) / BURST;
    if (skipParticles || u <= 0 || u >= 1) {
      xform.set(0, 0, -1000, -1000);
      return;
    }
    const angle = particles.angle[i] ?? 0;
    const speed = particles.speed[i] ?? 0;
    const size = particles.size[i] ?? 1;
    const spin = particles.spin[i] ?? 0;
    const gravity = particles.gravity[i] ?? 0;

    // Ease-out radial travel plus a gravity term that grows with time squared,
    // so pieces shoot out fast, then slow and sag like real confetti.
    const travel = 1 - Math.pow(1 - u, 3);
    const x = cx + Math.cos(angle) * speed * travel;
    const y = cy + Math.sin(angle) * speed * travel + gravity * u * u;

    const popIn = Math.min(1, u * 8);
    const fade = u < 0.65 ? 1 : 1 - (u - 0.65) / 0.35;
    const scale = baseScale * size * popIn * fade;
    const rotation = spin * u;
    const scos = scale * Math.cos(rotation);
    const ssin = scale * Math.sin(rotation);
    const half = SPRITE_PX / 2;
    // RSXform rotates about the sprite's origin; offset so it rotates about its center.
    xform.set(scos, ssin, x - (scos * half - ssin * half), y - (ssin * half + scos * half));
  });

  return (
    <GestureDetector gesture={tap}>
      <View style={StyleSheet.absoluteFill} accessibilityLabel="Loading Motion Lab. Tap to skip." accessible>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: frame.background }, backgroundStyle]} />
        {sheet ? (
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <Atlas image={sheet} sprites={sprites} transforms={transforms} />
          </Canvas>
        ) : null}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: frame.logoSize,
              height: frame.logoSize,
              borderRadius: frame.logoSize / 2,
              left: cx - frame.logoSize / 2,
              top: cy - frame.logoSize / 2,
              borderColor: theme.colors.accent,
            },
            ringStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.logo,
            {
              width: frame.logoSize,
              height: frame.logoSize,
              borderRadius: frame.radius,
              left: cx - frame.logoSize / 2,
              top: frame.logoTop,
            },
            logoStyle,
          ]}
        >
          <Image source={logo} onLoad={onReady} onError={onReady} style={styles.logoImage} resizeMode="cover" />
        </Animated.View>
        {frame.showName ? (
          <Animated.Text
            style={[
              styles.label,
              {
                top: frame.labelTop,
                color: expoGoSplash.label,
                fontSize: expoGoSplash.labelFontSize,
                lineHeight: expoGoSplash.labelLineHeight,
              },
              labelStyle,
            ]}
          >
            Motion Lab
          </Animated.Text>
        ) : null}
      </View>
    </GestureDetector>
  );
}

/** Six colored sprites (circles and rounded squares) on one raster image. */
function makeSpriteSheet(colors: string[]): SkImage | null {
  const surface = Skia.Surface.Make(SPRITE_PX * colors.length, SPRITE_PX);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  colors.forEach((color, i) => {
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(color));
    const x = i * SPRITE_PX;
    if (i % 3 === 2) {
      const inset = 9;
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x + inset, inset, SPRITE_PX - inset * 2, SPRITE_PX - inset * 2), 7, 7), paint);
    } else {
      canvas.drawCircle(x + SPRITE_PX / 2, SPRITE_PX / 2, SPRITE_PX / 2 - 4, paint);
    }
  });
  surface.flush();
  return surface.makeImageSnapshot();
}

/** Deterministic pseudo-random particle parameters (same burst every launch). */
function makeParticles(count: number, width: number) {
  let seed = 1337;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const angle: number[] = [];
  const speed: number[] = [];
  const size: number[] = [];
  const spin: number[] = [];
  const gravity: number[] = [];
  for (let i = 0; i < count; i++) {
    angle.push(rand() * Math.PI * 2);
    speed.push(width * (0.18 + Math.pow(rand(), 0.7) * 0.6));
    size.push(0.5 + rand() * 0.9);
    spin.push((rand() - 0.5) * 16);
    gravity.push(90 + rand() * 220);
  }
  return { angle, speed, size, spin, gravity };
}

const styles = StyleSheet.create({
  logo: {
    position: 'absolute',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  label: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontWeight: '600',
  },
});
