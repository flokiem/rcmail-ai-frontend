import { useState, useCallback, useMemo } from 'react';
import {
  loadThemePrefs, saveTheme, saveAccent, saveAccent2, computeCustomVars,
} from './theme.js';

// Manages the active theme + custom accent colors, persisting every change to
// localStorage. Returns the props the shell needs to render the themed root.
export function useTheme() {
  const init = loadThemePrefs();
  const [theme, setThemeState]     = useState(init.theme);
  const [accent, setAccentState]   = useState(init.accent);
  const [accent2, setAccent2State] = useState(init.accent2);

  const setTheme = useCallback((t) => { setThemeState(t); saveTheme(t); }, []);
  const setAccent = useCallback((c) => {
    setAccentState(c); saveAccent(c);
    setThemeState('custom'); saveTheme('custom');
  }, []);
  const setAccent2 = useCallback((c) => {
    setAccent2State(c); saveAccent2(c);
    setThemeState('custom'); saveTheme('custom');
  }, []);

  // Inline CSS-var overrides — only meaningful for the custom theme.
  const customStyle = useMemo(
    () => (theme === 'custom' ? computeCustomVars(accent, accent2) : undefined),
    [theme, accent, accent2],
  );

  return { theme, accent, accent2, setTheme, setAccent, setAccent2, customStyle };
}
