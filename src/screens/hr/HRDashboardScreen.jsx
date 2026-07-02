import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import hrService from '@/services/hrService';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';

const {
    buildDashboardSummary,
    filterPayrolls,
    getTechnicianInitials,
    technicianName,
} = require('./payrollUi');

const statusMeta = {
    draft: { label: 'Taslak', color: serviceOrange, bg: '#FFF4E5' },
    approved: { label: 'Bekliyor', color: serviceBlue, bg: '#EDF3FF' },
    paid: { label: 'Odendi', color: serviceGreen, bg: '#EAF9EF' },
    cancelled: { label: 'Iptal', color: serviceRed, bg: '#FDECEC' },
};

const money = (value) => Number(value || 0).toLocaleString('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
});

const formatRange = (start, end) => {
    const toLabel = (value) => {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return '-';
        return parsed.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
    };
    return `${toLabel(start)} - ${toLabel(end)}`;
};

const monthLabel = (date) => date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

const SummaryCard = ({ label, value, accent, icon, colors }) => (
    <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.summaryIcon, { backgroundColor: `${accent}15` }]}>
            <MaterialCommunityIcons name={icon} size={18} color={accent} />
        </View>
        <Text style={[styles.summaryValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
);

const PayrollRow = ({ payroll, onPress, colors }) => {
    const meta = statusMeta[payroll.status] || statusMeta.draft;
    return (
        <Pressable onPress={onPress} style={[styles.rowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.rowAvatar, { backgroundColor: `${serviceBlue}12` }]}>
                <Text style={styles.rowAvatarText}>{getTechnicianInitials(technicianName(payroll))}</Text>
            </View>

            <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                    <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                        {technicianName(payroll)}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                </View>

                <Text style={[styles.rowPeriod, { color: colors.textSecondary }]}>
                    {formatRange(payroll.period_start, payroll.period_end)}
                </Text>

                <View style={styles.rowBottom}>
                    <View style={styles.rowMetaBlock}>
                        <Text style={[styles.rowMetaLabel, { color: colors.textTertiary }]}>Prim</Text>
                        <Text style={[styles.rowMetaValue, { color: colors.text }]}>{money(payroll.total_premiums)}</Text>
                    </View>
                    <View style={styles.rowMetaBlock}>
                        <Text style={[styles.rowMetaLabel, { color: colors.textTertiary }]}>Kesinti</Text>
                        <Text style={[styles.rowMetaValue, { color: colors.text }]}>{money(payroll.total_deductions)}</Text>
                    </View>
                    <View style={styles.rowNetBlock}>
                        <Text style={[styles.rowMetaLabel, { color: colors.textTertiary }]}>Net</Text>
                        <Text style={[styles.rowNetValue, { color: colors.text }]}>{money(payroll.net_salary)}</Text>
                    </View>
                </View>
            </View>
        </Pressable>
    );
};

export default function HRDashboardScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const [payrolls, setPayrolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [search, setSearch] = useState('');

    const loadData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await hrService.getPayrolls();
            setPayrolls(Array.isArray(data) ? data : []);
        } catch (error) {
            Alert.alert('HR verileri alinamadi', error?.response?.data?.detail || 'Baglantinizi kontrol edip tekrar deneyin.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useFocusEffect(
        useCallback(() => {
            loadData(true);
        }, [loadData]),
    );

    const filtered = useMemo(
        () => filterPayrolls(payrolls, { selectedMonth, search }),
        [payrolls, search, selectedMonth],
    );

    const summary = useMemo(
        () => buildDashboardSummary(payrolls, selectedMonth),
        [payrolls, selectedMonth],
    );

    const shiftMonth = (delta) => {
        setSelectedMonth((prev) => {
            const next = new Date(prev);
            next.setMonth(next.getMonth() + delta);
            return next;
        });
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData(true);
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={serviceBlue} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
            >
                <View style={styles.header}>
                    <Pressable onPress={() => navigation.goBack()} style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
                    </Pressable>

                    <View style={styles.headerText}>
                        <Text style={[styles.title, { color: colors.text }]}>Maas ve Bordro</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Aylik bordrolari hizli yonet</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <Pressable onPress={() => navigation.navigate('PayrollTemplates')} style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                            <MaterialCommunityIcons name="playlist-edit" size={20} color={serviceBlue} />
                        </Pressable>
                        <Pressable onPress={() => navigation.navigate('PayrollCreate')} style={[styles.primaryIconButton, { backgroundColor: serviceBlue }]}>
                            <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
                        </Pressable>
                    </View>
                    </Pressable>
                </View>

                <View style={styles.monthRow}>
                    <Pressable onPress={() => shiftMonth(-1)} style={[styles.monthButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <MaterialCommunityIcons name="chevron-left" size={20} color={colors.text} />
                    </Pressable>
                    <View style={[styles.monthCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.monthLabelText, { color: colors.textSecondary }]}>Secili donem</Text>
                        <Text style={[styles.monthValueText, { color: colors.text }]}>{monthLabel(selectedMonth)}</Text>
                    </View>
                    <Pressable onPress={() => shiftMonth(1)} style={[styles.monthButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text} />
                    </Pressable>
                </View>

                <View style={styles.summaryRow}>
                    <SummaryCard label="Bekleyen" value={String(summary.pendingCount)} accent={serviceOrange} icon="clock-outline" colors={colors} />
                    <SummaryCard label="Odendi" value={String(summary.paidCount)} accent={serviceGreen} icon="cash-check" colors={colors} />
                    <SummaryCard label="Toplam Net" value={money(summary.totalNet)} accent={serviceBlue} icon="wallet-outline" colors={colors} />
                </View>

                <View style={[styles.searchCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="magnify" size={20} color={colors.textTertiary} />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Teknisyen ara"
                        placeholderTextColor={colors.textTertiary}
                        style={[styles.searchInput, { color: colors.text }]}
                    />
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Bordrolar</Text>
                    <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>{filtered.length} kayit</Text>
                </View>

                {loading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator color={serviceBlue} size="large" />
                    </View>
                ) : filtered.length ? (
                    filtered.map((payroll) => (
                        <PayrollRow
                            key={payroll.id}
                            payroll={payroll}
                            colors={colors}
                            onPress={() => navigation.navigate('PayrollDetail', { payrollId: payroll.id })}
                        />
                    ))
                ) : (
                    <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="file-document-outline" size={28} color={colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>Kayit bulunamadi</Text>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Bu ay veya arama kriterinde bordro yok.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    container: { paddingHorizontal: 16 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    primaryIconButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    headerText: { flex: 1, marginHorizontal: 12 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 24, fontWeight: '900' },
    subtitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
    monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    monthButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    monthCard: { flex: 1, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
    monthLabelText: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
    monthValueText: { fontSize: 16, fontWeight: '900' },
    summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    summaryCard: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 12, minHeight: 92 },
    summaryIcon: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    summaryValue: { fontSize: 18, fontWeight: '900' },
    summaryLabel: { fontSize: 12, fontWeight: '700', marginTop: 4 },
    searchCard: { borderWidth: 1, borderRadius: 16, minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 16 },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '600', paddingVertical: 0 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    sectionTitle: { fontSize: 17, fontWeight: '900' },
    sectionCount: { fontSize: 12, fontWeight: '700' },
    loadingWrap: { paddingVertical: 80, alignItems: 'center' },
    rowCard: { borderWidth: 1, borderRadius: 18, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
    rowAvatar: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    rowAvatarText: { color: serviceBlue, fontSize: 16, fontWeight: '900' },
    rowBody: { flex: 1 },
    rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
    rowName: { flex: 1, fontSize: 15, fontWeight: '800' },
    statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    statusPillText: { fontSize: 11, fontWeight: '800' },
    rowPeriod: { fontSize: 12, fontWeight: '600', marginBottom: 10 },
    rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowMetaBlock: { minWidth: 76 },
    rowNetBlock: { flex: 1, alignItems: 'flex-end' },
    rowMetaLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
    rowMetaValue: { fontSize: 12, fontWeight: '700' },
    rowNetValue: { fontSize: 14, fontWeight: '900' },
    emptyCard: { borderWidth: 1, borderRadius: 18, padding: 24, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '900', marginTop: 10 },
    emptyText: { fontSize: 13, textAlign: 'center', marginTop: 4 },
});


