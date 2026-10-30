import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { setMotionScale } from '@/lib/motion';
import { getJSON, setJSON, STORAGE_KEYS } from '@/lib/storage';

export type ThemeMode = 'system' | 'light' | 'dark';
export type AnimationSpeed = 0.5 | 1 | 2;

export type Settings = {
  themeMode: ThemeMode;
  haptics: boolean;
  /** Multiplier applied to every animation duration. 2 = twice as slow. */
  speed: AnimationSpeed;
};

export const DEFAULT_SETTINGS: Settings = {
  themeMode: 'system',
  haptics: true,
  speed: 1,
};

type SettingsContextValue = {
  settings: Settings;
  /** True once persisted settings have been read from storage. */
  hydrated: boolean;
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    getJSON<Partial<Settings>>(STORAGE_KEYS.settings, {}).then((stored) => {
      if (!mounted.current) return;
      const merged = { ...DEFAULT_SETTINGS, ...stored };
      setMotionScale(merged.speed);
      setSettings(merged);
      setHydrated(true);
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  // Push the slow-motion multiplier into the UI-thread shared value.
  useEffect(() => {
    setMotionScale(settings.speed);
  }, [settings.speed]);

  const update = useCallback((patch: Partial<Settings>) => {
    // Apply synchronously so animations started in the same tick already use it
    // (child effects run before this provider's effect would).
    if (patch.speed !== undefined) setMotionScale(patch.speed);
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void setJSON(STORAGE_KEYS.settings, next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, hydrated, update }), [settings, hydrated, update]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
