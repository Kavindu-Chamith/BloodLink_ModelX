import { useThemedStyles } from '../theme/useThemedStyles';
import type { AppColors } from '../theme/palette';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, totalSteps = 4 }) => {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        Step {currentStep} of {totalSteps}
      </Text>
      <View style={styles.barContainer}>
        {Array.from({ length: totalSteps }).map((_, index) => {
          const isCompleted = index + 1 <= currentStep;
          return (
            <View
              key={index}
              style={[
                styles.segment,
                isCompleted ? styles.activeSegment : styles.inactiveSegment,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: c.primary,
    marginBottom: 8,
  },
  barContainer: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  activeSegment: {
    backgroundColor: c.action,
  },
  inactiveSegment: {
    backgroundColor: c.surface,
  },
});
