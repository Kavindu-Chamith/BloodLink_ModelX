import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconPop, TactilePressable } from './Motion';
import { useTheme } from '../theme/ThemeContext';

export type DonorTab = 'Home' | 'Requests' | 'Banks' | 'History' | 'Profile';

interface Props {
  activeTab: DonorTab;
  onSelect: (tab: DonorTab) => void;
  requestsCount?: number;
  colors?: { card: string; border: string; textMuted: string; primary: string; primarySoft: string };
}

const tabs: { label: DonorTab; icon: keyof typeof Ionicons.glyphMap; selectedIcon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Home', icon: 'home-outline', selectedIcon: 'home' },
  { label: 'Requests', icon: 'water-outline', selectedIcon: 'water' },
  { label: 'Banks', icon: 'business-outline', selectedIcon: 'business' },
  { label: 'History', icon: 'time-outline', selectedIcon: 'time' },
  { label: 'Profile', icon: 'person-outline', selectedIcon: 'person' },
];

export default function DonorBottomNav({ activeTab, onSelect, requestsCount = 0, colors: overrides }: Props) {
  const theme = useTheme();
  const colors = { ...theme.colors, ...overrides };
  const insets = useSafeAreaInsets();
  return (
    <View testID="donor-bottom-nav" accessibilityRole="tablist" accessibilityLabel="Main navigation" style={[styles.bar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
      {tabs.map(tab => {
        const selected = activeTab === tab.label;
        return (
          <TactilePressable
            key={tab.label}
            onPress={() => onSelect(tab.label)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label === 'Requests' && requestsCount > 0 ? `Requests, ${requestsCount} available` : tab.label}
            accessibilityState={{ selected }}
            aria-selected={selected}
            style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.icon, selected && { backgroundColor: colors.primarySoft }]}>
              <IconPop active={selected}><Ionicons name={selected ? tab.selectedIcon : tab.icon} size={20} color={selected ? colors.primary : colors.textMuted} /></IconPop>
              {tab.label === 'Requests' && requestsCount > 0 && <View style={[styles.badge, { backgroundColor: colors.action, borderColor: colors.card }]}><Text style={[styles.badgeText, { color: colors.onPrimary }]}>{requestsCount > 99 ? '99+' : requestsCount}</Text></View>}
            </View>
            <Text style={[styles.label, { color: selected ? colors.primary : colors.textMuted }, selected && styles.selectedLabel]}>{tab.label}</Text>
          </TactilePressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8 },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3 },
  icon: { width: 46, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, lineHeight: 16, fontWeight: '500' },
  selectedLabel: { fontWeight: '700' },
  badge: { position: 'absolute', top: -3, right: 4, minWidth: 15, height: 15, paddingHorizontal: 3, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 9, lineHeight: 12, fontWeight: '600' },
});
