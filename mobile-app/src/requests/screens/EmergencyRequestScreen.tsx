import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AppColors } from '../../theme/palette';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DonorBottomNav, { DonorTab } from '../../components/DonorBottomNav';
import { AlertRequestItem } from '../types/requests';

interface Props {
  request: AlertRequestItem;
  responding: boolean;
  error: string | null;
  onBack: () => void;
  onRespond: (request: AlertRequestItem, status: 'accepted' | 'declined') => void;
  onNavigateTab: (tab: DonorTab) => void;
  requestsCount?: number;
}

export default function EmergencyRequestScreen({ request, responding, error, onBack, onRespond, onNavigateTab, requestsCount }: Props) {
  const { styles: s, colors } = useThemedStyles(createStyles);
  const urgent = request.isUrgent || request.type === 'urgent';
  const group = request.bloodGroup.split(' ')[0];
  const accepted = request.acceptedDonors;
  const progress = accepted == null ? null : Math.min(1, accepted / Math.max(1, request.unitsNeeded));
  const openMaps = async () => {
    try { await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${request.hospitalName}, ${request.address || 'Sri Lanka'}`)}`); }
    catch { Alert.alert('Unable to open maps', 'Please try again.'); }
  };
  const share = async () => {
    try { await Share.share({ message: `Blood donation request: ${request.bloodGroup}, ${request.unitsNeeded} units needed at ${request.hospitalName}. ${request.address || ''} Reference: ${request.id}.` }); }
    catch { Alert.alert('Unable to share', 'Please try again.'); }
  };

  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <View style={s.hero}>
        <View style={s.heroDecor} />
        <View style={s.heroTop}><Pressable onPress={onBack} disabled={responding} style={s.circle} accessibilityRole="button" accessibilityLabel="Back to requests"><Ionicons name="chevron-back" size={22} color={colors.onPrimary} /></Pressable><View style={s.emergencyPill}><View style={s.amberDot} /><Text style={s.emergencyText}>{urgent ? 'EMERGENCY REQUEST' : 'BLOOD DONATION REQUEST'}</Text></View><Pressable onPress={share} style={s.circle} accessibilityRole="button" accessibilityLabel="Share blood request"><Ionicons name="share-social-outline" size={20} color={colors.onPrimary} /></Pressable></View>
        <View style={s.heroBody}><View style={s.bloodBadge}><Text style={s.bloodGroup}>{group}</Text><Text style={s.bloodCaption}>{group === 'O-' ? 'UNIVERSAL' : 'BLOOD GROUP'}</Text></View><View style={{ flex: 1 }}><View style={s.row}><View style={s.greenDot} /><Text style={s.heroSub}>{urgent ? 'Immediate donation requested' : 'Your donation can help'}</Text></View><Text style={s.heroTitle}>{group} {urgent ? 'Urgently Needed' : 'Donation Needed'}</Text><Text style={s.reference}>Ref: #{request.id} · {request.timeAgo}</Text></View></View>
      </View>
      <View style={s.body}>
        <View style={s.card}><View style={s.hospitalRow}><View style={s.hospitalIcon}><Ionicons name="business-outline" size={23} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={s.hospital}>{request.hospitalName}</Text>{request.verifiedInstitution && <View style={[s.row, { marginTop: 4 }]}><Ionicons name="shield-checkmark" size={12} color={colors.success} /><Text style={s.verified}>Verified Medical Institution</Text></View>}</View>{request.department && <View style={s.department}><Text style={s.departmentText}>{request.department}</Text></View>}</View><View style={s.divider} /><View style={s.locationRow}><Ionicons name="location-outline" size={15} color={colors.primary} /><Text style={s.locationText}>{request.distance}{request.address ? ` · ${request.address}` : ''}</Text><Pressable onPress={openMaps} accessibilityRole="button" style={s.mapsButton}><Text style={s.mapText}>Open Maps</Text></Pressable></View></View>
        <View style={s.card}><Text style={s.eyebrow}>CLINICAL REQUIREMENTS</Text>
          <View style={s.requirement}><View style={[s.detailIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name="water" size={16} color={colors.primary} /></View><Text style={s.detailLabel}>Blood Group</Text><Text style={s.detailValue}>{request.bloodGroup}</Text></View>
          <View style={s.divider} />
          <View style={s.requirement}><View style={[s.detailIcon, { backgroundColor: colors.warningSoft }]}><Ionicons name="water-outline" size={16} color={colors.warning} /></View><Text style={s.detailLabel}>Units Needed</Text><View style={{ alignItems: 'flex-end' }}><Text style={[s.detailValue, { maxWidth: '100%' }]}>{request.unitsNeeded} Units Total</Text>{accepted != null && <Text style={s.hint}>{Math.max(0, request.unitsNeeded - accepted)} still required</Text>}</View></View>
          {progress != null && <View style={s.progressSection}><View style={s.track}><View style={[s.progress, { width: `${progress * 100}%` }]} /></View><View style={s.between}><Text style={s.hint}>{accepted} Donor{accepted === 1 ? '' : 's'} Accepted</Text><Text style={s.hint}>Goal: {request.unitsNeeded} Units</Text></View></View>}
          <View style={s.divider} />
          <View style={s.requirement}><View style={[s.detailIcon, { backgroundColor: colors.infoSoft }]}><Ionicons name="time-outline" size={16} color={colors.info} /></View><Text style={s.detailLabel}>Respond By</Text><Text style={s.detailValue}>{urgent ? 'As soon as possible' : 'Contact the coordinator'}</Text></View>
          <View style={s.divider} />
          <View style={s.requirement}><View style={[s.detailIcon, { backgroundColor: colors.infoSoft }]}><Ionicons name="document-text-outline" size={16} color={colors.info} /></View><Text style={s.detailLabel}>Case Severity</Text><View style={s.severity}><Text style={s.severityText}>{request.priority || (urgent ? 'Emergency' : 'Routine')}</Text></View></View>
          {request.patientCase && <Text style={s.caseNote}>{request.patientCase}</Text>}
        </View>
        {error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
        <Pressable disabled={responding} onPress={() => onRespond(request, 'accepted')} style={[s.accept, responding && { opacity: 0.6 }]} accessibilityRole="button">{responding ? <ActivityIndicator color={colors.onPrimary} /> : <><Ionicons name="checkmark" size={19} color={colors.onPrimary} /><Text style={s.acceptText}>Accept Request & Coordinate</Text></>}</Pressable>
        <Pressable disabled={responding} onPress={() => onRespond(request, 'declined')} style={s.decline} accessibilityRole="button"><Ionicons name="close" size={17} color={colors.textMuted} /><Text style={s.declineText}>Unable to Donate Right Now</Text></Pressable>
        <Text style={s.guidance}>Only donate if you are feeling well and meet eligibility criteria.</Text>
      </View>
    </ScrollView>
    <DonorBottomNav activeTab="Requests" onSelect={onNavigateTab} requestsCount={requestsCount} />
  </SafeAreaView>;
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.background,
  },
  scroll: {
    paddingBottom: 20,
  },
  hero: {
    backgroundColor: '#BD1230',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    padding: 20,
    paddingBottom: 30,
    overflow: 'hidden',
  },
  heroDecor: {
    position: 'absolute',
    width: 260,
    height: 260,
    backgroundColor: '#D52A42',
    borderRadius: 130,
    right: -50,
    top: -90,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  amberDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FCD34D',
  },
  emergencyText: {
    fontSize: 10,
    fontWeight: '700',
    color: c.onPrimary,
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 20,
  },
  bloodBadge: {
    width: 76,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bloodGroup: {
    fontSize: 32,
    fontWeight: '700',
    color: c.action,
  },
  bloodCaption: {
    fontSize: 9,
    color: c.action,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  greenDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#6EE7B7',
  },
  heroSub: {
    fontSize: 12,
    color: '#FFDFE5',
  },
  heroTitle: {
    color: c.onPrimary,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '700',
    marginVertical: 4,
  },
  reference: {
    fontSize: 12,
    color: '#FFD3DC',
  },
  body: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: c.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
  },
  hospitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hospitalIcon: {
    width: 38,
    height: 44,
    borderRadius: 10,
    backgroundColor: c.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hospital: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  verified: {
    color: c.success,
    fontSize: 11,
  },
  department: {
    maxWidth: 88,
    borderRadius: 6,
    backgroundColor: c.surface,
    padding: 7,
  },
  departmentText: {
    lineHeight: 16,
    fontSize: 11,
    color: c.textMuted,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: c.border,
    marginVertical: 13,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: c.textMuted,
  },
  mapsButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  mapText: {
    fontSize: 12,
    color: c.primary,
    fontWeight: '600',
  },
  eyebrow: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    flex: 1,
    fontSize: 13,
    color: c.textSecondary,
  },
  detailValue: {
    maxWidth: '54%',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: c.text,
    textAlign: 'right',
  },
  hint: {
    fontSize: 11,
    color: c.textMuted,
    marginTop: 3,
  },
  progressSection: {
    marginTop: 10,
  },
  track: {
    backgroundColor: c.surface,
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progress: {
    backgroundColor: c.action,
    height: 7,
    borderRadius: 4,
  },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  severity: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: c.primarySoft,
  },
  severityText: {
    color: c.primary,
    fontSize: 11,
  },
  caseNote: {
    color: c.textMuted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 14,
  },
  accept: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: c.action,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  acceptText: {
    color: c.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  decline: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  declineText: {
    color: c.textSecondary,
    fontSize: 13,
  },
  guidance: {
    color: c.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  error: {
    color: c.primary,
    fontSize: 12,
    lineHeight: 18,
  },
});
