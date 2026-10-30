import { BlurView } from 'expo-blur';
import { GlassContainer, GlassView } from 'expo-glass-effect';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useGlass } from '@/hooks/useGlass';
import { useTheme } from '@/hooks/useTheme';

type SurfaceProps = ViewProps & {
  radius?: number;
  /** Accent tints the glass; surface tints it toward the card color. */
  tint?: 'none' | 'accent' | 'surface';
  /** Lets the system add the touch highlight Liquid Glass uses for controls. */
  interactive?: boolean;
  variant?: 'regular' | 'clear';
  /** Blur intensity for the pre-iOS-26 fallback. */
  intensity?: number;
};

/**
 * A translucent surface that is real Liquid Glass on iOS 26, a system
 * material blur on older iOS, and a solid themed card when Reduce
 * Transparency is on. Never animate this component's opacity; move or scale
 * a wrapper instead (Apple's rule for glass).
 */
export function GlassSurface({
  radius = 0,
  tint = 'none',
  interactive = false,
  variant = 'regular',
  intensity = 80,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const t = useTheme();
  const { mode } = useGlass();

  if (mode === 'glass') {
    const tintColor = tint === 'accent' ? t.colors.accent : tint === 'surface' ? t.colors.surface : undefined;
    return (
      <GlassView
        {...rest}
        style={[style, { borderRadius: radius }]}
        glassEffectStyle={variant}
        tintColor={tintColor}
        isInteractive={interactive}
        colorScheme={t.scheme}
      >
        {children}
      </GlassView>
    );
  }

  if (mode === 'blur') {
    return (
      <BlurView
        {...rest}
        tint={t.isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        intensity={intensity}
        style={[
          style,
          { borderRadius: radius, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.glassBorder },
        ]}
      >
        {tint !== 'none' ? (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: tint === 'accent' ? t.colors.accent : t.colors.surface, opacity: tint === 'accent' ? 0.88 : 0.5 }]}
          />
        ) : null}
        {children}
      </BlurView>
    );
  }

  return (
    <View
      {...rest}
      style={[
        style,
        {
          borderRadius: radius,
          backgroundColor: tint === 'accent' ? t.colors.accent : t.colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.colors.border,
        },
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Groups GlassSurfaces so neighbors merge into one shape when they get close.
 * Only Liquid Glass can do this; the fallbacks render a plain layout view.
 */
export function GlassGroup({ spacing = 24, style, children, ...rest }: ViewProps & { spacing?: number }) {
  const { mode } = useGlass();
  if (mode === 'glass') {
    return (
      <GlassContainer spacing={spacing} style={style} {...rest}>
        {children}
      </GlassContainer>
    );
  }
  return (
    <View style={style} {...rest}>
      {children}
    </View>
  );
}
