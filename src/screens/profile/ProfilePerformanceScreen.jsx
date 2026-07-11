import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import Header from '@/components/Header';
import WrapperContainer from '@/components/WrapperContainer';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import technicianService from '@/services/technicianService';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { resolveMediaUrl } from '@/utils/mediaUrl';

const MONTH_NAMES = [
    'Ocak',
    'Şubat',
    'Mart',
    'Nisan',
    'Mayıs',
    'Haziran',
    'Temmuz',
    'Ağustos',
    'Eylül',
    'Ekim',
    'Kasım',
    'Aralık',
];

const formatMoney = (value) => {
    const amount = Number(value || 0);
    return Number.isFinite(amount)
        ? '₺' + amount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
        : '₺0';
};

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatShortDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
};

const initialsOf = (label) => String(label || 'K')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((chunk) => chunk[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const normalizeStatus = (value) => String(value || '').toLowerCase();

const isCompletedService = (service) => {
    const status = normalizeStatus(service?.service_status);
    return Boolean(service?.is_completed) || status === 'completed' || status === 'tamamlandı' || status === 'tamamlandi';
};

const isCancelledService = (service) => {
    const status = normalizeStatus(service?.service_status);
    return status === 'cancelled' || status === 'iptal' || status === 'cancel' || status === 'canceled';
};

const isOpenService = (service) => !isCompletedService(service) && !isCancelledService(service);

const pickServiceDate = (service) => service?.scheduled_date || service?.updated_at || service?.created_at || null;

const filterServicesByMonth = (services, month, year) => {
    return services.filter((service) => {
        const rawDate = pickServiceDate(service);
        if (!rawDate) return false;
        const date = new Date(rawDate);
        if (Number.isNaN(date.getTime())) return false;
        return date.getFullYear() === year && date.getMonth() === month;
    });
};

const getProfileLocation = (profile) => (
    profile?.current_location?.address
    || profile?.location
    || profile?.address
    || profile?.city
    || 'Konum bilgisi paylaşılmadı'
);

const getStatusMeta = (profile) => {
    const isOnline = Boolean(profile?.is_online || profile?.status === 'online');
    if (isOnline) {
        return {
            label: 'Çevrimiçi',
            color: serviceGreen,
            bg: 'rgba(34,197,94,0.12)',
        };
    }

    return {
        label: profile?.status_display || 'Müsait',
        color: profile?.status_info?.color || '#64748B',
        bg: 'rgba(100,116,139,0.12)',
    };
};

function InfoChip({ icon, label, value, colors, accent }) {
    return (
        <View style={styles.infoChip}>
            <View style={[styles.infoChipIcon, { backgroundColor: `${accent}12` }]}>
                <MaterialCommunityIcons name={icon} size={18} color={accent} />
            </View>
            <View>
                <Text style={[styles.infoChipLabel, { color: colors.textSecondary }]}>{label}</Text>
                <Text style={[styles.infoChipValue, { color: colors.text }]}>{value}</Text>
            </View>
        </View>
    );
}

function StatCard({ icon, label, value, accent, colors }) {
    return (
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconWrap, { backgroundColor: `${accent}12` }]}>
                <MaterialCommunityIcons name={icon} size={16} color={accent} />
            </View>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={2}>{label}</Text>
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
        </View>
    );
}

