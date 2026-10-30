# Motion Lab

A gallery of animated UI experiments and realistic mini app screens, built with Expo. Every animation runs on the UI thread, every gesture carries its release velocity into a spring, and every surface that can be native iOS is native iOS.

![Gallery](docs/screenshots/gallery.png)
![Animated splash](docs/screenshots/splash.gif)

## Highlights

- **22 demos in 6 categories**: Basics, Gestures, Scroll, Mini Apps, Skia Effects, Liquid Glass.
- **Native iOS shell**: system tab bar (Liquid Glass on iOS 26), large-title headers with a native search bar, header toolbars, form sheets with detents, swipe-back everywhere.
- **Liquid Glass with graceful fallbacks**: `GlassView` on iOS 26, system-material blur on older iOS, solid surfaces when Reduce Transparency is on.
- **Seamless splash**: the native splash hands off to a Skia particle burst that starts from the identical frame.
- **Study mode**: a 0.5× / 1× / 2× slow-motion multiplier applied to every animation, plus Reduce Motion support throughout.
- **Haptics everywhere**, following iOS conventions (selection for pickers, light impact for taps, success for outcomes), all behind one switch.

| | | |
|---|---|---|
| ![Swipe cards](docs/screenshots/swipe-cards.gif) | ![Music player](docs/screenshots/music-player.gif) | ![Weather](docs/screenshots/weather.gif) |
| ![Glass Lab](docs/screenshots/glass-lab.gif) | ![Charts](docs/screenshots/charts.gif) | ![Demo wrapper](docs/screenshots/demo-wrapper.png) |

## Run it

Requirements: Node 22+, Expo Go 58 on an iPhone (iOS 26 for Liquid Glass), and an Expo account signed in both in the terminal and in Expo Go.

```bash
npm install
npx expo login
npx expo start        # or: npm run tunnel if phone and computer are on different networks
```

Scan the QR code with the Camera app. Everything runs in Expo Go; no development build is required.

Useful scripts:

```bash
npm run typecheck     # strict TypeScript
npx expo lint         # ESLint (expo config)
npx expo-doctor       # dependency and config health
python3 scripts/generate-assets.py   # regenerate icons and splash from one design
```

## Demos

| Category | Demo | What to look for |
|---|---|---|
| Basics | Springy Buttons | Squish, 3D push, jelly, icon bounce, hold-to-confirm |
| Basics | Toggle & Checkbox | Stretchy knob, Skia checkmark that draws itself |
| Basics | Staggered List | Rise / Slide / Pop entrances with per-row springs |
| Basics | Skeleton Loader | Synchronized Skia shimmer, staggered cross-fade to content |
| Gestures | Swipe Card Stack | Grab-point rotation, velocity fly-out, stack promotion |
| Gestures | Bottom Sheet | Three snap points, velocity projection, dimming backdrop |
| Gestures | Drag to Reorder | Long-press lift, slot shifting without re-rendering |
| Gestures | 3D Tilt Card | Perspective tilt, Skia glare that lags the finger |
| Scroll | Collapsing Header | One scroll offset drives every clamped interpolation |
| Scroll | Parallax Carousel | Artwork moves slower than the card, ambient glow |
| Scroll | Animated Tab Bar | Sliding pill, dip-overshoot icon bounce |
| Mini Apps | Music Player | Floating glass mini player, draggable seek, spinning vinyl |
| Mini Apps | Wallet | Fan out, flip, swipe to remove |
| Mini Apps | Weather | Skia sun, clouds and rain that morph between conditions |
| Mini Apps | Onboarding | Four-layer parallax, ring progress, widening CTA |
| Mini Apps | Food Ordering | Bezier fly-to-cart with UI-thread measurement |
| Mini Apps | Chat | Anchored bubble pops, typing dots, swipe-to-reply |
| Skia Effects | Gradient Blobs | Morphing spline blobs behind BackdropBlur glass |
| Skia Effects | Confetti Burst | 180-sprite atlas bursts with closed-form physics |
| Skia Effects | Liquid Button | Metaball bridge that snaps off and merges back |
| Skia Effects | Animated Charts | Draw-on spline with scrubber, staggered rings |
| Liquid Glass | Glass Lab | Glass cards, merging glass buttons, draggable glass panel |

## Architecture

```
app/                  Expo Router routes
  _layout.tsx         root native Stack, providers, splash handoff, error boundary
  (tabs)/             NativeTabs: gallery, favorites, settings (each with its own Stack)
  demos/*.tsx         one self-contained file per demo
  demo-info.tsx       native form sheet with a demo's description
components/           DemoScreen (native header + toolbar), GlassSurface, PressableScale, ReText, ...
constants/theme.ts    light/dark tokens, spacing, radii, type scale, glass and glare colors
data/demos.ts         registry: id, title, category, description, libraries, icon
hooks/                useSettings, useTheme, useFavorites, useHaptics, useGlass, useSplash
lib/motion.ts         spring presets (duration + damping ratio), slow-motion multiplier, helpers
scripts/              asset generator
```

Stack: Expo SDK 58, Expo Router, Reanimated 4, Gesture Handler 3 (hook API), React Native Skia 2, expo-glass-effect, expo-blur, expo-haptics, AsyncStorage.

## Design rules

- **Animations never touch React state.** Shared values, worklets and animated styles only. Gestures run on the UI thread and hop to JS once for haptics or state.
- **Springs over timings** for anything the user moves. Presets are expressed as duration plus damping ratio, the same knobs UIKit uses, so the slow-motion setting only scales duration. Loaders, draw-on charts and the splash keep timings, as iOS does for progress.
- **Reduce Motion**: every decorative animation snaps to its end state or stops looping. Functional progress (hold-to-confirm, playback position) opts out so it still takes real time.
- **Liquid Glass**: `GlassSurface` picks glass, blur or solid once at launch. Glass opacity is never animated; wrappers move and scale instead. Native headers and the tab bar are left to the system.
- **No hardcoded colors.** Everything comes from the theme, including glass tints and the Expo Go splash frame.

## Performance notes

- All per-frame work is on the UI thread or inside Skia. Particle systems use one `Atlas` draw per burst with closed-form positions, so there is no per-particle state.
- Values that change every frame (timers, prices, temperature) render through a read-only `TextInput` driven by `useAnimatedProps` instead of re-rendering React.
- Loops stop when they are not visible: the skeleton shimmer cancels after content loads, the vinyl stops when paused, clocks freeze under Reduce Motion.
- To check on device: enable the Perf Monitor from the Expo dev menu and watch the UI frame rate while scrubbing the charts, dragging the liquid button and firing several confetti bursts.

## Expo Go notes

- Expo Go ignores the splash config and shows the app icon on white with the app name. The in-app splash reproduces that frame exactly, then animates. A production build uses the configured splash image instead.
- Liquid Glass needs iOS 26 and is drawn by Expo Go itself on supported devices. Below iOS 26 you see the blur fallback and opaque native chrome.
