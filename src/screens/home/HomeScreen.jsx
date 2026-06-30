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
import buildShiftState from '@/utils/shiftSummary';

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
            const startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
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

    const shiftSummary = useMemo(
        () => (canManageShift ? buildShiftState({ shifts, config, now }) : { visible: false, warnings: [], recentShifts: [] }),
        [canManageShift, config, now, shifts]
    );

    const handleOpenShiftSheet = useCallback(() => {
        if (!canManageShift) return;
        shiftSheetRef.current?.present();
    }, [canManageShift]);

    const handleStartShift = useCallback(async () => {
        if (shiftSummary?.actionDisabledReason) {
            Alert.alert('Mesai Başlatılamadı', shiftSummary.actionDisabledReason);
            return;
        }

        try {
            setShiftActionLoading(true);
            await technicianService.startShift();
            await Promise.allSettled([fetchShiftSummary(), syncLocationTrackingByShift?.()]);
        } catch (error) {
            Alert.alert('Hata', error?.response?.data?.detail || 'Mesai başlatılamadı.');
        } finally {
            setShiftActionLoading(false);
        }
    }, [fetchShiftSummary, shiftSummary, syncLocationTrackingByShift]);

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

