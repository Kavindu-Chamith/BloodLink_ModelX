import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, useColorScheme, View } from 'react-native';
import { AppColors, darkColors, lightColors, withLegacyColors } from './palette';
import { readThemePreference, readWebThemePreference, saveThemePreference, ThemePreference } from './themePreference';

interface ThemeValue { colors: AppColors; isDark: boolean; toggleTheme: () => void }
const ThemeContext = createContext<ThemeValue | undefined>(undefined);
const light = withLegacyColors(lightColors);
const dark = withLegacyColors(darkColors);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference | null>(readWebThemePreference);
  const [ready, setReady] = useState(Platform.OS === 'web');
  const pendingSave = useRef(Promise.resolve());
  const isDark = (preference ?? system) === 'dark';
  const colors = isDark ? dark : light;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    void readThemePreference().then(saved => { if (active) { setPreference(saved); setReady(true); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready || !preference) return;
    pendingSave.current = pendingSave.current.then(() => saveThemePreference(preference));
  }, [preference, ready]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.body.style.backgroundColor = colors.background;
    const focusStyle = document.createElement('style');
    focusStyle.textContent = `:where(button, [role="button"], [role="tab"], [role="switch"], input, textarea):focus-visible { outline: 3px solid ${colors.focus}; outline-offset: 3px; }`;
    document.head.appendChild(focusStyle);
    return () => { focusStyle.remove(); };
  }, [colors, isDark]);

  const toggleTheme = useCallback(() => setPreference(current => (current ?? system) === 'dark' ? 'light' : 'dark'), [system]);
  const value = useMemo(() => ({ colors, isDark, toggleTheme }), [colors, isDark, toggleTheme]);
  return <ThemeContext.Provider value={value}>{ready ? children : <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} accessibilityLabel="Loading appearance" /></View>}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside the app ThemeProvider');
  return value;
}
