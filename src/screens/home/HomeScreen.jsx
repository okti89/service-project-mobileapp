import React, { useEffect, useState, useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Image,
    ActivityIndicator,
    Linking,
    Alert,
    Platform,
    RefreshControl
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { useConfig } from "@/context/ConfigContext";
import { useToast } from '@/context/ToastContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { getNativeShare } from '@/utils/nativeShare';
import api from "@/api/axios";
import ENDPOINTS from "@/api/endpoints";
import { resolveMediaUrl } from "@/utils/mediaUrl";

import buildShiftState from "@/utils/shiftSummary";
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import HomeHeader from "@/components/home/HomeHeader";
import CalendarPickerSheet from "@/components/home/CalendarPickerSheet";
import AppBottomSheet from "@/components/AppBottomSheet";
import RouteMapModal from "@/components/common/RouteMapModal";

import { fs, sp, lh } from "@/theme/scale";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function HomeScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const { userInfo, isAdmin, syncLocationTrackingByShift, hasLocationTrackingPermissions, ensureLocationTrackingPermissions } = useAuth();
    const { unreadCount, updateUnreadCount } = useNotifications() || { unreadCount: 0 };
    const { config } = useConfig();
    const { showToast } = useToast();

    const calendarPickerRef = useRef(null);
    const shiftWarningRef = useRef(null);
    const [shiftWarningVisible, setShiftWarningVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState('my'); // 'my' or 'all'
    const [servicesLoading, setServicesLoading] = useState(false);
    const [services, setServices] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [now, setNow] = useState(dayjs());

    // Shift action loader state
    const [shiftActionLoading, setShiftActionLoading] = useState(false);
    const [shiftConfirmVisible, setShiftConfirmVisible] = useState(false);
    const [shiftStartOptionsVisible, setShiftStartOptionsVisible] = useState(false);
    const shiftConfirmRef = useRef(null);
    const shiftStartOptionsRef = useRef(null);

    // Service Actions Sheet state
    const [selectedService, setSelectedService] = useState(null);
    const [actionsSheetVisible, setActionsSheetVisible] = useState(false);
    const [routeService, setRouteService] = useState(null);
    const actionsSheetRef = useRef(null);

    // User details
    const firstName = userInfo?.first_name || '';
    const lastName = userInfo?.last_name || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || userInfo?.email || 'Mehmet Yılmaz';
    const roleLabel = isAdmin ? 'Sistem Yöneticisi' : (userInfo?.role_name || 'Teknik Servis Uzmanı');
    const avatarUri = resolveMediaUrl(userInfo?.avatar || userInfo?.profile_photo);

    const openShift = shifts.find((shift) => shift?.start_time && !shift?.end_time) || null;
    const openShiftDateLabel = openShift?.start_time
        ? dayjs(openShift.start_time).format('D MMMM YYYY')
        : '--';

    // Fetch data
    const fetchData = useCallback(async () => {
        setServicesLoading(true);
        try {
            const todayStr = dayjs().format('YYYY-MM-DD');
            const targetDateStr = dayjs(selectedDate).format('YYYY-MM-DD');

            // 1. Fetch services for the selected date
            const endpoint = (isAdmin && activeTab === 'all')
                ? ENDPOINTS.SERVICES.ADMIN_LIST
                : ENDPOINTS.SERVICES.TECHNICIAN_LIST;
            const params = (isAdmin && activeTab === 'all')
                ? { start_date: targetDateStr, end_date: targetDateStr }
                : { date: targetDateStr };
            const servicesRes = await api.get(endpoint, { params });
            setServices(Array.isArray(servicesRes?.data) ? servicesRes.data : []);

            // 2. Fetch shifts from last 30 days to detect any overnight open shifts
            const shiftsRes = await api.get(ENDPOINTS.TECHNICIAN.SHIFTS, {
                params: {
                    start_date: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
                    end_date: todayStr
                }
            });
            setShifts(Array.isArray(shiftsRes?.data) ? shiftsRes.data : []);

            if (updateUnreadCount) {
                updateUnreadCount();
            }
        } catch (error) {
            console.error('Home data fetch error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setServicesLoading(false);
        }
    }, [updateUnreadCount, selectedDate, activeTab, isAdmin]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useFocusEffect(
        useCallback(() => {
            updateUnreadCount?.();
        }, [updateUnreadCount])
    );
    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // Digital timer tick when active shift exists
    useEffect(() => {
        const timer = setInterval(() => {
            setNow(dayjs());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Get current shift state using helper
    const shiftState = buildShiftState({ shifts, config, now });

    // Greeting message based on local hour
    const getGreeting = () => {
        const hour = dayjs().hour();
        if (hour < 12) return 'Günaydın';
        if (hour < 18) return 'Tünaydın';
        return 'İyi Akşamlar';
    };

    const startShift = async ({ enableLocationTracking }) => {
        setShiftStartOptionsVisible(false);

        if (enableLocationTracking) {
            const permissionsGranted = await ensureLocationTrackingPermissions();
            if (!permissionsGranted) {
                showToast('info', 'Canlı Takip Açılmadı', 'İzin verilmedi. Mesainizi konum paylaşmadan başlatabilirsiniz.');
                setShiftStartOptionsVisible(true);
                return;
            }
        }

        try {
            setShiftActionLoading(true);
            await api.post(ENDPOINTS.TECHNICIAN.SHIFT_START);
            if (enableLocationTracking) {
                void syncLocationTrackingByShift();
            } else {
                await syncLocationTrackingByShift({ forceStop: true });
            }
            showToast('success', 'Mesai Başladı', 'Mesainiz başarıyla başlatıldı.');
            fetchData();
        } catch (err) {
            showToast('error', 'Hata', err?.response?.data?.detail || 'Mesai başlatılamadı.');
        } finally {
            setShiftActionLoading(false);
        }
    };
    // Toggle shift start / stop
    const handleToggleShift = async () => {
        if (shiftState.isActiveToday) {
            // Aç onay bottom sheet'ini
            setShiftConfirmVisible(true);
        } else {
            if (shiftState.hasOvernightOpenShift) {
                setShiftWarningVisible(true);
                return;
            }
            const trackingPermissionsReady = await hasLocationTrackingPermissions();
            if (trackingPermissionsReady) {
                await startShift({ enableLocationTracking: true });
            } else {
                setShiftStartOptionsVisible(true);
            }
        }
    };

    const handleStopShiftConfirm = async () => {
        try {
            setShiftConfirmVisible(false);
            setShiftActionLoading(true);
            await api.post(ENDPOINTS.TECHNICIAN.SHIFT_STOP);
            await syncLocationTrackingByShift({ forceStop: true });
            showToast('success', 'Mesai Bitti', 'Mesainiz başarıyla sonlandırıldı.');
            fetchData();
        } catch (err) {
            showToast('error', 'Hata', err?.response?.data?.detail || 'Mesai bitirilemedi.');
        } finally {
            setShiftActionLoading(false);
        }
    };

    // Actions Sheet triggers
    const handleOpenActions = (service) => {
        setSelectedService(service);
        setActionsSheetVisible(true);
    };

    const handleCallCustomer = (phone) => {
        if (!phone) return;
        Linking.openURL(`tel:${phone}`).catch(() => {
            Alert.alert('Hata', 'Arama başlatılamadı.');
        });
    };

    const handleNavigateCustomer = (address) => {
        if (!address) return;
        const url = Platform.select({
            ios: `maps:0,0?q=${encodeURIComponent(address)}`,
            android: `geo:0,0?q=${encodeURIComponent(address)}`,
            default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
        });
        Linking.openURL(url).catch(() => {
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
        });
    };

    const handleWhatsAppTracking = async (phone, customerName, serviceId, currentStatus) => {
        if (!phone) return;
        const cleanPhone = phone.replace(/\D/g, '');
        try {
            let trackingUrl = '';
            if (config?.panel_url) {
                const baseUrl = config.panel_url.replace(/\/+$/, '');
                trackingUrl = `${baseUrl}/service-tracking/${serviceId}/`;
            }
            const statusLabel = getStatusBadge(currentStatus, 1)?.label || 'Planlandı';
            const message = `Sayın ${customerName || 'Müşterimiz'},\n\nServis Kaydınızın Durumu: *${statusLabel}*\n\nTakip Linki: ${trackingUrl || 'Yok'}`;

            Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`).catch(() => {
                showToast('error', 'Hata', 'WhatsApp açılamadı.');
            });
        } catch (error) {
            showToast('error', 'Hata', 'WhatsApp yönlendirmesi başarısız oldu.');
        }
    };

    const handleSmsTracking = async (phone, customerName, serviceId, currentStatus) => {
        if (!phone) return;
        const cleanPhone = phone.replace(/\D/g, '');
        let trackingUrl = '';
        if (config?.panel_url) {
            const baseUrl = config.panel_url.replace(/\/+$/, '');
            trackingUrl = `${baseUrl}/service-tracking/${serviceId}/`;
        }
        const statusLabel = getStatusBadge(currentStatus, 1)?.label || 'Planlandı';
        const message = `Sayın ${customerName || 'Müşterimiz'}, servis kaydınızın durumu: ${statusLabel}. Takip linki: ${trackingUrl || 'Yok'}`;

        Linking.openURL(`sms:${cleanPhone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`).catch(() => {
            showToast('error', 'Hata', 'SMS gönderilemedi.');
        });
    };

    const handleDownloadServicePdf = async (phone, serviceId) => {
        if (!serviceId) return;

        const temizNumara = (() => {
            if (!phone) return '';
            let rakamlar = phone.replace(/[^0-9]/g, "");
            if (rakamlar.startsWith("0")) {
                rakamlar = "90" + rakamlar.slice(1);
            }
            if (!rakamlar.startsWith("90") && rakamlar.length === 10) {
                rakamlar = "90" + rakamlar;
            }
            return rakamlar;
        })();

        if (!temizNumara) {
            showToast('warning', 'Telefon Eksik', 'Müşterinin telefon numarası bulunamadı.');
            return;
        }

        try {
            showToast('info', 'PDF Hazırlanıyor', 'Lütfen bekleyin...');

            const baseUrl = (api.defaults.baseURL || '').replace(/\/$/, '');
            const pdfEndpoint = `services/admin-services/${serviceId}/form-pdf/`;
            const fullUrl = `${baseUrl}/${pdfEndpoint}`;

            const token = await AsyncStorage.getItem('auth_token');
            const tenantCode = await AsyncStorage.getItem('tenant_code');

            const urlObj = new URL(fullUrl);
            if (token) urlObj.searchParams.set('token', token);
            if (tenantCode) urlObj.searchParams.set('tenant', tenantCode);

            const authenticatedPdfUrl = urlObj.toString();
            const filename = `servis_${serviceId.slice(0, 8)}.pdf`;
            const fileUri = `${FileSystem.cacheDirectory}${filename}`;

            // Download PDF file locally
            const result = await FileSystem.downloadAsync(authenticatedPdfUrl, fileUri, {
                headers: {
                    Authorization: token ? `Token ${token}` : '',
                    'X-Tenant-Code': tenantCode || '',
                }
            });

            if (result.status === 200) {
                const nativeShare = getNativeShare();
                if (!nativeShare) {
                    showToast('warning', 'Dev Modu', 'WhatsApp PDF gonderimi bu development build icinde kapali.');
                    return;
                }

                // Read downloaded PDF as base64 string
                const pdfBase64 = await FileSystem.readAsStringAsync(result.uri, {
                    encoding: FileSystem.EncodingType.Base64,
                });

                // Share Single via WhatsApp using react-native-share with pdf attached
                await nativeShare.shareSingle({
                    social: nativeShare.Social.WHATSAPP,
                    whatsAppNumber: temizNumara,
                    url: `data:application/pdf;base64,${pdfBase64}`,
                    type: "application/pdf",
                    filename: filename,
                    useInternalStorage: true,
                });
            } else {
                showToast('error', 'Hata', 'PDF dosyası hazırlanamadı.');
            }
        } catch (error) {
            console.error('PDF Whatsapp Error:', error);
            if (error?.message && !error.message.includes('User cancelled')) {
                showToast('error', 'Hata', 'WhatsApp üzerinden PDF gönderilemedi.');
            }
        }
    };

    // Format service status badge
    const getStatusBadge = (status, index) => {
        switch (status) {
            case 'new':
                return { label: 'Yeni', color: '#10B981', bgColor: '#E6F4EA', dotColor: '#10B981' };
            case 'assigned':
                return { label: 'Bekleme', color: '#2563EB', bgColor: '#DBEAFE', dotColor: '#2563EB' };
            case 'in_progress':
                return { label: 'Devam Ediyor', color: '#D97706', bgColor: '#FEF3C7', dotColor: '#D97706' };
            case 'postponed':
                return { label: 'Ertelendi', color: '#7C3AED', bgColor: '#F3E8FF', dotColor: '#7C3AED' };
            case 'completed':
                return { label: 'Tamamlandı', color: '#16A34A', bgColor: '#DCFCE7', dotColor: '#16A34A' };
            case 'cancelled':
                return { label: 'İptal Edildi', color: '#EF4444', bgColor: '#FEE2E2', dotColor: '#EF4444' };
            default:
                // Planlandı fallback
                if (index === 2) {
                    return { label: 'Planlandı', color: '#4B5563', bgColor: '#F3F4F6', dotColor: '#4B5563' };
                }
                return { label: 'Planlandı', color: '#2563EB', bgColor: '#DBEAFE', dotColor: '#2563EB' };
        }
    };

    // Computed Stats
    const todayCount = services.length;
    const completedCount = services.filter(s => s.service_status === 'completed').length;
    const ongoingCount = services.filter(s => s.service_status === 'in_progress').length;
    const plannedCount = services.filter(s => s.service_status === 'new' || s.service_status === 'assigned').length;

    if (loading && !refreshing) {
        return (
            <WrapperContainer edges={NO_BOTTOM_EDGES}>
                <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </WrapperContainer>
        );
    }

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES}>
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                <HomeHeader
                    unreadCount={unreadCount || 0}
                    onNotificationsPress={() => navigation.navigate('Notifications')}
                    isAdmin={isAdmin}
                />
                <ScrollView
                    contentContainerStyle={styles.scrollContainer}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
                    }
                >
                    {/* 2. TECHNICIAN CARD */}
                    <Pressable
                        style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={() => navigation.navigate('Profile')}
                    >
                        <View style={styles.avatarContainer}>
                            {avatarUri ? (
                                <Image source={{ uri: avatarUri }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatarFallback, { backgroundColor: `${colors.primary}12` }]}>
                                    <Text style={[styles.avatarFallbackText, { color: colors.primary }]}>
                                        {fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            <View style={[styles.onlineDot, { backgroundColor: '#10B981', borderColor: colors.surface }]} />
                        </View>
                        <View style={styles.profileDetails}>
                            <Text style={[styles.profileName, { color: colors.text }]}>{fullName}</Text>
                            <Text style={[styles.profileRole, { color: colors.textSecondary }]}>{roleLabel}</Text>
                            <View style={styles.statusRow}>
                                <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                                <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                                    Müsait • Servislere hazırsınız
                                </Text>
                            </View>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} />
                    </Pressable>

                    {/* 3. SHIFT CARD */}
                    <View style={[styles.shiftCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.shiftDetails}>
                            <Text style={[styles.shiftLabel, { color: colors.textSecondary }]}>Mesai Durumu</Text>
                            <View style={styles.shiftStatus}>
                                <Text style={[styles.shiftStatusText, { color: colors.text }]}>
                                    {shiftState.isActiveToday ? 'Mesai Devam Ediyor' : 'Mesai Başlatılmadı'}
                                </Text>
                                <View style={[styles.statusDot, { backgroundColor: shiftState.isActiveToday ? '#10B981' : colors.error, marginLeft: sp(6) }]} />
                            </View>
                            <Text style={[styles.shiftTimer, { color: colors.text }]}>
                                {shiftState.counterLabel || '00:00:00'}
                            </Text>
                            <View style={styles.shiftTimesRow}>
                                <Text style={[styles.shiftStart, { color: colors.textTertiary }]}>
                                    Giriş: {shiftState.startLabel !== '--:--' ? shiftState.startLabel : ('-- : --')}
                                </Text>
                                <Text style={[styles.shiftStart, { color: colors.textTertiary }]}>
                                    Bitiş: {shiftState.endLabel !== '--:--' ? shiftState.endLabel : ('-- : --')}
                                </Text>
                            </View>

                            {/* Şirket Mesai Saatleri Bilgisi */}
                            <Text style={[styles.shiftStart, { color: colors.textTertiary, marginTop: sp(4) }]}>
                                Şirket Saatleri: {shiftState.todayScheduleLabel || 'Tanımlı değil'}
                            </Text>

                            {/* Mesai Hedef Tamamlanma Barı */}
                            {shiftState.scheduleSeconds > 0 && (
                                <View style={styles.progressContainer}>
                                    <View style={[styles.progressBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]}>
                                        <View
                                            style={[
                                                styles.progressBarFill,
                                                {
                                                    width: `${shiftState.completedPercentage}%`,
                                                    backgroundColor: shiftState.completedPercentage >= 100 ? '#10B981' : '#0066CC',
                                                }
                                            ]}
                                        />
                                    </View>
                                    <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                                        Günlük Hedef: {shiftState.progressLabel}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Pressable
                            style={[
                                styles.shiftButton,
                                { backgroundColor: shiftState.isActiveToday ? '#EF4444' : '#00A36C' }
                            ]}
                            onPress={handleToggleShift}
                            disabled={shiftActionLoading}
                        >
                            {shiftActionLoading ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons
                                        name={shiftState.isActiveToday ? "stop-circle-outline" : "play-circle-outline"}
                                        size={20}
                                        color="#FFF"
                                    />
                                    <Text style={styles.shiftButtonText}>
                                        {shiftState.isActiveToday ? 'Mesaiyi Bitir' : 'Mesaiyi Başlat'}
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    </View>

                    {/* 5. TODAY'S SERVICES SECTION */}
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Servis Operasyonları</Text>
                        <Text style={[{ color: colors.textSecondary }]}>{todayCount} Kayıt</Text>
                    </View>
                    {/* Day navigation picker */}
                    <View style={styles.dateSelectorRow}>
                        <Pressable
                            onPress={() => {
                                setSelectedDate(prev => {
                                    const newDate = new Date(prev);
                                    newDate.setDate(newDate.getDate() - 1);
                                    return newDate;
                                });
                            }}
                            style={[styles.dateNavBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
                        </Pressable>

                        <Pressable
                            onPress={() => calendarPickerRef.current?.present()}
                            style={[styles.dateCenterBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                            <MaterialCommunityIcons name="calendar-outline" size={16} color="#0066CC" style={{ marginRight: 6 }} />
                            <Text style={[styles.dateCenterText, { color: colors.text }]}>
                                {dayjs(selectedDate).isSame(dayjs(), 'day') ? 'Bugün' : dayjs(selectedDate).format('D MMMM YYYY')}
                            </Text>
                            <MaterialCommunityIcons name="chevron-down" size={16} color={colors.textSecondary} style={{ marginLeft: 4 }} />
                        </Pressable>

                        <Pressable
                            onPress={() => {
                                setSelectedDate(prev => {
                                    const newDate = new Date(prev);
                                    newDate.setDate(newDate.getDate() + 1);
                                    return newDate;
                                });
                            }}
                            style={[styles.dateNavBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text} />
                        </Pressable>
                    </View>

                    {/* Tabs on HomeScreen if Admin (Material Top Tab Style) */}
                    {isAdmin && (
                        <View style={[styles.tabsContainer, { borderBottomColor: colors.border }]}>
                            <Pressable
                                onPress={() => setActiveTab('my')}
                                style={[
                                    styles.tabBtn,
                                    activeTab === 'my' && { borderBottomColor: isDark ? '#3B82F6' : '#0066CC' }
                                ]}
                            >
                                <Text style={[styles.tabText, { color: activeTab === 'my' ? (isDark ? '#3B82F6' : '#0066CC') : colors.textSecondary }]}>
                                    Benim Servislerim
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() => setActiveTab('all')}
                                style={[
                                    styles.tabBtn,
                                    activeTab === 'all' && { borderBottomColor: isDark ? '#3B82F6' : '#0066CC' }
                                ]}
                            >
                                <Text style={[styles.tabText, { color: activeTab === 'all' ? (isDark ? '#3B82F6' : '#0066CC') : colors.textSecondary }]}>
                                    Tüm Servisler
                                </Text>
                            </Pressable>
                        </View>
                    )}

                    {servicesLoading ? (
                        <View style={styles.inlineLoading}>
                            <ActivityIndicator size="small" color="#0066CC" />
                            <Text style={[styles.inlineLoadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
                        </View>
                    ) : services.length === 0 ? (
                        <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <MaterialCommunityIcons name="clipboard-text-outline" size={42} color={colors.textTertiary} />
                            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                                Seçilen tarihte servis kaydı bulunmuyor.
                            </Text>
                        </View>
                    ) : (
                        services.map((item, index) => {
                            const badge = getStatusBadge(item.service_status, index + 1);
                            const serviceTime = item.scheduled_date ? dayjs(item.scheduled_date).format('HH:mm') : '--:--';
                            const deviceDesc = [item.device_type_name, item.device_brand_name, item.device_model_name].filter(Boolean).join(' > ');
                            const serviceFault = [item.fault_description]
                            return (
                                <Pressable
                                    key={item.id}
                                    style={({ pressed }) => [
                                        styles.serviceCard,
                                        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }
                                    ]}
                                    onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.id, service: item })}
                                >
                                    <View style={styles.serviceRow}>
                                        {/* Time column - colored with same badge status color */}
                                        <Text style={[styles.serviceTime, { color: badge.dotColor }]}>
                                            {serviceTime}
                                        </Text>

                                        {/* Content column */}
                                        <View style={styles.serviceDetails}>
                                            <View style={styles.serviceHeaderRow}>
                                                <Text style={[styles.customerName, { color: colors.text }]} numberOfLines={1}>
                                                    {item.customer_full_name}
                                                </Text>
                                                {/* Badge */}
                                                <View style={[styles.badgeContainer, { backgroundColor: badge.bgColor }]}>
                                                    <View style={[styles.badgeDot, { backgroundColor: badge.dotColor }]} />
                                                    <Text style={[styles.badgeLabel, { color: badge.color }]}>
                                                        {badge.label}
                                                    </Text>
                                                </View>
                                            </View>

                                            <Text style={[styles.deviceText, { color: colors.textSecondary }]} numberOfLines={1}>
                                                {deviceDesc}
                                            </Text>
                                            <Text style={[styles.deviceText, { color: colors.textSecondary }]} numberOfLines={1}>
                                                {serviceFault}
                                            </Text>

                                            <View style={styles.locationRow}>
                                                <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.textTertiary} />
                                                <Text style={[styles.locationText, { color: colors.textTertiary }]} numberOfLines={1}>
                                                    {item.customer_address || 'Adres belirtilmemiş'}
                                                </Text>
                                            </View>

                                            {item.technician_name && (
                                                <View style={[styles.locationRow, { marginTop: 4 }]}>
                                                    <MaterialCommunityIcons name="account-hard-hat-outline" size={14} color={colors.textTertiary} />
                                                    <Text style={[styles.locationText, { color: colors.textTertiary }]} numberOfLines={1}>
                                                        {item.technician_name}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} style={styles.chevron} />
                                    </View>

                                    {/* Action Buttons inside item - styled dynamically with status color */}
                                    <View style={styles.cardActions}>
                                        <Pressable
                                            style={[styles.actionBtn, { borderColor: `${badge.dotColor}30` }]}
                                            onPress={() => handleCallCustomer(item.customer_phone)}
                                        >
                                            <MaterialCommunityIcons name="phone" size={18} color={badge.dotColor} />
                                        </Pressable>
                                        <Pressable
                                            style={[styles.actionBtn, { borderColor: `${badge.dotColor}30` }]}
                                            onPress={() => setRouteService(item)}
                                        >
                                            <MaterialCommunityIcons name="navigation-variant-outline" size={18} color={badge.dotColor} />
                                        </Pressable>
                                        <Pressable
                                            style={[styles.actionBtn, { borderColor: `${badge.dotColor}30` }]}
                                            onPress={() => handleWhatsAppTracking(item.customer_phone, item.customer_full_name, item.id, item.service_status)}
                                        >
                                            <MaterialCommunityIcons name="whatsapp" size={18} color={badge.dotColor} />
                                        </Pressable>
                                        <Pressable
                                            style={[styles.actionBtn, { borderColor: `${badge.dotColor}30` }]}
                                            onPress={() => handleSmsTracking(item.customer_phone, item.customer_full_name, item.id, item.service_status)}
                                        >
                                            <MaterialCommunityIcons name="message-text-outline" size={18} color={badge.dotColor} />
                                        </Pressable>
                                        <Pressable
                                            style={[styles.actionBtn, { borderColor: `${badge.dotColor}30` }]}
                                            onPress={() => handleDownloadServicePdf(item.customer_phone, item.id)}
                                        >
                                            <MaterialCommunityIcons name="file-pdf-box" size={18} color={badge.dotColor} />
                                        </Pressable>
                                        <Pressable
                                            style={[styles.actionBtn, { borderColor: `${badge.dotColor}30`, width: 'auto', paddingHorizontal: sp(12), borderRadius: sp(10) }]}
                                            onPress={() => handleOpenActions(item)}
                                        >
                                            <MaterialCommunityIcons name="cog-outline" size={18} color={badge.dotColor} style={{ marginRight: sp(4) }} />
                                            <Text style={{ fontSize: fs(12), fontWeight: '700', color: badge.dotColor }}>İşlemler</Text>
                                        </Pressable>
                                    </View>
                                </Pressable>
                            );
                        })
                    )}

                </ScrollView>

                <CalendarPickerSheet
                    ref={calendarPickerRef}
                    selectedDate={selectedDate}
                    activeTab={activeTab}
                    onSelectDate={(date) => {
                        setSelectedDate(date);
                    }}
                />

                <AppBottomSheet
                    ref={shiftWarningRef}
                    visible={shiftWarningVisible}
                    onClose={() => setShiftWarningVisible(false)}
                    snapPoints={['50%']}
                >
                    <View style={styles.sheetContainer}>
                        <View style={styles.sheetHeader}>
                            <MaterialCommunityIcons name="clock-alert-outline" size={28} color="#F59E0B" />
                            <Text style={[styles.sheetTitle, { color: colors.text }]}>Açık Mesai Kaydı Bulundu</Text>
                        </View>

                        <Text style={[styles.sheetDesc, { color: colors.textSecondary }]}>
                            Önceki günlere ait açık kalmış bir mesai kaydınız tespit edildi. Yeni bir mesai başlatabilmek için öncelikle bu kaydı sonlandırmanız gerekmektedir.
                        </Text>

                        {/* Shift details card */}
                        <View style={[styles.shiftDetailCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: colors.border }]}>
                            <View style={styles.detailRow}>
                                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Başlangıç Tarihi:</Text>
                                <Text style={[styles.detailValue, { color: colors.text }]}>
                                    {openShiftDateLabel}
                                </Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Giriş Saati:</Text>
                                <Text style={[styles.detailValue, { color: colors.text }]}>
                                    {shiftState.startLabel || '--:--'}
                                </Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Durum:</Text>
                                <Text style={[styles.detailValue, { color: '#F59E0B', fontWeight: 'bold' }]}>Açık (Kapatılmadı)</Text>
                            </View>
                        </View>

                        <View style={styles.sheetActions}>
                            <Pressable
                                onPress={() => setShiftWarningVisible(false)}
                                style={({ pressed }) => [
                                    styles.cancelBtn,
                                    { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }
                                ]}
                            >
                                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Vazgeç</Text>
                            </Pressable>

                            <Pressable
                                onPress={async () => {
                                    try {
                                        setShiftWarningVisible(false);
                                        setShiftActionLoading(true);
                                        await api.post(ENDPOINTS.TECHNICIAN.SHIFT_STOP);
                                        await syncLocationTrackingByShift({ forceStop: true });
                                        showToast('success', 'Mesai Kapatıldı', 'Açık mesai kaydınız kapatıldı.');
                                        fetchData();
                                    } catch (err) {
                                        showToast('error', 'Hata', err?.response?.data?.detail || 'Mesai bitirilemedi.');
                                    } finally {
                                        setShiftActionLoading(false);
                                    }
                                }}
                                style={({ pressed }) => [
                                    styles.stopBtn,
                                    { backgroundColor: '#EF4444', opacity: pressed ? 0.85 : 1 }
                                ]}
                            >
                                <Text style={styles.stopBtnText}>Mesaiyi Kapat</Text>
                            </Pressable>
                        </View>
                    </View>
                </AppBottomSheet>

                <AppBottomSheet
                    ref={shiftStartOptionsRef}
                    visible={shiftStartOptionsVisible}
                    onClose={() => setShiftStartOptionsVisible(false)}
                    snapPoints={['48%']}
                >
                    <View style={styles.sheetContainer}>
                        <View style={styles.sheetHeader}>
                            <MaterialCommunityIcons name="map-marker-radius-outline" size={28} color="#2563EB" />
                            <Text style={[styles.sheetTitle, { color: colors.text }]}>Mesai ve Canlı Takip</Text>
                        </View>
                        <Text style={[styles.sheetDesc, { color: colors.textSecondary }]}>
                            Mesainizi konum paylaşmadan da başlatabilirsiniz. Canlı takip için önce konum, ardından arka planda konum izni gerekir. Takip yalnızca aktif mesainiz boyunca çalışır.
                        </Text>
                        <View style={styles.sheetActions}>
                            <Pressable
                                onPress={() => startShift({ enableLocationTracking: false })}
                                style={({ pressed }) => [styles.cancelBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                            >
                                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Sadece Mesaiyi Başlat</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => startShift({ enableLocationTracking: true })}
                                style={({ pressed }) => [styles.locationStartBtn, { opacity: pressed ? 0.85 : 1 }]}
                            >
                                <Text style={styles.locationStartBtnText}>Canlı Takibi Aç</Text>
                            </Pressable>
                        </View>
                    </View>
                </AppBottomSheet>


                <AppBottomSheet
                    ref={shiftConfirmRef}
                    visible={shiftConfirmVisible}
                    onClose={() => setShiftConfirmVisible(false)}
                    snapPoints={['40%']}
                >
                    <View style={styles.sheetContainer}>
                        <View style={styles.sheetHeader}>
                            <MaterialCommunityIcons name="logout" size={28} color="#EF4444" />
                            <Text style={[styles.sheetTitle, { color: colors.text }]}>Mesaiyi Sonlandır</Text>
                        </View>
                        <Text style={[styles.sheetDesc, { color: colors.textSecondary }]}>
                            Bugünkü aktif mesainizi bitirmek istediğinize emin misiniz? Sistem üzerinden çıkış saatiniz kaydedilecektir.
                        </Text>
                        <View style={styles.sheetActions}>
                            <Pressable
                                onPress={() => setShiftConfirmVisible(false)}
                                style={({ pressed }) => [
                                    styles.cancelBtn,
                                    { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }
                                ]}
                            >
                                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Vazgeç</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleStopShiftConfirm}
                                style={({ pressed }) => [
                                    styles.stopBtn,
                                    { backgroundColor: '#EF4444', opacity: pressed ? 0.85 : 1 }
                                ]}
                            >
                                <Text style={styles.stopBtnText}>Evet, Bitir</Text>
                            </Pressable>
                        </View>
                    </View>
                </AppBottomSheet>
                <RouteMapModal
                    visible={Boolean(routeService)}
                    onClose={() => setRouteService(null)}
                    address={routeService?.customer_address}
                    customerName={routeService?.customer_full_name}
                />

                <AppBottomSheet
                    ref={actionsSheetRef}
                    visible={actionsSheetVisible}
                    onClose={() => setActionsSheetVisible(false)}
                    snapPoints={['60%']}
                >
                    <BottomSheetScrollView contentContainerStyle={styles.sheetContainer}>
                        <View style={styles.sheetHeader}>
                            <MaterialCommunityIcons name="tools" size={28} color="#0066CC" />
                            <Text style={[styles.sheetTitle, { color: colors.text }]}>Hızlı İşlemler</Text>
                        </View>
                        <Text style={[styles.sheetDesc, { color: colors.textSecondary }]}>
                            {selectedService?.customer_full_name} için yapmak istediğiniz işlemi seçin:
                        </Text>

                        <View style={{ gap: sp(10), marginTop: sp(10), paddingBottom: sp(30) }}>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.actionOption,
                                    { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                                ]}
                                onPress={() => {
                                    setActionsSheetVisible(false);
                                    navigation.navigate('ServiceDetail', { serviceId: selectedService.id });
                                }}
                            >
                                <View style={[styles.actionOptionIcon, { backgroundColor: '#2563EB1A' }]}>
                                    <MaterialCommunityIcons name="eye-outline" size={20} color="#2563EB" />
                                </View>
                                <View style={styles.actionOptionBody}>
                                    <Text style={[styles.actionOptionTitle, { color: colors.text }]}>Detay Sayfasına Git</Text>
                                    <Text style={[styles.actionOptionText, { color: colors.textSecondary }]}>Servisin tüm detaylarını görüntüle.</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                            </Pressable>

                            <Pressable
                                style={({ pressed }) => [
                                    styles.actionOption,
                                    { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                                ]}
                                onPress={() => {
                                    setActionsSheetVisible(false);
                                    navigation.navigate('ServiceDetail', { serviceId: selectedService.id, focus: 'technician' });
                                }}
                            >
                                <View style={[styles.actionOptionIcon, { backgroundColor: '#8B5CF61A' }]}>
                                    <MaterialCommunityIcons name="account-edit-outline" size={20} color="#8B5CF6" />
                                </View>
                                <View style={styles.actionOptionBody}>
                                    <Text style={[styles.actionOptionTitle, { color: colors.text }]}>Teknisyen Değiştir</Text>
                                    <Text style={[styles.actionOptionText, { color: colors.textSecondary }]}>Servise atanan teknisyeni güncelle.</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                            </Pressable>

                            <Pressable
                                style={({ pressed }) => [
                                    styles.actionOption,
                                    { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                                ]}
                                onPress={() => {
                                    setActionsSheetVisible(false);
                                    navigation.navigate('ServiceDetail', { serviceId: selectedService.id, focus: 'status' });
                                }}
                            >
                                <View style={[styles.actionOptionIcon, { backgroundColor: '#F59E0B1A' }]}>
                                    <MaterialCommunityIcons name="progress-clock" size={20} color="#F59E0B" />
                                </View>
                                <View style={styles.actionOptionBody}>
                                    <Text style={[styles.actionOptionTitle, { color: colors.text }]}>Durum Güncelle</Text>
                                    <Text style={[styles.actionOptionText, { color: colors.textSecondary }]}>Servisin anlık durumunu değiştir.</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                            </Pressable>

                            <Pressable
                                style={({ pressed }) => [
                                    styles.actionOption,
                                    { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                                ]}
                                onPress={() => {
                                    setActionsSheetVisible(false);
                                    handleCallCustomer(selectedService?.customer_phone);
                                }}
                            >
                                <View style={[styles.actionOptionIcon, { backgroundColor: '#10B9811A' }]}>
                                    <MaterialCommunityIcons name="phone-outline" size={20} color="#10B981" />
                                </View>
                                <View style={styles.actionOptionBody}>
                                    <Text style={[styles.actionOptionTitle, { color: colors.text }]}>Müşteriyi Ara</Text>
                                    <Text style={[styles.actionOptionText, { color: colors.textSecondary }]}>Müşteri ile telefon görüşmesi başlat.</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                            </Pressable>

                            <Pressable
                                style={({ pressed }) => [
                                    styles.actionOption,
                                    { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                                ]}
                                onPress={() => {
                                    setActionsSheetVisible(false);
                                    handleWhatsAppTracking(
                                        selectedService?.customer_phone,
                                        selectedService?.customer_full_name,
                                        selectedService?.id,
                                        selectedService?.service_status
                                    );
                                }}
                            >
                                <View style={[styles.actionOptionIcon, { backgroundColor: '#22C55E1A' }]}>
                                    <MaterialCommunityIcons name="whatsapp" size={20} color="#22C55E" />
                                </View>
                                <View style={styles.actionOptionBody}>
                                    <Text style={[styles.actionOptionTitle, { color: colors.text }]}>WhatsApp ile Bilgi Ver</Text>
                                    <Text style={[styles.actionOptionText, { color: colors.textSecondary }]}>Durum bilgisini WhatsApp'tan ilet.</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                            </Pressable>

                            <Pressable
                                style={({ pressed }) => [
                                    styles.actionOption,
                                    { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                                ]}
                                onPress={() => {
                                    setActionsSheetVisible(false);
                                    setRouteService(selectedService);
                                }}
                            >
                                <View style={[styles.actionOptionIcon, { backgroundColor: '#EC48991A' }]}>
                                    <MaterialCommunityIcons name="navigation-variant-outline" size={20} color="#EC4899" />
                                </View>
                                <View style={styles.actionOptionBody}>
                                    <Text style={[styles.actionOptionTitle, { color: colors.text }]}>Yol Tarifi Al</Text>
                                    <Text style={[styles.actionOptionText, { color: colors.textSecondary }]}>Harita üzerinde adrese git.</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                            </Pressable>
                        </View>
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.l,
        paddingBottom: spacing.l,
    },
    headerGreeting: {
        fontSize: fs(13),
        fontWeight: '500',
    },
    headerName: {
        fontSize: fs(22),
        fontWeight: '700',
        lineHeight: lh(22, 1.25),
        marginTop: sp(2),
    },
    headerSub: {
        fontSize: fs(12),
        marginTop: sp(2),
    },
    bellButton: {
        width: sp(44),
        height: sp(44),
        borderRadius: sp(22),
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: sp(2),
        elevation: 1,
    },
    badge: {
        position: 'absolute',
        top: sp(2),
        right: sp(2),
        backgroundColor: '#2563EB',
        borderRadius: sp(9),
        width: sp(18),
        height: sp(18),
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: fs(10),
        fontWeight: 'bold',
    },
    scrollContainer: {
        paddingHorizontal: spacing.gutter,
        paddingBottom: sp(40),
        marginTop: sp(10)
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.l,
        borderRadius: sp(16),
        borderWidth: 1,
        marginBottom: spacing.l,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: sp(4),
        elevation: 2,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: sp(14),
    },
    avatar: {
        width: sp(52),
        height: sp(52),
        borderRadius: sp(26),
    },
    avatarFallback: {
        width: sp(52),
        height: sp(52),
        borderRadius: sp(26),
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarFallbackText: {
        fontSize: fs(18),
        fontWeight: 'bold',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 0,
        right: sp(2),
        width: sp(12),
        height: sp(12),
        borderRadius: sp(6),
        borderWidth: 2,
    },
    profileDetails: {
        flex: 1,
    },
    profileName: {
        fontSize: fs(15),
        fontWeight: '700',
    },
    profileRole: {
        fontSize: fs(12),
        marginTop: sp(2),
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: sp(6),
    },
    statusDot: {
        width: sp(8),
        height: sp(8),
        borderRadius: sp(4),
        marginRight: sp(6),
    },
    statusText: {
        fontSize: fs(12),
    },
    shiftCard: {
        padding: sp(20),
        borderRadius: sp(18),
        borderWidth: 1,
        marginBottom: spacing.xl,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: sp(6),
        elevation: 2,
    },
    shiftTimesRow: {
        flexDirection: 'row',
        gap: sp(12),
        marginTop: sp(2),
    },
    progressContainer: {
        marginTop: sp(10),
        gap: sp(4),
        width: '90%',
    },
    progressBarBg: {
        height: sp(6),
        borderRadius: sp(3),
        overflow: 'hidden',
        width: '100%',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: sp(3),
    },
    progressText: {
        fontSize: fs(10),
        fontWeight: '600',
    },
    shiftDetails: {
        flex: 1,
    },
    shiftLabel: {
        fontSize: fs(12),
        fontWeight: '500',
    },
    shiftStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: sp(2),
    },
    shiftStatusText: {
        fontSize: fs(15),
        fontWeight: '700',
    },
    shiftTimer: {
        fontSize: fs(32),
        fontWeight: '800',
        marginTop: sp(6),
        letterSpacing: -0.5,
    },
    shiftStart: {
        fontSize: fs(11),
        marginTop: sp(4),
    },
    shiftButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: sp(12),
        paddingHorizontal: sp(16),
        borderRadius: sp(14),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: sp(4),
        elevation: 4,
        gap: sp(6),
    },
    shiftButtonText: {
        color: '#FFFFFF',
        fontSize: fs(14),
        fontWeight: '700',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: sp(10),
        marginBottom: spacing.xl,
    },
    statCard: {
        width: '22%',
        padding: sp(10),
        borderRadius: sp(16),
        borderWidth: 1,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: sp(4),
        elevation: 1,
        justifyContent: 'center',
    },
    statIconWrap: {
        width: sp(26),
        height: sp(26),
        borderRadius: sp(12),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: sp(6),
    },
    statValue: {
        fontSize: fs(14),
        fontWeight: '800',
    },
    statLabel: {
        fontSize: fs(10),
        marginTop: sp(4),
        fontWeight: '500',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: sp(10),
        marginBottom: sp(14),
    },
    sectionTitle: {
        fontSize: fs(17),
        fontWeight: '700',
    },
    sectionLink: {
        fontSize: fs(14),
        fontWeight: '600',
    },
    emptyState: {
        padding: sp(30),
        borderRadius: sp(16),
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.l,
    },
    emptyStateText: {
        fontSize: fs(13),
        textAlign: 'center',
        marginTop: sp(10),
    },
    serviceCard: {
        padding: spacing.l,
        borderRadius: sp(16),
        borderWidth: 1,
        marginBottom: spacing.itemGap,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: sp(4),
        elevation: 1,
    },
    serviceRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    serviceTime: {
        fontSize: fs(15),
        fontWeight: '700',
        marginRight: sp(14),
        minWidth: sp(44),
    },
    serviceDetails: {
        flex: 1,
    },
    serviceHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingRight: sp(10),
    },
    customerName: {
        fontSize: fs(15),
        fontWeight: '700',
        flex: 1,
        marginRight: sp(8),
    },
    deviceText: {
        fontSize: fs(12),
        marginTop: sp(4),
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: sp(8),
        gap: sp(4),
    },
    locationText: {
        fontSize: fs(12),
        flex: 1,
    },
    badgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: sp(3),
        paddingHorizontal: sp(8),
        borderRadius: sp(10),
    },
    badgeDot: {
        width: sp(6),
        height: sp(6),
        borderRadius: sp(3),
        marginRight: sp(5),
    },
    badgeLabel: {
        fontSize: fs(10),
        fontWeight: '600',
    },
    chevron: {
        alignSelf: 'center',
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: sp(8),
        marginTop: sp(12),
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: sp(10),
    },
    actionBtn: {
        width: sp(36),
        height: sp(36),
        borderRadius: sp(18),
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    calendarButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.l,
        borderRadius: sp(14),
        borderWidth: 1,
        marginTop: sp(6),
        marginBottom: spacing.xl,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: sp(4),
        elevation: 1,
    },
    calendarButtonText: {
        fontSize: fs(14),
        fontWeight: '700',
    },
    dateSelectorRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
        fontSize: fs(13),
        fontWeight: '700',
    },
    tabsContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        marginBottom: spacing.m,
        justifyContent: 'space-between',
    },
    tabBtn: {
        flex: 1,
        paddingVertical: sp(12),
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabText: {
        fontSize: fs(13),
        fontWeight: '700',
    },
    inlineLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: sp(24),
        gap: sp(8),
    },
    inlineLoadingText: {
        fontSize: fs(12),
        fontWeight: '600',
    },
    sheetContainer: {
        paddingHorizontal: sp(20),
        paddingTop: sp(8),
        gap: sp(16),
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp(10),
    },
    sheetTitle: {
        fontSize: fs(18),
        fontWeight: '900',
    },
    sheetDesc: {
        fontSize: fs(12),
        lineHeight: lh(12, 1.45),
    },
    shiftDetailCard: {
        borderWidth: 1,
        borderRadius: sp(14),
        padding: sp(16),
        gap: sp(8),
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: fs(12),
        fontWeight: '600',
    },
    detailValue: {
        fontSize: fs(12),
        fontWeight: '700',
    },
    sheetActions: {
        flexDirection: 'row',
        gap: sp(12),
        marginTop: sp(8),
    },
    actionOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp(12),
        borderWidth: 1,
        borderRadius: sp(16),
        paddingHorizontal: sp(16),
        paddingVertical: sp(14),
    },
    actionOptionIcon: {
        width: sp(40),
        height: sp(40),
        borderRadius: sp(12),
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionOptionBody: {
        flex: 1,
        gap: sp(2),
    },
    actionOptionTitle: {
        fontSize: fs(14),
        fontWeight: '700',
    },
    actionOptionText: {
        fontSize: fs(12),
        fontWeight: '500',
        lineHeight: sp(16),
    },
    cancelBtn: {
        flex: 1,
        height: sp(44),
        borderRadius: sp(12),
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        fontSize: fs(13),
        fontWeight: '700',
    },
    locationStartBtn: {
        flex: 1,
        height: sp(44),
        borderRadius: sp(12),
        backgroundColor: '#2563EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationStartBtnText: {
        color: '#FFFFFF',
        fontSize: fs(13),
        fontWeight: '700',
    },
    stopBtn: {
        flex: 1,
        height: sp(44),
        borderRadius: sp(12),
        alignItems: 'center',
        justifyContent: 'center',
    },
    stopBtnText: {
        color: '#FFFFFF',
        fontSize: fs(13),
        fontWeight: '700',
    },
});
