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
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { StepIndicator } from '../components/StepIndicator';
import { CalendarIcon, ShieldIcon } from '../components/Icons';

import { normalizeSriLankanMobile, toLocalSriLankanMobile } from '../utils/phone';
import { BirthDatePicker } from '../components/BirthDatePicker';
import { birthDateToString, formatBirthDateInput, getBirthDateError, latestBirthDate, parseBirthDate } from '../utils/birthDate';

interface CreateAccountStep1ScreenProps {
  onBack: () => void;
  onContinue: (data: {
    fullName: string;
    email: string;
    phone: string;
    dob: string;
    nic: string;
  }) => void;
  onSignIn: () => void;
  initialData?: {
    fullName?: string;
    email?: string;
    phone?: string;
    dob?: string;
    nic?: string;
  };
}

export const CreateAccountStep1Screen: React.FC<CreateAccountStep1ScreenProps> = ({
  onBack,
  onContinue,
  onSignIn,
  initialData,
}) => {
  const { styles, colors, isDark } = useThemedStyles(createStyles);
  const [fullName, setFullName] = useState(initialData?.fullName || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phone, setPhone] = useState(toLocalSriLankanMobile(initialData?.phone || ''));
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [dob, setDob] = useState(initialData?.dob || '');
  const [dobError, setDobError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [nic, setNic] = useState(initialData?.nic || '');
  const maximumBirthDate = latestBirthDate();
  const pickerDate = getBirthDateError(dob) ? null : parseBirthDate(dob);

  const handleContinue = () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(cleanEmail)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailError(null);
    const normalizedPhone = normalizeSriLankanMobile(phone);
    if (!normalizedPhone) {
      setPhoneError('Enter a valid Sri Lankan mobile number, e.g. 077 123 4567.');
      return;
    }
    setPhoneError(null);
    const dateError = getBirthDateError(dob);
    setDobError(dateError);
    if (dateError) return;
    onContinue({
      fullName: fullName.trim(),
      email: cleanEmail,
      phone: toLocalSriLankanMobile(normalizedPhone),
      dob: dob.trim(),
      nic: nic.trim(),
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.card} />
      <Header title="Create Account" onBack={onBack} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title & subtitle */}
          <Text style={styles.title}>Personal Details</Text>
          <Text style={styles.subtitle}>
            Tell us a bit about yourself to create your donor profile.
          </Text>

          {/* Step bar */}
          <StepIndicator currentStep={1} totalSteps={4} />

          {/* Form Fields */}
          <View style={styles.formGroup}>
            {/* Full Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor={colors.textMuted}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={[styles.input, emailError && styles.phoneRowError]}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setEmailError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                accessibilityLabel="Email address"
              />
              {emailError && <Text style={styles.phoneError} accessibilityRole="alert">{emailError}</Text>}
            </View>

            {/* Phone Number */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mobile Number</Text>
              <View style={[styles.phoneRow, phoneError && styles.phoneRowError]}>
                <View style={styles.countryBadge}>
                  <Text style={styles.countryBadgeText}>LK</Text>
                </View>

                <TextInput
                  style={styles.phoneInput}
                  placeholder="077 123 4567"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(value) => {
                    setPhone(value);
                    setPhoneError(null);
                  }}
                  onBlur={() => setPhone(toLocalSriLankanMobile(phone))}
                  autoComplete="tel"
                  autoCorrect={false}
                  accessibilityLabel="Sri Lankan mobile number"
                />
              </View>
              {phoneError && <Text style={styles.phoneError} accessibilityRole="alert">{phoneError}</Text>}
            </View>

            {/* Date of Birth */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Date of Birth</Text>
              <View style={[styles.iconInputRow, dobError && styles.phoneRowError]}>
                <TextInput
                  style={styles.iconInputText}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  value={dob}
                  onChangeText={(value) => {
                    setDob(formatBirthDateInput(value));
                    setDobError(null);
                  }}
                  onBlur={() => setDobError(getBirthDateError(dob))}
                  keyboardType="number-pad"
                  maxLength={10}
                  autoCorrect={false}
                  accessibilityLabel="Date of birth, year month day"
                  accessibilityHint="Enter 8 digits; separators are added automatically."
                />
                <TouchableOpacity
                  style={styles.calendarButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowDatePicker(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Choose date of birth"
                  activeOpacity={0.7}
                >
                  <CalendarIcon size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {dobError && <Text style={styles.phoneError} accessibilityRole="alert">{dobError}</Text>}
            </View>

            {/* NIC Number */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>NIC Number</Text>
              <TextInput
                style={styles.input}
                placeholder="National ID Number"
                placeholderTextColor={colors.textMuted}
                value={nic}
                onChangeText={setNic}
                autoCapitalize="characters"
              />
            </View>

            {/* Privacy Informational Card */}
            <View style={styles.privacyCard}>
              <View style={styles.privacyIconWrap}>
                <ShieldIcon size={18} color={colors.textSecondary} />
              </View>
              <Text style={styles.privacyText}>
                Your personal information is kept private. Only operationally relevant details are shared with institutions.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={handleContinue}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signInLink}
          activeOpacity={0.7}
          onPress={onSignIn}
        >
          <Text style={styles.signInText}>
            Already have account? <Text style={styles.signInHighlight}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
      {showDatePicker && (
        <BirthDatePicker
          value={pickerDate || maximumBirthDate}
          maximumDate={maximumBirthDate}
          onCancel={() => setShowDatePicker(false)}
          onConfirm={(date) => {
            const selected = birthDateToString(date);
            setDob(selected);
            setDobError(getBirthDateError(selected));
            setShowDatePicker(false);
          }}
        />
      )}
    </SafeAreaView>
  );
};

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.card,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: c.text,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: c.textMuted,
    lineHeight: 18,
    marginBottom: 10,
  },
  formGroup: {
    marginTop: 8,
    gap: 16,
  },
  inputContainer: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
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
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: c.card,
  },
  countryBadge: {
    backgroundColor: c.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  countryBadgeText: {
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
    fontSize: 12,
    lineHeight: 18,
    color: c.textSecondary,
  },
  phoneRowError: {
    borderColor: c.primary,
  },
  phoneError: {
    fontSize: 12,
    lineHeight: 18,
    color: c.primary,
  },
  iconInputRow: {
    height: 48,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    overflow: 'hidden',
  },
  iconInputText: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontSize: 14,
    color: c.text,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  calendarButton: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyCard: {
    backgroundColor: c.infoSoft,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  privacyIconWrap: {
    marginRight: 10,
  },
  privacyText: {
    flex: 1,
    fontSize: 11.5,
    color: c.textSecondary,
    lineHeight: 16,
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
  signInLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  signInText: {
    fontSize: 13,
    color: c.textMuted,
  },
  signInHighlight: {
    color: c.primary,
    fontWeight: '700',
  },
});
