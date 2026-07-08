import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
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
import { useTheme } from '@/context/ThemeContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import { resolveMediaUrl } from '@/utils/mediaUrl';

const TABS = [
    { key: 'general', label: 'Genel' },
    { key: 'services', label: 'Servisleri' },
    { key: 'performance', label: 'Performans' },
    { key: 'permissions', label: 'Yetkiler' },
    { key: 'payroll', label: 'Bordro' },
    { key: 'leaves', label: 'Izinler' },
];

const PERMISSION_LABELS = [
    ['can_manage_services', 'Servis Goruntuleme'],
    ['can_manage_customers', 'Musteri Yonetimi'],
    ['can_manage_inventory', 'Urun Yonetimi'],
    ['can_manage_users', 'Kullanici Yonetimi'],
    ['can_manage_accounting', 'Muhasebe'],
    ['can_manage_notifications', 'Bildirimler'],
    ['can_manage_hr', 'IK Islemleri'],
    ['can_manage_reports', 'Raporlama'],
    ['can_manage_settings', 'Ayarlar'],
    ['can_manage_technicians', 'Teknisyen Yonetimi'],
];

const STATUS_META = {
    online: { label: 'Cevrimici', color: serviceGreen, bg: 'rgba(34,197,94,0.12)', dot: serviceGreen },
    offline: { label: 'Cevrimdisi', color: '#64748B', bg: 'rgba(100,116,139,0.12)', dot: '#94A3B8' },
    passive: { label: 'Pasif', color: serviceRed, bg: 'rgba(239,68,68,0.10)', dot: serviceRed },
};

const SERVICE_STATUS = {
    completed: { label: 'Tamamlandi', color: serviceGreen, bg: 'rgba(34,197,94,0.12)' },
    cancelled: { label: 'Iptal', color: serviceRed, bg: 'rgba(239,68,68,0.10)' },
    in_progress: { label: 'Devam Ediyor', color: serviceBlue, bg: 'rgba(59,130,246,0.12)' },
    assigned: { label: 'Planlandi', color: serviceBlue, bg: 'rgba(59,130,246,0.10)' },
    new: { label: 'Yeni', color: serviceOrange, bg: 'rgba(249,115,22,0.12)' },
};

const money = (value) => `₺${Number(value || 0).toLocaleString('tr-TR')}`;
const count = (value) => Number(value || 0).toLocaleString('tr-TR');

const getFullName = (technician) => (
    technician?.full_name ||
    technician?.user?.full_name ||
    [technician?.user?.first_name, technician?.user?.last_name].filter(Boolean).join(' ') ||
    technician?.user?.email ||
    'Teknisyen'
);

const getInitials = (name) => String(name || 'T')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const getStatusKey = (technician) => {
    if (!technician?.user?.is_active) return 'passive';
    return technician?.is_online ? 'online' : 'offline';
};

const normalizePhone = (value) => String(value || '').replace(/[^\d+]/g, '');

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' • ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};

