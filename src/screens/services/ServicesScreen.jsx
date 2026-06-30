import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import WrapperContainer from '@/components/WrapperContainer';
import Header from '@/components/Header';
import ServiceDateFilter from '@/components/home/ServiceDateFilter';
import ServiceListItem from '@/components/home/ServiceListItem';
import TechnicianFilterSheet from '@/components/services/TechnicianFilterSheet';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import serviceService from '@/services/serviceService';
import technicianService from '@/services/technicianService';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const ServicesScreen = () => {
    const navigation = useNavigation();
    const { colors, isDark } = useTheme();
    const { isAdmin, userInfo } = useAuth();

    const [services, setServices] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [techniciansLoading, setTechniciansLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [activeMonth, setActiveMonth] = useState(() => dayjs().startOf('month').toDate());
    const [selectedTechnicianId, setSelectedTechnicianId] = useState(null);

    const technicianSheetRef = useRef(null);
    const stateRef = useRef({ activeMonth, isAdmin });

    useEffect(() => {
        stateRef.current = { activeMonth, isAdmin };
    }, [activeMonth, isAdmin]);

    const fetchServices = useCallback(async () => {
        const currentMonth = stateRef.current.activeMonth;
        const adminMode = stateRef.current.isAdmin;

        try {
            setLoading(true);
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
        }
    }, []);

    const fetchTechnicians = useCallback(async () => {
        try {
            setTechniciansLoading(true);
            if (isAdmin) {
                const data = await technicianService.getTechnicians({ include_inactive: 'false' });
                setTechnicians(Array.isArray(data) ? data : []);
                return;
            }

            const fallbackTechnician = {
                id: userInfo?.technician_profile_id || userInfo?.id || null,
                full_name: userInfo?.full_name || `${userInfo?.first_name || ''} ${userInfo?.last_name || ''}`.trim() || 'Teknisyen',
                email: userInfo?.email || null,
                phone_number: userInfo?.phone_number || null,
            };
            setTechnicians(fallbackTechnician.id ? [fallbackTechnician] : []);
        } catch (err) {
            console.warn('ServicesScreen technician fetch error:', err?.response?.data || err?.message);
            setTechnicians([]);
        } finally {
            setTechniciansLoading(false);
        }
    }, [isAdmin, userInfo]);

    useEffect(() => {
        fetchServices();
    }, [fetchServices, activeMonth]);

    useEffect(() => {
        fetchTechnicians();
    }, [fetchTechnicians]);

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
        if (!selectedTechnicianId) return services;
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
    }, [services, selectedTechnicianId]);

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

    const handleOpenTechnicianSheet = useCallback(() => {
        technicianSheetRef.current?.present();
    }, []);

    const handleServicePress = useCallback((service) => {
        if (!service?.id) return;
        navigation.navigate('ServiceDetail', {
            serviceId: service.id,
            service,
        });
    }, [navigation]);

    return (
        <WrapperContainer withTabBar>
            <Header title="Servisler" subtitle="Gün ve teknisyene göre filtrele" borderBottom />

            <View style={styles.topBlock}>
                <ServiceDateFilter
                    selectedDate={selectedDate}
                    onDateChange={handleDateChange}
                    serviceCount={filteredServices.length}
                    markedDates={markedDates}
                    onMonthChange={handleMonthChange}
                    loading={loading}
                />

                <View style={styles.filterRow}>
                    <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Teknisyen filtresi</Text>
                    <Pressable
                        onPress={handleOpenTechnicianSheet}
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
            </View>

            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
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
                            key={service?.id || `${service?.receipt_number || 'service'}-${index}`}
                            service={service}
                            onPress={handleServicePress}
                        />
                    ))
                )}
            </ScrollView>

            <TechnicianFilterSheet
                ref={technicianSheetRef}
                technicians={technicians}
                selectedTechnicianId={selectedTechnicianId}
                onSelect={setSelectedTechnicianId}
            />
        </WrapperContainer>
    );
};

const styles = StyleSheet.create({
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