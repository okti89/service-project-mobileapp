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
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import serviceService from '@/services/serviceService';
import technicianService from '@/services/technicianService';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import ServiceDateFilter from '@/components/home/ServiceDateFilter';
import ServiceStatsRow from '@/components/home/ServiceStatsRow';
import ServiceListItem from '@/components/home/ServiceListItem';
import ServiceActionsSheet from '@/components/home/ServiceActionsSheet';
import TechnicianPickerSheet from '@/components/home/TechnicianPickerSheet';
import StatusPickerSheet from '@/components/home/StatusPickerSheet';
import WarrantySheet from '@/components/services/WarrantySheet';

const VIEW_MODES = [
    { key: 'mine', label: 'Benim Servislerim' },
    { key: 'all', label: 'Tüm Servisler' },
];

const FALLBACK_SERVICE_STATUS_OPTIONS = [
    { key: 'new', label: 'Yeni', color: '#4F7CFF' },
    { key: 'assigned', label: 'Atandı', color: '#F59E0B' },
    { key: 'in_progress', label: 'Devam Ediyor', color: '#2563EB' },
    { key: 'postponed', label: 'Ertelendi', color: '#F97316' },
    { key: 'completed', label: 'Tamamlandı', color: '#16A34A' },
    { key: 'cancelled', label: 'İptal Edildi', color: '#EF4444' },
];

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

