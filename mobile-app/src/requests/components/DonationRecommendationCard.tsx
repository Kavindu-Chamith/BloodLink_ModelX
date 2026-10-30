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
      <Ionicons name="heart-outline" size={22} color={colors.textMuted} style={styles.icon} />
      <Text style={styles.text}>
        Donations are recommended every 3–4 months. Only respond if you are feeling healthy and well.
      </Text>
    </View>
  );
};

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    paddingHorizontal: 16,
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
