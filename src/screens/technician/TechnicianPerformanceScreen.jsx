import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
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
import { useAuth } from '@/context/AuthContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceOrange } from '@/theme/color';

const PERIODS = [
    { label: 'Bu Ay', value: 'month' },
    { label: 'Bu Yil', value: 'year' },
    { label: 'Tumu', value: 'all' },
];

const periodParams = (period) => {
    const now = new Date();
    if (period === 'month') {
        return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }
    if (period === 'year') {
        return { year: now.getFullYear() };
    }
    return {};
};

const money = (value) =>
    Number(value || 0).toLocaleString('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        maximumFractionDigits: 0,
    });

const numberText = (value) => Number(value || 0).toLocaleString('tr-TR');

const createMockPerformance = (technicianId, technicianName, period) => {
    const periodOffset = period === 'year' ? 4 : period === 'all' ? 7 : 0;
    const baseName = technicianName || 'Demo Teknisyen';

    return {
        technician_id: technicianId || 'mock-technician',
        technician_name: baseName,
        completed_services_count: 14 + periodOffset,
        pending_services_count: 3 + Math.max(0, Math.floor(periodOffset / 2)),
        total_revenue_generated: 86500 + (periodOffset * 4200),
        services: [
            {
                id: `mock-${period}-1`,
                receipt_number: 'SRV-24018',
                customer_full_name: 'Ahmet Kaya',
                service_status: 'completed',
                scheduled_date: '2026-06-09T09:30:00',
                total_payment: 4250,
            },
            {
                id: `mock-${period}-2`,
                receipt_number: 'SRV-24031',
                customer_full_name: 'Merve Demir',
                service_status: 'in_progress',
                scheduled_date: '2026-06-10T13:15:00',
                total_payment: 2100,
            },
            {
                id: `mock-${period}-3`,
                receipt_number: 'SRV-24044',
                customer_full_name: 'Burak Yildiz',
                service_status: 'completed',
                scheduled_date: '2026-06-11T16:00:00',
                total_payment: 5800,
            },
        ],
    };
};

