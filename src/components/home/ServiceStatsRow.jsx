import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';
import { computeServiceStats } from '@/utils/serviceStats';

const STAT_DEFS = [
    {
        key: 'total',
        label: 'Toplam',
        colorKey: 'primary',
    },
    {
        key: 'pending',
        label: 'Bekleyen',
        colorKey: 'warning',
    },
    {
        key: 'active',
        label: 'Aktif',
        colorKey: 'info',
    },
    {
        key: 'done',
        label: 'Tamamlandi',
        colorKey: 'success',
    },
];

export default function ServiceStatsRow({ services = [] }) {
    const { colors } = useTheme();

    const counts = useMemo(() => computeServiceStats(services), [services]);

    const statValues = {
        total: counts.total,
        pending: counts.pending,
        active: counts.active,
        done: counts.completed,
    };

    return (
        <View style={styles.row}>
            {STAT_DEFS.map((def) => {
                const color = colors[def.colorKey] || colors.primary;
                const value = statValues[def.key] ?? 0;

                return (
                    <View
                        key={def.key}
                        style={[
                            styles.card,
                            {
                                backgroundColor: `${color}18`,
                                borderColor: `${color}32`,
                            },
                        ]}
                    >
                        <Text style={[styles.value, { color }]}>{value}</Text>
                        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
                            {def.label}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap: spacing.xs + 2,
        paddingHorizontal: spacing.gutter,
        marginBottom: spacing.m,
    },
    card: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        paddingVertical: spacing.s + 2,
        paddingHorizontal: spacing.xs,
        alignItems: 'center',
        justifyContent: 'center',
    },
    value: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.3,
        lineHeight: 21,
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
        textAlign: 'center',
    },
});
