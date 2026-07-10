import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import AppBottomSheet from '@/components/AppBottomSheet';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen } from '@/theme/color';
import { fs, sp } from '@/theme/scale';

const WEEKDAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

const CalendarPickerSheet = forwardRef(({
    selectedDate = new Date(),
    activeTab = 'my',
    onSelectDate,
    showDots = true,
}, ref) => {
    const { colors, isDark } = useTheme();
    const { isAdmin } = useAuth();
    const sheetRef = useRef(null);
    const [visible, setVisible] = useState(false);

    // The month currently displayed in the calendar grid
    const [viewedMonth, setViewedMonth] = useState(() => dayjs(selectedDate).toDate());
    // Set of 'YYYY-MM-DD' dates that have services
    const [serviceDays, setServiceDays] = useState(new Set());
    const [loadingDots, setLoadingDots] = useState(false);

    useImperativeHandle(ref, () => ({
        present: () => {
            setViewedMonth(dayjs(selectedDate).toDate());
            setVisible(true);
        },
        dismiss: () => {
            setVisible(false);
        },
    }), [selectedDate]);

    // Fetch services for the currently viewed month to show dot indicators
    const fetchMonthDots = useCallback(async () => {
        if (!showDots) return;
        setLoadingDots(true);
        try {
            const start = dayjs(viewedMonth).startOf('month').format('YYYY-MM-DD');
            const end = dayjs(viewedMonth).endOf('month').format('YYYY-MM-DD');
            const endpoint = (isAdmin && activeTab === 'all')
                ? ENDPOINTS.SERVICES.ADMIN_LIST
                : ENDPOINTS.SERVICES.TECHNICIAN_LIST;

            const res = await api.get(endpoint, {
                params: {
                    start_date: start,
                    end_date: end,
                }
            });
            const data = Array.isArray(res?.data) ? res.data : [];
            const days = new Set();
            data.forEach(item => {
                if (item.scheduled_date) {
                    days.add(dayjs(item.scheduled_date).format('YYYY-MM-DD'));
                }
            });
            setServiceDays(days);
        } catch (err) {
            console.log('Calendar dots fetch error:', err?.response?.data || err?.message);
        } finally {
            setLoadingDots(false);
        }
    }, [viewedMonth, activeTab, isAdmin]);

    useEffect(() => {
        if (visible && showDots) {
            fetchMonthDots();
        }
    }, [visible, showDots, fetchMonthDots]);

    const handlePrevMonth = () => {
        setViewedMonth(prev => dayjs(prev).subtract(1, 'month').toDate());
    };

    const handleNextMonth = () => {
        setViewedMonth(prev => dayjs(prev).add(1, 'month').toDate());
    };

    // Calendar grid calculations
    const startOfMonth = dayjs(viewedMonth).startOf('month');
    const daysInMonth = startOfMonth.daysInMonth();
    const startDayOfWeek = startOfMonth.day(); // 0 is Sunday, 1 is Monday...
    const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Pt start

    const daysArray = useMemo(() => {
        const arr = [];
        for (let i = 0; i < offset; i++) {
            arr.push(null);
        }
        for (let d = 1; d <= daysInMonth; d++) {
            arr.push(d);
        }
        return arr;
    }, [offset, daysInMonth]);

    const viewedMonthLabel = dayjs(viewedMonth).format('MMMM YYYY');

    const handleSelectDay = (day) => {
        if (!day) return;
        const chosen = dayjs(viewedMonth).date(day).toDate();
        onSelectDate?.(chosen);
        setVisible(false);
    };

    return (
        <AppBottomSheet
            ref={sheetRef}
            visible={visible}
            onClose={() => setVisible(false)}
            snapPoints={['55%']}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Pressable onPress={handlePrevMonth} style={styles.navBtn}>
                        <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
                    </Pressable>
                    <View style={styles.headerTitleWrap}>
                        <Text style={[styles.title, { color: colors.text }]}>{viewedMonthLabel}</Text>
                        {loadingDots && (
                            <ActivityIndicator size="small" color={serviceBlue} style={{ marginLeft: 6 }} />
                        )}
                    </View>
                    <Pressable onPress={handleNextMonth} style={styles.navBtn}>
                        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text} />
                    </Pressable>
                </View>

                {/* Weekdays Row */}
                <View style={styles.weekdaysRow}>
                    {WEEKDAYS.map((w, idx) => (
                        <Text key={idx} style={[styles.weekdayLabel, { color: colors.textSecondary }]}>
                            {w}
                        </Text>
                    ))}
                </View>

                {/* Days Grid */}
                <View style={styles.grid}>
                    {daysArray.map((day, idx) => {
                        if (day === null) {
                            return <View key={`empty-${idx}`} style={styles.dayCell} />;
                        }

                        const currentDate = dayjs(viewedMonth).date(day);
                        const dateStr = currentDate.format('YYYY-MM-DD');
                        const isSelected = dayjs(selectedDate).isSame(currentDate, 'day');
                        const isToday = dayjs().isSame(currentDate, 'day');
                        const hasService = showDots && serviceDays.has(dateStr);

                        return (
                            <Pressable
                                key={`day-${day}`}
                                onPress={() => handleSelectDay(day)}
                                style={({ pressed }) => [
                                    styles.dayCell,
                                    isSelected && [styles.selectedDay, { backgroundColor: serviceBlue }],
                                    pressed && { opacity: 0.7 }
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.dayText,
                                        { color: isSelected ? '#FFFFFF' : colors.text },
                                        isToday && !isSelected && styles.todayText,
                                    ]}
                                >
                                    {day}
                                </Text>
                                {hasService && (
                                    <View
                                        style={[
                                            styles.dot,
                                            { backgroundColor: isSelected ? '#FFFFFF' : serviceBlue }
                                        ]}
                                    />
                                )}
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        </AppBottomSheet>
    );
});

export default CalendarPickerSheet;

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingTop: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    headerTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: fs(15),
        fontWeight: '900',
        textTransform: 'capitalize',
    },
    navBtn: {
        width: sp(36),
        height: sp(36),
        borderRadius: sp(10),
        alignItems: 'center',
        justifyContent: 'center',
    },
    weekdaysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    weekdayLabel: {
        width: '14.28%',
        textAlign: 'center',
        fontSize: fs(11),
        fontWeight: '700',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    dayCell: {
        width: '14.28%',
        height: sp(38),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        position: 'relative',
    },
    selectedDay: {
        borderRadius: sp(19),
    },
    dayText: {
        fontSize: fs(13),
        fontWeight: '600',
    },
    todayText: {
        fontWeight: '900',
        textDecorationLine: 'underline',
    },
    dot: {
        position: 'absolute',
        bottom: 4,
        width: sp(4),
        height: sp(4),
        borderRadius: sp(2),
    },
});
