// src/requests/RequestsFlow.tsx
// Entry point of the Blood Requests feature. App.tsx renders this for the 'Requests' screen.
import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DonorTab } from '../components/DonorBottomNav';
import { RequestsScreen } from './screens/RequestsScreen';
import { RequestTabType } from './types/requests';
import { useTheme } from '../theme/ThemeContext';

interface RequestsFlowProps {
  initialTab?: RequestTabType;
  initialRequestId?: string;
  onBack?: () => void;
  onNavigateTab?: (tab: DonorTab) => void;
  onNavigateToProfile?: () => void;
}

export default function RequestsFlow({
  initialTab = 'alerts',
  initialRequestId,
  onBack,
  onNavigateTab,
  onNavigateToProfile,
}: RequestsFlowProps) {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RequestsScreen
        initialTab={initialTab}
        initialRequestId={initialRequestId}
        onNavigateTab={(tab) => {
          if (tab === 'Home' && onBack) {
            onBack();
          } else if (onNavigateTab) {
            onNavigateTab(tab);
          }
        }}
        onNavigateToProfile={onNavigateToProfile}
      />
    </View>
  );
}
export { RequestsFlow };
