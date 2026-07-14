import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import TechnicianPickerSheet from '@/components/home/TechnicianPickerSheet';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import AppBottomSheet from '@/components/AppBottomSheet';
import dayjs from 'dayjs';
import { useToast } from '@/context/ToastContext';
import { Picker } from '@react-native-picker/picker';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

const MONTHS_TR = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const YEARS = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
};

const formatDuration = (totalMinutes) => {
    const safe = Math.max(0, Math.floor(Number(totalMinutes) || 0));
    if (safe === 0) return '0 dakika';
    const hours = Math.floor(safe / 60);
    const minutes = safe % 60;
    if (hours === 0) return `${minutes} dakika`;
    if (minutes === 0) return `${hours} saat`;
    return `${hours} saat ${minutes} dakika`;
};

const formatDurationCompact = (totalMinutes) => {
    const safe = Math.max(0, Math.floor(Number(totalMinutes) || 0));
    if (safe === 0) return '0s';
    const hours = Math.floor(safe / 60);
    const minutes = safe % 60;
    if (hours === 0) return `${minutes}dk`;
    if (minutes === 0) return `${hours}s`;
    return `${hours}s ${minutes}dk`;
};

// Tarih: 14 Haziran 2026
const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTHS_TR[d.getMonth()] || '';
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
};

const formatWeekday = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('tr-TR', { weekday: 'long' });
};

const formatTime = (timeStr) => {
    if (!timeStr) return '--:--';
    const parsed = new Date(timeStr);
    if (Number.isNaN(parsed.getTime())) return '--:--';
    return parsed.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};

const getShiftState = (shift) => {
    if (shift?.shift_status === 'in_progress') return 'active';
    if (shift?.shift_status === 'on_break') return 'break';
    if (shift?.shift_status === 'completed') return 'completed';
    // Status yoksa start/end zamanlarindan tahmin et
    if (shift?.start_time && !shift?.end_time) return 'active';
    if (shift?.start_time && shift?.end_time) return 'completed';
    return 'unknown';
};

const STATE_META = {
    active: { label: 'Aktif', color: serviceBlue, icon: 'timer-play-outline', softColor: '#3B82F6' },
    break: { label: 'Molada', color: serviceOrange, icon: 'coffee-outline', softColor: '#F59E0B' },
    completed: { label: 'Tamamlandı', color: serviceGreen, icon: 'check-decagram-outline', softColor: '#22C55E' },
    unknown: { label: 'Bilinmiyor', color: '#9CA3AF', icon: 'help-circle-outline', softColor: '#9CA3AF' },
};

const getTechnicianName = (item) => item?.full_name || item?.user?.full_name || `${item?.user?.first_name || ''} ${item?.user?.last_name || ''}`.trim() || 'Teknisyen';

const getTechnicianInitials = (item) => {
    const name = getTechnicianName(item);
    return String(name)
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
};

const getShiftDurationMinutes = (shift) => {
    const rawDuration = Number(shift?.duration_minutes);
    if (Number.isFinite(rawDuration) && rawDuration > 0) return rawDuration;

    const start = shift?.start_time ? new Date(shift.start_time) : null;
    const end = shift?.end_time ? new Date(shift.end_time) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
};

