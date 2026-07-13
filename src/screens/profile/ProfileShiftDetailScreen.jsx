import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import { useTheme } from '@/context/ThemeContext';
import { serviceBlue, serviceGreen, serviceOrange } from '@/theme/color';

const formatTime = (value) => value ? new Date(value).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
const formatDuration = (minutes) => {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    return total < 60 ? `${total} dk` : `${Math.floor(total / 60)} sa${total % 60 ? ` ${total % 60} dk` : ''}`;
};

export default function ProfileShiftDetailScreen({ route }) {
    const { colors } = useTheme();
    const day = route?.params?.day || { shifts: [], attendance: [], totalMinutes: 0 };
    const dateLabel = useMemo(() => {
        const date = new Date(`${day.dateKey || ''}T12:00:00`);
        return Number.isNaN(date.getTime()) ? 'Mesai Detayı' : date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
    }, [day.dateKey]);

    return <WrapperContainer bg={colors.background} edges={NO_BOTTOM_EDGES}><Header title="Mesai Detayı" subtitle={dateLabel} showBack borderBottom /><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.summaryIcon, { backgroundColor: `${serviceBlue}12` }]}><MaterialCommunityIcons name="calendar-clock-outline" size={24} color={serviceBlue} /></View><View><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Toplam çalışma süresi</Text><Text style={[styles.summaryValue, { color: colors.text }]}>{formatDuration(day.totalMinutes)}</Text></View><View style={styles.summaryCount}><Text style={[styles.countValue, { color: serviceBlue }]}>{day.shifts?.length || 0}</Text><Text style={[styles.countLabel, { color: colors.textSecondary }]}>vardiya</Text></View></View><Text style={[styles.sectionTitle, { color: colors.text }]}>Vardiya Saatleri</Text>{day.shifts?.length ? day.shifts.map((shift, index) => { const minutes = Number(shift?.duration_minutes) || Math.max(0, Math.round((new Date(shift?.end_time || Date.now()) - new Date(shift?.start_time || Date.now())) / 60000)); const isOpen = Boolean(shift?.start_time && !shift?.end_time); const breakMinutes = Number(shift?.break_minutes || 0); return <View key={String(shift?.id || index)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.shiftIcon, { backgroundColor: `${isOpen ? serviceOrange : serviceGreen}12` }]}><MaterialCommunityIcons name={isOpen ? "clock-outline" : "check-circle-outline"} size={20} color={isOpen ? serviceOrange : serviceGreen} /></View><View style={styles.shiftCopy}><Text style={[styles.shiftTime, { color: colors.text }]}>{formatTime(shift?.start_time)} - {formatTime(shift?.end_time)}</Text><Text style={[styles.shiftMeta, { color: colors.textSecondary }]}>{isOpen ? 'Devam ediyor' : `Toplam ${formatDuration(minutes)}`}{breakMinutes > 0 ? ` · ${breakMinutes} dk mola` : ''}</Text></View></View>; }) : <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={{ color: colors.textSecondary }}>Bu gün için vardiya kaydı bulunmuyor.</Text></View>} {day.attendance?.length ? <><Text style={[styles.sectionTitle, { color: colors.text }]}>Günlük Notlar</Text>{day.attendance.map((item, index) => <View key={String(item?.id || index)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.shiftIcon, { backgroundColor: '#8B5CF614' }]}><MaterialCommunityIcons name="clipboard-text-outline" size={20} color="#8B5CF6" /></View><View style={styles.shiftCopy}><Text style={[styles.shiftTime, { color: colors.text }]}>{item?.status_display || item?.status || 'Kayıt'}</Text><Text style={[styles.shiftMeta, { color: colors.textSecondary }]}>{item?.note || 'Ek açıklama bulunmuyor.'}</Text></View></View>)}</> : null}</ScrollView></WrapperContainer>;
}

const styles = StyleSheet.create({
    content: { padding: 16, gap: 12, paddingBottom: 32 },
    summary: { borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    summaryIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    summaryLabel: { fontSize: 12, fontWeight: '600' }, summaryValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },
    summaryCount: { marginLeft: 'auto', alignItems: 'flex-end' }, countValue: { fontSize: 20, fontWeight: '800' }, countLabel: { fontSize: 11, fontWeight: '600' },
    sectionTitle: { fontSize: 15, fontWeight: '800', marginTop: 8 },
    card: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
    shiftIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, shiftCopy: { flex: 1, gap: 3 },
    shiftTime: { fontSize: 14, fontWeight: '800' }, shiftMeta: { fontSize: 12, lineHeight: 17 },
    emptyCard: { borderWidth: 1, borderRadius: 16, padding: 18, alignItems: 'center' },
});
