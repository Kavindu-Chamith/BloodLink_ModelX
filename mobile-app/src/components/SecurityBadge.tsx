import { useThemedStyles } from '../theme/useThemedStyles';
import type { AppColors } from '../theme/palette';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LockIcon } from './Icons';

export const SecurityBadge: React.FC = () => {
  const { styles, colors } = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <LockIcon size={14} color={colors.textMuted} />
      </View>
      <Text style={styles.text}>
        Bank-grade encryption ensures your donor records and credentials remain protected.
      </Text>
    </View>
  );
};

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.background,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: c.border,
    marginVertical: 10,
  },
  iconWrapper: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    flex: 1,
    fontSize: 11,
    color: c.textMuted,
    lineHeight: 15,
  },
});
