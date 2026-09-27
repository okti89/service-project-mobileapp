import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Pressable,
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
import { getServiceStatusLabel } from '@/utils/serviceStatus';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';

// Set dayjs locale
dayjs.locale('tr');

const getInitials = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const getGreeting = () => {
    const hour = dayjs().hour();
    if (hour < 12) return 'Günaydın 👋';
    if (hour < 18) return 'İyi Günler 👋';
    return 'İyi Akşamlar 👋';
};

const STATUS_CONFIGS = {
    new: { label: 'Yeni', color: '#16A34A', bg: 'rgba(22, 197, 94, 0.1)' },
    assigned: { label: 'Atandı', color: '#2563EB', bg: 'rgba(37, 99, 235, 0.1)' },
    in_progress: { label: 'İşlemde', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' },
    postponed: { label: 'Ertelendi', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.1)' },
    completed: { label: 'Tamamlandı', color: '#16A34A', bg: 'rgba(22, 197, 94, 0.1)' },
    cancelled: { label: 'İptal', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.1)' },
};

export default function CustomerDetailScreen({ navigation, route }) {
    const customerId = route?.params?.customerId ?? route?.params?.id;
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();

    const [customer, setCustomer] = useState(null);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!customerId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const [custRes, servRes] = await Promise.all([
                api.get(ENDPOINTS.CUSTOMERS.DETAIL(customerId)),
                api.get(ENDPOINTS.SERVICES.ADMIN_LIST, { params: { customer: customerId } })
            ]);
            setCustomer(custRes.data);
            setServices(Array.isArray(servRes.data) ? servRes.data : []);
        } catch (error) {
            console.log('Customer detail fetch error:', error?.response?.data || error?.message || error);
            Alert.alert('Hata', 'Müşteri detayları yüklenemedi');
        } finally {
            setLoading(false);
        }
    }, [customerId]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const handleEdit = () => {
        navigation.navigate('AdminCustomerForm', { customer });
    };

    const handleCreateService = () => {
        navigation.navigate('CreateService', { prefilledCustomer: customer });
    };

    const handleLocation = () => {
        if (!customer?.address) {
            Alert.alert('Hata', 'Müşteri adresi bulunamadı');
            return;
        }
        navigation.navigate('LocationMap', {
            address: customer.address,
            title: customer.full_name,
            subtitle: customer.phone_number,
            showDirections: true,
        });
    };

    const handleCall = () => {
        if (!customer?.phone_number) {
            Alert.alert('Hata', 'Telefon numarası bulunamadı');
            return;
        }
        let rawDigits = customer.phone_number.replace(/\D/g, '');
        if (rawDigits.startsWith('90') && rawDigits.length === 12) {
            rawDigits = '+' + rawDigits;
        } else if (rawDigits.length === 10) {
            rawDigits = '+90' + rawDigits;
        } else if (rawDigits.startsWith('0') && rawDigits.length === 11) {
            rawDigits = '+90' + rawDigits.slice(1);
        }
        Linking.openURL(`tel:${rawDigits}`).catch(() => {
            Alert.alert('Hata', 'Arama başlatılamadı');
        });
    };

    const handleWhatsApp = () => {
        if (!customer?.phone_number) {
            Alert.alert('Hata', 'Telefon numarası bulunamadı');
            return;
        }
        let rawDigits = customer.phone_number.replace(/\D/g, '');
        if (rawDigits.startsWith('0')) {
            rawDigits = '90' + rawDigits.slice(1);
        } else if (!rawDigits.startsWith('90') && rawDigits.length === 10) {
            rawDigits = '90' + rawDigits;
        }
        Linking.openURL(`https://wa.me/${rawDigits}`).catch(() => {
            Alert.alert('Hata', 'WhatsApp açılamadı');
        });
    };

    const handleDelete = () => {
        Alert.alert(
            'Müşteri Sil',
            `"${customer?.full_name || 'Bu müşteri'}" silinecek. Emin misiniz?`,
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(ENDPOINTS.CUSTOMERS.DETAIL(customerId));
                            navigation.goBack();
                        } catch (error) {
                            Alert.alert('Hata', error?.response?.data?.detail || 'Silme başarısız');
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Müşteri Detayı</Text>
                    <View style={{ width: 36 }} />
                </View>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={serviceBlue} />
                </View>
            </View>
        );
    }

    if (!customer) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Müşteri Detayı</Text>
                    <View style={{ width: 36 }} />
                </View>
                <View style={styles.centerContainer}>
                    <MaterialCommunityIcons name="account-off" size={64} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.text }]}>Müşteri bulunamadı</Text>
                </View>
            </View>
        );
    }

    // Calculations based on Services list
    const initials = getInitials(customer.full_name);
    const totalServicesCount = services.length;
    const activeServices = services.filter(s => s.service_status !== 'completed' && s.service_status !== 'cancelled');
    const activeServicesCount = activeServices.length;
    const totalPaymentAmount = services.reduce((sum, s) => sum + Number(s.total_paid || 0), 0);
    const lastService = services[0] || null; // API returns sorted by scheduled_date desc
    const lastServiceDate = lastService ? dayjs(lastService.scheduled_date || lastService.created_at).format('DD MMM YYYY') : '-';

    // Payments extraction
    const payments = [];
    services.forEach(s => {
        if (s.payments && s.payments.length > 0) {
            s.payments.forEach(p => {
                payments.push({
                    ...p,
                    service_receipt_number: s.receipt_number,
                    service_fault_description: s.fault_description,
                    device_name: `${s.device_brand_name || s.device_brand || ''} ${s.device_model_name || s.device_model || ''}`.trim() || 'Cihaz Servisi',
                    service_id: s.id,
                });
            });
        }
    });
    payments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 8, alignItems: 'center' }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </Pressable>
                <View style={styles.headerTitleWrap}>
                    <Text style={[styles.headerTitleText, { color: colors.text, marginBottom: 0 }]}>Müşteri Detayı</Text>
                </View>
                <Pressable onPress={handleEdit} style={styles.backBtn}>
                    <MaterialCommunityIcons name="pencil-outline" size={22} color={serviceBlue} />
                </Pressable>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
                {/* Profile Card */}
                <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.profileRow}>
                        {/* Avatar */}
                        <View style={styles.avatarContainer}>
                            <View style={[styles.avatarWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EEF2F6' }]}>
                                <Text style={[styles.avatarText, { color: colors.textSecondary }]}>{initials}</Text>
                            </View>
                            <View style={[styles.statusDot, { backgroundColor: activeServicesCount > 0 ? '#22C55E' : '#E2E8F0', borderColor: colors.surface }]} />
                        </View>

                        {/* Customer Info */}
                        <View style={styles.customerInfo}>
                            <Text style={[styles.customerName, { color: colors.text }]}>{customer.full_name}</Text>
                            {customer.phone_number && (
                                <View style={styles.infoLine}>
                                    <MaterialCommunityIcons name="phone-outline" size={14} color={colors.textTertiary} style={{ marginRight: 6 }} />
                                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>{customer.phone_number}</Text>
                                </View>
                            )}
                            {customer.email && (
                                <View style={styles.infoLine}>
                                    <MaterialCommunityIcons name="email-outline" size={14} color={colors.textTertiary} style={{ marginRight: 6 }} />
                                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>{customer.email}</Text>
                                </View>
                            )}
                            {customer.address && (
                                <View style={styles.infoLine}>
                                    <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.textTertiary} style={{ marginRight: 6 }} />
                                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>{customer.address}</Text>
                                </View>
                            )}
                        </View>

                        {/* Status Badge */}
                        <View style={[styles.statusBadge, { backgroundColor: 'rgba(34, 197, 94, 0.08)' }]}>
                            <Text style={[styles.statusBadgeText, { color: '#22C55E' }]}>Aktif</Text>
                        </View>
                    </View>
                </View>

                {/* Stats Row */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.statsScroll}
                    contentContainerStyle={styles.statsScrollContent}
                >
                    {/* Stat Card: Total Services */}
                    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.statIconWrap, { backgroundColor: `${serviceBlue}10` }]}>
                            <MaterialCommunityIcons name="calendar-multiselect" size={18} color={serviceBlue} />
                        </View>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Toplam Servis</Text>
                        <Text style={[styles.statValue, { color: colors.text }]}>{totalServicesCount}</Text>
                    </View>

                    {/* Stat Card: Total Payment */}
                    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.statIconWrap, { backgroundColor: `${serviceOrange}10` }]}>
                            <MaterialCommunityIcons name="wallet-outline" size={18} color={serviceOrange} />
                        </View>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Toplam Ödeme</Text>
                        <Text style={[styles.statValue, { color: colors.text }]}>₺{totalPaymentAmount.toLocaleString('tr-TR')}</Text>
                    </View>

                    {/* Stat Card: Last Transaction */}
                    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.statIconWrap, { backgroundColor: '#8B5CF610' }]}>
                            <MaterialCommunityIcons name="clock-outline" size={18} color="#8B5CF6" />
                        </View>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Son İşlem</Text>
                        <Text style={[styles.statValue, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                            {lastServiceDate}
                        </Text>
                    </View>
                </ScrollView>

                {/* Quick Actions Row */}
                <View style={styles.actionsRow}>
                    <Pressable onPress={handleCall} style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="phone-outline" size={18} color={serviceBlue} style={{ marginRight: 6 }} />
                        <Text style={[styles.actionBtnText, { color: colors.text }]}>Ara</Text>
                    </Pressable>
                    <Pressable onPress={handleWhatsApp} style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="whatsapp" size={18} color="#25D366" style={{ marginRight: 6 }} />
                        <Text style={[styles.actionBtnText, { color: colors.text }]}>WhatsApp</Text>
                    </Pressable>
                    <Pressable onPress={handleLocation} style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="map-marker-outline" size={18} color={serviceGreen} style={{ marginRight: 6 }} />
                        <Text style={[styles.actionBtnText, { color: colors.text }]}>Adres</Text>
                    </Pressable>
                    <Pressable onPress={handleEdit} style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="pencil-outline" size={18} color={serviceOrange} style={{ marginRight: 6 }} />
                        <Text style={[styles.actionBtnText, { color: colors.text }]}>Düzenle</Text>
                    </Pressable>
                </View>

                <Pressable onPress={handleCreateService} style={[styles.createServiceButton, { backgroundColor: serviceBlue }]}>
                    <MaterialCommunityIcons name="clipboard-plus-outline" size={19} color="#FFFFFF" />
                    <Text style={styles.createServiceButtonText}>Bu müşteri için servis oluştur</Text>
                </Pressable>

                {/* Active Services List */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitleText, { color: colors.text }]}>Aktif Servisler</Text>
                    <Pressable onPress={() => navigation.navigate('AdminCustomerServices', { customerId: customer.id, customerName: customer.full_name })} style={styles.sectionMoreBtn}>
                        <Text style={[styles.sectionMoreText, { color: serviceBlue }]}>Tümü</Text>
                        <MaterialCommunityIcons name="chevron-right" size={16} color={serviceBlue} />
                    </Pressable>
                </View>

                {activeServices.length === 0 ? (
                    <View style={[styles.emptySectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>Müşterinin şu an aktif servisi bulunmamaktadır.</Text>
                    </View>
                ) : (
                    activeServices.map(s => {
                        const baseStatusConfig = STATUS_CONFIGS[s.service_status] || { color: colors.textSecondary, bg: colors.border };
                        const statusConfig = { ...baseStatusConfig, label: getServiceStatusLabel(s) };
                        return (
                            <Pressable
                                key={s.id}
                                onPress={() => navigation.navigate('AdminServiceDetail', { id: s.id })}
                                style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            >
                                <View style={[styles.listCardIconWrap, { backgroundColor: `${serviceBlue}10` }]}>
                                    <MaterialCommunityIcons name="cellphone-cog" size={20} color={serviceBlue} />
                                </View>
                                <View style={styles.listCardContent}>
                                    <Text style={[styles.listCardTitle, { color: colors.text }]} numberOfLines={1}>
                                        {s.device_brand_name || s.device_brand || 'Cihaz'} {s.device_model_name || s.device_model || ''}
                                    </Text>
                                    <Text style={[styles.listCardDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {s.fault_description || 'Servis Talebi'}
                                    </Text>
                                    <View style={styles.listCardDateRow}>
                                        <MaterialCommunityIcons name="calendar-blank-outline" size={12} color={colors.textTertiary} style={{ marginRight: 4 }} />
                                        <Text style={[styles.listCardDateText, { color: colors.textSecondary }]}>
                                            {dayjs(s.scheduled_date || s.created_at).format('DD MMM YYYY')}
                                        </Text>
                                        <MaterialCommunityIcons name="clock-outline" size={12} color={colors.textTertiary} style={{ marginLeft: 10, marginRight: 4 }} />
                                        <Text style={[styles.listCardDateText, { color: colors.textSecondary }]}>
                                            {dayjs(s.scheduled_date || s.created_at).format('HH:mm')}
                                        </Text>
                                    </View>
                                </View>
                                <View style={[styles.listStatusBadge, { backgroundColor: statusConfig.bg }]}>
                                    <Text style={[styles.listStatusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textTertiary} style={{ marginLeft: 6 }} />
                            </Pressable>
                        );
                    })
                )}

                {/* Payment History Section */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitleText, { color: colors.text }]}>Ödeme Geçmişi</Text>
                    <Pressable style={styles.sectionMoreBtn} onPress={() => {}}>
                        <Text style={[styles.sectionMoreText, { color: serviceBlue }]}>Tümü</Text>
                        <MaterialCommunityIcons name="chevron-right" size={16} color={serviceBlue} />
                    </Pressable>
                </View>

                {payments.length === 0 ? (
                    <View style={[styles.emptySectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>Ödeme kaydı bulunamadı.</Text>
                    </View>
                ) : (
                    payments.slice(0, 3).map(p => (
                        <View key={p.id} style={[styles.paymentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            {/* Date Column */}
                            <View style={styles.paymentDateCol}>
                                <Text style={[styles.paymentDateDay, { color: colors.text }]}>{dayjs(p.created_at).format('DD MMM YYYY')}</Text>
                                <Text style={[styles.paymentDateWeekday, { color: colors.textSecondary }]}>{dayjs(p.created_at).format('dddd')}</Text>
                            </View>

                            {/* Details Column */}
                            <View style={styles.paymentDetailsCol}>
                                <Text style={[styles.paymentServiceTitle, { color: colors.text }]} numberOfLines={1}>{p.device_name}</Text>
                                <Text style={[styles.paymentMethodText, { color: colors.textSecondary }]}>{p.payment_method_name || 'Ödeme Yöntemi'}</Text>
                            </View>

                            {/* Amount and Status */}
                            <View style={styles.paymentAmountCol}>
                                <Text style={[styles.paymentAmountText, { color: colors.text }]}>₺{Number(p.amount).toLocaleString('tr-TR')}</Text>
                                <View style={[styles.paymentStatusBadge, { backgroundColor: 'rgba(34, 197, 94, 0.08)' }]}>
                                    <Text style={[styles.paymentStatusText, { color: '#22C55E' }]}>Ödendi</Text>
                                </View>
                            </View>
                        </View>
                    ))
                )}

                {/* Notes Section */}
                <Text style={[styles.sectionTitleText, { color: colors.text, marginTop: 24, marginBottom: 12 }]}>Notlar</Text>
                {!customer.note ? (
                    <View style={[styles.emptySectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>Not bulunmamaktadır.</Text>
                    </View>
                ) : (
                    <View style={[styles.noteRowWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.noteIconCircle, { backgroundColor: 'rgba(139, 92, 246, 0.08)' }]}>
                            <MaterialCommunityIcons name="note-text-outline" size={16} color="#8B5CF6" />
                        </View>
                        <View style={styles.noteContentWrap}>
                            <Text style={[styles.noteContentText, { color: colors.text }]}>{customer.note}</Text>
                            <View style={styles.noteAuthorRow}>
                                <Text style={[styles.noteAuthorText, { color: colors.textTertiary }]}>Firma Yetkilisi</Text>
                                <Text style={[styles.noteDateText, { color: colors.textTertiary }]}>{dayjs(customer.updated_at || customer.created_at).format('DD MMM YYYY')}</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Delete Button */}
                <Pressable onPress={handleDelete} style={[styles.deleteBtn, { backgroundColor: 'rgba(220, 38, 38, 0.06)', borderColor: 'rgba(220, 38, 38, 0.15)' }]}>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={serviceRed} style={{ marginRight: 6 }} />
                    <Text style={[styles.deleteBtnText, { color: serviceRed }]}>Müşteriyi Sil</Text>
                </Pressable>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyText: {
        fontSize: 15,
        fontWeight: '600',
        marginTop: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    headerTitleWrap: {
        flex: 1,
        marginLeft: 12,
    },
    headerGreeting: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 2,
    },
    headerTitleText: {
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 2,
    },
    headerSubtitle: {
        fontSize: 11,
        fontWeight: '600',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    headerIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    profileCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    avatarContainer: {
        position: 'relative',
    },
    avatarWrap: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '900',
    },
    statusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2.5,
    },
    customerInfo: {
        flex: 1,
        marginLeft: 14,
        marginRight: 60,
    },
    customerName: {
        fontSize: 17,
        fontWeight: '800',
        marginBottom: 4,
    },
    infoLine: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
    },
    infoText: {
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
    },
    statusBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    statsScroll: {
        marginBottom: 16,
        marginHorizontal: -16,
    },
    statsScrollContent: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
    },
    statCard: {
        width: 112,
        borderRadius: 16,
        borderWidth: 1,
        padding: 12,
    },
    statIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '700',
    },
    statValue: {
        fontSize: 15,
        fontWeight: '900',
        marginTop: 3,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 20,
    },
    createServiceButton: {
        height: 46,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 16,
    },
    createServiceButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
    },
    actionBtn: {
        flex: 1,
        height: 38,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnText: {
        fontSize: 11,
        fontWeight: '800',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        marginBottom: 10,
    },
    sectionTitleText: {
        fontSize: 14,
        fontWeight: '900',
    },
    sectionMoreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionMoreText: {
        fontSize: 12,
        fontWeight: '800',
    },
    emptySectionCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptySectionText: {
        fontSize: 11.5,
        fontWeight: '600',
        textAlign: 'center',
    },
    listCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 16,
        padding: 12,
        marginBottom: 8,
    },
    listCardIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    listCardContent: {
        flex: 1,
        marginRight: 8,
    },
    listCardTitle: {
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 2,
    },
    listCardDesc: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 4,
    },
    listCardDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    listCardDateText: {
        fontSize: 10,
        fontWeight: '700',
    },
    listStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    listStatusText: {
        fontSize: 9,
        fontWeight: '800',
    },
    paymentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 16,
        padding: 12,
        marginBottom: 8,
    },
    paymentDateCol: {
        width: 80,
        borderRightWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.05)',
        paddingRight: 8,
    },
    paymentDateDay: {
        fontSize: 11,
        fontWeight: '800',
    },
    paymentDateWeekday: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 1,
    },
    paymentDetailsCol: {
        flex: 1,
        paddingHorizontal: 10,
    },
    paymentServiceTitle: {
        fontSize: 12,
        fontWeight: '800',
        marginBottom: 2,
    },
    paymentMethodText: {
        fontSize: 10,
        fontWeight: '600',
    },
    paymentAmountCol: {
        alignItems: 'flex-end',
    },
    paymentAmountText: {
        fontSize: 12,
        fontWeight: '800',
        marginBottom: 3,
    },
    paymentStatusBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    paymentStatusText: {
        fontSize: 8.5,
        fontWeight: '800',
    },
    noteRowWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderRadius: 16,
        padding: 12,
    },
    noteIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    noteContentWrap: {
        flex: 1,
    },
    noteContentText: {
        fontSize: 12.5,
        fontWeight: '600',
        lineHeight: 18,
    },
    noteAuthorRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    noteAuthorText: {
        fontSize: 10,
        fontWeight: '700',
    },
    noteDateText: {
        fontSize: 10,
        fontWeight: '700',
    },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        marginTop: 24,
        marginBottom: 12,
    },
    deleteBtnText: {
        fontSize: 13,
        fontWeight: '800',
    },
});
