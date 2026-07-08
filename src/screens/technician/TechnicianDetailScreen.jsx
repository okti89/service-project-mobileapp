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
import { serviceBlue, serviceGreen, serviceRed } from '@/theme/color';
import { resolveMediaUrl } from '@/utils/mediaUrl';

const STATUS_META = {
    online: { label: 'Çevrimiçi', color: serviceGreen, bg: 'rgba(0, 163, 108, 0.12)', icon: 'check-circle-outline' },
    offline: { label: 'Çevrimdışı', color: '#64748B', bg: 'rgba(100, 116, 139, 0.12)', icon: 'circle-outline' },
    passive: { label: 'Pasif', color: serviceRed, bg: 'rgba(220, 53, 69, 0.10)', icon: 'account-off-outline' },
};

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

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatLastSeen = (value, isOnline) => {
    if (isOnline) return 'Şimdi';
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSeconds < 60) return 'Az önce';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} dk önce`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} sa önce`;
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const normalizePhone = (value) => String(value || '').replace(/[^\d+]/g, '');

function MetricCard({ icon, label, value, color, colors }) {
    return (
        <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.metricIcon, { backgroundColor: `${color}14` }]}>
                <MaterialCommunityIcons name={icon} size={19} color={color} />
            </View>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
            <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
        </View>
    );
}

function PermissionChip({ label, active, colors }) {
    return (
        <View style={[
            styles.permissionChip,
            {
                backgroundColor: active ? 'rgba(0, 163, 108, 0.12)' : colors.surfaceMuted,
                borderColor: active ? 'rgba(0, 163, 108, 0.20)' : colors.border,
            },
        ]}>
            <MaterialCommunityIcons
                name={active ? 'check-circle-outline' : 'close-circle-outline'}
                size={14}
                color={active ? serviceGreen : colors.textTertiary}
            />
            <Text style={[styles.permissionText, { color: active ? serviceGreen : colors.textSecondary }]} numberOfLines={1}>{label}</Text>
        </View>
    );
}

