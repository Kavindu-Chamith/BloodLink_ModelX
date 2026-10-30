import { useThemedStyles } from '../theme/useThemedStyles';
import type { AppColors } from '../theme/palette';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface WelcomeSelectionScreenProps {
  onGetStarted: () => void;
  onLogIn: () => void;
}

export const WelcomeSelectionScreen: React.FC<WelcomeSelectionScreenProps> = ({
  onGetStarted,
  onLogIn,
}) => {
  const { styles, colors } = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Top Banner section */}
      <SafeAreaView style={styles.topSection} edges={['top', 'left', 'right']}>
        <View style={styles.logoCard}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.appName}>BloodLink</Text>
        <Text style={styles.tagline}>SMART BLOOD DONATION</Text>
      </SafeAreaView>

      {/* Bottom Action section */}
      <SafeAreaView style={styles.bottomSection} edges={['bottom', 'left', 'right']}>
        <View style={styles.contentWrap}>
          <Text style={styles.description}>
            Your smart assistant for life-saving connections.
          </Text>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.85}
              onPress={onGetStarted}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.85}
              onPress={onLogIn}
            >
              <Text style={styles.secondaryButtonText}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.card,
  },
  topSection: {
    flex: 1.25,
    backgroundColor: c.action,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logoCard: {
    width: 92,
    height: 92,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 18,
  },
  logoImage: {
    width: 56,
    height: 56,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: c.onPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '700',
    color: c.onPrimary,
    letterSpacing: 2,
    opacity: 0.9,
  },
  bottomSection: {
    flex: 0.95,
    backgroundColor: c.card,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  contentWrap: {
    width: '100%',
    alignItems: 'center',
  },
  description: {
    fontSize: 15,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
    paddingHorizontal: 16,
    fontWeight: '500',
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: c.action,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: c.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: c.card,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: c.border,
  },
  secondaryButtonText: {
    color: c.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
