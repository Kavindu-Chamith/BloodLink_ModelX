import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

// Static line work adds depth without images, blur, timers or animation loops.
export default function CardArtwork() {
  const { colors } = useTheme();
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.art}>
    <View style={[styles.ring, { borderColor: colors.primary + '12' }]} />
    <View style={[styles.inner, { borderColor: colors.primary + '18', backgroundColor: colors.primary + '05' }]} />
  </View>;
}
const styles = StyleSheet.create({
  art: { position: 'absolute', width: 160, height: 160, right: -48, top: -68 },
  ring: { position: 'absolute', inset: 0, borderWidth: 22, borderRadius: 80 },
  inner: { position: 'absolute', inset: 34, borderWidth: 1, borderRadius: 60 },
});
