import { showAlert } from '../../utils/showAlert';
// src/notifications/screens/NotificationsScreen.tsx
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Pressable,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ColorPalette, radius, useTheme } from '../../profile/theme';
import { FilterChips, NotificationCard } from '../components';
import { NotificationsState } from '../hooks/useNotifications';
import { AppNotification } from '../types/notifications';
import { FILTERS } from '../utils/kindConfig';
import DonorBottomNav, { DonorTab } from '../../components/DonorBottomNav';
import DonorHeader from '../../components/DonorHeader';

interface Props {
    state: NotificationsState;
    onNavigateTab: (tab: DonorTab) => void;
    onNavigateToProfile: () => void;
    onBack?: () => void; // shows a back arrow when provided
    onViewRequest?: (requestId?: string) => void; // opens the Requests screen (owned by another module)
}

async function openUrl(url: string | undefined, unavailableMessage: string): Promise<string | null> {
    if (!url) {
        return unavailableMessage;
    }
    try {
        await Linking.openURL(url);
        return null;
    } catch {
        return 'Could not open the document. Please try again later.';
    }
}

export default function NotificationsScreen({ state, onBack, onViewRequest, onNavigateTab, onNavigateToProfile }: Props) {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { items, unreadCount, loading, refreshing, error } = state;
    const [filter, setFilter] = useState<string>('all');
    const [actionMessage, setActionMessage] = useState<string | null>(null);

    const chips = useMemo(
        () =>
            FILTERS.map((f) => ({
                key: f.key,
                label: f.label,
                count: f.key === 'all' ? items.length : items.filter((n) => n.category === f.key).length,
            })),
        [items],
    );

    const visible = useMemo(
        () => (filter === 'all' ? items : items.filter((n) => n.category === filter)),
        [items, filter],
    );

    const handleMarkAll = async () => {
        try {
            await state.markAllRead();
        } catch {
            showAlert('Could not update', 'Please check your connection and try again.');
        }
    };

    const handleViewRequest = (n: AppNotification) => {
        state.markRead(n.id);
        if (onViewRequest) onViewRequest(n.requestId);
        else showAlert('Requests', 'The Requests screen is not connected here yet.');
    };

    const handleShare = async (n: AppNotification) => {
        if (!n.honor) return;
        try {
            await Share.share({
                message: `${n.honor.title} – verified by ${n.honor.verifiedBy}. I'm a BloodLink donor! 🩸`,
            });
        } catch {
            /* user closed the share sheet */
        }
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <DonorHeader title="Home" onBack={onBack} onProfile={onNavigateToProfile} colors={colors} />
            <View style={styles.topRow}>
                <View style={styles.titleWrap}>
                    <Text style={styles.title}>Notifications</Text>
                    {unreadCount > 0 && (
                        <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>{unreadCount} New</Text>
                        </View>
                    )}
                </View>
                <Pressable
                    onPress={handleMarkAll}
                    disabled={unreadCount === 0}
                    style={[styles.markAll, unreadCount === 0 && { opacity: 0.4 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Mark all notifications as read"
                >
                    <MaterialCommunityIcons name="check-all" size={18} color={colors.primary} />
                    <Text style={styles.markAllText}>Mark all read</Text>
                </Pressable>
            </View>

            {actionMessage && <Pressable onPress={() => setActionMessage(null)} accessibilityRole="button" accessibilityLabel="Dismiss document message" style={styles.actionMessage}><Text style={styles.errorText} accessibilityRole="alert">{actionMessage}</Text></Pressable>}
            {loading && items.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : error && items.length === 0 ? (
                <View style={styles.center}>
                    <Text style={styles.errorTitle}>Could not load notifications</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable style={styles.retry} onPress={state.reload} accessibilityRole="button">
                        <Text style={styles.retryText}>Try again</Text>
                    </Pressable>
                </View>
            ) : (
                <>
                    <FilterChips filters={chips} selected={filter} onSelect={setFilter} />
                    <ScrollView
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={state.refresh} tintColor={colors.primary} />
                        }
                    >
                        {visible.length === 0 ? (
                            <View style={styles.empty}>
                                <Ionicons name="notifications-off-outline" size={36} color={colors.textMuted} />
                                <Text style={styles.emptyTitle}>No notifications here</Text>
                                <Text style={styles.emptyText}>New alerts and updates will appear in this list.</Text>
                            </View>
                        ) : (
                            visible.map((n) => (
                                <NotificationCard
                                    key={n.id}
                                    notification={n}
                                    onPress={(item) => state.markRead(item.id)}
                                    onViewRequest={handleViewRequest}
                                    onOpenLabPdf={async (item) => {
                                        state.markRead(item.id);
                                        setActionMessage(await openUrl(item.labReport?.labPdfUrl, 'The lab report PDF is not available yet.'));
                                    }}
                                    onOpenDoctorNote={async (item) => {
                                        state.markRead(item.id);
                                        setActionMessage(await openUrl(item.labReport?.doctorNoteUrl, 'The doctor note is not available yet.'));
                                    }}
                                    onViewGuidelines={async (item) => {
                                        state.markRead(item.id);
                                        setActionMessage(await openUrl(item.guidelinesUrl, 'Donation guidelines have not been attached to this notification.'));
                                    }}
                                    onShareHonor={handleShare}
                                />
                            ))
                        )}
                    </ScrollView>
                </>
            )}
            <DonorBottomNav activeTab="Home" onSelect={onNavigateTab} colors={colors} />
        </SafeAreaView>
    );
}

const createStyles = (c: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: c.background },
        actionMessage: { backgroundColor: c.warningSoft, marginHorizontal: 20, marginBottom: 12, borderRadius: 12, padding: 12 },
        topRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 12,
            gap: 10,
        },
        backButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
        title: { fontSize: 17, fontWeight: '700', color: c.text },
        newBadge: { backgroundColor: c.action, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 3 },
        newBadgeText: { color: c.onPrimary, fontWeight: '700', fontSize: 10 },
        markAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
        markAllText: { color: c.primary, fontWeight: '600', fontSize: 12 },
        content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 12 },
        center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
        errorTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 6 },
        errorText: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginBottom: 16 },
        retry: { backgroundColor: c.action, borderRadius: radius.md, paddingHorizontal: 24, paddingVertical: 12 },
        retryText: { color: c.onPrimary, fontWeight: '700' },
        empty: {
            alignItems: 'center',
            backgroundColor: c.card,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: c.border,
            padding: 28,
            gap: 8,
        },
        emptyTitle: { fontSize: 16, fontWeight: '700', color: c.text },
        emptyText: { fontSize: 14, color: c.textMuted, textAlign: 'center' },
    });
