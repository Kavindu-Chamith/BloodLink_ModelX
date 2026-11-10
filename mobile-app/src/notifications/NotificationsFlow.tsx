// src/notifications/NotificationsFlow.tsx
// Entry point of the Notification tab. App.tsx renders this for the 'Notifications' screen.
// Uses the app-wide theme and safe area providers.
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../profile/theme';
import { useNotifications } from './hooks/useNotifications';
import NotificationsScreen from './screens/NotificationsScreen';
import { DonorTab } from '../components/DonorBottomNav';

interface Props {
    onBack?: () => void;
    onViewRequest?: (requestId?: string) => void;
    onNavigateTab: (tab: DonorTab) => void;
    onNavigateToProfile: () => void;
}

function Inner(props: Props) {
    const { isDark, colors } = useTheme();
    const state = useNotifications();

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <NotificationsScreen state={state} {...props} />
        </View>
    );
}

export default function NotificationsFlow(props: Props) {
    return <Inner {...props} />;
}
