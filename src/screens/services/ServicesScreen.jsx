import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import * as FileSystem from 'expo-file-system/legacy';
import { getNativeShare } from '@/utils/nativeShare';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { useToast } from '@/context/ToastContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen } from '@/theme/color';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import CalendarPickerSheet from '@/components/home/CalendarPickerSheet';
import AppBottomSheet from '@/components/AppBottomSheet';
import { fs as fontScale, sp } from '@/theme/scale';
import { spacing } from '@/theme/spacing';
import Header from '@/components/Header';
import RouteMapModal from '@/components/common/RouteMapModal';
import serviceService from '@/services/serviceService';
import { getServiceStatusLabel } from '@/utils/serviceStatus';

dayjs.locale('tr');

const getStatusColor = (status) => {
    switch (status) {
        case 'in_progress':
            return { color: '#D97706', bgColor: '#FEF3C7', label: 'Devam Ediyor' };
        case 'completed':
            return { color: '#16A34A', bgColor: '#DCFCE7', label: 'Tamamlandı' };
        case 'new':
        case 'assigned':
            return { color: '#2563EB', bgColor: '#DBEAFE', label: 'Planlandı' };
        default:
            return { color: '#4B5563', bgColor: '#F3F4F6', label: 'Planlandı' };
    }
};

const normalizePhoneForWhatsApp = (phone) => {
    let digits = String(phone || '').replace(/[^0-9]/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = '90' + digits.slice(1);
    if (digits.length === 10 && digits.startsWith('5')) digits = '90' + digits;
    return digits;
};

const buildTrackingUrl = (panelUrl, serviceId) => {
    if (!panelUrl || !serviceId) return '';
    const baseUrl = String(panelUrl).replace(/\/+$/, '');
    return baseUrl ? baseUrl + '/service-tracking/' + serviceId + '/' : '';
};

const ServiceCard = ({ item, onPress, onOpenWhatsappSheet, onOpenSmsSheet, onOpenActions }) => {
    const { colors } = useTheme();
    const badge = getStatusColor(item.service_status);
    const time = item.scheduled_date ? dayjs(item.scheduled_date).format('HH:mm') : '--:--';
    const deviceDesc = [item.device_type_name, item.device_brand_name, item.device_model_name].filter(Boolean).join(' / ');

    const handleCall = () => {
        if (!item.customer_phone) {
            Alert.alert('Hata', 'Telefon numarası bulunamadı.');
            return;
        }
        Linking.openURL('tel:' + item.customer_phone).catch(() => {
            Alert.alert('Hata', 'Arama başlatılamadı.');
        });
    };

    const handleNavigation = () => {
        if (!item.customer_address) {
            Alert.alert('Hata', 'Adres bilgisi bulunamadı.');
            return;
        }
        const url = Platform.select({
            ios: 'maps:0,0?q=' + encodeURIComponent(item.customer_address),
            android: 'geo:0,0?q=' + encodeURIComponent(item.customer_address),
            default: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(item.customer_address),
        });
        Linking.openURL(url).catch(() => {
            Linking.openURL('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(item.customer_address));
        });
    };

    return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable onPress={onPress} style={styles.cardMainArea}>
                <View style={styles.cardHeader}>
                <Text style={[styles.cardTime, { color: serviceBlue }]}>{time}</Text>
                <View style={[styles.badgeContainer, { backgroundColor: badge.bgColor }]}>
                    <Text style={[styles.badgeLabel, { color: badge.color }]}>{getServiceStatusLabel(item, badge.label)}</Text>
                </View>
            </View>

            <View style={styles.cardBody}>
                <Text style={[styles.customerName, { color: colors.text }]}>{item.customer_full_name}</Text>
                {deviceDesc ? (
                    <Text style={[styles.deviceText, { color: colors.textSecondary }]}>{deviceDesc}</Text>
                ) : null}
                {item.fault_description ? (
                    <Text style={[styles.faultText, { color: colors.textTertiary }]} numberOfLines={2}>
                        {item.fault_description}
                    </Text>
                ) : null}
                <View style={styles.addressRow}>
                    <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.textTertiary} />
                    <Text style={[styles.addressText, { color: colors.textTertiary }]} numberOfLines={1}>
                        {item.customer_address || 'Adres belirtilmemiş'}
                    </Text>
                </View>
                {item.technician_name ? (
                    <View style={[styles.addressRow, { marginTop: 4 }]}>
                        <MaterialCommunityIcons name="account-hard-hat-outline" size={14} color={colors.textTertiary} />
                        <Text style={[styles.addressText, { color: colors.textTertiary }]} numberOfLines={1}>
                            {item.technician_name}
                        </Text>
                    </View>
                ) : null}
                </View>
            </Pressable>

            <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                <Pressable onPress={() => onOpenWhatsappSheet(item)} accessibilityLabel="WhatsApp" style={styles.actionBtn}>
                    <MaterialCommunityIcons name="whatsapp" size={16} color="#25D366" />
                </Pressable>
                <Pressable onPress={() => onOpenSmsSheet(item)} accessibilityLabel="SMS" style={styles.actionBtn}>
                    <MaterialCommunityIcons name="message-text-outline" size={16} color={serviceBlue} />
                </Pressable>
                <Pressable onPress={handleCall} accessibilityLabel="Müşteriyi ara" style={styles.actionBtn}>
                    <MaterialCommunityIcons name="phone-outline" size={16} color={serviceGreen} />
                </Pressable>
                <Pressable onPress={handleNavigation} accessibilityLabel="Yol tarifi al" style={styles.actionBtn}>
                    <MaterialCommunityIcons name="navigation-variant-outline" size={16} color="#7C3AED" />
                </Pressable>
                <Pressable onPress={() => onOpenActions(item)} accessibilityLabel="Hızlı işlemler" style={styles.actionBtn}>
                    <MaterialCommunityIcons name="cog-outline" size={16} color="#64748B" />
                </Pressable>
            </View>
        </View>
    );
};

