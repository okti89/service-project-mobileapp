import React, { useCallback, useMemo } from 'react';
import {
    Image,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';
import { resolveMediaUrl } from '@/utils/mediaUrl';

const getInitials = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const resolveTechnicianAvatar = (service) => resolveMediaUrl(
    service?.technician_avatar
    || service?.assigned_technician_avatar
    || service?.technician_avatar_url
    || service?.assigned_technician_avatar_url
    || service?.technician?.avatar
    || service?.technician?.avatar_url
    || service?.technician_user?.avatar
    || service?.technician_user?.avatar_url
    || service?.user?.avatar
    || service?.user?.avatar_url
);

const formatCurrency = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        maximumFractionDigits: 2,
    }).format(amount);
};

export default function ServiceListItem({
    service,
    onPress,
    onPressActions,
    onPressTechnician,
    onPressStatus,
    isTechnicianEditable = false,
    isStatusEditable = false,
}) {
    const { colors, isDark } = useTheme();

    const statusColor = useMemo(() => service?.status_color || colors.primary, [service?.status_color, colors.primary]);
    const statusName = useMemo(() => service?.status_name || service?.service_status || 'Bilinmiyor', [service?.status_name, service?.service_status]);
    const scheduled = useMemo(() => (service?.scheduled_date ? dayjs(service.scheduled_date) : null), [service?.scheduled_date]);
    const technicianName = service?.technician_full_name || service?.technician_name || 'Atanmamış';
    const technicianAvatar = useMemo(() => resolveTechnicianAvatar(service), [service]);
    const technicianInitials = useMemo(() => getInitials(technicianName), [technicianName]);
    const totalPriceLabel = useMemo(() => formatCurrency(service?.total_price), [service?.total_price]);

    const timeLabel = scheduled ? scheduled.format('HH:mm') : '--:--';
    const dateLabel = scheduled ? scheduled.format('DD MMM') : '—';
    const dayLabel = scheduled ? scheduled.format('ddd') : '';

    const handlePress = useCallback(() => onPress?.(service), [onPress, service]);
    const handleActions = useCallback(() => onPressActions?.(service), [onPressActions, service]);
    const handleTechnicianPress = useCallback(() => {
        if (!isTechnicianEditable) return;
        onPressTechnician?.(service);
    }, [isTechnicianEditable, onPressTechnician, service]);
    const handleStatusPress = useCallback(() => {
        if (!isStatusEditable) return;
        onPressStatus?.(service);
    }, [isStatusEditable, onPressStatus, service]);

    const secondaryText = isDark ? '#9BA2AF' : '#6B7280';
    const cardBg = isDark ? colors.surface : '#FFFFFF';
    const cardBorder = `${statusColor}${isDark ? '38' : '24'}`;
    const actionBg = isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC';
    const actionBorder = isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0';
    const actionTextColor = isDark ? '#E5E7EB' : '#475569';

    return (
        <Pressable
            onPress={handlePress}
            android_ripple={{ color: `${statusColor}18`, borderless: false }}
            style={({ pressed }) => [
                styles.card,
                {
                    backgroundColor: cardBg,
                    borderColor: cardBorder,
                    transform: [{ scale: pressed ? 0.992 : 1 }],
                    opacity: pressed ? 0.96 : 1,
                    ...Platform.select({
                        ios: {
                            shadowColor: isDark ? '#000' : statusColor,
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: isDark ? 0.25 : 0.08,
                            shadowRadius: 18,
                        },
                        android: { elevation: 3 },
                    }),
                },
            ]}
        >
            <View style={styles.inner}>
                <View style={styles.topRow}>
                    <View style={[styles.timeBlock, { backgroundColor: `${statusColor}10`, borderColor: `${statusColor}20` }]}>
                        <Text style={[styles.time, { color: statusColor }]}>{timeLabel}</Text>
                        <Text style={[styles.dateSmall, { color: statusColor, opacity: 0.8 }]}>{dateLabel}</Text>
                        <Text style={[styles.daySmall, { color: secondaryText }]}>{dayLabel}</Text>
                    </View>

                    <View style={styles.customerBlock}>
                        <View style={styles.customerTitleRow}>
                            <Text style={[styles.customerName, { color: colors.text }]} numberOfLines={1}>
                                {service?.customer_full_name || 'Müşteri'}
                            </Text>
                            <MaterialCommunityIcons name="chevron-right" size={18} color={secondaryText} />
                        </View>

                        {service?.customer_address ? (
                            <View style={styles.addressRow}>
                                <MaterialCommunityIcons name="map-marker" size={12} color={statusColor} />
                                <Text style={[styles.addressText, { color: secondaryText }]} numberOfLines={1}>
                                    {service.customer_address}
                                </Text>
                            </View>
                        ) : null}

                        {totalPriceLabel ? (
                            <Text style={[styles.priceText, { color: statusColor }]} numberOfLines={1}>
                                İşlem Fiyatı: {totalPriceLabel}
                            </Text>
                        ) : null}
                    </View>

                    <Pressable
                        onPress={handleStatusPress}
                        disabled={!isStatusEditable}
                        hitSlop={6}
                        style={({ pressed }) => [
                            styles.statusPill,
                            {
                                backgroundColor: `${statusColor}10`,
                                borderColor: `${statusColor}24`,
                                opacity: pressed && isStatusEditable ? 0.82 : 1,
                            },
                        ]}
                    >
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
                            {statusName}
                        </Text>
                        {isStatusEditable ? (
                            <MaterialCommunityIcons name="chevron-down" size={14} color={statusColor} />
                        ) : null}
                    </Pressable>
                </View>

                <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)' }]} />
                <View style={styles.bottomRow}>
                    <Pressable
                        onPress={handleTechnicianPress}
                        disabled={!isTechnicianEditable}
                        hitSlop={6}
                        style={({ pressed }) => [
                            styles.techRow,
                            {
                                backgroundColor: pressed && isTechnicianEditable ? `${statusColor}08` : 'transparent',
                                borderColor: `${statusColor}18`,
                            },
                        ]}
                    >
                        {technicianAvatar ? (
                            <Image source={{ uri: technicianAvatar }} style={[styles.techAvatar, { borderColor: `${statusColor}40` }]} />
                        ) : (
                            <View style={[styles.techAvatar, styles.techAvatarFallback, { backgroundColor: `${statusColor}18`, borderColor: `${statusColor}30` }]}>
                                <Text style={[styles.techInitials, { color: statusColor }]}>{technicianInitials}</Text>
                            </View>
                        )}
                        <View style={styles.techInfo}>
                            <Text style={[styles.techLabel, { color: secondaryText }]}>Teknisyen</Text>
                            <Text style={[styles.techName, { color: colors.text }]} numberOfLines={1}>
                                {technicianName}
                            </Text>
                        </View>
                        {isTechnicianEditable ? (
                            <Text style={[styles.changeText, { color: statusColor }]}>Değiştir</Text>
                        ) : null}
                    </Pressable>

                    <Pressable
                        onPress={handleActions}
                        android_ripple={{ color: `${statusColor}18`, borderless: false }}
                        style={({ pressed }) => [
                            styles.actionsBtn,
                            {
                                backgroundColor: pressed ? `${statusColor}12` : actionBg,
                                borderColor: pressed ? `${statusColor}24` : actionBorder,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons name="dots-horizontal" size={16} color={actionTextColor} />
                        <Text style={[styles.actionsBtnText, { color: actionTextColor }]}>İşlemler</Text>
                    </Pressable>
                </View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        marginBottom: spacing.m,
        overflow: 'hidden',
        width: '100%',
        alignSelf: 'stretch',
    },
    inner: {
        flex: 1,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.m,
        gap: spacing.m,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.m,
    },
    timeBlock: {
        borderRadius: 10,
        borderWidth: 1,
        paddingVertical: spacing.s,
        paddingHorizontal: spacing.s + 1,
        alignItems: 'center',
        minWidth: 56,
    },
    time: {
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: -0.4,
        lineHeight: 20,
    },
    dateSmall: {
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
        letterSpacing: 0.1,
    },
    daySmall: {
        fontSize: 9,
        fontWeight: '600',
        marginTop: 1,
        textTransform: 'capitalize',
    },
    customerBlock: {
        flex: 1,
        minWidth: 0,
        gap: 4,
    },
    customerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.s,
    },
    customerName: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    addressText: {
        fontSize: 11,
        fontWeight: '500',
        flexShrink: 1,
    },
    priceText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: -0.1,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 5,
        borderWidth: 1,
        maxWidth: 142,
        minWidth: 104,
        alignSelf: 'flex-start',
    },
    statusDot: {
        width: 6,
        height: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.1,
        flexShrink: 1,
        textTransform: 'uppercase',
    },
    divider: {
        height: 1,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
    },
    techRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s + 1,
        minWidth: 0,
        borderWidth: 1,
        paddingVertical: 4,
        paddingHorizontal: 4,
        marginHorizontal: -4,
    },
    techAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
    },
    techAvatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    techInitials: {
        fontSize: 11,
        fontWeight: '800',
    },
    techInfo: {
        flex: 1,
        minWidth: 0,
    },
    techLabel: {
        fontSize: 9,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    techName: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: -0.2,
        marginTop: 1,
    },
    changeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    actionsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderWidth: 1,
    },
    actionsBtnText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: -0.1,
    },
});
