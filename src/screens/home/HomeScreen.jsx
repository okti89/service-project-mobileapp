import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet } from "react-native";
import dayjs from 'dayjs';
import WrapperContainer from "@/components/WrapperContainer";
import HomeHeader from "@/components/home/HomeHeader";
import HomeProfileCard from "@/components/home/HomeProfileCard";
import HomeServicesSection from "@/components/home/HomeServicesSection";
import ShiftStatusSheet from "@/components/home/ShiftStatusSheet";
import { useAuth } from "@/context/AuthContext";
import { useConfig } from "@/context/ConfigContext";
import { useTheme } from "@/context/ThemeContext";
import technicianService from '@/services/technicianService';

const formatTime = (value) => {
    if (!value) return '--:--';
    const date = dayjs(value);
    return date.isValid() ? date.format('HH:mm') : '--:--';
};

const formatDuration = (totalSeconds) => {
    const safe = Math.max(0, Number(totalSeconds) || 0);
    const hours = String(Math.floor(safe / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((safe % 3600) / 60)).padStart(2, '0');
    const seconds = String(safe % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

const getTodayWorkingHours = (workingHours = [], now = dayjs()) => {
    const today = now.day();
    const normalizedDay = today === 0 ? 6 : today - 1;
    return workingHours.find((item) => Number(item?.day_of_week) === normalizedDay) || null;
};

const buildShiftState = ({ shifts, config, now }) => {
    const workingHours = Array.isArray(config?.working_hours) ? config.working_hours : [];
    const todayHours = getTodayWorkingHours(workingHours, now);
    const startHour = todayHours?.start_time?.slice(0, 5) || null;
    const endHour = todayHours?.end_time?.slice(0, 5) || null;
    const todayScheduleLabel = todayHours?.is_holiday
        ? 'Bugün tatil'
        : startHour && endHour
            ? `${startHour} - ${endHour}`
            : 'Tanımlı değil';

    const openShift = (Array.isArray(shifts) ? shifts : []).find((shift) => shift?.start_time && !shift?.end_time) || null;
    const openShiftStart = openShift?.start_time ? dayjs(openShift.start_time) : null;
    const openShiftDate = openShiftStart?.isValid() ? openShiftStart.format('YYYY-MM-DD') : null;
    const todayDate = now.format('YYYY-MM-DD');
    const isOpenShiftToday = Boolean(openShift && openShiftDate === todayDate);
    const hasOvernightOpenShift = Boolean(openShift && openShiftDate && openShiftDate !== todayDate);

    const warnings = [];
    const startBoundary = startHour ? dayjs(`${todayDate}T${startHour}`) : null;
    const endBoundary = endHour ? dayjs(`${todayDate}T${endHour}`) : null;

    if (!isOpenShiftToday && startBoundary?.isValid() && now.isAfter(startBoundary)) {
        warnings.push('Mesai başlangıç saati geçti. Mesaiye başlamanız bekleniyor.');
    }

    if (hasOvernightOpenShift) {
        warnings.push('Önceki güne ait açık mesai kaydı var. Lütfen mesaiyi bitirin.');
    }

    let statusLabel = 'Mesai Dışı';
    let statusColor = '#6B7280';
    let counterLabel = '00:00:00';
    let metaLabel = 'Bugün için mesai kaydı bulunmuyor.';
    let startLabel = '--:--';
    let endLabel = '--:--';

    if (isOpenShiftToday && openShiftStart?.isValid()) {
        const seconds = now.diff(openShiftStart, 'second');
        statusLabel = 'Mesaide';
        statusColor = '#16A34A';
        counterLabel = formatDuration(seconds);
        startLabel = formatTime(openShift.start_time);
        metaLabel = endBoundary?.isValid() && now.isAfter(endBoundary)
            ? 'Mesai saati aşıldı, mesaiyi bitirmeniz bekleniyor.'
            : 'Bugünkü aktif mesai devam ediyor.';
        if (endBoundary?.isValid() && now.isAfter(endBoundary)) {
            warnings.push('Şirket mesai bitiş saati geçti. Mesaiyi bitirmeniz isteniyor.');
        }
    } else if (hasOvernightOpenShift && openShiftStart?.isValid()) {
        statusLabel = 'Mesai Kapanışı Bekleniyor';
        statusColor = '#F59E0B';
        counterLabel = '00:00:00';
        startLabel = formatTime(openShift.start_time);
        metaLabel = 'Dünden açık kalan mesai yeni güne devretmez.';
    }

    if (openShift?.end_time) {
        endLabel = formatTime(openShift.end_time);
    }

    return {
        visible: true,
        isActiveToday: isOpenShiftToday,
        hasOvernightOpenShift,
        statusLabel,
        statusColor,
        counterLabel,
        metaLabel,
        startLabel,
        endLabel,
        todayScheduleLabel,
        warnings,
    };
};

const HomeScreen = () => {
    const { colors } = useTheme();
    const { userInfo, isAdmin, isTechnician, syncLocationTrackingByShift } = useAuth();
    const [refreshing, setRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState('mine');
    const [shifts, setShifts] = useState([]);
    const [shiftLoading, setShiftLoading] = useState(false);
    const [shiftActionLoading, setShiftActionLoading] = useState(false);
    const [now, setNow] = useState(() => dayjs());

    const { config, refreshConfig } = useConfig();
    const servicesRef = useRef(null);
    const shiftSheetRef = useRef(null);

    const canManageShift = Boolean(isTechnician || isAdmin);

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(dayjs());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const fetchShiftSummary = useCallback(async () => {
        if (!canManageShift) {
            setShifts([]);
            return;
        }

        try {
            setShiftLoading(true);
            const endDate = dayjs().format('YYYY-MM-DD');
            const startDate = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
            const data = await technicianService.getShifts({ start_date: startDate, end_date: endDate });
            setShifts(Array.isArray(data) ? data : []);
        } catch (error) {
            console.log('Mesai özeti yüklenemedi:', error?.response?.data || error?.message || error);
            setShifts([]);
        } finally {
            setShiftLoading(false);
        }
    }, [canManageShift]);

    useEffect(() => {
        fetchShiftSummary();
    }, [fetchShiftSummary]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.allSettled([
            refreshConfig(),
            fetchShiftSummary(),
            servicesRef.current?.fetchServices?.({ isRefresh: true }),
        ]);
        setRefreshing(false);
    }, [fetchShiftSummary, refreshConfig]);

    const handleServicePress = useCallback((service) => {
        if (service) {
            console.log('Service pressed:', service?.id || service?.receipt_number);
        }
    }, []);

    const shiftSummary = useMemo(() => (canManageShift ? buildShiftState({ shifts, config, now }) : { visible: false, warnings: [] }), [canManageShift, config, now, shifts]);

    const handleOpenShiftSheet = useCallback(() => {
        if (!canManageShift) return;
        shiftSheetRef.current?.present();
    }, [canManageShift]);

    const handleStartShift = useCallback(async () => {
        try {
            setShiftActionLoading(true);
            await technicianService.startShift();
            await Promise.allSettled([fetchShiftSummary(), syncLocationTrackingByShift?.()]);
        } catch (error) {
            Alert.alert('Hata', error?.response?.data?.detail || 'Mesai başlatılamadı.');
        } finally {
            setShiftActionLoading(false);
        }
    }, [fetchShiftSummary, syncLocationTrackingByShift]);

    const handleStopShift = useCallback(async () => {
        try {
            setShiftActionLoading(true);
            await technicianService.stopShift();
            await Promise.allSettled([fetchShiftSummary(), syncLocationTrackingByShift?.()]);
        } catch (error) {
            Alert.alert('Hata', error?.response?.data?.detail || 'Mesai bitirilemedi.');
        } finally {
            setShiftActionLoading(false);
        }
    }, [fetchShiftSummary, syncLocationTrackingByShift]);

    return (
        <WrapperContainer>
            <HomeHeader variant="default" isAdmin={userInfo?.is_admin} />
            <ScrollView
                style={[styles.container, { backgroundColor: colors.background }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
            >
                <HomeProfileCard
                    userInfo={userInfo}
                    shiftSummary={shiftSummary}
                    onPressShift={handleOpenShiftSheet}
                />
                <HomeServicesSection
                    ref={servicesRef}
                    isAdmin={isAdmin}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onServicePress={handleServicePress}
                />
            </ScrollView>

            <ShiftStatusSheet
                ref={shiftSheetRef}
                shiftState={shiftSummary}
                loading={shiftLoading}
                actionLoading={shiftActionLoading}
                onStart={handleStartShift}
                onStop={handleStopShift}
            />
        </WrapperContainer>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

export default HomeScreen;

