import { useMemo } from 'react';
import { useTheme } from './ThemeContext';
import { AppColors } from './palette';

export function useThemedStyles<T>(createStyles: (colors: AppColors) => T) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme.colors), [createStyles, theme.colors]);
  return { ...theme, styles };
}
