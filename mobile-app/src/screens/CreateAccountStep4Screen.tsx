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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { StepIndicator } from '../components/StepIndicator';
import { UploadIcon } from '../components/Icons';

import { useAuth } from '../context/AuthContext';
import { RegistrationData } from '../types/navigation';
import { normalizeSriLankanMobile } from '../utils/phone';

interface CreateAccountStep4ScreenProps {
  onBack: () => void;
  onSubmit: (docName: string) => void;
  onSignIn: () => void;
  bloodGroup?: string;
  registrationData?: RegistrationData;
}

const ACCEPTED_DOCUMENTS = [
  'Medical Laboratory Blood Report',
  'Blood Donation Service Card',
  'Hospital Discharge Summary',
  'National Blood Transfusion Report',
];

export const CreateAccountStep4Screen: React.FC<CreateAccountStep4ScreenProps> = ({
  onBack,
  onSubmit,
  onSignIn,
  bloodGroup = 'A+',
  registrationData,
}) => {
  const { styles, colors, isDark } = useThemedStyles(createStyles);
  const { register } = useAuth();
  const email = registrationData?.email || '';
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFinalSubmit = async () => {
    setErrorMessage(null);
    const cleanEmail = email.trim();
    if (!registrationData?.registrationToken || !registrationData.phone || !registrationData.fullName || !registrationData.nic) {
      setErrorMessage('Complete your details and email verification first.'); return;
    }
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address');
      return;
    }
    if (!password || password.length < 8) {
      setErrorMessage('Password must be at least 8 characters with letters, numbers & symbols');
      return;
    }

    const formattedPhone = normalizeSriLankanMobile(registrationData.phone);
    if (!formattedPhone) {
      setErrorMessage('Go back to Personal Details and enter a valid Sri Lankan mobile number.');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        fullName: registrationData.fullName,
        email: cleanEmail,
        phone: formattedPhone,
        nic: registrationData.nic,
        dob: registrationData.dob || undefined,
        bloodGroup: bloodGroup || registrationData?.bloodGroup || 'A+',
        password,
        registrationToken: registrationData.registrationToken,
      });

      onSubmit('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.card} />
      <Header title="Create Account" onBack={onBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Account & Verification</Text>
        <Text style={styles.subtitle}>
          Set your login credentials and verify your {bloodGroup} blood group.
        </Text>

        <StepIndicator currentStep={4} totalSteps={4} />

        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Credentials Section */}
        <View style={styles.credentialsSection}>
          <Text style={styles.sectionHeader}>LOGIN CREDENTIALS</Text>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Email address</Text>
            <TextInput
              style={styles.input}
              placeholder="donor@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={false}
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Min. 8 chars (e.g. Donor@2026!)"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrorMessage(null);
              }}
              secureTextEntry
              autoCapitalize="none"
              editable={!isLoading}
            />
          </View>
        </View>

        {/* Upload Container */}
        <Text style={[styles.sectionHeader, { marginTop: 12 }]}>BLOOD GROUP DOCUMENT</Text>
        <TouchableOpacity
          style={styles.uploadBox}
          activeOpacity={0.8}
          disabled
        >
          <View style={styles.uploadIconBadge}>
            <UploadIcon size={24} color={colors.primary} />
          </View>

          <Text style={styles.uploadPrompt}>Upload from your profile after registration</Text>
          <Text style={styles.uploadSpecs}>Your blood group remains unverified until a document is reviewed.</Text>
        </TouchableOpacity>

        {/* Accepted Document Types */}
        <View style={styles.acceptedSection}>
          <Text style={styles.sectionHeader}>ACCEPTED DOCUMENT TYPES</Text>
          {ACCEPTED_DOCUMENTS.map((doc, idx) => (
            <View key={idx} style={styles.docItemRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.docItemText}>{doc}</Text>
            </View>
          ))}
        </View>

        {/* Important Notice Callout */}
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            <Text style={styles.noticeBold}>Important:</Text> A BloodLink administrator reviews your document. BloodLink does not automatically determine your blood group — human verification is required.
          </Text>
        </View>
      </ScrollView>

      {/* Footer Submit */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, isLoading && { opacity: 0.7 }]}
          activeOpacity={0.85}
          onPress={handleFinalSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>Create Account</Text>
          )}
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
  errorBox: {
    backgroundColor: c.primarySoft,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: c.primary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  credentialsSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: c.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  inputWrap: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textSecondary,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: c.background,
    fontSize: 14,
    color: c.text,
  },
  uploadBox: {
    backgroundColor: c.background,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: c.border,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: c.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadPrompt: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    marginBottom: 4,
  },
  uploadSpecs: {
    fontSize: 12,
    color: c.textMuted,
    marginBottom: 14,
  },
  browseButton: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  browseButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textSecondary,
  },
  fileSelectedWrap: {
    alignItems: 'center',
  },
  fileCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  fileNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: c.text,
    marginLeft: 6,
  },
  fileChangeText: {
    fontSize: 12,
    color: c.success,
    fontWeight: '600',
  },
  acceptedSection: {
    backgroundColor: c.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  docItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.action,
    marginRight: 10,
  },
  docItemText: {
    fontSize: 13,
    color: c.textSecondary,
    fontWeight: '500',
  },
  noticeBox: {
    backgroundColor: c.infoSoft,
    borderLeftWidth: 3,
    borderLeftColor: c.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  noticeText: {
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
  },
  noticeBold: {
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  primaryButton: {
    backgroundColor: c.action,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: c.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  signInLink: {
    alignItems: 'center',
    marginTop: 14,
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
