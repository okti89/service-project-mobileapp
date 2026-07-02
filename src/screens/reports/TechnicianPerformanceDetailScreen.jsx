import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import reportService from '@/services/reportService';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';

const money = (value) => Number(value || 0).toLocaleString('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
});

const numberText = (value) => Number(value || 0).toLocaleString('tr-TR');

const formatDate = (iso) => {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_META = {
    new: { label: 'Yeni', color: '#6B7280' },
    assigned: { label: 'Atandı', color: '#2563EB' },
    in_progress: { label: 'Devam Ediyor', color: '#F59E0B' },
    completed: { label: 'Tamamlandı', color: '#16A34A' },
    cancelled: { label: 'İptal', color: '#DC2626' },
    postponed: { label: 'Ertelendi', color: '#A855F7' },
};

const ServiceRow = ({ service, onPress }) => {
    const { colors } = useTheme();
    const meta = STATUS_META[service?.service_status] || { label: 'Bilinmiyor', color: '#6B7280' };
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.serviceRow,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.82 : 1 },
            ]}
        >
            <View style={[styles.serviceIcon, { backgroundColor: `${meta.color}16` }]}>
                <MaterialCommunityIcons name="wrench-outline" size={20} color={meta.color} />
            </View>
            <View style={styles.serviceInfo}>
                <View style={styles.serviceTopRow}>
                    <Text style={[styles.serviceReceipt, { color: colors.text }]} numberOfLines={1}>
                        #{service?.receipt_number || '—'}
                    </Text>
                    <Text style={[styles.serviceRevenue, { color: serviceGreen }]}>{money(service?.total_payment)}</Text>
                </View>
                <Text style={[styles.serviceCustomer, { color: colors.textSecondary }]} numberOfLines={1}>
                    {service?.customer_full_name || 'Müşteri'}
                </Text>
                {!!(service?.device_brand || service?.device_model) && (
                    <Text style={[styles.serviceDevice, { color: colors.textTertiary }]} numberOfLines={1}>
                        {service?.device_brand || ''} {service?.device_model || ''}
                    </Text>
                )}
                <View style={styles.serviceMetaRow}>
                    <View style={[styles.statusPill, { backgroundColor: `${meta.color}18`, borderColor: `${meta.color}40` }]}>
                        <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                        <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    <Text style={[styles.serviceDate, { color: colors.textTertiary }]}>{formatDate(service?.scheduled_date)}</Text>
                </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textTertiary} />
        </Pressable>
    );
};

export default function TechnicianPerformanceDetailScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { technicianId, technicianName } = route.params || {};
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const loadData = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        setError(null);
        try {
            const result = await reportService.getTechnicianDetailPerformance(technicianId);
            setData(result || null);
        } catch (err) {
            setError('Teknisyen performansı alınamadı.');
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [technicianId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData(true);
    };

    const openPdf = async () => {
        try {
            const url = reportService.buildPdfUrl('technician', { technician_id: technicianId });
            const supported = await Linking.canOpenURL(url);
            if (supported) await Linking.openURL(url);
            else Alert.alert('PDF açılamadı', 'Cihazınız PDF açmayı desteklemiyor.');
        } catch (e) {
            Alert.alert('Hata', 'PDF açılırken bir sorun oluştu.');
        }
    };

    if (isLoading) {
        return (
            <View style={[styles.screen, styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator color={serviceBlue} size="large" />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Performans yükleniyor...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.screen, styles.center, { backgroundColor: colors.background }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color={serviceRed} />
                <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
                <Pressable onPress={() => loadData()} style={[styles.retryButton, { backgroundColor: serviceBlue }]}>
                    <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
                    <Text style={styles.retryText}>Tekrar Dene</Text>
                </Pressable>
            </View>
        );
    }

    const services = Array.isArray(data?.services) ? data.services : [];
    const completed = Number(data?.completed_services_count || 0);
    const pending = Number(data?.pending_services_count || 0);
    const revenue = Number(data?.total_revenue_generated || 0);
    const total = completed + pending;

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
                <Pressable onPress={() => navigation.goBack()} style={[styles.iconButton, { borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
                </Pressable>
                <View style={styles.headerText}>
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                        {technicianName || data?.technician_name || 'Teknisyen'}
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Performans Detayı</Text>
                </View>
                <Pressable onPress={openPdf} style={[styles.iconButton, { borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="file-pdf-box" size={22} color={serviceRed} />
                </Pressable>
            </View>

            <FlatList
                data={services}
                keyExtractor={(item) => String(item.id || item.receipt_number)}
                renderItem={({ item }) => (
                    <ServiceRow
                        service={item}
                        onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.id })}
                    />
                )}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={serviceBlue} />
                }
                ListHeaderComponent={
                    <>
                        <LinearGradient
                            colors={isDark ? ['#26324D', '#1D2438'] : ['#0066CC', '#0EA5E9']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.hero}
                        >
                            <Text style={styles.heroLabel}>Toplam ciro</Text>
                            <Text style={styles.heroValue}>{money(revenue)}</Text>
                            <View style={styles.heroRow}>
                                <View style={styles.heroBox}>
                                    <Text style={styles.heroBoxValue}>{numberText(completed)}</Text>
                                    <Text style={styles.heroBoxLabel}>Tamamlanan</Text>
                                </View>
                                <View style={styles.heroBox}>
                                    <Text style={styles.heroBoxValue}>{numberText(pending)}</Text>
                                    <Text style={styles.heroBoxLabel}>Bekleyen</Text>
                                </View>
                                <View style={styles.heroBox}>
                                    <Text style={styles.heroBoxValue}>{numberText(total)}</Text>
                                    <Text style={styles.heroBoxLabel}>Toplam</Text>
                                </View>
                            </View>
                        </LinearGradient>

                        <View style={styles.statsGrid}>
                            <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <MaterialCommunityIcons name="check-decagram-outline" size={20} color={serviceGreen} />
                                <Text style={[styles.statValue, { color: colors.text }]}>{numberText(completed)}</Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tamamlanan</Text>
                            </View>
                            <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <MaterialCommunityIcons name="timer-sand" size={20} color={serviceOrange} />
                                <Text style={[styles.statValue, { color: colors.text }]}>{numberText(pending)}</Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Bekleyen</Text>
                            </View>
                            <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <MaterialCommunityIcons name="cash-multiple" size={20} color={serviceBlue} />
                                <Text style={[styles.statValue, { color: colors.text }]}>{money(revenue)}</Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ciro</Text>
                            </View>
                        </View>

                        <View style={styles.listHeader}>
                            <Text style={[styles.listTitle, { color: colors.text }]}>Servisler</Text>
                            <Text style={[styles.listCount, { color: colors.textSecondary }]}>{services.length} kayıt</Text>
                        </View>
                    </>
                }
                ListEmptyComponent={
                    <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="wrench-outline" size={36} color={colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>Henüz servis yok</Text>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            Bu teknisyen için dönem içinde servis kaydı bulunamadı.
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 12 },
    iconButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    headerText: { flex: 1, marginHorizontal: 14 },
    title: { fontSize: 22, fontWeight: '900' },
    subtitle: { fontSize: 12, fontWeight: '700', marginTop: 3 },
    listContent: { paddingHorizontal: 18, paddingBottom: 32 },
    hero: { borderRadius: 22, padding: 18, marginBottom: 14 },
    heroLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '800', marginBottom: 4 },
    heroValue: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
    heroRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
    heroBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 12, padding: 10 },
    heroBoxValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
    heroBoxLabel: { color: 'rgba(255,255,255,0.74)', fontSize: 11, fontWeight: '700', marginTop: 3 },
    statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    statBox: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, alignItems: 'center' },
    statValue: { fontSize: 16, fontWeight: '900', marginTop: 6 },
    statLabel: { fontSize: 11, fontWeight: '700', marginTop: 3 },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 },
    listTitle: { fontSize: 17, fontWeight: '900' },
    listCount: { fontSize: 12, fontWeight: '800' },
    serviceRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 18, padding: 12 },
    serviceIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    serviceInfo: { flex: 1, marginRight: 6 },
    serviceTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    serviceReceipt: { fontSize: 14, fontWeight: '900' },
    serviceRevenue: { fontSize: 14, fontWeight: '900' },
    serviceCustomer: { fontSize: 12, fontWeight: '700', marginTop: 3 },
    serviceDevice: { fontSize: 11, fontWeight: '700', marginTop: 3 },
    serviceMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
    statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, gap: 5 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 10, fontWeight: '900' },
    serviceDate: { fontSize: 11, fontWeight: '800' },
    emptyCard: { borderWidth: 1, borderRadius: 22, padding: 28, alignItems: 'center', marginTop: 20 },
    emptyTitle: { fontSize: 16, fontWeight: '900', marginTop: 8 },
    emptyText: { fontSize: 12, fontWeight: '700', marginTop: 4, textAlign: 'center' },
    loadingText: { fontSize: 13, fontWeight: '700' },
    errorText: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
    retryButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 14, gap: 8, marginTop: 8 },
    retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