function FilterSelect({ label, value, onPrev, onNext, colors }) {
    return (
        <View style={[styles.filterSelect, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{label}</Text>
            <View style={styles.filterControlRow}>
                <Pressable onPress={onPrev} style={[styles.filterArrow, { borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="chevron-left" size={18} color={serviceBlue} />
                </Pressable>
                <Text style={[styles.filterValue, { color: colors.text }]}>{value}</Text>
                <Pressable onPress={onNext} style={[styles.filterArrow, { borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={serviceBlue} />
                </Pressable>
            </View>
        </View>
    );
}

function SummaryRow({ icon, label, value, accent, colors }) {
    return (
        <View style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
            <View style={styles.summaryLeft}>
                <View style={[styles.summaryIconWrap, { backgroundColor: `${accent}12` }]}>
                    <MaterialCommunityIcons name={icon} size={18} color={accent} />
                </View>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}</Text>
            </View>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
        </View>
    );
}

function ServiceItem({ item, colors, onPress }) {
    const title = item?.customer_full_name || item?.receipt_number || 'Servis Kaydı';
    const subtitle = item?.fault_description || item?.service_status_display || item?.service_status || 'Servis detayı';
    const accent = isCompletedService(item) ? serviceGreen : serviceBlue;

    return (
        <Pressable onPress={onPress} style={[styles.serviceItem, { borderBottomColor: colors.border }]}>
            <View style={[styles.serviceAvatarFallback, { backgroundColor: `${accent}12` }]}>
                <Text style={[styles.serviceAvatarText, { color: accent }]}>{initialsOf(title)}</Text>
            </View>
            <View style={styles.serviceBody}>
                <Text style={[styles.serviceTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
                <Text style={[styles.serviceSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
            </View>
            <View style={styles.serviceRight}>
                <Text style={[styles.serviceDate, { color: colors.text }]}>{formatShortDate(pickServiceDate(item))}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
            </View>
        </Pressable>
    );
}

export default function ProfilePerformanceScreen({ navigation }) {
    const { colors } = useTheme();
    const { userInfo } = useAuth();
    const now = new Date();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [performance, setPerformance] = useState(null);
    const [profile, setProfile] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    const loadData = useCallback(async () => {
        try {
            const [performanceRes, profileRes] = await Promise.all([
                api.get(ENDPOINTS.REPORTS.MY_PERFORMANCE).catch(() => ({ data: null })),
                technicianService.getMyProfile().catch(() => null),
            ]);

            setPerformance(performanceRes?.data || null);
            setProfile(profileRes || null);
        } catch (error) {
            console.log('Performance load error:', error?.response?.data || error?.message || error);
            setPerformance(null);
            setProfile(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        loadData();
    }, [loadData]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        loadData();
    }, [loadData]);

    const fullName = userInfo?.full_name
        || [userInfo?.first_name, userInfo?.last_name].filter(Boolean).join(' ')
        || userInfo?.email
        || 'Kullanıcı';
    const roleLabel = userInfo?.user_type_display || 'Teknik Servis Uzmanı';
    const avatarUri = resolveMediaUrl(userInfo?.avatar);
    const statusMeta = getStatusMeta(profile);

    const services = useMemo(() => {
        if (!Array.isArray(performance?.services)) return [];
        return performance.services.slice().sort((a, b) => new Date(pickServiceDate(b) || 0) - new Date(pickServiceDate(a) || 0));
    }, [performance]);

    const filteredServices = useMemo(
        () => filterServicesByMonth(services, selectedMonth, selectedYear),
        [services, selectedMonth, selectedYear],
    );

    const metrics = useMemo(() => {
        const completed = filteredServices.filter(isCompletedService).length;
        const cancelled = filteredServices.filter(isCancelledService).length;
        const open = filteredServices.filter(isOpenService).length;
        const total = filteredServices.length;
        const completionRate = total ? Math.round((completed / total) * 100) : 0;

        return {
            total,
            completed,
            cancelled,
            open,
            completionRate,
        };
    }, [filteredServices]);

    const overallStats = useMemo(() => ({
        revenue: formatMoney(performance?.total_revenue_generated),
    }), [performance]);

    const latestServices = filteredServices.slice(0, 3);
    const startDate = userInfo?.date_joined || profile?.hire_date || profile?.created_at;
    const lastSeen = profile?.last_online || profile?.updated_at || null;

    const handlePrevMonth = () => {
        if (selectedMonth === 0) {
            setSelectedMonth(11);
            setSelectedYear((prev) => prev - 1);
            return;
        }
        setSelectedMonth((prev) => prev - 1);
    };

    const handleNextMonth = () => {
        if (selectedMonth === 11) {
            setSelectedMonth(0);
            setSelectedYear((prev) => prev + 1);
            return;
        }
        setSelectedMonth((prev) => prev + 1);
    };

    const handlePrevYear = () => setSelectedYear((prev) => prev - 1);
    const handleNextYear = () => setSelectedYear((prev) => prev + 1);

    if (loading) {
        return (
            <WrapperContainer bg={colors.background}>
                <Header title="Performansım" showBack borderBottom />
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </WrapperContainer>
        );
    }

    return (
        <WrapperContainer bg={colors.background}>
            <Header title="Performansım" showBack borderBottom />
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
            >
                <View style={styles.titleRow}>
                    <View>
                        <Text style={[styles.screenTitle, { color: colors.text }]}>Performansım</Text>
                        <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>Kişisel performans özeti</Text>
                    </View>
                </View>

                <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.heroTop}>
                        <View style={styles.avatarWrap}>
                            {avatarUri ? (
                                <Image source={{ uri: avatarUri }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatarFallback, { backgroundColor: `${serviceBlue}14` }]}>
                                    <Text style={[styles.avatarFallbackText, { color: serviceBlue }]}>{initialsOf(fullName)}</Text>
                                </View>
                            )}
                            <View style={[styles.onlineDot, { backgroundColor: statusMeta.color, borderColor: colors.surface }]} />
                        </View>

                        <View style={styles.heroContent}>
                            <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={1}>{fullName}</Text>
                            <Text style={[styles.heroRole, { color: colors.textSecondary }]} numberOfLines={1}>{roleLabel}</Text>
                            <View style={styles.locationRow}>
                                <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.textSecondary} />
                                <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>{getProfileLocation(profile)}</Text>
                            </View>
                        </View>

                        <View style={styles.heroStatusWrap}>
                            <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                                <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    <View style={styles.infoRow}>
                        <InfoChip icon="clock-outline" label="İşe başlangıç" value={formatDate(startDate)} colors={colors} accent={serviceBlue} />
                        <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                        <InfoChip icon="record-circle" label="Son görülme" value={profile?.is_online ? 'Şimdi' : formatShortDate(lastSeen)} colors={colors} accent={statusMeta.color} />
                    </View>
                </View>

                <View style={styles.filterRow}>
                    <FilterSelect label="Ay" value={MONTH_NAMES[selectedMonth]} onPrev={handlePrevMonth} onNext={handleNextMonth} colors={colors} />
                    <FilterSelect label="Yıl" value={String(selectedYear)} onPrev={handlePrevYear} onNext={handleNextYear} colors={colors} />
                </View>

                <View style={styles.statsGrid}>
                    <StatCard icon="calendar-month-outline" label="Bu Ay" value={String(metrics.total)} accent={serviceBlue} colors={colors} />
                    <StatCard icon="check-circle-outline" label="Tamamlanan" value={String(metrics.completed)} accent={serviceGreen} colors={colors} />
                    <StatCard icon="progress-clock" label="Açık İşler" value={String(metrics.open)} accent={serviceOrange} colors={colors} />
                    <StatCard icon="chart-line-variant" label="Performans" value={'%' + metrics.completionRate} accent="#8B5CF6" colors={colors} />
                </View>

                <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Genel Performans Özeti</Text>
                    <SummaryRow icon="timer-outline" label="Tamamlama Oranı" value={'%' + metrics.completionRate} accent={serviceBlue} colors={colors} />
                    <SummaryRow icon="check-decagram-outline" label="Tamamlanan Servis" value={String(metrics.completed)} accent={serviceGreen} colors={colors} />
                    <SummaryRow icon="refresh-circle-outline" label="Açık Servis" value={String(metrics.open)} accent={serviceOrange} colors={colors} />
                    <SummaryRow icon="close-circle-outline" label="İptal / Erteleme" value={String(metrics.cancelled)} accent={serviceRed} colors={colors} />
                </View>

                <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Son Servisler</Text>
                        <Text style={[styles.sectionLink, { color: serviceBlue }]}>{MONTH_NAMES[selectedMonth]} {selectedYear}</Text>
                    </View>
                    {latestServices.length === 0 ? (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="clipboard-search-outline" size={30} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Seçilen dönem için servis verisi bulunamadı.</Text>
                        </View>
                    ) : (
                        latestServices.map((item) => (
                            <ServiceItem
                                key={String(item.id)}
                                item={item}
                                colors={colors}
                                onPress={() => item?.id && navigation.navigate('ServiceDetail', { serviceId: item.id, service: item })}
                            />
                        ))
                    )}
                </View>

                <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Gelir Özeti</Text>
                    <View style={styles.earningRow}>
                        <View style={styles.earningItem}>
                            <View style={[styles.earningIconWrap, { backgroundColor: `${serviceGreen}12` }]}>
                                <MaterialCommunityIcons name="wallet-outline" size={20} color={serviceGreen} />
                            </View>
                            <Text style={[styles.earningLabel, { color: colors.textSecondary }]}>Toplam Tahsilat</Text>
                            <Text style={[styles.earningValue, { color: colors.text }]}>{overallStats.revenue}</Text>
                        </View>
                        <View style={[styles.earningDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.earningItem}>
                            <View style={[styles.earningIconWrap, { backgroundColor: `${serviceOrange}12` }]}>
                                <MaterialCommunityIcons name="briefcase-check-outline" size={20} color={serviceOrange} />
                            </View>
                            <Text style={[styles.earningLabel, { color: colors.textSecondary }]}>Tamamlanan İş</Text>
                            <Text style={[styles.earningValue, { color: colors.text }]}>{String(metrics.completed)}</Text>
                        </View>
                        <View style={[styles.earningDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.earningItem}>
                            <View style={[styles.earningIconWrap, { backgroundColor: `#8B5CF612` }]}>
                                <MaterialCommunityIcons name="chart-areaspline" size={20} color="#8B5CF6" />
                            </View>
                            <Text style={[styles.earningLabel, { color: colors.textSecondary }]}>Genel Oran</Text>
                            <Text style={[styles.earningValue, { color: colors.text }]}>{'%' + metrics.completionRate}</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.l,
        paddingBottom: spacing['5xl'],
        gap: spacing.m,
    },
    centerState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.m,
    },
    screenTitle: {
        ...typography.h2,
        fontWeight: '800',
    },
    screenSubtitle: {
        ...typography.bodySmall,
        marginTop: 4,
    },
    heroCard: {
        borderWidth: 1,
        borderRadius: 24,
        padding: spacing.l,
        shadowColor: '#0F172A',
        shadowOpacity: 0.05,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
    },
    heroTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.m,
    },
    avatarWrap: {
        position: 'relative',
    },
    avatar: {
        width: 84,
        height: 84,
        borderRadius: 42,
    },
    avatarFallback: {
        width: 84,
        height: 84,
        borderRadius: 42,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarFallbackText: {
        fontSize: 26,
        fontWeight: '800',
    },
    onlineDot: {
        position: 'absolute',
        right: 2,
        bottom: 2,
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 3,
    },
    heroContent: {
        flex: 1,
        minWidth: 0,
        gap: 5,
        paddingTop: 4,
    },
    heroName: {
        ...typography.h3,
        fontWeight: '800',
    },
    heroRole: {
        ...typography.bodySmall,
        fontWeight: '600',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    locationText: {
        ...typography.caption,
        flex: 1,
    },
    heroStatusWrap: {
        alignItems: 'flex-end',
        gap: 12,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
    },
    statusBadgeText: {
        ...typography.caption,
        fontWeight: '800',
    },
    divider: {
        height: 1,
        marginVertical: spacing.m,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: spacing.m,
    },
    infoChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    infoChipIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoChipLabel: {
        ...typography.caption,
        marginBottom: 2,
    },
    infoChipValue: {
        ...typography.bodySmall,
        fontWeight: '700',
    },
    infoDivider: {
        width: 1,
    },
    filterRow: {
        flexDirection: 'row',
        gap: spacing.s,
    },
    filterSelect: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 18,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s,
    },
    filterLabel: {
        ...typography.caption,
        marginBottom: 8,
    },
    filterControlRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.s,
    },
    filterArrow: {
        width: 34,
        height: 34,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterValue: {
        ...typography.body,
        fontWeight: '800',
        flex: 1,
        textAlign: 'center',
        fontSize: 14
    },
    statsGrid: {
        flexDirection: 'row',
        gap: spacing.s,
    },
    statCard: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 18,
        paddingHorizontal: spacing.s,
        paddingVertical: spacing.s,
    },
    statIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statLabel: {
        ...typography.caption,
        minHeight: 10,
        marginBottom: 4,
        fontSize: 10.5,
    },
    statValue: {
        ...typography.body,
        fontWeight: '800',
    },
    sectionCard: {
        borderWidth: 1,
        borderRadius: 24,
        padding: spacing.l,
        gap: spacing.s,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.m,
        marginBottom: spacing.xs,
    },
    sectionTitle: {
        ...typography.body,
        fontWeight: '800',
        marginBottom: spacing.xs,
    },
    sectionLink: {
        ...typography.caption,
        fontWeight: '700',
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    summaryLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    summaryIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryLabel: {
        ...typography.bodySmall,
        fontWeight: '600',
    },
    summaryValue: {
        ...typography.body,
        fontWeight: '800',
        marginLeft: spacing.m,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl,
        gap: 10,
    },
    emptyText: {
        ...typography.bodySmall,
        textAlign: 'center',
    },
    serviceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        gap: 12,
    },
    serviceAvatarFallback: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    serviceAvatarText: {
        fontSize: 15,
        fontWeight: '800',
    },
    serviceBody: {
        flex: 1,
        minWidth: 0,
    },
    serviceTitle: {
        ...typography.body,
        fontWeight: '700',
        marginBottom: 4,
    },
    serviceSubtitle: {
        ...typography.caption,
    },
    serviceRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    serviceDate: {
        ...typography.caption,
        fontWeight: '700',
    },
    earningRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'space-between',
    },
    earningItem: {
        flex: 1,
        alignItems: 'flex-start',
        gap: 8,
    },
    earningIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    earningLabel: {
        ...typography.caption,
    },
    earningValue: {
        ...typography.body,
        fontWeight: '800',
    },
    earningDivider: {
        width: 1,
        marginHorizontal: spacing.s,
    },
});