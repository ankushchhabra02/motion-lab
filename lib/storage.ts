import AsyncStorage from '@react-native-async-storage/async-storage';

/** Thin typed wrapper over AsyncStorage. Never throws; falls back on failure. */
export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setJSON<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is a convenience; the UI must keep working without it.
  }
}

export const STORAGE_KEYS = {
  settings: 'motion-lab:settings',
  favorites: 'motion-lab:favorites',
} as const;
