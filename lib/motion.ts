import {
  Easing,
  FadeInDown,
  FadeOut,
  LinearTransition,
  makeMutable,
  ReduceMotion,
  withDelay,
  withSpring,
  withTiming,
  type EasingFunction,
} from 'react-native-reanimated';

/**
 * Global animation helpers.
 *
 * `motionScale` is the slow-motion multiplier from Settings (0.5x / 1x / 2x).
 * It lives in a module-level shared value so worklets on the UI thread can read
 * it without any React plumbing. Every demo animates through `timing()` and
 * `spring()` below, so changing the setting affects the whole app at once.
 *
 * Reduce Motion: every helper passes `ReduceMotion.System`, so when the user
 * enables Reduce Motion in iOS settings these animations jump straight to their
 * final value. Looping or decorative effects should additionally check
 * `useReducedMotion()` and render their resting state.
 */
export const motionScale = makeMutable(1);
// Plain copy for code that runs during React render (layout-animation builders),
// where reading a shared value would trigger Reanimated's strict-mode warning.
let motionScaleJS = 1;

export function setMotionScale(multiplier: number) {
  motionScaleJS = multiplier;
  motionScale.set(multiplier);
}

/** Read the multiplier from the JS thread (for layout-animation builders). */
export function scaled(ms: number) {
  return ms * motionScaleJS;
}

export type SpringPreset = {
  /** Perceptual duration in ms, like UIKit's spring "response". */
  duration: number;
  /** 1 = critically damped (no overshoot), lower = bouncier. */
  dampingRatio: number;
  overshootClamping?: boolean;
};

/**
 * iOS-style spring presets expressed as duration + damping ratio, the same two
 * knobs UIKit exposes. Reanimated derives stiffness/mass from them, so the
 * slow-motion multiplier only has to scale the duration.
 */
export const springs = {
  /** Press-down phase of a control. Fast, almost no overshoot. */
  press: { duration: 200, dampingRatio: 0.9 },
  /** Default for most UI moves. Settles quickly with a hint of overshoot. */
  snappy: { duration: 350, dampingRatio: 0.85 },
  /** Calm, no overshoot. Large elements, layout shifts, sheets. */
  gentle: { duration: 500, dampingRatio: 1 },
  /** Lively release with a visible bounce. */
  bouncy: { duration: 450, dampingRatio: 0.6 },
  /** Low damping wobble for squash-and-stretch. */
  jelly: { duration: 600, dampingRatio: 0.4 },
  /** Must never cross its target (dismissals, clipping heights). */
  stiff: { duration: 300, dampingRatio: 1, overshootClamping: true },
} satisfies Record<string, SpringPreset>;

export const easings = {
  out: Easing.out(Easing.cubic),
  inOut: Easing.inOut(Easing.cubic),
  in: Easing.in(Easing.cubic),
  linear: Easing.linear,
  /** Overshooting ease for "pop" moments. */
  back: Easing.out(Easing.back(1.6)),
} as const;

/** `withTiming` that honors the slow-motion multiplier and Reduce Motion. */
export function timing(to: number, duration = 300, easing?: EasingFunction) {
  'worklet';
  // Defaults are resolved in the body on purpose: the worklets plugin does not
  // capture outer variables referenced only in default parameter values.
  return withTiming(to, {
    duration: duration * motionScale.value,
    easing: easing ?? easings.out,
    reduceMotion: ReduceMotion.System,
  });
}

/**
 * Timing for *functional* progress (a hold-to-confirm fill, playback position).
 * These must still take real time under Reduce Motion, otherwise a hold would
 * complete instantly, so they opt out with `ReduceMotion.Never`.
 */
export function progressTiming(to: number, duration: number, easing?: EasingFunction) {
  'worklet';
  return withTiming(to, {
    duration: duration * motionScale.value,
    easing: easing ?? easings.linear,
    reduceMotion: ReduceMotion.Never,
  });
}

/**
 * `withSpring` that honors the slow-motion multiplier and carries gesture
 * velocity. Pass the release velocity (in the same units as the value) so a
 * flick continues smoothly into the spring instead of restarting from rest.
 * The optional callback runs on the UI thread when the spring settles.
 */
export function spring(to: number, preset?: SpringPreset, velocity = 0, callback?: (finished?: boolean) => void) {
  'worklet';
  const k = motionScale.value;
  const p: SpringPreset = preset ?? springs.snappy;
  return withSpring(
    to,
    {
      duration: p.duration * k,
      dampingRatio: p.dampingRatio,
      velocity: velocity / k,
      overshootClamping: p.overshootClamping ?? false,
      reduceMotion: ReduceMotion.System,
    },
    callback,
  );
}

/** `withDelay` that honors the slow-motion multiplier. */
export function delayed<T>(ms: number, animation: T) {
  'worklet';
  return withDelay(ms * motionScale.value, animation as never) as T;
}

/** Entering animation for the i-th item of a staggered list. */
export function staggerIn(index: number, step = 45, cap = 10, duration = 380) {
  return FadeInDown.delay(Math.min(index, cap) * scaled(step))
    .duration(scaled(duration))
    .easing(easings.out);
}

/** Exiting animation for items leaving a list. */
export function fadeOut(duration = 160) {
  return FadeOut.duration(scaled(duration));
}

/** Layout transition for items moving when siblings appear or disappear. */
export function layoutSpring() {
  const k = motionScaleJS;
  // Physics form for the layout builder: critically damped, ~0.5s settle.
  return LinearTransition.springify()
    .damping(26 * k)
    .stiffness(170)
    .mass(1 * k * k);
}
