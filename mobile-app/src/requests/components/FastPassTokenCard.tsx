import { showAlert } from '../../utils/showAlert';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AppColors } from '../../theme/palette';
// src/requests/components/FastPassTokenCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FastPassTokenCardProps {
  token?: string;
}

export const FastPassTokenCard: React.FC<FastPassTokenCardProps> = ({ token }) => {
  const { styles, colors } = useThemedStyles(createStyles);
  if (!token) return null;
  const handlePress = () => {
    showAlert(
      'Donation reference',
      `Share reference ${token} with the donation team when you arrive.`
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Donation reference ${token}`}
    >
      <View style={styles.qrContainer}>
        <Ionicons name="document-text-outline" size={23} color={colors.textSecondary} />
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.tokenLabel}>Donation reference</Text>
        <Text style={styles.tokenCode}>{token}</Text>
        <Text style={styles.tokenHint}>Share this with the donation team on arrival.</Text>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (c: AppColors) => StyleSheet.create({
  card: {
    backgroundColor: c.card,
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: c.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  qrContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
  },
  tokenLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: c.textMuted,
    letterSpacing: 0.5,
  },
  tokenCode: {
    fontSize: 18,
    fontWeight: '600',
    color: c.text,
    letterSpacing: 0.4,
    marginVertical: 2,
  },
  tokenHint: {
    fontSize: 12.5,
    color: c.textMuted,
    fontWeight: '500',
  },
});
