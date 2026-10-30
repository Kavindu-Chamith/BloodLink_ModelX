import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AppColors } from '../../theme/palette';
// src/requests/screens/RequestsScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import DonorBottomNav, { DonorTab } from '../../components/DonorBottomNav';
import {
  RequestsHeader,
  RequestsTabs,
  AlertRequestCard,
  DonationRecommendationCard,
  ActiveMissionCard,
  MissionProgressCard,
  FastPassTokenCard,
  NotifyCoordinatorModal,
} from '../components';
import EmergencyRequestScreen from './EmergencyRequestScreen';
import { useBloodRequests } from '../hooks/useBloodRequests';
import { RequestTabType } from '../types/requests';

interface RequestsScreenProps {
  initialTab?: RequestTabType;
  initialRequestId?: string;
  onNavigateTab?: (tab: DonorTab) => void;
  onNavigateToProfile?: () => void;
}

export const RequestsScreen: React.FC<RequestsScreenProps> = ({
  initialTab = 'alerts',
  initialRequestId,
  onNavigateTab,
  onNavigateToProfile,
}) => {
  const { styles, colors, isDark } = useThemedStyles(createStyles);
  const {
    activeTab,
    setActiveTab,
    data,
    loading,
    refreshing,
    error,
    responseError,
    responding,
    reload,
    refresh,
    selectedRequest,
    isDetailModalOpen,
    isCoordinatorModalOpen,
    setIsCoordinatorModalOpen,
    handleOpenDetails,
    handleCloseDetails,
    handleRespondToRequest,
    handleOpenDirections,
    handleCallCoordinator,
    handleSendCoordinatorNotification,
  } = useBloodRequests(initialTab, initialRequestId);

  const handleTabPress = (tab: DonorTab) => {
    if (tab !== 'Requests' && onNavigateTab) {
      onNavigateTab(tab);
    }
  };

  if (isDetailModalOpen && selectedRequest) return <EmergencyRequestScreen
    request={selectedRequest} responding={responding} error={responseError}
    onBack={handleCloseDetails} onRespond={handleRespondToRequest}
    onNavigateTab={(tab) => { if (tab === 'Requests') handleCloseDetails(); else handleTabPress(tab); }}
    requestsCount={data?.unreadAlertsCount}
  />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Screen Header */}
      <RequestsHeader
        initials={data?.donorInitials || 'D'}
        onAvatarPress={onNavigateToProfile}
      />

      {/* Segmented Control Switcher */}
      <RequestsTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        alertsCount={data?.unreadAlertsCount ?? 0}
        activeCount={data?.activeCount ?? 0}
      />

      {/* Main Content Area */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
              colors={['#BA1328']}
            />
          }
        >
          {error && <View style={styles.errorCard}><Text style={styles.errorText} accessibilityRole="alert">{error}</Text><TouchableOpacity onPress={reload} accessibilityRole="button" style={styles.retryButton}><Text style={styles.notifyLinkText}>Try again</Text></TouchableOpacity></View>}
          {activeTab === 'alerts' ? (
            /* ================= WINDOW 1: NEW ALERTS ================= */
            <View style={styles.alertsContainer}>
              {data?.alerts.map((item) => (
                <AlertRequestCard
                  key={item.id}
                  item={item}
                  onPress={handleOpenDetails}
                />
              ))}

              {data && data.alerts.length === 0 && <View style={styles.emptyMissionCard}><Ionicons name="checkmark-circle-outline" size={32} color={colors.success} /><Text style={styles.emptyMissionTitle}>You’re all caught up</Text><Text style={styles.emptyMissionDesc}>New blood donation requests will appear here. Pull down to refresh.</Text></View>}

              {/* Bottom Reminder Note */}
              <DonationRecommendationCard />
            </View>
          ) : (
            /* ================= WINDOW 2: ACTIVE MISSION ================= */
            <View style={styles.activeContainer}>
              {data?.activeMission ? (
                <>
                  {/* Top Dispatch Mission Card */}
                  <ActiveMissionCard
                    mission={data.activeMission}
                    onDirectionsPress={handleOpenDirections}
                    onCoordinatorPress={() => setIsCoordinatorModalOpen(true)}
                  />

                  {/* Mission Progress Vertical Stepper */}
                  <MissionProgressCard steps={data.activeMission.steps} />

                  {/* Fast Pass Token Card */}
                  <FastPassTokenCard token={data.activeMission.fastPassToken} />

                  {/* Unable to make it? Notify Coordinator footer */}
                  <View style={styles.footerLinkContainer}>
                    <Text style={styles.footerLinkText}>Unable to make it? </Text>
                    <TouchableOpacity
                      onPress={() => setIsCoordinatorModalOpen(true)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                    >
                      <Text style={styles.notifyLinkText}>Notify Coordinator</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.emptyMissionCard}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="shield-checkmark-outline" size={38} color={colors.textMuted} />
                  </View>
                  <Text style={styles.emptyMissionTitle}>No Active Mission</Text>
                  <Text style={styles.emptyMissionDesc}>
                    When you accept an urgent blood request alert, your dispatch mission and real-time hospital coordinator details will appear here.
                  </Text>
                  <TouchableOpacity
                    style={styles.browseButton}
                    onPress={() => setActiveTab('alerts')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.browseButtonText}>Browse Available Alerts</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Bottom Navigation Bar */}
      <DonorBottomNav activeTab="Requests" onSelect={handleTabPress} requestsCount={data?.unreadAlertsCount} />

      {/* Notify Coordinator Modal */}
      <NotifyCoordinatorModal
        visible={isCoordinatorModalOpen}
        coordinatorName={data?.activeMission?.coordinatorName}
        coordinatorPhone={data?.activeMission?.coordinatorPhone}
        onClose={() => setIsCoordinatorModalOpen(false)}
        onSubmit={handleSendCoordinatorNotification}
        onCall={handleCallCoordinator}
      />
    </SafeAreaView>
  );
};

const createStyles = (c: AppColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: c.card,
  },
  errorCard: { backgroundColor: c.primarySoft, borderRadius: 12, padding: 14, marginBottom: 14 },
  errorText: { color: c.primary, fontSize: 13, lineHeight: 19 },
  retryButton: { minHeight: 36, justifyContent: 'center' },
  scrollView: {
    flex: 1,
    backgroundColor: c.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertsContainer: {
    flex: 1,
  },
  activeContainer: {
    flex: 1,
  },
  footerLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  footerLinkText: {
    fontSize: 13.5,
    color: c.textSecondary,
    fontWeight: '500',
  },
  notifyLinkText: {
    fontSize: 13.5,
    color: c.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  emptyMissionCard: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyMissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: c.text,
    marginBottom: 8,
  },
  emptyMissionDesc: {
    fontSize: 14,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  browseButton: {
    backgroundColor: c.action,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  browseButtonText: {
    color: c.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
export default RequestsScreen;
