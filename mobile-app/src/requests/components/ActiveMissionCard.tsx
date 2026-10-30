import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AppColors } from '../../theme/palette';
// src/requests/components/ActiveMissionCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { ActiveMission } from '../types/requests';

interface ActiveMissionCardProps {
  mission: ActiveMission;
  onDirectionsPress: () => void;
  onCoordinatorPress: () => void;
}

export const ActiveMissionCard: React.FC<ActiveMissionCardProps> = ({
  mission,
  onDirectionsPress,
  onCoordinatorPress,
}) => {
  const { styles, colors } = useThemedStyles(createStyles);
  return (
    <View style={styles.card}>
      {/* Top Header Row */}
      <View style={styles.topRow}>
        <Text style={styles.sectionSubtitle}>ACTIVE DISPATCH MISSION</Text>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusBadgeText}>{mission.status}</Text>
        </View>
      </View>

      {/* Hospital Title & Unit */}
      <Text style={styles.hospitalTitle}>{mission.hospitalName}</Text>
      <Text style={styles.departmentText}>{mission.unitDepartment}</Text>

      {/* Dual Info Boxes */}
      <View style={styles.infoBoxesRow}>
        {/* Left Box: Required Blood */}
        <View style={styles.requiredBox}>
          <View style={styles.requiredIconContainer}>
            <Ionicons name="water" size={16} color={colors.primary} />
          </View>
          <View style={styles.requiredTextCol}>
            <Text style={styles.requiredLabel}>REQUIRED</Text>
            <Text style={styles.requiredValue}>
              {mission.bloodGroup} · {mission.unitsNeeded} {mission.unitsNeeded === 1 ? 'Unit' : 'Units'}
            </Text>
          </View>
        </View>

        {/* Right Box: Arrival Time */}
        <View style={styles.arrivalBox}>
          <Text style={styles.arrivalLabel}>ARRIVAL</Text>
          <Text style={styles.arrivalValue}>{mission.estimatedArrival}</Text>
        </View>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={styles.directionsButton}
          activeOpacity={0.85}
          onPress={onDirectionsPress}
          accessibilityRole="button"
          accessibilityLabel="Get directions to hospital"
        >
          <Feather name="navigation" size={15} color={colors.onPrimary} style={styles.btnIcon} />
          <Text style={styles.directionsButtonText}>Directions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.coordinatorButton}
          activeOpacity={0.8}
          onPress={onCoordinatorPress}
          accessibilityRole="button"
          accessibilityLabel="Call hospital coordinator"
        >
          <Ionicons name="call-outline" size={16} color={colors.text} style={styles.btnIcon} />
          <Text style={styles.coordinatorButtonText}>Coordinator</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (c: AppColors) => StyleSheet.create({
  card: {
    backgroundColor: c.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: c.textMuted,
    letterSpacing: 0.6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.successSoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.success,
    marginRight: 5,
  },
  statusBadgeText: {
    color: c.success,
    fontSize: 12,
    fontWeight: '700',
  },
  hospitalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: c.text,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  departmentText: {
    fontSize: 12,
    fontWeight: '500',
    color: c.textMuted,
    marginBottom: 14,
  },
  infoBoxesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  requiredBox: {
    flex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  requiredIconContainer: {
    width: 20,
    height: 24,
    borderRadius: 10,
    backgroundColor: c.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requiredTextCol: {
    flex: 1,
  },
  requiredLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: c.primary,
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  requiredValue: { lineHeight: 19,
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
  },
  arrivalBox: {
    flex: 1,
    backgroundColor: c.background,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrivalLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: c.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  arrivalValue: {
    fontSize: 14,
    fontWeight: '800',
    color: c.text,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  directionsButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: c.action,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#BA1328',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  directionsButtonText: {
    color: c.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  coordinatorButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordinatorButtonText: {
    color: c.text,
    fontSize: 14,
    fontWeight: '700',
  },
  btnIcon: {
    marginRight: 6,
  },
});
