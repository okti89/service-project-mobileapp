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
    { key: 'overview', label: 'Genel' },
    { key: 'services', label: 'Servisler' },
    { key: 'permissions', label: 'Yetkiler' },
];

const PERMISSION_LABELS = [
    ['can_manage_services', 'Servis Yönetimi'],
    ['can_manage_customers', 'Müşteri Yönetimi'],
    ['can_manage_technicians', 'Teknisyen Yönetimi'],
    ['can_manage_users', 'Kullanıcı Yönetimi'],
    ['can_manage_inventory', 'Ürün & Envanter'],
    ['can_manage_accounting', 'Muhasebe'],
    ['can_manage_hr', 'İnsan Kaynakları'],
    ['can_manage_reports', 'Raporlar'],
    ['can_manage_notifications', 'Bildirimler'],
    ['can_manage_settings', 'Ayarlar'],
    ['can_use_global_search', 'Genel Arama'],
];

const STATUS_META = {
    online: { label: 'Çevrimiçi', color: serviceGreen, bg: 'rgba(0, 163, 108, 0.12)', dot: serviceGreen },
    offline: { label: 'Çevrimdışı', color: '#64748B', bg: 'rgba(100, 116, 139, 0.12)', dot: '#94A3B8' },
    passive: { label: 'Pasif', color: serviceRed, bg: 'rgba(220, 53, 69, 0.10)', dot: serviceRed },
};

const SERVICE_STATUS = {
    completed: { label: 'Tamamlandı', color: serviceGreen, bg: 'rgba(0, 163, 108, 0.12)' },
    cancelled: { label: 'İptal', color: serviceRed, bg: 'rgba(220, 53, 69, 0.10)' },
    in_progress: { label: 'Devam Ediyor', color: serviceBlue, bg: 'rgba(0, 102, 204, 0.12)' },
    assigned: { label: 'Planlandı', color: serviceBlue, bg: 'rgba(0, 102, 204, 0.10)' },
    new: { label: 'Yeni', color: serviceOrange, bg: 'rgba(255, 140, 0, 0.12)' },
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
    .map(part => part[0])
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
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const formatLastSeen = (value, isOnline) => {
    if (isOnline) return 'Şimdi';
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'Az önce';
    if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
    return formatDateTime(value);
};

const getServiceTitle = (service) => {
    const device = [service?.device_brand, service?.device_model].filter(Boolean).join(' ');
    return service?.fault_description || device || service?.customer_full_name || 'Servis kaydı';
};

const getServiceStatus = (service) => {
    const key = service?.service_status || (service?.is_completed ? 'completed' : 'assigned');
    return SERVICE_STATUS[key] || { label: key || 'Servis', color: serviceBlue, bg: 'rgba(0, 102, 204, 0.10)' };
};

function StatCard({ icon, label, value, color, colors }) {
    return (
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: `${color}14` }]}>
                <MaterialCommunityIcons name={icon} size={20} color={color} />
            </View>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
        </View>
    );
}

function InfoPair({ icon, label, value, colors }) {
    return (
        <View style={styles.infoPair}>
            <MaterialCommunityIcons name={icon} size={18} color={serviceBlue} />
            <View style={styles.infoPairText}>
                <Text style={[styles.infoPairLabel, { color: colors.textSecondary }]}>{label}</Text>
                <Text style={[styles.infoPairValue, { color: colors.text }]} numberOfLines={1}>{value || '-'}</Text>
            </View>
        </View>
    );
}

function PermissionChip({ label, enabled, colors }) {
    return (
        <View style={[
            styles.permissionChip,
            {
                backgroundColor: enabled ? 'rgba(0, 163, 108, 0.12)' : colors.surfaceMuted,
                borderColor: enabled ? 'rgba(0, 163, 108, 0.22)' : colors.border,
            },
        ]}>
            <MaterialCommunityIcons
                name={enabled ? 'check-circle-outline' : 'close-circle-outline'}
                size={14}
                color={enabled ? serviceGreen : colors.textTertiary}
            />
            <Text style={[styles.permissionText, { color: enabled ? serviceGreen : colors.textSecondary }]} numberOfLines={1}>{label}</Text>
        </View>
    );
}

