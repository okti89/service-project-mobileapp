import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Linking,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/context/ThemeContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceRed } from '@/theme/color';

const STATUS_COLORS = {
    available: '#22C55E',
    offduty: '#F59E0B',
    busy: '#EF4444',
};

const STATUS_META = {
    available: { label: 'Müsait', icon: 'check-circle' },
    offduty: { label: 'İzinde', icon: 'moon-waning-crescent' },
    busy: { label: 'Meşgul', icon: 'progress-clock' },
};

const FILTER_TABS = [
    { key: 'all', label: 'Tümü', icon: 'account-group-outline' },
    { key: 'available', label: 'Müsait', icon: 'check-circle-outline', color: '#22C55E' },
    { key: 'busy', label: 'Meşgul', icon: 'progress-clock', color: '#EF4444' },
    { key: 'offduty', label: 'İzinde', icon: 'moon-waning-crescent', color: '#F59E0B' },
];

const TechnicianCard = ({ technician, navigation, onPress }) => {
    const { colors, isDark } = useTheme();
    const status = technician.status || 'offduty';
    const statusColor = STATUS_COLORS[status] || serviceBlue;
    const statusMeta = STATUS_META[status] || STATUS_META.offduty;
    const fullName = technician.user?.full_name || technician.full_name || 'Teknisyen';
    const initials = fullName
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    const avatar = technician.user?.avatar_url || technician.user?.avatar;
    const isOnline = technician.is_online;
    const phone = technician.user?.phone_number;
    const email = technician.user?.email;

    const openLink = (url) => Linking.openURL(url).catch(() => {});

    const handleWhatsApp = () => {
        if (!phone) return;
        openLink(`https://wa.me/${phone.replace(/\D/g, '')}`);
    };
    const handleCall = () => {
        if (!phone) return;
        openLink(`tel:${phone.replace(/\D/g, '')}`);
    };
    const handleEmail = () => {
        if (!email) return;
        openLink(`mailto:${email}`);
    };

    const primaryActions = [
        {
            key: 'location',
            icon: 'map-marker-radius',
            label: 'Konum',
            color: serviceBlue,
            onPress: () => navigation.navigate('TechnicianLocations', { technicianId: technician.id }),
        },
        {
            key: 'services',
            icon: 'clipboard-list-outline',
            label: 'Servisler',
            color: '#F59E0B',
            onPress: () => navigation.navigate('ServiceList', { technicianId: technician.id }),
        },
        {
            key: 'performance',
            icon: 'chart-line',
            label: 'Performans',
            color: '#8B5CF6',
            onPress: () => navigation.navigate('TechnicianPerformance', {
                technicianId: technician.id,
                technicianName: fullName,
            }),
        },
        {
            key: 'shifts',
            icon: 'calendar-clock',
            label: 'Mesailer',
            color: '#EC4899',
            onPress: () => navigation.navigate('TechnicianShifts', { technicianId: technician.id }),
        },
    ];

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.card,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.92 : 1,
                },
            ]}
        >
            {/* Top row: avatar + info + status */}
            <View style={styles.cardTopRow}>
                <View style={styles.avatarStack}>
                    <View
                        style={[
                            styles.avatarRing,
                            { borderColor: statusColor },
                        ]}
                    >
                        {avatar ? (
                            <Image source={{ uri: avatar }} style={styles.avatar} />
                        ) : (
                            <View
                                style={[
                                    styles.avatarFallback,
                                    { backgroundColor: `${statusColor}20` },
                                ]}
                            >
                                <Text style={[styles.avatarText, { color: statusColor }]}>{initials}</Text>
                            </View>
                        )}
                    </View>
                    {isOnline ? (
                        <View
                            style={[
                                styles.onlineDot,
                                {
                                    backgroundColor: '#22C55E',
                                    borderColor: colors.surface,
                                },
                            ]}
                        />
                    ) : null}
                </View>

                <View style={styles.cardInfo}>
                    <View style={styles.nameRow}>
                        <Text
                            style={[styles.name, { color: colors.text }]}
                            numberOfLines={1}
                        >
                            {fullName}
                        </Text>
                        <View
                            style={[
                                styles.statusBadge,
                                { backgroundColor: `${statusColor}15`, borderColor: `${statusColor}30` },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name={statusMeta.icon}
                                size={11}
                                color={statusColor}
                            />
                            <Text style={[styles.statusText, { color: statusColor }]}>
                                {statusMeta.label}
                            </Text>
                        </View>
                    </View>
                    {email ? (
                        <View style={styles.metaLine}>
                            <MaterialCommunityIcons
                                name="email-outline"
                                size={12}
                                color={colors.textTertiary}
                            />
                            <Text
                                style={[styles.metaText, { color: colors.textSecondary }]}
                                numberOfLines={1}
                            >
                                {email}
                            </Text>
                        </View>
                    ) : null}
                    {phone ? (
                        <View style={styles.metaLine}>
                            <MaterialCommunityIcons
                                name="phone-outline"
                                size={12}
                                color={colors.textTertiary}
                            />
                            <Text
                                style={[styles.metaText, { color: colors.textSecondary }]}
                                numberOfLines={1}
                            >
                                {phone}
                            </Text>
                        </View>
                    ) : null}
                </View>
            </View>

            {/* Quick call row */}
            <View
                style={[
                    styles.quickRow,
                    { backgroundColor: isDark ? colors.surfaceMuted : colors.backgroundSecondary },
                ]}
            >
                <Pressable
                    onPress={handleCall}
                    disabled={!phone}
                    style={({ pressed }) => [
                        styles.quickBtn,
                        {
                            opacity: !phone ? 0.4 : pressed ? 0.7 : 1,
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.quickIcon,
                            { backgroundColor: `${serviceBlue}15` },
                        ]}
                    >
                        <MaterialCommunityIcons name="phone" size={14} color={serviceBlue} />
                    </View>
                    <Text style={[styles.quickText, { color: colors.text }]}>Ara</Text>
                </Pressable>

                <View style={[styles.quickDivider, { backgroundColor: colors.divider }]} />

                <Pressable
                    onPress={handleWhatsApp}
                    disabled={!phone}
                    style={({ pressed }) => [
                        styles.quickBtn,
                        {
                            opacity: !phone ? 0.4 : pressed ? 0.7 : 1,
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.quickIcon,
                            { backgroundColor: '#25D36615' },
                        ]}
                    >
                        <MaterialCommunityIcons name="whatsapp" size={14} color="#25D366" />
                    </View>
                    <Text style={[styles.quickText, { color: colors.text }]}>WhatsApp</Text>
                </Pressable>

                <View style={[styles.quickDivider, { backgroundColor: colors.divider }]} />

                <Pressable
                    onPress={handleEmail}
                    disabled={!email}
                    style={({ pressed }) => [
                        styles.quickBtn,
                        {
                            opacity: !email ? 0.4 : pressed ? 0.7 : 1,
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.quickIcon,
                            { backgroundColor: `${serviceRed}15` },
                        ]}
                    >
                        <MaterialCommunityIcons name="email" size={14} color={serviceRed} />
                    </View>
                    <Text style={[styles.quickText, { color: colors.text }]}>E-posta</Text>
                </Pressable>
            </View>

            {/* Action grid - 2x2 */}
            <View style={styles.actionsGrid}>
                {primaryActions.map((action) => (
                    <Pressable
                        key={action.key}
                        onPress={action.onPress}
                        style={({ pressed }) => [
                            styles.actionChip,
                            {
                                backgroundColor: pressed
                                    ? `${action.color}25`
                                    : `${action.color}10`,
                                borderColor: `${action.color}30`,
                            },
                        ]}
                    >
                        <View
                            style={[
                                styles.actionIconWrap,
                                { backgroundColor: `${action.color}20` },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name={action.icon}
                                size={16}
                                color={action.color}
                            />
                        </View>
                        <Text
                            style={[styles.actionLabel, { color: action.color }]}
                            numberOfLines={1}
                        >
                            {action.label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* Footer chevron */}
            <View style={styles.cardFooter}>
                <Text style={[styles.cardFooterText, { color: colors.textTertiary }]}>
                    Detayları gör
                </Text>
                <MaterialCommunityIcons
                    name="chevron-right"
                    size={16}
                    color={colors.textTertiary}
                />
            </View>
        </Pressable>
    );
};

const StatCard = ({ icon, label, value, color, isDark }) => (
    <View
        style={[
            styles.statCard,
            {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                borderColor: `${color}30`,
            },
        ]}
    >
        <View
            style={[
                styles.statIconWrap,
                { backgroundColor: `${color}18` },
            ]}
        >
            <MaterialCommunityIcons name={icon} size={16} color={color} />
        </View>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

export default function TechnicianListScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();

    const [technicians, setTechnicians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    const fetchTechnicians = useCallback(async () => {
        try {
            const response = await api.get(ENDPOINTS.TECHNICIAN.LIST);
            setTechnicians(Array.isArray(response?.data) ? response.data : []);
        } catch (error) {
            console.log(
                'Technicians fetch error:',
                error?.response?.data || error?.message || error
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTechnicians();
    }, [fetchTechnicians]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchTechnicians();
        setRefreshing(false);
    };

    const counts = useMemo(() => {
        const list = Array.isArray(technicians) ? technicians : [];
        return {
            total: list.length,
            available: list.filter((t) => t.status === 'available').length,
            busy: list.filter((t) => t.status === 'busy').length,
            offduty: list.filter((t) => t.status === 'offduty').length,
            online: list.filter((t) => t.is_online).length,
        };
    }, [technicians]);

    const filtered = useMemo(() => {
        let list = Array.isArray(technicians) ? technicians : [];
        if (activeFilter !== 'all') {
            list = list.filter((t) => (t.status || 'offduty') === activeFilter);
        }
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter((t) => {
                const fullName = t.user?.full_name || t.full_name || '';
                const email = t.user?.email || '';
                const phone = t.user?.phone_number || '';
                return (
                    fullName.toLowerCase().includes(q) ||
                    email.toLowerCase().includes(q) ||
                    phone.toLowerCase().includes(q)
                );
            });
        }
        return list;
    }, [technicians, activeFilter, search]);

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            {/* Gradient header */}
            <LinearGradient
                colors={
                    isDark
                        ? [`${serviceBlue}30`, `${serviceBlue}00`]
                        : [`${serviceBlue}14`, `${serviceBlue}00`]
                }
                style={[styles.headerGradient, { paddingTop: insets.top + 8 }]}
            >
                <View style={styles.headerRow}>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        style={({ pressed }) => [
                            styles.headerBtn,
                            {
                                backgroundColor: isDark
                                    ? colors.surface
                                    : '#FFFFFF',
                                borderColor: colors.border,
                                opacity: pressed ? 0.7 : 1,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="arrow-left"
                            size={22}
                            color={colors.text}
                        />
                    </Pressable>
                    <View style={styles.headerTitleWrap}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>
                            Teknisyenler
                        </Text>
                        <Text
                            style={[styles.headerSubtitle, { color: colors.textSecondary }]}
                            numberOfLines={1}
                        >
                            Saha ekibini yönet
                        </Text>
                    </View>
                    <Pressable
                        onPress={handleRefresh}
                        style={({ pressed }) => [
                            styles.headerBtn,
                            {
                                backgroundColor: isDark
                                    ? colors.surface
                                    : '#FFFFFF',
                                borderColor: colors.border,
                                opacity: pressed ? 0.7 : 1,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="refresh"
                            size={20}
                            color={colors.primary}
                        />
                    </Pressable>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.container,
                    { paddingBottom: insets.bottom + 24 },
                ]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                        progressBackgroundColor={isDark ? colors.surface : '#FFFFFF'}
                    />
                }
                keyboardShouldPersistTaps="handled"
            >
                {/* Stats row */}
                <View style={styles.statsGrid}>
                    <StatCard
                        icon="account-group"
                        label="Toplam"
                        value={counts.total}
                        color={serviceBlue}
                        isDark={isDark}
                    />
                    <StatCard
                        icon="check-decagram"
                        label="Müsait"
                        value={counts.available}
                        color="#22C55E"
                        isDark={isDark}
                    />
                    <StatCard
                        icon="progress-clock"
                        label="Meşgul"
                        value={counts.busy}
                        color="#EF4444"
                        isDark={isDark}
                    />
                    <StatCard
                        icon="circle-double"
                        label="Çevrimiçi"
                        value={counts.online}
                        color="#0EA5E9"
                        isDark={isDark}
                    />
                </View>

                {/* Search */}
                <View
                    style={[
                        styles.searchWrap,
                        {
                            backgroundColor: isDark ? colors.surface : '#FFFFFF',
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="magnify"
                        size={18}
                        color={colors.textTertiary}
                    />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="İsim, e-posta veya telefon ile ara"
                        placeholderTextColor={colors.textTertiary}
                        style={[styles.searchInput, { color: colors.text }]}
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    {search ? (
                        <Pressable onPress={() => setSearch('')} hitSlop={8}>
                            <MaterialCommunityIcons
                                name="close-circle"
                                size={16}
                                color={colors.textTertiary}
                            />
                        </Pressable>
                    ) : null}
                </View>

                {/* Filter chips */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                >
                    {FILTER_TABS.map((tab) => {
                        const isActive = activeFilter === tab.key;
                        const color = tab.color || serviceBlue;
                        const tabCount = tab.key === 'all'
                            ? counts.total
                            : counts[tab.key] || 0;
                        return (
                            <Pressable
                                key={tab.key}
                                onPress={() => setActiveFilter(tab.key)}
                                style={({ pressed }) => [
                                    styles.filterChip,
                                    {
                                        backgroundColor: isActive
                                            ? `${color}15`
                                            : isDark
                                                ? colors.surface
                                                : '#FFFFFF',
                                        borderColor: isActive
                                            ? `${color}50`
                                            : colors.border,
                                        opacity: pressed ? 0.85 : 1,
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name={tab.icon}
                                    size={14}
                                    color={isActive ? color : colors.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.filterLabel,
                                        {
                                            color: isActive ? color : colors.textSecondary,
                                        },
                                    ]}
                                >
                                    {tab.label}
                                </Text>
                                <View
                                    style={[
                                        styles.filterCount,
                                        {
                                            backgroundColor: isActive
                                                ? `${color}25`
                                                : colors.divider,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.filterCountText,
                                            {
                                                color: isActive
                                                    ? color
                                                    : colors.textTertiary,
                                            },
                                        ]}
                                    >
                                        {tabCount}
                                    </Text>
                                </View>
                            </Pressable>
                        );
                    })}
                </ScrollView>

                {/* List */}
                {loading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                            Teknisyenler yükleniyor...
                        </Text>
                    </View>
                ) : filtered.length > 0 ? (
                    <>
                        <View style={styles.resultsHeader}>
                            <Text style={[styles.resultsText, { color: colors.textSecondary }]}>
                                {filtered.length} teknisyen
                            </Text>
                            {(search || activeFilter !== 'all') ? (
                                <Pressable
                                    onPress={() => {
                                        setSearch('');
                                        setActiveFilter('all');
                                    }}
                                    hitSlop={8}
                                >
                                    <Text style={[styles.resetText, { color: colors.primary }]}>
                                        Temizle
                                    </Text>
                                </Pressable>
                            ) : null}
                        </View>
                        {filtered.map((tech) => (
                            <TechnicianCard
                                key={tech.id}
                                technician={tech}
                                navigation={navigation}
                                onPress={() =>
                                    navigation.navigate('TechnicianDetail', {
                                        technicianId: tech.id,
                                    })
                                }
                            />
                        ))}
                    </>
                ) : (
                    <View
                        style={[
                            styles.emptyCard,
                            {
                                backgroundColor: isDark
                                    ? colors.surface
                                    : '#FFFFFF',
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <View
                            style={[
                                styles.emptyIconWrap,
                                { backgroundColor: `${colors.primary}12` },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name={
                                    search || activeFilter !== 'all'
                                        ? 'account-search-outline'
                                        : 'account-group-outline'
                                }
                                size={36}
                                color={colors.primary}
                            />
                        </View>
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>
                            {search || activeFilter !== 'all'
                                ? 'Sonuç bulunamadı'
                                : 'Henüz teknisyen yok'}
                        </Text>
                        <Text
                            style={[styles.emptySubtitle, { color: colors.textSecondary }]}
                        >
                            {search || activeFilter !== 'all'
                                ? 'Arama veya filtre kriterlerinize uygun teknisyen bulunamadı.'
                                : 'Yeni teknisyen eklendiğinde burada görünecek.'}
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    headerGradient: {
        paddingHorizontal: 16,
        paddingBottom: 14,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
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
    headerTitleWrap: { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.2 },
    headerSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
    scrollView: { flex: 1 },
    container: { paddingHorizontal: 16, paddingTop: 6 },
    statsGrid: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
    },
    statCard: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    statIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    statValue: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
    statLabel: { fontSize: 10, fontWeight: '600', color: '#5C6370', marginTop: 2, letterSpacing: 0.2 },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        paddingVertical: 0,
    },
    filterRow: {
        gap: 8,
        paddingBottom: 4,
        paddingRight: 4,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
    },
    filterLabel: { fontSize: 12, fontWeight: '700' },
    filterCount: {
        minWidth: 22,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterCountText: { fontSize: 10, fontWeight: '800' },
    resultsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    resultsText: { fontSize: 12, fontWeight: '700' },
    resetText: { fontSize: 12, fontWeight: '800' },
    loadingWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 10,
    },
    loadingText: { fontSize: 13, fontWeight: '500' },
    card: {
        borderRadius: 18,
        borderWidth: 1,
        padding: 14,
        marginBottom: 12,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 12,
    },
    avatarStack: {
        position: 'relative',
    },
    avatarRing: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
    },
    avatarFallback: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { fontSize: 18, fontWeight: '800' },
    onlineDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2.5,
    },
    cardInfo: { flex: 1, minWidth: 0 },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    name: {
        fontSize: 15,
        fontWeight: '800',
        flexShrink: 1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
    },
    statusText: { fontSize: 10, fontWeight: '800' },
    metaLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 2,
    },
    metaText: { fontSize: 12, fontWeight: '500', flexShrink: 1 },
    quickRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingVertical: 8,
        marginBottom: 10,
    },
    quickBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 4,
    },
    quickIcon: {
        width: 26,
        height: 26,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickText: { fontSize: 12, fontWeight: '700' },
    quickDivider: {
        width: 1,
        height: 22,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    actionChip: {
        flexBasis: '48%',
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 9,
        borderRadius: 10,
        borderWidth: 1,
        minHeight: 40,
    },
    actionIconWrap: {
        width: 24,
        height: 24,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionLabel: {
        fontSize: 12,
        fontWeight: '800',
        flexShrink: 1,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 2,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.04)',
    },
    cardFooterText: { fontSize: 11, fontWeight: '600' },
    emptyCard: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 24,
        borderRadius: 18,
        borderWidth: 1,
        marginTop: 20,
    },
    emptyIconWrap: {
        width: 72,
        height: 72,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
    emptySubtitle: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19 },
});
