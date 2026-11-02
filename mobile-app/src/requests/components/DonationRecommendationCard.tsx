import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AppColors } from '../../theme/palette';
// src/requests/components/DonationRecommendationCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const DonationRecommendationCard: React.FC = () => {
  const { styles, colors } = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} style={styles.icon} />
      <Text style={styles.text}>
        Accept only if you can attend. The donation team will confirm eligibility when you arrive.
      </Text>
    </View>
  );
};

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.background,
    borderWidth: 0,
    borderColor: c.border,
    borderRadius: 0,
    paddingHorizontal: 2,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 20,
    gap: 12,
  },
  icon: {
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: c.textSecondary,
    fontWeight: '500',
  },
});