function ServiceRow({ service, colors }) {
    const status = getServiceStatus(service);
    return (
        <View style={[styles.serviceRow, { borderBottomColor: colors.divider }]}>
            <View style={[styles.serviceIcon, { backgroundColor: `${serviceBlue}12` }]}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={20} color={serviceBlue} />
            </View>
            <View style={styles.serviceInfo}>
                <Text style={[styles.serviceTitle, { color: colors.text }]} numberOfLines={1}>{getServiceTitle(service)}</Text>
                <Text style={[styles.serviceMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                    {service?.receipt_number ? `#${service.receipt_number} • ` : ''}{formatDateTime(service?.scheduled_date)}
                </Text>
            </View>
            <View style={[styles.serviceBadge, { backgroundColor: status.bg }]}>
                <Text style={[styles.serviceBadgeText, { color: status.color }]} numberOfLines={1}>{status.label}</Text>
            </View>
        </View>
    );
}

export default function TechnicianDetailScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const technicianId = route?.params?.technicianId || route?.params?.id || route?.params?.technician?.id || null;
    const initialTechnician = route?.params?.technician || null;

    const [technician, setTechnician] = useState(initialTechnician);
    const [performance, setPerformance] = useState(null);
    const [loading, setLoading] = useState(!initialTechnician);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    const fetchTechnician = useCallback(async () => {
        if (!technicianId) return null;
        const response = await api.get(ENDPOINTS.TECHNICIAN.DETAIL(technicianId));
        setTechnician(response?.data || null);
        return response?.data || null;
    }, [technicianId]);

    const fetchPerformance = useCallback(async () => {
        if (!technicianId) return null;
        const now = new Date();
        const response = await api.get(ENDPOINTS.REPORTS.TECHNICIAN_DETAIL(technicianId), {
            params: { year: now.getFullYear(), month: now.getMonth() + 1 },
        });
        setPerformance(response?.data || null);
        return response?.data || null;
    }, [technicianId]);

    const fetchData = useCallback(async () => {
        if (!technicianId) {
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            await Promise.all([fetchTechnician(), fetchPerformance().catch((error) => {
                console.log('Technician performance fetch error:', error?.response?.data || error?.message || error);
                setPerformance(null);
            })]);
        } catch (error) {
            console.log('Technician detail fetch error:', error?.response?.data || error?.message || error);
            Alert.alert('Hata', 'Teknisyen bilgileri yüklenemedi');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [fetchPerformance, fetchTechnician, technicianId]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const profile = useMemo(() => {
        const name = getFullName(technician);
        const statusKey = getStatusKey(technician);
        const status = STATUS_META[statusKey] || STATUS_META.offline;
        const permissions = technician?.permissions || {};
        const activePermissions = PERMISSION_LABELS.filter(([key]) => Boolean(permissions[key]));
        const avatar = resolveMediaUrl(technician?.user?.profile_picture || technician?.user?.avatar || technician?.user?.avatar_url || technician?.avatar);

        return {
            name,
            initials: getInitials(name),
            status,
            isOnline: statusKey === 'online',
            permissions,
            activePermissions,
            avatar,
            phone: technician?.user?.phone_number || technician?.phone_number || '',
            email: technician?.user?.email || technician?.email || '-',
            role: technician?.user?.user_type_display || technician?.title || 'Teknisyen',
            location: technician?.current_location?.address || technician?.location || technician?.address || '-',
        };
    }, [technician]);

    const services = Array.isArray(performance?.services) ? performance.services : [];
    const activeServices = services.filter(service => !service?.is_completed && service?.service_status !== 'cancelled');
    const completed = Number(performance?.completed_services_count || 0);
    const pending = Number(performance?.pending_services_count || 0);
    const totalServices = completed + pending;
    const completionRate = totalServices ? Math.round((completed / totalServices) * 100) : 0;

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const openPhoneUrl = (builder, missingMessage) => {
        const phone = normalizePhone(profile.phone);
        if (!phone) {
            Alert.alert('Bilgi eksik', missingMessage);
            return;
        }
        Linking.openURL(builder(phone)).catch(() => Alert.alert('Hata', 'İşlem başlatılamadı'));
    };

    const handleCall = () => openPhoneUrl((phone) => `tel:${phone}`, 'Bu teknisyen için telefon numarası tanımlı değil.');
    const handleSms = () => openPhoneUrl((phone) => `sms:${phone}`, 'Bu teknisyen için telefon numarası tanımlı değil.');
    const handleLocation = () => navigation.navigate('TechnicianLocations', { technicianId, technicianName: profile.name });
    const handleShifts = () => navigation.navigate('TechnicianShifts', { technicianId, technicianName: profile.name });
    const handleLeaves = () => navigation.navigate('AdminTechnicianLeaves', { technicianId, technicianName: profile.name });

    if (loading && !technician) {
        return (
            <View style={[styles.screen, styles.centerContainer, { backgroundColor: colors.backgroundSecondary }]}>
                <ActivityIndicator size="large" color={serviceBlue} />
            </View>
        );
    }

    if (!technician) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <Pressable onPress={() => navigation.goBack()} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Teknisyen Detayı</Text>
                    <View style={styles.headerSpacer} />
                </View>
                <View style={styles.centerContainer}>
                    <MaterialCommunityIcons name="account-alert-outline" size={44} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Teknisyen bulunamadı</Text>
                </View>
            </View>
        );
    }

    const renderOverview = () => (
        <>
            <View style={[styles.performanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Performans Özeti</Text>
                    <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>Bu ay</Text>
                </View>
                <View style={styles.performanceRow}>
                    <View style={styles.performanceMetric}>
                        <Text style={[styles.performanceValue, { color: colors.text }]}>{completionRate}%</Text>
                        <Text style={[styles.performanceLabel, { color: colors.textSecondary }]}>Tamamlama</Text>
                    </View>
                    <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.performanceMetric}>
                        <Text style={[styles.performanceValue, { color: serviceGreen }]}>{count(completed)}</Text>
                        <Text style={[styles.performanceLabel, { color: colors.textSecondary }]}>Tamamlanan</Text>
                    </View>
                    <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.performanceMetric}>
                        <Text style={[styles.performanceValue, { color: serviceOrange }]}>{count(pending)}</Text>
                        <Text style={[styles.performanceLabel, { color: colors.textSecondary }]}>Açık</Text>
                    </View>
                </View>
            </View>

            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>İletişim ve Kayıt</Text>
                <InfoPair icon="phone-outline" label="Telefon" value={profile.phone || '-'} colors={colors} />
                <InfoPair icon="email-outline" label="E-posta" value={profile.email} colors={colors} />
                <InfoPair icon="calendar-start" label="İşe Başlama" value={formatDate(technician.hire_date)} colors={colors} />
                <InfoPair icon="clock-plus-outline" label="Oluşturulma" value={formatDate(technician.created_at || technician.user?.date_joined)} colors={colors} />
            </View>
        </>
    );

    const renderServices = () => (
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Aktif Servisler</Text>
                <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>{count(activeServices.length)} kayıt</Text>
            </View>
            {activeServices.length === 0 ? (
                <View style={styles.emptyBlock}>
                    <MaterialCommunityIcons name="clipboard-check-outline" size={36} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aktif servis bulunamadı</Text>
                </View>
            ) : (
                activeServices.slice(0, 8).map(service => <ServiceRow key={String(service.id)} service={service} colors={colors} />)
            )}
        </View>
    );

    const renderPermissions = () => (
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Yetkiler</Text>
                <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>{profile.activePermissions.length} aktif</Text>
            </View>
            <View style={styles.permissionGrid}>
                {PERMISSION_LABELS.map(([key, label]) => (
                    <PermissionChip key={key} label={label} enabled={Boolean(profile.permissions[key])} colors={colors} />
                ))}
            </View>
        </View>
    );

    return (
        <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Teknisyen Detayı</Text>
                <Pressable onPress={onRefresh} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {refreshing ? <ActivityIndicator size="small" color={serviceBlue} /> : <MaterialCommunityIcons name="refresh" size={21} color={serviceBlue} />}
                </Pressable>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[serviceBlue]} />}
            >
                <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.profileTopRow}>
                        <View style={styles.avatarWrap}>
                            {profile.avatar ? (
                                <Image source={{ uri: profile.avatar }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatarFallback, { backgroundColor: `${serviceBlue}16` }]}>
                                    <Text style={[styles.avatarText, { color: serviceBlue }]}>{profile.initials}</Text>
                                </View>
                            )}
                            <View style={[styles.onlineDot, { backgroundColor: profile.status.dot, borderColor: colors.surface }]} />
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>{profile.name}</Text>
                            <Text style={[styles.profileRole, { color: colors.textSecondary }]} numberOfLines={1}>{profile.role}</Text>
                            <View style={styles.locationRow}>
                                <MaterialCommunityIcons name="map-marker-outline" size={15} color={colors.textSecondary} />
                                <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>{profile.location}</Text>
                            </View>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: profile.status.bg }]}>
                            <Text style={[styles.statusText, { color: profile.status.color }]}>{profile.status.label}</Text>
                        </View>
                    </View>

                    <View style={[styles.profileDivider, { backgroundColor: colors.border }]} />

                    <View style={styles.profileMetaRow}>
                        <View style={styles.profileMetaItem}>
                            <MaterialCommunityIcons name="clock-outline" size={19} color={serviceBlue} />
                            <View>
                                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>İşe Başlama</Text>
                                <Text style={[styles.metaValue, { color: colors.text }]}>{formatDate(technician.hire_date)}</Text>
                            </View>
                        </View>
                        <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.profileMetaItem}>
                            <View style={[styles.liveDot, { backgroundColor: profile.status.dot }]} />
                            <View>
                                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Son Görülme</Text>
                                <Text style={[styles.metaValue, { color: profile.isOnline ? serviceGreen : colors.text }]}>
                                    {formatLastSeen(technician.last_online, profile.isOnline)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.contactRow}>
                        <Pressable onPress={handleCall} style={[styles.contactButton, { borderColor: colors.border }]}>
                            <MaterialCommunityIcons name="phone-outline" size={18} color={serviceBlue} />
                            <Text style={[styles.contactText, { color: colors.textSecondary }]}>Ara</Text>
                        </Pressable>
                        <Pressable onPress={handleSms} style={[styles.contactButton, { borderColor: colors.border }]}>
                            <MaterialCommunityIcons name="message-text-outline" size={18} color={serviceBlue} />
                            <Text style={[styles.contactText, { color: colors.textSecondary }]}>Mesaj</Text>
                        </Pressable>
                        <Pressable onPress={handleLocation} style={[styles.contactButton, { borderColor: colors.border }]}>
                            <MaterialCommunityIcons name="map-marker-outline" size={18} color={serviceBlue} />
                            <Text style={[styles.contactText, { color: colors.textSecondary }]}>Konum</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <StatCard icon="clipboard-list-outline" label="Bu Ay Servis" value={count(totalServices)} color={serviceBlue} colors={colors} />
                    <StatCard icon="check-circle-outline" label="Tamamlanan" value={count(completed)} color={serviceGreen} colors={colors} />
                    <StatCard icon="progress-clock" label="Açık Servis" value={count(pending)} color={serviceOrange} colors={colors} />
                    <StatCard icon="cash-multiple" label="Tahsilat" value={money(performance?.total_revenue_generated)} color={serviceGreen} colors={colors} />
                </View>

                <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {TABS.map(tab => {
                        const active = activeTab === tab.key;
                        return (
                            <Pressable
                                key={tab.key}
                                onPress={() => setActiveTab(tab.key)}
                                style={[styles.tabButton, active && { backgroundColor: `${serviceBlue}12`, borderColor: serviceBlue }]}
                            >
                                <Text style={[styles.tabText, { color: active ? serviceBlue : colors.textSecondary }]}>{tab.label}</Text>
                            </Pressable>
                        );
                    })}
                </View>

                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'services' && renderServices()}
                {activeTab === 'permissions' && renderPermissions()}
            </ScrollView>

            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10, backgroundColor: colors.backgroundSecondary, borderTopColor: colors.border }]}>
                <Pressable onPress={handleShifts} style={({ pressed }) => [styles.bottomPrimary, { backgroundColor: serviceBlue }, pressed && styles.btnPressed]}>
                    <MaterialCommunityIcons name="clock-edit-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.bottomPrimaryText}>Mesai</Text>
                </Pressable>
                <Pressable onPress={handleLeaves} style={({ pressed }) => [styles.bottomSecondary, { backgroundColor: colors.surface, borderColor: serviceBlue }, pressed && styles.btnPressed]}>
                    <MaterialCommunityIcons name="calendar-account-outline" size={20} color={serviceBlue} />
                    <Text style={[styles.bottomSecondaryText, { color: serviceBlue }]}>İzinler</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
    iconButton: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    headerSpacer: { width: 46, height: 46 },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '900', letterSpacing: 0 },
    content: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
    profileCard: { borderRadius: 18, borderWidth: 1, padding: 16 },
    profileTopRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
    avatarWrap: { position: 'relative' },
    avatar: { width: 78, height: 78, borderRadius: 39 },
    avatarFallback: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 24, fontWeight: '900' },
    onlineDot: { position: 'absolute', right: 2, bottom: 2, width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
    profileInfo: { flex: 1, minWidth: 0 },
    profileName: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
    profileRole: { fontSize: 13, fontWeight: '700', marginBottom: 7 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
    locationText: { flex: 1, fontSize: 12, fontWeight: '700' },
    statusBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, alignSelf: 'flex-start' },
    statusText: { fontSize: 11, fontWeight: '900' },
    profileDivider: { height: 1, marginVertical: 14 },
    profileMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    profileMetaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
    metaLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
    metaValue: { fontSize: 13, fontWeight: '900' },
    liveDot: { width: 10, height: 10, borderRadius: 5 },
    verticalDivider: { width: 1, alignSelf: 'stretch', marginHorizontal: 12 },
    contactRow: { flexDirection: 'row', gap: 10 },
    contactButton: { flex: 1, minHeight: 44, borderRadius: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    contactText: { fontSize: 13, fontWeight: '800' },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statCard: { flexBasis: '48%', flexGrow: 1, minWidth: 150, borderRadius: 16, borderWidth: 1, padding: 12 },
    statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
    statLabel: { fontSize: 11, fontWeight: '800', marginBottom: 4 },
    statValue: { fontSize: 17, fontWeight: '900' },
    tabs: { flexDirection: 'row', borderRadius: 15, borderWidth: 1, padding: 4, gap: 4 },
    tabButton: { flex: 1, height: 38, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    tabText: { fontSize: 13, fontWeight: '900' },
    sectionCard: { borderRadius: 16, borderWidth: 1, padding: 14 },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '900' },
    sectionHint: { fontSize: 12, fontWeight: '800' },
    performanceCard: { borderRadius: 16, borderWidth: 1, padding: 14 },
    performanceRow: { flexDirection: 'row', alignItems: 'center' },
    performanceMetric: { flex: 1, alignItems: 'center' },
    performanceValue: { fontSize: 20, fontWeight: '900', marginBottom: 4 },
    performanceLabel: { fontSize: 11, fontWeight: '800' },
    infoPair: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10 },
    infoPairText: { flex: 1, minWidth: 0 },
    infoPairLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
    infoPairValue: { fontSize: 14, fontWeight: '900' },
    serviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    serviceIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    serviceInfo: { flex: 1, minWidth: 0 },
    serviceTitle: { fontSize: 14, fontWeight: '900', marginBottom: 3 },
    serviceMeta: { fontSize: 11, fontWeight: '700' },
    serviceBadge: { maxWidth: 112, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, marginLeft: 8 },
    serviceBadgeText: { fontSize: 11, fontWeight: '900' },
    permissionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    permissionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, maxWidth: '100%' },
    permissionText: { fontSize: 12, fontWeight: '800' },
    emptyBlock: { alignItems: 'center', paddingVertical: 28, gap: 9 },
    emptyText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
    bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
    bottomPrimary: { flex: 1, height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    bottomPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
    bottomSecondary: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    bottomSecondaryText: { fontSize: 15, fontWeight: '900' },
    btnPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
