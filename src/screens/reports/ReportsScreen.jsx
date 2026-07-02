import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PagerView from 'react-native-pager-view';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import AppBottomSheet from '@/components/AppBottomSheet';
import reportService from '@/services/reportService';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';

const PERIODS = [
    { label: 'Bu Ay', value: 'month' },
    { label: 'Bu Yıl', value: 'year' },
    { label: 'Tümü', value: 'all' },
    { label: 'Özel', value: 'custom' },
];

const TABS = [
    { key: 'overview', label: 'Özet', icon: 'view-dashboard-outline' },
    { key: 'operations', label: 'Operasyon', icon: 'clipboard-list-outline' },
    { key: 'performance', label: 'Performans', icon: 'chart-line' },
    { key: 'activity', label: 'Aktivite', icon: 'history' },
];

const money = (value) => Number(value || 0).toLocaleString('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
});

const numberText = (value) => Number(value || 0).toLocaleString('tr-TR');

const monthLabel = (date) => date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

const monthOptionsForYear = (year) => Array.from({ length: 12 }, (_, index) => new Date(year, index, 1));

const STATUS_META = {
    new: { label: 'Yeni', color: '#6B7280' },
    assigned: { label: 'Atandı', color: '#2563EB' },
    in_progress: { label: 'Devam Ediyor', color: '#F59E0B' },
    completed: { label: 'Tamamlandı', color: '#16A34A' },
    cancelled: { label: 'İptal', color: '#DC2626' },
    postponed: { label: 'Ertelendi', color: '#A855F7' },
};

const formatRelativeTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    if (diffSec < 60) return 'Az önce';
    if (diffMin < 60) return `${diffMin} dk önce`;
    if (diffHour < 24) return `${diffHour} sa önce`;
    if (diffDay < 7) return `${diffDay} gün önce`;
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
};

const formatDate = (iso) => {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Aktivite rengi: backend'in status_color alanini oncelikli kullan, fallback STATUS_META
const resolveActivityColor = (activity) => {
    if (activity?.status_color) return activity.status_color;
    return STATUS_META[activity?.status]?.color || '#6B7280';
};

const resolveStatusLabel = (code) => STATUS_META[code]?.label || code || 'Bilinmiyor';

const periodParams = (period, selectedMonth, customRange) => {
    if (period === 'custom' && customRange?.start && customRange?.end) {
        return { start_date: customRange.start.toISOString().slice(0, 10), end_date: customRange.end.toISOString().slice(0, 10) };
    }
    if (period === 'month') {
        return { year: selectedMonth.getFullYear(), month: selectedMonth.getMonth() + 1 };
    }
    if (period === 'year') {
        return { year: selectedMonth.getFullYear() };
    }
    return {};
};

// --- UI Components ---

const MetricBox = ({ icon, label, value, color, sub }) => {
    const { colors } = useTheme();
    return (
        <View style={[styles.metricBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.metricIcon, { backgroundColor: `${color}16` }]}>
                <MaterialCommunityIcons name={icon} size={21} color={color} />
            </View>
            <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
            {!!sub && <Text style={[styles.metricSub, { color }]} numberOfLines={1}>{sub}</Text>}
        </View>
    );
};

const ProgressRow = ({ label, value, total, color }) => {
    const { colors } = useTheme();
    const percent = total > 0 ? Math.min(100, Math.round((Number(value || 0) / total) * 100)) : 0;
    return (
        <View style={styles.progressRow}>
            <View style={styles.progressTop}>
                <Text style={[styles.progressLabel, { color: colors.text }]}>{label}</Text>
                <Text style={[styles.progressValue, { color: colors.textSecondary }]}>{numberText(value)} · %{percent}</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.divider }]}>
                <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: color }]} />
            </View>
        </View>
    );
};

