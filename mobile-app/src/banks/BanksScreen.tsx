import { useThemedStyles } from '../theme/useThemedStyles';
import type { AppColors } from '../theme/palette';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DonorBottomNav, { DonorTab } from '../components/DonorBottomNav';
import DonorHeader from '../components/DonorHeader';
import { BanksData, BloodBank, BloodStock, fetchBloodBanks } from './services/banksService';

interface Props { onNavigateTab: (tab: DonorTab) => void; onProfile: () => void }
const groups = ['O-', 'A-', 'B+', 'O+', 'A+', 'B-', 'AB+', 'AB-'];
const stockTones = (c: AppColors) => ({
  Critical: { ink: c.danger, fill: c.action, bg: c.dangerSoft, border: c.border },
  Low: { ink: c.warning, fill: '#945400', bg: c.warningSoft, border: c.border },
  Normal: { ink: c.success, fill: '#087B52', bg: c.successSoft, border: c.border },
});

async function openLink(url: string) {
  try { await Linking.openURL(url); } catch { Alert.alert('Unable to open', 'Please try again on a device with a maps or phone application.'); }
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
  const [district, setDistrict] = useState('Ratnapura');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bloodGroup, setBloodGroup] = useState('All');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [zoom, setZoom] = useState(1);
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try { setData(await fetchBloodBanks()); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load blood banks.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const districts = useMemo(() => Array.from(new Set(['All', 'Ratnapura', 'Colombo', 'Kandy', 'Galle', ...(data?.banks.map(b => b.district).filter((d): d is string => !!d) || [])])), [data]);
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
    <DonorHeader title="Blood Banks" initials={data?.donorInitials || 'D'} onProfile={onProfile} />
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}>
      <View style={s.networkRow}><View style={{ flex: 1 }}><View style={s.row}><View style={s.greenDot} /><Text style={s.eyebrow}>NATIONAL BLOOD NETWORK</Text></View><Text style={s.subtitle}>Find verified centers in your area</Text></View><View style={s.locationPill}><Ionicons name="location-outline" size={12} color={colors.textMuted} /><Text style={s.small}>{district === 'Ratnapura' ? 'Sabaragamuwa' : district === 'All' ? 'Sri Lanka' : district}</Text></View></View>
      <View style={s.search}><Ionicons name="search-outline" size={18} color={colors.textMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search city or blood bank" placeholderTextColor={colors.textMuted} style={s.input} accessibilityLabel="Search blood banks" /><Pressable onPress={() => setFiltersOpen(true)} style={s.filterButton} accessibilityRole="button" accessibilityLabel="Filter blood banks"><Text style={s.filterText}>Filter{bloodGroup !== 'All' || criticalOnly ? ' •' : ''}</Text></Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{districts.map(city => <Pressable key={city} onPress={() => { setDistrict(city); setSelectedId(null); }} accessibilityRole="button" accessibilityState={{ selected: district === city }} aria-pressed={district === city} style={[s.chip, district === city && s.chipActive]}><Text style={[s.chipText, district === city && { color: colors.onPrimary }]}>{city}</Text></Pressable>)}</ScrollView>
      {error ? <View style={s.error}><Text style={s.subtitle}>{error}</Text><Pressable onPress={() => load()} accessibilityRole="button"><Text style={s.link}>Try again</Text></Pressable></View> : null}
      {loading && !data ? <ActivityIndicator style={{ padding: 50 }} color={colors.primary} /> : <>
        {selected ? <>
          <View style={s.map} accessibilityLabel="Schematic overview of blood banks in the selected area">
            <View style={[s.mapDrawing, { transform: [{ scale: zoom }] }]} pointerEvents="none"><View style={s.park} /><View style={s.river} />{[15, 40, 70].map(left => <View key={left} style={[s.roadVertical, { left: `${left}%` }]} />)}{[32, 62].map(top => <View key={top} style={[s.roadHorizontal, { top: `${top}%` }]} />)}<View style={s.mainRoad} /></View>
            <View style={s.mapLabel}><View style={s.redDot} /><Text style={s.mapLabelText}>{banks.length} verified center{banks.length === 1 ? '' : 's'}</Text></View>
            <View style={s.zoom}><Pressable disabled={zoom >= 1.6} onPress={() => setZoom(z => Math.min(1.6, z + 0.2))} style={s.zoomButton} accessibilityRole="button" accessibilityLabel="Zoom in"><Ionicons name="add" size={20} color={colors.textMuted} /></Pressable><Pressable disabled={zoom <= 1} onPress={() => setZoom(z => Math.max(1, z - 0.2))} style={s.zoomButton} accessibilityRole="button" accessibilityLabel="Zoom out"><Ionicons name="remove" size={20} color={colors.textMuted} /></Pressable></View>
            {banks.slice(0, 5).map((bank, i) => <Pressable key={bank.id} onPress={() => setSelectedId(bank.id)} hitSlop={12} style={[s.marker, { left: `${Math.max(10, Math.min(85, 20 + i * 15 + (zoom - 1) * (i - 2) * 20))}%`, top: 66 + (i % 2) * 30 }, selected.id === bank.id && s.markerSelected]} accessibilityRole="button" accessibilityLabel={`Show ${bank.name}`}><Ionicons name="add" size={16} color={colors.onPrimary} /></Pressable>)}
            <Pressable onPress={() => openMap(selected)} style={s.mapPreview} accessibilityRole="button" accessibilityLabel={`Open map for ${selected.name}`}><View style={{ flex: 1 }}><Text style={s.bankName} numberOfLines={1}>{selected.name}</Text><Text style={s.small}>{selected.distanceKm != null ? `${selected.distanceKm} km away · ` : ''}Open in Maps ↗</Text></View>{selected.stocks.some(stock => stock.status === 'Critical') && <View style={s.criticalBadge}><Text style={s.criticalText}>Critical Need</Text></View>}</Pressable>
            <Text style={s.schematic}>Area overview · schematic</Text>
          </View>
          <View style={s.sectionRow}><Text style={s.sectionTitle}>Stock Levels at Selected Center</Text>{updatedAt && <Text style={s.small}>As of {updatedAt}</Text>}</View>
          {stockGroups.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.stocks}>{stockGroups.map(stock => { const tone = tones[stock.status] || tones.Normal; return <View key={stock.bloodGroup} style={[s.stockTile, { backgroundColor: tone.bg, borderColor: tone.border }]}><Text style={[s.stockGroup, { color: tone.ink }]}>{stock.bloodGroup}</Text><Text style={[s.stockUnits, { color: tone.ink }]}>{stock.units} u</Text><View style={[s.stockStatus, { backgroundColor: tone.fill }]}><Text style={s.stockStatusText}>{stock.status === 'Normal' ? 'GOOD' : stock.status.toUpperCase()}</Text></View></View>; })}</ScrollView> : <Text style={s.subtitle}>Stock levels have not been reported by this center.</Text>}
        </> : <View style={s.empty}><Ionicons name="business-outline" size={32} color={colors.textMuted} /><Text style={s.emptyTitle}>No centers found</Text><Text style={s.subtitle}>Try another district or adjust your filters.</Text><Pressable onPress={clearFilters} accessibilityRole="button" style={s.clearButton}><Text style={s.link}>Clear filters</Text></Pressable></View>}
        <View style={s.sectionRow}><Text style={s.sectionTitle}>Verified Blood Banks ({banks.length})</Text><Pressable onPress={clearFilters} accessibilityRole="button" style={s.viewAll}><Text style={s.link}>View All</Text></Pressable></View>
        {banks.map(bank => <View key={bank.id} style={[s.bankCard, selected?.id === bank.id && { borderColor: colors.primary }]}>
          <View style={s.row}>
            <Pressable onPress={() => setSelectedId(bank.id)} accessibilityRole="button" accessibilityLabel={`Select ${bank.name}`} accessibilityState={{ selected: bank.id === selected?.id }} aria-pressed={bank.id === selected?.id} style={{ flex: 1 }}>
              <View style={s.row}>
                <View style={s.typePill}><Text style={s.typeText}>{bank.type === 'bloodbank' ? 'BLOOD BANK' : 'HOSPITAL'}</Text></View>
                {bank.distanceKm != null && <Text style={s.small}>{bank.distanceKm} km</Text>}
              </View>
              <Text style={[s.bankName, { marginTop: 7 }]}>{bank.name}</Text>
              <View style={[s.row, { marginTop: 4 }]}><Ionicons name="checkmark-circle-outline" size={12} color={colors.success} /><Text style={s.small}>Verified · {bank.district || 'Sri Lanka'}</Text></View>
            </Pressable>
            {bank.phone && <Pressable onPress={() => { void openLink(`tel:${bank.phone}`); }} accessibilityRole="button" accessibilityLabel={`Call ${bank.name}`} style={s.callButton}><Ionicons name="call-outline" size={18} color={colors.success} /></Pressable>}
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
    padding: 20,
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
    borderRadius: 14,
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
  filterButton: {
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
    borderRadius: 20,
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
  map: {
    height: 240,
    borderRadius: 20,
    backgroundColor: c.mapBackground,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.border,
  },
  mapDrawing: {
    backgroundColor: c.mapBackground,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  park: {
    position: 'absolute',
    right: -30,
    top: -20,
    width: 125,
    height: 240,
    backgroundColor: c.mapPark,
    transform: [{ rotate: '24deg' }],
  },
  river: {
    position: 'absolute',
    width: '130%',
    height: 15,
    backgroundColor: c.mapRiver,
    borderColor: c.border,
    borderWidth: 2,
    top: 48,
    left: -30,
    transform: [{ rotate: '-8deg' }],
  },
  roadVertical: {
    position: 'absolute',
    top: -40,
    height: 310,
    width: 6,
    backgroundColor: c.mapRoad,
    transform: [{ rotate: '-5deg' }],
  },
  roadHorizontal: {
    position: 'absolute',
    left: -30,
    width: '130%',
    height: 5,
    backgroundColor: c.mapRoad,
    transform: [{ rotate: '-10deg' }],
  },
  mainRoad: {
    position: 'absolute',
    width: '130%',
    left: -30,
    top: 110,
    height: 5,
    backgroundColor: c.mapMainRoad,
    borderWidth: 1,
    borderColor: c.mapRoad,
    transform: [{ rotate: '-15deg' }],
  },
  mapLabel: {
    maxWidth: '60%',
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: c.card,
    borderRadius: 15,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mapLabelText: {
    fontSize: 11,
    color: c.textSecondary,
    fontWeight: '600',
  },
  zoom: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.card,
  },
  marker: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 12,
    backgroundColor: c.action,
    borderWidth: 2,
    borderColor: c.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerSelected: {
    borderWidth: 3,
    width: 28,
    height: 28,
    borderRadius: 14,
    boxShadow: '0 0 0 4px rgba(208,28,54,0.15)',
  },
  mapPreview: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    right: 10,
    padding: 12,
    backgroundColor: c.card,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  schematic: {
    position: 'absolute',
    bottom: 4,
    right: 10,
    fontSize: 10,
    color: c.textMuted,
  },
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
    borderRadius: 15,
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
    fontWeight: '700',
  },
  stockStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stockStatusText: {
    fontSize: 10,
    letterSpacing: 0.5,
    color: c.onPrimary,
    fontWeight: '700',
  },
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
    borderRadius: 16,
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
    fontWeight: '700',
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
    fontWeight: '700',
  },
});