const ServiceRow = ({ service }) => {
    const { colors } = useTheme();
    const scheduledAt = service?.scheduled_date
        ? new Date(service.scheduled_date).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
        : '-';

    return (
        <View style={[styles.serviceRow, { borderBottomColor: colors.divider }]}>
            <View style={styles.serviceInfo}>
                <Text style={[styles.serviceTitle, { color: colors.text }]} numberOfLines={1}>
                    #{service?.receipt_number || '-'} · {service?.customer_full_name || 'Musteri'}
                </Text>
                <Text style={[styles.serviceMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                    {service?.service_status || '-'} · {scheduledAt}
                </Text>
            </View>
            <Text style={[styles.serviceAmount, { color: serviceBlue }]}>{money(service?.total_payment)}</Text>
        </View>
    );
};

export default function TechnicianPerformanceScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { isTechnician, userInfo } = useAuth();
    const technicianId = route?.params?.technicianId || route?.params?.id || null;
    const technicianName =
        route?.params?.technicianName
        || userInfo?.full_name
        || [userInfo?.first_name, userInfo?.last_name].filter(Boolean).join(' ')
        || userInfo?.email
        || 'Teknisyen';
    const [period, setPeriod] = useState('month');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [performance, setPerformance] = useState(null);
    const [isMockData, setIsMockData] = useState(false);

    const loadPerformance = useCallback(async (silent = false) => {
        if (!silent) {
            setIsLoading(true);
        }

        try {
            const endpoint = !technicianId && isTechnician
                ? ENDPOINTS.REPORTS.MY_PERFORMANCE
                : ENDPOINTS.REPORTS.TECHNICIAN_DETAIL(technicianId);
            const response = await api.get(endpoint, { params: periodParams(period) });
            const nextPerformance = response?.data || null;
            const hasRealContent = Boolean(
                nextPerformance
                && (
                    Number(nextPerformance.completed_services_count || 0) > 0
                    || Number(nextPerformance.pending_services_count || 0) > 0
                    || Number(nextPerformance.total_revenue_generated || 0) > 0
                    || (Array.isArray(nextPerformance.services) && nextPerformance.services.length > 0)
                )
            );

            if (hasRealContent) {
                setPerformance(nextPerformance);
                setIsMockData(false);
            } else {
                setPerformance(createMockPerformance(technicianId, nextPerformance?.technician_name || technicianName, period));
                setIsMockData(true);
            }
        } catch (error) {
            console.log('Technician performance fetch error:', error?.response?.data || error?.message || error);
            setPerformance(createMockPerformance(technicianId, technicianName, period));
            setIsMockData(true);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [isTechnician, period, technicianId, technicianName]);

    useEffect(() => {
        loadPerformance();
    }, [loadPerformance]);

    const services = useMemo(() => (Array.isArray(performance?.services) ? performance.services : []), [performance]);

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Performans</Text>
                <View style={styles.headerBtn} />
            </View>

            <ScrollView
                contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => {
                        setRefreshing(true);
                        loadPerformance(true);
                    }}
                    tintColor={serviceBlue}
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.periodRow}>
                    {PERIODS.map((item) => (
                        <Pressable
                            key={item.value}
                            onPress={() => setPeriod(item.value)}
                            style={[
                                styles.periodChip,
                                {
                                    backgroundColor: period === item.value ? serviceBlue : colors.surface,
                                    borderColor: period === item.value ? serviceBlue : colors.border,
                                },
                            ]}
                        >
                            <Text style={[styles.periodText, { color: period === item.value ? '#FFFFFF' : colors.text }]}>
                                {item.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {isLoading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="large" color={serviceBlue} />
                    </View>
                ) : !performance ? (
                    <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
                        <MaterialCommunityIcons name="chart-box-outline" size={40} color={colors.textTertiary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Performans verisi alinamadi.</Text>
                    </View>
                ) : (
                    <>
                        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={styles.titleRow}>
                                <Text style={[styles.name, { color: colors.text }]}>{performance.technician_name || 'Teknisyen'}</Text>
                                {isMockData ? (
                                    <View style={[styles.mockBadge, { backgroundColor: `${serviceOrange}16` }]}>
                                        <Text style={[styles.mockBadgeText, { color: serviceOrange }]}>Demo Veri</Text>
                                    </View>
                                ) : null}
                            </View>
                            <View style={styles.metricsRow}>
                                <View style={styles.metricBox}>
                                    <Text style={[styles.metricValue, { color: serviceGreen }]}>{numberText(performance.completed_services_count)}</Text>
                                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Tamamlanan</Text>
                                </View>
                                <View style={styles.metricBox}>
                                    <Text style={[styles.metricValue, { color: serviceOrange }]}>{numberText(performance.pending_services_count)}</Text>
                                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Bekleyen</Text>
                                </View>
                                <View style={styles.metricBox}>
                                    <Text style={[styles.metricValue, { color: serviceBlue }]}>{money(performance.total_revenue_generated)}</Text>
                                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Ciro</Text>
                                </View>
                            </View>
                        </View>

                        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Son Servisler</Text>
                            {services.length === 0 ? (
                                <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>Bu donem icin servis yok.</Text>
                            ) : (
                                services.map((service) => <ServiceRow key={String(service.id)} service={service} />)
                            )}
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    container: { paddingHorizontal: 16 },
    periodRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    periodChip: { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    periodText: { fontSize: 13, fontWeight: '800' },
    loadingWrap: { paddingVertical: 80, alignItems: 'center', justifyContent: 'center' },
    emptyCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56, borderRadius: 16, marginTop: 12 },
    emptyText: { fontSize: 14, fontWeight: '600', marginTop: 12 },
    summaryCard: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 14 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 },
    name: { fontSize: 20, fontWeight: '900', marginBottom: 16 },
    mockBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
    mockBadgeText: { fontSize: 11, fontWeight: '900' },
    metricsRow: { flexDirection: 'row', gap: 10 },
    metricBox: { flex: 1 },
    metricValue: { fontSize: 18, fontWeight: '900' },
    metricLabel: { fontSize: 12, fontWeight: '700', marginTop: 4 },
    listCard: { borderWidth: 1, borderRadius: 18, padding: 16 },
    sectionTitle: { fontSize: 15, fontWeight: '900', marginBottom: 10 },
    emptyListText: { fontSize: 13, paddingVertical: 12 },
    serviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    serviceInfo: { flex: 1, marginRight: 12 },
    serviceTitle: { fontSize: 14, fontWeight: '700' },
    serviceMeta: { fontSize: 12, marginTop: 4 },
    serviceAmount: { fontSize: 13, fontWeight: '800' },
});
