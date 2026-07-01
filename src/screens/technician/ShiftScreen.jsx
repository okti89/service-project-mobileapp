import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import technicianService from '@/services/technicianService';
import {
    scheduleShiftEndReminder,
    cancelShiftEndReminder,
    clearAllShiftReminders,
} from '@/services/shiftReminderService';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';

const WORKDAY_SECONDS = 8 * 60 * 60;
const RING_SIZE = 220;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const formatDayKey = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseDateValue = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatTime = (value) => {
    const parsed = parseDateValue(value);
    if (!parsed) return '--:--';
    return parsed.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};

const formatDateLabel = (date) =>
    date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        weekday: 'long',
    });

const getElapsedSeconds = (startValue, endValue = null) => {
    const start = parseDateValue(startValue);
    const end = endValue ? parseDateValue(endValue) : new Date();
    if (!start || !end) return 0;
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
};

const formatTimer = (seconds) => {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0');
    const remainingSeconds = String(safeSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${remainingSeconds}`;
};

const formatSummaryDuration = (seconds) => {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    return `${hours}sa ${String(minutes).padStart(2, '0')}dk`;
};

const addDays = (date, amount) => {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
};

const StatTile = ({ icon, value, label, color, sub, isDark }) => (
    <View
        style={[
            styles.statTile,
            {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                borderColor: `${color}30`,
            },
        ]}
    >
        <View style={[styles.statIconWrap, { backgroundColor: `${color}18` }]}>
            <MaterialCommunityIcons name={icon} size={16} color={color} />
        </View>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
);

export default function ShiftScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { syncLocationTrackingByShift, userInfo } = useAuth();
    const { showToast } = useToast();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [shift, setShift] = useState(null);
    const [now, setNow] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const selectedDayKey = useMemo(() => formatDayKey(selectedDate), [selectedDate]);
    const todayKey = formatDayKey(new Date());
    const isToday = selectedDayKey === todayKey;
    const hasOpenShift = Boolean(shift?.start_time && !shift?.end_time);
    const isOnBreak = Boolean(shift?.break_started_at && !shift?.end_time);
    const hasActiveShift = hasOpenShift && !isOnBreak;
    const hasCompletedShift = Boolean(shift?.start_time && shift?.end_time);
    const hasStartedShift = Boolean(shift?.start_time);
    const breakMinutes = Math.max(0, Number(shift?.break_minutes || 0));
    const persistedBreakSeconds = Math.max(0, Number(shift?.break_seconds ?? (breakMinutes * 60)));
    const activeBreakSeconds = isOnBreak ? getElapsedSeconds(shift?.break_started_at, now) : 0;
    const grossEndValue = hasCompletedShift
        ? shift?.end_time
        : isOnBreak
            ? shift?.break_started_at
            : now;
    const grossSeconds = shift?.start_time ? getElapsedSeconds(shift.start_time, grossEndValue) : 0;
    const breakSeconds = persistedBreakSeconds + activeBreakSeconds;
    const backendDurationMinutes = shift?.duration_minutes == null ? null : Number(shift.duration_minutes);
    const netSeconds = hasCompletedShift && Number.isFinite(backendDurationMinutes)
        ? Math.max(0, backendDurationMinutes * 60)
        : Math.max(0, grossSeconds - persistedBreakSeconds);
    const ringProgress = Math.min(1, netSeconds / WORKDAY_SECONDS);
    const ringOffset = RING_CIRCUMFERENCE * (1 - ringProgress);
    const targetSeconds = WORKDAY_SECONDS;
    const targetPercent = Math.round((netSeconds / targetSeconds) * 100);

    const STATE_META = isOnBreak
        ? {
            color: serviceOrange,
            label: 'Molada',
            sub: 'Mola sürüyor, hazır olduğunuzda devam edin',
            icon: 'coffee-outline',
            gradient: [serviceOrange, '#EA580C'],
        }
        : hasActiveShift
            ? {
                color: serviceBlue,
                label: 'Mesai Aktif',
                sub: 'Çalışmaya devam ediyorsunuz',
                icon: 'timer-play-outline',
                gradient: [serviceBlue, '#1D4ED8'],
            }
            : hasCompletedShift
                ? {
                    color: serviceGreen,
                    label: 'Mesai Tamamlandı',
                    sub: 'Günlük çalışma süreniz kaydedildi',
                    icon: 'check-decagram-outline',
                    gradient: [serviceGreen, '#0F766E'],
                }
                : {
                    color: colors.textTertiary,
                    label: 'Mesai Başlamadı',
                    sub: 'Çalışmaya başlamak için aşağıdaki butona dokunun',
                    icon: 'timer-outline',
                    gradient: isDark ? ['#1F2937', '#0F172A'] : ['#475569', '#1E293B'],
                };

    const primaryActionLabel = isOnBreak
        ? 'Mola Bitir'
        : hasActiveShift
            ? 'Mola Ver'
            : hasCompletedShift
                ? 'Mesaiyi Yeniden Başlat'
                : 'Mesaiyi Başlat';

    const primaryActionIcon = isOnBreak
        ? 'play-circle-outline'
        : hasActiveShift
            ? 'coffee-outline'
            : hasCompletedShift
                ? 'restart'
                : 'play';

    const timelineRows = useMemo(() => {
        const rows = [];

        if (shift?.start_time) {
            rows.push({
                key: 'start',
                icon: 'play-circle',
                color: serviceGreen,
                time: formatTime(shift.start_time),
                title: 'Mesai Başlangıcı',
                description: 'Çalışmaya başladığınız an',
            });
        }

        if (breakMinutes > 0) {
            rows.push({
                key: 'break',
                icon: 'pause-circle',
                color: serviceOrange,
                time: formatSummaryDuration(breakSeconds),
                title: 'Toplam Mola',
                description: 'Gün içindeki toplam mola süresi',
            });
        }

        if (hasActiveShift) {
            rows.push({
                key: 'active',
                icon: 'timer-sand',
                color: serviceBlue,
                time: formatTime(now),
                title: 'Devam Ediyor',
                description: 'Şu an aktif çalışma süresi',
            });
        }

        if (isOnBreak) {
            rows.push({
                key: 'break-active',
                icon: 'coffee',
                color: serviceOrange,
                time: formatTime(shift?.break_started_at),
                title: 'Mola Başlangıcı',
                description: 'Mola başladı, hazır olduğunuzda bitirin',
            });
        }

        if (hasCompletedShift) {
            rows.push({
                key: 'end',
                icon: 'flag-checkered',
                color: serviceGreen,
                time: formatTime(shift?.end_time),
                title: 'Mesai Bitişi',
                description: 'Çalışma günü tamamlandı',
            });
        } else if (hasStartedShift) {
            rows.push({
                key: 'end',
                icon: 'flag-outline',
                color: colors.textTertiary,
                time: '--:--',
                title: 'Mesai Bitişi',
                description: 'Henüz bitirilmedi',
            });
        }

        return rows;
    }, [
        breakMinutes,
        breakSeconds,
        colors.textTertiary,
        hasActiveShift,
        hasCompletedShift,
        hasStartedShift,
        isOnBreak,
        now,
        shift,
    ]);

    const loadShift = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await technicianService.getShifts({
                start_date: selectedDayKey,
                end_date: selectedDayKey,
            });
            const shifts = Array.isArray(rows) ? rows : [];
            const active = shifts.find((item) => item?.start_time && !item?.end_time);
            setShift(active || shifts[0] || null);
        } catch (error) {
            Alert.alert('Mesai alınamadı', 'Bağlantınızı kontrol edip tekrar deneyin.');
            setShift(null);
        } finally {
            setLoading(false);
        }
    }, [selectedDayKey]);

    /**
     * Onceki gun(ler)den acik kalmis mesai var mi diye kontrol eder.
     * Bugun degilken acilan ekranda veya bugun acilip onceki gunlerden
     * acik mesai kaldiginda kullaniciyi uyarir.
     */
    const checkStaleOpenShift = useCallback(async () => {
        try {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            const yesterdayKey = formatDayKey(yesterday);

            // Son 7 gunu tarayip acik mesai var mi diye bak
            const lookbackStart = new Date(today);
            lookbackStart.setDate(today.getDate() - 7);

            const rows = await technicianService.getShifts({
                start_date: formatDayKey(lookbackStart),
                end_date: yesterdayKey,
            });
            const shifts = Array.isArray(rows) ? rows : [];
            const staleOpen = shifts.find((item) => item?.start_time && !item?.end_time);

            if (!staleOpen) return;

            const startDate = parseDateValue(staleOpen.start_time);
            const startedLabel = startDate
                ? startDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' })
                : 'onceki gun';

            Alert.alert(
                'Acik mesai tespit edildi',
                `${startedLabel} baslattiginiz mesai hâlâ kapatilmamis. Ne yapmak istersiniz?`,
                [
                    {
                        text: 'Devam ediyor',
                        style: 'cancel',
                        onPress: () => {
                            // Kullanici hâlâ calisiyor: bugune tasi
                            // (Cunku ayni gun 2 kez startShift gondermek yerine
                            // sadece UI tarafinda temsil ediyoruz; backend'de
                            // /shift/stop sonra /shift/start ile yeni kayit acilir)
                        },
                    },
                    {
                        text: 'Otomatik Kapat',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                const endOfDay = new Date(startDate);
                                endOfDay.setHours(23, 59, 59, 0);
                                await technicianService.stopShift({
                                    id: staleOpen.id,
                                    timestamp: endOfDay.toISOString(),
                                });
                                showToast?.('success', 'Mesai kapatildi', `${startedLabel} baslattiginiz mesai gun sonu ile kapatildi.`);
                                loadShift();
                            } catch (error) {
                                Alert.alert('Hata', 'Mesai otomatik kapatilamadi');
                            }
                        },
                    },
                ]
            );
        } catch (error) {
            // Sessizce devam et
        }
    }, [loadShift, showToast]);

    useFocusEffect(
        useCallback(() => {
            loadShift();
            // Ilk acilista / focus'ta eski acik mesai kontrolu yap
            checkStaleOpenShift();
        }, [loadShift, checkStaleOpenShift]),
    );

    useEffect(() => {
        if (!hasOpenShift) return undefined;
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, [hasOpenShift]);

    // Bilesen unmount oldugunda (logout / app kapanma) tum hatirlatmalari temizle
    useEffect(() => {
        return () => {
            clearAllShiftReminders();
        };
    }, []);

    const handleStart = async () => {
        if (!isToday) {
            setSelectedDate(new Date());
            return;
        }
        setSaving(true);
        try {
            const next = await technicianService.startShift({
                date: todayKey,
                timestamp: new Date().toISOString(),
                break_minutes: breakMinutes,
            });
            setNow(new Date());
            setShift(next);
            await syncLocationTrackingByShift?.();
            // Mesai baslatildi: gun sonu icin hatirlatma planla
            scheduleShiftEndReminder({
                startTime: next?.start_time || new Date(),
                technicianName: userInfo?.full_name || userInfo?.username,
            });
        } catch (error) {
            Alert.alert('Mesai başlatılamadı', error?.response?.data?.detail || 'Tekrar deneyin.');
        } finally {
            setSaving(false);
        }
    };

    const handleBreakStart = async () => {
        setSaving(true);
        try {
            const next = await technicianService.startShiftBreak({
                timestamp: new Date().toISOString(),
            });
            setNow(new Date());
            setShift(next);
        } catch (error) {
            Alert.alert('Mola başlatılamadı', error?.response?.data?.detail || 'Tekrar deneyin.');
        } finally {
            setSaving(false);
        }
    };

    const handleBreakStop = async () => {
        setSaving(true);
        try {
            const next = await technicianService.stopShiftBreak({
                timestamp: new Date().toISOString(),
            });
            setNow(new Date());
            setShift(next);
        } catch (error) {
            Alert.alert('Mola bitirilemedi', error?.response?.data?.detail || 'Tekrar deneyin.');
        } finally {
            setSaving(false);
        }
    };

    const handleStop = async () => {
        setSaving(true);
        try {
            const next = await technicianService.stopShift({
                timestamp: new Date().toISOString(),
            });
            setShift(next);
            // Mesai bitti: hatirlatmayi iptal et
            cancelShiftEndReminder();
            await syncLocationTrackingByShift?.();
        } catch (error) {
            Alert.alert('Mesai bitirilemedi', error?.response?.data?.detail || 'Tekrar deneyin.');
        } finally {
            setSaving(false);
        }
    };

    const handlePrimaryAction = () => {
        if (!isToday) {
            setSelectedDate(new Date());
            return;
        }
        if (isOnBreak) handleBreakStop();
        else if (hasActiveShift) handleBreakStart();
        else handleStart();
    };

    const handleEndShift = () => {
        Alert.alert(
            'Mesaiyi Bitir',
            'Günü bitirmek istediğinize emin misiniz?',
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Mesaiyi Bitir',
                    style: 'destructive',
                    onPress: handleStop,
                },
            ]
        );
    };

    return (
        <View style={[styles.screen, { backgroundColor: isDark ? '#08111F' : '#F4F7FC' }]}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}
            >
                {/* Clean header */}
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
                        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                            Mesai Takibi
                        </Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                            Günlük çalışma özeti
                        </Text>
                    </View>
                    <Pressable
                        onPress={() => loadShift()}
                        disabled={loading}
                        style={({ pressed }) => [
                            styles.headerBtn,
                            {
                                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                                borderColor: colors.border,
                                opacity: pressed || loading ? 0.7 : 1,
                            },
                        ]}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.primary} size="small" />
                        ) : (
                            <MaterialCommunityIcons name="refresh" size={20} color={colors.primary} />
                        )}
                    </Pressable>
                </View>
                {/* Hero timer card */}
                <LinearGradient
                    colors={STATE_META.gradient}
                    style={styles.heroCard}
                >
                    {/* Decorative orbs */}
                    <View style={[styles.heroOrb, { top: -40, right: -40, backgroundColor: 'rgba(255,255,255,0.10)' }]} />
                    <View style={[styles.heroOrb, { bottom: -30, left: -20, width: 100, height: 100, backgroundColor: 'rgba(255,255,255,0.06)' }]} />

                    <View style={styles.statusPill}>
                        <View style={styles.statusPillDot} />
                        <Text style={styles.statusPillText}>{STATE_META.label}</Text>
                    </View>

                    <View style={styles.ringWrap}>
                        <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ring}>
                            <Circle
                                cx={RING_SIZE / 2}
                                cy={RING_SIZE / 2}
                                r={RING_RADIUS}
                                stroke="rgba(255,255,255,0.18)"
                                strokeWidth={RING_STROKE}
                                fill="none"
                            />
                            <Circle
                                cx={RING_SIZE / 2}
                                cy={RING_SIZE / 2}
                                r={RING_RADIUS}
                                stroke="#FFFFFF"
                                strokeWidth={RING_STROKE}
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                                strokeDashoffset={ringOffset}
                                rotation="-90"
                                origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                            />
                        </Svg>
                        <View style={styles.ringContent}>
                            <Text style={styles.ringLabel}>Çalışma Süresi</Text>
                            <Text style={styles.ringTimer}>{formatTimer(netSeconds)}</Text>
                            <View style={styles.ringSubRow}>
                                <View style={styles.targetPill}>
                                    <MaterialCommunityIcons
                                        name="target"
                                        size={11}
                                        color="rgba(255,255,255,0.85)"
                                    />
                                    <Text style={styles.targetPillText}>
                                        {hasStartedShift ? `%${targetPercent} • 8 saat hedef` : 'Hedef 8 saat'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={styles.heroStatusRow}>
                        <View style={styles.heroStatusItem}>
                            <MaterialCommunityIcons
                                name="login"
                                size={14}
                                color="rgba(255,255,255,0.7)"
                            />
                            <Text style={styles.heroStatusLabel}>Başlangıç</Text>
                            <Text style={styles.heroStatusValue}>
                                {formatTime(shift?.start_time)}
                            </Text>
                        </View>
                        <View style={styles.heroStatusDivider} />
                        <View style={styles.heroStatusItem}>
                            <MaterialCommunityIcons
                                name="logout"
                                size={14}
                                color="rgba(255,255,255,0.7)"
                            />
                            <Text style={styles.heroStatusLabel}>Bitiş</Text>
                            <Text style={styles.heroStatusValue}>
                                {formatTime(shift?.end_time)}
                            </Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* Date navigator */}
                <View
                    style={[
                        styles.dateNavigator,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                >
                    <Pressable
                        onPress={() => setSelectedDate((prev) => addDays(prev, -1))}
                        style={({ pressed }) => [
                            styles.dateButton,
                            { backgroundColor: pressed ? `${colors.primary}15` : 'transparent' },
                        ]}
                    >
                        <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
                    </Pressable>
                    <View style={styles.dateContent}>
                        <View
                            style={[
                                styles.dateIconWrap,
                                { backgroundColor: `${colors.primary}15` },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name="calendar-month"
                                size={16}
                                color={colors.primary}
                            />
                        </View>
                        <View style={styles.dateTextBlock}>
                            <Text style={[styles.dateTitle, { color: colors.text }]}>
                                {formatDateLabel(selectedDate)}
                            </Text>
                            {isToday ? (
                                <Text style={[styles.dateHint, { color: colors.primary }]}>
                                    Bugün
                                </Text>
                            ) : null}
                        </View>
                    </View>
                    <Pressable
                        onPress={() => setSelectedDate((prev) => addDays(prev, 1))}
                        style={({ pressed }) => [
                            styles.dateButton,
                            { backgroundColor: pressed ? `${colors.primary}15` : 'transparent' },
                        ]}
                    >
                        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
                    </Pressable>
                </View>

                {/* Stat grid */}
                {!loading && hasStartedShift ? (
                    <View style={styles.statGrid}>
                        <StatTile
                            icon="timer-sand"
                            value={formatSummaryDuration(grossSeconds)}
                            label="Toplam Süre"
                            color={serviceBlue}
                            sub="Mola dahil"
                            isDark={isDark}
                        />
                        <StatTile
                            icon="coffee-outline"
                            value={formatSummaryDuration(breakSeconds)}
                            label="Mola"
                            color={serviceOrange}
                            sub={isOnBreak ? 'Mola sürüyor' : 'Toplam'}
                            isDark={isDark}
                        />
                        <StatTile
                            icon="check-decagram-outline"
                            value={formatSummaryDuration(netSeconds)}
                            label="Net Süre"
                            color={serviceGreen}
                            sub="Çalışma"
                            isDark={isDark}
                        />
                        <StatTile
                            icon="target"
                            value={`%${targetPercent}`}
                            label="Hedef"
                            color="#8B5CF6"
                            sub="8 saat"
                            isDark={isDark}
                        />
                    </View>
                ) : null}

                {/* Action area */}
                <View
                    style={[
                        styles.actionCard,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                >
                    {loading ? (
                        <View style={styles.loadingWrap}>
                            <ActivityIndicator color={colors.primary} size="large" />
                            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                                Mesai bilgisi yükleniyor...
                            </Text>
                        </View>
                    ) : (
                        <>
                            <View style={styles.actionHeader}>
                                <View
                                    style={[
                                        styles.actionHeaderIcon,
                                        { backgroundColor: `${STATE_META.color}18` },
                                    ]}
                                >
                                    <MaterialCommunityIcons
                                        name={STATE_META.icon}
                                        size={20}
                                        color={STATE_META.color}
                                    />
                                </View>
                                <View style={styles.actionHeaderText}>
                                    <Text style={[styles.actionHeaderTitle, { color: colors.text }]}>
                                        {primaryActionLabel}
                                    </Text>
                                    <Text style={[styles.actionHeaderSub, { color: colors.textSecondary }]}>
                                        {isToday
                                            ? STATE_META.sub
                                            : 'Yalnızca bugün için mesai başlatılabilir'}
                                    </Text>
                                </View>
                            </View>

                            <Pressable
                                onPress={handlePrimaryAction}
                                disabled={saving}
                                style={({ pressed }) => [
                                    styles.primaryButton,
                                    {
                                        backgroundColor: !isToday
                                            ? serviceOrange
                                            : isOnBreak
                                                ? serviceOrange
                                                : hasActiveShift
                                                    ? serviceBlue
                                                    : hasCompletedShift
                                                        ? serviceBlue
                                                        : serviceGreen,
                                        opacity: saving || pressed ? 0.85 : 1,
                                    },
                                ]}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <>
                                        <View
                                            style={[
                                                styles.primaryButtonIcon,
                                                { backgroundColor: 'rgba(255,255,255,0.22)' },
                                            ]}
                                        >
                                            <MaterialCommunityIcons
                                                name={!isToday ? 'calendar-today' : primaryActionIcon}
                                                size={18}
                                                color="#FFFFFF"
                                            />
                                        </View>
                                        <Text style={styles.primaryButtonText}>
                                            {!isToday ? 'Bugüne Dön' : primaryActionLabel}
                                        </Text>
                                        <View
                                            style={[
                                                styles.primaryButtonIcon,
                                                { backgroundColor: 'rgba(255,255,255,0.0)', opacity: 0 },
                                            ]}
                                        />
                                    </>
                                )}
                            </Pressable>

                            {hasOpenShift ? (
                                <Pressable
                                    onPress={handleEndShift}
                                    disabled={saving}
                                    style={({ pressed }) => [
                                        styles.secondaryButton,
                                        {
                                            borderColor: `${serviceRed}30`,
                                            backgroundColor: pressed
                                                ? `${serviceRed}15`
                                                : `${serviceRed}10`,
                                            opacity: saving ? 0.75 : 1,
                                        },
                                    ]}
                                >
                                    <MaterialCommunityIcons
                                        name="stop-circle-outline"
                                        size={18}
                                        color={serviceRed}
                                    />
                                    <Text style={[styles.secondaryButtonText, { color: serviceRed }]}>
                                        Günü Bitir
                                    </Text>
                                </Pressable>
                            ) : null}
                        </>
                    )}
                </View>

                {/* Timeline section */}
                {!loading && timelineRows.length > 0 ? (
                    <View style={styles.timelineSection}>
                        <View style={styles.timelineHeader}>
                            <Text style={[styles.timelineSectionTitle, { color: colors.text }]}>
                                Mesai Detayları
                            </Text>
                            <Text style={[styles.timelineSectionHint, { color: colors.textTertiary }]}>
                                {timelineRows.length} kayıt
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.timelineCard,
                                { backgroundColor: colors.surface, borderColor: colors.border },
                            ]}
                        >
                            {timelineRows.map((row, index) => (
                                <View key={row.key} style={styles.timelineRow}>
                                    <View style={styles.timelineIconColumn}>
                                        <View
                                            style={[
                                                styles.timelineIconWrap,
                                                { backgroundColor: `${row.color}15`, borderColor: `${row.color}40` },
                                            ]}
                                        >
                                            <MaterialCommunityIcons
                                                name={row.icon}
                                                size={16}
                                                color={row.color}
                                            />
                                        </View>
                                        {index < timelineRows.length - 1 ? (
                                            <View
                                                style={[
                                                    styles.timelineLine,
                                                    { backgroundColor: colors.divider },
                                                ]}
                                            />
                                        ) : null}
                                    </View>
                                    <View style={styles.timelineContent}>
                                        <View style={styles.timelineTopRow}>
                                            <Text style={[styles.timelineTitle, { color: colors.text }]}>
                                                {row.title}
                                            </Text>
                                            <Text style={[styles.timelineTime, { color: row.color }]}>
                                                {row.time}
                                            </Text>
                                        </View>
                                        <Text style={[styles.timelineDescription, { color: colors.textSecondary }]}>
                                            {row.description}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}
            </ScrollView>
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
        paddingBottom: 14,
        gap: 10,
    },
    headerBtn: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    headerTitleBlock: { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.2 },
    headerSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
    container: { paddingHorizontal: 16 },

    // Hero card
    heroCard: {
        borderRadius: 24,
        paddingTop: 18,
        paddingBottom: 18,
        paddingHorizontal: 16,
        marginBottom: 14,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 22,
        elevation: 10,
        overflow: 'hidden',
        zIndex: 2,
    },
    heroOrb: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
    },
    statusPill: {
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.18)',
        marginBottom: 12,
    },
    statusPillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
    statusPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
    ringWrap: {
        height: 240,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ring: { position: 'absolute' },
    ringContent: { alignItems: 'center', justifyContent: 'center' },
    ringLabel: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    ringTimer: {
        color: '#FFFFFF',
        fontSize: 38,
        fontWeight: '900',
        marginTop: 8,
        letterSpacing: -0.5,
        fontVariant: ['tabular-nums'],
    },
    ringSubRow: { flexDirection: 'row', marginTop: 8 },
    targetPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    targetPillText: {
        color: 'rgba(255,255,255,0.95)',
        fontSize: 11,
        fontWeight: '800',
    },
    heroStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.18)',
    },
    heroStatusItem: { flex: 1, alignItems: 'center', gap: 2 },
    heroStatusDivider: {
        width: 1,
        height: 32,
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    heroStatusLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginTop: 2,
    },
    heroStatusValue: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '900',
        fontVariant: ['tabular-nums'],
    },

    // Date navigator
    dateNavigator: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 18,
        paddingVertical: 8,
        paddingHorizontal: 8,
        marginBottom: 12,
    },
    dateButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 8,
    },
    dateIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateTextBlock: { flex: 1 },
    dateTitle: { fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },
    dateHint: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 1 },

    // Stats grid
    statGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    statTile: {
        flexBasis: '48%',
        flexGrow: 1,
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    statIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    statValue: { fontSize: 17, fontWeight: '900', letterSpacing: -0.2 },
    statLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#5C6370',
        marginTop: 1,
        letterSpacing: 0.2,
    },
    statSub: { fontSize: 10, fontWeight: '600', color: '#8590A0', marginTop: 1 },

    // Action card
    actionCard: {
        borderWidth: 1,
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
    },
    loadingWrap: {
        minHeight: 200,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    loadingText: { fontSize: 13, fontWeight: '600' },
    actionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    actionHeaderIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionHeaderText: { flex: 1 },
    actionHeaderTitle: { fontSize: 15, fontWeight: '900' },
    actionHeaderSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
    primaryButton: {
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
    },
    primaryButtonIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    secondaryButton: {
        height: 48,
        borderRadius: 14,
        borderWidth: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 10,
    },
    secondaryButtonText: { fontSize: 14, fontWeight: '900' },

    // Timeline
    timelineSection: { marginTop: 4 },
    timelineHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    timelineSectionTitle: { fontSize: 16, fontWeight: '900' },
    timelineSectionHint: { fontSize: 11, fontWeight: '700' },
    timelineCard: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 12,
    },
    timelineRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 6,
    },
    timelineIconColumn: { alignItems: 'center', marginRight: 12 },
    timelineIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    timelineLine: { width: 2, flex: 1, marginTop: 4, minHeight: 12 },
    timelineContent: { flex: 1, paddingBottom: 4 },
    timelineTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
        gap: 8,
    },
    timelineTitle: { fontSize: 13, fontWeight: '800', flex: 1 },
    timelineTime: { fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
    timelineDescription: { fontSize: 11, fontWeight: '500', lineHeight: 16 },
});
