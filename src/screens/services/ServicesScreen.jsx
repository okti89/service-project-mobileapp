import React, { useCallback, useEffect, useState, useRef } from 'react';
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
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import CalendarPickerSheet from '@/components/home/CalendarPickerSheet';
import { fs, sp } from '@/theme/scale';
import { spacing } from '@/theme/spacing';
import Header from '@/components/Header';

dayjs.locale('tr');

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Service Card Component ───────────────────────────────────────────────────

const ServiceCard = ({ item, index }) => {
    const { colors, isDark } = useTheme();
    const badge = getStatusColor(item.service_status);
    const time = item.scheduled_date ? dayjs(item.scheduled_date).format('HH:mm') : '--:--';
    const deviceDesc = [item.device_type_name, item.device_brand_name, item.device_model_name].filter(Boolean).join(' • ');

    const handleCall = () => {
        if (!item.customer_phone) {
            Alert.alert('Hata', 'Telefon numarası bulunamadı.');
            return;
        }
        Linking.openURL(`tel:${item.customer_phone}`).catch(() => {
            Alert.alert('Hata', 'Arama başlatılamadı.');
        });
    };

    const handleWhatsApp = () => {
        if (!item.customer_phone) {
            Alert.alert('Hata', 'Telefon numarası bulunamadı.');
            return;
        }
        const cleanPhone = item.customer_phone.replace(/\D/g, '');
        Linking.openURL(`https://wa.me/${cleanPhone}`).catch(() => {
            Alert.alert('Hata', 'WhatsApp açılamadı.');
        });
    };

    const handleNavigation = () => {
        if (!item.customer_address) {
            Alert.alert('Hata', 'Adres bilgisi bulunamadı.');
            return;
        }
        const url = Platform.select({
            ios: `maps:0,0?q=${encodeURIComponent(item.customer_address)}`,
            android: `geo:0,0?q=${encodeURIComponent(item.customer_address)}`,
            default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.customer_address)}`,
        });
        Linking.openURL(url).catch(() => {
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.customer_address)}`);
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
                {item.technician_name && (
                    <View style={[styles.addressRow, { marginTop: 4 }]}>
                        <MaterialCommunityIcons name="account-hard-hat-outline" size={14} color={colors.textTertiary} />
                        <Text style={[styles.addressText, { color: colors.textTertiary }]} numberOfLines={1}>
                            {item.technician_name}
                        </Text>
                    </View>
                )}
            </View>

            <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                <Pressable onPress={handleWhatsApp} style={styles.actionBtn}>
                    <MaterialCommunityIcons name="whatsapp" size={16} color="#25D366" />
                    <Text style={[styles.actionBtnText, { color: '#25D366' }]}>WhatsApp</Text>
                </Pressable>
                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                <Pressable onPress={handleCall} style={styles.actionBtn}>
                    <MaterialCommunityIcons name="phone-outline" size={16} color={serviceBlue} />
                    <Text style={[styles.actionBtnText, { color: serviceBlue }]}>Ara</Text>
                </Pressable>
                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                <Pressable onPress={handleNavigation} style={styles.actionBtn}>
                    <MaterialCommunityIcons name="navigation-variant-outline" size={16} color={serviceGreen} />
                    <Text style={[styles.actionBtnText, { color: serviceGreen }]}>Yol Tarifi</Text>
                </Pressable>
            </View>
        </View>
    );
};

// ─── Main Screen Component ────────────────────────────────────────────────────

