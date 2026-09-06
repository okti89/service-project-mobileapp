import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import AppBottomSheet from '@/components/AppBottomSheet';

dayjs.locale('tr');

const MONTH_NAMES = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
const DAY_HEADS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const TIME_SLOTS = (() => {
    const out = [];
    for (let h = 8; h <= 20; h++) {
        out.push(`${String(h).padStart(2, '0')}:00`);
        if (h !== 20) {
            out.push(`${String(h).padStart(2, '0')}:30`);
        }
    }
    return out;
})();

const buildMonthGrid = (anchorDate) => {
    const firstOfMonth = dayjs(anchorDate).startOf('month');
    const daysInMonth = firstOfMonth.daysInMonth();
    const firstWeekday = (firstOfMonth.day() + 6) % 7;

    const cells = [];
    for (let i = 0; i < firstWeekday; i++) {
        cells.push({ key: `prev-${i}`, date: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const cellDate = firstOfMonth.date(d);
        cells.push({
            key: cellDate.format('YYYY-MM-DD'),
            date: cellDate,
            day: d,
        });
    }
    while (cells.length % 7 !== 0) {
        cells.push({ key: `next-${cells.length}`, date: null });
    }
    return cells;
};

const CustomCalendar = ({ value, onSelect }) => {
    const { colors, isDark } = useTheme();
    const [viewMonth, setViewMonth] = useState(() => dayjs(value));

    const monthLabel = `${MONTH_NAMES[viewMonth.month()]} ${viewMonth.year()}`;
    const today = dayjs();
    const selectedKey = dayjs(value).format('YYYY-MM-DD');

    const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

    const handlePrevMonth = useCallback(() => {
        setViewMonth((m) => m.subtract(1, 'month'));
    }, []);

    const handleNextMonth = useCallback(() => {
        setViewMonth((m) => m.add(1, 'month'));
    }, []);

    return (
        <View>
            <View style={calStyles.headerRow}>
                <Pressable
                    onPress={handlePrevMonth}
                    style={({ pressed }) => [
                        calStyles.navBtn,
                        {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F4F9',
                            opacity: pressed ? 0.7 : 1,
                        },
                    ]}
                >
                    <MaterialCommunityIcons name="chevron-left" size={20} color={colors.text} />
                </Pressable>
                <View style={calStyles.monthLabelWrap}>
                    <Text style={[calStyles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
                </View>
                <Pressable
                    onPress={handleNextMonth}
                    style={({ pressed }) => [
                        calStyles.navBtn,
                        {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F4F9',
                            opacity: pressed ? 0.7 : 1,
                        },
                    ]}
                >
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text} />
                </Pressable>
            </View>

            <View style={calStyles.dayHeadsRow}>
                {DAY_HEADS.map((d) => (
                    <View key={d} style={calStyles.dayHeadCell}>
                        <Text
                            style={[
                                calStyles.dayHeadText,
                                { color: isDark ? '#9BA2AF' : colors.textTertiary },
                            ]}
                        >
                            {d}
                        </Text>
                    </View>
                ))}
            </View>

            <View style={calStyles.grid}>
                {grid.map((cell) => {
                    if (!cell.date) {
                        return <View key={cell.key} style={calStyles.cell} />;
                    }
                    const isSelected = cell.key === selectedKey;
                    const isToday = cell.key === today.format('YYYY-MM-DD');
                    const isPast = cell.date.isBefore(today, 'day');
                    const isWeekend = cell.date.day() === 0 || cell.date.day() === 6;

                    return (
                        <Pressable
                            key={cell.key}
                            disabled={isPast}
                            onPress={() => onSelect(cell.date.toDate())}
                            style={({ pressed }) => [
                                calStyles.cell,
                                isSelected && { backgroundColor: colors.primary },
                                !isSelected && isToday && {
                                    borderColor: colors.primary,
                                    borderWidth: 1,
                                },
                                pressed && !isPast && !isSelected && {
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    calStyles.cellText,
                                    {
                                        color: isPast
                                            ? (isDark ? 'rgba(184,189,198,0.35)' : 'rgba(28,28,46,0.25)')
                                            : isSelected
                                                ? '#FFFFFF'
                                                : isWeekend
                                                    ? (isDark ? '#8B93A1' : '#6B7280')
                                                    : colors.text,
                                        fontWeight: isSelected || isToday ? '700' : '500',
                                    },
                                ]}
                            >
                                {cell.day}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
};

const DateTimePickerSheet = ({ visible, value, onChange, onClose, dateOnly = false }) => {
    const { colors, isDark } = useTheme();
    const [step, setStep] = useState(1);
    const [tempDate, setTempDate] = useState(value || new Date());
    const [selectedTime, setSelectedTime] = useState(() =>
        value ? dayjs(value).format('HH:mm') : '10:00'
    );
    const [customTime, setCustomTime] = useState(() =>
        value ? dayjs(value).format('HH:mm') : ''
    );
    const [customTimeError, setCustomTimeError] = useState(false);

    useEffect(() => {
        if (visible) {
            const v = value || new Date();
            const t = dayjs(v).format('HH:mm');
            setTempDate(v);
            setSelectedTime(t);
            setCustomTime(t);
            setCustomTimeError(false);
            setStep(1);
        }
    }, [visible, value]);

    const handleDateSelect = useCallback((date) => {
        setTempDate(date);
    }, []);

    const handleCustomTimeChange = useCallback((text) => {
        const digits = String(text || '').replace(/\D/g, '').slice(0, 4);
        let formatted = digits;
        if (digits.length >= 3) {
            formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`;
        }
        setCustomTime(formatted);

        if (/^\d{2}:\d{2}$/.test(formatted)) {
            const [h, m] = formatted.split(':').map(Number);
            if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
                setSelectedTime(formatted);
                setCustomTimeError(false);
            } else {
                setCustomTimeError(true);
            }
        } else if (formatted.length === 5) {
            setCustomTimeError(true);
        } else {
            setCustomTimeError(false);
        }
    }, []);

    const handleConfirm = useCallback(() => {
        const [h, m] = (dateOnly ? '00:00' : selectedTime || '10:00').split(':').map(Number);
        const next = new Date(tempDate);
        next.setHours(h || 0, m || 0, 0, 0);
        onChange?.(next);
        onClose?.();
    }, [tempDate, selectedTime, onChange, onClose, dateOnly]);

    const cardBg = isDark ? colors.surface : '#FFFFFF';
    const rowBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15, 23, 42, 0.035)';
    const rowActive = colors.primary;
    const secondaryText = isDark ? '#9BA2AF' : '#6B7280';
    const sectionLabel = isDark ? '#7A8290' : '#9CA3AF';

    return (
        <AppBottomSheet
            visible={visible}
            onClose={onClose}
            snapPoints={[dateOnly ? '76%' : '92%']}
            wrapContent={false}
            keyboardBehavior="extend"
        >
            <View style={[styles.sheetInner, { backgroundColor: cardBg }]}>
                <View style={styles.headerRow}>
                    {!dateOnly && step === 2 && (
                        <Pressable
                            onPress={() => setStep(1)}
                            hitSlop={10}
                            style={({ pressed }) => [
                                styles.backBtn,
                                {
                                    backgroundColor: isDark
                                        ? 'rgba(255,255,255,0.06)'
                                        : '#F1F4F9',
                                    opacity: pressed ? 0.7 : 1,
                                },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name="chevron-left"
                                size={20}
                                color={colors.text}
                            />
                        </Pressable>
                    )}
                    <View style={styles.headerInfo}>
                        <View style={styles.stepBadgeRow}>
                            <Text style={[styles.stepBadge, { color: colors.primary }]}>
                                {dateOnly ? 'TARİH' : `ADIM ${step}/2`}
                            </Text>
                        </View>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>
                            {step === 1 ? 'Tarih Seçin' : 'Saat Seçin'}
                        </Text>
                        <Text style={[styles.headerSubtitle, { color: secondaryText }]}>
                            {dayjs(tempDate).format('DD MMMM YYYY')}
                            {!dateOnly && step === 2 ? ` · ${selectedTime}` : ''}
                        </Text>
                    </View>
                    <Pressable
                        onPress={onClose}
                        hitSlop={10}
                        style={({ pressed }) => [
                            styles.closeBtn,
                            {
                                backgroundColor: isDark
                                    ? 'rgba(255,255,255,0.06)'
                                    : '#F1F4F9',
                                opacity: pressed ? 0.7 : 1,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="close"
                            size={18}
                            color={colors.textSecondary}
                        />
                    </Pressable>
                </View>

                <BottomSheetScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {step === 1 ? (
                        <>
                            <Text style={[styles.sectionLabel, { color: sectionLabel }]}>TARİH</Text>
                            <View style={[styles.calendarWrap, { backgroundColor: rowBg }]}>
                                <CustomCalendar value={tempDate} onSelect={handleDateSelect} />
                            </View>
                        </>
                    ) : (
                        <>
                            <Text style={[styles.sectionLabel, { color: sectionLabel }]}>SAAT</Text>
                            <View style={styles.timeGrid}>
                                {TIME_SLOTS.map((slot) => {
                                    const active = slot === selectedTime;
                                    return (
                                        <Pressable
                                            key={slot}
                                            onPress={() => {
                                                setSelectedTime(slot);
                                                setCustomTime(slot);
                                                setCustomTimeError(false);
                                            }}
                                            style={({ pressed }) => [
                                                styles.timeSlot,
                                                {
                                                    backgroundColor: active
                                                        ? rowActive
                                                        : (isDark
                                                            ? 'rgba(255,255,255,0.04)'
                                                            : 'rgba(15, 23, 42, 0.035)'),
                                                    borderColor: active
                                                        ? rowActive
                                                        : (isDark
                                                            ? 'rgba(255,255,255,0.07)'
                                                            : 'rgba(15, 23, 42, 0.05)'),
                                                    opacity: pressed ? 0.85 : 1,
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.timeSlotText,
                                                    {
                                                        color: active ? '#FFFFFF' : colors.text,
                                                        fontWeight: active ? '700' : '500',
                                                    },
                                                ]}
                                            >
                                                {slot}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <View style={styles.dividerRow}>
                                <View style={[styles.dividerLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15, 23, 42, 0.08)' }]} />
                                <Text style={[styles.dividerText, { color: sectionLabel }]}>VEYA</Text>
                                <View style={[styles.dividerLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15, 23, 42, 0.08)' }]} />
                            </View>

                            <Text style={[styles.sectionLabel, { color: sectionLabel }]}>ÖZEL SAAT</Text>
                            <View
                                style={[
                                    styles.customTimeWrap,
                                    {
                                        backgroundColor: rowBg,
                                        borderColor: customTimeError
                                            ? '#EF4444'
                                            : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15, 23, 42, 0.05)'),
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name="clock-edit-outline"
                                    size={18}
                                    color={customTimeError ? '#EF4444' : colors.primary}
                                />
                                <TextInput
                                    value={customTime}
                                    onChangeText={handleCustomTimeChange}
                                    placeholder="14:30"
                                    placeholderTextColor={colors.textTertiary}
                                    keyboardType="number-pad"
                                    maxLength={5}
                                    style={[
                                        styles.customTimeInput,
                                        { color: customTimeError ? '#EF4444' : colors.text },
                                    ]}
                                />
                                {customTime.length === 5 && !customTimeError && (
                                    <MaterialCommunityIcons
                                        name="check-circle"
                                        size={18}
                                        color={colors.primary}
                                    />
                                )}
                            </View>
                            {customTimeError ? (
                                <Text style={styles.customTimeHint}>
                                    Geçerli bir saat girin (00:00 - 23:59)
                                </Text>
                            ) : (
                                <Text style={[styles.customTimeHint, { color: sectionLabel }]}>
                                    Listede olmayan bir saat için manuel giriş yapabilirsiniz
                                </Text>
                            )}
                        </>
                    )}
                    <Pressable
                        onPress={dateOnly || step === 2 ? handleConfirm : () => setStep(2)}
                        style={({ pressed }) => [
                            styles.confirmButton,
                            {
                                backgroundColor: colors.primary,
                                opacity: pressed ? 0.85 : 1,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name={dateOnly || step === 2 ? 'check' : 'arrow-right'}
                            size={18}
                            color="#FFFFFF"
                        />
                        <Text style={styles.confirmText}>
                            {dateOnly
                                ? `${dayjs(tempDate).format('DD MMM YYYY')} tarihini seç`
                                : step === 1
                                ? `Devam · ${dayjs(tempDate).format('DD MMM YYYY')}`
                                : `${dayjs(tempDate).format('DD MMM YYYY')} · ${selectedTime} olarak ayarla`}
                        </Text>
                    </Pressable>

                </BottomSheetScrollView>

            </View>
        </AppBottomSheet>
    );
};

const calStyles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.m,
    },
    navBtn: {
        width: 36,
        height: 36,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    monthLabelWrap: {
        flex: 1,
        alignItems: 'center',
    },
    monthLabel: {
        ...typography.h3,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.2,
        textTransform: 'capitalize',
    },
    dayHeadsRow: {
        flexDirection: 'row',
        marginBottom: spacing.s,
    },
    dayHeadCell: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    dayHeadText: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    cell: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        paddingVertical: spacing.s,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    cellText: {
        fontSize: 14,
        letterSpacing: -0.1,
    },
});

const styles = StyleSheet.create({
    sheetInner: {
        flex: 1,
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.s,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
        marginBottom: spacing.m,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepBadgeRow: {
        marginBottom: 4,
    },
    stepBadge: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.5,
    },
    headerInfo: {
        flex: 1,
        minWidth: 0,
    },
    headerTitle: {
        ...typography.h3,
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 3,
        letterSpacing: -0.1,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollView: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    scrollContent: {
        paddingBottom: spacing.l,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: spacing.s,
    },
    calendarWrap: {
        padding: spacing.m,
        borderRadius: 16,
        marginBottom: spacing.m,
    },
    timeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    timeSlot: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        minWidth: 70,
        alignItems: 'center',
    },
    timeSlotText: {
        fontSize: 13,
        letterSpacing: -0.1,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: spacing.l,
        marginBottom: spacing.m,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.5,
    },
    customTimeWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
    },
    customTimeInput: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.2,
        padding: 0,
    },
    customTimeHint: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 6,
        marginLeft: 4,
        color: '#EF4444',
    },
    confirmButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 14,
        marginTop: spacing.s,
        marginBottom: spacing.m,
    },
    confirmText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
});

export default DateTimePickerSheet;
