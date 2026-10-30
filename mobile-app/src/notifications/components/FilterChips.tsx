// src/notifications/components/FilterChips.tsx
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { ColorPalette, radius, useTheme } from '../../profile/theme';

export interface FilterChip {
    key: string;
    label: string;
    count: number;
}

interface Props {
    filters: FilterChip[];
    selected: string;
    onSelect: (key: string) => void;
}

export default function FilterChips({ filters, selected, onSelect }: Props) {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <ScrollView
            testID="notification-filters"
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
            style={styles.scroll}
        >
            {filters.map((f) => {
                const active = f.key === selected;
                return (
                    <Pressable
                        key={f.key}
                        onPress={() => onSelect(f.key)}
                        style={[styles.chip, active && styles.chipActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        aria-pressed={active}
                    >
                        <Text style={[styles.text, active && styles.textActive]}>
                            {f.label} ({f.count})
                        </Text>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

const createStyles = (c: ColorPalette) =>
    StyleSheet.create({
        scroll: { flexGrow: 0, flexShrink: 0, height: 44, minHeight: 44 },
        row: { paddingHorizontal: 20, gap: 10 },
        chip: { minHeight: 44, justifyContent: 'center',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: radius.pill,
            backgroundColor: c.infoSoft,
        },
        chipActive: { backgroundColor: c.action },
        text: { fontSize: 12, fontWeight: '500', color: c.text },
        textActive: { color: c.onPrimary },
    });
