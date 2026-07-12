import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Share from 'react-native-share';
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
import serviceService from '@/services/serviceService';

dayjs.locale('tr');

const getStatusColor = (status) => {
    switch (status) {
        case 'in_progress':
            return { color: '#D97706', bgColor: '#FEF3C7', label: 'Devam Ediyor' };
        case 'completed':
            return { color: '#16A34A', bgColor: '#DCFCE7', label: 'Tamamland\u0131' };
        case 'new':
        case 'assigned':
            return { color: '#2563EB', bgColor: '#DBEAFE', label: 'Planland\u0131' };
        default:
            return { color: '#4B5563', bgColor: '#F3F4F6', label: 'Planland\u0131' };
    }
};

const getStatusLabel = (status) => {
    switch (status) {
        case 'new': return 'Yeni';
        case 'assigned': return 'Atand\u0131';
        case 'in_progress': return 'Devam Ediyor';
        case 'postponed': return 'Ertelendi';
        case 'completed': return 'Tamamland\u0131';
        case 'cancelled': return '\u0130ptal Edildi';
        default: return 'Planland\u0131';
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

const ServiceCard = ({ item, onOpenWhatsappSheet, onOpenSmsSheet }) => {
    const { colors } = useTheme();
    const badge = getStatusColor(item.service_status);
    const time = item.scheduled_date ? dayjs(item.scheduled_date).format('HH:mm') : '--:--';
    const deviceDesc = [item.device_type_name, item.device_brand_name, item.device_model_name].filter(Boolean).join(' / ');

    const handleCall = () => {
        if (!item.customer_phone) {
            Alert.alert('Hata', 'Telefon numaras\u0131 bulunamad\u0131.');
            return;
        }
        Linking.openURL('tel:' + item.customer_phone).catch(() => {
            Alert.alert('Hata', 'Arama ba\u015flat\u0131lamad\u0131.');
        });
    };

    const handleNavigation = () => {
        if (!item.customer_address) {
            Alert.alert('Hata', 'Adres bilgisi bulunamad\u0131.');
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
            <View style={styles.cardHeader}>
                <Text style={[styles.cardTime, { color: serviceBlue }]}>{time}</Text>
                <View style={[styles.badgeContainer, { backgroundColor: badge.bgColor }]}>
                    <Text style={[styles.badgeLabel, { color: badge.color }]}>{badge.label}</Text>
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

            <View style={[styles.cardActions, { borderTopColor: colors.border }]}> 
                <Pressable onPress={() => onOpenWhatsappSheet(item)} style={styles.actionBtn}>
                    <MaterialCommunityIcons name="whatsapp" size={16} color="#25D366" />
                    <Text style={[styles.actionBtnText, { color: '#25D366' }]}>WhatsApp</Text>
                </Pressable>
                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                <Pressable onPress={() => onOpenSmsSheet(item)} style={styles.actionBtn}>
                    <MaterialCommunityIcons name="message-text-outline" size={16} color={serviceBlue} />
                    <Text style={[styles.actionBtnText, { color: serviceBlue }]}>SMS</Text>
                </Pressable>
                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                <Pressable onPress={handleCall} style={styles.actionBtn}>
                    <MaterialCommunityIcons name="phone-outline" size={16} color={serviceGreen} />
                    <Text style={[styles.actionBtnText, { color: serviceGreen }]}>Ara</Text>
                </Pressable>
                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                <Pressable onPress={handleNavigation} style={styles.actionBtn}>
                    <MaterialCommunityIcons name="navigation-variant-outline" size={16} color="#7C3AED" />
                    <Text style={[styles.actionBtnText, { color: '#7C3AED' }]}>Yol Tarifi</Text>
                </Pressable>
            </View>
        </View>
    );
};

export default function ServicesScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { isAdmin } = useAuth();
    const { config } = useConfig();
    const { showToast } = useToast();

    const calendarPickerRef = useRef(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState('my');
    const [viewMode, setViewMode] = useState('day');
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedService, setSelectedService] = useState(null);
    const [communicationType, setCommunicationType] = useState(null);

    const fetchServices = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            const startStr = dayjs(selectedDate).startOf(viewMode).format('YYYY-MM-DD');
            const endStr = dayjs(selectedDate).endOf(viewMode).format('YYYY-MM-DD');
            const endpoint = (isAdmin && activeTab === 'all')
                ? ENDPOINTS.SERVICES.ADMIN_LIST
                : ENDPOINTS.SERVICES.TECHNICIAN_LIST;
            const params = { start_date: startStr, end_date: endStr };
            const res = await api.get(endpoint, { params });
            setServices(Array.isArray(res?.data) ? res.data : []);
        } catch (err) {
            console.error('Fetch services error:', err?.response?.data || err?.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedDate, activeTab, viewMode, isAdmin]);

    useEffect(() => {
        fetchServices();
    }, [fetchServices]);

    const handlePrev = () => setSelectedDate((prev) => dayjs(prev).subtract(1, viewMode).toDate());
    const handleNext = () => setSelectedDate((prev) => dayjs(prev).add(1, viewMode).toDate());
    const handleRefresh = () => {
        setRefreshing(true);
        fetchServices(true);
    };

    const dateLabel = useMemo(() => {
        if (viewMode === 'day') {
            return dayjs(selectedDate).isSame(dayjs(), 'day') ? 'Bugün' : dayjs(selectedDate).format('D MMMM YYYY');
        }
        if (viewMode === 'month') return dayjs(selectedDate).format('MMMM YYYY');
        return dayjs(selectedDate).format('YYYY');
    }, [selectedDate, viewMode]);

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
            showToast('warning', 'Telefon Eksik', 'M\u00fc\u015fteri telefon numaras\u0131 bulunamad\u0131.');
            return;
        }
        const cleanPhone = normalizePhoneForWhatsApp(phone);
        const trackingUrl = buildTrackingUrl(config?.panel_url, selectedService?.id);
        const statusLabel = getStatusLabel(selectedService?.service_status);
        const customerName = selectedService?.customer_full_name || 'M\u00fc\u015fterimiz';
        const message = `Say\u0131n ${customerName}\n\nServis kayd\u0131n\u0131z\u0131n durumu: *${statusLabel}*\n\nTakip linki: ${trackingUrl || 'Yok'}`;
        closeCommunicationSheet();
        Linking.openURL('https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(message)).catch(() => {
            showToast('error', 'Hata', 'WhatsApp a\u00e7\u0131lamad\u0131.');
        });
    }, [closeCommunicationSheet, config?.panel_url, selectedService, showToast]);

    const handleSmsTracking = useCallback(async () => {
        const phone = String(selectedService?.customer_phone || '').replace(/\D/g, '');
        if (!phone) {
            showToast('warning', 'Telefon Eksik', 'M\u00fc\u015fteri telefon numaras\u0131 bulunamad\u0131.');
            return;
        }
        const trackingUrl = buildTrackingUrl(config?.panel_url, selectedService?.id);
        const statusLabel = getStatusLabel(selectedService?.service_status);
        const customerName = selectedService?.customer_full_name || 'M\u00fc\u015fterimiz';
        const message = `Say\u0131n ${customerName}, servis kayd\u0131n\u0131z\u0131n durumu: ${statusLabel}. Takip linki: ${trackingUrl || 'Yok'}`;
        closeCommunicationSheet();
        Linking.openURL('sms:' + phone + (Platform.OS === 'ios' ? '&' : '?') + 'body=' + encodeURIComponent(message)).catch(() => {
            showToast('error', 'Hata', 'SMS a\u00e7\u0131lamad\u0131.');
        });
    }, [closeCommunicationSheet, config?.panel_url, selectedService, showToast]);

    const handleWhatsAppPdf = useCallback(async () => {
        if (!selectedService?.id) return;
        const phone = normalizePhoneForWhatsApp(selectedService?.customer_phone);
        if (!phone) {
            showToast('warning', 'Telefon Eksik', 'M\u00fc\u015fteri telefon numaras\u0131 bulunamad\u0131.');
            return;
        }
        try {
            closeCommunicationSheet();
            showToast('info', 'PDF', 'Servis formu haz\u0131rlan\u0131yor...');
            const { uri, filename } = await serviceService.downloadServiceFormPdf(selectedService, { disposition: 'attachment' });
            const pdfBase64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            await Share.shareSingle({
                social: Share.Social.WHATSAPP,
                whatsAppNumber: phone,
                url: 'data:application/pdf;base64,' + pdfBase64,
                type: 'application/pdf',
                filename,
                useInternalStorage: true,
            });
        } catch (error) {
            if (error?.message && !String(error.message).toLowerCase().includes('cancel')) {
                console.error('ServicesScreen WhatsApp PDF error:', error);
                showToast('error', 'Hata', 'Servis formu WhatsApp ile g\u00f6nderilemedi.');
            }
        }
    }, [closeCommunicationSheet, selectedService, showToast]);

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES}>
            <View style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }}>
                <Header
                    title={'\u0053\u0065\u0072\u0076\u0069\u0073 \u004f\u0070\u0065\u0072\u0061\u0073\u0079\u006f\u006e\u006c\u0061\u0072\u0131'}
                    showBack
                    rightActions={[
                        {
                            icon: 'plus',
                            onPress: () => navigation.navigate('CreateService', {
                                onSuccess: () => fetchServices(),
                            }),
                            accessibilityLabel: 'Yeni Servis Ekle',
                        },
                    ]}
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
                                {'\u0054\u00fc\u006d \u0053\u0065\u0072\u0076\u0069\u0073\u006c\u0065\u0072'}
                            </Text>
                        </Pressable>
                    </View>
                ) : null}

                <View style={{ paddingHorizontal: spacing.gutter, paddingTop: spacing.m, gap: spacing.m }}>
                    <View style={{ flexDirection: 'row', backgroundColor: isDark ? colors.surface : '#F1F5F9', borderRadius: sp(10), padding: sp(4) }}>
                        {[
                            { key: 'day', label: '\u0047\u00fc\u006e\u006c\u00fc\u006b' },
                            { key: 'month', label: '\u0041\u0079\u006c\u0131\u006b' },
                            { key: 'year', label: '\u0059\u0131\u006c\u006c\u0131\u006b' },
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
                            <Pressable onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.id, service: item })}>
                                <ServiceCard item={item} onOpenWhatsappSheet={(service) => openCommunicationSheet(service, 'whatsapp')} onOpenSmsSheet={(service) => openCommunicationSheet(service, 'sms')} />
                            </Pressable>
                        )}
                        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[serviceBlue]} />}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={colors.textTertiary} />
                                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>{'\u0053\u0065\u00e7\u0069\u006c\u0065\u006e \u0074\u0061\u0072\u0069\u0068\u006c\u0065\u0072\u0064\u0065 \u0073\u0065\u0072\u0076\u0069\u0073 \u006b\u0061\u0079\u0064\u0131 \u0062\u0075\u006c\u0075\u006e\u006d\u0075\u0079\u006f\u0072.'}</Text>
                            </View>
                        }
                    />
                )}

                <CalendarPickerSheet
                    ref={calendarPickerRef}
                    selectedDate={selectedDate}
                    activeTab={activeTab}
                    onSelectDate={(date) => setSelectedDate(date)}
                />

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
                                    {communicationType === 'whatsapp' ? '\u0057\u0068\u0061\u0074\u0073\u0041\u0070\u0070 \u0047\u00f6\u006e\u0064\u0065\u0072\u0069\u006d\u0069' : '\u0053\u004d\u0053 \u0047\u00f6\u006e\u0064\u0065\u0072\u0069\u006d\u0069'}
                                </Text>
                                <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                                    {selectedService?.customer_full_name || '\u004d\u00fc\u015f\u0074\u0065\u0072\u0069'}
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
                                        <Text style={[styles.sheetOptionTitle, { color: colors.text }]}>{'\u0054\u0061\u006b\u0069\u0070 \u004c\u0069\u006e\u006b\u0069 \u0047\u00f6\u006e\u0064\u0065\u0072'}</Text>
                                        <Text style={[styles.sheetOptionText, { color: colors.textSecondary }]}>{'\u0053\u0065\u0072\u0076\u0069\u0073 \u0064\u0075\u0072\u0075\u006d\u0075\u006e\u0075 \u0074\u0061\u006b\u0069\u0070 \u0065\u0064\u0065\u0062\u0069\u006c\u0065\u0063\u0065\u011f\u0069 \u0062\u0061\u011f\u006c\u0061\u006e\u0074\u0131\u0079\u0131 \u0067\u00f6\u006e\u0064\u0065\u0072.'}</Text>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                                </Pressable>

                                {isAdmin ? (
                                    <Pressable
                                        style={({ pressed }) => [styles.sheetOption, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
                                        onPress={handleWhatsAppPdf}
                                    >
                                        <View style={[styles.sheetOptionIcon, { backgroundColor: '#EF44441A' }]}>
                                            <MaterialCommunityIcons name="file-pdf-box" size={20} color="#EF4444" />
                                        </View>
                                        <View style={styles.sheetOptionBody}>
                                            <Text style={[styles.sheetOptionTitle, { color: colors.text }]}>{'\u0053\u0065\u0072\u0076\u0069\u0073 \u0046\u006f\u0072\u006d\u0075 \u0050\u0044\u0046 \u0047\u00f6\u006e\u0064\u0065\u0072'}</Text>
                                            <Text style={[styles.sheetOptionText, { color: colors.textSecondary }]}>Servis formunu PDF ekli mesaj olarak ilet.</Text>
                                        </View>
                                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                                    </Pressable>
                                ) : null}
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
                                    <Text style={[styles.sheetOptionTitle, { color: colors.text }]}>{'\u0054\u0061\u006b\u0069\u0070 \u004c\u0069\u006e\u006b\u0069 \u0047\u00f6\u006e\u0064\u0065\u0072'}</Text>
                                    <Text style={[styles.sheetOptionText, { color: colors.textSecondary }]}>{'\u0053\u004d\u0053 \u0069\u006c\u0065 \u0073\u0065\u0072\u0076\u0069\u0073 \u0074\u0061\u006b\u0069\u0070 \u0062\u0061\u011f\u006c\u0061\u006e\u0074\u0131\u0073\u0131\u006e\u0131 \u0067\u00f6\u006e\u0064\u0065\u0072.'}</Text>
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
    cardActions: {
        borderTopWidth: 1,
        paddingTop: sp(12),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: sp(4),
    },
    actionBtnText: {
        fontSize: fontScale(11),
        fontWeight: '700',
    },
    actionDivider: {
        width: 1,
        height: sp(16),
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
    sheetContent: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.s,
        paddingBottom: spacing.xl,
        gap: spacing.s,
    },
    sheetHeader: {
        marginBottom: spacing.xs,
    },
    sheetHeaderTextWrap: {
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
