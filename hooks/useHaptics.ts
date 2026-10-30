import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';

import { useSettings } from '@/hooks/useSettings';

export type HapticsApi = {
  light: () => void;
  medium: () => void;
  heavy: () => void;
  soft: () => void;
  rigid: () => void;
  selection: () => void;
  success: () => void;
  warning: () => void;
  error: () => void;
};

export type HapticKind = keyof HapticsApi;

/**
 * Every haptic in the app goes through this hook so the Settings toggle can
 * silence all of them. Each function is a plain JS function; from a UI-thread
 * worklet call it with `scheduleOnRN(haptics.light)`.
 */
export function useHaptics(): HapticsApi {
  const { settings } = useSettings();
  const enabled = settings.haptics;

  return useMemo(() => {
    const run = (fn: () => Promise<void>) => {
      if (!enabled) return;
      fn().catch(() => {
        // Haptics are unavailable on some devices and simulators. Ignore.
      });
    };
    return {
      light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
      medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
      heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
      soft: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
      rigid: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),
      selection: () => run(() => Haptics.selectionAsync()),
      success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
      warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
      error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
    };
  }, [enabled]);
}
