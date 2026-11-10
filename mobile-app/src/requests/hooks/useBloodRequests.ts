// src/requests/hooks/useBloodRequests.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Linking } from 'react-native';
import { RequestTabType, RequestsData, AlertRequestItem } from '../types/requests';
import {
  fetchRequestsData,
  respondToAlertRequest,
  notifyMissionCoordinator,
} from '../services/requestsService';

export function useBloodRequests(initialTab: RequestTabType = 'alerts', initialRequestId?: string) {
  const [activeTab, setActiveTab] = useState<RequestTabType>(initialTab);
  const [data, setData] = useState<RequestsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);
  const openedRequestId = useRef<string | undefined>(undefined);

  // Modals state
  const [selectedRequest, setSelectedRequest] = useState<AlertRequestItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCoordinatorModalOpen, setIsCoordinatorModalOpen] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const result = await fetchRequestsData();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load blood requests at this moment.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!initialRequestId) { openedRequestId.current = undefined; return; }
    if (!data || openedRequestId.current === initialRequestId) return;
    openedRequestId.current = initialRequestId;
    const request = data.alerts.find(item => item.id === initialRequestId);
    if (request) { setSelectedRequest(request); setIsDetailModalOpen(true); }
    else if (data.activeMission?.id === initialRequestId) setActiveTab('active');
    else setError('This request is no longer available. Browse the current alerts below.');
  }, [initialRequestId, data]);

  const handleOpenDetails = (request: AlertRequestItem) => {
    setResponseError(null);
    setSelectedRequest(request);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailModalOpen(false);
  };

  const handleRespondToRequest = async (request: AlertRequestItem, status: 'accepted' | 'declined' = 'accepted') => {
    if (responding) return;
    setResponding(true);
    setResponseError(null);
    try {
      const result = await respondToAlertRequest(request.id, status);
      if (!result.success) throw new Error(result.message || 'Unable to save your response.');
      setIsDetailModalOpen(false);
      setActiveTab(status === 'accepted' ? 'active' : 'alerts');
      await loadData(false);
    } catch (e) {
      setResponseError(e instanceof Error ? e.message : 'Unable to register your response. Please try again.');
    } finally { setResponding(false); }
  };

  const handleOpenDirections = () => {
    if (!data?.activeMission) return;
    const query = encodeURIComponent(`${data.activeMission.hospitalName}, Sri Lanka`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() => {
      Alert.alert('Map Unavailable', 'Unable to launch map application.');
    });
  };

  const handleCallCoordinator = () => {
    const phone = data?.activeMission?.coordinatorPhone;
    if (!phone) { Alert.alert('Contact unavailable', 'The institution has not provided a coordinator phone number.'); return; }
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Unable to call', 'Please try again on a device with a phone application.'));
  };

  const handleSendCoordinatorNotification = async (reason: string) => {
    if (data?.activeMission) {
      try {
        await notifyMissionCoordinator(data.activeMission.id, reason);
        setIsCoordinatorModalOpen(false);
        Alert.alert('Notification Sent', 'The hospital coordinator has been notified of your status.');
      } catch {
        Alert.alert('Error', 'Unable to send notification to coordinator. Please try again.');
      }
    }
  };

  return {
    activeTab,
    setActiveTab,
    data,
    loading,
    refreshing,
    error,
    responseError,
    responding,
    reload: () => loadData(false),
    refresh: () => loadData(true),
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
  };
}

export type BloodRequestsState = ReturnType<typeof useBloodRequests>;
