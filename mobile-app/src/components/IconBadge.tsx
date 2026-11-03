import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  name: keyof typeof Ionicons.glyphMap;
  tone?: 'primary' | 'info' | 'success';
  small?: boolean;
}

/** Decorative companion to a visible label; never a separate screen-reader stop. */
export default function IconBadge({ name, tone = 'primary', small = false }: Props) {
  const { colors } = useTheme();
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ width: small ? 30 : 40, height: small ? 30 : 40, borderRadius: small ? 10 : 13,
      backgroundColor: colors[`${tone}Soft`], alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <Ionicons name={name} size={small ? 16 : 21} color={colors[tone]} />
  </View>;
}
