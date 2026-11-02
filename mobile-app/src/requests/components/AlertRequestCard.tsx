import React from 'react';
import { TactilePressable } from '../../components/Motion';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AppColors } from '../../theme/palette';
import { AlertRequestItem } from '../types/requests';

interface Props { item: AlertRequestItem; onPress: (item: AlertRequestItem) => void }
export function AlertRequestCard({ item, onPress }: Props) {
  const { styles: s, colors } = useThemedStyles(createStyles);
  const urgent = item.isUrgent || item.type === 'urgent';
  return <TactilePressable accessibilityRole="button" accessibilityLabel={urgent ? `View details and respond to ${item.hospitalName}` : `View details for ${item.hospitalName}`} onPress={() => onPress(item)} style={({ pressed }) => [s.card, urgent && s.urgentCard, pressed && { opacity: 0.75 }]}>
    <View style={s.top}><View style={s.status}><View style={[s.dot, { backgroundColor: urgent ? colors.primary : colors.textMuted }]} /><Text style={[s.statusText, urgent && { color: colors.primary }]}>{urgent ? 'Urgent request' : item.type === 'scheduled' ? 'Scheduled request' : 'Donation request'}</Text></View><Text style={s.time}>{item.timeAgo}</Text></View>
    <Text style={s.hospital}>{item.hospitalName}</Text>
    <View style={s.requirement}><Ionicons name="water-outline" size={15} color={colors.primary} /><Text style={s.requirementText}>{item.requirementLabel || `${item.bloodGroup} · ${item.unitsNeeded} ${item.unitsNeeded === 1 ? 'unit' : 'units'} needed`}</Text></View>
    <View style={s.bottom}><View style={s.distance}><Ionicons name="location-outline" size={13} color={colors.textMuted} /><Text style={s.time}>{item.distance}</Text></View><View style={s.review}><Text style={s.reviewText}>Review request</Text><Ionicons name="arrow-forward" size={15} color={colors.primary} /></View></View>
  </TactilePressable>;
}
const createStyles = (c: AppColors) => StyleSheet.create({
  card: { backgroundColor: c.card, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  urgentCard: { borderLeftWidth: 3, borderLeftColor: c.primary, backgroundColor: c.primarySoft },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 13 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 }, dot: { height: 5, width: 5, borderRadius: 3 },
  statusText: { fontSize: 11, color: c.textMuted, fontWeight: '500' }, time: { fontSize: 11, color: c.textMuted, lineHeight: 17 },
  hospital: { color: c.text, fontSize: 17, lineHeight: 24, fontWeight: '500', letterSpacing: -0.3, marginBottom: 9 },
  requirement: { flexDirection: 'row', alignItems: 'center', gap: 6 }, requirementText: { color: c.textSecondary, fontSize: 13, lineHeight: 20, flex: 1 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border, flexWrap: 'wrap', gap: 10 },
  distance: { flexDirection: 'row', gap: 4, alignItems: 'center' }, review: { flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: 32, paddingHorizontal: 10, borderRadius: 8, backgroundColor: c.primarySoft }, reviewText: { fontSize: 12, fontWeight: '500', color: c.primary },
});
