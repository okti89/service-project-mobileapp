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
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import hrService from '@/services/hrService';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';

const {
    buildDashboardSummary,
    filterPayrolls,
    filterPayrollsForUser,
} = require('./payrollUi');

const statusMeta = {
    draft: { label: 'Taslak', color: serviceOrange, bg: '#FFF4E5' },
    approved: { label: 'Onayli', color: serviceBlue, bg: '#EDF3FF' },
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
        return parsed.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    return `${toLabel(start)} - ${toLabel(end)}`;
};

const monthLabel = (date) => date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

const PayrollCard = ({ payroll, colors, onPress }) => {
    const meta = statusMeta[payroll?.status] || statusMeta.draft;
    return (
        <Pressable onPress={onPress} style={[styles.payrollCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.payrollTop}>
                <View style={[styles.payrollIcon, { backgroundColor: `${meta.color}15` }]}>
                    <MaterialCommunityIcons name="file-document-outline" size={20} color={meta.color} />
                </View>
                <View style={styles.payrollInfo}>
                    <Text style={[styles.payrollTitle, { color: colors.text }]}>{formatRange(payroll.period_start, payroll.period_end)}</Text>
                    <Text style={[styles.payrollMeta, { color: colors.textSecondary }]}>Bordro #{payroll.id}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                </View>
            </View>

            <View style={styles.payrollAmounts}>
                <View>
                    <Text style={[styles.amountLabel, { color: colors.textTertiary }]}>Prim</Text>
                    <Text style={[styles.amountValue, { color: colors.text }]}>{money(payroll.total_premiums)}</Text>
                </View>
                <View>
                    <Text style={[styles.amountLabel, { color: colors.textTertiary }]}>Kesinti</Text>
                    <Text style={[styles.amountValue, { color: colors.text }]}>{money(payroll.total_deductions)}</Text>
                </View>
                <View style={styles.netBlock}>
                    <Text style={[styles.amountLabel, { color: colors.textTertiary }]}>Net</Text>
                    <Text style={[styles.netValue, { color: colors.text }]}>{money(payroll.net_salary)}</Text>
                </View>
            </View>
        </Pressable>
    );
};

export default function MyPayrollsScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { userInfo } = useAuth();
    const [payrolls, setPayrolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [showAllHistory, setShowAllHistory] = useState(false);

    const loadData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await hrService.getPayrolls();
            const rows = filterPayrollsForUser(Array.isArray(data) ? data : [], userInfo);
            setPayrolls(rows);
        } catch (error) {
            Alert.alert('Bordrolar alinamadi', error?.response?.data?.detail || 'Baglantinizi kontrol edip tekrar deneyin.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userInfo]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useFocusEffect(
        useCallback(() => {
            loadData(true);
        }, [loadData]),
    );

    const visiblePayrolls = useMemo(() => {
        const rows = showAllHistory
            ? payrolls
            : filterPayrolls(payrolls, { selectedMonth, search: '' });
        return [...rows].sort((a, b) => String(b.period_start || '').localeCompare(String(a.period_start || '')));
    }, [payrolls, selectedMonth, showAllHistory]);

    const summary = useMemo(
        () => buildDashboardSummary(showAllHistory ? payrolls : visiblePayrolls, showAllHistory ? null : selectedMonth),
        [payrolls, selectedMonth, showAllHistory, visiblePayrolls],
    );

    const shiftMonth = (delta) => {
        setSelectedMonth((prev) => {
            const next = new Date(prev);
            next.setMonth(next.getMonth() + delta);
            return next;
        });
        setShowAllHistory(false);
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
                        <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
                    </Pressable>
                    <View style={styles.headerText}>
                        <Text style={[styles.title, { color: colors.text }]}>Bordrolarim</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Maas gecmisini ve detaylarini gor</Text>
                    </View>
                    <Pressable onPress={() => loadData()} style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <MaterialCommunityIcons name="refresh" size={20} color={serviceBlue} />
                    </Pressable>
                </View>

                <LinearGradient
                    colors={isDark ? ['#24314F', '#182238'] : ['#0B4DA2', '#0877D9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.hero}
                >
                    <Text style={styles.heroLabel}>{showAllHistory ? 'Tum gecmis net odeme' : 'Secili donem net odeme'}</Text>
                    <Text style={styles.heroValue}>{money(summary.totalNet)}</Text>
                    <View style={styles.heroStats}>
                        <View style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{summary.paidCount}</Text>
                            <Text style={styles.heroStatLabel}>Odendi</Text>
                        </View>
                        <View style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{summary.pendingCount}</Text>
                            <Text style={styles.heroStatLabel}>Bekleyen</Text>
                        </View>
                    </View>
                </LinearGradient>

                <View style={styles.monthRow}>
                    <Pressable onPress={() => shiftMonth(-1)} style={[styles.monthButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <MaterialCommunityIcons name="chevron-left" size={20} color={colors.text} />
                    </Pressable>
                    <Pressable
                        onPress={() => setShowAllHistory(false)}
                        style={[
                            styles.monthCard,
                            {
                                backgroundColor: showAllHistory ? colors.surface : `${serviceBlue}12`,
                                borderColor: showAllHistory ? colors.border : serviceBlue,
                            },
                        ]}
                    >
                        <Text style={[styles.monthLabelText, { color: colors.textSecondary }]}>Donem</Text>
                        <Text style={[styles.monthValueText, { color: colors.text }]}>{monthLabel(selectedMonth)}</Text>
                    </Pressable>
                    <Pressable onPress={() => shiftMonth(1)} style={[styles.monthButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text} />
                    </Pressable>
                </View>

                <View style={styles.filterRow}>
                    <Pressable
                        onPress={() => setShowAllHistory(false)}
                        style={[styles.filterChip, { backgroundColor: !showAllHistory ? serviceBlue : colors.surface, borderColor: !showAllHistory ? serviceBlue : colors.border }]}
                    >
                        <Text style={[styles.filterText, { color: !showAllHistory ? '#FFFFFF' : colors.text }]}>Secili Ay</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setShowAllHistory(true)}
                        style={[styles.filterChip, { backgroundColor: showAllHistory ? serviceBlue : colors.surface, borderColor: showAllHistory ? serviceBlue : colors.border }]}
                    >
                        <Text style={[styles.filterText, { color: showAllHistory ? '#FFFFFF' : colors.text }]}>Tum Gecmis</Text>
                    </Pressable>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Bordro Gecmisi</Text>
                    <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>{visiblePayrolls.length} kayit</Text>
                </View>

                {loading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator color={serviceBlue} size="large" />
                    </View>
                ) : visiblePayrolls.length ? (
                    visiblePayrolls.map((payroll) => (
                        <PayrollCard
                            key={payroll.id}
                            payroll={payroll}
                            colors={colors}
                            onPress={() => navigation.navigate('PayrollDetail', { payrollId: payroll.id })}
                        />
                    ))
                ) : (
                    <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="file-search-outline" size={30} color={colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>Bordro bulunamadi</Text>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            Bu donem icin goruntulenebilir bordro kaydi yok.
                        </Text>
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
    headerText: { flex: 1, marginHorizontal: 12 },
    title: { fontSize: 25, fontWeight: '900' },
    subtitle: { marginTop: 2, fontSize: 13, fontWeight: '700' },
    hero: { borderRadius: 24, padding: 20, marginBottom: 14 },
    heroLabel: { color: '#DBEAFE', fontSize: 13, fontWeight: '800' },
    heroValue: { color: '#FFFFFF', fontSize: 32, fontWeight: '900', marginTop: 8 },
    heroStats: { flexDirection: 'row', gap: 10, marginTop: 16 },
    heroStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 14, padding: 10 },
    heroStatValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
    heroStatLabel: { color: '#DBEAFE', marginTop: 3, fontSize: 11, fontWeight: '800' },
    monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    monthButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    monthCard: { flex: 1, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
    monthLabelText: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
    monthValueText: { fontSize: 16, fontWeight: '900' },
    filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    filterChip: { flex: 1, borderRadius: 999, borderWidth: 1, paddingVertical: 9, alignItems: 'center' },
    filterText: { fontSize: 13, fontWeight: '900' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    sectionTitle: { fontSize: 17, fontWeight: '900' },
    sectionCount: { fontSize: 12, fontWeight: '800' },
    loadingWrap: { paddingVertical: 70, alignItems: 'center' },
    payrollCard: { borderWidth: 1, borderRadius: 18, padding: 13, marginBottom: 10 },
    payrollTop: { flexDirection: 'row', alignItems: 'center' },
    payrollIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    payrollInfo: { flex: 1 },
    payrollTitle: { fontSize: 14, fontWeight: '900' },
    payrollMeta: { marginTop: 2, fontSize: 12, fontWeight: '700' },
    statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    statusPillText: { fontSize: 11, fontWeight: '900' },
    payrollAmounts: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, gap: 10 },
    amountLabel: { fontSize: 11, fontWeight: '800', marginBottom: 2 },
    amountValue: { fontSize: 13, fontWeight: '800' },
    netBlock: { alignItems: 'flex-end', flex: 1 },
    netValue: { fontSize: 15, fontWeight: '900' },
    emptyCard: { borderWidth: 1, borderRadius: 18, padding: 24, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '900', marginTop: 10 },
    emptyText: { fontSize: 13, textAlign: 'center', marginTop: 4 },
});
