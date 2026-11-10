import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { TactilePressable } from './Motion';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  title: string;
  initials?: string;
  onProfile?: () => void;
  onBack?: () => void;
  onNotifications?: () => void;
  notificationsCount?: number;
  colors?: { card: string; text: string; border: string; primary: string };
}

export default function DonorHeader({ title, initials = 'D', onProfile, onBack, onNotifications, notificationsCount, colors: overrides }: Props) {
  const theme = useTheme();
  const colors = { ...theme.colors, ...overrides };
  return (
    <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      {onBack && <TactilePressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back" style={styles.icon}><Ionicons name="arrow-back" size={20} color={colors.text} /></TactilePressable>}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {onNotifications && <TactilePressable onPress={onNotifications} accessibilityRole="button" accessibilityLabel={notificationsCount === undefined ? 'Open notifications' : `Notifications, ${notificationsCount} unread`} style={styles.icon}><Ionicons name="notifications-outline" size={21} color={colors.text} />{!!notificationsCount && <View style={{ position: 'absolute', right: 10, top: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.action }} />}</TactilePressable>}
      <TactilePressable onPress={onProfile} disabled={!onProfile} accessibilityRole={onProfile ? 'button' : undefined} accessibilityLabel="Open your profile" style={[styles.avatar, { backgroundColor: colors.primarySoft, borderColor: colors.primary + '18' }]}><Text style={[styles.initials, { color: colors.primary }]}>{initials}</Text></TactilePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 66, paddingHorizontal: 22, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, fontSize: 20, lineHeight: 28, fontWeight: '600', letterSpacing: -0.6 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 12, fontWeight: '600' },
});
