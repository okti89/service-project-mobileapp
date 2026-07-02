import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
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
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import TechnicianPickerSheet from '@/components/home/TechnicianPickerSheet';

const MONTHS_TR = [
    'Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran',
    'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik',
];

// Toplam sure: "1s 30dk" veya "45dk" gibi
const formatDuration = (totalMinutes) => {
    const safe = Math.max(0, Math.floor(Number(totalMinutes) || 0));
    if (safe === 0) return '0dk';
    const hours = Math.floor(safe / 60);
    const minutes = safe % 60;
    if (hours === 0) return `${minutes}dk`;
    if (minutes === 0) return `${hours}s`;
    return `${hours}s ${String(minutes).padStart(2, '0')}dk`;
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
    active: { label: 'Aktif', color: serviceGreen, icon: 'timer-play-outline', softColor: '#22C55E' },
    break: { label: 'Molada', color: serviceOrange, icon: 'coffee-outline', softColor: '#F59E0B' },
    completed: { label: 'Tamamlandi', color: serviceBlue, icon: 'check-decagram-outline', softColor: '#3B82F6' },
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

const ShiftCard = ({ shift, onStop, index = 0 }) => {
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

    return (
        <Animated.View
            style={[
                styles.shiftCard,
                {
                    backgroundColor: colors.surface,
                    borderColor: state === 'active' ? `${serviceGreen}55` : colors.border,
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                },
            ]}
        >
            <View style={styles.shiftHeader}>
                <View style={styles.shiftDateBlock}>
                    <View
                        style={[
                            styles.shiftDateIcon,
                            { backgroundColor: `${meta.softColor}1A` },
                        ]}
                    >
                        <MaterialCommunityIcons name="calendar" size={14} color={meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.shiftDateText, { color: colors.text }]} numberOfLines={1}>
                            {formatDate(shift.date)}
                        </Text>
                        <Text style={[styles.shiftWeekday, { color: colors.textTertiary }]} numberOfLines={1}>
                            {formatWeekday(shift.date)}
                        </Text>
                    </View>
                </View>
                <View
                    style={[
                        styles.statusBadge,
                        { backgroundColor: `${meta.softColor}1F`, borderColor: `${meta.softColor}55` },
                    ]}
                >
                    <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                </View>
            </View>

            <View style={styles.shiftBody}>
                <View style={styles.timeBlock}>
                    <Text style={[styles.timeLabel, { color: colors.textTertiary }]}>GIRIS</Text>
                    <Text style={[styles.timeValue, { color: colors.text }]}>{formatTime(shift.start_time)}</Text>
                </View>
                <View style={styles.timeArrowWrap}>
                    <View style={[styles.timeLine, { backgroundColor: colors.divider }]} />
                    <MaterialCommunityIcons name="arrow-right" size={14} color={colors.textTertiary} />
                    <View style={[styles.timeLine, { backgroundColor: colors.divider }]} />
                </View>
                <View style={styles.timeBlock}>
                    <Text style={[styles.timeLabel, { color: colors.textTertiary }]}>CIKIS</Text>
                    <Text style={[styles.timeValue, { color: colors.text }]}>{formatTime(shift.end_time)}</Text>
                </View>
                <View style={styles.durationBlock}>
                    <Text style={[styles.timeLabel, { color: colors.textTertiary }]}>SURE</Text>
                    <Text style={[styles.durationValue, { color: meta.color }]}>
                        {state === 'active' ? 'Devam ediyor...' : state === 'break' ? 'Molada' : formatDuration(getShiftDurationMinutes(shift))}
                    </Text>
                </View>
            </View>

            {(state === 'active' || state === 'break') && (
                <Pressable
                    onPress={() => onStop(shift)}
                    style={({ pressed }) => [
                        styles.stopBtn,
                        {
                            backgroundColor: `${serviceRed}15`,
                            borderColor: `${serviceRed}40`,
                            opacity: pressed ? 0.7 : 1,
                        },
                    ]}
                >
                    <MaterialCommunityIcons name="stop-circle-outline" size={16} color={serviceRed} />
                    <Text style={[styles.stopBtnText, { color: serviceRed }]}>Mesaiyi Bitir</Text>
                </Pressable>
            )}
        </Animated.View>
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
                            fetchShifts({ isMonthChange: true });
                        } catch (error) {
                            Alert.alert('Hata', error?.response?.data?.detail || 'Mesai bitirilemedi');
                        }
                    },
                },
            ]
        );
    }, [fetchShifts]);

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
    const totalDurationLabel = formatDuration(totalMinutes);
    const completedCount = completedShifts.length;

    const renderTechnicianFilter = () => (
        <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.filterHeader}>
                <Text style={[styles.filterTitle, { color: colors.text }]}>Teknisyen</Text>
                <Text style={[styles.filterSubtitle, { color: colors.textSecondary }]}>Mesailer secili teknisyene gore listelenir</Text>
            </View>

            <Pressable
                onPress={() => !technicianListLoading && technicianSheetRef.current?.present()}
                style={({ pressed }) => [
                    styles.selectorButton,
                    {
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.border,
                        opacity: pressed ? 0.82 : 1,
                    },
                ]}
            >
                <View style={[styles.selectorAvatar, { backgroundColor: selectedTechnicianId ? `${serviceGreen}18` : `${serviceBlue}14` }]}>
                    <Text style={[styles.selectorAvatarText, { color: selectedTechnicianId ? serviceGreen : serviceBlue }]}>
                        {selectedTechnician ? getTechnicianInitials(selectedTechnician) : '??'}
                    </Text>
                </View>
                <View style={styles.selectorTextWrap}>
                    <Text style={[styles.selectorTitle, { color: colors.text }]} numberOfLines={1}>
                        {selectedTechnicianLabel}
                    </Text>
                    <Text style={[styles.selectorSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                        {technicianListLoading
                            ? 'Teknisyenler yukleniyor...'
                            : selectedTechnician?.status_display || 'Teknisyen secmek icin dokunun'}
                    </Text>
                </View>
                {technicianListLoading ? (
                    <ActivityIndicator size="small" color={serviceBlue} />
                ) : (
                    <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
                )}
            </Pressable>

            {!technicianListLoading && technicians.length === 0 ? (
                <Text style={[styles.filterEmptyText, { color: colors.textSecondary }]}>Listelenecek teknisyen bulunamadi.</Text>
            ) : null}
        </View>
    );

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
                color={serviceGreen}
            />
            <SummaryStat
                icon="check-decagram-outline"
                value={completedCount}
                label="Tamamlanan"
                color="#8B5CF6"
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
            <View style={[styles.screen, { backgroundColor: isDark ? '#08111F' : '#F4F7FC' }]}>
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
                        Mesai kayitlari yukleniyor...
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.screen, { backgroundColor: isDark ? '#08111F' : '#F4F7FC' }]}>
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
                                <View style={[styles.sectionDot, { backgroundColor: serviceGreen }]} />
                                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                                    AKTIF MESAILER
                                </Text>
                                <Text style={[styles.sectionCount, { color: colors.textTertiary }]}>
                                    {activeShifts.length}
                                </Text>
                            </View>
                        )}
                        {activeShifts.map((shift, idx) => (
                            <ShiftCard key={shift.id} shift={shift} onStop={handleStopShift} index={idx} />
                        ))}
                        {completedShifts.length > 0 && (
                            <View style={styles.sectionHeader}>
                                <View style={[styles.sectionDot, { backgroundColor: serviceBlue }]} />
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
                                    : 'Bu ay icin mesai kaydi yok'}
                            </Text>
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                {!selectedTechnicianId
                                    ? 'Mesai kayitlarini gormek icin once bir teknisyen secin.'
                                    : hasAny
                                        ? 'Aktif mesailer yukarida listeleniyor. Tamamlanan mesai kaydi bulunmuyor.'
                                        : 'Secili teknisyen icin bu ay mesai kaydi bulunmuyor.'}
                            </Text>
                        </View>
                    );
                }}
            />

            {/* Tarih degisim loading overlay */}
            {monthLoading && !loading && (
                <View pointerEvents="none" style={styles.monthLoadingOverlay}>
                    <View style={[styles.monthLoadingPill, { backgroundColor: isDark ? colors.surface : '#FFFFFF' }]}>
                        <ActivityIndicator size="small" color={serviceBlue} />
                        <Text style={[styles.monthLoadingPillText, { color: colors.text }]}>
                            Yeni liste yukleniyor...
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
        borderWidth: 1.5,
    },
    shiftHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
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
    },
    timeBlock: { flex: 1 },
    timeArrowWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    timeLine: {
        width: 6,
        height: 1,
        marginHorizontal: 1,
    },
    timeLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.4,
        marginBottom: 2,
    },
    timeValue: {
        fontSize: 15,
        fontWeight: '800',
    },
    durationBlock: { flex: 1, alignItems: 'flex-end' },
    durationValue: {
        fontSize: 13,
        fontWeight: '800',
    },
    stopBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
        marginTop: 12,
        borderWidth: 1,
    },
    stopBtnText: { fontSize: 13, fontWeight: '800' },

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
});
