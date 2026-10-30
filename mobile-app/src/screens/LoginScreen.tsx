import { useThemedStyles } from '../theme/useThemedStyles';
import type { AppColors } from '../theme/palette';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeftIcon,
  EyeIcon,
  EyeOffIcon,
  FingerprintIcon,
} from '../components/Icons';
import { SecurityBadge } from '../components/SecurityBadge';

import { normalizeSriLankanMobile, toLocalSriLankanMobile } from '../utils/phone';

import { useAuth } from '../context/AuthContext';

interface LoginScreenProps {
  onBack: () => void;
  onSignIn: (method: 'phone' | 'email', credentials: any) => void;
  onForgotPassword: () => void;
  onRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onBack,
  onSignIn,
  onForgotPassword,
  onRegister,
}) => {
  const { styles, colors } = useThemedStyles(createStyles);
  const { signInWithEmail, signInWithPhone } = useAuth();
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'phone' | 'email' | 'password' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!password) {
      setErrorMessage('Please enter your password');
      return;
    }

    setIsLoading(true);
    try {
      if (method === 'email') {
        const cleanEmail = email.trim();
        if (!cleanEmail) {
          setErrorMessage('Please enter your email address');
          setIsLoading(false);
          return;
        }
        await signInWithEmail(cleanEmail, password);
      } else {
        const cleanPhone = normalizeSriLankanMobile(phone);
        if (!cleanPhone) {
          setErrorMessage('Enter a valid Sri Lankan mobile number, e.g. 077 123 4567.');
          setIsLoading(false);
          return;
        }
        await signInWithPhone(cleanPhone, password);
      }
      onSignIn(method, { phone, email, password });
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.action} />

      {/* Crimson Header */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back to welcome"
        >
          <ArrowLeftIcon size={20} color={colors.onPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Welcome back,{'\n'}Donor</Text>
        <Text style={styles.headerSubtitle}>
          Sign in to your BloodLink account
        </Text>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Sign In Method Selector */}
          <View style={styles.methodRow}>
            <Text style={styles.methodLabel}>Sign in method</Text>
            <View style={styles.tabPill}>
              <TouchableOpacity
                style={[styles.tabButton, method === 'phone' && styles.tabButtonActive]}
                onPress={() => setMethod('phone')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    method === 'phone' && styles.tabButtonTextActive,
                  ]}
                >
                  Phone
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, method === 'email' && styles.tabButtonActive]}
                onPress={() => setMethod('email')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    method === 'email' && styles.tabButtonTextActive,
                  ]}
                >
                  Email
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Primary Input (Phone or Email) */}
          {method === 'phone' ? (
            <View style={styles.inputContainer}>
              <View style={[styles.phoneInputRow, focusedField === 'phone' && styles.inputFocused]}>
                <View style={styles.countryPill}>
                  <Text style={styles.countryPillText}>LK</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="077 123 4567"
                  placeholderTextColor={colors.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  autoCorrect={false}
                  accessibilityLabel="Sri Lankan mobile number"
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => {
                    setFocusedField(null);
                    setPhone(toLocalSriLankanMobile(phone));
                  }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, focusedField === 'email' && styles.inputFocused]}
                placeholder="you@email.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Email address"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          )}

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.passwordRow, focusedField === 'password' && styles.inputFocused]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                accessibilityLabel="Password"
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword((visible) => !visible)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOffIcon size={20} color={colors.textMuted} />
                ) : (
                  <EyeIcon size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotPasswordWrap}
            activeOpacity={0.7}
            onPress={onForgotPassword}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Biometric Button */}
          <TouchableOpacity
            style={styles.biometricButton}
            activeOpacity={0.8}
            onPress={handleSubmit}
          >
            <FingerprintIcon size={20} color={colors.primary} />
            <Text style={styles.biometricText}>Sign in with Face ID / Fingerprint</Text>
          </TouchableOpacity>

          {/* Error Message */}
          {errorMessage && (
            <View style={{ backgroundColor: colors.primarySoft, borderRadius: 10, padding: 12, marginVertical: 10 }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
                {errorMessage}
              </Text>
            </View>
          )}

          {/* Security Guarantee Badge */}
          <SecurityBadge />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, isLoading && { opacity: 0.7 }]}
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          <Text style={styles.primaryButtonText}>
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerLink}
          activeOpacity={0.7}
          onPress={onRegister}
        >
          <Text style={styles.registerPrompt}>
            Don't have an account?{' '}
            <Text style={styles.registerHighlight}>Register as Donor</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    backgroundColor: c.action,
    paddingTop: 12,
    paddingBottom: 28,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: c.onPrimary,
    letterSpacing: -0.4,
    lineHeight: 32,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  methodLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
  },
  tabPill: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 3,
  },
  tabButton: { minHeight: 40, justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
  },
  tabButtonActive: {
    backgroundColor: c.action,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textMuted,
  },
  tabButtonTextActive: {
    color: c.onPrimary,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputFocused: {
    borderColor: c.primary,
    backgroundColor: c.primaryMuted,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: c.text,
    backgroundColor: c.card,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: c.card,
  },
  countryPill: {
    backgroundColor: c.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  countryPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textSecondary,
  },
  phoneInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: c.text,
  },
  phoneHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: c.textSecondary,
  },
  passwordRow: {
    height: 48,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
  },
  passwordInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 14,
    color: c.text,
  },
  passwordToggle: {
    width: 44,
    height: 44,
    flexShrink: 0,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotPasswordWrap: {
    alignSelf: 'flex-end',
    marginBottom: 18,
    marginTop: -4,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '700',
    color: c.primary,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    height: 46,
    backgroundColor: c.card,
    marginBottom: 12,
  },
  biometricText: {
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
  },
  primaryButton: {
    backgroundColor: c.action,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  primaryButtonText: {
    color: c.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  registerLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  registerPrompt: {
    fontSize: 13,
    color: c.textMuted,
  },
  registerHighlight: {
    color: c.primary,
    fontWeight: '700',
  },
});
