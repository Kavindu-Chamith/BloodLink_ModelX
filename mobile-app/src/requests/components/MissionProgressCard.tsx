import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AppColors } from '../../theme/palette';
// src/requests/components/MissionProgressCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MissionStep } from '../types/requests';

interface MissionProgressCardProps {
  steps?: MissionStep[];
}

export const MissionProgressCard: React.FC<MissionProgressCardProps> = ({ steps }) => {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.sectionSubtitle}>MISSION PROGRESS</Text>

      <View style={styles.timelineContainer}>
        {steps?.map((step, index) => {
          const complete = step.status === 'completed';
          const current = step.status === 'in_progress';
          return <View key={step.id} style={styles.stepRow}>
            <View style={styles.iconColumn}>
              <View style={complete ? styles.completedIconContainer : current ? styles.inProgressTargetCircle : styles.upcomingIconContainer}>
                {current ? <View style={styles.inProgressInnerDot} /> : <Ionicons name={complete ? 'checkmark' : 'add'} size={14} color={complete ? '#059669' : '#94A3B8'} />}
              </View>
              {index < steps.length - 1 && <View style={complete ? styles.activeLine : styles.upcomingLine} />}
            </View>
            <View style={styles.contentRow}>
              <Text style={[complete ? styles.stepTitleCompleted : current ? styles.stepTitleInProgress : styles.stepTitleUpcoming, { flex: 1, marginRight: 8 }]}>{step.title}</Text>
              {step.time ? <Text style={styles.stepTime}>{step.time}</Text> : current ? <View style={styles.inProgressBadge}><Text style={styles.inProgressBadgeText}>{step.badgeText || 'In Progress'}</Text></View> : <Text style={styles.stepUpcomingText}>{step.badgeText || 'Upcoming'}</Text>}
            </View>
          </View>;
        })}
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
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: c.textMuted,
    letterSpacing: 0.6,
    marginBottom: 16,
  },
  timelineContainer: {
    paddingLeft: 4,
    paddingRight: 4,
  },
  stepRow: {
    flexDirection: 'row',
  },
  stepRowLast: {
    flexDirection: 'row',
  },
  iconColumn: {
    alignItems: 'center',
    width: 26,
    marginRight: 14,
  },
  completedIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeLine: {
    width: 2,
    height: 28,
    backgroundColor: c.success,
    marginVertical: 2,
  },
  inProgressTargetCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inProgressInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.card,
  },
  upcomingLine: {
    width: 2,
    height: 28,
    backgroundColor: c.surface,
    marginVertical: 2,
  },
  upcomingIconContainer: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.background,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 1,
    alignSelf: 'flex-start',
    minHeight: 24,
  },
  stepTitleCompleted: {
    fontSize: 13,
    fontWeight: '500',
    color: c.text,
  },
  stepTime: {
    fontSize: 13,
    fontWeight: '500',
    color: c.textMuted,
  },
  stepTitleInProgress: {
    fontSize: 13,
    fontWeight: '500',
    color: c.primary,
  },
  inProgressBadge: {
    backgroundColor: c.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  inProgressBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: c.primary,
  },
  stepTitleUpcoming: {
    fontSize: 13,
    fontWeight: '500',
    color: c.textMuted,
  },
  stepUpcomingText: {
    fontSize: 13,
    fontWeight: '500',
    color: c.textMuted,
  },
});