const InsightCard = ({ icon, label, value, color, note }) => {
    const { colors } = useTheme();
    return (
        <View style={[styles.insightCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.insightIcon, { backgroundColor: `${color}16` }]}>
                <MaterialCommunityIcons name={icon} size={20} color={color} />
            </View>
            <View style={styles.insightText}>
                <Text style={[styles.insightLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
                <Text style={[styles.insightValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
                {!!note && <Text style={[styles.insightNote, { color }]} numberOfLines={1}>{note}</Text>}
            </View>
        </View>
    );
};

const MiniBarChart = ({ data }) => {
    const { colors } = useTheme();
    const maxValue = Math.max(...(data || []).map((item) => Number(item.total || 0)), 1);
    return (
        <View style={styles.chartWrap}>
            {(data || []).map((item, index) => {
                const height = Math.max(8, (Number(item.total || 0) / maxValue) * 88);
                return (
                    <View key={`${item.name}-${index}`} style={styles.chartItem}>
                        <View style={[styles.chartBarShell, { backgroundColor: colors.divider }]}>
                            <View style={[styles.chartBar, { height, backgroundColor: serviceBlue }]} />
                        </View>
                        <Text style={[styles.chartLabel, { color: colors.textTertiary }]}>{item.name}</Text>
                    </View>
                );
            })}
        </View>
    );
};

const TabBar = ({ currentTab, onChange }) => {
    const { colors } = useTheme();
    return (
        <View style={[styles.tabBarWrapper, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
                {TABS.map((tab, index) => {
                    const isActive = currentTab === tab.key;
                    return (
                        <Pressable
                            key={tab.key}
                            onPress={() => onChange(tab.key)}
                            style={({ pressed }) => [
                                styles.tabBarItem,
                                {
                                    marginLeft: index === 0 ? 18 : 0,
                                    marginRight: index === TABS.length - 1 ? 18 : 8,
                                    opacity: pressed ? 0.85 : 1,
                                },
                            ]}
                        >
                            <View style={styles.tabBarItemContent}>
                                <MaterialCommunityIcons name={tab.icon} size={16} color={isActive ? serviceBlue : colors.textSecondary} />
                                <Text style={[styles.tabBarItemText, { color: isActive ? serviceBlue : colors.textSecondary, fontWeight: isActive ? '900' : '700' }]}>
                                    {tab.label}
                                </Text>
                            </View>
                            {isActive ? (
                                <LinearGradient
                                    colors={['#0066CC', '#0EA5E9']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.tabBarIndicator}
                                />
                            ) : (
                                <View style={styles.tabBarIndicatorSpacer} />
                            )}
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const ActivityItem = ({ activity, onPress }) => {
    const { colors } = useTheme();
    const color = resolveActivityColor(activity);
    return (
        <Pressable
            onPress={() => activity?.id && onPress?.(activity)}
            style={({ pressed }) => [styles.activityRow, { borderBottomColor: colors.divider, opacity: pressed ? 0.75 : 1 }]}
        >
            <View style={[styles.activityIcon, { backgroundColor: `${color}16` }]}>
                <MaterialCommunityIcons name="receipt-text-outline" size={20} color={color} />
            </View>
            <View style={styles.activityInfo}>
                <Text style={[styles.activityTitle, { color: colors.text }]} numberOfLines={1}>{activity?.title || 'Servis'}</Text>
                <Text style={[styles.activityDesc, { color: colors.textSecondary }]} numberOfLines={1}>{activity?.description || ''}</Text>
                <View style={styles.activityMetaRow}>
                    <View style={[styles.activityStatusPill, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
                        <View style={[styles.activityStatusDot, { backgroundColor: color }]} />
                        <Text style={[styles.activityStatusText, { color }]}>{resolveStatusLabel(activity?.status)}</Text>
                    </View>
                    <Text style={[styles.activityTime, { color: colors.textTertiary }]}>{formatRelativeTime(activity?.time)}</Text>
                </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textTertiary} />
        </Pressable>
    );
};

// --- Skeleton (loading) ---

const SkeletonBlock = ({ width, height, radius = 10, style }) => {
    const { colors } = useTheme();
    return (
        <View
            style={[
                {
                    width,
                    height,
                    borderRadius: radius,
                    backgroundColor: colors.divider,
                    opacity: 0.55,
                },
                style,
            ]}
        />
    );
};

const SkeletonPanel = () => {
    const { colors } = useTheme();
    return (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SkeletonBlock width="55%" height={16} radius={6} style={{ marginBottom: 14 }} />
            <SkeletonBlock width="100%" height={12} radius={6} style={{ marginBottom: 10 }} />
            <SkeletonBlock width="92%" height={12} radius={6} style={{ marginBottom: 10 }} />
            <SkeletonBlock width="78%" height={12} radius={6} />
        </View>
    );
};

const ReportsSkeleton = () => (
    <View>
        <SkeletonBlock width="100%" height={150} radius={22} style={{ marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <SkeletonBlock width="48%" height={92} radius={18} />
            <SkeletonBlock width="48%" height={92} radius={18} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <SkeletonBlock width="48%" height={92} radius={18} />
            <SkeletonBlock width="48%" height={92} radius={18} />
        </View>
        <SkeletonPanel />
    </View>
);

// --- Sheets ---

const MonthPickerSheet = ({ visible, title, subtitle, selectedMonth, onSelect, onClose }) => {
    const { colors } = useTheme();
    const [visibleYear, setVisibleYear] = useState(selectedMonth.getFullYear());

    useEffect(() => {
        if (visible) setVisibleYear(selectedMonth.getFullYear());
    }, [selectedMonth, visible]);

    const months = useMemo(() => monthOptionsForYear(visibleYear), [visibleYear]);
    const selectedKey = `${selectedMonth.getFullYear()}-${selectedMonth.getMonth()}`;

    return (
        <AppBottomSheet
            visible={visible}
            onClose={onClose}
            snapPoints={['58%']}
            contentContainerStyle={styles.monthSheet}
        >
            <View style={styles.monthSheetHeader}>
                <View>
                    <Text style={[styles.monthSheetTitle, { color: colors.text }]}>{title}</Text>
                    {!!subtitle && <Text style={[styles.monthSheetSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
                </View>
                <Pressable onPress={onClose} style={styles.monthSheetClose}>
                    <MaterialCommunityIcons name="close" size={22} color={colors.text} />
                </Pressable>
            </View>

            <View style={styles.yearNav}>
                <Pressable
                    onPress={() => setVisibleYear((prev) => prev - 1)}
                    style={[styles.yearNavButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                    <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
                </Pressable>
                <Text style={[styles.yearText, { color: colors.text }]}>{visibleYear}</Text>
                <Pressable
                    onPress={() => setVisibleYear((prev) => prev + 1)}
                    style={[styles.yearNavButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                    <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
                </Pressable>
            </View>

            <View style={styles.monthGrid}>
                {months.map((date) => {
                    const key = `${date.getFullYear()}-${date.getMonth()}`;
                    const selected = key === selectedKey;
                    return (
                        <Pressable
                            key={key}
                            onPress={() => {
                                onSelect(date);
                                onClose();
                            }}
                            style={[
                                styles.monthOption,
                                {
                                    backgroundColor: selected ? serviceBlue : colors.background,
                                    borderColor: selected ? serviceBlue : colors.border,
                                },
                            ]}
                        >
                            <Text style={[styles.monthOptionText, { color: selected ? '#FFFFFF' : colors.text }]}>
                                {date.toLocaleDateString('tr-TR', { month: 'short' })}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            <Pressable
                onPress={() => {
                    onSelect(new Date());
                    onClose();
                }}
                style={[styles.thisMonthButton, { backgroundColor: `${serviceBlue}12`, borderColor: `${serviceBlue}30` }]}
            >
                <MaterialCommunityIcons name="calendar-today" size={18} color={serviceBlue} />
                <Text style={styles.thisMonthText}>Bugüne dön</Text>
            </Pressable>
        </AppBottomSheet>
    );
};

const PdfActionsSheet = ({ visible, onClose, onSelectGeneral, onSelectTechnician, onSelectTechnicianList }) => {
    const { colors } = useTheme();
    const items = [
        { key: 'general', icon: 'file-document-outline', title: 'Genel Performans Raporu', subtitle: 'Tüm sistem metrikleri', color: serviceBlue, action: onSelectGeneral },
        { key: 'technician', icon: 'file-pdf-box', title: 'Teknisyen Performans Raporu', subtitle: 'Sıralama + detaylar', color: serviceRed, action: onSelectTechnician },
        { key: 'list', icon: 'account-hard-hat-outline', title: 'Teknisyen Listesi (PDF)', subtitle: 'Tüm teknisyenler', color: serviceGreen, action: onSelectTechnicianList },
    ];
    return (
        <AppBottomSheet visible={visible} onClose={onClose} snapPoints={['46%']} contentContainerStyle={styles.monthSheet}>
            <View style={styles.monthSheetHeader}>
                <View>
                    <Text style={[styles.monthSheetTitle, { color: colors.text }]}>PDF Raporu</Text>
                    <Text style={[styles.monthSheetSubtitle, { color: colors.textSecondary }]}>İndirilecek raporu seçin</Text>
                </View>
                <Pressable onPress={onClose} style={styles.monthSheetClose}>
                    <MaterialCommunityIcons name="close" size={22} color={colors.text} />
                </Pressable>
            </View>
            <View style={styles.pdfActionList}>
                {items.map((item) => (
                    <Pressable
                        key={item.key}
                        onPress={() => {
                            onClose();
                            setTimeout(item.action, 200);
                        }}
                        style={({ pressed }) => [styles.pdfActionItem, { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.78 : 1 }]}
                    >
                        <View style={[styles.pdfActionIcon, { backgroundColor: `${item.color}16` }]}>
                            <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                        </View>
                        <View style={styles.pdfActionInfo}>
                            <Text style={[styles.pdfActionTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                            <Text style={[styles.pdfActionSub, { color: colors.textSecondary }]} numberOfLines={1}>{item.subtitle}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
                    </Pressable>
                ))}
            </View>
        </AppBottomSheet>
    );
};

// --- Main Screen ---

export default function ReportsScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { isTechnician } = useAuth();
    const [period, setPeriod] = useState('month');
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [customRange, setCustomRange] = useState({ start: null, end: null });
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [showPdfSheet, setShowPdfSheet] = useState(false);
    const [pickerTarget, setPickerTarget] = useState('month'); // 'month' | 'start' | 'end'
    const [currentPage, setCurrentPage] = useState(0);
    const [dashboard, setDashboard] = useState(null);
    const [general, setGeneral] = useState(null);
    const [technicians, setTechnicians] = useState([]);
    const [myPerformance, setMyPerformance] = useState(null);
    const [overdue, setOverdue] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isError, setIsError] = useState(false);
    const [overdueLimit, setOverdueLimit] = useState(8);

    const pagerViewRef = useRef(null);

    const goToPage = useCallback((index) => {
        if (index === currentPage) return;
        pagerViewRef.current?.setPage(index);
        setCurrentPage(index);
    }, [currentPage]);

    const handlePageSelected = useCallback((e) => {
        setCurrentPage(e.nativeEvent.position);
    }, []);

    const params = useMemo(
        () => periodParams(period, selectedMonth, customRange),
        [period, selectedMonth, customRange]
    );

    const loadReports = useCallback(async (silent = false) => {
        if (!silent) {
            setIsLoading(true);
            setIsError(false);
        }
        try {
            const [dashboardData, generalData, technicianData, myData, overdueData] = await Promise.all([
                reportService.getDashboard(params),
                reportService.getGeneralPerformance(params),
                reportService.getTechnicianPerformance(params).catch(() => []),
                reportService.getMyPerformance(params).catch(() => null),
                reportService.getOverdueReceivables({ ...params, limit: overdueLimit }).catch(() => ({ results: [] })),
            ]);
            setDashboard(dashboardData || {});
            setGeneral(generalData || {});
            setTechnicians(Array.isArray(technicianData) ? technicianData : []);
            setMyPerformance(myData || null);
            setOverdue(Array.isArray(overdueData?.results) ? overdueData.results : []);
            setRecentActivity(Array.isArray(dashboardData?.recent_activity) ? dashboardData.recent_activity : []);
            setIsError(false);
        } catch (error) {
            setIsError(true);
            Alert.alert('Raporlar alınamadı', 'Bağlantınızı kontrol edip tekrar deneyin.');
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [params, overdueLimit]);

    useEffect(() => {
        loadReports();
    }, [loadReports]);

    const serviceTotal = Number(general?.total_services || 0);
    const completedServices = Number(general?.total_completed_services || 0);
    const pendingServices = Number(general?.total_pending_services || 0);
    const cancelledServices = Number(general?.total_cancelled_services || 0);
    const completedPct = Number(general?.total_completed_services_percentage || 0);
    const pendingPct = Number(general?.total_pending_services_percentage || 0);
    const cancelledPct = Number(general?.total_cancelled_services_percentage || 0);
    const grossRevenue = dashboard?.gross_revenue ?? general?.gross_revenue;
    const totalExpenses = dashboard?.total_expenses ?? general?.total_expenses;
    const netRevenue = dashboard?.net_revenue ?? general?.net_revenue;
    const totalReversal = dashboard?.total_reversal ?? general?.total_reversal;
    const netProfit = dashboard?.net_profit ?? general?.total_profit;
    const outstandingReceivables = dashboard?.outstanding_receivables ?? general?.outstanding_receivables;
    const overdueCount = dashboard?.total_overdue_receivables ?? general?.total_overdue_receivables;
    const activeServices = dashboard?.active_services_count ?? pendingServices;
    const techniciansCount = dashboard?.technicians_count ?? general?.total_technicians;
    const customersCount = dashboard?.total_customers ?? general?.total_customers;
    const topTechnicians = useMemo(
        () => [...technicians].sort((a, b) => Number(b.total_revenue_generated || 0) - Number(a.total_revenue_generated || 0)).slice(0, 5),
        [technicians]
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadReports(true);
    };

    const shiftSelectedPeriod = (direction) => {
        setSelectedMonth((prev) => {
            if (period === 'year') return new Date(prev.getFullYear() + direction, prev.getMonth(), 1);
            return new Date(prev.getFullYear(), prev.getMonth() + direction, 1);
        });
    };

    const openPdf = async (kind, extra = {}) => {
        try {
            const url = reportService.buildPdfUrl(kind, { ...params, ...extra });
            const supported = await Linking.canOpenURL(url);
            if (supported) await Linking.openURL(url);
            else Alert.alert('PDF açılamadı', 'Cihazınız PDF açmayı desteklemiyor.');
        } catch (e) {
            Alert.alert('Hata', 'PDF açılırken bir sorun oluştu.');
        }
    };

    const openWhatsapp = (phone) => {
        if (!phone) return;
        const digits = String(phone).replace(/[^0-9]/g, '');
        if (!digits) return;
        const url = `https://wa.me/${digits}`;
        Linking.openURL(url).catch(() => Alert.alert('Hata', 'WhatsApp açılamadı.'));
    };

    const openSms = (phone) => {
        if (!phone) return;
        const url = `sms:${String(phone).replace(/[^0-9+]/g, '')}`;
        Linking.openURL(url).catch(() => Alert.alert('Hata', 'SMS açılamadı.'));
    };

    const goToService = (id) => id && navigation.navigate('ServiceDetail', { serviceId: id });

    const renderOverviewTab = () => (
        <>
            <LinearGradient
                colors={isDark ? ['#26324D', '#1D2438'] : ['#0066CC', '#0EA5E9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
            >
                <Text style={styles.heroLabel}>Net kâr</Text>
                <Text style={styles.heroValue}>{money(netProfit)}</Text>
                <View style={styles.heroMetaRow}>
                    <View style={styles.heroMeta}>
                        <Text style={styles.heroMetaValue}>{money(netRevenue)}</Text>
                        <Text style={styles.heroMetaLabel}>Net Gelir</Text>
                    </View>
                    <View style={styles.heroMeta}>
                        <Text style={styles.heroMetaValue}>{money(totalExpenses)}</Text>
                        <Text style={styles.heroMetaLabel}>Giderler</Text>
                    </View>
                    <View style={styles.heroMeta}>
                        <Text style={styles.heroMetaValue}>%{Number(dashboard?.revenue_growth || 0).toFixed(1)}</Text>
                        <Text style={styles.heroMetaLabel}>Büyüme</Text>
                    </View>
                </View>
            </LinearGradient>

            <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Finans Özeti</Text>
                    <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>Gelir / gider</Text>
                </View>
                <View style={styles.insightGrid}>
                    <InsightCard icon="cash-check" label="Tahsilat" value={money(grossRevenue)} color={serviceGreen} note="Brüt gelir" />
                    <InsightCard icon="cash-minus" label="Giderler" value={money(totalExpenses)} color={serviceRed} note="Operasyon gideri" />
                    <InsightCard icon="swap-horizontal" label="Ters Kayıt" value={money(totalReversal)} color={serviceOrange} note="İade / iptal" />
                    <InsightCard icon="chart-line" label="Net Kâr" value={money(netProfit)} color={serviceBlue} note={`Net gelir ${money(netRevenue)}`} />
                </View>
            </View>

            <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Operasyon Özeti</Text>
                    <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>{numberText(serviceTotal)} servis</Text>
                </View>
                <View style={styles.insightGrid}>
                    <InsightCard icon="clipboard-list-outline" label="Toplam Servis" value={numberText(serviceTotal)} color={serviceBlue} note={`${numberText(activeServices)} aktif`} />
                    <InsightCard icon="check-decagram-outline" label="Tamamlanan" value={numberText(completedServices)} color={serviceGreen} note={`%${completedPct.toFixed(1)}`} />
                    <InsightCard icon="timer-sand" label="Bekleyen" value={numberText(pendingServices)} color={serviceOrange} note={`%${pendingPct.toFixed(1)}`} />
                    <InsightCard icon="close-octagon-outline" label="İptal" value={numberText(cancelledServices)} color={serviceRed} note={`%${cancelledPct.toFixed(1)}`} />
                    <InsightCard icon="account-group-outline" label="Müşteri" value={numberText(customersCount)} color={serviceBlue} note="Dönem içinde" />
                    <InsightCard icon="account-hard-hat-outline" label="Teknisyen" value={numberText(techniciansCount)} color={serviceGreen} note="Aktif ekip" />
                </View>
            </View>

            <View style={styles.metricsGrid}>
                <MetricBox icon="cash-clock" label="Alacak" value={money(outstandingReceivables)} color="#F59E0B" sub={`${numberText(overdueCount)} gecikmiş`} />
                <MetricBox icon="wrench-clock" label="Aktif Servis" value={numberText(activeServices)} color={serviceBlue} sub="Devam eden" />
                <MetricBox icon="account-hard-hat-outline" label="Teknisyen" value={numberText(techniciansCount)} color={serviceGreen} sub="Ekip" />
                <MetricBox icon="package-variant" label="Kritik Stok" value={numberText(dashboard?.critical_stock_count)} color={serviceRed} sub="Stok ≤ 5" />
            </View>
        </>
    );

    const renderOperationsTab = () => (
        <>
            <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Servis Durumu</Text>
                    <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>{numberText(serviceTotal)} toplam</Text>
                </View>
                <ProgressRow label="Tamamlanan" value={completedServices} total={serviceTotal} color={serviceGreen} />
                <ProgressRow label="Bekleyen / Aktif" value={pendingServices} total={serviceTotal} color={serviceBlue} />
                <ProgressRow label="İptal" value={cancelledServices} total={serviceTotal} color={serviceRed} />
            </View>

            <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Aylık Gelir</Text>
                    <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>12 ay</Text>
                </View>
                <MiniBarChart data={dashboard?.monthly_revenue || []} />
            </View>

            <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Gecikmiş Alacaklar</Text>
                    <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>{overdue.length} kayıt</Text>
                </View>
                {overdue.length === 0 ? (
                    <View style={styles.emptyActionWrap}>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Gecikmiş alacak görünmüyor.</Text>
                        <Pressable
                            onPress={() => navigation.navigate('AdminServices')}
                            style={[styles.emptyActionButton, { backgroundColor: `${serviceBlue}14`, borderColor: `${serviceBlue}30` }]}
                        >
                            <MaterialCommunityIcons name="clipboard-list-outline" size={16} color={serviceBlue} />
                            <Text style={styles.emptyActionText}>Servisleri Görüntüle</Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        {overdue.map((row) => (
                            <Pressable
                                key={row.service_id}
                                onPress={() => goToService(row.service_id)}
                                style={({ pressed }) => [styles.receivableRow, { borderBottomColor: colors.divider, opacity: pressed ? 0.72 : 1 }]}
                            >
                                <View style={styles.receivableInfo}>
                                    <Text style={[styles.receivableTitle, { color: colors.text }]} numberOfLines={1}>
                                        #{row.receipt_number || '-'} · {row.customer_full_name || 'Müşteri'}
                                    </Text>
                                    <Text style={[styles.receivableMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {row.technician_name || 'Atanmamış'} · Vade: {formatDate(row.scheduled_date)}
                                    </Text>
                                    <View style={styles.receivablePaymentRow}>
                                        <Text style={[styles.receivableSubMeta, { color: colors.textTertiary }]}>
                                            Toplam {money(row.total_amount)} · Ödenen {money(row.paid_amount)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.receivableAmountCol}>
                                    <Text style={[styles.receivableAmount, { color: serviceRed }]}>{money(row.remaining_amount)}</Text>
                                    {!!row.customer_phone && (
                                        <View style={styles.receivableActions}>
                                            <Pressable
                                                onPress={(e) => {
                                                    e.stopPropagation?.();
                                                    openSms(row.customer_phone);
                                                }}
                                                hitSlop={8}
                                                style={[styles.receivableActionButton, { backgroundColor: `${serviceBlue}14` }]}
                                            >
                                                <MaterialCommunityIcons name="message-text-outline" size={14} color={serviceBlue} />
                                            </Pressable>
                                            <Pressable
                                                onPress={(e) => {
                                                    e.stopPropagation?.();
                                                    openWhatsapp(row.customer_phone);
                                                }}
                                                hitSlop={8}
                                                style={[styles.receivableActionButton, { backgroundColor: `${serviceGreen}14` }]}
                                            >
                                                <MaterialCommunityIcons name="whatsapp" size={14} color={serviceGreen} />
                                            </Pressable>
                                        </View>
                                    )}
                                </View>
                            </Pressable>
                        ))}
                        {overdue.length >= overdueLimit && (
                            <Pressable
                                onPress={() => setOverdueLimit((prev) => prev + 8)}
                                style={[styles.loadMoreButton, { borderColor: colors.border }]}
                            >
                                <MaterialCommunityIcons name="chevron-down" size={18} color={serviceBlue} />
                                <Text style={styles.loadMoreText}>Daha fazla yükle</Text>
                            </Pressable>
                        )}
                    </>
                )}
            </View>
        </>
    );

    const renderPerformanceTab = () => {
        const myServices = Array.isArray(myPerformance?.services) ? myPerformance.services : [];
        return (
            <>
                {isTechnician && myPerformance ? (
                    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Benim Performansım</Text>
                            <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>Bu dönem</Text>
                        </View>
                        <View style={styles.mineRow}>
                            <MetricBox icon="check-decagram-outline" label="Tamamlanan" value={numberText(myPerformance.completed_services_count)} color={serviceGreen} />
                            <MetricBox icon="timer-sand" label="Bekleyen" value={numberText(myPerformance.pending_services_count)} color="#F59E0B" />
                            <MetricBox icon="cash-multiple" label="Ciro" value={money(myPerformance.total_revenue_generated)} color={serviceBlue} />
                        </View>
                        {myServices.length > 0 && (
                            <View style={styles.subPanel}>
                                <View style={styles.subHeader}>
                                    <Text style={[styles.subTitle, { color: colors.text }]}>Servislerim ({myServices.length})</Text>
                                </View>
                                {myServices.slice(0, 6).map((service) => {
                                    const meta = STATUS_META[service?.service_status] || { label: service?.service_status, color: '#6B7280' };
                                    return (
                                        <Pressable
                                            key={service.id}
                                            onPress={() => goToService(service.id)}
                                            style={({ pressed }) => [styles.miniServiceRow, { borderBottomColor: colors.divider, opacity: pressed ? 0.75 : 1 }]}
                                        >
                                            <View style={[styles.miniServiceDot, { backgroundColor: meta.color }]} />
                                            <View style={styles.miniServiceInfo}>
                                                <Text style={[styles.miniServiceTitle, { color: colors.text }]} numberOfLines={1}>
                                                    #{service?.receipt_number || '—'} · {service?.customer_full_name || 'Müşteri'}
                                                </Text>
                                                <Text style={[styles.miniServiceMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                                                    {meta.label} · {formatDate(service?.scheduled_date)} · {money(service?.total_payment)}
                                                </Text>
                                            </View>
                                            <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textTertiary} />
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                ) : null}

                <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Teknisyen Performansı</Text>
                        <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>{topTechnicians.length} kişi</Text>
                    </View>
                    {topTechnicians.length === 0 ? (
                        <View style={styles.emptyActionWrap}>
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Teknisyen verisi yok.</Text>
                            <Pressable
                                onPress={() => navigation.navigate('AdminTechnicians')}
                                style={[styles.emptyActionButton, { backgroundColor: `${serviceBlue}14`, borderColor: `${serviceBlue}30` }]}
                            >
                                <MaterialCommunityIcons name="account-plus-outline" size={16} color={serviceBlue} />
                                <Text style={styles.emptyActionText}>Teknisyen Yönetimi</Text>
                            </Pressable>
                        </View>
                    ) : (
                        topTechnicians.map((tech, index) => (
                            <Pressable
                                key={tech.technician_id || `tech-${index}`}
                                onPress={() => navigation.navigate('TechnicianPerformanceDetail', { technicianId: tech.technician_id, technicianName: tech.technician_name })}
                                style={({ pressed }) => [styles.techRow, { borderBottomColor: colors.divider, opacity: pressed ? 0.75 : 1 }]}
                            >
                                <View style={[styles.rankBadge, { backgroundColor: `${serviceBlue}14` }]}>
                                    <Text style={[styles.rankText, { color: serviceBlue }]}>{index + 1}</Text>
                                </View>
                                <View style={styles.techInfo}>
                                    <Text style={[styles.techName, { color: colors.text }]} numberOfLines={1}>{tech.technician_name}</Text>
                                    <Text style={[styles.techMeta, { color: colors.textSecondary }]}>
                                        {numberText(tech.completed_services_count)} tamamlanan servis
                                    </Text>
                                </View>
                                <Text style={[styles.techRevenue, { color: serviceGreen }]}>{money(tech.total_revenue_generated)}</Text>
                                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textTertiary} />
                            </Pressable>
                        ))
                    )}
                </View>
            </>
        );
    };

    const renderActivityTab = () => {
        const activity = recentActivity || [];
        return (
            <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Son Servis Hareketleri</Text>
                    <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>{activity.length} kayıt</Text>
                </View>
                {activity.length === 0 ? (
                    <View style={styles.emptyActionWrap}>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Henüz aktivite yok.</Text>
                        <Pressable
                            onPress={() => navigation.navigate('NewService')}
                            style={[styles.emptyActionButton, { backgroundColor: `${serviceBlue}14`, borderColor: `${serviceBlue}30` }]}
                        >
                            <MaterialCommunityIcons name="plus" size={16} color={serviceBlue} />
                            <Text style={styles.emptyActionText}>Yeni Servis Ekle</Text>
                        </Pressable>
                    </View>
                ) : (
                    activity.map((item) => (
                        <ActivityItem
                            key={item.id || `${item.title}-${item.time}`}
                            activity={item}
                            onPress={(a) => goToService(a.id)}
                        />
                    ))
                )}
            </View>
        );
    };

    const renderTabContent = () => {
        if (currentTab === 'overview') return renderOverviewTab();
        if (currentTab === 'operations') return renderOperationsTab();
        if (currentTab === 'performance') return renderPerformanceTab();
        if (currentTab === 'activity') return renderActivityTab();
        return null;
    };

    // Aktif period chip'e göre custom range kontrolü
    const showCustomRange = period === 'custom';
    const showMonthFilter = period === 'month' || period === 'year';

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={styles.topSection}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.topContent}>
                    <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
                        <Pressable onPress={() => navigation.goBack()} style={[styles.iconButton, { borderColor: colors.border }]}>
                            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
                        </Pressable>
                        <View style={styles.headerText}>
                            <Text style={[styles.title, { color: colors.text }]}>Raporlar</Text>
                            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Performans ve finans özeti</Text>
                        </View>
                        <Pressable
                            onPress={() => setShowPdfSheet(true)}
                            style={[styles.iconButton, { borderColor: colors.border, backgroundColor: `${serviceRed}12` }]}
                        >
                            <MaterialCommunityIcons name="file-pdf-box" size={21} color={serviceRed} />
                        </Pressable>
                        <Pressable onPress={() => loadReports()} style={[styles.iconButton, { borderColor: colors.border, marginLeft: 8 }]}>
                            <MaterialCommunityIcons name="refresh" size={21} color={serviceBlue} />
                        </Pressable>
                    </View>

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

                    {showMonthFilter ? (
                        <View style={styles.monthFilterRow}>
                            <Pressable
                                onPress={() => shiftSelectedPeriod(-1)}
                                style={[styles.monthArrowButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            >
                                <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    setPickerTarget('month');
                                    setShowMonthPicker(true);
                                }}
                                style={[styles.monthFilterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            >
                                <Text style={[styles.monthFilterLabel, { color: colors.textSecondary }]}>
                                    {period === 'year' ? 'Seçili yıl' : 'Seçili ay'}
                                </Text>
                                <View style={styles.monthFilterValueRow}>
                                    <MaterialCommunityIcons name="calendar-month-outline" size={18} color={serviceBlue} />
                                    <Text style={[styles.monthFilterValue, { color: colors.text }]} numberOfLines={1}>
                                        {period === 'year' ? selectedMonth.getFullYear() : monthLabel(selectedMonth)}
                                    </Text>
                                </View>
                            </Pressable>

                            <Pressable
                                onPress={() => shiftSelectedPeriod(1)}
                                style={[styles.monthArrowButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            >
                                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
                            </Pressable>
                        </View>
                    ) : null}

                    {showCustomRange ? (
                        <View style={styles.customRangeRow}>
                            <Pressable
                                onPress={() => {
                                    setPickerTarget('start');
                                    setShowMonthPicker(true);
                                }}
                                style={[styles.customRangeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            >
                                <Text style={[styles.customRangeLabel, { color: colors.textSecondary }]}>Başlangıç</Text>
                                <Text style={[styles.customRangeValue, { color: colors.text }]} numberOfLines={1}>
                                    {customRange.start ? monthLabel(customRange.start) : 'Tarih seç'}
                                </Text>
                            </Pressable>
                            <MaterialCommunityIcons name="arrow-right" size={18} color={colors.textTertiary} />
                            <Pressable
                                onPress={() => {
                                    setPickerTarget('end');
                                    setShowMonthPicker(true);
                                }}
                                style={[styles.customRangeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            >
                                <Text style={[styles.customRangeLabel, { color: colors.textSecondary }]}>Bitiş</Text>
                                <Text style={[styles.customRangeValue, { color: colors.text }]} numberOfLines={1}>
                                    {customRange.end ? monthLabel(customRange.end) : 'Tarih seç'}
                                </Text>
                            </Pressable>
                        </View>
                    ) : null}
                </ScrollView>

                <TabBar currentTab={currentPage} onChange={goToPage} />
            </View>

            {isLoading && !isError ? (
                <View style={styles.skeletonOverlay}>
                    <ReportsSkeleton />
                </View>
            ) : isError ? (
                <View style={[styles.errorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={42} color={serviceRed} />
                    <Text style={[styles.errorTitle, { color: colors.text }]}>Raporlar yüklenemedi</Text>
                    <Text style={[styles.errorText, { color: colors.textSecondary }]}>Bağlantınızı kontrol edip tekrar deneyin.</Text>
                    <Pressable
                        onPress={() => loadReports()}
                        style={[styles.retryButton, { backgroundColor: serviceBlue }]}
                    >
                        <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
                        <Text style={styles.retryText}>Tekrar Dene</Text>
                    </Pressable>
                </View>
            ) : (
                <PagerView
                    ref={pagerViewRef}
                    style={styles.pager}
                    initialPage={0}
                    onPageSelected={handlePageSelected}
                    offscreenPageLimit={1}
                >
                    <View key="page-overview" style={styles.page}>
                        <ScrollView
                            style={styles.pageScroll}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={serviceBlue} />}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={[styles.pageContent, { paddingBottom: Math.max(insets.bottom, 20) + 28 }]}
                        >
                            {renderOverviewTab()}
                        </ScrollView>
                    </View>
                    <View key="page-operations" style={styles.page}>
                        <ScrollView
                            style={styles.pageScroll}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={serviceBlue} />}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={[styles.pageContent, { paddingBottom: Math.max(insets.bottom, 20) + 28 }]}
                        >
                            {renderOperationsTab()}
                        </ScrollView>
                    </View>
                    <View key="page-performance" style={styles.page}>
                        <ScrollView
                            style={styles.pageScroll}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={serviceBlue} />}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={[styles.pageContent, { paddingBottom: Math.max(insets.bottom, 20) + 28 }]}
                        >
                            {renderPerformanceTab()}
                        </ScrollView>
                    </View>
                    <View key="page-activity" style={styles.page}>
                        <ScrollView
                            style={styles.pageScroll}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={serviceBlue} />}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={[styles.pageContent, { paddingBottom: Math.max(insets.bottom, 20) + 28 }]}
                        >
                            {renderActivityTab()}
                        </ScrollView>
                    </View>
                </PagerView>
            )}

            <MonthPickerSheet
                visible={showMonthPicker}
                title={pickerTarget === 'start' ? 'Başlangıç Ayı' : pickerTarget === 'end' ? 'Bitiş Ayı' : 'Ay Seç'}
                subtitle={pickerTarget === 'start' ? 'Rapor başlangıç tarihi' : pickerTarget === 'end' ? 'Rapor bitiş tarihi' : 'Rapor dönemini filtrele'}
                selectedMonth={pickerTarget === 'start' && customRange.start ? customRange.start : pickerTarget === 'end' && customRange.end ? customRange.end : selectedMonth}
                onSelect={(date) => {
                    if (pickerTarget === 'start') {
                        setCustomRange((prev) => ({ ...prev, start: date }));
                    } else if (pickerTarget === 'end') {
                        setCustomRange((prev) => ({ ...prev, end: date }));
                    } else {
                        setSelectedMonth(date);
                    }
                }}
                onClose={() => setShowMonthPicker(false)}
            />

            <PdfActionsSheet
                visible={showPdfSheet}
                onClose={() => setShowPdfSheet(false)}
                onSelectGeneral={() => openPdf('general')}
                onSelectTechnician={() => openPdf('technician')}
                onSelectTechnicianList={() => openPdf('technician')}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    topSection: { paddingBottom: 0 },
    topContent: { paddingHorizontal: 18, paddingBottom: 6 },
    tabContent: { flex: 1 },
    container: { paddingHorizontal: 18 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    headerText: { flex: 1, marginHorizontal: 14 },
    title: { fontSize: 28, fontWeight: '900' },
    subtitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
    periodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    periodChip: { flex: 1, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    periodText: { fontSize: 12, fontWeight: '900' },
    monthFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    monthArrowButton: { width: 44, height: 50, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    monthFilterCard: { flex: 1, minHeight: 58, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9, justifyContent: 'center' },
    monthFilterLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 },
    monthFilterValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    monthFilterValue: { fontSize: 16, fontWeight: '900' },
    customRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    customRangeCard: { flex: 1, minHeight: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center' },
    customRangeLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 3 },
    customRangeValue: { fontSize: 13, fontWeight: '900' },
    // Tab Bar
    tabBarWrapper: { borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 4 },
    tabBarContent: { alignItems: 'flex-end', paddingVertical: 6 },
    tabBarItem: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 0, minWidth: 50 },
    tabBarItemContent: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 10 },
    tabBarItemText: { fontSize: 13 },
    tabBarIndicator: { height: 3, width: '70%', alignSelf: 'center', borderRadius: 2 },
    tabBarIndicatorSpacer: { height: 3 },
    // Hero
    hero: { borderRadius: 24, padding: 20, marginBottom: 14 },
    heroLabel: { color: 'rgba(255,255,255,0.76)', fontSize: 13, fontWeight: '800', marginBottom: 6 },
    heroValue: { color: '#FFFFFF', fontSize: 32, fontWeight: '900' },
    heroMetaRow: { flexDirection: 'row', gap: 9, marginTop: 18 },
    heroMeta: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 10 },
    heroMetaValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
    heroMetaLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '700', marginTop: 3 },
    // Metrics
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
    metricBox: { width: '48.5%', borderWidth: 1, borderRadius: 20, padding: 14 },
    metricIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    metricValue: { fontSize: 18, fontWeight: '900' },
    metricLabel: { fontSize: 12, fontWeight: '700', marginTop: 3 },
    metricSub: { fontSize: 11, fontWeight: '800', marginTop: 4 },
    insightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    insightCard: { width: '48.2%', borderWidth: 1, borderRadius: 18, padding: 12, minHeight: 128 },
    insightIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    insightText: { flex: 1 },
    insightLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
    insightValue: { fontSize: 18, fontWeight: '900', marginTop: 5 },
    insightNote: { fontSize: 11, fontWeight: '800', marginTop: 5 },
    // Panel
    panel: { borderWidth: 1, borderRadius: 24, padding: 16, marginBottom: 14 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 18, fontWeight: '900', marginBottom: 12 },
    sectionHint: { fontSize: 12, fontWeight: '800' },
    // Progress
    progressRow: { marginBottom: 14 },
    progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    progressLabel: { fontSize: 13, fontWeight: '800' },
    progressValue: { fontSize: 12, fontWeight: '800' },
    progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 999 },
    // Chart
    chartWrap: { height: 128, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 },
    chartItem: { flex: 1, alignItems: 'center' },
    chartBarShell: { width: '72%', height: 94, borderRadius: 999, justifyContent: 'flex-end', overflow: 'hidden' },
    chartBar: { width: '100%', borderRadius: 999 },
    chartLabel: { fontSize: 9, fontWeight: '800', marginTop: 7 },
    // Performance
    mineRow: { flexDirection: 'row', gap: 8 },
    subPanel: { marginTop: 14 },
    subHeader: { marginBottom: 8 },
    subTitle: { fontSize: 14, fontWeight: '900' },
    miniServiceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
    miniServiceDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
    miniServiceInfo: { flex: 1, marginRight: 6 },
    miniServiceTitle: { fontSize: 13, fontWeight: '800' },
    miniServiceMeta: { fontSize: 11, fontWeight: '700', marginTop: 3 },
    techRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    rankBadge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    rankText: { fontSize: 14, fontWeight: '900' },
    techInfo: { flex: 1, marginRight: 6 },
    techName: { fontSize: 14, fontWeight: '900' },
    techMeta: { fontSize: 12, fontWeight: '700', marginTop: 3 },
    techRevenue: { fontSize: 13, fontWeight: '900', marginRight: 6 },
    // Receivable
    receivableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    receivableInfo: { flex: 1, marginRight: 10 },
    receivableTitle: { fontSize: 14, fontWeight: '900' },
    receivableMeta: { fontSize: 12, fontWeight: '700', marginTop: 3 },
    receivableSubMeta: { fontSize: 11, fontWeight: '700', marginTop: 4 },
    receivableAmountCol: { alignItems: 'flex-end' },
    receivableAmount: { fontSize: 13, fontWeight: '900' },
    receivableActions: { flexDirection: 'row', gap: 6, marginTop: 6 },
    receivableActionButton: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    loadMoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 6, marginTop: 8 },
    loadMoreText: { color: serviceBlue, fontSize: 13, fontWeight: '900' },
    // Activity
    activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    activityIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    activityInfo: { flex: 1, marginRight: 8 },
    activityTitle: { fontSize: 14, fontWeight: '900' },
    activityDesc: { fontSize: 12, fontWeight: '700', marginTop: 3 },
    activityMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
    activityStatusPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, gap: 5 },
    activityStatusDot: { width: 6, height: 6, borderRadius: 3 },
    activityStatusText: { fontSize: 10, fontWeight: '900' },
    activityTime: { fontSize: 11, fontWeight: '800' },
    // Glass Card
    glassCard: { borderRadius: 24, borderWidth: 1, padding: 18, marginBottom: 14, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
    sectionTitle: { fontSize: 18, fontWeight: '900' },
    sectionSubtitle: { fontSize: 12, fontWeight: '700', marginTop: 3 },
    // Composite Progress Bar
    progressOuter: { height: 12, borderRadius: 999, flexDirection: 'row', overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.04)' },
    progressSegment: { height: '100%' },
    // Progress Row
    progressRow: { marginBottom: 12 },
    progressRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    progressRowLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    progressRowDot: { width: 8, height: 8, borderRadius: 4 },
    progressRowLabel: { fontSize: 13, fontWeight: '800' },
    progressRowValue: { fontSize: 12, fontWeight: '800' },
    progressRowTrack: { height: 6, borderRadius: 999, overflow: 'hidden' },
    progressRowFill: { height: '100%', borderRadius: 999 },
    // Legend
    legendRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, fontWeight: '700' },
    // Metric Tile
    metricTile: { width: '48.4%', borderWidth: 1, borderRadius: 22, padding: 14, justifyContent: 'space-between' },
    metricIconWrap: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    metricValue: { fontSize: 17, fontWeight: '900' },
    metricLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
    metricSubPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 6 },
    metricSubText: { fontSize: 10, fontWeight: '900' },
    metricGrid2x2: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
    // Outstanding Card
    outstandingCard: { borderRadius: 24, padding: 18, marginBottom: 14, overflow: 'hidden' },
    outstandingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    outstandingIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    outstandingLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '800' },
    outstandingValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 3 },
    outstandingPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', gap: 5 },
    outstandingPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
    // Empty / Error
    emptyActionWrap: { alignItems: 'center', paddingVertical: 16, gap: 10 },
    emptyActionButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1, gap: 6 },
    emptyActionText: { color: serviceBlue, fontSize: 13, fontWeight: '900' },
    emptyText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
    errorCard: { flex: 1, borderWidth: 1, borderRadius: 22, padding: 28, margin: 18, alignItems: 'center', justifyContent: 'center', gap: 8 },
    errorTitle: { fontSize: 16, fontWeight: '900', marginTop: 4 },
    errorText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
    retryButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 14, gap: 8, marginTop: 8 },
    retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
    // PDF Sheet
    pdfActionList: { paddingHorizontal: 16, gap: 10 },
    pdfActionItem: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
    pdfActionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    pdfActionInfo: { flex: 1 },
    pdfActionTitle: { fontSize: 14, fontWeight: '900' },
    pdfActionSub: { fontSize: 12, fontWeight: '700', marginTop: 3 },
    // Month Sheet
    monthSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 28 },
    monthSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
    monthSheetTitle: { fontSize: 20, fontWeight: '900' },
    monthSheetSubtitle: { fontSize: 12, fontWeight: '700', marginTop: 3 },
    monthSheetClose: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    yearNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 14 },
    yearNavButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    yearText: { fontSize: 20, fontWeight: '900' },
    monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
    monthOption: { width: '30.9%', height: 48, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    monthOptionText: { fontSize: 14, fontWeight: '900', textTransform: 'capitalize' },
    thisMonthButton: { marginHorizontal: 16, marginTop: 16, minHeight: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    thisMonthText: { color: serviceBlue, fontSize: 14, fontWeight: '900' },
    // Skeleton overlay
    skeletonOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent', paddingHorizontal: 18, paddingTop: 14 },
});