const HomeServicesSection = forwardRef(
    ({ isAdmin = false, viewMode = 'mine', onViewModeChange, onServicePress }, ref) => {
        const { colors, isDark } = useTheme();
        const navigation = useNavigation();

        const [services, setServices] = useState([]);
        const [loading, setLoading] = useState(true);
        const [refreshing, setRefreshing] = useState(false);
        const [error, setError] = useState(null);
        const [selectedDate, setSelectedDate] = useState(() => new Date());
        const [activeMonth, setActiveMonth] = useState(() => dayjs().startOf('month').toDate());
        const [selectedService, setSelectedService] = useState(null);
        const [technicians, setTechnicians] = useState([]);
        const [techniciansLoading, setTechniciansLoading] = useState(false);
        const [technicianUpdateLoading, setTechnicianUpdateLoading] = useState(false);
        const [technicianTargetService, setTechnicianTargetService] = useState(null);
        const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
        const [statusTargetService, setStatusTargetService] = useState(null);
        const [statusOptions, setStatusOptions] = useState(FALLBACK_SERVICE_STATUS_OPTIONS);

        const actionsSheetRef = useRef(null);
        const technicianSheetRef = useRef(null);
        const statusSheetRef = useRef(null);
        const warrantySheetRef = useRef(null);
        const stateRef = useRef({ viewMode, activeMonth, isAdmin });

        useEffect(() => {
            stateRef.current = { viewMode, activeMonth, isAdmin };
        }, [viewMode, activeMonth, isAdmin]);

        const openServiceDetail = useCallback(
            (service) => {
                if (!service?.id) return;
                navigation?.navigate('ServiceDetail', {
                    serviceId: service.id,
                    service,
                });
            },
            [navigation]
        );

        const fetchServices = useCallback(async ({ isRefresh = false } = {}) => {
            const currentViewMode = stateRef.current.viewMode;
            const currentActiveMonth = stateRef.current.activeMonth;
            const currentIsAdmin = stateRef.current.isAdmin;

            try {
                if (isRefresh) {
                    setRefreshing(true);
                } else {
                    setLoading(true);
                }

                setError(null);

                const monthStart = dayjs(currentActiveMonth).startOf('month').format('YYYY-MM-DD');
                const monthEnd = dayjs(currentActiveMonth).endOf('month').format('YYYY-MM-DD');
                const params = { start_date: monthStart, end_date: monthEnd };
                const isAll = currentIsAdmin && currentViewMode === 'all';

                const data = isAll
                    ? await serviceService.getAllServices(params)
                    : await serviceService.getTechnicianServices(params);

                setServices(Array.isArray(data) ? data : []);
            } catch (err) {
                console.warn('HomeServicesSection fetch error:', err?.response?.data || err?.message);
                setError(err?.message || 'Servisler yüklenemedi');
                setServices([]);
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        }, []);

        const fetchServiceStatuses = useCallback(async () => {
            try {
                const data = await serviceService.getServiceStatuses();
                const normalized = Array.isArray(data)
                    ? data
                        .filter((item) => item?.code && item?.is_active !== false)
                        .map((item) => ({
                            key: String(item.code).trim().toLowerCase(),
                            label: item.name || item.code,
                            color: item.color || colors.primary,
                        }))
                    : [];

                setStatusOptions(normalized.length > 0 ? normalized : FALLBACK_SERVICE_STATUS_OPTIONS);
            } catch (err) {
                console.warn('Service status list fetch error:', err?.response?.data || err?.message);
                setStatusOptions(FALLBACK_SERVICE_STATUS_OPTIONS);
            }
        }, [colors.primary]);

        const fetchTechnicians = useCallback(async () => {
            try {
                setTechniciansLoading(true);
                const data = await technicianService.getTechnicians({ include_inactive: 'false' });
                setTechnicians(Array.isArray(data) ? data : []);
            } catch (err) {
                console.warn('Technician list fetch error:', err?.response?.data || err?.message);
                Alert.alert('Hata', 'Teknisyen listesi yüklenemedi.');
            } finally {
                setTechniciansLoading(false);
            }
        }, []);

        useImperativeHandle(
            ref,
            () => ({
                fetchServices: (opts) => fetchServices(opts),
            }),
            [fetchServices]
        );

        useEffect(() => {
            fetchServices();
        }, [fetchServices, viewMode, activeMonth]);

        useEffect(() => {
            if (isAdmin) {
                fetchServiceStatuses();
            }
        }, [fetchServiceStatuses, isAdmin]);

        const handleServicePress = useCallback(
            (service) => {
                if (onServicePress) {
                    onServicePress(service);
                } else {
                    openServiceDetail(service);
                }
            },
            [onServicePress, openServiceDetail]
        );

        const handleServiceActions = useCallback((service) => {
            if (!service) return;
            setSelectedService(service);
            requestAnimationFrame(() => {
                actionsSheetRef.current?.present();
            });
        }, []);

        const handleTechnicianPress = useCallback(async (service) => {
            if (!isAdmin || !service?.id || isServiceAssignmentLocked(service)) return;

            setTechnicianTargetService(service);
            technicianSheetRef.current?.present();

            if (!technicians.length && !techniciansLoading) {
                await fetchTechnicians();
            }
        }, [fetchTechnicians, isAdmin, technicians.length, techniciansLoading]);

        const handleStatusPress = useCallback((service) => {
            if (!isAdmin || !service?.id) return;
            setStatusTargetService(service);
            statusSheetRef.current?.present();
        }, [isAdmin]);

        const handleTechnicianSelect = useCallback(async (technician) => {
            if (!technicianTargetService?.id) return;

            const nextTechnicianId = technician?.id ?? null;
            const currentTechnicianId = technicianTargetService?.technician ?? null;

            if (nextTechnicianId === currentTechnicianId) {
                technicianSheetRef.current?.dismiss();
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
                technicianSheetRef.current?.dismiss();
            } catch (err) {
                console.warn('Technician update error:', err?.response?.data || err?.message);
                Alert.alert('Hata', 'Teknisyen değiştirilemedi.');
            } finally {
                setTechnicianUpdateLoading(false);
            }
        }, [technicianTargetService]);

        const handleStatusSelect = useCallback(async (statusOption) => {
            if (!statusTargetService?.id || !statusOption?.key) return;

            const currentStatus = String(statusTargetService?.service_status || '').trim().toLowerCase();
            if (currentStatus === statusOption.key) {
                statusSheetRef.current?.dismiss();
                return;
            }

            try {
                setStatusUpdateLoading(true);
                const updatedService = await serviceService.updateAdminService(statusTargetService.id, {
                    service_status: statusOption.key,
                });

                const normalizedService = {
                    ...updatedService,
                    service_status: updatedService?.service_status || statusOption.key,
                    status_name: updatedService?.status_name || statusOption.label,
                    status_color: updatedService?.status_color || statusOption.color,
                };

                setServices((prev) => prev.map((item) => (
                    item?.id === statusTargetService.id
                        ? mergeUpdatedService(item, normalizedService)
                        : item
                )));
                setSelectedService((prev) => (
                    prev?.id === statusTargetService.id
                        ? mergeUpdatedService(prev, normalizedService)
                        : prev
                ));
                setStatusTargetService((prev) => (
                    prev?.id === statusTargetService.id
                        ? mergeUpdatedService(prev, normalizedService)
                        : prev
                ));
                statusSheetRef.current?.dismiss();
            } catch (err) {
                console.warn('Status update error:', err?.response?.data || err?.message);
                Alert.alert('Hata', err?.response?.data?.detail || 'Servis durumu güncellenemedi.');
            } finally {
                setStatusUpdateLoading(false);
            }
        }, [statusTargetService]);

        const handleWarrantyPdf = useCallback((service) => {
            if (!service?.id) return;
            setSelectedService(service);
            warrantySheetRef.current?.present();
        }, []);

        const handleSheetAction = useCallback(
            (actionKey, service) => {
                if (!service) return;

                if (actionKey === 'detail') {
                    openServiceDetail(service);
                    return;
                }

                if (actionKey === 'status') {
                    handleStatusPress(service);
                    return;
                }

                if (actionKey === 'warranty-pdf') {
                    handleWarrantyPdf(service);
                    return;
                }

                if (actionKey === 'reschedule') {
                    openServiceDetail(service);
                }
            },
            [handleStatusPress, handleWarrantyPdf, openServiceDetail]
        );

        const handleViewModeChange = useCallback(
            (mode) => {
                onViewModeChange?.(mode);
            },
            [onViewModeChange]
        );

        const handleDateChange = useCallback((date) => {
            setSelectedDate(date);
            setActiveMonth((prev) => {
                const prevMonth = dayjs(prev).format('YYYY-MM');
                const nextMonth = dayjs(date).format('YYYY-MM');
                return prevMonth !== nextMonth ? dayjs(date).startOf('month').toDate() : prev;
            });
        }, []);

        const handleMonthChange = useCallback((monthDate) => {
            setActiveMonth(dayjs(monthDate).startOf('month').toDate());
        }, []);

        const filteredServices = useMemo(() => {
            if (!Array.isArray(services)) return [];

            const targetDate = dayjs(selectedDate).format('YYYY-MM-DD');
            return services.filter((service) => {
                if (!service?.scheduled_date) return false;
                return dayjs(service.scheduled_date).format('YYYY-MM-DD') === targetDate;
            });
        }, [services, selectedDate]);

        const serviceDates = useMemo(() => {
            const dates = new Set();

            if (Array.isArray(services)) {
                services.forEach((service) => {
                    if (service?.scheduled_date) {
                        dates.add(dayjs(service.scheduled_date).format('YYYY-MM-DD'));
                    }
                });
            }

            return dates;
        }, [services]);

        return (
            <View style={styles.section}>
                {isAdmin ? (
                    <View
                        style={[
                            styles.segmented,
                            {
                                backgroundColor: 'transparent',
                                borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#D7DFEA',
                            },
                        ]}
                    >
                        {VIEW_MODES.map((mode) => {
                            const active = viewMode === mode.key;

                            return (
                                <Pressable
                                    key={mode.key}
                                    onPress={() => handleViewModeChange(mode.key)}
                                    android_ripple={{ color: `${colors.primary}10`, borderless: false }}
                                    style={[
                                        styles.segmentedItem,
                                        active && {
                                            backgroundColor: 'transparent',
                                            borderColor: active ? colors.success : 'transparent',
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.segmentedText,
                                            {
                                                color: active ? colors.text : colors.textSecondary,
                                                fontWeight: active ? '700' : '600',
                                            },
                                        ]}
                                    >
                                        {mode.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                ) : null}

                <ServiceDateFilter
                    selectedDate={selectedDate}
                    onDateChange={handleDateChange}
                    serviceCount={filteredServices.length}
                    markedDates={serviceDates}
                    onMonthChange={handleMonthChange}
                    loading={loading}
                />

                <ServiceStatsRow services={filteredServices} />

                <ScrollView
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={false}
                >
                    {refreshing ? (
                        <View style={styles.emptyState}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Yenileniyor...</Text>
                        </View>
                    ) : loading ? (
                        <View style={styles.emptyState}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Yükleniyor...</Text>
                        </View>
                    ) : error ? (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={28} color={colors.error} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{error}</Text>
                        </View>
                    ) : filteredServices.length === 0 ? (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="calendar-blank-outline" size={28} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Bu tarihe ait servis kaydı yok.</Text>
                        </View>
                    ) : (
                        filteredServices.map((service, index) => (
                            <ServiceListItem
                                key={service?.id || `${service?.receipt_number}-${index}`}
                                service={service}
                                index={index}
                                onPress={handleServicePress}
                                onPressActions={handleServiceActions}
                                onPressTechnician={handleTechnicianPress}
                                onPressStatus={handleStatusPress}
                                isTechnicianEditable={isAdmin && !isServiceAssignmentLocked(service)}
                                isStatusEditable={isAdmin}
                            />
                        ))
                    )}
                </ScrollView>

                <ServiceActionsSheet
                    ref={actionsSheetRef}
                    service={selectedService}
                    onAction={handleSheetAction}
                />

                <TechnicianPickerSheet
                    ref={technicianSheetRef}
                    technicians={technicians}
                    loading={techniciansLoading}
                    submitting={technicianUpdateLoading}
                    selectedTechnicianId={technicianTargetService?.technician ?? null}
                    onSelect={handleTechnicianSelect}
                />

                <StatusPickerSheet
                    ref={statusSheetRef}
                    statuses={statusOptions}
                    loading={statusUpdateLoading}
                    selectedStatusKey={String(statusTargetService?.service_status || '').trim().toLowerCase() || null}
                    onSelect={handleStatusSelect}
                />

                <WarrantySheet ref={warrantySheetRef} service={selectedService} />
            </View>
        );
    }
);

const styles = StyleSheet.create({
    section: {
        marginTop: spacing.l,
        paddingBottom: spacing['4xl'],
    },
    segmented: {
        flexDirection: 'row',
        marginHorizontal: spacing.gutter,
        paddingHorizontal: spacing.gutter,
        borderRadius: 0,
        borderWidth: 0,
        borderBottomWidth: 1,
        marginBottom: spacing.m + 2,
    },
    segmentedItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.s + 2,
        paddingHorizontal: spacing.s,
        borderRadius: 0,
        borderWidth: 0,
        borderBottomWidth: 2,
        borderColor: 'transparent',
    },
    segmentedText: {
        fontSize: 12,
        letterSpacing: -0.1,
        textAlign: 'center',
    },
    list: {
        paddingHorizontal: 0,
    },
    listContent: {
        paddingHorizontal: spacing.gutter,
        gap: spacing.s,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing['4xl'],
        gap: spacing.s,
    },
    emptyText: {
        ...typography.bodySmall,
        textAlign: 'center',
    },
});

export default HomeServicesSection;