const ShiftCard = ({ shift, onStop, onPress, index = 0 }) => {
    const { colors, isDark } = useTheme();
    const state = getShiftState(shift);
    const meta = STATE_META[state];
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(12)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 320,
                delay: Math.min(index, 8) * 30,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 320,
                delay: Math.min(index, 8) * 30,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, index, slideAnim]);

    const d = new Date(shift.date);
    const dayNum = String(d.getDate()).padStart(2, '0');
    const monthShort = MONTHS_TR[d.getMonth()] || '';
    const weekdayFormatted = d.toLocaleDateString('tr-TR', { weekday: 'long' });

    let cardTitle = 'Normal Mesai';
    if (state === 'active') cardTitle = 'Aktif Mesai';
    else if (state === 'break') cardTitle = 'Mola';

    return (
        <Pressable onPress={onPress}>
            <Animated.View
                style={[
                    styles.newShiftCard,
                    {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderLeftColor: meta.color,
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                    },
                ]}
            >
                {/* Sol Sütun: Tarih */}
                <View style={styles.dateCol}>
                    <Text style={[styles.dateColDay, { color: colors.text }]}>{dayNum} {monthShort.slice(0, 3)}</Text>
                    <Text style={[styles.dateColWeekday, { color: colors.textSecondary }]}>{weekdayFormatted}</Text>
                </View>

                {/* Dikey Ayırıcı */}
                <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />

                {/* Orta Sütun: Mesai Detayları */}
                <View style={styles.detailsCol}>
                    <Text style={[styles.detailsTitle, { color: colors.text }]}>{cardTitle}</Text>
                    <Text style={[styles.detailsTime, { color: colors.textSecondary }]}>
                        {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                    </Text>
                    <Text style={[styles.detailsDuration, { color: colors.textTertiary }]}>
                        {state === 'active' ? 'Devam ediyor...' : state === 'break' ? 'Molada' : formatDuration(getShiftDurationMinutes(shift))}
                    </Text>
                </View>

                {/* Sağ Sütun: Durum ve Ok */}
                <View style={styles.statusCol}>
                    <View style={[styles.newStatusBadge, { backgroundColor: `${meta.softColor}15` }]}>
                        <Text style={[styles.newStatusText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textTertiary} style={{ marginLeft: 4 }} />
                </View>
            </Animated.View>
        </Pressable>
    );
};

const SummaryStat = ({ icon, value, label, color, isLast }) => {
    const { colors } = useTheme();
    return (
        <View style={styles.summaryItem}>
            <View style={[styles.summaryIcon, { backgroundColor: `${color}1A` }]}>
                <MaterialCommunityIcons name={icon} size={16} color={color} />
            </View>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
            {!isLast && <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />}
        </View>
    );
};

export default function TechnicianShiftsScreen({ navigation, route }) {
    const { showToast } = useToast();
    const { technicianId, technicianName } = route.params || {};
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();

    const technicianSheetRef = useRef(null);
    const [technicians, setTechnicians] = useState([]);
    const [technicianListLoading, setTechnicianListLoading] = useState(false);
    const [selectedTechnicianId, setSelectedTechnicianId] = useState(technicianId || null);
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [monthLoading, setMonthLoading] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const initialFetchRef = useRef(true);

    // Add Shift Form States
    const [isAddShiftVisible, setIsAddShiftVisible] = useState(false);
    const [formDay, setFormDay] = useState(() => new Date().getDate());
    const [formMonth, setFormMonth] = useState(() => new Date().getMonth());
    const [formYear, setFormYear] = useState(() => new Date().getFullYear());
    const [formStartHour, setFormStartHour] = useState(8);
    const [formStartMinute, setFormStartMinute] = useState(30);
    const [formEndHour, setFormEndHour] = useState(18);
    const [formEndMinute, setFormEndMinute] = useState(0);
    const [pickerMode, setPickerMode] = useState(null); // 'date' | 'start_time' | 'end_time' | null
    const [submittingShift, setSubmittingShift] = useState(false);
    const [editingShiftId, setEditingShiftId] = useState(null);

    const selectedTechnician = technicians.find((item) => String(item?.id) === String(selectedTechnicianId)) || null;
    const selectedTechnicianLabel = selectedTechnician
        ? getTechnicianName(selectedTechnician)
        : technicianName || 'Teknisyen secin';

    const fetchTechnicians = useCallback(async () => {
        try {
            setTechnicianListLoading(true);
            const response = await api.get(ENDPOINTS.TECHNICIAN.LIST, {
                params: { include_inactive: true },
            });
            const rows = (Array.isArray(response?.data) ? response.data : []).slice().sort((a, b) =>
                getTechnicianName(a).localeCompare(getTechnicianName(b), 'tr', { sensitivity: 'base' })
            );
            setTechnicians(rows);

            if (!technicianId && !selectedTechnicianId && rows.length > 0) {
                setSelectedTechnicianId(rows[0]?.id || null);
            }
        } catch (error) {
            console.log('Technician list fetch error:', error?.response?.data || error?.message || error);
            setTechnicians([]);
        } finally {
            setTechnicianListLoading(false);
        }
    }, [technicianId]);

    const fetchShifts = useCallback(async ({ isRefresh = false, isMonthChange = false } = {}) => {
        const effectiveTechnicianId = selectedTechnicianId || technicianId;

        if (!effectiveTechnicianId) {
            setShifts([]);
            setLoading(false);
            setRefreshing(false);
            setMonthLoading(false);
            initialFetchRef.current = false;
            return;
        }

        try {
            if (isMonthChange) setMonthLoading(true);

            const params = {
                month: currentMonth,
                technician: effectiveTechnicianId,
            };

            const response = await api.get(ENDPOINTS.TECHNICIAN.SHIFTS, { params });
            setShifts(Array.isArray(response?.data) ? response.data : []);
        } catch (error) {
            console.log('Shifts fetch error:', error?.response?.data || error?.message || error);
            Alert.alert('Hata', 'Mesai kayitlari yuklenemedi');
        } finally {
            setLoading(false);
            setRefreshing(false);
            setMonthLoading(false);
            initialFetchRef.current = false;
        }
    }, [currentMonth, selectedTechnicianId, technicianId]);

    useEffect(() => {
        fetchTechnicians();
    }, [fetchTechnicians]);

    useEffect(() => {
        // Ilk yukleme: sadece 'loading' goster; sonraki ay degisimlerinde 'monthLoading' goster
        if (initialFetchRef.current) {
            fetchShifts({ isRefresh: true });
        } else {
            fetchShifts({ isMonthChange: true });
        }
    }, [fetchShifts]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchShifts({ isRefresh: true });
    }, [fetchShifts]);

    const handlePrevMonth = useCallback(() => {
        const [y, m] = currentMonth.split('-').map(Number);
        const date = new Date(y, m - 2, 1);
        setCurrentMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }, [currentMonth]);

    const handleNextMonth = useCallback(() => {
        const [y, m] = currentMonth.split('-').map(Number);
        const date = new Date(y, m, 1);
        setCurrentMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }, [currentMonth]);

    const handleStopShift = useCallback((shift) => {
        Alert.alert(
            'Mesaiyi Bitir',
            'Bu mesaiyi bitirmek istediginize emin misiniz?',
            [
                { text: 'Iptal', style: 'cancel' },
                {
                    text: 'Bitir',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.post(ENDPOINTS.TECHNICIAN.SHIFT_STOP, { technician: shift.technician_profile_id });
                            Alert.alert('Basarili', 'Mesai sonlandirildi');
                            showToast('success', 'Başarılı', 'Mesai sonlandırılarak tamamlandı.');
                            fetchShifts({ isMonthChange: true });
                        } catch (error) {
                            showToast('error', 'Hata', error?.response?.data?.detail || 'Mesai bitirilemedi');
                        }
                    },
                },
            ]
        );
    }, [fetchShifts, showToast]);

    const onEditShift = (shift) => {
        setEditingShiftId(shift.id);
        const d = new Date(shift.date);
        setFormDay(d.getDate());
        setFormMonth(d.getMonth());
        setFormYear(d.getFullYear());

        const start = new Date(shift.start_time);
        setFormStartHour(start.getHours());
        setFormStartMinute(start.getMinutes());

        const end = shift.end_time ? new Date(shift.end_time) : new Date();
        setFormEndHour(end.getHours());
        setFormEndMinute(end.getMinutes());

        setIsAddShiftVisible(true);
    };

    const handleDeleteShift = () => {
        if (!editingShiftId) return;
        Alert.alert(
            'Mesai Kaydını Sil',
            'Bu mesai kaydını silmek istediğinize emin misiniz?',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        setSubmittingShift(true);
                        try {
                            await api.delete(`${ENDPOINTS.TECHNICIAN.SHIFTS}${editingShiftId}/`);
                            showToast('success', 'Başarılı', 'Mesai kaydı başarıyla silindi.');
                            setIsAddShiftVisible(false);
                            fetchShifts({ isRefresh: true });
                        } catch (error) {
                            console.log('Delete shift error:', error?.response?.data || error?.message || error);
                            const msg = error?.response?.data?.detail || 'Mesai kaydı silinemedi.';
                            showToast('error', 'Hata', msg);
                        } finally {
                            setSubmittingShift(false);
                        }
                    }
                }
            ]
        );
    };

    const handleSaveShift = async () => {
        if (!selectedTechnicianId) {
            showToast('error', 'Hata', 'Lütfen önce bir teknisyen seçin.');
            return;
        }

        setSubmittingShift(true);
        try {
            const dateStr = `${formYear}-${String(formMonth + 1).padStart(2, '0')}-${String(formDay).padStart(2, '0')}`;
            const startTimeStr = `${dateStr}T${String(formStartHour).padStart(2, '0')}:${String(formStartMinute).padStart(2, '0')}:00`;
            const endTimeStr = `${dateStr}T${String(formEndHour).padStart(2, '0')}:${String(formEndMinute).padStart(2, '0')}:00`;

            const payload = {
                technician_id: selectedTechnicianId,
                date: dateStr,
                start_time: startTimeStr,
                end_time: endTimeStr,
            };

            if (editingShiftId) {
                await api.put(`${ENDPOINTS.TECHNICIAN.SHIFTS}${editingShiftId}/`, payload);
                showToast('success', 'Başarılı', 'Mesai kaydı güncellendi.');
            } else {
                await api.post(ENDPOINTS.TECHNICIAN.SHIFTS, payload);
                showToast('success', 'Başarılı', 'Manuel mesai kaydı başarıyla eklendi.');
            }

            setIsAddShiftVisible(false);
            fetchShifts({ isRefresh: true });
        } catch (error) {
            console.log('Save shift error:', error?.response?.data || error?.message || error);
            const msg = error?.response?.data?.detail || 'Mesai kaydı eklenemedi.';
            showToast('error', 'Hata', msg);
        } finally {
            setSubmittingShift(false);
        }
    };

    const parseMonth = (monthStr) => {
        const [y, m] = monthStr.split('-').map(Number);
        return `${MONTHS_TR[m - 1]} ${y}`;
    };

    const activeShifts = shifts.filter((s) => {
        const st = getShiftState(s);
        return st === 'active' || st === 'break';
    });
    const completedShifts = shifts.filter((s) => getShiftState(s) === 'completed');
    // Duzeltme: toplam sureyi dakika cinsinden hesapla, sonra formatla
    const totalMinutes = completedShifts.reduce((sum, s) => sum + getShiftDurationMinutes(s), 0);
    const totalDurationLabel = formatDurationCompact(totalMinutes);
    const completedCount = completedShifts.length;

    const renderTechnicianFilter = () => {
        const avatarUri = selectedTechnician ? resolveMediaUrl(
            selectedTechnician?.user?.profile_picture ||
            selectedTechnician?.user?.avatar ||
            selectedTechnician?.avatar ||
            selectedTechnician?.avatar_url ||
            selectedTechnician?.user?.avatar_url
        ) : null;

        const isOnline = selectedTechnician?.is_online;
        const initials = selectedTechnician ? getTechnicianInitials(selectedTechnician) : '??';

        return (
            <View style={[styles.profileCardWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable
                    onPress={() => !technicianListLoading && technicianSheetRef.current?.present()}
                    style={({ pressed }) => [
                        styles.profileCardPressable,
                        pressed && { opacity: 0.85 }
                    ]}
                >
                    {/* Avatar with Status Dot */}
                    <View style={styles.avatarContainer}>
                        {avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={styles.profileAvatar} />
                        ) : (
                            <View style={[styles.profileAvatar, styles.profileAvatarFallback, { backgroundColor: serviceBlue + '15' }]}>
                                <Text style={[styles.profileAvatarText, { color: serviceBlue }]}>{initials}</Text>
                            </View>
                        )}
                        <View style={[styles.statusDotOverlay, { backgroundColor: isOnline ? serviceGreen : '#94A3B8', borderColor: colors.surface }]} />
                    </View>

                    {/* Profile Details */}
                    <View style={styles.profileInfo}>
                        <Text style={[styles.profileName, { color: colors.text }]}>{selectedTechnicianLabel}</Text>
                        <Text style={[styles.profileRole, { color: colors.textSecondary }]}>
                            {selectedTechnician?.user?.email || 'Servis Teknisyeni'}
                        </Text>
                    </View>

                    {/* Online Badge & Chevron */}
                    <View style={styles.profileRight}>
                        <View style={[styles.onlineStatusBadge, { backgroundColor: isOnline ? `${serviceGreen}15` : '#94A3B815' }]}>
                            <Text style={[styles.onlineStatusText, { color: isOnline ? serviceGreen : colors.textSecondary }]}>
                                {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                            </Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                    </View>
                </Pressable>
            </View>
        );
    };

    const renderHeader = () => (
        <View style={styles.monthNav}>
            <Pressable
                onPress={handlePrevMonth}
                style={({ pressed }) => [
                    styles.monthBtn,
                    {
                        backgroundColor: isDark ? colors.surfaceMuted : '#F3F4F6',
                        opacity: pressed ? 0.7 : 1,
                    },
                ]}
            >
                <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
            </Pressable>
            <View style={styles.monthCenter}>
                <Text style={[styles.monthLabel, { color: colors.text }]}>{parseMonth(currentMonth)}</Text>
                {monthLoading && (
                    <View style={styles.monthLoadingRow}>
                        <ActivityIndicator size="small" color={serviceBlue} />
                        <Text style={[styles.monthLoadingText, { color: colors.textTertiary }]}>Yenileniyor...</Text>
                    </View>
                )}
            </View>
            <Pressable
                onPress={handleNextMonth}
                style={({ pressed }) => [
                    styles.monthBtn,
                    {
                        backgroundColor: isDark ? colors.surfaceMuted : '#F3F4F6',
                        opacity: pressed ? 0.7 : 1,
                    },
                ]}
            >
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
            </Pressable>
        </View>
    );

    const renderSummary = () => (
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SummaryStat
                icon="calendar-multiple"
                value={shifts.length}
                label="Toplam Mesai"
                color={serviceBlue}
            />
            <SummaryStat
                icon="timer-play-outline"
                value={activeShifts.length}
                label="Aktif"
                color={serviceBlue}
            />
            <SummaryStat
                icon="check-decagram-outline"
                value={completedCount}
                label="Tamamlanan"
                color={serviceGreen}
            />
            <SummaryStat
                icon="clock-outline"
                value={totalDurationLabel}
                label="Toplam Sure"
                color={serviceOrange}
                isLast
            />
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        style={({ pressed }) => [
                            styles.headerBtn,
                            {
                                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                                borderColor: colors.border,
                                opacity: pressed ? 0.7 : 1,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Mesailer</Text>
                    <View style={styles.headerBtn} />
                </View>
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={serviceBlue} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                        Mesai kayıtları yükleniyor...
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    style={({ pressed }) => [
                        styles.headerBtn,
                        {
                            backgroundColor: isDark ? colors.surface : '#FFFFFF',
                            borderColor: colors.border,
                            opacity: pressed ? 0.7 : 1,
                        },
                    ]}
                >
                    <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                </Pressable>
                <View style={styles.headerTitleBlock}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Mesailer</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                        {selectedTechnicianLabel}
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                        onPress={() => {
                            setEditingShiftId(null);
                            const today = new Date();
                            setFormDay(today.getDate());
                            setFormMonth(today.getMonth());
                            setFormYear(today.getFullYear());
                            setFormStartHour(8);
                            setFormStartMinute(30);
                            setFormEndHour(18);
                            setFormEndMinute(0);
                            setIsAddShiftVisible(true);
                        }}
                        style={({ pressed }) => [
                            styles.headerBtn,
                            {
                                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                                borderColor: colors.border,
                                opacity: pressed ? 0.7 : 1,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons name="plus" size={22} color={serviceGreen} />
                    </Pressable>
                    <Pressable
                        onPress={handleRefresh}
                        disabled={refreshing}
                        style={({ pressed }) => [
                            styles.headerBtn,
                            {
                                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                                borderColor: colors.border,
                                opacity: pressed || refreshing ? 0.7 : 1,
                            },
                        ]}
                    >
                        {refreshing ? (
                            <ActivityIndicator size="small" color={serviceBlue} />
                        ) : (
                            <MaterialCommunityIcons name="refresh" size={20} color={serviceBlue} />
                        )}
                    </Pressable>
                </View>
            </View>

            {/* Month navigation + Summary (sticky olduklari icin FlatList header'inda) */}
            <FlatList
                data={completedShifts}
                keyExtractor={(item) => String(item.id)}
                ListHeaderComponent={() => (
                    <View>
                        {renderTechnicianFilter()}
                        {renderHeader()}
                        {renderSummary()}
                        {activeShifts.length > 0 && (
                            <View style={styles.sectionHeader}>
                                <View style={[styles.sectionDot, { backgroundColor: serviceBlue }]} />
                                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                                    AKTİF MESAİLER
                                </Text>
                                <Text style={[styles.sectionCount, { color: colors.textTertiary }]}>
                                    {activeShifts.length}
                                </Text>
                            </View>
                        )}
                        {activeShifts.map((shift, idx) => (
                            <ShiftCard
                                key={shift.id}
                                shift={shift}
                                onStop={handleStopShift}
                                onPress={() => onEditShift(shift)}
                                index={idx}
                            />
                        ))}
                        {completedShifts.length > 0 && (
                            <View style={styles.sectionHeader}>
                                <View style={[styles.sectionDot, { backgroundColor: serviceGreen }]} />
                                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                                    TAMAMLANANLAR
                                </Text>
                                <Text style={[styles.sectionCount, { color: colors.textTertiary }]}>
                                    {completedCount}
                                </Text>
                            </View>
                        )}
                    </View>
                )}
                renderItem={({ item, index }) => (
                    <ShiftCard
                        shift={item}
                        onStop={handleStopShift}
                        onPress={() => onEditShift(item)}
                        index={index}
                    />
                )}
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: insets.bottom + 24 },
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={[serviceBlue]}
                        tintColor={serviceBlue}
                    />
                }
                ListEmptyComponent={() => {
                    const hasAny = shifts.length > 0;
                    return (
                        <View style={styles.emptyWrap}>
                            <LinearGradient
                                colors={[`${serviceBlue}22`, `${serviceBlue}08`]}
                                style={styles.emptyIconWrap}
                            >
                                <MaterialCommunityIcons
                                    name={hasAny ? 'check-decagram-outline' : 'calendar-blank-outline'}
                                    size={40}
                                    color={serviceBlue}
                                />
                            </LinearGradient>
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>
                                {hasAny
                                    ? 'Bu ay tamamlanan mesai yok'
                                    : 'Bu ay için mesai kaydı yok'}
                            </Text>
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                {!selectedTechnicianId
                                    ? 'Mesai kayıtlarını görmek için önce bir teknisyen seçin.'
                                    : hasAny
                                        ? 'Aktif mesailer yukarıda listeleniyor. Tamamlanan mesai kaydı bulunmuyor.'
                                        : 'Seçili teknisyen için bu ay mesai kaydı bulunmuyor.'}
                            </Text>
                        </View>
                    );
                }}
            />

            {/* Tarih değişim loading overlay */}
            {monthLoading && !loading && (
                <View pointerEvents="none" style={styles.monthLoadingOverlay}>
                    <View style={[styles.monthLoadingPill, { backgroundColor: isDark ? colors.surface : '#FFFFFF' }]}>
                        <ActivityIndicator size="small" color={serviceBlue} />
                        <Text style={[styles.monthLoadingPillText, { color: colors.text }]}>
                            Yeni liste yükleniyor...
                        </Text>
                    </View>
                </View>
            )}

            <TechnicianPickerSheet
                ref={technicianSheetRef}
                technicians={technicians}
                loading={technicianListLoading}
                includeUnassigned={false}
                selectedTechnicianId={selectedTechnicianId}
                onSelect={(item) => {
                    setSelectedTechnicianId(item?.id || null);
                    technicianSheetRef.current?.dismiss();
                }}
            />

            {/* Modal: Yeni Mesai Ekle */}
            <AppBottomSheet
                visible={isAddShiftVisible}
                onClose={() => setIsAddShiftVisible(false)}
                snapPoints={['70%']}
                contentContainerStyle={styles.formContainer}
                wrapContent={true}
            >
                {/* Form Header */}
                <View style={[styles.formHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.formTitle, { color: colors.text }]}>
                        {editingShiftId ? 'Mesaiyi Düzenle' : 'Yeni Mesai Ekle'}
                    </Text>
                    <Pressable onPress={() => setIsAddShiftVisible(false)} style={styles.formCloseBtn}>
                        <MaterialCommunityIcons name="close" size={22} color={colors.text} />
                    </Pressable>
                </View>

                <BottomSheetScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 24 }}
                >
                    {/* Form Fields */}
                    <View style={styles.formBody}>
                        {/* Date Picker Button */}
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tarih</Text>
                        <Pressable
                            onPress={() => setPickerMode(pickerMode === 'date' ? null : 'date')}
                            style={[styles.formInputBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: colors.border }]}
                        >
                            <MaterialCommunityIcons name="calendar" size={18} color={serviceBlue} style={{ marginRight: 8 }} />
                            <Text style={[styles.formInputText, { color: colors.text }]}>
                                {`${formDay} ${MONTHS_TR[formMonth]} ${formYear}`}
                            </Text>
                            <MaterialCommunityIcons name={pickerMode === 'date' ? "chevron-up" : "chevron-down"} size={16} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
                        </Pressable>

                        {pickerMode === 'date' && (
                            <View style={[styles.spinnerContainer, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }]}>
                                {/* Day Column */}
                                <View style={styles.spinnerColumn}>
                                    <Pressable onPress={() => {
                                        const max = getDaysInMonth(formMonth, formYear);
                                        setFormDay(prev => prev >= max ? 1 : prev + 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-up" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerValue, { color: colors.text }]}>
                                        {String(formDay).padStart(2, '0')}
                                    </Text>
                                    <Pressable onPress={() => {
                                        const max = getDaysInMonth(formMonth, formYear);
                                        setFormDay(prev => prev <= 1 ? max : prev - 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-down" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerLabel, { color: colors.textSecondary }]}>Gün</Text>
                                </View>

                                <View style={{ width: 1, height: '50%', backgroundColor: colors.border }} />

                                {/* Month Column */}
                                <View style={[styles.spinnerColumn, { flex: 1.8 }]}>
                                    <Pressable onPress={() => {
                                        setFormMonth(prev => prev >= 11 ? 0 : prev + 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-up" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerValue, { color: colors.text }]} numberOfLines={1}>
                                        {MONTHS_TR[formMonth]}
                                    </Text>
                                    <Pressable onPress={() => {
                                        setFormMonth(prev => prev <= 0 ? 11 : prev - 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-down" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerLabel, { color: colors.textSecondary }]}>Ay</Text>
                                </View>

                                <View style={{ width: 1, height: '50%', backgroundColor: colors.border }} />

                                {/* Year Column */}
                                <View style={styles.spinnerColumn}>
                                    <Pressable onPress={() => {
                                        setFormYear(prev => prev + 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-up" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerValue, { color: colors.text }]}>
                                        {formYear}
                                    </Text>
                                    <Pressable onPress={() => {
                                        setFormYear(prev => prev - 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-down" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerLabel, { color: colors.textSecondary }]}>Yıl</Text>
                                </View>
                            </View>
                        )}

                        {/* Time Picker Row */}
                        <View style={styles.timeRow}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Giriş Saati</Text>
                                <Pressable
                                    onPress={() => setPickerMode(pickerMode === 'start_time' ? null : 'start_time')}
                                    style={[styles.formInputBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: colors.border }]}
                                >
                                    <MaterialCommunityIcons name="login" size={16} color={serviceGreen} style={{ marginRight: 6 }} />
                                    <Text style={[styles.formInputText, { color: colors.text }]}>
                                        {`${String(formStartHour).padStart(2, '0')}:${String(formStartMinute).padStart(2, '0')}`}
                                    </Text>
                                </Pressable>
                            </View>

                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Çıkış Saati</Text>
                                <Pressable
                                    onPress={() => setPickerMode(pickerMode === 'end_time' ? null : 'end_time')}
                                    style={[styles.formInputBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: colors.border }]}
                                >
                                    <MaterialCommunityIcons name="logout" size={16} color={serviceRed} style={{ marginRight: 6 }} />
                                    <Text style={[styles.formInputText, { color: colors.text }]}>
                                        {`${String(formEndHour).padStart(2, '0')}:${String(formEndMinute).padStart(2, '0')}`}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>

                        {/* Start Time Wheels */}
                        {pickerMode === 'start_time' && (
                            <View style={[styles.spinnerContainer, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }]}>
                                {/* Hour Column */}
                                <View style={styles.spinnerColumn}>
                                    <Pressable onPress={() => setFormStartHour(prev => (prev + 1) % 24)} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-up" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerValue, { color: colors.text }]}>
                                        {String(formStartHour).padStart(2, '0')}
                                    </Text>
                                    <Pressable onPress={() => setFormStartHour(prev => (prev - 1 + 24) % 24)} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-down" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerLabel, { color: colors.textSecondary }]}>Saat</Text>
                                </View>

                                <Text style={{ fontSize: 24, alignSelf: 'center', color: colors.text, marginBottom: 20 }}>:</Text>

                                {/* Minute Column */}
                                <View style={styles.spinnerColumn}>
                                    <Pressable onPress={() => setFormStartMinute(prev => (prev + 5) % 60)} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-up" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerValue, { color: colors.text }]}>
                                        {String(formStartMinute).padStart(2, '0')}
                                    </Text>
                                    <Pressable onPress={() => setFormStartMinute(prev => (prev - 5 + 60) % 60)} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-down" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerLabel, { color: colors.textSecondary }]}>Dakika</Text>
                                </View>
                            </View>
                        )}

                        {/* End Time Wheels */}
                        {pickerMode === 'end_time' && (
                            <View style={[styles.spinnerContainer, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }]}>
                                {/* Hour Column */}
                                <View style={styles.spinnerColumn}>
                                    <Pressable onPress={() => setFormEndHour(prev => (prev + 1) % 24)} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-up" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerValue, { color: colors.text }]}>
                                        {String(formEndHour).padStart(2, '0')}
                                    </Text>
                                    <Pressable onPress={() => setFormEndHour(prev => (prev - 1 + 24) % 24)} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-down" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerLabel, { color: colors.textSecondary }]}>Saat</Text>
                                </View>

                                <Text style={{ fontSize: 24, alignSelf: 'center', color: colors.text, marginBottom: 20 }}>:</Text>

                                {/* Minute Column */}
                                <View style={styles.spinnerColumn}>
                                    <Pressable onPress={() => setFormEndMinute(prev => (prev + 5) % 60)} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-up" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerValue, { color: colors.text }]}>
                                        {String(formEndMinute).padStart(2, '0')}
                                    </Text>
                                    <Pressable onPress={() => setFormEndMinute(prev => (prev - 5 + 60) % 60)} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-down" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerLabel, { color: colors.textSecondary }]}>Dakika</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Form Action Buttons */}
                    <View style={[styles.formActions, editingShiftId && { flexDirection: 'row', gap: 10 }, { marginTop: 24 }]}>
                        {editingShiftId && (
                            <Pressable
                                onPress={handleDeleteShift}
                                disabled={submittingShift}
                                style={({ pressed }) => [
                                    styles.deleteBtn,
                                    {
                                        borderColor: serviceRed,
                                        opacity: pressed || submittingShift ? 0.8 : 1,
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons name="trash-can-outline" size={20} color={serviceRed} style={{ marginRight: 6 }} />
                                <Text style={[styles.deleteBtnText, { color: serviceRed }]}>Sil</Text>
                            </Pressable>
                        )}
                        <Pressable
                            onPress={handleSaveShift}
                            disabled={submittingShift}
                            style={({ pressed }) => [
                                styles.submitBtn,
                                {
                                    flex: editingShiftId ? 1 : undefined,
                                    backgroundColor: serviceGreen,
                                    opacity: pressed || submittingShift ? 0.8 : 1,
                                },
                            ]}
                        >
                            {submittingShift ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="check" size={20} color="#fff" style={{ marginRight: 6 }} />
                                    <Text style={styles.submitBtnText}>
                                        {editingShiftId ? 'Güncelle' : 'Kaydet'}
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                </BottomSheetScrollView>
            </AppBottomSheet>

            {/* Native DateTimePicker (Unused now, removed) */}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    headerBtn: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    headerTitleBlock: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
    headerSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 2, letterSpacing: 0.2 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    loadingText: { fontSize: 13, fontWeight: '600' },
    listContent: { paddingHorizontal: 16, paddingTop: 4 },
    filterCard: {
        borderWidth: 1,
        borderRadius: 18,
        paddingVertical: 12,
        marginBottom: 12,
    },
    filterHeader: {
        paddingHorizontal: 12,
        marginBottom: 10,
        gap: 2,
    },
    filterTitle: {
        fontSize: 14,
        fontWeight: '800',
    },
    filterSubtitle: {
        fontSize: 11,
        fontWeight: '600',
    },
    filterLoadingWrap: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 12,
    },
    filterLoadingText: {
        fontSize: 12,
        fontWeight: '600',
    },
    selectorButton: {
        minHeight: 66,
        marginHorizontal: 12,
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    selectorAvatar: {
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectorAvatarText: {
        fontSize: 13,
        fontWeight: '900',
    },
    selectorTextWrap: {
        flex: 1,
    },
    selectorTitle: {
        fontSize: 13,
        fontWeight: '800',
    },
    selectorSubtitle: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    filterEmptyText: {
        fontSize: 12,
        fontWeight: '600',
        paddingHorizontal: 12,
        paddingBottom: 4,
    },

    // Month nav
    monthNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        marginBottom: 8,
    },
    monthBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    monthCenter: { alignItems: 'center', flex: 1 },
    monthLabel: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
    monthLoadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    monthLoadingText: { fontSize: 11, fontWeight: '600' },

    // Summary
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'stretch',
        padding: 12,
        borderRadius: 18,
        marginBottom: 16,
        borderWidth: 1,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingVertical: 4,
        position: 'relative',
    },
    summaryIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: -0.2,
        marginBottom: 2,
    },
    summaryLabel: {
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
        letterSpacing: 0.2,
    },
    summaryDivider: {
        position: 'absolute',
        right: 0,
        top: 8,
        bottom: 8,
        width: 1,
    },

    // Section
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        marginBottom: 10,
    },
    sectionDot: { width: 6, height: 6, borderRadius: 3 },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
        flex: 1,
    },
    sectionCount: {
        fontSize: 11,
        fontWeight: '700',
        paddingHorizontal: 8,
    },

    // Shift card
    shiftCard: {
        padding: 14,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderLeftWidth: 5,
    },
    shiftHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        gap: 8,
    },
    shiftDateBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    shiftDateIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shiftDateText: {
        fontSize: 14,
        fontWeight: '800',
    },
    shiftWeekday: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
    shiftBody: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginTop: 6,
    },
    timeDetails: {
        flex: 1.4,
        justifyContent: 'center',
        gap: 6,
    },
    timeRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeLabelText: {
        fontSize: 11,
        fontWeight: '600',
    },
    timeValueText: {
        fontSize: 14,
        fontWeight: '800',
    },
    durationDetails: {
        flex: 1,
        alignItems: 'flex-end',
        justifyContent: 'center',
        borderLeftWidth: 1,
        paddingLeft: 12,
    },
    durationLabelText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    durationValueText: {
        fontSize: 12,
        fontWeight: '800',
        textAlign: 'right',
        marginTop: 3,
    },
    stopBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 12,
        marginTop: 12,
        borderWidth: 1,
    },
    stopBtnText: { fontSize: 13, fontWeight: '800' },

    // New Shift Card Styling
    newShiftCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderLeftWidth: 5,
    },
    dateCol: {
        width: 80,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    dateColDay: {
        fontSize: 14,
        fontWeight: '800',
    },
    dateColYear: {
        fontSize: 10,
        fontWeight: '500',
        marginTop: 1,
    },
    dateColWeekday: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    verticalDivider: {
        width: 1,
        height: '80%',
        marginHorizontal: 12,
    },
    detailsCol: {
        flex: 1.2,
        justifyContent: 'center',
        gap: 2,
    },
    detailsTitle: {
        fontSize: 13,
        fontWeight: '800',
    },
    detailsTime: {
        fontSize: 12,
        fontWeight: '600',
    },
    detailsDuration: {
        fontSize: 11,
        fontWeight: '500',
    },
    statusCol: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    newStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    newStatusText: {
        fontSize: 10,
        fontWeight: '800',
    },

    // Selected Profile Card
    profileCardWrap: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 12,
        marginBottom: 12,
    },
    profileCardPressable: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 12,
    },
    profileAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    profileAvatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileAvatarText: {
        fontSize: 15,
        fontWeight: '800',
    },
    statusDotOverlay: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
    },
    profileInfo: {
        flex: 1,
        gap: 2,
    },
    profileName: {
        fontSize: 15,
        fontWeight: '800',
    },
    profileRole: {
        fontSize: 12,
        fontWeight: '600',
    },
    profileRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    onlineStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    onlineStatusText: {
        fontSize: 10,
        fontWeight: '800',
    },

    // Empty
    emptyWrap: {
        alignItems: 'center',
        paddingVertical: 56,
        paddingHorizontal: 24,
        gap: 8,
    },
    emptyIconWrap: {
        width: 84,
        height: 84,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
    },
    emptyText: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 19,
        fontWeight: '500',
        maxWidth: 280,
    },

    // Month loading overlay
    monthLoadingOverlay: {
        position: 'absolute',
        top: 80,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    monthLoadingPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    monthLoadingPillText: {
        fontSize: 12,
        fontWeight: '700',
    },

    // Form Styling
    formContainer: {
        paddingHorizontal: 16,
        paddingTop: 4,
    },
    formHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 12,
        borderBottomWidth: 1,
        marginBottom: 16,
    },
    formTitle: {
        fontSize: 16,
        fontWeight: '800',
    },
    formCloseBtn: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    formBody: {
        gap: 12,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 4,
    },
    formInputBtn: {
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    formInputText: {
        fontSize: 14,
        fontWeight: '600',
    },
    timeRow: {
        flexDirection: 'row',
        marginTop: 4,
    },
    formActions: {
        marginTop: 24,
    },
    submitBtn: {
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
    },
    adjusterRow: {
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
    },
    adjBtn: {
        width: 26,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    adjVal: {
        fontSize: 13,
        fontWeight: '800',
        width: 18,
        textAlign: 'center',
    },
    adjColon: {
        fontSize: 14,
        fontWeight: '800',
    },
    deleteBtn: {
        flex: 0.8,
        height: 48,
        borderRadius: 14,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    deleteBtnText: {
        fontSize: 14,
        fontWeight: '800',
    },
    pickerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 8,
        height: 180,
        marginTop: 10,
        marginBottom: 10,
        overflow: 'hidden',
    },
    pickerColumn: {
        flex: 1,
        height: 180,
    },
    pickerItem: {
        height: 42,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 2,
        marginHorizontal: 4,
        borderRadius: 10,
    },
    pickerItemText: {
        fontSize: 14,
        fontWeight: '800',
    },
    spinnerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: 18,
        height: 150,
        marginTop: 10,
        marginBottom: 10,
        paddingHorizontal: 16,
        gap: 12,
    },
    spinnerColumn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    spinnerArrow: {
        padding: 6,
    },
    spinnerValue: {
        fontSize: 18,
        fontWeight: '900',
        marginVertical: 4,
        textAlign: 'center',
    },
    spinnerLabel: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginTop: 2,
    },
});