import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DonorBottomNav, { DonorTab } from '../components/DonorBottomNav';
import DonorHeader from '../components/DonorHeader';
import { CardEntrance, TactilePressable } from '../components/Motion';
import IconBadge from '../components/IconBadge';
import CardArtwork from '../components/CardArtwork';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { AppColors } from '../theme/palette';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export interface EmergencyMatchData {
  requestId?: string; hospitalName: string; bloodGroup: string; distance: string;
  details: string; requiredUnits: number; status?: 'available' | 'en_route';
}
export interface BloodRequestItem {
  id: string; hospitalName: string; bloodGroup: string; priority: 'Emergency' | 'Critical' | 'Urgent';
  distance: string; status: 'available' | 'en_route'; requiredUnits?: number;
}
export interface DonorProfileData {
  name: string; initials: string; isVerified: boolean; bloodGroup: string; rhGroup: string;
  authorityVerified: boolean; lastDonationDate: string; nextEligibleStatus: string;
  qualificationInterval: string; totalDonations: number; monthlyGain: number;
  urgentRequestsCount: number; matchedRequestsCount: number; unreadNotificationsCount?: number;
  availableAlertsCount?: number;
  isEligible?: boolean;
}
interface DashboardData { donor: DonorProfileData; emergencyMatch: EmergencyMatchData | null; requests: BloodRequestItem[] }
interface HomeScreenProps {
  initialTab?: DonorTab; onNavigateToRequests?: () => void; onNavigateToBanks?: () => void;
  onNavigateToHistory?: () => void; onNavigateToProfile?: () => void;
  onNavigateToNotifications?: () => void; onOpenRequest?: (id?: string) => void; onLogout?: () => void;
}
function recordedDate(value: string) {
  if (!value || value === 'No donations yet') return 'Not recorded yet';
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date) : value;
}

