// src/history/HistoryFlow.tsx
// Entry point of the Donation History feature. App.tsx renders this for the 'History' screen.
// Uses the app-wide theme and safe area providers.
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../profile/theme';
import { useDonationHistory } from './hooks/useDonationHistory';
import HistoryScreen from './screens/HistoryScreen';
import { DonorTab } from '../components/DonorBottomNav';

interface Props { onNavigateTab: (tab: DonorTab) => void; onNavigateToProfile: () => void }

function Inner(props: Props) {
  const { isDark, colors } = useTheme();
  const state = useDonationHistory();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <HistoryScreen state={state} {...props} />
    </View>
  );
}

export default function HistoryFlow(props: Props) {
  return <Inner {...props} />;
}