export default function ServicesScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { isAdmin, mobilePermissions } = useAuth();
    const { config } = useConfig();
    const { showToast } = useToast();
    const customerId = route?.params?.customerId || null;
    const canCreateService = isAdmin || Boolean(mobilePermissions?.can_manage_services);

    const calendarPickerRef = useRef(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState(customerId ? 'all' : 'my');
    const [viewMode, setViewMode] = useState('day');
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedService, setSelectedService] = useState(null);
    const [communicationType, setCommunicationType] = useState(null);
    const [actionService, setActionService] = useState(null);
    const [actionsVisible, setActionsVisible] = useState(false);
    const [routeService, setRouteService] = useState(null);

    const fetchServices = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            const startStr = dayjs(selectedDate).startOf(viewMode).format('YYYY-MM-DD');
            const endStr = dayjs(selectedDate).endOf(viewMode).format('YYYY-MM-DD');
            const endpoint = (isAdmin && activeTab === 'all')
                ? ENDPOINTS.SERVICES.ADMIN_LIST
                : ENDPOINTS.SERVICES.TECHNICIAN_LIST;
            const params = customerId
                ? { customer: customerId }
                : { start_date: startStr, end_date: endStr };
            const res = await api.get(endpoint, { params });
            setServices(Array.isArray(res?.data) ? res.data : []);
        } catch (err) {
            console.error('Fetch services error:', err?.response?.data || err?.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedDate, activeTab, viewMode, isAdmin, customerId]);

    useFocusEffect(useCallback(() => {
        fetchServices();
    }, [fetchServices]));

    const handlePrev = () => setSelectedDate((prev) => dayjs(prev).subtract(1, viewMode).toDate());
    const handleNext = () => setSelectedDate((prev) => dayjs(prev).add(1, viewMode).toDate());
    const handleRefresh = () => {
        setRefreshing(true);
        fetchServices(true);
    };

    const openCreateService = useCallback(() => {
        navigation.navigate('CreateService', {
            onSuccess: () => fetchServices(),
        });
    }, [fetchServices, navigation]);

    const dateLabel = useMemo(() => {
        if (viewMode === 'day') {
            return dayjs(selectedDate).isSame(dayjs(), 'day') ? 'Bugün' : dayjs(selectedDate).format('D MMMM YYYY');
        }
        if (viewMode === 'month') return dayjs(selectedDate).format('MMMM YYYY');
        return dayjs(selectedDate).format('YYYY');
    }, [selectedDate, viewMode]);

    const handleActionCall = useCallback((phone) => {
        if (!phone) {
            showToast('warning', 'Telefon Eksik', 'Müşteri telefon numarası bulunamadı.');
            return;
        }
        Linking.openURL('tel:' + phone).catch(() => showToast('error', 'Hata', 'Arama başlatılamadı.'));
    }, [showToast]);

    const openActionsSheet = useCallback((service) => {
        setActionService(service);
        setActionsVisible(true);
    }, []);

    const openCommunicationSheet = useCallback((service, type) => {
        setSelectedService(service);
        setCommunicationType(type);
    }, []);

    const closeCommunicationSheet = useCallback(() => {
        setCommunicationType(null);
        setSelectedService(null);
    }, []);

    const handleWhatsAppTracking = useCallback(async () => {
        const phone = selectedService?.customer_phone;
        if (!phone) {
            showToast('warning', 'Telefon Eksik', 'Müşteri telefon numarası bulunamadı.');
            return;
        }
        const cleanPhone = normalizePhoneForWhatsApp(phone);
        const trackingUrl = buildTrackingUrl(config?.panel_url, selectedService?.id);
        const statusLabel = getServiceStatusLabel(selectedService);
        const customerName = selectedService?.customer_full_name || 'Müşterimiz';
        const message = `Sayın ${customerName}\n\nServis kaydınızın durumu: *${statusLabel}*\n\nTakip linki: ${trackingUrl || 'Yok'}`;
        closeCommunicationSheet();
        Linking.openURL('https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(message)).catch(() => {
            showToast('error', 'Hata', 'WhatsApp açılamadı.');
        });
    }, [closeCommunicationSheet, config?.panel_url, selectedService, showToast]);

    const handleSmsTracking = useCallback(async () => {
        const phone = String(selectedService?.customer_phone || '').replace(/\D/g, '');
        if (!phone) {
            showToast('warning', 'Telefon Eksik', 'Müşteri telefon numarası bulunamadı.');
            return;
        }
        const trackingUrl = buildTrackingUrl(config?.panel_url, selectedService?.id);
        const statusLabel = getServiceStatusLabel(selectedService);
        const customerName = selectedService?.customer_full_name || 'Müşterimiz';
        const message = `Sayın ${customerName}, servis kaydınızın durumu: ${statusLabel}. Takip linki: ${trackingUrl || 'Yok'}`;
        closeCommunicationSheet();
        Linking.openURL('sms:' + phone + (Platform.OS === 'ios' ? '&' : '?') + 'body=' + encodeURIComponent(message)).catch(() => {
            showToast('error', 'Hata', 'SMS açılamadı.');
        });
    }, [closeCommunicationSheet, config?.panel_url, selectedService, showToast]);

    const handleWhatsAppPdf = useCallback(async (service = selectedService) => {
        if (!service?.id) return;
        const phone = normalizePhoneForWhatsApp(service?.customer_phone);
        if (!phone) {
            showToast('warning', 'Telefon Eksik', 'Müşteri telefon numarası bulunamadı.');
            return;
        }
        try {
            closeCommunicationSheet();
            showToast('info', 'PDF', 'Servis formu hazirlaniyor...');
            const nativeShare = getNativeShare();
            if (!nativeShare) {
                showToast('warning', 'Dev Modu', 'WhatsApp PDF gonderimi bu development build icinde kapali.');
                return;
            }
            const { uri, filename } = await serviceService.downloadServiceFormPdf(service, { disposition: 'attachment' });
            const pdfBase64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            await nativeShare.shareSingle({
                social: nativeShare.Social.WHATSAPP,
                whatsAppNumber: phone,
                url: 'data:application/pdf;base64,' + pdfBase64,
                type: 'application/pdf',
                filename,
                useInternalStorage: true,
            });
        } catch (error) {
            if (error?.message && !String(error.message).toLowerCase().includes('cancel')) {
                console.error('ServicesScreen WhatsApp PDF error:', error);
                showToast('error', 'Hata', 'Servis formu WhatsApp ile gönderilemedi.');
            }
        }
    }, [closeCommunicationSheet, selectedService, showToast]);

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES}>
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                <Header
                    title={'Servis Operasyonları'}
                    showBack
                />

                {isAdmin ? (
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <Pressable
                            onPress={() => setActiveTab('my')}
                            style={{ flex: 1, paddingVertical: sp(14), alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === 'my' ? '#2563EB' : 'transparent' }}
                        >
                            <Text style={{ fontSize: fontScale(13), fontWeight: '700', color: activeTab === 'my' ? '#2563EB' : colors.textSecondary }}>
                                Benim Servislerim
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setActiveTab('all')}
                            style={{ flex: 1, paddingVertical: sp(14), alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === 'all' ? '#2563EB' : 'transparent' }}
                        >
                            <Text style={{ fontSize: fontScale(13), fontWeight: '700', color: activeTab === 'all' ? '#2563EB' : colors.textSecondary }}>
                                {'Tüm Servisler'}
                            </Text>
                        </Pressable>
                    </View>
                ) : null}

                <View style={{ paddingHorizontal: spacing.gutter, paddingTop: spacing.m, gap: spacing.m }}>
                    <View style={{ flexDirection: 'row', backgroundColor: isDark ? colors.surface : '#F1F5F9', borderRadius: sp(10), padding: sp(4) }}>
                        {[
                            { key: 'day', label: 'Günlük' },
                            { key: 'month', label: 'Aylık' },
                            { key: 'year', label: 'Yıllık' },
                        ].map((mode) => (
                            <Pressable
                                key={mode.key}
                                onPress={() => setViewMode(mode.key)}
                                style={{ flex: 1, paddingVertical: sp(6), alignItems: 'center', borderRadius: sp(8), backgroundColor: viewMode === mode.key ? (isDark ? '#334155' : '#FFFFFF') : 'transparent', shadowColor: viewMode === mode.key ? '#000' : 'transparent', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: viewMode === mode.key ? 1 : 0 }}
                            >
                                <Text style={{ fontSize: fontScale(12), fontWeight: viewMode === mode.key ? '700' : '500', color: viewMode === mode.key ? colors.text : colors.textSecondary }}>
                                    {mode.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <View style={styles.dateSelectorRow}>
                        <Pressable onPress={handlePrev} style={({ pressed }) => [styles.dateNavBtn, { backgroundColor: isDark ? colors.surface : '#FFFFFF', borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}>
                            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
                        </Pressable>

                        <Pressable
                            onPress={() => viewMode === 'day' ? calendarPickerRef.current?.present() : null}
                            style={({ pressed }) => [styles.dateCenterBtn, { backgroundColor: isDark ? colors.surface : '#FFFFFF', borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
                        >
                            <MaterialCommunityIcons name="calendar-outline" size={16} color={serviceBlue} style={{ marginRight: 6 }} />
                            <Text style={[styles.dateCenterText, { color: colors.text }]}>{dateLabel}</Text>
                            {viewMode === 'day' ? <MaterialCommunityIcons name="chevron-down" size={16} color={colors.textSecondary} style={{ marginLeft: 4 }} /> : null}
                        </Pressable>

                        <Pressable onPress={handleNext} style={({ pressed }) => [styles.dateNavBtn, { backgroundColor: isDark ? colors.surface : '#FFFFFF', borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}>
                            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text} />
                        </Pressable>
                    </View>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={serviceBlue} />
                    </View>
                ) : (
                    <FlatList
                        data={services}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={({ item }) => (
                                <ServiceCard
                                    item={item}
                                    onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.id, service: item })}
                                    onOpenWhatsappSheet={(service) => openCommunicationSheet(service, 'whatsapp')}
                                    onOpenSmsSheet={(service) => openCommunicationSheet(service, 'sms')}
                                    onOpenActions={openActionsSheet}
                                />
                        )}
                        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + sp(104) }]}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[serviceBlue]} />}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={colors.textTertiary} />
                                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>{'Seçilen tarihlerde servis kaydı bulunmuyor.'}</Text>
                            </View>
                        }
                    />
                )}

                {canCreateService ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Yeni servis ekle"
                        onPress={openCreateService}
                        style={({ pressed }) => [
                            styles.createServiceFab,
                            {
                                backgroundColor: serviceBlue,
                                bottom: insets.bottom + sp(12),
                                opacity: pressed ? 0.82 : 1,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons name="plus" size={sp(28)} color="#FFFFFF" />
                    </Pressable>
                ) : null}

                <CalendarPickerSheet
                    ref={calendarPickerRef}
                    selectedDate={selectedDate}
                    activeTab={activeTab}
                    onSelectDate={(date) => setSelectedDate(date)}
                />

                <RouteMapModal
                    visible={Boolean(routeService)}
                    onClose={() => setRouteService(null)}
                    address={routeService?.customer_address}
                    customerName={routeService?.customer_full_name}
                />

                <AppBottomSheet visible={actionsVisible} onClose={() => setActionsVisible(false)} snapPoints={['78%']} wrapContent={false}>
                    <BottomSheetScrollView style={styles.actionsSheetScroll} contentContainerStyle={[styles.sheetContent, styles.actionsSheetContent]} showsVerticalScrollIndicator={true} nestedScrollEnabled>
                        <View style={styles.sheetHeader}>
                            <View style={[styles.sheetOptionIcon, { backgroundColor: '#2563EB1A' }]}><MaterialCommunityIcons name="tools" size={20} color="#2563EB" /></View>
                            <View style={styles.sheetHeaderTextWrap}>
                                <Text style={[styles.sheetTitle, { color: colors.text }]}>Hızlı işlemler</Text>
                                <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>{actionService?.customer_full_name || 'Müşteri'}</Text>
                            </View>
                        </View>
                        <Pressable style={({ pressed }) => [styles.sheetOption, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]} onPress={() => { setActionsVisible(false); navigation.navigate('ServiceDetail', { serviceId: actionService?.id, service: actionService }); }}>
                            <View style={[styles.sheetOptionIcon, { backgroundColor: '#2563EB1A' }]}><MaterialCommunityIcons name="eye-outline" size={20} color="#2563EB" /></View><View style={styles.sheetOptionBody}><Text style={[styles.sheetOptionTitle, { color: colors.text }]}>Detay Sayfasına Git</Text><Text style={[styles.sheetOptionText, { color: colors.textSecondary }]}>Servisin tüm detaylarını görüntüle.</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>
                        <Pressable style={({ pressed }) => [styles.sheetOption, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]} onPress={() => { setActionsVisible(false); navigation.navigate('ServiceDetail', { serviceId: actionService?.id, service: actionService, focus: 'technician' }); }}>
                            <View style={[styles.sheetOptionIcon, { backgroundColor: '#8B5CF61A' }]}><MaterialCommunityIcons name="account-edit-outline" size={20} color="#8B5CF6" /></View><View style={styles.sheetOptionBody}><Text style={[styles.sheetOptionTitle, { color: colors.text }]}>Teknisyen Değiştir</Text><Text style={[styles.sheetOptionText, { color: colors.textSecondary }]}>Servise atanan teknisyeni güncelle.</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>
                        <Pressable style={({ pressed }) => [styles.sheetOption, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]} onPress={() => { setActionsVisible(false); navigation.navigate('ServiceDetail', { serviceId: actionService?.id, service: actionService, focus: 'status' }); }}>
                            <View style={[styles.sheetOptionIcon, { backgroundColor: '#F59E0B1A' }]}><MaterialCommunityIcons name="progress-clock" size={20} color="#F59E0B" /></View><View style={styles.sheetOptionBody}><Text style={[styles.sheetOptionTitle, { color: colors.text }]}>Durum Güncelle</Text><Text style={[styles.sheetOptionText, { color: colors.textSecondary }]}>Servisin anlık durumunu değiştir.</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>
                        <Pressable style={({ pressed }) => [styles.sheetOption, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]} onPress={() => { setActionsVisible(false); handleActionCall(actionService?.customer_phone); }}>
                            <View style={[styles.sheetOptionIcon, { backgroundColor: '#10B9811A' }]}><MaterialCommunityIcons name="phone-outline" size={20} color="#10B981" /></View><View style={styles.sheetOptionBody}><Text style={[styles.sheetOptionTitle, { color: colors.text }]}>Müşteriyi Ara</Text><Text style={[styles.sheetOptionText, { color: colors.textSecondary }]}>Müşteri ile telefon görüşmesi başlat.</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>
                        <Pressable style={({ pressed }) => [styles.sheetOption, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]} onPress={() => { setActionsVisible(false); openCommunicationSheet(actionService, 'whatsapp'); }}>
                            <View style={[styles.sheetOptionIcon, { backgroundColor: '#22C55E1A' }]}><MaterialCommunityIcons name="whatsapp" size={20} color="#22C55E" /></View><View style={styles.sheetOptionBody}><Text style={[styles.sheetOptionTitle, { color: colors.text }]}>WhatsApp ile Bilgi Ver</Text><Text style={[styles.sheetOptionText, { color: colors.textSecondary }]}>Durum bilgisini WhatsApp'tan ilet.</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>
                        <Pressable style={({ pressed }) => [styles.sheetOption, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]} onPress={() => { setActionsVisible(false); handleWhatsAppPdf(actionService); }}>
                            <View style={[styles.sheetOptionIcon, { backgroundColor: '#EF44441A' }]}><MaterialCommunityIcons name="file-pdf-box" size={20} color="#EF4444" /></View><View style={styles.sheetOptionBody}><Text style={[styles.sheetOptionTitle, { color: colors.text }]}>Servis Formu PDF Gönder</Text><Text style={[styles.sheetOptionText, { color: colors.textSecondary }]}>Servis formunu WhatsApp ile PDF olarak ilet.</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>
                        <Pressable style={({ pressed }) => [styles.sheetOption, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]} onPress={() => { setActionsVisible(false); setRouteService(actionService); }}>
                            <View style={[styles.sheetOptionIcon, { backgroundColor: '#EC48991A' }]}><MaterialCommunityIcons name="navigation-variant-outline" size={20} color="#EC4899" /></View><View style={styles.sheetOptionBody}><Text style={[styles.sheetOptionTitle, { color: colors.text }]}>Yol Tarifi Al</Text><Text style={[styles.sheetOptionText, { color: colors.textSecondary }]}>Harita üzerinde adrese git.</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>
                    </BottomSheetScrollView>
                </AppBottomSheet>

                <AppBottomSheet
                    visible={Boolean(communicationType && selectedService)}
                    onClose={closeCommunicationSheet}
                    snapPoints={['48%']}
                    wrapContent={false}
                >
                    <BottomSheetScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.sheetHeader}>
                            <View style={styles.sheetHeaderTextWrap}>
                                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                                    {communicationType === 'whatsapp' ? 'WhatsApp Gönderimi' : 'SMS Gönderimi'}
                                </Text>
                                <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                                    {selectedService?.customer_full_name || 'Müşteri'}
                                </Text>
                            </View>
                        </View>

                        {communicationType === 'whatsapp' ? (
                            <>
                                <Pressable
                                    style={({ pressed }) => [styles.sheetOption, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
                                    onPress={handleWhatsAppTracking}
                                >
                                    <View style={[styles.sheetOptionIcon, { backgroundColor: '#22C55E1A' }]}>
                                        <MaterialCommunityIcons name="link-variant" size={20} color="#16A34A" />
                                    </View>
                                    <View style={styles.sheetOptionBody}>
                                        <Text style={[styles.sheetOptionTitle, { color: colors.text }]}>{'Takip Linki Gönder'}</Text>
                                        <Text style={[styles.sheetOptionText, { color: colors.textSecondary }]}>{'Servis durumunu takip edebileceği bağlantıyı gönder.'}</Text>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                                </Pressable>

                                    <Pressable
                                        style={({ pressed }) => [styles.sheetOption, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
                                        onPress={handleWhatsAppPdf}
                                    >
                                        <View style={[styles.sheetOptionIcon, { backgroundColor: '#EF44441A' }]}>
                                            <MaterialCommunityIcons name="file-pdf-box" size={20} color="#EF4444" />
                                        </View>
                                        <View style={styles.sheetOptionBody}>
                                            <Text style={[styles.sheetOptionTitle, { color: colors.text }]}>{'Servis Formu PDF Gönder'}</Text>
                                            <Text style={[styles.sheetOptionText, { color: colors.textSecondary }]}>Servis formunu PDF ekli mesaj olarak ilet.</Text>
                                        </View>
                                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                                    </Pressable>

                            </>
                        ) : null}

                        {communicationType === 'sms' ? (
                            <Pressable
                                style={({ pressed }) => [styles.sheetOption, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
                                onPress={handleSmsTracking}
                            >
                                <View style={[styles.sheetOptionIcon, { backgroundColor: '#2563EB1A' }]}>
                                    <MaterialCommunityIcons name="link-variant" size={20} color="#2563EB" />
                                </View>
                                <View style={styles.sheetOptionBody}>
                                    <Text style={[styles.sheetOptionTitle, { color: colors.text }]}>{'Takip Linki Gönder'}</Text>
                                    <Text style={[styles.sheetOptionText, { color: colors.textSecondary }]}>{'SMS ile servis takip bağlantısını gönder.'}</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                            </Pressable>
                        ) : null}
                    </BottomSheetScrollView>
                </AppBottomSheet>
            </View>
        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateSelectorRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.gutter,
        marginBottom: spacing.m,
        gap: sp(8),
    },
    dateNavBtn: {
        width: sp(40),
        height: sp(40),
        borderRadius: sp(12),
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    dateCenterBtn: {
        flex: 1,
        height: sp(40),
        borderRadius: sp(12),
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: sp(12),
    },
    dateCenterText: {
        fontSize: fontScale(13),
        fontWeight: '700',
    },
    listContent: {
        paddingHorizontal: spacing.gutter,
        gap: sp(12),
    },
    card: {
        borderWidth: 1,
        borderRadius: sp(16),
        padding: sp(16),
        gap: sp(12),
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardTime: {
        fontSize: fontScale(14),
        fontWeight: '800',
    },
    badgeContainer: {
        paddingHorizontal: sp(8),
        paddingVertical: sp(4),
        borderRadius: sp(8),
    },
    badgeLabel: {
        fontSize: fontScale(10),
        fontWeight: '700',
    },
    cardBody: {
        gap: sp(4),
    },
    customerName: {
        fontSize: fontScale(15),
        fontWeight: '700',
    },
    deviceText: {
        fontSize: fontScale(12),
        fontWeight: '500',
    },
    faultText: {
        fontSize: fontScale(11),
        lineHeight: sp(16),
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp(4),
        marginTop: sp(4),
    },
    addressText: {
        fontSize: fontScale(11),
        flex: 1,
    },
    cardMainArea: {
        paddingBottom: sp(12),
    },
    cardActions: {
        borderTopWidth: 1,
        paddingTop: sp(10),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: sp(6),
    },
    actionBtn: {
        flex: 1,
        maxWidth: sp(52),
        minHeight: sp(44),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: sp(12),
        backgroundColor: '#F8FAFC',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: sp(48),
        gap: sp(12),
    },
    emptyStateText: {
        fontSize: fontScale(12),
        textAlign: 'center',
    },
    createServiceFab: {
        position: 'absolute',
        right: spacing.gutter,
        width: sp(58),
        height: sp(58),
        borderRadius: sp(20),
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 7,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: sp(5) },
        shadowOpacity: 0.24,
        shadowRadius: sp(10),
    },
    actionsSheetScroll: { flex: 1 },
    actionsSheetContent: { paddingBottom: sp(120), flexGrow: 1 },
    sheetContent: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.s,
        paddingBottom: spacing.xl,
        gap: spacing.s,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
        marginBottom: spacing.s,
    },
    sheetHeaderTextWrap: {
        flex: 1,
        gap: sp(2),
    },
    sheetTitle: {
        fontSize: fontScale(17),
        fontWeight: '800',
    },
    sheetSubtitle: {
        fontSize: fontScale(12),
        fontWeight: '500',
    },
    sheetOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
        borderWidth: 1,
        borderRadius: sp(16),
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.m,
    },
    sheetOptionIcon: {
        width: sp(42),
        height: sp(42),
        borderRadius: sp(14),
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetOptionBody: {
        flex: 1,
        gap: sp(2),
    },
    sheetOptionTitle: {
        fontSize: fontScale(13),
        fontWeight: '700',
    },
    sheetOptionText: {
        fontSize: fontScale(11),
        fontWeight: '500',
        lineHeight: sp(16),
    },
});
