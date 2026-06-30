import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

dayjs.locale('tr');

const renderBackdrop = (props) => (
    <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.55}
        pressBehavior="close"
    />
);

const PICKER_SNAP_POINTS = ['80%'];

const MONTH_NAMES = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const DAY_HEADS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

// Pazartesi'yi haftanın ilk günü kabul eden Türkçe grid üretir.
const buildMonthGrid = (anchorDate) => {
    const firstOfMonth = dayjs(anchorDate).startOf('month');
    const daysInMonth = firstOfMonth.daysInMonth();
    // dayjs().day(): 0=Pazar, 1=Pazartesi ... 6=Cumartesi
    // Pazartesi'yi 0'a kaydırıyoruz: (day + 6) % 7
    const firstWeekday = (firstOfMonth.day() + 6) % 7;

    const cells = [];
    // Önceki aydan dolgu (görsel olarak)
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
    // 7'li satırlara tamamla
    while (cells.length % 7 !== 0) {
        cells.push({ key: `next-${cells.length}`, date: null });
    }
    return cells;
};

const CustomCalendar = ({ value, onSelect, minDate, maxDate, markedDates = new Set(), onMonthChange, loading }) => {
    const { colors, isDark } = useTheme();
    const [viewMonth, setViewMonth] = useState(() => dayjs(value));

    const monthLabel = `${MONTH_NAMES[viewMonth.month()]} ${viewMonth.year()}`;
    const today = dayjs();
    const selectedKey = dayjs(value).format('YYYY-MM-DD');

    const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

    const handlePrevMonth = useCallback(() => {
        setViewMonth((m) => {
            const next = m.subtract(1, 'month');
            onMonthChange?.(next.toDate());
            return next;
        });
    }, [onMonthChange]);

    const handleNextMonth = useCallback(() => {
        setViewMonth((m) => {
            const next = m.add(1, 'month');
            onMonthChange?.(next.toDate());
            return next;
        });
    }, [onMonthChange]);

    const handleToday = useCallback(() => {
        const t = dayjs();
        setViewMonth(t);
        onSelect(t.toDate());
    }, [onSelect]);

    const isDateDisabled = useCallback(
        (date) => {
            if (!date) return true;
            if (minDate && date.isBefore(dayjs(minDate).startOf('day'))) return true;
            if (maxDate && date.isAfter(dayjs(maxDate).endOf('day'))) return true;
            return false;
        },
        [minDate, maxDate]
    );

    return (
        <View style={{paddingBottom:40}}>
            {/* Ay başlığı + navigasyon */}
            <View style={calStyles.headerRow}>
                <Pressable
                    onPress={handlePrevMonth}
                    android_ripple={{ color: `${colors.primary}10`, borderless: true, radius: 20 }}
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

                <View style={[calStyles.monthLabelWrap, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={[calStyles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
                    {loading && (
                        <View style={{ marginLeft: 8 }}>
                            <ActivityIndicator size="small" color={colors.primary} />
                        </View>
                    )}
                </View>

                <Pressable
                    onPress={handleNextMonth}
                    android_ripple={{ color: `${colors.primary}10`, borderless: true, radius: 20 }}
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

            {/* Bugün kısayolu */}
            <Pressable
                onPress={handleToday}
                style={({ pressed }) => [
                    calStyles.todayPill,
                    {
                        backgroundColor: isDark
                            ? `${colors.primary}26`
                            : `${colors.primary}14`,
                        borderColor: isDark
                            ? `${colors.primary}55`
                            : `${colors.primary}30`,
                        opacity: pressed ? 0.7 : 1,
                    },
                ]}
            >
                <MaterialCommunityIcons name="calendar-today" size={13} color={colors.primary} />
                <Text style={[calStyles.todayPillText, { color: colors.primary }]}>Bugün</Text>
            </Pressable>

            {/* Gün başlıkları */}
            <View style={calStyles.dayHeadsRow}>
                {DAY_HEADS.map((d) => (
                    <View key={d} style={calStyles.dayHeadCell}>
                        <Text
                            style={[
                                calStyles.dayHeadText,
                                {
                                    color: isDark ? '#9BA2AF' : colors.textTertiary,
                                },
                            ]}
                        >
                            {d}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Takvim grid */}
            <View style={calStyles.grid}>
                {grid.map((cell) => {
                    if (!cell.date) {
                        return <View key={cell.key} style={calStyles.cell} />;
                    }
                    const isSelected = cell.key === selectedKey;
                    const isToday = cell.key === today.format('YYYY-MM-DD');
                    const disabled = isDateDisabled(cell.date);
                    const isWeekend = cell.date.day() === 0 || cell.date.day() === 6;
                    const hasService = markedDates.has(cell.key) && !isSelected;

                    return (
                        <Pressable
                            key={cell.key}
                            disabled={disabled}
                            onPress={() => onSelect(cell.date.toDate())}
                            android_ripple={{
                                color: `${colors.primary}14`,
                                borderless: false,
                                radius: 18,
                            }}
                            style={({ pressed }) => [
                                calStyles.cell,
                                isSelected && {
                                    backgroundColor: colors.primary,
                                },
                                !isSelected && isToday && {
                                    borderColor: colors.primary,
                                    borderWidth: 1,
                                },
                                pressed && !disabled && !isSelected && {
                                    backgroundColor: isDark
                                        ? 'rgba(255,255,255,0.06)'
                                        : 'rgba(0,0,0,0.04)',
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    calStyles.cellText,
                                    {
                                        color: disabled
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
                            {hasService ? (
                                <View
                                    style={[
                                        calStyles.serviceDot,
                                        { backgroundColor: colors.primary },
                                    ]}
                                />
                            ) : isToday && !isSelected ? (
                                <View
                                    style={[
                                        calStyles.todayDot,
                                        { backgroundColor: colors.primary },
                                    ]}
                                />
                            ) : null}
                        </Pressable>
                    );
                })}
            </View>
        </View>
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
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    monthLabelWrap: {
        flex: 1,
        alignItems: 'center',
    },
    monthLabel: {
        ...typography.h3,
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.2,
        textTransform: 'capitalize',
    },
    todayPill: {
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        marginBottom: spacing.m,
    },
    todayPillText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.1,
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
    todayDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        position: 'absolute',
        bottom: 6,
    },
    serviceDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        position: 'absolute',
        bottom: 5,
    },
});

export default function ServiceDateFilter({ selectedDate, onDateChange, serviceCount = 0, markedDates = new Set(), onMonthChange, loading }) {
    const { colors, isDark } = useTheme();
    const pickerRef = useRef(null);

    const isToday = dayjs(selectedDate).isSame(dayjs(), 'day');

    const handlePrev = useCallback(() => {
        onDateChange(dayjs(selectedDate).subtract(1, 'day').toDate());
    }, [selectedDate, onDateChange]);

    const handleNext = useCallback(() => {
        onDateChange(dayjs(selectedDate).add(1, 'day').toDate());
    }, [selectedDate, onDateChange]);

    const handleToday = useCallback(() => {
        onDateChange(new Date());
    }, [onDateChange]);

    const handleOpenPicker = useCallback(() => {
        pickerRef.current?.present();
    }, []);

    const handleSheetChange = useCallback((index) => {
        // Sheet kapandığında ekstra state sıfırlamaya gerek yok (custom calendar her açılışta mevcut value'dan başlıyor).
    }, []);

    const formattedDate = useMemo(
        () => ({
            full: dayjs(selectedDate).format('DD MMMM YYYY'),
            day: dayjs(selectedDate).format('dddd'),
        }),
        [selectedDate]
    );

    return (
        <View style={styles.wrapper}>
            {/* Başlık satırı */}
            <View style={styles.titleRow}>
                <View style={styles.titleBlock}>
                    <Text style={[styles.title, { color: colors.text }]}>Günlük Servisler</Text>
                    <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                        {serviceCount} kayıt · {formattedDate.day}
                    </Text>
                </View>
                {!isToday ? (
                    <Pressable
                        onPress={handleToday}
                        style={[
                            styles.todayButton,
                            {
                                backgroundColor: isDark
                                    ? 'rgba(255,255,255,0.06)'
                                    : '#F3F6FB',
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="calendar-today"
                            size={14}
                            color={colors.textSecondary}
                        />
                        <Text style={[styles.todayButtonText, { color: colors.textSecondary }]}>
                            Bugün
                        </Text>
                    </Pressable>
                ) : null}
            </View>

            {/* Tarih navigasyonu: [‹]  [Tarih – açılır]  [›] */}
            <View style={styles.navRow}>
                <Pressable
                    onPress={handlePrev}
                    android_ripple={{ color: `${colors.primary}10`, borderless: true, radius: 22 }}
                    style={({ pressed }) => [
                        styles.navButton,
                        {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                            opacity: pressed ? 0.7 : 1,
                        },
                    ]}
                >
                    <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
                </Pressable>

                <Pressable
                    onPress={handleOpenPicker}
                    android_ripple={{ color: `${colors.primary}10`, borderless: false }}
                    style={({ pressed }) => [
                        styles.dateDisplay,
                        {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                            borderColor: isToday
                                ? `${colors.primary}40`
                                : isDark
                                    ? 'rgba(255,255,255,0.08)'
                                    : 'rgba(0,0,0,0.06)',
                            opacity: pressed ? 0.92 : 1,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="calendar-month"
                        size={18}
                        color={isToday ? colors.primary : colors.textSecondary}
                    />
                    <View style={styles.dateTextWrap}>
                        <Text
                            style={[styles.dateFull, { color: colors.text }]}
                            numberOfLines={1}
                        >
                            {formattedDate.full}
                        </Text>
                        <Text
                            style={[
                                styles.dateDay,
                                {
                                    color: isToday ? colors.primary : colors.textTertiary,
                                },
                            ]}
                            numberOfLines={1}
                        >
                            {isToday ? 'Bugün' : formattedDate.day}
                        </Text>
                    </View>
                    <MaterialCommunityIcons
                        name="chevron-down"
                        size={18}
                        color={colors.textTertiary}
                    />
                </Pressable>

                <Pressable
                    onPress={handleNext}
                    android_ripple={{ color: `${colors.primary}10`, borderless: true, radius: 22 }}
                    style={({ pressed }) => [
                        styles.navButton,
                        {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                            opacity: pressed ? 0.7 : 1,
                        },
                    ]}
                >
                    <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
                </Pressable>
            </View>

            {/* Bottom sheet – custom takvim */}
            <BottomSheetModal
                ref={pickerRef}
                index={0}
                snapPoints={PICKER_SNAP_POINTS}
                backdropComponent={renderBackdrop}
                handleComponent={null}
                enablePanDownToClose
                onChange={handleSheetChange}
                backgroundStyle={{
                    backgroundColor: isDark ? colors.surface : '#FFFFFF',
                }}
            >
                <BottomSheetView
                    style={[
                        styles.sheetContainer,
                        { backgroundColor: isDark ? colors.surface : '#FFFFFF' },
                    ]}
                >
                    <View
                        style={[
                            styles.handle,
                            {
                                backgroundColor: isDark
                                    ? 'rgba(255,255,255,0.28)'
                                    : 'rgba(0,0,0,0.18)',
                            },
                        ]}
                    />

                    <View style={styles.sheetHeader}>
                        <Text style={[styles.sheetTitle, { color: colors.text }]}>Tarih Seçin</Text>
                        <Pressable
                            onPress={() => pickerRef.current?.dismiss()}
                            style={[
                                styles.sheetClose,
                                {
                                    backgroundColor: isDark
                                        ? 'rgba(255,255,255,0.06)'
                                        : '#F1F4F9',
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

                    <CustomCalendar
                        value={selectedDate}
                        onSelect={(date) => {
                            onDateChange(date);
                            pickerRef.current?.dismiss();
                        }}
                        minDate={dayjs().subtract(5, 'year').toDate()}
                        maxDate={dayjs().add(2, 'year').toDate()}
                        markedDates={markedDates}
                        onMonthChange={onMonthChange}
                        loading={loading}
                    />
                </BottomSheetView>
            </BottomSheetModal>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: spacing.m,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.gutter,
        marginBottom: spacing.m,
    },
    titleBlock: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        ...typography.h3,
        fontSize: 18,
        letterSpacing: -0.2,
    },
    subtitle: {
        ...typography.caption,
        marginTop: 3,
    },
    todayButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
    },
    todayButtonText: {
        fontSize: 12,
        fontWeight: '600',
    },
    navRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
        paddingHorizontal: spacing.gutter,
    },
    navButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateDisplay: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
        paddingHorizontal: spacing.m,
        paddingVertical: 8,
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
    },
    dateTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    dateFull: {
        ...typography.body,
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    dateDay: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
        textTransform: 'capitalize',
    },
    sheetContainer: {
        flex: 1,
        paddingHorizontal: spacing.gutter,
        paddingBottom: spacing.l,
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(0,0,0,0.15)',
        marginTop: spacing.s,
        marginBottom: spacing.m,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.m,
    },
    sheetTitle: {
        ...typography.h3,
        fontSize: 18,
        letterSpacing: -0.2,
    },
    sheetClose: {
        width: 34,
        height: 34,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
});