export default function ServicesScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { isAdmin } = useAuth();

    const calendarPickerRef = useRef(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState('my'); // 'my' or 'all'
    const [viewMode, setViewMode] = useState('day'); // 'day', 'month', 'year'
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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

    const handlePrev = () => {
        setSelectedDate(prev => dayjs(prev).subtract(1, viewMode).toDate());
    };

    const handleNext = () => {
        setSelectedDate(prev => dayjs(prev).add(1, viewMode).toDate());
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchServices(true);
    };

    let dateLabel = '';
    if (viewMode === 'day') {
        dateLabel = dayjs(selectedDate).isSame(dayjs(), 'day') ? 'Bugün' : dayjs(selectedDate).format('D MMMM YYYY');
    } else if (viewMode === 'month') {
        dateLabel = dayjs(selectedDate).format('MMMM YYYY');
    } else {
        dateLabel = dayjs(selectedDate).format('YYYY');
    }

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES}>
            <View style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }}>
                {/* Header */}
                <Header
                    title="Servis Operasyonları"
                    showBack={true}
                    rightActions={[
                        {
                            icon: 'plus',
                            onPress: () => navigation.navigate('CreateService', {
                                onSuccess: () => fetchServices(),
                            }),
                            accessibilityLabel: 'Yeni Servis Ekle',
                        }
                    ]}
                />

                {/* Modern Tabs */}
                {isAdmin && (
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <Pressable
                            onPress={() => setActiveTab('my')}
                            style={{ flex: 1, paddingVertical: sp(14), alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === 'my' ? '#2563EB' : 'transparent' }}
                        >
                            <Text style={{ fontSize: fs(13), fontWeight: '700', color: activeTab === 'my' ? '#2563EB' : colors.textSecondary }}>
                                Benim Servislerim
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setActiveTab('all')}
                            style={{ flex: 1, paddingVertical: sp(14), alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === 'all' ? '#2563EB' : 'transparent' }}
                        >
                            <Text style={{ fontSize: fs(13), fontWeight: '700', color: activeTab === 'all' ? '#2563EB' : colors.textSecondary }}>
                                Tüm Servisler
                            </Text>
                        </Pressable>
                    </View>
                )}

                {/* View Mode & Date Selector */}
                <View style={{ paddingHorizontal: spacing.gutter, paddingTop: spacing.m, gap: spacing.m }}>
                    <View style={{ flexDirection: 'row', backgroundColor: isDark ? colors.surface : '#F1F5F9', borderRadius: sp(10), padding: sp(4) }}>
                        {[
                            { key: 'day', label: 'Günlük' },
                            { key: 'month', label: 'Aylık' },
                            { key: 'year', label: 'Yıllık' },
                        ].map(mode => (
                            <Pressable
                                key={mode.key}
                                onPress={() => setViewMode(mode.key)}
                                style={{ flex: 1, paddingVertical: sp(6), alignItems: 'center', borderRadius: sp(8), backgroundColor: viewMode === mode.key ? (isDark ? '#334155' : '#FFFFFF') : 'transparent', shadowColor: viewMode === mode.key ? '#000' : 'transparent', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: viewMode === mode.key ? 1 : 0 }}
                            >
                                <Text style={{ fontSize: fs(12), fontWeight: viewMode === mode.key ? '700' : '500', color: viewMode === mode.key ? colors.text : colors.textSecondary }}>
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
                            {viewMode === 'day' && <MaterialCommunityIcons name="chevron-down" size={16} color={colors.textSecondary} style={{ marginLeft: 4 }} />}
                        </Pressable>

                        <Pressable onPress={handleNext} style={({ pressed }) => [styles.dateNavBtn, { backgroundColor: isDark ? colors.surface : '#FFFFFF', borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}>
                            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text} />
                        </Pressable>
                    </View>
                </View>

                {/* Content */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={serviceBlue} />
                    </View>
                ) : (
                    <FlatList
                        data={services}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={({ item, index }) => (
                            <Pressable onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.id, service: item })}>
                                <ServiceCard item={item} index={index} />
                            </Pressable>
                        )}
                        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[serviceBlue]} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={colors.textTertiary} />
                                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                                    Seçilen tarihlerde servis kaydı bulunmuyor.
                                </Text>
                            </View>
                        }
                    />
                )}

                <CalendarPickerSheet
                    ref={calendarPickerRef}
                    selectedDate={selectedDate}
                    activeTab={activeTab}
                    onSelectDate={(date) => {
                        setSelectedDate(date);
                    }}
                />
            </View>
        </WrapperContainer >
    );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.gutter,
        paddingBottom: spacing.m,
    },
    headerBtn: {
        width: sp(40),
        height: sp(40),
        borderRadius: sp(12),
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    headerBtnPlaceholder: {
        width: sp(40),
    },
    headerTitle: {
        fontSize: fs(18),
        fontWeight: '900',
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
        fontSize: fs(13),
        fontWeight: '700',
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: sp(12),
        padding: sp(4),
        marginHorizontal: spacing.gutter,
        marginBottom: spacing.m,
        justifyContent: 'space-between',
    },
    tabBtn: {
        flex: 1,
        paddingVertical: sp(8),
        borderRadius: sp(10),
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabText: {
        fontSize: fs(12),
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
        fontSize: fs(14),
        fontWeight: '800',
    },
    badgeContainer: {
        paddingHorizontal: sp(8),
        paddingVertical: sp(4),
        borderRadius: sp(8),
    },
    badgeLabel: {
        fontSize: fs(10),
        fontWeight: '700',
    },
    cardBody: {
        gap: sp(4),
    },
    customerName: {
        fontSize: fs(15),
        fontWeight: '700',
    },
    deviceText: {
        fontSize: fs(12),
        fontWeight: '500',
    },
    faultText: {
        fontSize: fs(11),
        lineHeight: sp(16),
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp(4),
        marginTop: sp(4),
    },
    addressText: {
        fontSize: fs(11),
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
        fontSize: fs(11),
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
        fontSize: fs(12),
        textAlign: 'center',
    },
});
