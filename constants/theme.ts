import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Motion Lab design tokens. Every color in the app comes from here; components
 * never hardcode hex values. Light and dark palettes share the same keys so a
 * component written against `theme.colors` works in both modes.
 */

/**
 * The system font (SF Pro on iOS, Roboto on Android). Using the platform font
 * is the single biggest thing that makes an app feel native, so there is no
 * custom family: weights select the right SF optical cut automatically.
 */
export const fonts = {
  regular: undefined,
  medium: undefined,
  semibold: undefined,
  bold: undefined,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Apple's Dynamic Type sizes at the default ("Large") setting. */
export const typography = {
  display: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22 },
  bodyMedium: { fontSize: 17, lineHeight: 22, fontWeight: '500' },
  bodySemibold: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 15, lineHeight: 20 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/** Tint color: iOS system indigo. Everything else is the iOS system palette. */
export const ACCENT = '#5856D6';

/**
 * Expo Go draws a project's loading screen itself: a hard-coded white
 * background, the app icon at 200pt with a 30pt corner radius, and the app
 * name in black 20pt semibold below it. The in-app splash reproduces that frame
 * so the handoff is invisible. Production builds use the splash config instead.
 */
export const expoGoSplash = {
  background: '#FFFFFF',
  label: '#000000',
  iconSize: 200,
  iconRadius: 30,
  iconToLabelGap: 30,
  labelFontSize: 20,
  labelLineHeight: 24,
} as const;

/** Values mirrored from the expo-splash-screen plugin config in app.json. */
export const nativeSplash = {
  imageWidth: 160,
  cornerRatio: 0.15,
} as const;

export type ThemeColors = {
  background: string;
  /** iOS systemBackground: pure white / pure black, for full-bleed screens like Messages. */
  canvas: string;
  surface: string;
  surfaceElevated: string;
  surfacePressed: string;
  /** Opaque gray for unselected controls (chips, segmented tracks). */
  fill: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentSoft: string;
  accentStrong: string;
  onAccent: string;
  heart: string;
  success: string;
  danger: string;
  warning: string;
  info: string;
  overlay: string;
  /** Specular highlight for glossy surfaces (tilt card glare). */
  glare: string;
  glareClear: string;
  /** Translucent fill and edge for frosted-glass surfaces. */
  glass: string;
  glassBorder: string;
  skeleton: string;
  skeletonHighlight: string;
};

/** iOS system colors (grouped style), light appearance. */
export const lightColors: ThemeColors = {
  background: '#F2F2F7',
  canvas: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfacePressed: '#E5E5EA',
  fill: '#E3E3E8',
  text: '#000000',
  textSecondary: '#3C3C4399',
  textTertiary: '#3C3C434D',
  border: '#C6C6C8',
  borderStrong: '#C7C7CC',
  accent: ACCENT,
  accentSoft: '#5856D61F',
  accentStrong: '#4644B8',
  onAccent: '#FFFFFF',
  heart: '#FF2D55',
  success: '#34C759',
  danger: '#FF3B30',
  warning: '#FF9500',
  info: '#007AFF',
  overlay: 'rgba(0, 0, 0, 0.4)',
  glare: 'rgba(255, 255, 255, 0.55)',
  glareClear: 'rgba(255, 255, 255, 0)',
  glass: 'rgba(255, 255, 255, 0.38)',
  glassBorder: 'rgba(255, 255, 255, 0.7)',
  skeleton: '#E5E5EA',
  skeletonHighlight: '#F2F2F7',
};

/** iOS system colors (grouped style), dark appearance. */
export const darkColors: ThemeColors = {
  background: '#000000',
  canvas: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  surfacePressed: '#3A3A3C',
  fill: '#2C2C2E',
  text: '#FFFFFF',
  textSecondary: '#EBEBF599',
  textTertiary: '#EBEBF54D',
  border: '#38383A',
  borderStrong: '#48484A',
  accent: '#5E5CE6',
  accentSoft: '#5E5CE633',
  accentStrong: '#4B49C8',
  onAccent: '#FFFFFF',
  heart: '#FF375F',
  success: '#30D158',
  danger: '#FF453A',
  warning: '#FF9F0A',
  info: '#0A84FF',
  overlay: 'rgba(0, 0, 0, 0.6)',
  glare: 'rgba(255, 255, 255, 0.45)',
  glareClear: 'rgba(255, 255, 255, 0)',
  glass: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.2)',
  skeleton: '#2C2C2E',
  skeletonHighlight: '#3A3A3C',
};

export type ThemeShadows = {
  card: ViewStyle;
  floating: ViewStyle;
};

const lightShadows: ThemeShadows = {
  // iOS grouped content is flat: white on gray, no shadow.
  card: {},
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
};

const darkShadows: ThemeShadows = {
  card: {},
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
};

export type ColorScheme = 'light' | 'dark';

export type Theme = {
  scheme: ColorScheme;
  isDark: boolean;
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  fonts: typeof fonts;
  shadows: ThemeShadows;
};

export const lightTheme: Theme = {
  scheme: 'light',
  isDark: false,
  colors: lightColors,
  spacing,
  radii,
  typography,
  fonts,
  shadows: lightShadows,
};

export const darkTheme: Theme = {
  scheme: 'dark',
  isDark: true,
  colors: darkColors,
  spacing,
  radii,
  typography,
  fonts,
  shadows: darkShadows,
};
