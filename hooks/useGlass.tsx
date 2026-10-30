import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export type GlassMode = 'glass' | 'blur' | 'solid';

export type GlassState = {
  /** True when iOS 26 Liquid Glass is available and the API is safe to call. */
  liquidGlass: boolean;
  /** The user's Reduce Transparency accessibility setting. */
  reduceTransparency: boolean;
  /** What GlassSurface should render: real glass, a blur fallback, or a solid surface. */
  mode: GlassMode;
};

const GlassContext = createContext<GlassState>({ liquidGlass: false, reduceTransparency: false, mode: 'solid' });

/**
 * Decides once how translucent surfaces should render. Liquid Glass needs
 * iOS 26 and a non-beta API; Reduce Transparency wins over everything and
 * turns glass into solid themed surfaces.
 */
export function GlassProvider({ children }: PropsWithChildren) {
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const liquidGlass = useMemo(
    () => Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable(),
    [],
  );

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => {
        if (mounted) setReduceTransparency(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const value = useMemo<GlassState>(
    () => ({
      liquidGlass,
      reduceTransparency,
      // Android: expo-blur without a BlurTargetView is just a see-through layer, so use solid surfaces.
      mode: reduceTransparency || Platform.OS !== 'ios' ? 'solid' : liquidGlass ? 'glass' : 'blur',
    }),
    [liquidGlass, reduceTransparency],
  );

  return <GlassContext.Provider value={value}>{children}</GlassContext.Provider>;
}

export function useGlass(): GlassState {
  return useContext(GlassContext);
}
