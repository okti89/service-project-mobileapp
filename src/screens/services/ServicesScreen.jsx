import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import WrapperContainer from '@/components/WrapperContainer';
import Header from '@/components/Header';
import ServiceDateFilter from '@/components/home/ServiceDateFilter';
import ServiceListItem from '@/components/home/ServiceListItem';
import ServiceActionsSheet from '@/components/home/ServiceActionsSheet';
import TechnicianPickerSheet from '@/components/home/TechnicianPickerSheet';
import TechnicianFilterSheet from '@/components/services/TechnicianFilterSheet';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import serviceService from '@/services/serviceService';
import technicianService from '@/services/technicianService';
import { serviceBlue } from '@/theme/color';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const clearTechnicianFields = (service = {}) => ({
    ...service,
    technician: null,
    technician_name: null,
    technician_full_name: null,
    technician_avatar: null,
    technician_avatar_url: null,
    assigned_technician_avatar: null,
    assigned_technician_avatar_url: null,
    technician_user: null,
    technician_user_id: null,
    user: null,
    user_id: null,
});

const mergeUpdatedService = (currentService, updatedService) => {
    const merged = { ...currentService, ...updatedService };
    return merged?.technician == null ? clearTechnicianFields(merged) : merged;
};

const isServiceAssignmentLocked = (service) => {
    const statusKey = String(service?.service_status || '').trim().toLowerCase();
    const isCompleted = statusKey === 'completed';
    const scheduled = service?.scheduled_date ? dayjs(service.scheduled_date) : null;
    const isPastDate = scheduled ? scheduled.startOf('day').isBefore(dayjs().startOf('day')) : false;
    return isCompleted || isPastDate;
};

