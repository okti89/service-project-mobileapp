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
import AppBottomSheet from '@/components/AppBottomSheet';
import { exportDailyReportPdf } from '@/utils/dailyReportPdf';
import { serviceBlue, serviceGreen, serviceOrange } from '@/theme/color';

dayjs.locale('tr');

const statusTone = (code) => {
    if (code === 'completed') return { color: serviceGreen, background: '#DCFCE7' };
    if (code === 'in_progress') return { color: '#B45309', background: '#FEF3C7' };
    return { color: serviceBlue, background: '#DBEAFE' };
};

export default function DailyServiceListScreen({ navigation }) {
    const { colors } = useTheme();
    const { showToast } = useToast();
    const insets = useSafeAreaInsets();
    const calendarRef = useRef(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [data, setData] = useState(null);
    const [technicians, setTechnicians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [technicianSheetVisible, setTechnicianSheetVisible] = useState(false);
    const [filterSheetVisible, setFilterSheetVisible] = useState(false);
    const [selectedTechnician, setSelectedTechnician] = useState(null);
    const dateValue = dayjs(selectedDate).format('YYYY-MM-DD');

    const load = useCallback(async (refresh = false) => {
        if (!refresh) setLoading(true);
        try {
            const [listResponse, technicianResponse] = await Promise.all([
                api.get(ENDPOINTS.REPORTS.DAILY_SERVICE_LIST, {
                    params: {
                        date: dateValue,
                        ...(selectedTechnician?.technician_id ? { technician_id: selectedTechnician.technician_id } : {}),
                    },
                }),
                api.get(ENDPOINTS.REPORTS.TECHNICIAN),
            ]);
            setData(listResponse.data || null);
            setTechnicians(Array.isArray(technicianResponse.data) ? technicianResponse.data.filter((item) => item.technician_id) : []);
        } catch (error) {
            console.log('Daily service list load error:', error?.response?.data || error?.message);
            showToast('error', 'Hata', 'Günlük servis listesi yüklenemedi.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [dateValue, selectedTechnician?.technician_id, showToast]);

    useEffect(() => { load(); }, [load]);
    const changeDay = (amount) => setSelectedDate((value) => dayjs(value).add(amount, 'day').toDate());
    const exportPdf = async (type, technician) => {
        if (exporting) return;
        setExporting(true);
        try {
            const technicianReport = type === 'technician-service-list';
            showToast('info', technicianReport ? 'WhatsApp Hazırlanıyor' : 'PDF Hazırlanıyor', technicianReport ? 'Teknisyenin servis listesi WhatsApp için hazırlanıyor.' : 'Günlük servis listesi hazırlanıyor.');
            await exportDailyReportPdf({ type, date: dateValue, technicianId: technician?.technician_id, technicianPhone: technician?.technician_phone });
        } catch (error) {
            showToast('error', 'Hata', error?.message || 'PDF dosyası oluşturulamadı.');
        } finally {
            setExporting(false);
        }
    };

    const isToday = dayjs(selectedDate).isSame(dayjs(), 'day');
    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES}>
            <Header
                title="Günlük Servis Listesi"
                subtitle={selectedTechnician ? selectedTechnician.technician_name : 'Saha programı ve teknisyen dağılımı'}
                showBack
                rightActions={[{
                    icon: selectedTechnician ? 'filter-check-outline' : 'filter-variant',
                    onPress: () => setFilterSheetVisible(true),
                    color: selectedTechnician ? serviceBlue : colors.textSecondary,
                    accessibilityLabel: 'Teknisyen filtresi',
                }]}
            />
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} colors={[serviceBlue]} />} showsVerticalScrollIndicator={false}>
                <View style={styles.dateRow}>
                    <Pressable onPress={() => changeDay(-1)} style={[styles.dateArrow, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} /></Pressable>
                    <Pressable onPress={() => calendarRef.current?.present()} style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name="calendar-outline" size={18} color={serviceBlue} /><View style={{ flex: 1 }}><Text style={[styles.dateTitle, { color: colors.text }]}>{isToday ? 'Bugün' : dayjs(selectedDate).format('D MMMM YYYY')}</Text><Text style={[styles.dateHint, { color: colors.textSecondary }]}>{dayjs(selectedDate).format('dddd')}</Text></View><MaterialCommunityIcons name="chevron-down" size={18} color={colors.textSecondary} /></Pressable>
                    <Pressable onPress={() => changeDay(1)} style={[styles.dateArrow, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name="chevron-right" size={24} color={colors.text} /></Pressable>
                </View>

                {loading ? <View style={styles.loading}><ActivityIndicator size="large" color={serviceBlue} /></View> : <>
                    <Text style={[styles.summaryText, { color: colors.textSecondary }]}>Toplam <Text style={[styles.summaryStrong, { color: colors.text }]}>{data?.total_services || 0}</Text> servis  ·  Planlandı <Text style={[styles.summaryStrong, { color: serviceOrange }]}>{data?.planned_count || 0}</Text>  ·  Tamamlandı <Text style={[styles.summaryStrong, { color: serviceGreen }]}>{data?.completed_count || 0}</Text></Text>
                    <View style={styles.actionRow}>
                        <Pressable onPress={() => exportPdf('service-list')} disabled={exporting} style={({ pressed }) => [styles.actionButton, { backgroundColor: serviceBlue, opacity: pressed || exporting ? 0.78 : 1 }]}><Text style={styles.actionText}>Genel PDF</Text></Pressable>
                        <Pressable onPress={() => setTechnicianSheetVisible(true)} disabled={exporting} style={({ pressed }) => [styles.actionButton, { backgroundColor: serviceGreen, opacity: pressed || exporting ? 0.78 : 1 }]}><Text style={styles.actionText}>Teknisyene Gönder</Text></Pressable>
                    </View>
                    <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.text }]}>Saat Sıralı Program</Text></View>
                    {!data?.services?.length ? <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name="calendar-blank-outline" size={34} color={colors.textTertiary} /><Text style={[styles.emptyText, { color: colors.textSecondary }]}>Bu tarihte planlanmış servis yok.</Text></View> : data.services.map((service) => {
                        const tone = statusTone(service.status_code);
                        return <Pressable key={service.id} onPress={() => navigation.navigate('ServiceDetail', { serviceId: service.id })} style={({ pressed }) => [styles.serviceCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.78 : 1 }]}>
                            <View style={styles.serviceTop}><View style={[styles.timeBox, { backgroundColor: `${serviceBlue}12` }]}><MaterialCommunityIcons name="clock-outline" size={15} color={serviceBlue} /><Text style={[styles.timeText, { color: serviceBlue }]}>{service.time}</Text></View><View style={[styles.badge, { backgroundColor: tone.background }]}><Text style={[styles.badgeText, { color: tone.color }]}>{service.status_name}</Text></View></View>
                            <Text style={[styles.customer, { color: colors.text }]}>{service.customer_name}</Text><Text style={[styles.operation, { color: colors.textSecondary }]} numberOfLines={1}>{service.operation_name}</Text>
                            <View style={styles.detailRow}><MaterialCommunityIcons name="account-hard-hat-outline" size={15} color={colors.textTertiary} /><Text style={[styles.detailText, { color: colors.textTertiary }]} numberOfLines={1}>{service.technician_name}</Text></View><View style={styles.detailRow}><MaterialCommunityIcons name="map-marker-outline" size={15} color={colors.textTertiary} /><Text style={[styles.detailText, { color: colors.textTertiary }]} numberOfLines={1}>{service.customer_address}</Text></View>
                        </Pressable>;
                    })}
                </>}
            </ScrollView>
            <CalendarPickerSheet ref={calendarRef} selectedDate={selectedDate} activeTab="all" onSelectDate={setSelectedDate} />
            <AppBottomSheet visible={technicianSheetVisible} onClose={() => setTechnicianSheetVisible(false)} snapPoints={['58%']}>
                <View style={styles.sheet}><View style={styles.sheetHeader}><View><Text style={[styles.sheetTitle, { color: colors.text }]}>Teknisyene Gönder</Text><Text style={[styles.sheetHint, { color: colors.textSecondary }]}>Seçilen günün PDF'i WhatsApp'a dosya olarak eklenir.</Text></View><Pressable onPress={() => setTechnicianSheetVisible(false)}><MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} /></Pressable></View>
                    <ScrollView showsVerticalScrollIndicator={false}>{!technicians.length ? <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Teknisyen bulunamadı.</Text> : technicians.map((technician) => <Pressable key={technician.technician_id} onPress={() => { setTechnicianSheetVisible(false); exportPdf('technician-service-list', technician); }} style={({ pressed }) => [styles.techRow, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}><View style={[styles.techIcon, { backgroundColor: `${serviceGreen}14` }]}><MaterialCommunityIcons name="account-hard-hat-outline" size={21} color={serviceGreen} /></View><View style={{ flex: 1 }}><Text style={[styles.techName, { color: colors.text }]}>{technician.technician_name}</Text><Text style={[styles.techPhone, { color: colors.textSecondary }]}>{technician.technician_phone || 'Telefon numarası yok'}</Text></View><MaterialCommunityIcons name="whatsapp" size={22} color="#25D366" /></Pressable>)}</ScrollView>
                </View>
            </AppBottomSheet>
            <AppBottomSheet visible={filterSheetVisible} onClose={() => setFilterSheetVisible(false)} snapPoints={['58%']}>
                <View style={styles.sheet}>
                    <View style={styles.sheetHeader}><View><Text style={[styles.sheetTitle, { color: colors.text }]}>Teknisyen Filtresi</Text><Text style={[styles.sheetHint, { color: colors.textSecondary }]}>Yalnızca seçilen teknisyenin servislerini görüntüleyin.</Text></View><Pressable onPress={() => setFilterSheetVisible(false)}><MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} /></Pressable></View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <Pressable onPress={() => { setSelectedTechnician(null); setFilterSheetVisible(false); }} style={({ pressed }) => [styles.techRow, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}>
                            <View style={[styles.techIcon, { backgroundColor: `${serviceBlue}14` }]}><MaterialCommunityIcons name="account-group-outline" size={21} color={serviceBlue} /></View>
                            <Text style={[styles.techName, { color: colors.text, flex: 1 }]}>Tüm Teknisyenler</Text>
                            {!selectedTechnician ? <MaterialCommunityIcons name="check" size={20} color={serviceBlue} /> : null}
                        </Pressable>
                        {technicians.map((technician) => <Pressable key={technician.technician_id} onPress={() => { setSelectedTechnician(technician); setFilterSheetVisible(false); }} style={({ pressed }) => [styles.techRow, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}><View style={[styles.techIcon, { backgroundColor: `${serviceBlue}14` }]}><MaterialCommunityIcons name="account-hard-hat-outline" size={21} color={serviceBlue} /></View><View style={{ flex: 1 }}><Text style={[styles.techName, { color: colors.text }]}>{technician.technician_name}</Text><Text style={[styles.techPhone, { color: colors.textSecondary }]}>{technician.technician_phone || 'Telefon numarası yok'}</Text></View>{selectedTechnician?.technician_id === technician.technician_id ? <MaterialCommunityIcons name="check" size={20} color={serviceBlue} /> : null}</Pressable>)}
                    </ScrollView>
                </View>
            </AppBottomSheet>
        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    content: { padding: 12, gap: 10 }, loading: { minHeight: 220, justifyContent: 'center', alignItems: 'center' }, dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, dateArrow: { width: 40, height: 46, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, dateButton: { flex: 1, minHeight: 46, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, dateTitle: { fontSize: 13, fontWeight: '800', textTransform: 'capitalize' }, dateHint: { fontSize: 11, marginTop: 1, textTransform: 'capitalize' },
    summaryText: { fontSize: 12, fontWeight: '600', paddingHorizontal: 2 }, summaryStrong: { fontWeight: '900' }, actionRow: { flexDirection: 'row', gap: 8 }, actionButton: { flex: 1, height: 42, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }, actionText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
    sectionHeader: { marginTop: 2 }, sectionTitle: { fontSize: 15, fontWeight: '900' }, serviceCard: { borderWidth: 1, borderRadius: 8, padding: 11, gap: 5 }, serviceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, timeBox: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7 }, timeText: { fontSize: 13, fontWeight: '900' }, badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 }, badgeText: { fontSize: 11, fontWeight: '800' }, customer: { fontSize: 15, fontWeight: '900', marginTop: 2 }, operation: { fontSize: 12 }, detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }, detailText: { fontSize: 11, flex: 1 }, empty: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 8, borderWidth: 1 }, emptyText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
    sheet: { flex: 1, paddingHorizontal: 18, paddingBottom: 8 }, sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 16 }, sheetTitle: { fontSize: 17, fontWeight: '900' }, sheetHint: { fontSize: 12, marginTop: 3 }, techRow: { minHeight: 62, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }, techIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, techName: { fontSize: 14, fontWeight: '800' }, techPhone: { fontSize: 12, marginTop: 2 },
});
