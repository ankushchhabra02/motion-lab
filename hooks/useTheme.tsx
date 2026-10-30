import { createContext, useContext, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type Theme } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';

const ThemeContext = createContext<Theme>(lightTheme);

/** Resolves System / Light / Dark into a concrete theme object. */
export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const { settings } = useSettings();
  const scheme = settings.themeMode === 'system' ? (systemScheme ?? 'light') : settings.themeMode;
  const theme = scheme === 'dark' ? darkTheme : lightTheme;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
