import { showAlert } from '../utils/showAlert';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { AppColors } from '../theme/palette';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DonorBottomNav, { DonorTab } from '../components/DonorBottomNav';
import DonorHeader from '../components/DonorHeader';
import { CardEntrance, TactilePressable } from '../components/Motion';
import IconBadge from '../components/IconBadge';
import CardArtwork from '../components/CardArtwork';
import { BanksData, BloodBank, BloodStock, fetchBloodBanks } from './services/banksService';

interface Props { onNavigateTab: (tab: DonorTab) => void; onProfile: () => void }
const groups = ['O-', 'A-', 'B+', 'O+', 'A+', 'B-', 'AB+', 'AB-'];
const stockTones = (c: AppColors) => ({
  Critical: { ink: c.danger, fill: c.action, bg: c.dangerSoft, border: c.border },
  Low: { ink: c.warning, fill: '#945400', bg: c.warningSoft, border: c.border },
  Normal: { ink: c.success, fill: '#087B52', bg: c.successSoft, border: c.border },
});

async function openLink(url: string) {
  try { await Linking.openURL(url); } catch { showAlert('Unable to open', 'Please try again on a device with a maps or phone application.'); }
}
function openMap(bank: BloodBank) {
  const query = bank.latitude != null && bank.longitude != null ? `${bank.latitude},${bank.longitude}` : `${bank.name}, ${bank.district || ''}, Sri Lanka`;
  void openLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
}
function StockPill({ stock }: { stock: BloodStock }) {
  const { styles: s, colors, isDark } = useThemedStyles(createStyles);
  const tones = stockTones(colors);
  const tone = tones[stock.status] || tones.Normal;
  return <View style={[s.stockPill, { backgroundColor: tone.bg, borderColor: tone.border }]}><Text style={[s.stockPillText, { color: tone.ink }]}>{stock.bloodGroup}: {stock.units} u{stock.status !== 'Normal' ? ` (${stock.status})` : ''}</Text></View>;
}