export function HomeScreen({ onNavigateToRequests, onNavigateToBanks, onNavigateToHistory, onNavigateToProfile, onNavigateToNotifications, onOpenRequest, onLogout }: HomeScreenProps) {
  const { styles: s, colors } = useThemedStyles(createStyles);
  const { signOut } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null), [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false), [error, setError] = useState('');
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const result = await api.authGet<DashboardData>('/donors/home');
      if (!result.ok || !result.data?.donor) throw new Error('Dashboard unavailable');
      setData(result.data);
    } catch (failure: any) {
      setData(null);
      setError(failure?.status === 403 ? 'Your account cannot access the donor dashboard. Sign in with a donor account. Admin and staff accounts use their own portal.'
        : failure?.status === 401 ? 'Sign in with a donor account to view your dashboard.' : 'Unable to load your dashboard. Check your connection and try again.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const navigate = (tab: DonorTab) => {
    if (tab === 'Requests') onNavigateToRequests?.();
    if (tab === 'Banks') onNavigateToBanks?.();
    if (tab === 'History') onNavigateToHistory?.();
    if (tab === 'Profile') onNavigateToProfile?.();
  };
  const openRequest = (id?: string) => onOpenRequest ? onOpenRequest(id) : onNavigateToRequests?.();
  const donor = data?.donor;
  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
    <DonorHeader title="BloodLink" initials={donor?.initials || 'D'} onProfile={onNavigateToProfile} onNotifications={onNavigateToNotifications} notificationsCount={donor?.unreadNotificationsCount || 0} />
    {loading && !data ? <View style={s.center}><ActivityIndicator color={colors.primary} /><Text style={s.body}>Loading your donor record…</Text></View> : error ? <View style={s.center}><Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} /><Text accessibilityRole="alert" style={s.body}>{error}</Text><Pressable style={s.primaryButton} accessibilityRole="button" onPress={() => void load()}><Text style={s.primaryButtonText}>Try again</Text></Pressable><Pressable style={s.textAction} accessibilityRole="button" onPress={async () => { await signOut(); onLogout?.(); }}><Text style={s.link}>Back to sign in</Text></Pressable></View> : data && donor ? <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
      <View style={s.greeting}><Text style={s.eyebrow}>YOUR DONOR SPACE</Text><Text style={s.name}>{donor.name}</Text><Text style={s.body}>Keep your record up to date and review requests nearby.</Text></View>
      {data.emergencyMatch && <View style={s.priorityRequest}><View style={s.spread}><Text style={s.priorityLabel}>Priority request nearby</Text><Text style={s.meta}>{data.emergencyMatch.distance}</Text></View><Text style={s.requestTitle}>{data.emergencyMatch.hospitalName}</Text><Text style={s.body}>{data.emergencyMatch.bloodGroup} · {data.emergencyMatch.requiredUnits} {data.emergencyMatch.requiredUnits === 1 ? 'unit' : 'units'} requested</Text><Pressable accessibilityRole="button" accessibilityLabel={`Review request from ${data.emergencyMatch.hospitalName}`} style={s.priorityAction} onPress={() => openRequest(data.emergencyMatch!.requestId)}><Text style={s.link}>{data.emergencyMatch.status === 'en_route' ? 'View accepted request' : 'Review request'}</Text><Ionicons name="arrow-forward" size={17} color={colors.primary} /></Pressable></View>}
      <CardEntrance style={s.donorRecord}><CardArtwork /><View style={s.recordTop}><View style={s.bloodBlock}><Text style={s.bloodType}>{donor.bloodGroup}</Text></View><View style={s.flex}><Text style={s.sectionTitle}>Your donor record</Text><View style={s.verificationLine}><Ionicons name={donor.isVerified ? 'checkmark-circle-outline' : 'document-text-outline'} size={15} color={donor.isVerified ? colors.success : colors.textMuted} /><Text style={s.meta}>{donor.isVerified ? 'Blood group verified' : 'Blood group not yet verified'}</Text></View></View><Pressable onPress={onNavigateToProfile} accessibilityRole="button" accessibilityLabel="View your donor profile" style={s.iconButton}><Ionicons name="chevron-forward" size={19} color={colors.textMuted} /></Pressable></View>
        <View style={s.recordDates}><View style={s.flex}><View style={s.labelRow}><Ionicons name="calendar-outline" size={13} color={colors.textMuted} /><Text style={s.meta}>Last donation</Text></View><Text style={s.recordDate}>{recordedDate(donor.lastDonationDate)}</Text></View><View style={s.flex}><View style={s.labelRow}><Ionicons name="hourglass-outline" size={13} color={colors.textMuted} /><Text style={s.meta}>Recorded interval</Text></View><Text style={s.recordDate}>{recordedDate(donor.nextEligibleStatus)}</Text></View></View>
        <View style={s.recordNote}><Ionicons name="information-circle-outline" size={15} color={colors.textMuted} /><Text style={s.note}>The donation team will confirm your eligibility before collection.</Text></View>
      </CardEntrance>
      <CardEntrance delay={70} style={s.recordStats}><TactilePressable accessibilityRole="button" accessibilityLabel="View donation history" style={s.stat} onPress={onNavigateToHistory}><View style={s.statTop}><IconBadge name="heart-outline" small /><Ionicons name="arrow-up-right-box-outline" size={14} color={colors.textMuted} /></View><Text style={s.statValue}>{donor.totalDonations}</Text><Text style={s.meta}>Recorded donations</Text><Text style={s.statLink}>Your history <Ionicons name="arrow-forward" size={12} /></Text></TactilePressable><View style={s.statDivider} /><TactilePressable accessibilityRole="button" accessibilityLabel="Browse matched requests" style={s.stat} onPress={onNavigateToRequests}><View style={s.statTop}><IconBadge name="navigate-outline" tone="info" small /><Ionicons name="arrow-up-right-box-outline" size={14} color={colors.textMuted} /></View><Text style={s.statValue}>{donor.matchedRequestsCount}</Text><Text style={s.meta}>Matching requests</Text><Text style={s.statLink}>View requests <Ionicons name="arrow-forward" size={12} /></Text></TactilePressable></CardEntrance>
      <View style={s.sectionHeader}><View style={s.labelRow}><Ionicons name="pulse-outline" size={19} color={colors.primary} /><Text style={s.sectionTitle}>Requests for your group</Text></View><Pressable style={s.textAction} accessibilityRole="button" onPress={onNavigateToRequests}><Text style={s.link}>See all</Text></Pressable></View>
      {data.requests.length ? <View style={s.requestList}>{data.requests.slice(0, 3).map(request => <Pressable key={request.id} style={s.requestRow} accessibilityRole="button" accessibilityLabel={`View request from ${request.hospitalName}`} onPress={() => openRequest(request.id)}><Text style={s.requestGroup}>{request.bloodGroup}</Text><View style={s.flex}><Text style={s.listTitle}>{request.hospitalName}</Text><Text style={s.meta}>{request.distance}{request.requiredUnits ? ` · ${request.requiredUnits} units needed` : ''}</Text></View><Ionicons name="chevron-forward" size={17} color={colors.textMuted} /></Pressable>)}</View> : <View style={s.quietEmpty}><Ionicons name="water-outline" size={23} color={colors.textMuted} /><Text style={s.listTitle}>No matching requests right now</Text><Text style={s.body}>You can check your matching location and availability in Profile.</Text><Pressable style={s.textAction} accessibilityRole="button" onPress={onNavigateToProfile}><Text style={s.link}>Manage availability</Text></Pressable></View>}
      <TactilePressable style={s.findBank} accessibilityRole="button" onPress={onNavigateToBanks}><IconBadge name="business-outline" /><View style={s.flex}><Text style={s.sectionTitle}>Find a donation centre</Text><Text style={s.meta}>Locations, contact details and reported stock.</Text></View><Ionicons name="arrow-forward" size={19} color={colors.primary} /></TactilePressable>
    </ScrollView> : null}
    <DonorBottomNav activeTab="Home" onSelect={navigate} requestsCount={donor?.availableAlertsCount ?? data?.requests.filter(r=>r.status!=='en_route').length ?? 0} />
  </SafeAreaView>;
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, flex: { flex: 1, minWidth: 0 },
  content: { padding: 22, paddingBottom: 30 }, center: { flex: 1, padding: 30, justifyContent: 'center', alignItems: 'center', gap: 18 },
  greeting: { marginTop: 10, marginBottom: 25 }, eyebrow: { fontSize: 10, letterSpacing: 1.5, color: c.textMuted, fontWeight: '500', marginBottom: 9 },
  name: { fontSize: 28, lineHeight: 35, letterSpacing: -1, fontWeight: '600', color: c.text, marginBottom: 9 },
  body: { fontSize: 14, lineHeight: 22, color: c.textSecondary }, meta: { fontSize: 12, lineHeight: 19, color: c.textMuted },
  sectionTitle: { fontSize: 15, lineHeight: 22, letterSpacing: -0.25, fontWeight: '600', color: c.text },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  priorityRequest: { padding: 18, backgroundColor: c.primarySoft, borderRadius: 16, borderLeftWidth: 3, borderLeftColor: c.primary, marginBottom: 18 },
  priorityLabel: { color: c.primary, fontSize: 12, fontWeight: '600' }, requestTitle: { color: c.text, fontSize: 17, lineHeight: 24, fontWeight: '600', marginTop: 13, marginBottom: 5 },
  priorityAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginTop: 10 },
  donorRecord: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, overflow: 'hidden', boxShadow: '0 5px 18px rgba(20, 25, 21, 0.045)' },
  recordTop: { flexDirection: 'row', gap: 13, padding: 18, alignItems: 'center' }, bloodBlock: { width: 54, height: 58, backgroundColor: c.action, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bloodType: { fontSize: 26, fontWeight: '600', color: c.onPrimary, letterSpacing: -0.8 }, verificationLine: { flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 5, flexWrap: 'wrap' },
  iconButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  recordDates: { flexDirection: 'row', paddingHorizontal: 18, paddingBottom: 18, gap: 20 }, recordDate: { fontSize: 13, lineHeight: 20, color: c.text, fontWeight: '500', marginTop: 4 },
  recordNote: { backgroundColor: c.primarySoft, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border, paddingVertical: 12, paddingHorizontal: 18, flexDirection: 'row', gap: 7 }, note: { fontSize: 11, lineHeight: 17, color: c.textMuted, flex: 1 },
  recordStats: { flexDirection: 'row', paddingVertical: 22, marginBottom: 10, borderBottomWidth: 1, borderColor: c.border }, stat: { flex: 1, paddingHorizontal: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, flexWrap: 'wrap' }, statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  statValue: { fontSize: 27, lineHeight: 33, fontWeight: '500', letterSpacing: -1, color: c.text }, statLink: { fontSize: 11, color: c.primary, marginTop: 9, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: c.border, marginRight: 12 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5, gap: 10 },
  textAction: { minHeight: 44, justifyContent: 'center' }, link: { color: c.primary, fontSize: 13, fontWeight: '500' }, requestList: { marginBottom: 10 },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 17, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  requestGroup: { minWidth: 36, color: c.primary, fontSize: 20, fontWeight: '500' }, listTitle: { fontSize: 14, lineHeight: 21, fontWeight: '500', color: c.text },
  quietEmpty: { paddingVertical: 18, gap: 7 }, findBank: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.primarySoft, borderWidth: 1, borderColor: c.primary + '18', borderRadius: 16, marginTop: 18, padding: 17 },
  primaryButton: { backgroundColor: c.action, borderRadius: 8, minHeight: 46, paddingHorizontal: 24, justifyContent: 'center' }, primaryButtonText: { color: c.onPrimary, fontWeight: '600', fontSize: 14 },
});
