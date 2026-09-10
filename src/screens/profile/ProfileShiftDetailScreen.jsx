import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import { useTheme } from '@/context/ThemeContext';
import { serviceBlue, serviceGreen, serviceOrange } from '@/theme/color';

const formatTime = (value) => {
    if (!value) return '--:--';
    const raw = String(value);
    if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5);
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? '--:--'
        : date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};

const formatDuration = (minutes) => {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    if (total < 60) return `${total} dk`;
    const hours = Math.floor(total / 60);
    const remaining = total % 60;
    return remaining ? `${hours} sa ${remaining} dk` : `${hours} sa`;
};

const getShiftMinutes = (shift) => {
    const saved = Number(shift?.duration_minutes);
    if (Number.isFinite(saved) && saved >= 0) return saved;
    const start = new Date(shift?.start_time);
    const end = new Date(shift?.end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
};

const ATTENDANCE_STATUS_LABELS = {
    worked: 'Çalıştı',
    leave: 'İzinli',
    sick: 'Raporlu',
    offday: 'Resmi Tatil',
    absent: 'Devamsız',
};

const getAttendanceStatusLabel = (item) => (
    item?.status_display
    || ATTENDANCE_STATUS_LABELS[item?.status]
    || 'Kayıt'
);

export default function ProfileShiftDetailScreen({ route }) {
    const { colors } = useTheme();
    const day = route?.params?.day || {};
    const shifts = Array.isArray(day.shifts) ? day.shifts : [];
    const attendance = Array.isArray(day.attendance) ? day.attendance : [];
    const totalMinutes = Number(day.totalMinutes) || 0;
    const dateLabel = useMemo(() => {
        const date = new Date(`${day.dateKey || ''}T12:00:00`);
        return Number.isNaN(date.getTime())
            ? 'Mesai Detayı'
            : date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
    }, [day.dateKey]);

    return (
        <WrapperContainer bg={colors.background} edges={NO_BOTTOM_EDGES}>
            <Header title="Mesai Detayı" subtitle={dateLabel} showBack borderBottom />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.summaryIcon, { backgroundColor: `${serviceBlue}12` }]}>
                        <MaterialCommunityIcons name="calendar-clock-outline" size={24} color={serviceBlue} />
                    </View>
                    <View style={styles.summaryCopy}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Toplam çalışma süresi</Text>
                        <Text style={[styles.summaryValue, { color: colors.text }]}>{formatDuration(totalMinutes)}</Text>
                    </View>
                </View>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>Vardiya Saatleri</Text>
                {shifts.length > 0 ? shifts.map((shift, index) => {
                    const isOpen = Boolean(shift?.start_time && !shift?.end_time);
                    const breakMinutes = Math.max(0, Number(shift?.break_minutes) || 0);
                    const accent = isOpen ? serviceOrange : serviceGreen;
                    const detail = isOpen
                        ? 'Devam ediyor'
                        : `Toplam ${formatDuration(getShiftMinutes(shift))}`;
                    const breakText = breakMinutes > 0 ? ` | ${breakMinutes} dk mola` : '';

                    return (
                        <View key={String(shift?.id || index)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={[styles.cardIcon, { backgroundColor: `${accent}12` }]}>
                                <MaterialCommunityIcons name={isOpen ? 'clock-outline' : 'check-circle-outline'} size={20} color={accent} />
                            </View>
                            <View style={styles.cardCopy}>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>{formatTime(shift?.start_time)} - {formatTime(shift?.end_time)}</Text>
                                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{detail}{breakText}</Text>
                            </View>
                        </View>
                    );
                }) : (
                    <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={{ color: colors.textSecondary }}>Bu gün için vardiya kaydı bulunmuyor.</Text>
                    </View>
                )}

                {attendance.length > 0 ? (
                    <View style={styles.notesSection}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Günlük Notlar</Text>
                        {attendance.map((item, index) => (
                            <View key={String(item?.id || index)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <View style={[styles.cardIcon, { backgroundColor: '#8B5CF614' }]}>
                                    <MaterialCommunityIcons name="clipboard-text-outline" size={20} color="#8B5CF6" />
                                </View>
                                <View style={styles.cardCopy}>
                                    <Text style={[styles.cardTitle, { color: colors.text }]}>{getAttendanceStatusLabel(item)}</Text>
                                    <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{item?.note || 'Ek açıklama bulunmuyor.'}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : null}
            </ScrollView>
        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    content: { padding: 16, gap: 12, paddingBottom: 32 },
    summary: { borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    summaryIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    summaryCopy: { flex: 1 },
    summaryLabel: { fontSize: 12, fontWeight: '600' },
    summaryValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },
    sectionTitle: { fontSize: 15, fontWeight: '800', marginTop: 8 },
    card: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardCopy: { flex: 1, gap: 3 },
    cardTitle: { fontSize: 14, fontWeight: '800' },
    cardMeta: { fontSize: 12, lineHeight: 17 },
    emptyCard: { borderWidth: 1, borderRadius: 16, padding: 18, alignItems: 'center' },
    notesSection: { gap: 10 },
});
