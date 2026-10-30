import type { IconName } from '@/components/Icon';

export const CATEGORIES = ['All', 'Basics', 'Gestures', 'Scroll', 'Mini Apps', 'Skia Effects', 'Liquid Glass'] as const;
export type CategoryFilter = (typeof CATEGORIES)[number];
export type Category = Exclude<CategoryFilter, 'All'>;

export type Library = 'Reanimated' | 'Gesture Handler' | 'Skia' | 'Haptics' | 'Glass Effect' | 'Expo Router' | 'AsyncStorage';

export type Demo = {
  id: string;
  title: string;
  category: Category;
  description: string;
  libraries: Library[];
  route: string;
  icon: IconName;
  /** False until the demo screen exists. Cards show a "Soon" tag and don't navigate. */
  ready: boolean;
};

const demo = (d: Omit<Demo, 'route'>): Demo => ({ ...d, route: `/demos/${d.id}` });

export const DEMOS = [
  // Basics
  demo({
    id: 'springy-buttons',
    title: 'Springy Buttons',
    category: 'Basics',
    description: 'Five button styles that squish, push, wobble and bounce under the finger, each with a matching haptic.',
    libraries: ['Reanimated', 'Gesture Handler', 'Haptics'],
    icon: 'radio-button-on-outline',
    ready: true,
  }),
  demo({
    id: 'toggle-checkbox',
    title: 'Toggle & Checkbox',
    category: 'Basics',
    description: 'A stretchy toggle and a checkbox whose checkmark draws itself with a Skia path animation.',
    libraries: ['Reanimated', 'Gesture Handler', 'Skia', 'Haptics'],
    icon: 'checkbox-outline',
    ready: true,
  }),
  demo({
    id: 'staggered-list',
    title: 'Staggered List',
    category: 'Basics',
    description: 'List items slide and fade in one after another with a configurable stagger.',
    libraries: ['Reanimated'],
    icon: 'list-outline',
    ready: true,
  }),
  demo({
    id: 'skeleton-loader',
    title: 'Skeleton Loader',
    category: 'Basics',
    description: 'Shimmering Skia placeholders that cross-fade into real content, one card after another.',
    libraries: ['Reanimated', 'Skia'],
    icon: 'hourglass-outline',
    ready: true,
  }),
  // Gestures
  demo({
    id: 'swipe-cards',
    title: 'Swipe Card Stack',
    category: 'Gestures',
    description: 'Drag to rotate, fly off past a threshold, snap back otherwise. Like and nope labels fade with progress.',
    libraries: ['Reanimated', 'Gesture Handler', 'Skia', 'Haptics'],
    icon: 'albums-outline',
    ready: true,
  }),
  demo({
    id: 'bottom-sheet',
    title: 'Bottom Sheet',
    category: 'Gestures',
    description: 'A draggable sheet with three snap points, a backdrop that dims with progress, and velocity-aware release.',
    libraries: ['Reanimated', 'Gesture Handler', 'Skia', 'Haptics'],
    icon: 'layers-outline',
    ready: true,
  }),
  demo({
    id: 'drag-reorder',
    title: 'Drag to Reorder',
    category: 'Gestures',
    description: 'Long-press lifts an item with a shadow and haptic; the others shift smoothly to make room.',
    libraries: ['Reanimated', 'Gesture Handler', 'Haptics'],
    icon: 'swap-vertical-outline',
    ready: true,
  }),
  demo({
    id: 'tilt-card',
    title: '3D Tilt Card',
    category: 'Gestures',
    description: 'A card that tilts toward your finger with perspective while a Skia light glare slides across it.',
    libraries: ['Reanimated', 'Gesture Handler', 'Skia'],
    icon: 'cube-outline',
    ready: true,
  }),
  // Scroll
  demo({
    id: 'collapsing-header',
    title: 'Collapsing Header',
    category: 'Scroll',
    description: 'A large profile header that shrinks into a compact top bar as you scroll, with a cover that stretches on pull.',
    libraries: ['Reanimated', 'Skia'],
    icon: 'person-circle-outline',
    ready: true,
  }),
  demo({
    id: 'parallax-carousel',
    title: 'Parallax Carousel',
    category: 'Scroll',
    description: 'Snapping cards where the artwork moves slower than the card, with scale and fade on the sides.',
    libraries: ['Reanimated', 'Skia'],
    icon: 'images-outline',
    ready: true,
  }),
  demo({
    id: 'animated-tab-bar',
    title: 'Animated Tab Bar',
    category: 'Scroll',
    description: 'A sliding indicator and bouncing icons that react to the selected tab.',
    libraries: ['Reanimated', 'Haptics'],
    icon: 'grid-outline',
    ready: true,
  }),
  // Mini Apps
  demo({
    id: 'music-player',
    title: 'Music Player',
    category: 'Mini Apps',
    description: 'A full-screen player that collapses into a mini player with a drag, plus a draggable seek bar.',
    libraries: ['Reanimated', 'Gesture Handler', 'Skia', 'Haptics'],
    icon: 'musical-notes-outline',
    ready: true,
  }),
  demo({
    id: 'wallet',
    title: 'Wallet',
    category: 'Mini Apps',
    description: 'Stacked cards that fan out on tap, flip to reveal the back, and swipe away to dismiss.',
    libraries: ['Reanimated', 'Gesture Handler', 'Haptics'],
    icon: 'wallet-outline',
    ready: true,
  }),
  demo({
    id: 'weather',
    title: 'Weather',
    category: 'Mini Apps',
    description: 'A Skia-drawn sun, clouds and rain that morph as you switch conditions.',
    libraries: ['Reanimated', 'Skia'],
    icon: 'partly-sunny-outline',
    ready: true,
  }),
  demo({
    id: 'onboarding',
    title: 'Onboarding',
    category: 'Mini Apps',
    description: 'Four swipeable slides with multi-layer parallax illustrations and an animated progress indicator.',
    libraries: ['Reanimated', 'Skia'],
    icon: 'rocket-outline',
    ready: true,
  }),
  demo({
    id: 'food-ordering',
    title: 'Food Ordering',
    category: 'Mini Apps',
    description: 'Tap "add" and the item flies along a curve into the cart, which bounces and updates its count.',
    libraries: ['Reanimated', 'Gesture Handler', 'Haptics'],
    icon: 'fast-food-outline',
    ready: true,
  }),
  demo({
    id: 'chat',
    title: 'Chat',
    category: 'Mini Apps',
    description: 'An iMessage-style thread: bubbles rise out of the input, swipe right to reply, swipe left to reveal times, double-tap to heart.',
    libraries: ['Reanimated', 'Gesture Handler', 'Haptics'],
    icon: 'chatbubbles-outline',
    ready: true,
  }),
  // Skia Effects
  demo({
    id: 'gradient-blobs',
    title: 'Gradient Blobs',
    category: 'Skia Effects',
    description: 'Slowly morphing gradient blobs behind frosted glass content.',
    libraries: ['Skia', 'Reanimated'],
    icon: 'color-filter-outline',
    ready: true,
  }),
  demo({
    id: 'confetti',
    title: 'Confetti Burst',
    category: 'Skia Effects',
    description: 'Hundreds of Skia particles burst from a button when an action succeeds.',
    libraries: ['Skia', 'Reanimated', 'Gesture Handler', 'Haptics'],
    icon: 'gift-outline',
    ready: true,
  }),
  demo({
    id: 'liquid-button',
    title: 'Liquid Button',
    category: 'Skia Effects',
    description: 'A button that stretches like a blob as you press and drag it, and snaps back with a wobble.',
    libraries: ['Skia', 'Reanimated', 'Gesture Handler', 'Haptics'],
    icon: 'water-outline',
    ready: true,
  }),
  demo({
    id: 'animated-charts',
    title: 'Animated Charts',
    category: 'Skia Effects',
    description: 'A line chart and progress rings that draw themselves in, with a draggable scrubber.',
    libraries: ['Skia', 'Reanimated', 'Gesture Handler', 'Haptics'],
    icon: 'stats-chart-outline',
    ready: true,
  }),
  // Liquid Glass
  demo({
    id: 'glass-lab',
    title: 'Glass Lab',
    category: 'Liquid Glass',
    description: 'Glass cards over animated Skia blobs, glass buttons that merge as they meet, and a draggable glass panel that snaps to corners.',
    libraries: ['Glass Effect', 'Skia', 'Reanimated', 'Gesture Handler', 'Haptics'],
    icon: 'diamond-outline',
    ready: true,
  }),
] as const satisfies readonly Demo[];

export type DemoId = (typeof DEMOS)[number]['id'];

const byId = new Map<string, Demo>(DEMOS.map((d) => [d.id, d]));

/** Lookup by an untrusted string (e.g. a persisted favorite id). */
export function findDemo(id: string): Demo | undefined {
  return byId.get(id);
}

export function getDemo(id: DemoId): Demo {
  const found = byId.get(id);
  if (!found) throw new Error(`Unknown demo: ${id}`);
  return found;
}

export const CATEGORY_ICONS: Record<Category, IconName> = {
  Basics: 'sparkles-outline',
  Gestures: 'hand-left-outline',
  Scroll: 'swap-vertical-outline',
  'Mini Apps': 'phone-portrait-outline',
  'Skia Effects': 'color-palette-outline',
  'Liquid Glass': 'diamond-outline',
};
