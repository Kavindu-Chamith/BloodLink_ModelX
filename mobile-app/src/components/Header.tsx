import { useThemedStyles } from '../theme/useThemedStyles';
import type { AppColors } from '../theme/palette';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeftIcon } from './Icons';

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, onBack, showBack = true }) => {
  const { styles, colors } = useThemedStyles(createStyles);
  return (
    <View style={styles.header}>
      {showBack ? (
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeftIcon size={20} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}

      {title ? <Text style={styles.title}>{title}</Text> : null}

      <View style={styles.placeholder} />
    </View>
  );
};

const createStyles = (c: AppColors) => StyleSheet.create({
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: c.card,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: c.text,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  placeholder: {
    width: 44,
  },
});
