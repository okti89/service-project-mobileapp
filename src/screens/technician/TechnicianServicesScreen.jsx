import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Linking,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { useTheme } from '@/context/ThemeContext';
import { serviceBlue, serviceGreen } from '@/theme/color';
import { getServiceStatusLabel } from '@/utils/serviceStatus';

dayjs.locale('tr');

const getStatus = (status) => {
    switch (status) {
        case 'in_progress': return { color: '#D97706', bgColor: '#FEF3C7', label: 'Devam Ediyor' };
        case 'completed': return { color: '#16A34A', bgColor: '#DCFCE7', label: 'Tamamlandı' };
        case 'new':
        case 'assigned': return { color: '#2563EB', bgColor: '#DBEAFE', label: 'Planlandı' };
        default: return { color: '#4B5563', bgColor: '#F3F4F6', label: 'Planlandı' };
    }
};

const normalizePhone = (phone) => {
    let digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = `90${digits.slice(1)}`;
    if (digits.length === 10 && digits.startsWith('5')) digits = `90${digits}`;
    return digits;
};

export default function TechnicianServicesScreen({ navigation, route }) {
    const technicianId = route?.params?.technicianId;
    const customerId = route?.params?.customerId;
    const filterKey = technicianId ? 'technician' : 'customer';
    const filterId = technicianId || customerId;
    const listTitle = technicianId ? 'Teknisyen Servisleri' : 'Müşteri Servisleri';
    const ownerName = route?.params?.technicianName || route?.params?.customerName || (technicianId ? 'Teknisyen' : 'Müşteri');
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchServices = useCallback(async (isRefresh = false) => {
        if (!filterId) {
            setServices([]);
            setLoading(false);
            return;
        }

        if (!isRefresh) setLoading(true);
        try {
            const response = await api.get(ENDPOINTS.SERVICES.ADMIN_LIST, {
                params: { [filterKey]: filterId },
            });
            const rows = Array.isArray(response?.data) ? response.data : response?.data?.results;
            setServices(Array.isArray(rows) ? rows : []);
        } catch (error) {
            console.log('Technician services fetch error:', error?.response?.data || error?.message || error);
            setServices([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filterId, filterKey]);

    useFocusEffect(useCallback(() => {
        fetchServices();
    }, [fetchServices]));

    const renderService = ({ item }) => {
        const status = getStatus(item?.service_status);
        const time = item?.scheduled_date ? dayjs(item.scheduled_date).format('HH:mm') : '--:--';
        const deviceDescription = [item?.device_type_name, item?.device_brand_name, item?.device_model_name].filter(Boolean).join(' / ');
        const openUrl = (url) => Linking.openURL(url).catch(() => {});
        const openMaps = () => {
            if (!item?.customer_address) return;
            const query = encodeURIComponent(item.customer_address);
            const url = Platform.select({
                ios: `maps:0,0?q=${query}`,
                android: `geo:0,0?q=${query}`,
                default: `https://www.google.com/maps/search/?api=1&query=${query}`,
            });
            openUrl(url);
        };

        return (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable
                    onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.id, service: item })}
                    style={({ pressed }) => [styles.cardMainArea, { opacity: pressed ? 0.82 : 1 }]}
                >
                    <View style={styles.cardHeader}>
                        <Text style={[styles.cardTime, { color: serviceBlue }]}>{time}</Text>
                        <View style={[styles.badgeContainer, { backgroundColor: status.bgColor }]}>
                            <Text style={[styles.badgeLabel, { color: status.color }]}>{getServiceStatusLabel(item, status.label)}</Text>
                        </View>
                    </View>
                    <View style={styles.cardBody}>
                        <Text style={[styles.customerName, { color: colors.text }]}>{item?.customer_full_name || 'Müşteri bilgisi yok'}</Text>
                        {deviceDescription ? <Text style={[styles.deviceText, { color: colors.textSecondary }]}>{deviceDescription}</Text> : null}
                        {item?.fault_description ? <Text style={[styles.faultText, { color: colors.textTertiary }]} numberOfLines={2}>{item.fault_description}</Text> : null}
                        <View style={styles.addressRow}>
                            <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.textTertiary} />
                            <Text style={[styles.addressText, { color: colors.textTertiary }]} numberOfLines={1}>{item?.customer_address || 'Adres belirtilmemiş'}</Text>
                        </View>
                        {item?.technician_name ? (
                            <View style={[styles.addressRow, { marginTop: 4 }]}>
                                <MaterialCommunityIcons name="account-hard-hat-outline" size={14} color={colors.textTertiary} />
                                <Text style={[styles.addressText, { color: colors.textTertiary }]} numberOfLines={1}>{item.technician_name}</Text>
                            </View>
                        ) : null}
                    </View>
                </Pressable>
                <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                    <Pressable onPress={() => { const phone = normalizePhone(item?.customer_phone); if (phone) openUrl(`https://wa.me/${phone}`); }} style={styles.actionButton} accessibilityLabel="WhatsApp">
                        <MaterialCommunityIcons name="whatsapp" size={16} color="#25D366" />
                    </Pressable>
                    <Pressable onPress={() => item?.customer_phone && openUrl(`sms:${item.customer_phone}`)} style={styles.actionButton} accessibilityLabel="SMS">
                        <MaterialCommunityIcons name="message-text-outline" size={16} color={serviceBlue} />
                    </Pressable>
                    <Pressable onPress={() => item?.customer_phone && openUrl(`tel:${item.customer_phone}`)} style={styles.actionButton} accessibilityLabel="Müşteriyi ara">
                        <MaterialCommunityIcons name="phone-outline" size={16} color={serviceGreen} />
                    </Pressable>
                    <Pressable onPress={openMaps} style={styles.actionButton} accessibilityLabel="Yol tarifi al">
                        <MaterialCommunityIcons name="navigation-variant-outline" size={16} color="#7C3AED" />
                    </Pressable>
                    <Pressable onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.id, service: item })} style={styles.actionButton} accessibilityLabel="Servis işlemleri">
                        <MaterialCommunityIcons name="cog-outline" size={16} color="#64748B" />
                    </Pressable>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Geri dön">
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </Pressable>
                <View style={styles.headerText}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{listTitle}</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{ownerName}</Text>
                </View>
                <View style={styles.headerSpacer} />
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={serviceBlue} /></View>
            ) : (
                <FlatList
                    data={services}
                    keyExtractor={(item, index) => String(item?.id || index)}
                    renderItem={renderService}
                    contentContainerStyle={services.length ? styles.listContent : styles.emptyListContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchServices(true); }} tintColor={serviceBlue} />}
                    ListEmptyComponent={
                        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <MaterialCommunityIcons name="clipboard-text-outline" size={34} color={colors.textTertiary} />
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>Servis kaydı yok</Text>
                            <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>{technicianId ? 'Bu teknisyene atanmış servis bulunmuyor.' : 'Bu müşteriye ait servis bulunmuyor.'}</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
    backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
    headerText: { flex: 1 },
    headerTitle: { fontSize: 17, fontWeight: '800' },
    headerSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    headerSpacer: { width: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent: { padding: 16, gap: 12, paddingBottom: 32 },
    emptyListContent: { flexGrow: 1, padding: 16, justifyContent: 'center' },
    card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
    cardMainArea: { paddingBottom: 12 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTime: { fontSize: 14, fontWeight: '800' },
    badgeContainer: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    badgeLabel: { fontSize: 10, fontWeight: '700' },
    cardBody: { gap: 4, marginTop: 12 },
    customerName: { fontSize: 15, fontWeight: '700' },
    deviceText: { fontSize: 12, fontWeight: '500' },
    faultText: { fontSize: 11, lineHeight: 16 },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    addressText: { fontSize: 11, flex: 1 },
    cardActions: { borderTopWidth: 1, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
    actionButton: { flex: 1, maxWidth: 52, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F8FAFC' },
    emptyCard: { borderWidth: 1, borderRadius: 18, alignItems: 'center', padding: 28 },
    emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 10 },
    emptyDescription: { fontSize: 12, fontWeight: '600', marginTop: 4, textAlign: 'center' },
});
