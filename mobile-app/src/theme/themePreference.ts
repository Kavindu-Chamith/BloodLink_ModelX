import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemePreference = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'bloodlink.color-scheme';
export function parseThemePreference(value: unknown): ThemePreference | null {
  return value === 'light' || value === 'dark' ? value : null;
}
export function readWebThemePreference(): ThemePreference | null {
  if (Platform.OS !== 'web') return null;
  try { return parseThemePreference(globalThis.localStorage?.getItem(THEME_STORAGE_KEY)); }
  catch { return null; }
}
export async function readThemePreference(): Promise<ThemePreference | null> {
  if (Platform.OS === 'web') return readWebThemePreference();
  try { return parseThemePreference(await SecureStore.getItemAsync(THEME_STORAGE_KEY)); }
  catch { return null; }
}
export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(THEME_STORAGE_KEY, preference);
    else await SecureStore.setItemAsync(THEME_STORAGE_KEY, preference);
  } catch {
    // Restricted storage must not prevent switching appearance for this session.
  }
}
