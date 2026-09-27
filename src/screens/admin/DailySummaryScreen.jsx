import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import CalendarPickerSheet from '@/components/home/CalendarPickerSheet';
import { exportDailyReportPdf } from '@/utils/dailyReportPdf';
import { serviceBlue, serviceGreen, serviceOrange } from '@/theme/color';

dayjs.locale('tr');

const money = (value) => `₺${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DailySummaryScreen({ navigation }) {
    const { colors } = useTheme();
    const { showToast } = useToast();
    const insets = useSafeAreaInsets();
    const calendarRef = useRef(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [exporting, setExporting] = useState(false);

    const dateValue = dayjs(selectedDate).format('YYYY-MM-DD');
    const load = useCallback(async (refresh = false) => {
        if (!refresh) setLoading(true);
        try {
            const response = await api.get(ENDPOINTS.REPORTS.DAILY_SUMMARY, { params: { date: dateValue } });
            setData(response.data || null);
        } catch (error) {
            console.log('Daily summary load error:', error?.response?.data || error?.message);
            showToast('error', 'Hata', 'Günlük icmal verileri yüklenemedi.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [dateValue, showToast]);

    useEffect(() => { load(); }, [load]);

    const changeDay = (amount) => setSelectedDate((value) => dayjs(value).add(amount, 'day').toDate());
    const openPdf = async () => {
        if (exporting) return;
        setExporting(true);
        try {
            showToast('info', 'PDF Hazırlanıyor', 'Günlük icmal raporu hazırlanıyor.');
            await exportDailyReportPdf({ type: 'summary', date: dateValue });
        } catch (error) {
            showToast('error', 'Hata', error?.message || 'Günlük icmal PDF dosyası oluşturulamadı.');
        } finally {
            setExporting(false);
        }
    };

    const isToday = dayjs(selectedDate).isSame(dayjs(), 'day');
    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES}>
            <Header title="Günlük İcmal" subtitle="Günlük operasyon ve tahsilat özeti" showBack />
            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} colors={[serviceBlue]} />}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.dateRow}>
                    <Pressable onPress={() => changeDay(-1)} style={[styles.dateArrow, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} /></Pressable>
                    <Pressable onPress={() => calendarRef.current?.present()} style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="calendar-outline" size={18} color={serviceBlue} />
                        <View><Text style={[styles.dateTitle, { color: colors.text }]}>{isToday ? 'Bugün' : dayjs(selectedDate).format('D MMMM YYYY')}</Text><Text style={[styles.dateHint, { color: colors.textSecondary }]}>{dayjs(selectedDate).format('dddd')}</Text></View>
                        <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable onPress={() => changeDay(1)} style={[styles.dateArrow, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name="chevron-right" size={24} color={colors.text} /></Pressable>
                </View>

                {loading ? <View style={styles.loading}><ActivityIndicator size="large" color={serviceBlue} /></View> : <>
                    <View style={[styles.summaryPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.summaryLine, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Toplam Servis</Text>
                            <Text style={[styles.summaryValue, { color: colors.text }]}>{data?.total_services || 0}</Text>
                            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Tahsil Edilen</Text>
                            <Text style={[styles.summaryValue, { color: serviceGreen }]}>{money(data?.collected_total)}</Text>
                        </View>
                        <View style={styles.summaryLine}>
                            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>İşlem Toplamı</Text>
                            <Text style={[styles.summaryValue, { color: colors.text }]}>{money(data?.total_revenue)}</Text>
                            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Açık Bakiye</Text>
                            <Text style={[styles.summaryValue, { color: '#D97706' }]}>{money(data?.outstanding_total)}</Text>
                        </View>
                    </View>

                    <Pressable onPress={openPdf} disabled={exporting} style={({ pressed }) => [styles.pdfButton, { backgroundColor: serviceBlue, opacity: pressed || exporting ? 0.78 : 1 }]}>
                        <Text style={styles.pdfText}>{exporting ? 'PDF hazırlanıyor...' : 'Günlük İcmal PDF Aç'}</Text>
                    </Pressable>

                    <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.text }]}>Servis Hareketleri</Text><Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Seçilen günün planlanan servisleri</Text></View>
                    {!data?.services?.length ? <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name="calendar-blank-outline" size={34} color={colors.textTertiary} /><Text style={[styles.emptyText, { color: colors.textSecondary }]}>Bu tarihte servis kaydı bulunmuyor.</Text></View> : data.services.map((service) => (
                        <Pressable key={service.id} onPress={() => navigation.navigate('ServiceDetail', { serviceId: service.id })} style={({ pressed }) => [styles.serviceRow, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.78 : 1 }]}>
                            <View style={[styles.time, { backgroundColor: `${serviceBlue}12` }]}><Text style={[styles.timeText, { color: serviceBlue }]}>{service.time}</Text></View>
                            <View style={styles.serviceMain}><Text style={[styles.customer, { color: colors.text }]} numberOfLines={1}>{service.customer_name}</Text><Text style={[styles.operation, { color: colors.textSecondary }]} numberOfLines={1}>{service.operation_name}</Text><Text style={[styles.technician, { color: colors.textTertiary }]} numberOfLines={1}>{service.technician_name}</Text></View>
                            <View style={styles.serviceAmount}><Text style={[styles.amount, { color: colors.text }]}>{money(service.total_amount)}</Text><Text style={[styles.status, { color: service.status_code === 'completed' ? serviceGreen : colors.textSecondary }]}>{service.status_name}</Text></View>
                        </Pressable>
                    ))}
                </>}
            </ScrollView>
            <CalendarPickerSheet ref={calendarRef} selectedDate={selectedDate} activeTab="all" onSelectDate={setSelectedDate} />
        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    content: { padding: 12, gap: 10 }, loading: { minHeight: 220, justifyContent: 'center', alignItems: 'center' },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, dateArrow: { width: 40, height: 46, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    dateButton: { flex: 1, minHeight: 46, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, dateTitle: { fontSize: 13, fontWeight: '800', textTransform: 'capitalize', flex: 1 }, dateHint: { fontSize: 11, fontWeight: '500', textTransform: 'capitalize' },
    summaryPanel: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' }, summaryLine: { minHeight: 42, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 }, summaryLabel: { flex: 1, fontSize: 11, fontWeight: '600' }, summaryValue: { width: 84, fontSize: 12, fontWeight: '800', textAlign: 'right' },
    pdfButton: { height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, pdfText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
    sectionHeader: { gap: 1, marginTop: 4 }, sectionTitle: { fontSize: 15, fontWeight: '900' }, sectionSubtitle: { fontSize: 11 },
    serviceRow: { minHeight: 74, borderWidth: 1, borderRadius: 8, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }, time: { minWidth: 48, height: 34, borderRadius: 7, justifyContent: 'center', alignItems: 'center' }, timeText: { fontSize: 13, fontWeight: '900' }, serviceMain: { flex: 1, gap: 2 }, customer: { fontSize: 14, fontWeight: '800' }, operation: { fontSize: 12 }, technician: { fontSize: 11 }, serviceAmount: { alignItems: 'flex-end', maxWidth: 90 }, amount: { fontSize: 12, fontWeight: '800' }, status: { fontSize: 11, marginTop: 3, textAlign: 'right' },
    empty: { minHeight: 160, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, emptyText: { fontSize: 13, fontWeight: '600' },
});