export default function BanksScreen({ onNavigateTab, onProfile }: Props) {
  const { styles: s, colors, isDark } = useThemedStyles(createStyles);
  const tones = stockTones(colors);
  const [data, setData] = useState<BanksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bloodGroup, setBloodGroup] = useState('All');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try { setData(await fetchBloodBanks()); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load blood banks.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const districts = useMemo(() => Array.from(new Set(['All', ...(data?.banks.map(b => b.district).filter((d): d is string => !!d) || [])])), [data]);
  const banks = useMemo(() => (data?.banks || []).filter(bank => {
    const matchingStocks = bank.stocks.filter(stock => bloodGroup === 'All' || stock.bloodGroup === bloodGroup);
    return (district === 'All' || bank.district === district)
      && `${bank.name} ${bank.district || ''} ${bank.address || ''}`.toLowerCase().includes(query.trim().toLowerCase())
      && (bloodGroup === 'All' || matchingStocks.length > 0)
      && (!criticalOnly || matchingStocks.some(stock => stock.status === 'Critical'));
  }), [data, district, query, bloodGroup, criticalOnly]);
  const selected = banks.find(b => b.id === selectedId) || banks[0];
  const stockGroups = selected ? groups.map(group => selected.stocks.find(stock => stock.bloodGroup === group)).filter((stock): stock is BloodStock => !!stock) : [];
  const updated = selected?.stocks.map(stock => new Date(stock.updatedAt).getTime()).filter(Number.isFinite) || [];
  const updatedAt = updated.length ? new Date(Math.max(...updated)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  const clearFilters = () => { setQuery(''); setDistrict('All'); setBloodGroup('All'); setCriticalOnly(false); };

  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
    <DonorHeader title="Blood banks" initials={data?.donorInitials || 'D'} onProfile={onProfile} />
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}>
      <View style={s.networkRow}><View style={{ flex: 1 }}><Text style={s.pageTitle}>Find a centre</Text><Text style={s.subtitle}>Verified institutions. Real contact details.</Text></View><IconBadge name="map-outline" tone="info" /></View>
      <View style={s.search}><Ionicons name="search-outline" size={18} color={colors.textMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search city or blood bank" placeholderTextColor={colors.textMuted} style={s.input} accessibilityLabel="Search blood banks" /><TactilePressable onPress={() => setFiltersOpen(true)} style={s.filterButton} accessibilityRole="button" accessibilityLabel="Filter blood banks"><Ionicons name="options-outline" size={15} color={colors.primary} /><Text style={s.filterText}>Filter{bloodGroup !== 'All' || criticalOnly ? ' •' : ''}</Text></TactilePressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{districts.map(city => <TactilePressable key={city} onPress={() => { setDistrict(city); setSelectedId(null); }} accessibilityRole="button" accessibilityState={{ selected: district === city }} aria-pressed={district === city} style={[s.chip, district === city && s.chipActive]}><Text style={[s.chipText, district === city && { color: colors.onPrimary }]}>{city}</Text></TactilePressable>)}</ScrollView>
      {error ? <View style={s.error}><Text style={s.subtitle}>{error}</Text><Pressable onPress={() => load()} accessibilityRole="button"><Text style={s.link}>Try again</Text></Pressable></View> : null}
      {loading && !data ? <ActivityIndicator style={{ padding: 50 }} color={colors.primary} /> : <>
        {selected ? <>
          <CardEntrance key={selected.id} style={s.selectedCentre}><CardArtwork /><View style={s.row}><Ionicons name="location-outline" size={16} color={colors.primary} /><Text style={s.eyebrow}>SELECTED CENTRE</Text></View><Text style={s.selectedName}>{selected.name}</Text><Text style={s.subtitle}>{selected.address || selected.district || 'Sri Lanka'}{selected.distanceKm != null ? ` · ${selected.distanceKm} km away` : ''}</Text><TactilePressable onPress={() => openMap(selected)} style={s.directionsAction} accessibilityRole="button" accessibilityLabel={`Open map for ${selected.name}`}><Text style={s.link}>Open directions</Text><Ionicons name="arrow-up-right-box-outline" size={17} color={colors.primary} /></TactilePressable></CardEntrance>
          <View style={s.sectionRow}><Text style={s.sectionTitle}>Reported stock at this centre</Text>{updatedAt && <Text style={s.small}>As of {updatedAt}</Text>}</View>
          {stockGroups.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.stocks}>{stockGroups.map(stock => { const tone = tones[stock.status] || tones.Normal; return <View key={stock.bloodGroup} style={[s.stockTile, { backgroundColor: colors.card, borderColor: tone.border }]}><View style={s.row}><Ionicons name="water-outline" size={14} color={tone.ink} /><Text style={[s.stockGroup, { color: colors.text }]}>{stock.bloodGroup}</Text></View><Text style={[s.stockUnits, { color: colors.text }]}>{stock.units}<Text style={s.stockUnitLabel}> units</Text></Text><Text style={[s.stockStatusText, { color: tone.ink }]}>{stock.status}</Text></View>; })}</ScrollView> : <Text style={s.subtitle}>Stock levels have not been reported by this center.</Text>}
        </> : <View style={s.empty}><Ionicons name="business-outline" size={32} color={colors.textMuted} /><Text style={s.emptyTitle}>No centers found</Text><Text style={s.subtitle}>Try another district or adjust your filters.</Text><Pressable onPress={clearFilters} accessibilityRole="button" style={s.clearButton}><Text style={s.link}>Clear filters</Text></Pressable></View>}
        <View style={s.sectionRow}><View style={s.row}><Ionicons name="business-outline" size={18} color={colors.primary} /><Text style={s.sectionTitle}>Institutions ({banks.length})</Text></View><Pressable onPress={clearFilters} accessibilityRole="button" style={s.viewAll}><Text style={s.link}>Reset filters</Text></Pressable></View>
        {banks.map(bank => <View key={bank.id} style={[s.bankCard, selected?.id === bank.id && { borderColor: colors.primary }]}>
          <View style={s.row}>
            <TactilePressable onPress={() => setSelectedId(bank.id)} accessibilityRole="button" accessibilityLabel={`Select ${bank.name}`} accessibilityState={{ selected: bank.id === selected?.id }} aria-pressed={bank.id === selected?.id} style={{ flex: 1 }}>
              <View style={s.row}>
                <View style={[s.typePill, s.row]}><Ionicons name={bank.type === 'bloodbank' ? 'water-outline' : 'medical-outline'} size={13} color={colors.primary} /><Text style={s.typeText}>{bank.type === 'bloodbank' ? 'Blood bank' : 'Hospital'}</Text></View>
                {bank.distanceKm != null && <Text style={s.small}>{bank.distanceKm} km</Text>}
              </View>
              <Text style={[s.bankName, { marginTop: 7 }]}>{bank.name}</Text>
              <View style={[s.row, { marginTop: 4 }]}><Ionicons name="checkmark-circle-outline" size={12} color={colors.success} /><Text style={s.small}>Verified · {bank.district || 'Sri Lanka'}</Text></View>
            </TactilePressable>
            {bank.phone && <TactilePressable onPress={() => { void openLink(`tel:${bank.phone}`); }} accessibilityRole="button" accessibilityLabel={`Call ${bank.name}`} style={s.callButton}><Ionicons name="call-outline" size={18} color={colors.success} /></TactilePressable>}
          </View>
          {bank.stocks.length > 0 && <View style={s.stockSummary}><Text style={s.small}>Stocks:</Text>{bank.stocks.slice(0, 3).map(stock => <StockPill key={stock.bloodGroup} stock={stock} />)}</View>}
          {selected?.id === bank.id && <View style={s.bankDetails}>{bank.address && <Text style={s.subtitle}>{bank.address}</Text>}<Pressable onPress={() => openMap(bank)} accessibilityRole="button" style={s.mapLink}><Ionicons name="navigate-outline" size={14} color={colors.primary} /><Text style={s.link}>Get directions</Text></Pressable></View>}
        </View>)}
      </>}
    </ScrollView>
    <DonorBottomNav activeTab="Banks" onSelect={onNavigateTab} />
    <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}><View style={s.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={() => setFiltersOpen(false)} accessibilityLabel="Close filters" /><SafeAreaView edges={['bottom']} style={s.sheet}><View style={s.sectionRow}><Text style={s.emptyTitle}>Filter blood banks</Text><Pressable onPress={() => setFiltersOpen(false)} style={s.zoomButton} accessibilityRole="button" accessibilityLabel="Close filters"><Ionicons name="close" size={22} color={colors.text} /></Pressable></View><Text style={s.subtitle}>Blood group</Text><View style={s.filterGroups}>{['All', ...groups].map(group => <Pressable key={group} onPress={() => setBloodGroup(group)} style={[s.chip, bloodGroup === group && s.chipActive]} accessibilityRole="button" accessibilityState={{ selected: bloodGroup === group }} aria-pressed={bloodGroup === group}><Text style={[s.chipText, bloodGroup === group && { color: colors.onPrimary }]}>{group}</Text></Pressable>)}</View><View style={s.sectionRow}><Text style={s.bankName}>Critical stock only</Text><Switch value={criticalOnly} onValueChange={setCriticalOnly} trackColor={{ true: '#C5162E' }} accessibilityLabel="Show only critical stock" /></View><Pressable onPress={() => setFiltersOpen(false)} style={s.applyButton} accessibilityRole="button"><Text style={s.applyText}>Show {banks.length} centers</Text></Pressable></SafeAreaView></View></Modal>
  </SafeAreaView>;
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.background,
  },
  content: {
    padding: 22,
    paddingTop: 12,
    gap: 12,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.success,
  },
  redDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.action,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1,
    color: c.textMuted,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: c.textMuted,
    marginTop: 3,
  },
  small: {
    lineHeight: 17,
    fontSize: 12,
    color: c.textMuted,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    padding: 6,
    borderRadius: 12,
    backgroundColor: c.surface,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    paddingLeft: 12,
    paddingRight: 6,
    minHeight: 48,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: c.text,
    paddingVertical: 10,
  },
  filterButton: { flexDirection: 'row', alignItems: 'center', gap: 5,
    minHeight: 44,
    justifyContent: 'center',
    padding: 9,
    borderRadius: 12,
    backgroundColor: c.primarySoft,
  },
  filterText: {
    color: c.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: c.card,
  },
  chipActive: {
    backgroundColor: c.action,
    borderColor: c.border,
  },
  chipText: {
    fontSize: 12,
    color: c.textSecondary,
  },
  pageTitle: { fontSize: 27, lineHeight: 34, fontWeight: '500', letterSpacing: -0.8, color: c.text },
  selectedCentre: { padding: 18, backgroundColor: c.primarySoft, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: c.border, marginTop: 6 },
  selectedName: { fontSize: 19, lineHeight: 26, fontWeight: '500', color: c.text, marginTop: 12, letterSpacing: -0.3 },
  directionsAction: { flexDirection: 'row', minHeight: 44, alignItems: 'center', justifyContent: 'space-between', marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border, paddingTop: 8 },
  zoomButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bankName: {
    fontSize: 14,
    fontWeight: '600',
    color: c.text,
    lineHeight: 20,
  },
  criticalBadge: {
    backgroundColor: c.primarySoft,
    padding: 8,
    borderRadius: 8,
  },
  criticalText: {
    color: c.primary,
    fontSize: 10,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: c.text,
    flexShrink: 1,
  },
  stocks: {
    gap: 8,
  },
  stockTile: {
    minWidth: 75,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  stockGroup: {
    fontSize: 12,
    fontWeight: '600',
  },
  stockUnits: {
    fontSize: 19,
    fontWeight: '500',
  },
  stockStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stockStatusText: {
    fontSize: 10,
    letterSpacing: 0.5,
    color: c.textMuted,
    fontWeight: '500',
  },
  stockUnitLabel: { fontSize: 10, color: c.textMuted },
  link: {
    fontSize: 12,
    color: c.primary,
    fontWeight: '600',
  },
  viewAll: {
    minHeight: 44,
    justifyContent: 'center',
  },
  bankCard: {
    padding: 14,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
  },
  typePill: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: c.surface,
  },
  typeText: {
    fontSize: 10,
    color: c.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockSummary: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: c.border,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
  },
  stockPill: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  stockPillText: {
    fontSize: 11,
  },
  bankDetails: {
    marginTop: 10,
    gap: 6,
  },
  mapLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 44,
  },
  empty: {
    alignItems: 'center',
    padding: 28,
    gap: 10,
    backgroundColor: c.card,
    borderRadius: 18,
  },
  emptyTitle: {
    fontSize: 17,
    color: c.text,
    fontWeight: '500',
  },
  clearButton: {
    padding: 12,
  },
  error: {
    padding: 14,
    backgroundColor: c.primarySoft,
    borderRadius: 12,
    gap: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  filterGroups: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  applyButton: {
    borderRadius: 12,
    backgroundColor: c.action,
    padding: 16,
    alignItems: 'center',
  },
  applyText: {
    fontSize: 14,
    color: c.onPrimary,
    fontWeight: '500',
  },
});
