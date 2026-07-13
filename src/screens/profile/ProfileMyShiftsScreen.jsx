import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import api from '@/api/axios';
import Header from '@/components/Header';
import WrapperContainer from '@/components/WrapperContainer';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import technicianService from '@/services/technicianService';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const FILTERS = [
    { key: 'all', label: 'Tümü' },
    { key: 'work', label: 'Mesai' },
    { key: 'leave', label: 'İzin' },
];
const ATTENDANCE_META = {
    leave: { title: 'İzin', badge: 'İzinli', accent: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', icon: 'umbrella-outline' },
    sick: { title: 'Raporlu', badge: 'Raporlu', accent: serviceRed, bg: 'rgba(239,68,68,0.12)', icon: 'medical-bag' },
    offday: { title: 'Resmi Tatil', badge: 'Tatilde', accent: serviceBlue, bg: 'rgba(59,130,246,0.12)', icon: 'calendar-star' },
    absent: { title: 'Devamsızlık', badge: 'Devamsız', accent: serviceRed, bg: 'rgba(239,68,68,0.12)', icon: 'account-alert-outline' },
};

const initialsOf = (label) => String(label || 'K').trim().split(/\s+/).filter(Boolean).map((chunk) => chunk[0]).join('').slice(0, 2).toUpperCase();
const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
};
const formatTimeValue = (value) => {
    if (!value) return '--:--';
    const raw = String(value);
    if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5);
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};
const formatShortDuration = (totalMinutes) => {
    const safe = Math.max(0, Math.round(Number(totalMinutes) || 0));
    if (!safe) return '0 dk';
    const hours = Math.floor(safe / 60);
    const minutes = safe % 60;
    if (!hours) return `${minutes} dk`;
    if (!minutes) return `${hours} sa`;
    return `${hours} sa ${minutes} dk`;
};
const formatLongDuration = (totalMinutes) => {
    const safe = Math.max(0, Math.round(Number(totalMinutes) || 0));
    if (!safe) return '0 saat';
    const hours = Math.floor(safe / 60);
    const minutes = safe % 60;
    if (!hours) return `${minutes} dakika`;
    if (!minutes) return `${hours} saat`;
    return `${hours} saat ${minutes} dakika`;
};
const getShiftDurationMinutes = (shift) => {
    const direct = Number(shift?.duration_minutes);
    if (Number.isFinite(direct) && direct > 0) return direct;
    if (!shift?.start_time || !shift?.end_time) return 0;
    const start = new Date(shift.start_time);
    const end = new Date(shift.end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
};
const getProfileLocation = (profile) => profile?.current_location?.address || profile?.location || profile?.address || profile?.city || 'Konum bilgisi paylaşılmadı';
const getStatusMeta = (profile) => Boolean(profile?.is_online || profile?.status === 'online')
    ? { label: 'Çevrimiçi', color: serviceGreen, bg: 'rgba(34,197,94,0.12)' }
    : { label: profile?.status_display || 'Müsait', color: profile?.status_info?.color || '#64748B', bg: 'rgba(100,116,139,0.12)' };
const getLastSeenLabel = (value, isOnline) => {
    if (isOnline) return 'Şimdi';
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'Az önce';
    if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
    return formatDate(value);
};

function StatCard({ icon, label, value, accent, colors }) {
    return <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.statIconWrap, { backgroundColor: `${accent}12` }]}><MaterialCommunityIcons name={icon} size={18} color={accent} /></View><Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text><Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>{value}</Text></View>;
}
function FilterPills({ value, onChange, colors }) {
    return <View style={[styles.filterPillWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>{FILTERS.map((item) => { const active = value === item.key; return <Pressable key={item.key} onPress={() => onChange(item.key)} style={[styles.filterPill, active && { backgroundColor: `${serviceBlue}10`, borderColor: serviceBlue }]}><Text style={[styles.filterPillText, { color: active ? serviceBlue : colors.textSecondary }]}>{item.label}</Text></Pressable>; })}</View>;
}
function HistoryRow({ item, colors, onPress }) {
    return <Pressable onPress={onPress} style={({ pressed }) => [styles.historyRow, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.76 : 1 }]}><View style={styles.historyDateCol}><Text style={[styles.historyDay, { color: colors.text }]}>{item.dayLabel}</Text><Text style={[styles.historyMonth, { color: colors.textSecondary }]}>{item.monthLabel}</Text><Text style={[styles.historyYear, { color: colors.textSecondary }]}>{item.yearLabel}</Text></View><View style={[styles.historyDivider, { backgroundColor: colors.border }]} /><View style={styles.historyBody}><View style={styles.historyHeaderRow}><View style={styles.historyTitleWrap}><View style={[styles.historyDot, { backgroundColor: item.accent }]} /><Text style={[styles.historyTitle, { color: colors.text }]}>{item.title}</Text></View><View style={[styles.historyBadge, { backgroundColor: item.badgeBg }]}><MaterialCommunityIcons name={item.icon} size={15} color={item.accent} /><Text style={[styles.historyBadgeText, { color: item.accent }]}>{item.badge}</Text></View></View><Text style={[styles.historyTime, { color: colors.textSecondary }]}>{item.timeLabel}</Text><Text style={[styles.historyDetail, { color: colors.textSecondary }]}>{item.detailLabel}</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} /></Pressable>;
}
export default function ProfileMyShiftsScreen({ navigation }) {
    const { colors } = useTheme();
    const { userInfo } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [profile, setProfile] = useState(null);
    const [shifts, setShifts] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [currentMonth, setCurrentMonth] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; });
    const [activeFilter, setActiveFilter] = useState('all');
    const loadData = useCallback(async () => {
        try {
            const myProfile = await technicianService.getMyProfile().catch(() => null);
            const resolvedTechnicianId = myProfile?.id || userInfo?.technician_profile_id || null;
            const shiftParams = { month: currentMonth };
            if (resolvedTechnicianId) shiftParams.technician = resolvedTechnicianId;
            const [shiftRows, attendanceRes] = await Promise.all([
                technicianService.getShifts(shiftParams).catch(() => []),
                resolvedTechnicianId ? api.get('technicians/attendance/', { params: { technician: resolvedTechnicianId, month: currentMonth, include_shift: 'false' } }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
            ]);
            setProfile(myProfile || null);
            setShifts(Array.isArray(shiftRows) ? shiftRows : []);
            setAttendance(Array.isArray(attendanceRes?.data) ? attendanceRes.data : []);
        } catch (error) {
            console.log('My shifts load error:', error?.response?.data || error?.message || error);
            showToast('error', 'Hata', 'Mesai kayıtları yüklenemedi.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [currentMonth, showToast, userInfo?.technician_profile_id]);

    useEffect(() => { setLoading(true); loadData(); }, [loadData]);
    const handleRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);
    const handleMonthChange = useCallback((direction) => {
        const [year, month] = currentMonth.split('-').map(Number);
        let nextYear = year;
        let nextMonth = month + direction;
        if (nextMonth > 12) { nextMonth = 1; nextYear += 1; }
        else if (nextMonth < 1) { nextMonth = 12; nextYear -= 1; }
        setCurrentMonth(`${nextYear}-${String(nextMonth).padStart(2, '0')}`);
    }, [currentMonth]);

    const fullName = userInfo?.full_name || [userInfo?.first_name, userInfo?.last_name].filter(Boolean).join(' ') || userInfo?.email || 'Kullanıcı';
    const roleLabel = userInfo?.user_type_display || 'Teknik Servis Uzmanı';
    const avatarUri = resolveMediaUrl(userInfo?.avatar);
    const statusMeta = getStatusMeta(profile);
    const shiftStartReference = useMemo(() => {
        const ordered = shifts.filter((item) => item?.start_time).slice().sort((a, b) => new Date(b.start_time || 0) - new Date(a.start_time || 0));
        return ordered[0]?.start_time ? formatTimeValue(ordered[0].start_time) : '08:30';
    }, [shifts]);
    const stats = useMemo(() => {
        const workedDays = new Set(shifts.map((item) => item?.date || item?.start_time?.slice(0, 10)).filter(Boolean)).size;
        const totalMinutes = shifts.reduce((sum, item) => sum + getShiftDurationMinutes(item), 0);
        const leaveDays = attendance.filter((item) => ['leave', 'sick', 'offday'].includes(item?.status)).length;
        return { workedDays, totalMinutes, shiftCount: shifts.length, leaveDays };
    }, [attendance, shifts]);

    const historyItems = useMemo(() => {
        const groups = new Map();
        const ensureGroup = (value) => {
            const date = new Date(value || Date.now());
            const key = Number.isNaN(date.getTime()) ? 'unknown' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            if (!groups.has(key)) groups.set(key, { date, shifts: [], attendance: [] });
            return groups.get(key);
        };
        shifts.forEach((shift) => ensureGroup(shift?.date || shift?.start_time || shift?.end_time).shifts.push(shift));
        attendance.filter((item) => item?.status && ATTENDANCE_META[item.status]).forEach((item) => ensureGroup(item?.date).attendance.push(item));

        return Array.from(groups.entries()).map(([key, group]) => {
            const sortedShifts = group.shifts.slice().sort((a, b) => new Date(a?.start_time || 0) - new Date(b?.start_time || 0));
            const totalMinutes = sortedShifts.reduce((sum, shift) => sum + getShiftDurationMinutes(shift), 0);
            const firstShift = sortedShifts[0];
            const lastShift = sortedShifts[sortedShifts.length - 1];
            const attendanceMeta = group.attendance.length ? (ATTENDANCE_META[group.attendance[0]?.status] || ATTENDANCE_META.leave) : null;
            const hasOpenShift = sortedShifts.some((shift) => shift?.start_time && !shift?.end_time);
            const isWorkDay = sortedShifts.length > 0;
            return {
                id: `day-${key}`,
                category: isWorkDay ? 'work' : 'leave',
                sortDate: group.date,
                dayLabel: String(group.date.getDate()).padStart(2, '0'),
                monthLabel: MONTHS_TR[group.date.getMonth()].slice(0, 3),
                yearLabel: String(group.date.getFullYear()),
                title: isWorkDay ? 'Çalışma Kaydı' : attendanceMeta.title,
                timeLabel: isWorkDay ? `${formatTimeValue(firstShift?.start_time)} - ${hasOpenShift ? '--:--' : formatTimeValue(lastShift?.end_time)}` : (group.attendance[0]?.note || attendanceMeta.title),
                detailLabel: isWorkDay ? `${sortedShifts.length} vardiya · Toplam ${formatShortDuration(totalMinutes)}` : `${group.attendance.length} günlük kayıt`,
                badge: hasOpenShift ? 'Devam ediyor' : isWorkDay ? 'Görüntüle' : attendanceMeta.badge,
                accent: hasOpenShift ? serviceOrange : isWorkDay ? serviceGreen : attendanceMeta.accent,
                badgeBg: hasOpenShift ? 'rgba(249,115,22,0.12)' : isWorkDay ? 'rgba(34,197,94,0.12)' : attendanceMeta.bg,
                icon: hasOpenShift ? 'clock-outline' : isWorkDay ? 'calendar-check-outline' : attendanceMeta.icon,
                detail: { dateKey: key, shifts: sortedShifts, attendance: group.attendance, totalMinutes },
            };
        }).sort((a, b) => b.sortDate - a.sortDate);
    }, [attendance, shifts]);
    const filteredHistory = useMemo(() => activeFilter === 'all' ? historyItems : historyItems.filter((item) => item.category === activeFilter), [activeFilter, historyItems]);
    const monthTitle = useMemo(() => { const [year, month] = currentMonth.split('-').map(Number); return `${MONTHS_TR[month - 1]} ${year}`; }, [currentMonth]);

    if (loading) {
        return <WrapperContainer bg={colors.background}><Header title="Mesailerim" showBack borderBottom /><View style={styles.centerState}><ActivityIndicator size="large" color={colors.primary} /></View></WrapperContainer>;
    }

    return <WrapperContainer bg={colors.background}><Header title="Mesailerim" showBack borderBottom /><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}><View style={styles.titleRow}><View><Text style={[styles.screenTitle, { color: colors.text }]}>Mesailerim</Text><Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>Mesai ve izin geçmişi</Text></View><View style={[styles.filterButton, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name="tune-variant" size={20} color={serviceBlue} /></View></View><View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.heroTop}><View style={styles.avatarWrap}>{avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatar} /> : <View style={[styles.avatarFallback, { backgroundColor: `${serviceBlue}14` }]}><Text style={[styles.avatarFallbackText, { color: serviceBlue }]}>{initialsOf(fullName)}</Text></View>}<View style={[styles.onlineDot, { backgroundColor: statusMeta.color, borderColor: colors.surface }]} /></View><View style={styles.heroContent}><Text style={[styles.heroName, { color: colors.text }]} numberOfLines={1}>{fullName}</Text><Text style={[styles.heroRole, { color: colors.textSecondary }]} numberOfLines={1}>{roleLabel}</Text><View style={styles.locationRow}><MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.textSecondary} /><Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>{getProfileLocation(profile)}</Text></View></View><View style={styles.heroStatusWrap}><View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}><Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text></View><MaterialCommunityIcons name="dots-vertical" size={20} color={colors.textTertiary} /></View></View><View style={[styles.divider, { backgroundColor: colors.border }]} /><View style={styles.infoRow}><View style={styles.infoItem}><MaterialCommunityIcons name="clock-outline" size={20} color={serviceBlue} /><View><Text style={[styles.infoLabel, { color: colors.textSecondary }]}>İşe başlama</Text><Text style={[styles.infoValue, { color: colors.text }]}>{shiftStartReference}</Text></View></View><View style={[styles.infoDivider, { backgroundColor: colors.border }]} /><View style={styles.infoItem}><View style={[styles.liveDot, { backgroundColor: statusMeta.color }]} /><View><Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Son görülme</Text><Text style={[styles.infoValue, { color: statusMeta.color === serviceGreen ? serviceGreen : colors.text }]}>{getLastSeenLabel(profile?.last_online || profile?.updated_at, Boolean(profile?.is_online || profile?.status === 'online'))}</Text></View></View></View></View><View style={styles.statsGrid}><StatCard icon="calendar-month-outline" label="Bu Ay" value={`${stats.workedDays} Gün`} accent={serviceBlue} colors={colors} /><StatCard icon="clock-outline" label="Toplam Süre" value={formatShortDuration(stats.totalMinutes)} accent={serviceGreen} colors={colors} /><StatCard icon="timer-plus-outline" label="Vardiya" value={`${stats.shiftCount} Kayıt`} accent={serviceOrange} colors={colors} /><StatCard icon="umbrella-outline" label="İzin" value={`${stats.leaveDays} Gün`} accent="#8B5CF6" colors={colors} /></View><FilterPills value={activeFilter} onChange={setActiveFilter} colors={colors} /><View style={[styles.monthCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Pressable onPress={() => handleMonthChange(-1)} style={styles.monthNavBtn}><MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} /></Pressable><View style={styles.monthCenter}><MaterialCommunityIcons name="calendar-month-outline" size={20} color={serviceBlue} /><Text style={[styles.monthLabel, { color: colors.text }]}>{monthTitle}</Text></View><Pressable onPress={() => handleMonthChange(1)} style={styles.monthNavBtn}><MaterialCommunityIcons name="chevron-right" size={24} color={colors.text} /></Pressable></View><View style={styles.historyList}>{filteredHistory.length === 0 ? <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name="clipboard-search-outline" size={32} color={colors.textTertiary} /><Text style={[styles.emptyTitle, { color: colors.text }]}>Kayıt bulunamadı</Text><Text style={[styles.emptyText, { color: colors.textSecondary }]}>Seçilen dönem için mesai veya izin kaydı bulunmuyor.</Text></View> : filteredHistory.map((item) => <HistoryRow key={item.id} item={item} colors={colors} onPress={() => navigation.navigate('ProfileShiftDetail', { day: item.detail })} />)}</View><View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.summaryTitle, { color: colors.text }]}>Aylık Özet</Text><View style={styles.summaryRow}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Toplam çalışma</Text><Text style={[styles.summaryValue, { color: colors.text }]}>{formatLongDuration(stats.totalMinutes)}</Text></View><View style={[styles.summaryDivider, { backgroundColor: colors.border }]} /><View style={styles.summaryRow}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Vardiya kaydı</Text><Text style={[styles.summaryValue, { color: serviceOrange }]}>{`${stats.shiftCount} kayıt`}</Text></View><View style={[styles.summaryDivider, { backgroundColor: colors.border }]} /><View style={styles.summaryRow}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>İzin günü</Text><Text style={[styles.summaryValue, { color: '#8B5CF6' }]}>{stats.leaveDays} gün</Text></View></View></ScrollView></WrapperContainer>;
}
const styles = StyleSheet.create({
    content: { paddingHorizontal: spacing.gutter, paddingTop: spacing.l, paddingBottom: spacing['5xl'], gap: spacing.m },
    centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.m },
    screenTitle: { ...typography.h2, fontWeight: '800' },
    screenSubtitle: { ...typography.bodySmall, marginTop: 4 },
    filterButton: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    heroCard: { borderWidth: 1, borderRadius: 24, padding: spacing.l, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
    heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.m },
    avatarWrap: { position: 'relative' }, avatar: { width: 84, height: 84, borderRadius: 42 }, avatarFallback: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' }, avatarFallbackText: { fontSize: 26, fontWeight: '800' },
    onlineDot: { position: 'absolute', right: 2, bottom: 2, width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
    heroContent: { flex: 1, minWidth: 0, gap: 5, paddingTop: 4 }, heroName: { ...typography.h3, fontWeight: '800' }, heroRole: { ...typography.bodySmall, fontWeight: '600' },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }, locationText: { ...typography.caption, flex: 1 }, heroStatusWrap: { alignItems: 'flex-end', gap: 12 },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 }, statusBadgeText: { ...typography.caption, fontWeight: '800' }, divider: { height: 1, marginVertical: spacing.m },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m }, infoItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }, infoLabel: { ...typography.caption, marginBottom: 2 }, infoValue: { ...typography.bodySmall, fontWeight: '700' }, infoDivider: { width: 1, alignSelf: 'stretch' }, liveDot: { width: 10, height: 10, borderRadius: 5 },
    statsGrid: { flexDirection: 'row', gap: spacing.s }, statCard: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 18, padding: spacing.m }, statIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, statLabel: { ...typography.bodySmall, marginBottom: 6 }, statValue: { ...typography.body, fontWeight: '800' },
    filterPillWrap: { borderWidth: 1, borderRadius: 999, padding: 4, flexDirection: 'row', gap: 4 }, filterPill: { flex: 1, minHeight: 44, borderRadius: 999, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' }, filterPillText: { ...typography.body, fontWeight: '700' },
    monthCard: { borderWidth: 1, borderRadius: 20, paddingHorizontal: spacing.m, paddingVertical: spacing.m, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, monthNavBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, monthCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 }, monthLabel: { ...typography.h3, fontWeight: '800' },
    historyList: { gap: spacing.s }, historyRow: { borderWidth: 1, borderRadius: 20, padding: spacing.m, flexDirection: 'row', alignItems: 'center', gap: spacing.s }, historyDateCol: { width: 64, alignItems: 'flex-start' }, historyDay: { fontSize: 18, fontWeight: '900' }, historyMonth: { ...typography.bodySmall, fontWeight: '600' }, historyYear: { ...typography.caption }, historyDivider: { width: 1, alignSelf: 'stretch' }, historyBody: { flex: 1, gap: 4 }, historyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s }, historyTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }, historyDot: { width: 10, height: 10, borderRadius: 5 }, historyTitle: { ...typography.body, fontWeight: '800' }, historyTime: { ...typography.bodySmall }, historyDetail: { ...typography.bodySmall, fontWeight: '600' }, historyBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }, historyBadgeText: { ...typography.caption, fontWeight: '800' },
    emptyCard: { borderWidth: 1, borderRadius: 24, paddingVertical: spacing['2xl'], paddingHorizontal: spacing.l, alignItems: 'center', gap: 10 }, emptyTitle: { ...typography.body, fontWeight: '800' }, emptyText: { ...typography.bodySmall, textAlign: 'center' },
    summaryCard: { borderWidth: 1, borderRadius: 24, padding: spacing.l }, summaryTitle: { ...typography.body, fontWeight: '800', marginBottom: spacing.s }, summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.m, paddingVertical: 10 }, summaryLabel: { ...typography.bodySmall }, summaryValue: { ...typography.body, fontWeight: '800' }, summaryDivider: { height: 1 },
});