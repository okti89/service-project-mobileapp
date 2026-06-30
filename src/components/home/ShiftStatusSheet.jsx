import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

dayjs.locale('tr');

const MONTH_NAMES = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const DAY_HEADS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const buildMonthGrid = (anchorDate) => {
    const firstOfMonth = dayjs(anchorDate).startOf('month');
    const daysInMonth = firstOfMonth.daysInMonth();
    const firstWeekday = (firstOfMonth.day() + 6) % 7;

    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) {
        cells.push({ key: `prev-${i}`, date: null });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        const cellDate = firstOfMonth.date(day);
        cells.push({
            key: cellDate.format('YYYY-MM-DD'),
            date: cellDate,
            day,
        });
    }
    while (cells.length % 7 !== 0) {
        cells.push({ key: `next-${cells.length}`, date: null });
    }
    return cells;
};

const ShiftCalendarPicker = ({
    selectedDate,
    activeMonth,
    onSelectDate,
    onMonthChange,
    markedDates,
}) => {
    const { colors, isDark } = useTheme();
    const monthLabel = `${MONTH_NAMES[activeMonth.month()]} ${activeMonth.year()}`;
    const selectedKey = dayjs(selectedDate).format('YYYY-MM-DD');
    const todayKey = dayjs().format('YYYY-MM-DD');
    const grid = useMemo(() => buildMonthGrid(activeMonth), [activeMonth]);

    return (
        <View style={styles.calendarWrap}>
            <View style={styles.calendarHeader}>
                <Pressable
                    onPress={() => onMonthChange(activeMonth.subtract(1, 'month'))}
                    style={({ pressed }) => [
                        styles.calendarNav,
                        {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F4F9',
                            opacity: pressed ? 0.7 : 1,
                        },
                    ]}
                >
                    <MaterialCommunityIcons name="chevron-left" size={20} color={colors.text} />
                </Pressable>

                <Text style={[styles.calendarMonthLabel, { color: colors.text }]}>{monthLabel}</Text>

                <Pressable
                    onPress={() => onMonthChange(activeMonth.add(1, 'month'))}
                    style={({ pressed }) => [
                        styles.calendarNav,
                        {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F4F9',
                            opacity: pressed ? 0.7 : 1,
                        },
                    ]}
                >
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text} />
                </Pressable>
            </View>

            <Pressable
                onPress={() => {
                    const today = dayjs();
                    onMonthChange(today);
                    onSelectDate(today);
                }}
                style={({ pressed }) => [
                    styles.todayPill,
                    {
                        backgroundColor: isDark ? `${colors.primary}24` : `${colors.primary}12`,
                        borderColor: isDark ? `${colors.primary}44` : `${colors.primary}24`,
                        opacity: pressed ? 0.75 : 1,
                    },
                ]}
            >
                <MaterialCommunityIcons name="calendar-today" size={13} color={colors.primary} />
                <Text style={[styles.todayPillText, { color: colors.primary }]}>Bugün</Text>
            </Pressable>

            <View style={styles.dayHeadsRow}>
                {DAY_HEADS.map((day) => (
                    <View key={day} style={styles.dayHeadCell}>
                        <Text style={[styles.dayHeadText, { color: isDark ? '#9BA2AF' : colors.textTertiary }]}>{day}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.grid}>
                {grid.map((cell) => {
                    if (!cell.date) {
                        return <View key={cell.key} style={styles.gridCell} />;
                    }

                    const dateKey = cell.date.format('YYYY-MM-DD');
                    const isSelected = dateKey === selectedKey;
                    const isToday = dateKey === todayKey;
                    const hasShift = markedDates.has(dateKey) && !isSelected;

                    return (
                        <Pressable
                            key={cell.key}
                            onPress={() => onSelectDate(cell.date)}
                            style={({ pressed }) => [
                                styles.gridCell,
                                isSelected && { backgroundColor: colors.primary },
                                !isSelected && isToday && { borderColor: colors.primary, borderWidth: 1 },
                                pressed && !isSelected && {
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.gridCellText,
                                    {
                                        color: isSelected ? '#FFFFFF' : colors.text,
                                        fontWeight: isSelected || isToday ? '700' : '500',
                                    },
                                ]}
                            >
                                {cell.day}
                            </Text>
                            {hasShift ? (
                                <View style={[styles.shiftDot, { backgroundColor: colors.primary }]} />
                            ) : isToday && !isSelected ? (
                                <View style={[styles.todayDot, { backgroundColor: colors.primary }]} />
                            ) : null}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
};

const ShiftStatusSheet = forwardRef(({
    shiftState,
    loading = false,
    actionLoading = false,
    onStart,
    onStop,
}, ref) => {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const sheetRef = useRef(null);
    const isOpen = useRef(false);
    const [selectedDate, setSelectedDate] = useState(() => dayjs());
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [activeMonth, setActiveMonth] = useState(() => dayjs().startOf('month'));

    useImperativeHandle(ref, () => ({
        present: () => sheetRef.current?.present(),
        dismiss: () => sheetRef.current?.dismiss(),
    }));

    useEffect(() => {
        const backAction = () => {
            if (isOpen.current) {
                sheetRef.current?.dismiss();
                return true;
            }
            return false;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => subscription.remove();
    }, []);

    const snapPoints = useMemo(() => ['88%'], []);
    const contentPaddingBottom = Math.max(insets.bottom + spacing.xl, spacing['3xl']);
    const secondaryText = isDark ? '#9BA2AF' : '#6B7280';
    const panelBg = isDark ? colors.surface : '#F8FAFC';
    const rowBg = isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF';
    const rowBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const warningBg = isDark ? 'rgba(245,158,11,0.14)' : '#FFF7ED';
    const warningBorder = isDark ? 'rgba(245,158,11,0.28)' : '#FDBA74';
    const progressValue = Math.max(0, Math.min(100, Number(shiftState?.completedPercentage || 0)));
    const shouldStopShift = Boolean(shiftState?.shouldStopShift);
    const primaryButtonLabel = shouldStopShift ? 'Mesaiyi Bitir' : 'Mesai Başlat';
    const primaryButtonAction = shouldStopShift ? onStop : onStart;
    const primaryButtonColor = shouldStopShift ? colors.error : colors.success;
    const markedDates = useMemo(() => new Set(shiftState?.markedShiftDates || []), [shiftState?.markedShiftDates]);

    useEffect(() => {
        if (!isOpen.current) {
            setSelectedDate(dayjs());
            setActiveMonth(dayjs().startOf('month'));
            setCalendarOpen(false);
        }
    }, [shiftState?.historyShifts]);

    const filteredHistory = useMemo(() => {
        const dateKey = selectedDate.format('YYYY-MM-DD');
        return (shiftState?.historyShifts || []).filter((item) => item.dateKey === dateKey);
    }, [selectedDate, shiftState?.historyShifts]);

    const selectedDateLabel = useMemo(() => {
        const current = selectedDate;
        if (current.isSame(dayjs(), 'day')) return 'Bugün';
        if (current.isSame(dayjs().subtract(1, 'day'), 'day')) return 'Dün';
        if (current.isSame(dayjs().add(1, 'day'), 'day')) return 'Yarın';
        return current.format('DD MMMM YYYY');
    }, [selectedDate]);

    const renderBackdrop = useCallback(
        (props) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                opacity={0.5}
                pressBehavior="close"
            />
        ),
        []
    );

    const shiftSelectedDate = useCallback((days) => {
        setSelectedDate((prev) => {
            const next = prev.add(days, 'day');
            setActiveMonth(next.startOf('month'));
            return next;
        });
    }, []);

    const handleSelectDate = useCallback((value) => {
        const next = dayjs(value);
        setSelectedDate(next);
        setActiveMonth(next.startOf('month'));
        setCalendarOpen(false);
    }, []);

    return (
        <BottomSheetModal
            ref={sheetRef}
            index={0}
            snapPoints={snapPoints}
            backdropComponent={renderBackdrop}
            handleComponent={null}
            enablePanDownToClose
            backgroundStyle={{
                backgroundColor: panelBg,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
            }}
            onChange={(index) => {
                isOpen.current = index !== -1;
            }}
        >
            <BottomSheetScrollView
                contentContainerStyle={[styles.container, { paddingBottom: contentPaddingBottom }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.24)' : 'rgba(15,23,42,0.16)' }]} />

                <View style={styles.headerRow}>
                    <View style={styles.headerTextWrap}>
                        <Text style={[styles.title, { color: colors.text }]}>Mesai Durumu</Text>
                        <Text style={[styles.subtitle, { color: secondaryText }]}>Bugünkü ilerleme ve geçmiş kayıtlar burada.</Text>
                    </View>
                    <Pressable
                        onPress={() => sheetRef.current?.dismiss()}
                        hitSlop={10}
                        android_ripple={{ color: `${colors.primary}1A`, borderless: true, radius: 18 }}
                        style={({ pressed }) => [
                            styles.closeBtn,
                            {
                                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EEF2F7',
                                opacity: pressed ? 0.75 : 1,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
                    </Pressable>
                </View>

                <View style={[styles.heroCard, { backgroundColor: rowBg, borderColor: rowBorder }]}>
                    <Text style={[styles.heroLabel, { color: secondaryText }]}>Durum</Text>
                    <View style={styles.heroTopRow}>
                        <Text style={[styles.heroStatus, { color: shiftState?.statusColor || colors.primary }]}>
                            {shiftState?.statusLabel || 'Mesai Dışı'}
                        </Text>
                        <Text style={[styles.heroPercent, { color: shiftState?.statusColor || colors.primary }]}>
                            {shiftState?.progressLabel || '%0 tamamlandı'}
                        </Text>
                    </View>
                    <Text style={[styles.heroCounter, { color: colors.text }]}>
                        {shiftState?.workedDurationLabel || '--:--:--'}
                    </Text>
                    <Text style={[styles.heroMeta, { color: secondaryText }]}>
                        {shiftState?.metaLabel || 'Bugün için mesai kaydı bulunmuyor.'}
                    </Text>

                    <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }]}>
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    width: `${progressValue}%`,
                                    backgroundColor: shiftState?.statusColor || colors.primary,
                                },
                            ]}
                        />
                    </View>

                    <View style={styles.metricRow}>
                        <View style={[styles.metricCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: rowBorder }]}>
                            <Text style={[styles.metricLabel, { color: secondaryText }]}>Hedef</Text>
                            <Text style={[styles.metricValue, { color: colors.text }]}>{shiftState?.targetDurationLabel || '--:--:--'}</Text>
                        </View>
                        <View style={[styles.metricCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: rowBorder }]}>
                            <Text style={[styles.metricLabel, { color: secondaryText }]}>{shiftState?.remainingLabel || 'Kalan süre'}</Text>
                            <Text style={[styles.metricValue, { color: colors.text }]}>{shiftState?.remainingDurationLabel || '--:--:--'}</Text>
                        </View>
                    </View>
                </View>

                {Array.isArray(shiftState?.warnings) && shiftState.warnings.length > 0 ? (
                    <View style={styles.warningList}>
                        {shiftState.warnings.map((warning, index) => (
                            <View
                                key={`${warning}-${index}`}
                                style={[styles.warningCard, { backgroundColor: warningBg, borderColor: warningBorder }]}
                            >
                                <MaterialCommunityIcons name="alert-outline" size={15} color="#F59E0B" />
                                <Text style={[styles.warningText, { color: colors.text }]}>{warning}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                <View style={styles.infoList}>
                    <View style={[styles.infoRow, { backgroundColor: rowBg, borderColor: rowBorder }]}>
                        <Text style={[styles.infoLabel, { color: secondaryText }]}>Bugünkü Mesai</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{shiftState?.todayScheduleLabel || 'Tanımlı değil'}</Text>
                    </View>
                    <View style={[styles.infoRow, { backgroundColor: rowBg, borderColor: rowBorder }]}>
                        <Text style={[styles.infoLabel, { color: secondaryText }]}>Başlangıç</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{shiftState?.startLabel || '--:--'}</Text>
                    </View>
                    <View style={[styles.infoRow, { backgroundColor: rowBg, borderColor: rowBorder }]}>
                        <Text style={[styles.infoLabel, { color: secondaryText }]}>Bitiş</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{shiftState?.endLabel || '--:--'}</Text>
                    </View>
                </View>

                <View style={styles.historySection}>
                    <View style={styles.historyHeader}>
                        <View>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Geçmiş Mesailer</Text>
                            <Text style={[styles.sectionCaption, { color: secondaryText }]}>Seçili günün mesai kayıtları</Text>
                        </View>
                    </View>

                    <View style={[styles.dateNavigator, { backgroundColor: rowBg, borderColor: rowBorder }]}>
                        <Pressable
                            onPress={() => shiftSelectedDate(-1)}
                            style={({ pressed }) => [
                                styles.dateArrow,
                                { backgroundColor: pressed ? `${colors.primary}14` : 'transparent' },
                            ]}
                        >
                            <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
                        </Pressable>

                        <Pressable
                            onPress={() => setCalendarOpen((prev) => !prev)}
                            style={({ pressed }) => [styles.dateContent, pressed && { opacity: 0.75 }]}
                        >
                            <View style={[styles.dateIconWrap, { backgroundColor: `${colors.primary}12` }]}>
                                <MaterialCommunityIcons name="calendar-month" size={16} color={colors.primary} />
                            </View>
                            <View style={styles.dateTextBlock}>
                                <Text style={[styles.dateRelative, { color: colors.primary }]}>{selectedDateLabel}</Text>
                                <Text style={[styles.dateValue, { color: colors.text }]} numberOfLines={1}>
                                    {selectedDate.format('DD MMMM YYYY')}
                                </Text>
                            </View>
                            <MaterialCommunityIcons
                                name={calendarOpen ? 'chevron-up' : 'chevron-down'}
                                size={16}
                                color={colors.textTertiary}
                            />
                        </Pressable>

                        <Pressable
                            onPress={() => shiftSelectedDate(1)}
                            style={({ pressed }) => [
                                styles.dateArrow,
                                { backgroundColor: pressed ? `${colors.primary}14` : 'transparent' },
                            ]}
                        >
                            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
                        </Pressable>
                    </View>

                    {calendarOpen ? (
                        <ShiftCalendarPicker
                            selectedDate={selectedDate}
                            activeMonth={activeMonth}
                            onSelectDate={handleSelectDate}
                            onMonthChange={setActiveMonth}
                            markedDates={markedDates}
                        />
                    ) : null}

                    {filteredHistory.length > 0 ? (
                        <View style={styles.historyList}>
                            {filteredHistory.map((item) => (
                                <View key={item.id} style={[styles.historyCard, { backgroundColor: rowBg, borderColor: rowBorder }]}>
                                    <View style={styles.historyLeft}>
                                        <Text style={[styles.historyDate, { color: colors.text }]}>{item.fullDateLabel}</Text>
                                        <Text style={[styles.historyRange, { color: secondaryText }]}>{item.rangeLabel}</Text>
                                    </View>
                                    <View style={styles.historyRight}>
                                        <Text style={[styles.historyDuration, { color: colors.text }]}>{item.durationLabel}</Text>
                                        <Text style={[styles.historyStatus, { color: item.statusColor }]}>{item.statusLabel}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={[styles.emptyHistory, { backgroundColor: rowBg, borderColor: rowBorder }]}>
                            <Text style={[styles.emptyHistoryText, { color: secondaryText }]}>Bu tarihte mesai kaydı bulunmuyor.</Text>
                        </View>
                    )}
                </View>

                <Pressable
                    onPress={primaryButtonAction}
                    disabled={loading || actionLoading || shiftState?.actionDisabled}
                    style={({ pressed }) => [
                        styles.primaryButton,
                        {
                            backgroundColor: primaryButtonColor,
                            opacity: pressed || loading || actionLoading || shiftState?.actionDisabled ? 0.82 : 1,
                        },
                    ]}
                >
                    {actionLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <MaterialCommunityIcons
                                name={shouldStopShift ? 'stop-circle-outline' : 'play-circle-outline'}
                                size={18}
                                color="#FFFFFF"
                            />
                            <Text style={styles.primaryButtonText}>{primaryButtonLabel}</Text>
                        </>
                    )}
                </Pressable>
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
});

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.xs,
    },
    handle: {
        alignSelf: 'center',
        width: 42,
        height: 4,
        borderRadius: 999,
        marginBottom: spacing.s,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.s,
        marginBottom: spacing.m,
    },
    headerTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        ...typography.h3,
        fontSize: 17,
        marginBottom: 2,
    },
    subtitle: {
        ...typography.bodySmall,
        fontSize: 12,
        lineHeight: 16,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroCard: {
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: spacing.m + 2,
        paddingVertical: spacing.m,
        marginBottom: spacing.s + 2,
    },
    heroLabel: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    heroTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.s,
        marginTop: 4,
    },
    heroStatus: {
        fontSize: 20,
        fontWeight: '800',
        flexShrink: 1,
    },
    heroPercent: {
        fontSize: 11,
        fontWeight: '800',
    },
    heroCounter: {
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: -0.8,
        marginTop: 6,
    },
    heroMeta: {
        ...typography.bodySmall,
        fontSize: 12,
        lineHeight: 17,
        marginTop: 6,
    },
    progressTrack: {
        marginTop: spacing.s,
        height: 8,
        borderRadius: 999,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 999,
    },
    metricRow: {
        flexDirection: 'row',
        gap: spacing.s,
        marginTop: spacing.s,
    },
    metricCard: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: spacing.s + 2,
        paddingVertical: spacing.s,
    },
    metricLabel: {
        fontSize: 10,
        fontWeight: '700',
    },
    metricValue: {
        fontSize: 14,
        fontWeight: '800',
        marginTop: 4,
    },
    warningList: {
        gap: spacing.xs + 2,
        marginBottom: spacing.s + 2,
    },
    warningCard: {
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.xs + 4,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.xs + 2,
    },
    warningText: {
        ...typography.bodySmall,
        flex: 1,
        fontSize: 12,
        lineHeight: 17,
    },
    infoList: {
        gap: spacing.xs + 2,
        marginBottom: spacing.m,
    },
    infoRow: {
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.xs + 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.s,
    },
    infoLabel: {
        fontSize: 11,
        fontWeight: '600',
    },
    infoValue: {
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'right',
        flexShrink: 1,
    },
    historySection: {
        marginBottom: spacing.m,
    },
    historyHeader: {
        marginBottom: spacing.s,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
    },
    sectionCaption: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    dateNavigator: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xs,
        marginBottom: spacing.s,
    },
    dateArrow: {
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
        gap: spacing.s,
        paddingHorizontal: spacing.xs,
    },
    dateIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateTextBlock: {
        flex: 1,
        minWidth: 0,
    },
    dateRelative: {
        fontSize: 11,
        fontWeight: '700',
    },
    dateValue: {
        fontSize: 12,
        fontWeight: '700',
        marginTop: 1,
    },
    calendarWrap: {
        marginBottom: spacing.s,
        borderRadius: 18,
        paddingHorizontal: spacing.s,
        paddingVertical: spacing.s,
    },
    calendarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.m,
    },
    calendarNav: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calendarMonthLabel: {
        ...typography.h3,
        fontSize: 17,
        fontWeight: '700',
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
    },
    dayHeadsRow: {
        flexDirection: 'row',
        marginBottom: spacing.s,
    },
    dayHeadCell: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 4,
    },
    dayHeadText: {
        fontSize: 11,
        fontWeight: '600',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    gridCell: {
        width: '14.2857%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        position: 'relative',
        marginBottom: spacing.xs,
    },
    gridCellText: {
        fontSize: 13,
    },
    shiftDot: {
        position: 'absolute',
        bottom: 6,
        width: 5,
        height: 5,
        borderRadius: 3,
    },
    todayDot: {
        position: 'absolute',
        bottom: 6,
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    historyList: {
        gap: spacing.xs + 2,
    },
    historyCard: {
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s + 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.s,
    },
    historyLeft: {
        flex: 1,
        minWidth: 0,
    },
    historyDate: {
        fontSize: 13,
        fontWeight: '800',
    },
    historyRange: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    historyRight: {
        alignItems: 'flex-end',
        minWidth: 92,
    },
    historyDuration: {
        fontSize: 13,
        fontWeight: '800',
    },
    historyStatus: {
        fontSize: 11,
        fontWeight: '700',
        marginTop: 2,
        textAlign: 'right',
    },
    emptyHistory: {
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.m,
    },
    emptyHistoryText: {
        ...typography.bodySmall,
        fontSize: 12,
        textAlign: 'center',
    },
    primaryButton: {
        minHeight: 46,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.s,
        marginTop: 2,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
});

export default ShiftStatusSheet;
