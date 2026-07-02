import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import hrService from '@/services/hrService';
import { serviceBlue, serviceGreen, serviceRed } from '@/theme/color';

const FILTERS = [
    { label: 'Tümü', value: 'all' },
    { label: 'Eklenti', value: 'addition' },
    { label: 'Kesinti', value: 'deduction' },
];

const money = (value) => Number(value || 0).toLocaleString('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
});

const TemplateRow = ({ item }) => {
    const { colors } = useTheme();
    const isAddition = item.type === 'addition';
    const color = isAddition ? serviceGreen : serviceRed;
    return (
        <View style={[styles.templateRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.templateIcon, { backgroundColor: `${color}16` }]}>
                <MaterialCommunityIcons name={isAddition ? 'plus-circle-outline' : 'minus-circle-outline'} size={24} color={color} />
            </View>
            <View style={styles.templateInfo}>
                <Text style={[styles.templateName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.templateMeta, { color: colors.textSecondary }]}>
                    {isAddition ? 'Eklenti' : 'Kesinti'} · {item.is_active ? 'Aktif' : 'Pasif'}
                </Text>
            </View>
            <Text style={[styles.templateAmount, { color }]}>{money(item.default_amount)}</Text>
        </View>
    );
};

export default function PayrollTemplatesScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const [templates, setTemplates] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadTemplates = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await hrService.getPayrollTemplates();
            setTemplates(data);
        } catch (error) {
            Alert.alert('Şablonlar alınamadı', error?.response?.data?.detail || 'Bağlantınızı kontrol edip tekrar deneyin.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    const stats = useMemo(() => ({
        total: templates.length,
        additions: templates.filter((item) => item.type === 'addition').length,
        deductions: templates.filter((item) => item.type === 'deduction').length,
    }), [templates]);

    const filtered = useMemo(() => {
        if (filter === 'all') return templates;
        return templates.filter((item) => item.type === filter);
    }, [filter, templates]);

    const onRefresh = () => {
        setRefreshing(true);
        loadTemplates(true);
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={serviceBlue} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.container, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 28 }]}
            >
                <View style={styles.header}>
                    <Pressable onPress={() => navigation.goBack()} style={[styles.iconButton, { borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
                    </Pressable>
                    <View style={styles.headerText}>
                        <Text style={[styles.title, { color: colors.text }]}>Bordro Şablonları</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Prim ve kesinti kalemleri</Text>
                    </View>
                    <Pressable onPress={() => loadTemplates()} style={[styles.iconButton, { borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="refresh" size={21} color={serviceBlue} />
                    </Pressable>
                </View>

                <View style={styles.summaryGrid}>
                    <View style={[styles.summaryBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.summaryValue, { color: colors.text }]}>{stats.total}</Text>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Toplam</Text>
                    </View>
                    <View style={[styles.summaryBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.summaryValue, { color: serviceGreen }]}>{stats.additions}</Text>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Eklenti</Text>
                    </View>
                    <View style={[styles.summaryBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.summaryValue, { color: serviceRed }]}>{stats.deductions}</Text>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Kesinti</Text>
                    </View>
                </View>

                <View style={styles.filterRow}>
                    {FILTERS.map((item) => (
                        <Pressable
                            key={item.value}
                            onPress={() => setFilter(item.value)}
                            style={[
                                styles.filterChip,
                                {
                                    backgroundColor: filter === item.value ? serviceBlue : colors.surface,
                                    borderColor: filter === item.value ? serviceBlue : colors.border,
                                },
                            ]}
                        >
                            <Text style={[styles.filterText, { color: filter === item.value ? '#FFFFFF' : colors.text }]}>{item.label}</Text>
                        </Pressable>
                    ))}
                </View>

                {loading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator color={serviceBlue} size="large" />
                    </View>
                ) : filtered.length ? (
                    filtered.map((item) => <TemplateRow key={item.id} item={item} />)
                ) : (
                    <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="playlist-remove" size={34} color={colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>Şablon yok</Text>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Bu filtrede bordro şablonu bulunamadı.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    container: { paddingHorizontal: 18 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    iconButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    headerText: { flex: 1, marginHorizontal: 12 },
    title: { fontSize: 24, fontWeight: '900' },
    subtitle: { fontSize: 13, fontWeight: '700', marginTop: 3 },
    summaryGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    summaryBox: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 14 },
    summaryValue: { fontSize: 24, fontWeight: '900' },
    summaryLabel: { fontSize: 12, fontWeight: '800', marginTop: 4 },
    filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    filterText: { fontSize: 13, fontWeight: '900' },
    loadingWrap: { paddingVertical: 70, alignItems: 'center' },
    templateRow: { borderWidth: 1, borderRadius: 18, padding: 13, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    templateIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    templateInfo: { flex: 1 },
    templateName: { fontSize: 15, fontWeight: '900' },
    templateMeta: { fontSize: 12, fontWeight: '700', marginTop: 5 },
    templateAmount: { fontSize: 15, fontWeight: '900' },
    emptyBox: { borderWidth: 1, borderRadius: 20, alignItems: 'center', padding: 24 },
    emptyTitle: { fontSize: 16, fontWeight: '900', marginTop: 10 },
    emptyText: { fontSize: 13, textAlign: 'center', marginTop: 5 },
});
