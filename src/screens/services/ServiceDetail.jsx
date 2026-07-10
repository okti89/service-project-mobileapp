import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import Header from '@/components/Header';
import StatusPickerSheet from '@/components/home/StatusPickerSheet';
import TechnicianPickerSheet from '@/components/TechnicianPickerSheet';
import { fs, sp } from '@/theme/scale';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

dayjs.locale('tr');

const FALLBACK_SERVICE_STATUS_OPTIONS = [
    { key: 'new', label: 'Yeni', color: '#4F7CFF' },
    { key: 'assigned', label: 'Atandı', color: '#F59E0B' },
    { key: 'in_progress', label: 'Devam Ediyor', color: '#2563EB' },
    { key: 'postponed', label: 'Ertelendi', color: '#F97316' },
    { key: 'completed', label: 'Tamamlandı', color: '#16A34A' },
    { key: 'cancelled', label: 'İptal Edildi', color: '#EF4444' },
];

export default function ServiceDetail({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();
    const { isAdmin } = useAuth();
    const serviceId = route?.params?.serviceId || null;

    const [service, setService] = useState(route?.params?.service || null);
    const [loading, setLoading] = useState(!service);
    const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
    const [techniciansLoading, setTechniciansLoading] = useState(false);
    const [technicians, setTechnicians] = useState([]);
    
    const [statusOptions, setStatusOptions] = useState(FALLBACK_SERVICE_STATUS_OPTIONS);

    const statusSheetRef = useRef(null);
    const technicianSheetRef = useRef(null);

    const fetchService = useCallback(async () => {
        if (!serviceId) return;
        setLoading(true);
        try {
            const res = await api.get(ENDPOINTS.SERVICES.TECHNICIAN_DETAIL(serviceId));
            setService(res.data);
        } catch (err) {
            console.error('Fetch service detail error:', err);
            showToast('error', 'Hata', 'Servis detayları alınamadı.');
        } finally {
            setLoading(false);
        }
    }, [serviceId]);

    const fetchServiceStatuses = useCallback(async () => {
        try {
            const response = await api.get(ENDPOINTS.SERVICES.STATUS_LIST);
            const data = response?.data || [];
            const normalized = data
                .filter((item) => item?.code && item?.is_active !== false)
                .map((item) => ({
                    key: String(item.code).trim().toLowerCase(),
                    label: item.name || item.code,
                    color: item.color || colors.primary,
                }));
            setStatusOptions(normalized.length > 0 ? normalized : FALLBACK_SERVICE_STATUS_OPTIONS);
        } catch (err) {
            console.warn('Status list fetch error:', err);
            setStatusOptions(FALLBACK_SERVICE_STATUS_OPTIONS);
        }
    }, [colors.primary]);

    const fetchTechnicians = useCallback(async () => {
        try {
            setTechniciansLoading(true);
            const response = await api.get(ENDPOINTS.TECHNICIAN.LIST, { params: { include_inactive: 'false' } });
            setTechnicians(Array.isArray(response?.data) ? response.data : []);
        } catch (err) {
            console.warn('Technician list fetch error:', err);
            showToast('error', 'Hata', 'Teknisyen listesi yüklenemedi.');
        } finally {
            setTechniciansLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchService();
        fetchServiceStatuses();
        if (isAdmin) {
            fetchTechnicians();
        }
    }, [fetchService, fetchServiceStatuses, fetchTechnicians, isAdmin]);

    // Handle Deep Link focus routing
    useEffect(() => {
        const focus = route?.params?.focus;
        if (!loading && service) {
            if (focus === 'status') {
                setTimeout(() => statusSheetRef.current?.present(), 300);
            } else if (focus === 'technician') {
                setTimeout(() => technicianSheetRef.current?.present(), 300);
            }
        }
    }, [route?.params?.focus, loading, service]);

    const handleStatusSelect = useCallback(async (statusOption) => {
        if (!service?.id || !statusOption?.key) return;
        const currentStatus = String(service?.service_status || '').trim().toLowerCase();
        if (currentStatus === statusOption.key) {
            statusSheetRef.current?.dismiss();
            return;
        }

        try {
            setStatusUpdateLoading(true);
            const res = await api.patch(ENDPOINTS.SERVICES.ADMIN_DETAIL(service.id), {
                service_status: statusOption.key,
            });
            setService(res.data);
            showToast('success', 'Başarılı', 'Servis durumu güncellendi.');
            statusSheetRef.current?.dismiss();
        } catch (err) {
            showToast('error', 'Hata', err?.response?.data?.detail || 'Servis durumu güncellenemedi.');
        } finally {
            setStatusUpdateLoading(false);
        }
    }, [service]);

    const handleTechnicianSelect = useCallback(async (technician) => {
        if (!service?.id) return;
        const nextTechnicianId = technician?.id || null;
        if (service?.technician === nextTechnicianId) {
            technicianSheetRef.current?.dismiss();
            return;
        }

        try {
            const res = await api.patch(ENDPOINTS.SERVICES.ADMIN_DETAIL(service.id), {
                technician: nextTechnicianId,
            });
            setService(res.data);
            showToast('success', 'Başarılı', 'Servis teknisyeni güncellendi.');
            technicianSheetRef.current?.dismiss();
        } catch (err) {
            showToast('error', 'Hata', err?.response?.data?.detail || 'Teknisyen atanamadı.');
        }
    }, [service]);

    const handleCallCustomer = () => {
        if (!service?.customer_phone) return;
        Linking.openURL(`tel:${service.customer_phone}`).catch(() => {
            showToast('error', 'Hata', 'Arama başlatılamadı.');
        });
    };

    const handleNavigateCustomer = () => {
        if (!service?.customer_address) return;
        const address = service.customer_address;
        const url = Platform.select({
            ios: `maps:0,0?q=${encodeURIComponent(address)}`,
            android: `geo:0,0?q=${encodeURIComponent(address)}`,
            default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
        });
        Linking.openURL(url).catch(() => {
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
        });
    };

    if (loading) {
        return (
            <WrapperContainer edges={NO_BOTTOM_EDGES}>
                <View style={[styles.center, { backgroundColor: colors.background }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
                </View>
            </WrapperContainer>
        );
    }

    if (!service) {
        return (
            <WrapperContainer edges={NO_BOTTOM_EDGES}>
                <Header title="Servis Detayı" showBack={true} />
                <View style={[styles.center, { backgroundColor: colors.background }]}>
                    <Text style={[styles.errorText, { color: colors.textSecondary }]}>Servis bulunamadı.</Text>
                </View>
            </WrapperContainer>
        );
    }

    const badge = FALLBACK_SERVICE_STATUS_OPTIONS.find(o => o.key === service.service_status) || { label: 'Planlandı', color: '#4B5563' };
    const deviceDesc = [service.device_type_name, service.device_brand_name, service.device_model_name].filter(Boolean).join(' > ') || 'Cihaz bilgisi yok';

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES}>
            <View style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }}>
                <Header title="Servis Detayı" showBack={true} />
                <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                    
                    {/* Hero Service Card */}
                    <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.heroAccent, { backgroundColor: badge.color }]} />
                        <View style={styles.heroTopRow}>
                            <View style={styles.heroCustomerCol}>
                                <Text style={[styles.heroCustomerName, { color: colors.text }]}>
                                    {service.customer_full_name}
                                </Text>
                                <Text style={[styles.heroReceipt, { color: colors.textTertiary }]}>
                                    Fiş No: {service.receipt_number || service.id?.slice(0, 8) || '-'}
                                </Text>
                            </View>
                            <View style={[styles.heroStatusPill, { borderColor: `${badge.color}40`, backgroundColor: `${badge.color}10` }]}>
                                <View style={[styles.heroStatusDot, { backgroundColor: badge.color }]} />
                                <Text style={[styles.heroStatusText, { color: badge.color }]}>{badge.label}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Quick Action Buttons Row */}
                    <View style={styles.quickRow}>
                        <QuickAction
                            icon="progress-clock"
                            color="#0EA5E9"
                            label="Durum Değiştir"
                            onPress={() => statusSheetRef.current?.present()}
                        />
                        {isAdmin && (
                            <QuickAction
                                icon="account-edit-outline"
                                color="#2563EB"
                                label="Teknisyen Değiştir"
                                onPress={() => technicianSheetRef.current?.present()}
                            />
                        )}
                        <QuickAction
                            icon="phone"
                            color="#16A34A"
                            label="Müşteriyi Ara"
                            onPress={handleCallCustomer}
                        />
                        <QuickAction
                            icon="navigation-variant-outline"
                            color="#8B5CF6"
                            label="Yol Tarifi"
                            onPress={handleNavigateCustomer}
                        />
                    </View>

                    {/* Details Section */}
                    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.sectionHeader}>
                            <MaterialCommunityIcons name="information-outline" size={16} color={colors.textSecondary} />
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CİHAZ VE ARIZA BİLGİLERİ</Text>
                        </View>
                        <View style={styles.sectionBody}>
                            <InfoRow icon="cellphone-link" label="Cihaz" value={deviceDesc} />
                            <InfoRow icon="alert-circle-outline" label="Arıza Açıklaması" value={service.fault_description || 'Açıklama belirtilmemiş'} multiline />
                            <InfoRow icon="calendar-clock" label="Servis Zamanı" value={service.scheduled_date ? dayjs(service.scheduled_date).format('DD MMMM YYYY · HH:mm') : 'Zaman belirlenmemiş'} />
                            <InfoRow icon="account" label="Atanan Teknisyen" value={service.technician_name || 'Atanmamış'} />
                        </View>
                    </View>

                    {/* Customer Info Section */}
                    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.sectionHeader}>
                            <MaterialCommunityIcons name="account-outline" size={16} color={colors.textSecondary} />
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>MÜŞTERİ BİLGİLERİ</Text>
                        </View>
                        <View style={styles.sectionBody}>
                            <InfoRow icon="phone" label="Telefon" value={service.customer_phone} onPress={handleCallCustomer} />
                            <InfoRow icon="map-marker-outline" label="Adres" value={service.customer_address} onPress={handleNavigateCustomer} multiline />
                        </View>
                    </View>

                </ScrollView>
            </View>

            <StatusPickerSheet
                ref={statusSheetRef}
                statuses={statusOptions}
                loading={statusUpdateLoading}
                selectedStatusKey={String(service?.service_status || '').trim().toLowerCase()}
                onSelect={handleStatusSelect}
            />

            <TechnicianPickerSheet
                ref={technicianSheetRef}
                technicians={technicians}
                loading={techniciansLoading}
                selectedTechnicianId={service?.technician}
                onSelect={handleTechnicianSelect}
            />
        </WrapperContainer>
    );
}

