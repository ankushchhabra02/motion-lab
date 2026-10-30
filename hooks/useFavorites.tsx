import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { getJSON, setJSON, STORAGE_KEYS } from '@/lib/storage';

type FavoritesContextValue = {
  /** Demo ids, most recently added first. */
  favorites: string[];
  hydrated: boolean;
  isFavorite: (id: string) => boolean;
  /** Flips the favorite state and returns the new state. */
  toggle: (id: string) => boolean;
  remove: (id: string) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: PropsWithChildren) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const latest = useRef(favorites);
  latest.current = favorites;

  useEffect(() => {
    let mounted = true;
    getJSON<string[]>(STORAGE_KEYS.favorites, []).then((stored) => {
      if (!mounted) return;
      setFavorites(Array.isArray(stored) ? stored.filter((x) => typeof x === 'string') : []);
      setHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const commit = useCallback((next: string[]) => {
    latest.current = next;
    setFavorites(next);
    void setJSON(STORAGE_KEYS.favorites, next);
  }, []);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  const toggle = useCallback(
    (id: string) => {
      const current = latest.current;
      const adding = !current.includes(id);
      commit(adding ? [id, ...current] : current.filter((x) => x !== id));
      return adding;
    },
    [commit],
  );

  const remove = useCallback(
    (id: string) => {
      commit(latest.current.filter((x) => x !== id));
    },
    [commit],
  );

  const value = useMemo(
    () => ({ favorites, hydrated, isFavorite, toggle, remove }),
    [favorites, hydrated, isFavorite, toggle, remove],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside <FavoritesProvider>');
  return ctx;
}