export default function TechnicianDetailScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const technicianId = route?.params?.technicianId || route?.params?.id || route?.params?.technician?.id || null;
    const initialTechnician = route?.params?.technician || null;

    const [technician, setTechnician] = useState(initialTechnician);
    const [loading, setLoading] = useState(!initialTechnician);
    const [refreshing, setRefreshing] = useState(false);

    const fetchTechnician = useCallback(async () => {
        if (!technicianId) {
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            const response = await api.get(ENDPOINTS.TECHNICIAN.DETAIL(technicianId));
            setTechnician(response?.data || null);
        } catch (error) {
            console.log('Technician fetch error:', error?.response?.data || error?.message || error);
            Alert.alert('Hata', 'Teknisyen bilgileri yüklenemedi');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [technicianId]);

    useFocusEffect(
        useCallback(() => {
            fetchTechnician();
        }, [fetchTechnician])
    );

    const profile = useMemo(() => {
        const name = getFullName(technician);
        const statusKey = getStatusKey(technician);
        const status = STATUS_META[statusKey] || STATUS_META.offline;
        const permissions = technician?.permissions || {};
        const activePermissions = PERMISSION_LABELS.filter(([key]) => Boolean(permissions[key]));
        const phone = technician?.user?.phone_number || technician?.phone_number || '';
        const avatar = resolveMediaUrl(technician?.user?.profile_picture || technician?.user?.avatar || technician?.user?.avatar_url || technician?.avatar);

        return {
            name,
            initials: getInitials(name),
            status,
            statusKey,
            isOnline: statusKey === 'online',
            permissions,
            activePermissions,
            phone,
            avatar,
            email: technician?.user?.email || technician?.email || '-',
            role: technician?.user?.user_type_display || technician?.title || 'Teknisyen',
            location: technician?.current_location?.address || technician?.location || technician?.address || '-',
        };
    }, [technician]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchTechnician();
    };

    const openPhoneUrl = (url, missingMessage) => {
        const phone = normalizePhone(profile.phone);
        if (!phone) {
            Alert.alert('Bilgi eksik', missingMessage);
            return;
        }
        Linking.openURL(url(phone)).catch(() => Alert.alert('Hata', 'İşlem başlatılamadı'));
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
                    <View style={styles.iconButtonPlaceholder} />
                </View>
                <View style={styles.centerContainer}>
                    <MaterialCommunityIcons name="account-alert-outline" size={44} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Teknisyen bulunamadı</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                </Pressable>
                <View style={styles.headerTextWrap}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Teknisyen Detayı</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{profile.name}</Text>
                </View>
                <Pressable onPress={onRefresh} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {refreshing ? <ActivityIndicator size="small" color={serviceBlue} /> : <MaterialCommunityIcons name="refresh" size={21} color={serviceBlue} />}
                </Pressable>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
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
                            <View style={[styles.onlineDot, { backgroundColor: profile.status.color, borderColor: colors.surface }]} />
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
                            <MaterialCommunityIcons name={profile.status.icon} size={14} color={profile.status.color} />
                            <Text style={[styles.statusText, { color: profile.status.color }]}>{profile.status.label}</Text>
                        </View>
                    </View>

                    <View style={[styles.profileDivider, { backgroundColor: colors.border }]} />

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

                <View style={styles.metricGrid}>
                    <MetricCard icon="calendar-start" label="İşe Başlama" value={formatDate(technician.hire_date)} color={serviceBlue} colors={colors} />
                    <MetricCard icon="eye-outline" label="Son Görülme" value={formatLastSeen(technician.last_online, profile.isOnline)} color={profile.status.color} colors={colors} />
                    <MetricCard icon="shield-check-outline" label="Aktif Yetki" value={`${profile.activePermissions.length}/${PERMISSION_LABELS.length}`} color={serviceGreen} colors={colors} />
                </View>

                <View style={styles.actionRow}>
                    <Pressable onPress={handleShifts} style={({ pressed }) => [styles.primaryAction, { backgroundColor: serviceBlue }, pressed && styles.btnPressed]}>
                        <MaterialCommunityIcons name="clock-outline" size={19} color="#FFFFFF" />
                        <Text style={styles.primaryActionText}>Mesai Geçmişi</Text>
                    </Pressable>
                    <Pressable onPress={handleLeaves} style={({ pressed }) => [styles.secondaryAction, { backgroundColor: colors.surface, borderColor: `${serviceBlue}55` }, pressed && styles.btnPressed]}>
                        <MaterialCommunityIcons name="calendar-account-outline" size={19} color={serviceBlue} />
                        <Text style={[styles.secondaryActionText, { color: serviceBlue }]}>İzinler</Text>
                    </Pressable>
                </View>

                <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>İletişim Bilgileri</Text>
                    <InfoRow icon="phone-outline" label="Telefon" value={profile.phone || '-'} colors={colors} />
                    <InfoRow icon="email-outline" label="E-posta" value={profile.email} colors={colors} />
                </View>

                <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Yetkiler</Text>
                        <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>{profile.activePermissions.length} aktif</Text>
                    </View>
                    <View style={styles.permissionGrid}>
                        {PERMISSION_LABELS.map(([key, label]) => (
                            <PermissionChip key={key} label={label} active={Boolean(profile.permissions[key])} colors={colors} />
                        ))}
                    </View>
                </View>

                <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Kayıt Bilgileri</Text>
                    <InfoRow icon="account-check-outline" label="Hesap Durumu" value={technician?.user?.is_active ? 'Aktif' : 'Pasif'} colors={colors} />
                    <InfoRow icon="clock-plus-outline" label="Oluşturulma" value={formatDate(technician.created_at || technician.user?.date_joined)} colors={colors} />
                </View>
            </ScrollView>
        </View>
    );
}

function InfoRow({ icon, label, value, colors }) {
    return (
        <View style={[styles.infoRow, { borderBottomColor: colors.divider }]}>
            <View style={[styles.infoIcon, { backgroundColor: `${serviceBlue}12` }]}>
                <MaterialCommunityIcons name={icon} size={18} color={serviceBlue} />
            </View>
            <View style={styles.infoTextWrap}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>{value || '-'}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 12,
    },
    iconButton: {
        width: 46,
        height: 46,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconButtonPlaceholder: { width: 46, height: 46 },
    headerTextWrap: { flex: 1, minWidth: 0 },
    headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 0 },
    headerSubtitle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
    content: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
    profileCard: {
        borderRadius: 18,
        borderWidth: 1,
        padding: 16,
    },
    profileTopRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
    avatarWrap: { position: 'relative' },
    avatar: { width: 78, height: 78, borderRadius: 39 },
    avatarFallback: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 24, fontWeight: '900' },
    onlineDot: { position: 'absolute', right: 2, bottom: 2, width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
    profileInfo: { flex: 1, minWidth: 0 },
    profileName: { fontSize: 21, fontWeight: '900', marginBottom: 4 },
    profileRole: { fontSize: 13, fontWeight: '700', marginBottom: 7 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
    locationText: { flex: 1, fontSize: 12, fontWeight: '700' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
    statusText: { fontSize: 11, fontWeight: '900' },
    profileDivider: { height: 1, marginVertical: 14 },
    contactRow: { flexDirection: 'row', gap: 10 },
    contactButton: {
        flex: 1,
        minHeight: 44,
        borderRadius: 13,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    contactText: { fontSize: 13, fontWeight: '800' },
    metricGrid: { flexDirection: 'row', gap: 8 },
    metricCard: { flex: 1, minWidth: 0, borderRadius: 15, borderWidth: 1, padding: 12 },
    metricIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    metricLabel: { fontSize: 10, fontWeight: '800', marginBottom: 4 },
    metricValue: { fontSize: 13, fontWeight: '900' },
    actionRow: { flexDirection: 'row', gap: 10 },
    primaryAction: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
    },
    primaryActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
    secondaryAction: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
    },
    secondaryActionText: { fontSize: 14, fontWeight: '900' },
    sectionCard: { borderRadius: 16, borderWidth: 1, padding: 14 },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { fontSize: 15, fontWeight: '900' },
    sectionHint: { fontSize: 12, fontWeight: '800' },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1 },
    infoIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    infoTextWrap: { flex: 1, minWidth: 0 },
    infoLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
    infoValue: { fontSize: 14, fontWeight: '800' },
    permissionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    permissionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, maxWidth: '100%' },
    permissionText: { fontSize: 12, fontWeight: '800' },
    emptyText: { fontSize: 14, fontWeight: '800', marginTop: 10 },
    btnPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
