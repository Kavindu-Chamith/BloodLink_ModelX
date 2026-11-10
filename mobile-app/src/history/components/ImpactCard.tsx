// src/history/components/ImpactCard.tsx
import IconBadge from '../../components/IconBadge';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CardEntrance } from '../../components/Motion';
import CardArtwork from '../../components/CardArtwork';
import { ColorPalette, radius, useTheme } from '../../profile/theme';
import { HistorySummary } from '../types/history';
import { formatVolume } from '../utils/historyFormat';

interface Props {
    summary: HistorySummary;
}

export default function ImpactCard({ summary }: Props) {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <CardEntrance style={styles.card}><CardArtwork />
            <View style={styles.headerRow}>
                <View style={styles.heading}><IconBadge name="heart-circle-outline" small /><Text style={styles.title}>Your donation record</Text></View>
                <View style={styles.pill}>
                    <Text style={styles.pillText}>{summary.bloodGroup}</Text>
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.statsRow}>
                <Stat styles={styles} value={String(summary.totalDonations)} label="Recorded donations" icon="water-outline" />
                <Stat styles={styles} value={formatVolume(summary.totalVolumeMl)} label="Recorded volume" icon="flask-outline" />
            </View>
        </CardEntrance>
    );
}

function Stat({
    value,
    label,
    icon,
    styles,
}: {
    value: string;
    label: string;
    icon: 'water-outline' | 'flask-outline';
    styles: ReturnType<typeof createStyles>;
}) {
    return (
        <View style={styles.stat}><IconBadge name={icon} small tone={icon === 'water-outline' ? 'primary' : 'info'} />
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                {value}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1}>
                {label}
            </Text>
        </View>
    );
}

const createStyles = (c: ColorPalette) =>
    StyleSheet.create({
        card: {
            backgroundColor: c.card,
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: '0 5px 18px rgba(20, 25, 21, 0.04)',
            borderWidth: 1,
            borderColor: c.border,
            padding: 16,
        },
        heading: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
        headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        title: { fontSize: 15, fontWeight: '500', color: c.text, letterSpacing: -0.2, flexShrink: 1 },
        pill: {
            backgroundColor: c.primarySoft,
            borderRadius: radius.pill,
            paddingHorizontal: 9,
            paddingVertical: 5,
        },
        pillText: { color: c.text, fontWeight: '500', fontSize: 10 },
        divider: { height: 1, backgroundColor: c.border, marginVertical: 14 },
        statsRow: { flexDirection: 'row' },
        stat: { flex: 1, alignItems: 'flex-start', paddingVertical: 5, gap: 7 },
        statValue: { fontSize: 35, fontWeight: '500', letterSpacing: -1.2, color: c.primary },
        statLabel: { fontSize: 12, fontWeight: '400', color: c.textMuted, marginTop: 5 },
    });