const formatLastSeen = (value, isOnline) => {
    if (isOnline) return 'Simdi';
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'Az once';
    if (diff < 3600) return `${Math.floor(diff / 60)} dk once`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} sa once`;
    return formatDateTime(value);
};

const getServiceTitle = (service) => {
    const device = [service?.device_brand, service?.device_model].filter(Boolean).join(' ');
    return service?.fault_description || device || service?.customer_full_name || 'Servis Kaydi';
};

const getServiceStatus = (service) => {
    const key = service?.service_status || (service?.is_completed ? 'completed' : 'assigned');
    return SERVICE_STATUS[key] || { label: 'Servis', color: serviceBlue, bg: 'rgba(59,130,246,0.10)' };
};

const getAttendanceHours = (record) => {
    if (!record?.start_time || !record?.end_time) return 0;
    const [startHour, startMinute] = String(record.start_time).split(':').map(Number);
    const [endHour, endMinute] = String(record.end_time).split(':').map(Number);
    if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) return 0;
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    return Math.max(0, (end - start) / 60);
};

const serviceIconFor = (service) => {
    const type = String(service?.device_type || '').toLowerCase();
    if (type.includes('camasir') || type.includes('washer')) return 'washing-machine';
    if (type.includes('tv') || type.includes('televizyon')) return 'television';
    if (type.includes('klima')) return 'air-conditioner';
    if (type.includes('telefon') || type.includes('phone')) return 'cellphone';
    return 'clipboard-text-outline';
};

function HeaderAction({ icon, onPress, colors }) {
    return (
        <Pressable onPress={onPress} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name={icon} size={22} color={serviceBlue} />
        </Pressable>
    );
}

function StatCard({ icon, label, value, color, colors }) {
    return (
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: `${color}14` }]}>
                <MaterialCommunityIcons name={icon} size={18} color={color} />
            </View>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
        </View>
    );
}

function ServiceRow({ service, colors }) {
    const status = getServiceStatus(service);
    return (
        <View style={[styles.serviceRow, { borderBottomColor: colors.divider || colors.border }]}>
            <View style={[styles.serviceIcon, { backgroundColor: `${serviceBlue}10` }]}>
                <MaterialCommunityIcons name={serviceIconFor(service)} size={20} color={serviceBlue} />
            </View>
            <View style={styles.serviceInfo}>
                <Text style={[styles.serviceTitle, { color: colors.text }]} numberOfLines={1}>{getServiceTitle(service)}</Text>
                <Text style={[styles.serviceMeta, { color: colors.textSecondary }]} numberOfLines={1}>{formatDateTime(service?.scheduled_date)}</Text>
            </View>
            <View style={styles.serviceRowRight}>
                <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
            </View>
        </View>
    );
}

function PermissionChip({ label, enabled, colors }) {
    return (
        <View style={[styles.permissionChip, { backgroundColor: enabled ? 'rgba(34,197,94,0.12)' : colors.surfaceMuted, borderColor: enabled ? 'rgba(34,197,94,0.18)' : colors.border }]}>
            <MaterialCommunityIcons name={enabled ? 'check-circle-outline' : 'close-circle-outline'} size={14} color={enabled ? serviceGreen : colors.textTertiary} />
            <Text style={[styles.permissionText, { color: enabled ? serviceGreen : colors.textSecondary }]}>{label}</Text>
        </View>
    );
}

function MiniMetric({ label, value, colors, accent }) {
    return (
        <View style={styles.miniMetric}>
            <Text style={[styles.miniMetricLabel, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[styles.miniMetricValue, { color: accent || colors.text }]}>{value}</Text>
        </View>
    );
}

export default function TechnicianDetailScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const technicianId = route?.params?.technicianId || route?.params?.id || route?.params?.technician?.id || null;
    const initialTechnician = route?.params?.technician || null;

    const [technician, setTechnician] = useState(initialTechnician);
    const [performance, setPerformance] = useState(null);
    const [payrolls, setPayrolls] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(!initialTechnician);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('general');

    const fetchData = useCallback(async () => {
        if (!technicianId) {
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            const now = new Date();
            const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const [technicianRes, performanceRes, payrollRes, attendanceRes] = await Promise.all([
                api.get(ENDPOINTS.TECHNICIAN.DETAIL(technicianId)),
                api.get(ENDPOINTS.REPORTS.TECHNICIAN_DETAIL(technicianId), { params: { year: now.getFullYear(), month: now.getMonth() + 1 } }).catch(() => ({ data: null })),
                api.get(ENDPOINTS.HR.PAYROLLS, { params: { technician: technicianId } }).catch(() => ({ data: [] })),
                api.get('technicians/attendance/', { params: { technician: technicianId, month, include_shift: 'false' } }).catch(() => ({ data: [] })),
            ]);

            setTechnician(technicianRes?.data || null);
            setPerformance(performanceRes?.data || null);
            const payrollList = Array.isArray(payrollRes?.data) ? payrollRes.data : payrollRes?.data?.results || [];
            const attendanceList = Array.isArray(attendanceRes?.data) ? attendanceRes.data : [];
            setPayrolls(payrollList.slice().sort((a, b) => new Date(b.period_start || 0) - new Date(a.period_start || 0)));
            setAttendance(attendanceList.slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
        } catch (error) {
            console.log('Technician detail fetch error:', error?.response?.data || error?.message || error);
            Alert.alert('Hata', 'Teknisyen bilgileri yuklenemedi.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [technicianId]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const profile = useMemo(() => {
        const name = getFullName(technician);
        const statusKey = getStatusKey(technician);
        const permissions = technician?.permissions || {};
        const avatar = resolveMediaUrl(technician?.user?.profile_picture || technician?.user?.avatar || technician?.user?.avatar_url || technician?.avatar);
        return {
            name,
            initials: getInitials(name),
            status: STATUS_META[statusKey] || STATUS_META.offline,
            isOnline: statusKey === 'online',
            permissions,
            avatar,
            phone: technician?.user?.phone_number || technician?.phone_number || '',
            role: technician?.title || technician?.user?.user_type_display || 'Elektronik Servis Teknisyeni',
            email: technician?.user?.email || technician?.email || '-',
            location: technician?.current_location?.address || technician?.location || technician?.address || 'Konum bilgisi yok',
            activePermissions: PERMISSION_LABELS.filter(([key]) => Boolean(permissions[key])),
        };
    }, [technician]);

    const services = Array.isArray(performance?.services) ? performance.services : [];
    const activeServices = services.filter((service) => !service?.is_completed && service?.service_status !== 'cancelled');
    const completedServices = Number(performance?.completed_services_count || 0);
    const pendingServices = Number(performance?.pending_services_count || 0);
    const totalServices = completedServices + pendingServices;
    const completionRate = totalServices ? Math.round((completedServices / totalServices) * 100) : 0;
    const latestPayroll = payrolls[0] || null;
    const leaveRecords = attendance.filter((item) => item?.status === 'leave');
    const overtimeHours = attendance.reduce((sum, item) => item?.status !== 'worked' ? sum : sum + Math.max(0, getAttendanceHours(item) - 9), 0);
    const performanceBars = [
        Math.max(18, Math.min(64, completedServices * 6)),
        Math.max(18, Math.min(64, pendingServices * 6)),
        Math.max(18, Math.min(64, profile.activePermissions.length * 6)),
        Math.max(18, Math.min(64, Math.round(overtimeHours) * 6)),
    ];

    const onRefresh = () => { setRefreshing(true); fetchData(); };
    const openPhoneUrl = (builder, missingMessage) => {
        const phone = normalizePhone(profile.phone);
        if (!phone) {
            Alert.alert('Bilgi Eksik', missingMessage);
            return;
        }
        Linking.openURL(builder(phone)).catch(() => Alert.alert('Hata', 'Islem baslatilamadi.'));
    };

    const handleCall = () => openPhoneUrl((phone) => `tel:${phone}`, 'Bu teknisyen icin telefon numarasi tanimli degil.');
    const handleSms = () => openPhoneUrl((phone) => `sms:${phone}`, 'Bu teknisyen icin telefon numarasi tanimli degil.');
    const handleLocation = () => navigation.navigate('TechnicianLocations', { technicianId, technicianName: profile.name });
    const handleShifts = () => navigation.navigate('TechnicianShifts', { technicianId, technicianName: profile.name });
    const handleLeaves = () => navigation.navigate('AdminTechnicianLeaves', { technicianId, technicianName: profile.name });
    const handlePayroll = () => navigation.navigate('AdminPayroll', { technicianId, technicianName: profile.name });

    if (loading && !technician) {
        return <View style={[styles.screen, styles.centerContainer, { backgroundColor: colors.backgroundSecondary }]}><ActivityIndicator size="large" color={serviceBlue} /></View>;
    }
    if (!technician) {
        return <View style={[styles.screen, styles.centerContainer, { backgroundColor: colors.backgroundSecondary }]}><Text style={[styles.emptyText, { color: colors.textSecondary }]}>Teknisyen bulunamadi</Text></View>;
    }

    const renderPerformanceSummary = () => (
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Performans Ozeti</Text>
                <Text style={[styles.sectionLink, { color: colors.textSecondary }]}>Son 30 Gun</Text>
            </View>
            <View style={styles.metricsRow}>
                <MiniMetric label="Tamamlama" value={`%${completionRate}`} colors={colors} />
                <MiniMetric label="Acik Servis" value={count(pendingServices)} colors={colors} accent={serviceOrange} />
                <MiniMetric label="Yetki" value={count(profile.activePermissions.length)} colors={colors} accent={serviceGreen} />
                <MiniMetric label="Tahsilat" value={money(performance?.total_revenue_generated)} colors={colors} />
            </View>
            <View style={styles.chartRow}>
                {performanceBars.map((height, index) => <View key={String(index)} style={[styles.chartBar, { height, backgroundColor: index % 2 === 0 ? serviceBlue : '#93C5FD' }]} />)}
            </View>
        </View>
    );

    const renderActiveServices = (fullList = false) => {
        const list = fullList ? activeServices : activeServices.slice(0, 3);
        return (
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Aktif Servisler</Text>
                    {!fullList ? <Pressable onPress={() => setActiveTab('services')}><Text style={[styles.sectionLink, { color: serviceBlue }]}>Tumunu Gor</Text></Pressable> : null}
                </View>
                {list.length === 0 ? <View style={styles.emptyBlock}><MaterialCommunityIcons name="clipboard-check-outline" size={34} color={colors.textTertiary} /><Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aktif servis bulunamadi</Text></View> : list.map((service) => <ServiceRow key={String(service.id)} service={service} colors={colors} />)}
            </View>
        );
    };

    const renderPermissionsCard = () => (
        <View style={[styles.halfCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Yetkiler</Text>
            <View style={styles.permissionGrid}>{PERMISSION_LABELS.slice(0, 6).map(([key, label]) => <PermissionChip key={key} label={label} enabled={Boolean(profile.permissions[key])} colors={colors} />)}</View>
        </View>
    );
    const renderPayrollCard = () => (
        <View style={[styles.halfCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Bordro Ozeti</Text>
            <View style={styles.summaryLine}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Maas</Text><Text style={[styles.summaryValue, { color: colors.text }]}>{money(latestPayroll?.base_salary)}</Text></View>
            <View style={styles.summaryLine}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Prim</Text><Text style={[styles.summaryValue, { color: serviceGreen }]}>{money(latestPayroll?.total_premiums)}</Text></View>
            <View style={styles.summaryLine}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Kesinti</Text><Text style={[styles.summaryValue, { color: serviceRed }]}>{money(latestPayroll?.total_deductions)}</Text></View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryLine}><Text style={[styles.netLabel, { color: colors.text }]}>Net Bordro</Text><Text style={[styles.netValue, { color: colors.text }]}>{money(latestPayroll?.net_salary)}</Text></View>
            <Pressable onPress={handlePayroll} style={[styles.inlineButton, { borderColor: colors.border }]}><MaterialCommunityIcons name="file-document-outline" size={18} color={serviceBlue} /><Text style={[styles.inlineButtonText, { color: serviceBlue }]}>Bordro Detayi</Text></Pressable>
        </View>
    );

    const renderLeavesCard = () => (
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Izinler ve Mesai</Text>
            <View style={styles.leaveStatsRow}>
                <View style={styles.leaveStat}><View style={[styles.leaveStatIcon, { backgroundColor: 'rgba(34,197,94,0.12)' }]}><MaterialCommunityIcons name="calendar-month-outline" size={18} color={serviceGreen} /></View><Text style={[styles.leaveStatLabel, { color: colors.textSecondary }]}>Bu Ay Izin</Text><Text style={[styles.leaveStatValue, { color: colors.text }]}>{count(leaveRecords.length)} gun</Text></View>
                <View style={styles.leaveStat}><View style={[styles.leaveStatIcon, { backgroundColor: 'rgba(249,115,22,0.12)' }]}><MaterialCommunityIcons name="clock-outline" size={18} color={serviceOrange} /></View><Text style={[styles.leaveStatLabel, { color: colors.textSecondary }]}>Fazla Mesai</Text><Text style={[styles.leaveStatValue, { color: colors.text }]}>{overtimeHours.toFixed(1)} sa</Text></View>
                <View style={styles.leaveStat}><View style={[styles.leaveStatIcon, { backgroundColor: 'rgba(168,85,247,0.12)' }]}><MaterialCommunityIcons name="calendar-check-outline" size={18} color="#A855F7" /></View><Text style={[styles.leaveStatLabel, { color: colors.textSecondary }]}>Son Izin</Text><Text style={[styles.leaveStatValue, { color: colors.text }]}>{formatDate(leaveRecords[0]?.date)}</Text></View>
            </View>
        </View>
    );

    const renderGeneral = () => <>{renderPerformanceSummary()}{renderActiveServices(false)}<View style={styles.twoColumnRow}>{renderPermissionsCard()}{renderPayrollCard()}</View>{renderLeavesCard()}</>;
    const renderPerformance = () => <>{renderPerformanceSummary()}<View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.sectionTitle, { color: colors.text }]}>Servis Dagilimi</Text><View style={styles.metricsRow}><MiniMetric label="Bu Ay Servis" value={count(totalServices)} colors={colors} /><MiniMetric label="Tamamlanan" value={count(completedServices)} colors={colors} accent={serviceGreen} /><MiniMetric label="Acik" value={count(pendingServices)} colors={colors} accent={serviceOrange} /><MiniMetric label="Tahsilat" value={money(performance?.total_revenue_generated)} colors={colors} /></View></View></>;
    const renderPermissions = () => <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.sectionTitle, { color: colors.text }]}>Yetkiler</Text><View style={styles.permissionGrid}>{PERMISSION_LABELS.map(([key, label]) => <PermissionChip key={key} label={label} enabled={Boolean(profile.permissions[key])} colors={colors} />)}</View></View>;
    const renderPayroll = () => (
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.text }]}>Bordro Ozeti</Text><Pressable onPress={handlePayroll}><Text style={[styles.sectionLink, { color: serviceBlue }]}>Listeyi Ac</Text></Pressable></View>
            {latestPayroll ? <><View style={styles.summaryLine}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Donem</Text><Text style={[styles.summaryValue, { color: colors.text }]}>{formatDate(latestPayroll.period_start)}</Text></View><View style={styles.summaryLine}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Maas</Text><Text style={[styles.summaryValue, { color: colors.text }]}>{money(latestPayroll.base_salary)}</Text></View><View style={styles.summaryLine}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Prim</Text><Text style={[styles.summaryValue, { color: serviceGreen }]}>{money(latestPayroll.total_premiums)}</Text></View><View style={styles.summaryLine}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Kesinti</Text><Text style={[styles.summaryValue, { color: serviceRed }]}>{money(latestPayroll.total_deductions)}</Text></View><View style={[styles.summaryDivider, { backgroundColor: colors.border }]} /><View style={styles.summaryLine}><Text style={[styles.netLabel, { color: colors.text }]}>Net Bordro</Text><Text style={[styles.netValue, { color: colors.text }]}>{money(latestPayroll.net_salary)}</Text></View></> : <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Bordro kaydi bulunamadi</Text>}
        </View>
    );
    const renderLeaves = () => <>{renderLeavesCard()}<View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.text }]}>Izin Kayitlari</Text><Pressable onPress={handleLeaves}><Text style={[styles.sectionLink, { color: serviceBlue }]}>Yonet</Text></Pressable></View>{leaveRecords.length === 0 ? <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Bu ay icin izin kaydi yok</Text> : leaveRecords.slice(0, 4).map((item) => <View key={String(item.id)} style={[styles.listLine, { borderBottomColor: colors.border }]}><Text style={[styles.listLineTitle, { color: colors.text }]}>{formatDate(item.date)}</Text><Text style={[styles.listLineValue, { color: colors.textSecondary }]}>{item.note || 'Izin kaydi'}</Text></View>)}</View></>;

    return (
        <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name="arrow-left" size={22} color={serviceBlue} /></Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Teknisyen Detayi</Text>
                <View style={styles.headerActions}><HeaderAction icon="magnify" onPress={() => setActiveTab('services')} colors={colors} /><HeaderAction icon="tune-variant" onPress={() => setActiveTab('permissions')} colors={colors} /></View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[serviceBlue]} />}>
                <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.heroTopRow}>
                        <View style={styles.avatarWrap}>{profile.avatar ? <Image source={{ uri: profile.avatar }} style={styles.avatar} /> : <View style={[styles.avatarFallback, { backgroundColor: `${serviceBlue}14` }]}><Text style={[styles.avatarText, { color: serviceBlue }]}>{profile.initials}</Text></View>}<View style={[styles.onlineDot, { backgroundColor: profile.status.dot, borderColor: colors.surface }]} /></View>
                        <View style={styles.heroInfo}><Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>{profile.name}</Text><Text style={[styles.profileRole, { color: colors.textSecondary }]} numberOfLines={1}>{profile.role}</Text><View style={styles.locationRow}><MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.textSecondary} /><Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>{profile.location}</Text></View></View>
                        <View style={styles.heroRight}><View style={[styles.statusBadge, { backgroundColor: profile.status.bg }]}><Text style={[styles.statusBadgeText, { color: profile.status.color }]}>{profile.status.label}</Text></View><Pressable onPress={handlePayroll} hitSlop={8}><MaterialCommunityIcons name="dots-vertical" size={20} color={colors.textSecondary} /></Pressable></View>
                    </View>
                    <View style={[styles.heroDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.profileMetaRow}><View style={styles.profileMetaItem}><MaterialCommunityIcons name="clock-outline" size={20} color={serviceBlue} /><View><Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Ise Baslama</Text><Text style={[styles.metaValue, { color: colors.text }]}>{formatDate(technician.hire_date)}</Text></View></View><View style={[styles.verticalDivider, { backgroundColor: colors.border }]} /><View style={styles.profileMetaItem}><View style={[styles.liveDot, { backgroundColor: profile.status.dot }]} /><View><Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Son Gorulme</Text><Text style={[styles.metaValue, { color: profile.isOnline ? serviceGreen : colors.text }]}>{formatLastSeen(technician.last_online, profile.isOnline)}</Text></View></View></View>
                    <View style={styles.actionRow}><Pressable onPress={handleCall} style={[styles.actionButton, { borderColor: colors.border }]}><MaterialCommunityIcons name="phone-outline" size={18} color={serviceBlue} /><Text style={[styles.actionText, { color: colors.textSecondary }]}>Ara</Text></Pressable><Pressable onPress={handleSms} style={[styles.actionButton, { borderColor: colors.border }]}><MaterialCommunityIcons name="message-text-outline" size={18} color={serviceBlue} /><Text style={[styles.actionText, { color: colors.textSecondary }]}>Mesaj</Text></Pressable><Pressable onPress={handleLocation} style={[styles.actionButton, { borderColor: colors.border }]}><MaterialCommunityIcons name="map-marker-outline" size={18} color={serviceBlue} /><Text style={[styles.actionText, { color: colors.textSecondary }]}>Konum</Text></Pressable></View>
                </View>
                <View style={styles.statsRow}><StatCard icon="calendar-month-outline" label="Bu Ay Servis" value={count(totalServices)} color={serviceBlue} colors={colors} /><StatCard icon="check-circle-outline" label="Tamamlanan" value={count(completedServices)} color={serviceGreen} colors={colors} /><StatCard icon="chart-line-variant" label="Performans" value={`%${completionRate}`} color="#A855F7" colors={colors} /><StatCard icon="cash-multiple" label="Bu Ay Kazanc" value={money(performance?.total_revenue_generated)} color={serviceOrange} colors={colors} /></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>{TABS.map((tab) => { const isActive = activeTab === tab.key; return <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.tabPill, { backgroundColor: isActive ? `${serviceBlue}10` : colors.surface, borderColor: isActive ? serviceBlue : colors.border }]}><Text style={[styles.tabPillText, { color: isActive ? serviceBlue : colors.textSecondary }]}>{tab.label}</Text></Pressable>; })}</ScrollView>
                {activeTab === 'general' && renderGeneral()}
                {activeTab === 'services' && renderActiveServices(true)}
                {activeTab === 'performance' && renderPerformance()}
                {activeTab === 'permissions' && renderPermissions()}
                {activeTab === 'payroll' && renderPayroll()}
                {activeTab === 'leaves' && renderLeaves()}
            </ScrollView>

            <View style={[styles.bottomBar, { backgroundColor: colors.backgroundSecondary, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 }]}><Pressable onPress={handleShifts} style={[styles.bottomPrimary, { backgroundColor: serviceBlue }]}><MaterialCommunityIcons name="pencil-outline" size={20} color="#FFFFFF" /><Text style={styles.bottomPrimaryText}>Mesai</Text></Pressable><Pressable onPress={handleLeaves} style={[styles.bottomSecondary, { backgroundColor: colors.surface, borderColor: serviceBlue }]}><MaterialCommunityIcons name="shield-account-outline" size={20} color={serviceBlue} /><Text style={[styles.bottomSecondaryText, { color: serviceBlue }]}>Izinleri Yonet</Text></Pressable></View>
        </View>
    );
}
const styles = StyleSheet.create({
    screen: { flex: 1 },
    centerContainer: { alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '900' },
    headerActions: { flexDirection: 'row', gap: 10 },
    iconButton: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },
    heroCard: { borderRadius: 20, borderWidth: 1, padding: 16 },
    heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    avatarWrap: { position: 'relative' },
    avatar: { width: 84, height: 84, borderRadius: 42 },
    avatarFallback: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 26, fontWeight: '900' },
    onlineDot: { position: 'absolute', right: 1, bottom: 2, width: 20, height: 20, borderRadius: 10, borderWidth: 3 },
    heroInfo: { flex: 1, minWidth: 0, paddingTop: 4 },
    heroRight: { alignItems: 'flex-end', gap: 12 },
    profileName: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
    profileRole: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    locationText: { flex: 1, fontSize: 12, fontWeight: '700' },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
    statusBadgeText: { fontSize: 12, fontWeight: '900' },
    heroDivider: { height: 1, marginVertical: 16 },
    profileMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    profileMetaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    metaLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
    metaValue: { fontSize: 13, fontWeight: '900' },
    liveDot: { width: 10, height: 10, borderRadius: 5, marginTop: 2 },
    verticalDivider: { width: 1, alignSelf: 'stretch', marginHorizontal: 10 },
    actionRow: { flexDirection: 'row', gap: 10 },
    actionButton: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    actionText: { fontSize: 13, fontWeight: '800' },
    statsRow: { flexDirection: 'row', gap: 8 },
    statCard: { flex: 1, minWidth: 0, borderRadius: 16, borderWidth: 1, padding: 12 },
    statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    statLabel: { fontSize: 10, fontWeight: '800', marginBottom: 4 },
    statValue: { fontSize: 15, fontWeight: '900' },
    tabsRow: { gap: 8, paddingBottom: 2 },
    tabPill: { height: 40, borderRadius: 999, borderWidth: 1, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
    tabPillText: { fontSize: 13, fontWeight: '900' },
    sectionCard: { borderRadius: 18, borderWidth: 1, padding: 16 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    sectionTitle: { fontSize: 16, fontWeight: '900' },
    sectionLink: { fontSize: 12, fontWeight: '800' },
    metricsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    miniMetric: { flex: 1, minWidth: 0 },
    miniMetricLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6 },
    miniMetricValue: { fontSize: 18, fontWeight: '900' },
    chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 8, marginTop: 16, height: 72 },
    chartBar: { width: 10, borderRadius: 999 },
    serviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    serviceIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    serviceInfo: { flex: 1, minWidth: 0 },
    serviceTitle: { fontSize: 14, fontWeight: '900', marginBottom: 4 },
    serviceMeta: { fontSize: 12, fontWeight: '700' },
    serviceRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
    statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
    statusPillText: { fontSize: 11, fontWeight: '900' },
    twoColumnRow: { flexDirection: 'row', gap: 12 },
    halfCard: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 16 },
    cardTitle: { fontSize: 16, fontWeight: '900', marginBottom: 14 },
    permissionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    permissionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
    permissionText: { fontSize: 12, fontWeight: '800' },
    summaryLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 },
    summaryLabel: { fontSize: 13, fontWeight: '700' },
    summaryValue: { fontSize: 14, fontWeight: '800' },
    summaryDivider: { height: 1, marginVertical: 6 },
    netLabel: { fontSize: 15, fontWeight: '900' },
    netValue: { fontSize: 18, fontWeight: '900' },
    inlineButton: { marginTop: 14, height: 42, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    inlineButtonText: { fontSize: 13, fontWeight: '900' },
    leaveStatsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    leaveStat: { flex: 1, minWidth: 0 },
    leaveStatIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    leaveStatLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
    leaveStatValue: { fontSize: 16, fontWeight: '900' },
    listLine: { paddingVertical: 12, borderBottomWidth: 1 },
    listLineTitle: { fontSize: 14, fontWeight: '900', marginBottom: 4 },
    listLineValue: { fontSize: 12, fontWeight: '700' },
    emptyBlock: { alignItems: 'center', justifyContent: 'center', paddingVertical: 26, gap: 10 },
    emptyText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
    bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
    bottomPrimary: { flex: 1, height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    bottomPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
    bottomSecondary: { flex: 1, height: 52, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    bottomSecondaryText: { fontSize: 15, fontWeight: '900' },
});