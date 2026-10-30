import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  title: string;
  initials?: string;
  onProfile?: () => void;
  onBack?: () => void;
  onNotifications?: () => void;
  colors?: { card: string; text: string; border: string; primary: string };
}

export default function DonorHeader({ title, initials = 'KP', onProfile, onBack, onNotifications, colors: overrides }: Props) {
  const theme = useTheme();
  const colors = { ...theme.colors, ...overrides };
  return (
    <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      {onBack && <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back" style={styles.icon}><Ionicons name="arrow-back" size={20} color={colors.text} /></Pressable>}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {onNotifications && <Pressable onPress={onNotifications} accessibilityRole="button" accessibilityLabel="Open notifications" style={styles.icon}><Ionicons name="notifications-outline" size={21} color={colors.text} /></Pressable>}
      <Pressable onPress={onProfile} disabled={!onProfile} accessibilityRole={onProfile ? 'button' : undefined} accessibilityLabel="Open your profile" style={[styles.avatar, { backgroundColor: colors.action }]}><Text style={styles.initials}>{initials}</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 68, paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1 },
  title: { flex: 1, fontSize: 20, lineHeight: 28, fontWeight: '600', letterSpacing: -0.4 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
});
