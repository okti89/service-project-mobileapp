import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceRed } from '@/theme/color';

const STATUS_COLORS = {
    available: '#22C55E',
    offduty: '#F59E0B',
    busy: '#EF4444',
};

const STATUS_LABELS = {
    available: 'Musait',
    offduty: 'Izinde',
    busy: 'Dolu',
};

const PermissionRow = ({ label, value }) => {
    const { colors } = useTheme();
    return (
        <View style={[styles.permRow, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.permLabel, { color: colors.textSecondary }]}>{label}</Text>
            <MaterialCommunityIcons
                name={value ? 'check-circle' : 'close-circle'}
                size={18}
                color={value ? serviceGreen : serviceRed}
            />
        </View>
    );
};

export default function TechnicianDetailScreen({ navigation, route }) {
    const technicianId = route?.params?.technicianId || route?.params?.id || null;
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();

    const [technician, setTechnician] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchTechnician = useCallback(async () => {
        if (!technicianId) {
            setLoading(false);
            return;
        }
        try {
            const response = await api.get(ENDPOINTS.TECHNICIAN.DETAIL(technicianId));
            setTechnician(response.data);
        } catch (error) {
            console.log('Technician fetch error:', error?.response?.data || error?.message || error);
            Alert.alert('Hata', 'Teknisyen bilgileri yuklenemedi');
        } finally {
            setLoading(false);
        }
    }, [technicianId]);

    useEffect(() => { fetchTechnician(); }, [fetchTechnician]);

    const handleWhatsApp = () => {
        const phone = technician?.user?.phone_number?.replace(/\D/g, '');
        if (!phone) { Alert.alert('Hata', 'Telefon numarasi yok'); return; }
        Linking.openURL(`https://wa.me/${phone}`);
    };

    const handleCall = () => {
        const phone = technician?.user?.phone_number?.replace(/\D/g, '');
        if (!phone) { Alert.alert('Hata', 'Telefon numarasi yok'); return; }
        Linking.openURL(`tel:${phone}`);
    };

    const handleSMS = () => {
        const phone = technician?.user?.phone_number?.replace(/\D/g, '');
        if (!phone) { Alert.alert('Hata', 'Telefon numarasi yok'); return; }
        Linking.openURL(`sms:${phone}`);
    };

    const handleLocation = () => {
        navigation.navigate('TechnicianLocations', { technicianId });
    };

    const handleServices = () => {
        navigation.navigate('ServiceList', { technicianId });
    };

    if (loading) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Teknisyen</Text>
                    <View style={styles.headerBtn} />
                </View>
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={serviceBlue} />
                </View>
            </View>
        );
    }

    if (!technician) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Teknisyen</Text>
                    <View style={styles.headerBtn} />
                </View>
                <View style={styles.loadingWrap}>
                    <Text style={{ color: colors.textSecondary }}>Teknisyen bulunamadi</Text>
                </View>
            </View>
        );
    }

    const status = technician.status || 'offduty';
    const statusColor = STATUS_COLORS[status] || serviceBlue;
    const fullName = technician.full_name || technician.user?.get_full_name?.() || 'Teknisyen';
    const initials = fullName.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();
    const avatar = technician.user?.avatar || technician.user?.avatar_url;
    const permissions = technician.permissions || {};

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Teknisyen Detayi</Text>
                <View style={styles.headerBtn} />
            </View>

            <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false}>
                <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.profileAvatarWrap}>
                        {avatar ? (
                            <Image source={{ uri: avatar }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatarInitials, { backgroundColor: `${statusColor}20` }]}>
                                <Text style={[styles.avatarText, { color: statusColor }]}>{initials}</Text>
                            </View>
                        )}
                        <View style={[styles.statusDot, { backgroundColor: statusColor, borderColor: colors.surface }]} />
                    </View>
                    <Text style={[styles.profileName, { color: colors.text }]}>{fullName}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                            {STATUS_LABELS[status] || status}
                        </Text>
                    </View>
                    <View style={styles.onlineInfo}>
                        <View style={[styles.onlineDot, { backgroundColor: technician.is_online ? serviceGreen : colors.textTertiary }]} />
                        <Text style={[styles.onlineText, { color: colors.textSecondary }]}>
                            {technician.is_online ? 'Cevrimici' : 'Cevrimdisi'}
                            {technician.last_online ? ` - Son: ${formatDate(technician.last_online)}` : ''}
                        </Text>
                    </View>
                </View>

                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ILETISIM</Text>
                    <Pressable onPress={handleCall} style={[styles.infoRow, { borderBottomColor: colors.divider }]}>
                        <MaterialCommunityIcons name="phone" size={20} color={serviceBlue} style={styles.infoIcon} />
                        <View style={styles.infoContent}>
                            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Telefon</Text>
                            <Text style={[styles.infoValue, { color: colors.text }]}>{technician.user?.phone_number || '-'}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
                    </Pressable>
                    <Pressable onPress={handleWhatsApp} style={[styles.infoRow, { borderBottomColor: colors.divider }]}>
                        <MaterialCommunityIcons name="whatsapp" size={20} color="#25D366" style={styles.infoIcon} />
                        <View style={styles.infoContent}>
                            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>WhatsApp</Text>
                            <Text style={[styles.infoValue, { color: colors.text }]}>{technician.user?.phone_number || '-'}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
                    </Pressable>
                    <Pressable onPress={() => technician.user?.email && Linking.openURL(`mailto:${technician.user.email}`)} style={styles.infoRow}>
                        <MaterialCommunityIcons name="email" size={20} color={serviceBlue} style={styles.infoIcon} />
                        <View style={styles.infoContent}>
                            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>E-posta</Text>
                            <Text style={[styles.infoValue, { color: colors.text }]}>{technician.user?.email || '-'}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
                    </Pressable>
                </View>

                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>BILGILER</Text>
                    <View style={[styles.infoRow, { borderBottomColor: colors.divider }]}>
                        <MaterialCommunityIcons name="calendar" size={20} color={serviceBlue} style={styles.infoIcon} />
                        <View style={styles.infoContent}>
                            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Ise Baslama</Text>
                            <Text style={[styles.infoValue, { color: colors.text }]}>{formatDate(technician.hire_date)}</Text>
                        </View>
                    </View>
                    <View style={[styles.infoRow, { borderBottomColor: colors.divider }]}>
                        <MaterialCommunityIcons name="clock-outline" size={20} color={serviceBlue} style={styles.infoIcon} />
                        <View style={styles.infoContent}>
                            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Olusturulma</Text>
                            <Text style={[styles.infoValue, { color: colors.text }]}>{formatDate(technician.created_at)}</Text>
                        </View>
                    </View>
                </View>

                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>YETKILER</Text>
                    <PermissionRow label="Musteri Yonetimi" value={permissions.can_manage_customers} />
                    <PermissionRow label="Servis Yonetimi" value={permissions.can_manage_services} />
                    <PermissionRow label="Kullanici Yonetimi" value={permissions.can_manage_users} />
                    <PermissionRow label="Muhasebe" value={permissions.can_manage_accounting} />
                    <PermissionRow label="Bildirimler" value={permissions.can_manage_notifications} />
                    <PermissionRow label="Insan Kaynaklari" value={permissions.can_manage_hr} />
                    <PermissionRow label="Raporlar" value={permissions.can_manage_reports} />
                    <PermissionRow label="Ayarlar" value={permissions.can_manage_settings} />
                    <PermissionRow label="Teknisyen Yonetimi" value={permissions.can_manage_technicians} />
                    <PermissionRow label="Genel Arama" value={permissions.can_use_global_search} />
                </View>

                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>HIZLI ISLEMLER</Text>
                    <View style={styles.quickActions}>
                        <Pressable onPress={handleServices} style={[styles.quickBtn, { backgroundColor: `${serviceBlue}15` }]}>
                            <MaterialCommunityIcons name="clipboard-list-outline" size={24} color={serviceBlue} />
                            <Text style={[styles.quickBtnText, { color: serviceBlue }]}>Servisler</Text>
                        </Pressable>
                        <Pressable onPress={handleLocation} style={[styles.quickBtn, { backgroundColor: `${serviceGreen}15` }]}>
                            <MaterialCommunityIcons name="map-marker" size={24} color={serviceGreen} />
                            <Text style={[styles.quickBtnText, { color: serviceGreen }]}>Konum</Text>
                        </Pressable>
                    </View>
                </View>
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
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    profileCard: { alignItems: 'center', paddingVertical: 24, borderRadius: 16, marginBottom: 16 },
    profileAvatarWrap: { position: 'relative', marginBottom: 12 },
    avatar: { width: 80, height: 80, borderRadius: 40 },
    avatarInitials: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 28, fontWeight: '800' },
    statusDot: { position: 'absolute', bottom: 4, right: 4, width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
    profileName: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 8 },
    statusText: { fontSize: 13, fontWeight: '700' },
    onlineInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    onlineDot: { width: 8, height: 8, borderRadius: 4 },
    onlineText: { fontSize: 12 },
    section: { borderRadius: 16, padding: 16, marginBottom: 16 },
    sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    infoIcon: { marginRight: 12 },
    infoContent: { flex: 1 },
    infoLabel: { fontSize: 12, marginBottom: 2 },
    infoValue: { fontSize: 15, fontWeight: '600' },
    permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
    permLabel: { fontSize: 14 },
    quickActions: { flexDirection: 'row', gap: 12 },
    quickBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, gap: 8 },
    quickBtnText: { fontSize: 13, fontWeight: '700' },
});