const QuickAction = ({ icon, color, label, onPress }) => {
    const { colors } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            android_ripple={{ color: `${color}26`, borderless: true, radius: 24 }}
            style={({ pressed }) => [
                styles.quickAction,
                {
                    backgroundColor: `${color}1A`,
                    opacity: pressed ? 0.7 : 1,
                },
            ]}
        >
            <MaterialCommunityIcons name={icon} size={20} color={color} />
            <Text style={[styles.quickActionLabel, { color: colors.text }]} numberOfLines={1}>{label}</Text>
        </Pressable>
    );
};

const InfoRow = ({ icon, label, value, onPress, multiline }) => {
    const { colors } = useTheme();
    const isInteractive = typeof onPress === 'function';
    return (
        <Pressable disabled={!isInteractive} onPress={onPress} style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
                <MaterialCommunityIcons name={icon} size={18} color={colors.textTertiary} />
            </View>
            <View style={styles.infoTextCol}>
                <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>{label}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={multiline ? 4 : 1}>{value}</Text>
            </View>
            {isInteractive && <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textTertiary} />}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: sp(12),
    },
    loadingText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: fs(14),
        fontWeight: '500',
    },
    errorText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: fs(14),
        fontWeight: '500',
    },
    contentContainer: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.m,
        paddingBottom: spacing.xl,
        gap: spacing.m,
    },
    hero: {
        borderRadius: sp(18),
        borderWidth: 1,
        paddingVertical: spacing.l,
        paddingHorizontal: spacing.l,
        position: 'relative',
        overflow: 'hidden',
    },
    heroAccent: {
        position: 'absolute',
        left: 0,
        top: 12,
        bottom: 12,
        width: 4,
        borderTopRightRadius: 4,
        borderBottomRightRadius: 4,
    },
    heroTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 6,
    },
    heroCustomerCol: {
        flex: 1,
    },
    heroCustomerName: {
        fontFamily: typography.fontFamily.bold,
        fontSize: fs(18),
        fontWeight: '700',
    },
    heroReceipt: {
        fontFamily: typography.fontFamily.regular,
        fontSize: fs(12),
        marginTop: sp(2),
    },
    heroStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp(6),
        paddingHorizontal: sp(10),
        paddingVertical: sp(5),
        borderRadius: sp(999),
        borderWidth: 1,
    },
    heroStatusDot: {
        width: sp(6),
        height: sp(6),
        borderRadius: sp(3),
    },
    heroStatusText: {
        fontFamily: typography.fontFamily.bold,
        fontSize: fs(10),
        fontWeight: '700',
    },
    quickRow: {
        flexDirection: 'row',
        gap: spacing.s,
        flexWrap: 'wrap',
    },
    quickAction: {
        flexGrow: 1,
        flexBasis: '22%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.m,
        borderRadius: sp(14),
        gap: sp(4),
        minWidth: sp(72),
    },
    quickActionLabel: {
        fontFamily: typography.fontFamily.bold,
        fontSize: fs(10),
        fontWeight: '700',
    },
    section: {
        borderRadius: sp(16),
        borderWidth: 1,
        overflow: 'hidden',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp(6),
        paddingHorizontal: spacing.l,
        paddingTop: spacing.m,
        paddingBottom: spacing.s,
    },
    sectionTitle: {
        fontFamily: typography.fontFamily.bold,
        fontSize: fs(10),
        fontWeight: '700',
        letterSpacing: 0.8,
    },
    sectionBody: {
        paddingHorizontal: spacing.l,
        paddingBottom: spacing.m,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
        paddingVertical: spacing.s + 2,
    },
    infoIconWrap: {
        width: sp(24),
        alignItems: 'center',
    },
    infoTextCol: {
        flex: 1,
    },
    infoLabel: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: fs(10),
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    infoValue: {
        fontFamily: typography.fontFamily.regular,
        fontSize: fs(14),
        marginTop: sp(2),
    },
});