// src/history/screens/HistoryScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ColorPalette, radius, useTheme } from '../../profile/theme';
import { getInitials } from '../../profile/utils/format';
import { DonationCard, ImpactCard } from '../components';
import { HistoryState } from '../hooks/useDonationHistory';
import { fetchDonorRecordUrl } from '../services/historyService';
import { DonationRecord } from '../types/history';
import DonorBottomNav, { DonorTab } from '../../components/DonorBottomNav';
import DonorHeader from '../../components/DonorHeader';

interface Props {
    state: HistoryState;
    onNavigateTab: (tab: DonorTab) => void;
    onNavigateToProfile: () => void;
}

async function openUrl(url: string) {
    try {
        await Linking.openURL(url);
    } catch {
        throw new Error('Could not open the document. Please try again later.');
    }
}

export default function HistoryScreen({ state, onNavigateTab, onNavigateToProfile }: Props) {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { data, loading, refreshing, error } = state;
    const [downloading, setDownloading] = useState(false);
    const [actionMessage, setActionMessage] = useState<string | null>(null);

    const handleViewCertificate = async (record: DonationRecord) => {
        setActionMessage(null);
        if (!record.certificateUrl) {
            setActionMessage(
                record.status === 'pending'
                    ? 'This donation is still waiting for verification.'
                    : 'The certificate for this donation is not available yet.',
            );
            return;
        }
        try { await openUrl(record.certificateUrl); }
        catch (e) { setActionMessage(e instanceof Error ? e.message : 'Could not open the certificate.'); }
    };

    const handleDownloadRecord = async () => {
        setDownloading(true);
        setActionMessage(null);
        try {
            const url = await fetchDonorRecordUrl();
            if (!url) {
                setActionMessage('Your official donor record will be available once it is generated.');
                return;
            }
            await openUrl(url);
        } catch (e) {
            setActionMessage(e instanceof Error ? e.message : 'Download failed. Please try again.');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <DonorHeader title="History" initials={data ? getInitials(data.donorName) : 'D'} onProfile={onNavigateToProfile} colors={colors} />

            {loading && !data ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : error && !data ? (
                <View style={styles.center}>
                    <Text style={styles.errorTitle}>Could not load your history</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable style={styles.retry} onPress={state.reload} accessibilityRole="button">
                        <Text style={styles.retryText}>Try again</Text>
                    </Pressable>
                </View>
            ) : data ? (
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={state.refresh} tintColor={colors.primary} />
                    }
                >
                    <ImpactCard summary={data.summary} />

                    <View style={styles.logHeader}>
                        <Text style={styles.logTitle}>DONATION LOG</Text>
                        <Text style={styles.logCount}>{data.records.length} recorded</Text>
                    </View>

                    {data.records.length === 0 ? (
                        <View style={styles.empty}>
                            <Ionicons name="water-outline" size={36} color={colors.textMuted} />
                            <Text style={styles.emptyTitle}>No donations recorded yet</Text>
                            <Text style={styles.emptyText}>
                                Your verified donations will appear here after you donate at a blood bank.
                            </Text>
                        </View>
                    ) : (
                        data.records.map((record) => (
                            <DonationCard key={record.id} record={record} onViewCertificate={handleViewCertificate} />
                        ))
                    )}

                    {actionMessage && <Text accessibilityRole="alert" style={styles.actionMessage}>{actionMessage}</Text>}
                    <Pressable
                        onPress={handleDownloadRecord}
                        disabled={downloading}
                        style={[styles.downloadButton, downloading && { opacity: 0.6 }]}
                        accessibilityRole="button"
                        accessibilityLabel="Download official donor record as PDF"
                    >
                        {downloading ? (
                            <ActivityIndicator color={colors.text} />
                        ) : (
                            <>
                                <Ionicons name="document-text-outline" size={20} color={colors.text} />
                                <Text style={styles.downloadText}>Download Official Donor Record (PDF)</Text>
                            </>
                        )}
                    </Pressable>
                </ScrollView>
            ) : null}
            <DonorBottomNav activeTab="History" onSelect={onNavigateTab} colors={colors} />
        </SafeAreaView>
    );
}

const createStyles = (c: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: c.background },
        actionMessage: { backgroundColor: c.warningSoft, color: c.text, borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 18 },
        titleRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 12,
        },
        title: { fontSize: 28, fontWeight: '800', color: c.text },
        avatar: {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: c.action,
            alignItems: 'center',
            justifyContent: 'center',
        },
        avatarText: { color: c.onPrimary, fontWeight: '800', fontSize: 16 },
        content: { padding: 20, paddingTop: 14, paddingBottom: 24, gap: 12 },
        center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
        errorTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 6 },
        errorText: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginBottom: 16 },
        retry: { backgroundColor: c.action, borderRadius: radius.md, paddingHorizontal: 24, paddingVertical: 12 },
        retryText: { color: c.onPrimary, fontWeight: '700' },
        logHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 10,
            paddingHorizontal: 4,
        },
        logTitle: { fontSize: 12, fontWeight: '600', color: c.text, letterSpacing: 0.5 },
        logCount: { fontSize: 11, color: c.textMuted },
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
        downloadButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            backgroundColor: c.card,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: c.border,
            minHeight: 44,
            paddingHorizontal: 10,
            marginTop: 6,
        },
        downloadText: { fontSize: 12, fontWeight: '500', color: c.text, flexShrink: 1 },
    });
