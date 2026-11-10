import { useThemedStyles } from '../theme/useThemedStyles';
import type { AppColors } from '../theme/palette';
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenName } from '../types/navigation';

interface DevScreenPickerProps {
  currentScreen: ScreenName;
  onSelectScreen: (screen: ScreenName) => void;
}

const SCREENS: { id: ScreenName; label: string; category: string }[] = [
  { id: 'Splash', label: '1. Loading / Splash Screen', category: 'Intro & Onboarding' },
  { id: 'Welcome', label: '2. Welcome (Selection 1)', category: 'Intro & Onboarding' },
  { id: 'Onboarding', label: '3. Onboarding Carousel (2, 3, 4)', category: 'Intro & Onboarding' },

  { id: 'CreateAccountStep1', label: '4. Register: Step 1 (Personal Details)', category: 'Create Account Flow' },
  { id: 'CreateAccountStep2', label: '5. Register: Step 2 (Blood Group)', category: 'Create Account Flow' },
  { id: 'CreateAccountStep3', label: '6. Register: Step 3 (OTP Verification)', category: 'Create Account Flow' },
  { id: 'CreateAccountStep4', label: '7. Register: Step 4 (Document Upload)', category: 'Create Account Flow' },
  { id: 'RegisteredSuccess', label: '8. Registered Successfully', category: 'Create Account Flow' },

  { id: 'Login', label: '9. Login Screen (Phone/Email/Biometric)', category: 'Authentication' },

  { id: 'ResetPasswordStep1', label: '10. Reset Password: Step 1 (Email)', category: 'Reset Password Flow' },
  { id: 'ResetPasswordStep2', label: '11. Reset Password: Step 2 (OTP)', category: 'Reset Password Flow' },
  { id: 'ResetPasswordStep3', label: '12. Reset Password: Step 3 (New Password)', category: 'Reset Password Flow' },
  { id: 'Home', label: '13. Home Dashboard (Main App)', category: 'Donor App Dashboard' },
  { id: 'Requests', label: '14. Blood Requests (New Alerts & Active Mission)', category: 'Donor App Dashboard' },
  { id: 'Profile', label: '15. Donor Profile (Profile Management)', category: 'Donor Profile' },
  { id: 'History', label: '16. Donation History', category: 'Donor History' },
  { id: 'Notifications', label: '17. Notifications', category: 'Notifications' },
  { id: 'Banks', label: '18. Blood Banks', category: 'Donor App Dashboard' },
];

export const DevScreenPicker: React.FC<DevScreenPickerProps> = ({
  currentScreen,
  onSelectScreen,
}) => {
  const { styles } = useThemedStyles(createStyles);
  const [modalVisible, setModalVisible] = useState(false);

  const categories = Array.from(new Set(SCREENS.map((s) => s.category)));

  return (
    <>
      {/* Floating Toggle Pill */}
      <View style={styles.floatingContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.pillButton}
          activeOpacity={0.85}
          onPress={() => setModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Open development screen navigator"
        >
          <View style={styles.badgeIndicator} />
          <Text style={styles.pillText} numberOfLines={1}>
            Screens: {currentScreen}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Screen Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>BloodLink Screen Navigator</Text>
                <Text style={styles.modalSubtitle}>Jump directly to any designed screen</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.screenList} showsVerticalScrollIndicator={false}>
              {categories.map((category) => (
                <View key={category} style={styles.categorySection}>
                  <Text style={styles.categoryHeader}>{category}</Text>
                  {SCREENS.filter((s) => s.category === category).map((item) => {
                    const isSelected = item.id === currentScreen;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.screenItem,
                          isSelected && styles.screenItemSelected,
                        ]}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => {
                          onSelectScreen(item.id);
                          setModalVisible(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.screenItemText,
                            isSelected && styles.screenItemTextSelected,
                          ]}
                        >
                          {item.label}
                        </Text>
                        {isSelected && <Text style={styles.activeCheck}>●</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const createStyles = (c: AppColors) => StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    zIndex: 9999,
  },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.action,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  badgeIndicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: c.action,
  },
  pillText: {
    color: c.onPrimary,
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 160,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: c.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: c.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: c.textMuted,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
    color: c.textSecondary,
  },
  screenList: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: c.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  screenItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: c.background,
  },
  screenItemSelected: {
    backgroundColor: c.primaryMuted,
    borderWidth: 1,
    borderColor: c.primary,
  },
  screenItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textSecondary,
  },
  screenItemTextSelected: {
    color: c.primary,
    fontWeight: '800',
  },
  activeCheck: {
    color: c.primary,
    fontSize: 10,
  },
});
