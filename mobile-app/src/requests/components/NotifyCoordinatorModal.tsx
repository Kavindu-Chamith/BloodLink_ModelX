import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AppColors } from '../../theme/palette';
// src/requests/components/NotifyCoordinatorModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface NotifyCoordinatorModalProps {
  visible: boolean;
  coordinatorName?: string;
  coordinatorPhone?: string;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  onCall: () => void;
}

const PRESET_REASONS = [
  'Running 10–15 mins late due to traffic',
  'Feeling unwell / dizziness',
  'Urgent personal emergency',
  'Arrived outside triage desk',
];

export const NotifyCoordinatorModal: React.FC<NotifyCoordinatorModalProps> = ({
  visible,
  coordinatorName = 'Dr. Nirmal Weerasinghe',
  coordinatorPhone = '+94 77 123 4567',
  onClose,
  onSubmit,
  onCall,
}) => {
  const { styles, colors } = useThemedStyles(createStyles);
  const [selectedReason, setSelectedReason] = useState<string>(PRESET_REASONS[0]);
  const [customNote, setCustomNote] = useState('');

  const handleSend = () => {
    const finalReason = customNote.trim() ? `${selectedReason} - Note: ${customNote.trim()}` : selectedReason;
    onSubmit(finalReason);
    setCustomNote('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss coordinator dialog" />
          <SafeAreaView style={styles.modalContent} edges={['bottom', 'left', 'right']} accessibilityViewIsModal>
            <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.title}>Notify Coordinator</Text>
                <Text style={styles.subtitle}>{coordinatorName} ({coordinatorPhone})</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Quick Reason Options */}
            <Text style={styles.sectionLabel}>Select Status / Reason:</Text>
            <View style={styles.reasonsList} accessibilityRole="radiogroup" accessibilityLabel="Coordinator update reason">
              {PRESET_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    style={[styles.reasonItem, isSelected && styles.reasonItemSelected]}
                    onPress={() => setSelectedReason(reason)}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    aria-checked={isSelected}
                  >
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected && <View style={styles.radioInnerDot} />}
                    </View>
                    <Text style={[styles.reasonText, isSelected && styles.reasonTextSelected]}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Note input */}
            <TextInput
              style={styles.textInput}
              placeholder="Optional message to hospital team..."
              placeholderTextColor={colors.textMuted}
              value={customNote}
              onChangeText={setCustomNote}
              maxLength={150}
              accessibilityLabel="Coordinator message"
            />

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.callButton}
                onPress={onCall}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Ionicons name="call" size={16} color={colors.primary} />
                <Text style={styles.callButtonText}>Call Direct</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSend}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={styles.sendButtonText}>Send Update</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (c: AppColors) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '90%',
    backgroundColor: c.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: c.text,
  },
  subtitle: {
    fontSize: 13,
    color: c.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  reasonsList: {
    gap: 8,
    marginBottom: 14,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.border,
  },
  reasonItemSelected: {
    borderColor: c.primary,
    backgroundColor: c.primarySoft,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioCircleSelected: {
    borderColor: c.primary,
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.action,
  },
  reasonText: {
    fontSize: 13.5,
    color: c.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  reasonTextSelected: {
    color: c.primary,
    fontWeight: '700',
  },
  textInput: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13.5,
    color: c.text,
    marginBottom: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  callButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: c.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  callButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: c.primary,
  },
  sendButton: {
    flex: 1.4,
    height: 48,
    borderRadius: 14,
    backgroundColor: c.action,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#BA1328',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  sendButtonText: {
    color: c.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