const ServicesScreen = () => {
    const navigation = useNavigation();
    const { colors, isDark } = useTheme();
    const { isAdmin, mobilePermissions } = useAuth();

    const [services, setServices] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [techniciansLoading, setTechniciansLoading] = useState(false);
    const [technicianUpdateLoading, setTechnicianUpdateLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [activeMonth, setActiveMonth] = useState(() => dayjs().startOf('month').toDate());
    const [selectedTechnicianId, setSelectedTechnicianId] = useState(null);
    const [selectedService, setSelectedService] = useState(null);
    const [technicianTargetService, setTechnicianTargetService] = useState(null);

    const technicianFilterSheetRef = useRef(null);
    const technicianPickerSheetRef = useRef(null);
    const actionsSheetRef = useRef(null);
    const stateRef = useRef({ activeMonth, isAdmin });
    const hasHandledInitialFocusRef = useRef(false);

    useEffect(() => {
        stateRef.current = { activeMonth, isAdmin };
    }, [activeMonth, isAdmin]);

    const canCreateService = useMemo(
        () => isAdmin || Boolean(mobilePermissions?.can_manage_services),
        [isAdmin, mobilePermissions]
    );

    const fetchServices = useCallback(async ({ isRefresh = false } = {}) => {
        const currentMonth = stateRef.current.activeMonth;
        const adminMode = stateRef.current.isAdmin;

        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError(null);

            const params = {
                start_date: dayjs(currentMonth).startOf('month').format('YYYY-MM-DD'),
                end_date: dayjs(currentMonth).endOf('month').format('YYYY-MM-DD'),
            };

            const data = adminMode
                ? await serviceService.getAllServices(params)
                : await serviceService.getTechnicianServices(params);

            setServices(Array.isArray(data) ? data : []);
        } catch (err) {
            console.warn('ServicesScreen fetch error:', err?.response?.data || err?.message);
            setError(err?.message || 'Servisler yüklenemedi.');
            setServices([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const fetchTechnicians = useCallback(async () => {
        if (!isAdmin) {
            setTechnicians([]);
            return;
        }

        try {
            setTechniciansLoading(true);
            const data = await technicianService.getTechnicians({ include_inactive: 'false' });
            setTechnicians(Array.isArray(data) ? data : []);
        } catch (err) {
            console.warn('ServicesScreen technician fetch error:', err?.response?.data || err?.message);
            setTechnicians([]);
        } finally {
            setTechniciansLoading(false);
        }
    }, [isAdmin]);

    useEffect(() => {
        fetchServices();
    }, [fetchServices, activeMonth]);

    useFocusEffect(
        useCallback(() => {
            if (!hasHandledInitialFocusRef.current) {
                hasHandledInitialFocusRef.current = true;
                return undefined;
            }
            fetchServices();
            return undefined;
        }, [fetchServices])
    );

    useEffect(() => {
        fetchTechnicians();
    }, [fetchTechnicians]);

    useEffect(() => {
        if (!isAdmin) {
            setSelectedTechnicianId(null);
        }
    }, [isAdmin]);

    const handleRefresh = useCallback(() => {
        fetchServices({ isRefresh: true });
    }, [fetchServices]);

    const handleMonthChange = useCallback((monthDate) => {
        setActiveMonth(dayjs(monthDate).startOf('month').toDate());
    }, []);

    const handleDateChange = useCallback((date) => {
        setSelectedDate(date);
        setActiveMonth((prev) => {
            const prevMonth = dayjs(prev).format('YYYY-MM');
            const nextMonth = dayjs(date).format('YYYY-MM');
            return prevMonth === nextMonth ? prev : dayjs(date).startOf('month').toDate();
        });
    }, []);

    const filteredByTechnician = useMemo(() => {
        if (!isAdmin || !selectedTechnicianId) return services;
        return services.filter((service) => {
            const ids = [
                service?.technician,
                service?.technician_id,
                service?.technician_user_id,
                service?.user_id,
                service?.technician_user?.id,
                service?.user?.id,
            ].map((item) => (item == null ? null : Number(item)));
            return ids.includes(Number(selectedTechnicianId));
        });
    }, [isAdmin, services, selectedTechnicianId]);

    const filteredServices = useMemo(() => {
        const targetDate = dayjs(selectedDate).format('YYYY-MM-DD');
        return filteredByTechnician.filter((service) => (
            service?.scheduled_date
            && dayjs(service.scheduled_date).format('YYYY-MM-DD') === targetDate
        ));
    }, [filteredByTechnician, selectedDate]);

    const markedDates = useMemo(() => {
        const dates = new Set();
        filteredByTechnician.forEach((service) => {
            if (service?.scheduled_date) {
                dates.add(dayjs(service.scheduled_date).format('YYYY-MM-DD'));
            }
        });
        return dates;
    }, [filteredByTechnician]);

    const selectedTechnicianLabel = useMemo(() => {
        if (!selectedTechnicianId) return 'Tüm teknisyenler';
        const match = technicians.find((item) => Number(item?.id ?? item?.user ?? item?.user_id) === Number(selectedTechnicianId));
        return match?.full_name || match?.name || 'Teknisyen';
    }, [selectedTechnicianId, technicians]);

    const handleOpenTechnicianFilterSheet = useCallback(() => {
        if (!isAdmin) return;
        technicianFilterSheetRef.current?.present();
    }, [isAdmin]);

    const handleOpenCreateService = useCallback(() => {
        if (!canCreateService) return;
        navigation.navigate('NewService');
    }, [canCreateService, navigation]);

    const openServiceDetail = useCallback((service) => {
        if (!service?.id) return;
        navigation.navigate('ServiceDetail', {
            serviceId: service.id,
            service,
        });
    }, [navigation]);

    const handleServicePress = useCallback((service) => {
        openServiceDetail(service);
    }, [openServiceDetail]);

    const handleServiceActions = useCallback((service) => {
        setSelectedService(service);
        actionsSheetRef.current?.present();
    }, []);

    const handleTechnicianPress = useCallback(async (service) => {
        if (!isAdmin || !service?.id || isServiceAssignmentLocked(service)) return;

        setTechnicianTargetService(service);
        technicianPickerSheetRef.current?.present();

        if (!technicians.length && !techniciansLoading) {
            await fetchTechnicians();
        }
    }, [fetchTechnicians, isAdmin, technicians.length, techniciansLoading]);

    const handleTechnicianSelect = useCallback(async (technician) => {
        if (!technicianTargetService?.id) return;

        const nextTechnicianId = technician?.id ?? null;
        const currentTechnicianId = technicianTargetService?.technician ?? null;

        if (nextTechnicianId === currentTechnicianId) {
            technicianPickerSheetRef.current?.dismiss();
            return;
        }

        try {
            setTechnicianUpdateLoading(true);
            const updatedService = await serviceService.updateAdminService(technicianTargetService.id, {
                technician: nextTechnicianId,
            });

            setServices((prev) => prev.map((item) => (
                item?.id === technicianTargetService.id
                    ? mergeUpdatedService(item, updatedService)
                    : item
            )));
            setSelectedService((prev) => (
                prev?.id === technicianTargetService.id
                    ? mergeUpdatedService(prev, updatedService)
                    : prev
            ));
            setTechnicianTargetService((prev) => (
                prev?.id === technicianTargetService.id
                    ? mergeUpdatedService(prev, updatedService)
                    : prev
            ));
            technicianPickerSheetRef.current?.dismiss();
        } catch (err) {
            console.warn('ServicesScreen technician update error:', err?.response?.data || err?.message);
            Alert.alert('Hata', 'Teknisyen değiştirilemedi.');
        } finally {
            setTechnicianUpdateLoading(false);
        }
    }, [technicianTargetService]);

    const handleSheetAction = useCallback((actionKey, service) => {
        if (!service) return;
        if (actionKey === 'detail' || actionKey === 'reschedule') {
            openServiceDetail(service);
        }
    }, [openServiceDetail]);

    const headerAction = canCreateService ? (
        <Pressable
            onPress={handleOpenCreateService}
            style={({ pressed }) => [styles.addButton, { opacity: pressed ? 0.92 : 1 }]}
        >
            <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Servis Ekle</Text>
        </Pressable>
    ) : null;

    return (
        <WrapperContainer withTabBar>
            <Header
                title="Servisler"
                subtitle="Gün ve teknisyene göre filtrele"
                borderBottom
                right={headerAction}
            />

            <View style={styles.topBlock}>
                <ServiceDateFilter
                    selectedDate={selectedDate}
                    onDateChange={handleDateChange}
                    serviceCount={filteredServices.length}
                    markedDates={markedDates}
                    onMonthChange={handleMonthChange}
                    loading={loading}
                />

                {isAdmin ? (
                    <View style={styles.filterRow}>
                        <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Teknisyen filtresi</Text>
                        <Pressable
                            onPress={handleOpenTechnicianFilterSheet}
                            style={({ pressed }) => [
                                styles.filterButton,
                                {
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                                    opacity: pressed ? 0.9 : 1,
                                },
                            ]}
                        >
                            <View style={styles.filterButtonTextWrap}>
                                <Text style={[styles.filterButtonTitle, { color: colors.text }]}>Teknisyen</Text>
                                <Text style={[styles.filterButtonValue, { color: selectedTechnicianId ? colors.primary : colors.textTertiary }]} numberOfLines={1}>
                                    {techniciansLoading ? 'Yükleniyor...' : selectedTechnicianLabel}
                                </Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textTertiary} />
                        </Pressable>
                    </View>
                ) : null}
            </View>

            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={(
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                        progressViewOffset={12}
                    />
                )}
            >
                {loading ? (
                    <View style={styles.stateBlock}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.stateText, { color: colors.textTertiary }]}>Servisler yükleniyor...</Text>
                    </View>
                ) : error ? (
                    <View style={styles.stateBlock}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={28} color={colors.error} />
                        <Text style={[styles.stateText, { color: colors.textSecondary }]}>{error}</Text>
                    </View>
                ) : filteredServices.length === 0 ? (
                    <View style={styles.stateBlock}>
                        <MaterialCommunityIcons name="calendar-blank-outline" size={28} color={colors.textTertiary} />
                        <Text style={[styles.stateText, { color: colors.textTertiary }]}>Seçili filtreye uygun servis bulunamadı.</Text>
                    </View>
                ) : (
                    filteredServices.map((service, index) => (
                        <ServiceListItem
                            key={index}
                            service={service}
                            onPress={handleServicePress}
                            onPressActions={handleServiceActions}
                            onPressTechnician={handleTechnicianPress}
                            isTechnicianEditable={isAdmin && !isServiceAssignmentLocked(service)}
                        />
                    ))
                )}
            </ScrollView>

            <ServiceActionsSheet
                ref={actionsSheetRef}
                service={selectedService}
                onAction={handleSheetAction}
            />

            {isAdmin ? (
                <>
                    <TechnicianFilterSheet
                        ref={technicianFilterSheetRef}
                        technicians={technicians}
                        selectedTechnicianId={selectedTechnicianId}
                        onSelect={setSelectedTechnicianId}
                    />
                    <TechnicianPickerSheet
                        ref={technicianPickerSheetRef}
                        technicians={technicians}
                        loading={techniciansLoading}
                        submitting={technicianUpdateLoading}
                        selectedTechnicianId={technicianTargetService?.technician ?? null}
                        onSelect={handleTechnicianSelect}
                    />
                </>
            ) : null}
        </WrapperContainer>
    );
};

const styles = StyleSheet.create({
    addButton: {
        minHeight: 40,
        paddingHorizontal: spacing.m,
        borderRadius: 12,
        backgroundColor: serviceBlue,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
    },
    topBlock: {
        paddingTop: spacing.s,
    },
    filterRow: {
        paddingHorizontal: spacing.gutter,
        marginTop: spacing.s,
        marginBottom: spacing.m,
    },
    filterLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
    },
    filterButton: {
        minHeight: 56,
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s + 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.s,
    },
    filterButtonTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    filterButtonTitle: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    filterButtonValue: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 3,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: spacing.gutter,
        paddingBottom: spacing['4xl'],
        gap: spacing.s,
    },
    stateBlock: {
        minHeight: 220,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.s,
    },
    stateText: {
        ...typography.bodySmall,
        textAlign: 'center',
    },
});

export default ServicesScreen;