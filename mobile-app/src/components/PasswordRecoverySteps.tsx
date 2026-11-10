import { useThemedStyles } from '../theme/useThemedStyles';
import type { AppColors } from '../theme/palette';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckIcon } from './Icons';

interface PasswordRecoveryStepsProps {
  currentStep: 1 | 2 | 3;
}

export const PasswordRecoverySteps: React.FC<PasswordRecoveryStepsProps> = ({ currentStep }) => {
  const { styles, colors } = useThemedStyles(createStyles);
  const steps = [
    {
      stepNum: 1,
      titleDone: 'Request submitted',
      descDone: currentStep === 3 ? 'Completed via registered email' : 'Verification email dispatched',
      titleActive: 'Submit request',
      descActive: 'Enter your email and click send below',
    },
    {
      stepNum: 2,
      titleDone: 'OTP verified',
      descDone: '6-digit security code accepted',
      titleActive: 'Enter 6-digit OTP code',
      descActive: 'Check spam or junk folder if delayed',
      titlePending: 'Check your inbox',
      descPending: 'Receive OTP valid for 15 mins',
    },
    {
      stepNum: 3,
      titleActive: 'Set new password',
      descActive: currentStep === 3 ? 'Enter and confirm strong credentials' : 'Enter OTP and create strong credentials & login',
      titlePending: 'Set new password',
      descPending: 'Create strong credentials & login',
    },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>PASSWORD RECOVERY STEPS</Text>
      <View style={styles.stepsContainer}>
        {steps.map((item, index) => {
          const isDone = item.stepNum < currentStep;
          const isActive = item.stepNum === currentStep;
          const isPending = item.stepNum > currentStep;
          const isLast = index === steps.length - 1;

          let title = '';
          let desc = '';
          if (isDone) {
            title = item.titleDone || '';
            desc = item.descDone || '';
          } else if (isActive) {
            title = item.titleActive;
            desc = item.descActive;
          } else {
            title = item.titlePending || item.titleActive;
            desc = item.descPending || item.descActive;
          }

          return (
            <View key={item.stepNum} style={styles.stepRow}>
              {/* Left indicator column with line */}
              <View style={styles.indicatorColumn}>
                <View
                  style={[
                    styles.circle,
                    isDone && styles.circleDone,
                    isActive && styles.circleActive,
                    isPending && styles.circlePending,
                  ]}
                >
                  {isDone ? (
                    <CheckIcon size={12} color={colors.onPrimary} strokeWidth={2.6} />
                  ) : (
                    <Text
                      style={[
                        styles.circleText,
                        isActive && styles.circleTextActive,
                        isPending && styles.circleTextPending,
                      ]}
                    >
                      {item.stepNum}
                    </Text>
                  )}
                </View>
                {!isLast && <View style={[styles.connectingLine, isDone && styles.connectingLineDone]} />}
              </View>

              {/* Step info */}
              <View style={[styles.textColumn, !isLast && { paddingBottom: 18 }]}>
                <Text style={[styles.stepTitle, isActive && styles.stepTitleActive, isDone && styles.stepTitleDone]}>
                  {title}
                </Text>
                <Text style={styles.stepDesc}>{desc}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (c: AppColors) => StyleSheet.create({
  card: {
    backgroundColor: c.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  stepsContainer: {
    paddingLeft: 4,
  },
  stepRow: {
    flexDirection: 'row',
  },
  indicatorColumn: {
    alignItems: 'center',
    width: 24,
    marginRight: 12,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleDone: {
    backgroundColor: c.successFill,
  },
  circleActive: {
    backgroundColor: c.action,
  },
  circlePending: {
    backgroundColor: c.surface,
  },
  circleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  circleTextActive: {
    color: c.onPrimary,
  },
  circleTextPending: {
    color: c.textMuted,
  },
  connectingLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: c.surface,
    marginVertical: 3,
  },
  connectingLineDone: {
    backgroundColor: c.success,
  },
  textColumn: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: c.textMuted,
    marginBottom: 2,
  },
  stepTitleActive: {
    color: c.primary,
  },
  stepTitleDone: {
    color: c.text,
  },
  stepDesc: {
    fontSize: 12,
    color: c.textMuted,
    lineHeight: 16,
  },
});
