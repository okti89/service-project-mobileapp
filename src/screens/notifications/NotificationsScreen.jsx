import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';

import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import Header from '@/components/Header';
import WrapperContainer from '@/components/WrapperContainer';
import { useTheme } from '@/context/ThemeContext';
import { useNotifications } from '@/context/NotificationContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';

const FILTERS = [
    { key: 'all', label: 'Tümü' },
    { key: 'unread', label: 'Okunmamış' },
    { key: 'service', label: 'Servis' },
    { key: 'accounting', label: 'Muhasebe' },
];

const getNotificationMeta = (item) => {
    const title = String(item?.title || '').toLocaleLowerCase('tr-TR');
    const message = String(item?.message || '').toLocaleLowerCase('tr-TR');
    const relatedScreen = String(item?.related_screen || '').toLocaleLowerCase('tr-TR');
    const blob = `${title} ${message} ${relatedScreen}`;

    if (blob.includes('odeme') || blob.includes('tahsilat') || blob.includes('muhasebe') || blob.includes('bordro') || blob.includes('maas')) {
        return {
            category: 'accounting',
            icon: 'wallet-outline',
            color: serviceGreen,
            actionLabel: null,
        };
    }

    if (blob.includes('mesaj')) {
        return {
            category: 'message',
            icon: 'message-text-outline',
            color: '#7C3AED',
            actionLabel: null,
        };
    }

    if (blob.includes('stok')) {
        return {
            category: 'inventory',
            icon: 'alert-outline',
            color: serviceRed,
            actionLabel: null,
        };
    }

    if (
        blob.includes('servis')
        || blob.includes('gorev')
        || blob.includes('gecikme')
        || blob.includes('hatirlatma')
        || blob.includes('uyari')
        || relatedScreen.includes('service')
    ) {
        return {
            category: 'service',
            icon: blob.includes('geçikme') ? 'clock-outline' : 'wrench-outline',
            color: blob.includes('geçikme') ? serviceOrange : serviceBlue,
            actionLabel: item?.related_id ? 'Servisi Aç' : null,
        };
    }

    return {
        category: 'general',
        icon: 'bell-outline',
        color: serviceBlue,
        actionLabel: null,
    };
};

const formatClock = (value) => {
    if (!value) return '';
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('HH:mm') : '';
};

const formatGroupLabel = (dateValue) => {
    const date = dayjs(dateValue);
    if (!date.isValid()) return 'Daha Eski';
    if (date.isSame(dayjs(), 'day')) return 'Bugun';
    if (date.isSame(dayjs().subtract(1, 'day'), 'day')) return 'Dun';
    return date.format('DD MMMM');
};

const openServiceDetail = (navigation, item) => {
    if (!item?.related_id) return false;

    try {
        navigation.navigate('ServiceDetail', { serviceId: item.related_id });
        return true;
    } catch (error) {
        console.log('Notification service navigation error:', error?.message || error);
        return false;
    }
};

function FilterTab({ item, active, count, colors, onPress }) {
    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.filterTab,
                {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                },
            ]}
        >
            <Text style={[styles.filterText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>{item.label}</Text>
            {typeof count === 'number' ? (
                <View style={[styles.filterBadge, { backgroundColor: active ? 'rgba(255,255,255,0.22)' : `${colors.primary}14` }]}>
                    <Text style={[styles.filterBadgeText, { color: active ? '#FFFFFF' : colors.primary }]}>{count}</Text>
                </View>
            ) : null}
        </Pressable>
    );
}

function SectionHeader({ label, colors }) {
    return (
        <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{label}</Text>
        </View>
    );
}

function NotificationCard({ item, colors, onPress, onLongPress, onActionPress }) {
    const meta = getNotificationMeta(item);
    const unread = !item.is_read;
    const showAction = meta.category === 'service' && Boolean(meta.actionLabel);

    return (
        <Pressable
            onPress={() => onPress(item)}
            onLongPress={() => onLongPress(item)}
            delayLongPress={350}
            style={({ pressed }) => [
                styles.card,
                {
                    backgroundColor: colors.surface,
                    borderColor: unread ? `${colors.primary}45` : colors.border,
                    opacity: pressed ? 0.94 : 1,
                },
            ]}
        >
            <View style={[styles.iconWrap, { backgroundColor: `${meta.color}14` }]}>
                <MaterialCommunityIcons name={meta.icon} size={20} color={meta.color} />
            </View>

            <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                    {unread ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}
                </View>

                <Text style={[styles.cardMessage, { color: colors.textSecondary }]} numberOfLines={2}>{item.message}</Text>

                <View style={styles.cardBottomRow}>
                    <View style={styles.timeRow}>
                        <MaterialCommunityIcons name="clock-time-four-outline" size={13} color={colors.textTertiary} />
                        <Text style={[styles.timeText, { color: colors.textTertiary }]}>{formatClock(item.created_at) || 'Simdi'}</Text>
                    </View>

                    {showAction ? (
                        <Pressable onPress={() => onActionPress(item)} style={[styles.primaryAction, { backgroundColor: colors.primary }]}>
                            <Text style={styles.primaryActionText}>{meta.actionLabel}</Text>
                            <MaterialCommunityIcons name="chevron-right" size={14} color="#FFFFFF" />
                        </Pressable>
                    ) : null}
                </View>
            </View>
        </Pressable>
    );
}

export default function NotificationsScreen() {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const { updateUnreadCount } = useNotifications() || {};

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');

    const loadNotifications = useCallback(async () => {
        try {
            const response = await api.get(ENDPOINTS.NOTIFICATIONS.LIST);
            const rows = Array.isArray(response?.data) ? response.data : [];
            rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            setNotifications(rows);
        } catch (error) {
            console.log('Notifications load error:', error?.response?.data || error?.message || error);
            setNotifications([]);
        }
    }, []);

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            await loadNotifications();
            setLoading(false);
        };
        run();
    }, [loadNotifications]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([loadNotifications(), updateUnreadCount?.()]);
        setRefreshing(false);
    }, [loadNotifications, updateUnreadCount]);

    const markAsRead = useCallback(async (item) => {
        if (item.is_read) return;
        try {
            await api.patch(ENDPOINTS.NOTIFICATIONS.DETAIL(item.id));
            setNotifications((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, is_read: true } : entry)));
            await updateUnreadCount?.();
        } catch (error) {
            console.log('Notification mark read error:', error?.response?.data || error?.message || error);
        }
    }, [updateUnreadCount]);

    const deleteItem = useCallback(async (item) => {
        try {
            await api.delete(ENDPOINTS.NOTIFICATIONS.DETAIL(item.id));
            setNotifications((prev) => prev.filter((entry) => entry.id !== item.id));
            if (!item.is_read) {
                await updateUnreadCount?.();
            }
        } catch (error) {
            console.log('Notification delete error:', error?.response?.data || error?.message || error);
        }
    }, [updateUnreadCount]);

    const handlePress = useCallback((item) => {
        markAsRead(item);
    }, [markAsRead]);

    const handleActionPress = useCallback((item) => {
        openServiceDetail(navigation, item);
        markAsRead(item);
    }, [markAsRead, navigation]);

    const handleLongPress = useCallback((item) => {
        Alert.alert('Bildirim Islemleri', item.title, [
            { text: 'Okundu Isaretle', onPress: () => markAsRead(item) },
            { text: 'Sil', style: 'destructive', onPress: () => deleteItem(item) },
            { text: 'Vazgec', style: 'cancel' },
        ]);
    }, [deleteItem, markAsRead]);

    const markAllAsRead = useCallback(async () => {
        const unreadItems = notifications.filter((entry) => !entry.is_read);
        if (!unreadItems.length) return;
        try {
            await Promise.all(unreadItems.map((entry) => api.patch(ENDPOINTS.NOTIFICATIONS.DETAIL(entry.id)).catch(() => null)));
            setNotifications((prev) => prev.map((entry) => ({ ...entry, is_read: true })));
            await updateUnreadCount?.();
        } catch (error) {
            console.log('Notification mark all error:', error?.response?.data || error?.message || error);
        }
    }, [notifications, updateUnreadCount]);

    const counts = useMemo(() => {
        const unread = notifications.filter((item) => !item.is_read).length;
        const service = notifications.filter((item) => getNotificationMeta(item).category === 'service').length;
        const accounting = notifications.filter((item) => getNotificationMeta(item).category === 'accounting').length;
        return {
            all: notifications.length,
            unread,
            service,
            accounting,
        };
    }, [notifications]);

    const filteredNotifications = useMemo(() => {
        return notifications.filter((item) => {
            const meta = getNotificationMeta(item);
            if (activeFilter === 'unread') return !item.is_read;
            if (activeFilter === 'service') return meta.category === 'service';
            if (activeFilter === 'accounting') return meta.category === 'accounting';
            return true;
        });
    }, [activeFilter, notifications]);

    const listItems = useMemo(() => {
        const result = [];
        let currentGroup = '';

        filteredNotifications.forEach((item) => {
            const label = formatGroupLabel(item.created_at);
            if (label !== currentGroup) {
                currentGroup = label;
                result.push({ type: 'section', key: `section-${label}`, label });
            }
            result.push({ type: 'item', key: `notification-${item.id}`, item });
        });

        return result;
    }, [filteredNotifications]);

    const renderHeader = () => (
        <View style={styles.topArea}>
            {counts.unread > 0 ? (
                <Pressable onPress={markAllAsRead} style={styles.markAllWrap}>
                    <Text style={[styles.markAllText, { color: colors.primary }]}>Tümünü Okundu İşaretle</Text>
                </Pressable>
            ) : null}

            <View style={[styles.filterRail, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {FILTERS.map((filter) => (
                    <FilterTab
                        key={filter.key}
                        item={filter}
                        active={activeFilter === filter.key}
                        count={counts[filter.key]}
                        colors={colors}
                        onPress={() => setActiveFilter(filter.key)}
                    />
                ))}
            </View>
        </View>
    );

    return (
        <WrapperContainer bg={colors.background}>
            <Header title="Bildirimler" showBack backVariant="minimal" borderBottom />

            {loading ? (
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={listItems}
                    keyExtractor={(item) => item.key}
                    renderItem={({ item }) => item.type === 'section'
                        ? <SectionHeader label={item.label} colors={colors} />
                        : <NotificationCard item={item.item} colors={colors} onPress={handlePress} onLongPress={handleLongPress} onActionPress={handleActionPress} />}
                    ListHeaderComponent={renderHeader}
                    ListEmptyComponent={
                        <View style={styles.centerState}>
                            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
                                <MaterialCommunityIcons name="bell-off-outline" size={30} color={colors.textTertiary} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>Bildirim bulunamadi</Text>
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Yeni bildirimler geldikce bu ekranda gorunecek.</Text>
                        </View>
                    }
                    contentContainerStyle={[styles.listContent, listItems.length === 0 && styles.emptyListContent]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.m,
        paddingBottom: spacing['4xl'],
    },
    emptyListContent: {
        flexGrow: 1,
    },
    topArea: {
        gap: spacing.s,
        marginBottom: spacing.xs,
    },
    markAllWrap: {
        alignSelf: 'flex-end',
    },
    markAllText: {
        ...typography.caption,
        fontWeight: '700',
    },
    filterRail: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderRadius: 18,
        borderWidth: 1,
        padding: 4,
        gap: 4,
    },
    filterTab: {
        minHeight: 36,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    filterText: {
        ...typography.caption,
        fontWeight: '700',
    },
    filterBadge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterBadgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    sectionRow: {
        paddingTop: spacing.m,
        paddingBottom: spacing.xs,
    },
    sectionTitle: {
        ...typography.bodySmall,
        fontWeight: '700',
    },
    card: {
        flexDirection: 'row',
        gap: spacing.s,
        borderRadius: 18,
        borderWidth: 1,
        padding: spacing.m,
        shadowColor: '#0F172A',
        shadowOpacity: 0.03,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 1,
        marginBottom: spacing.s,
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardBody: {
        flex: 1,
        gap: 6,
        minWidth: 0,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cardTitle: {
        ...typography.bodySmall,
        fontWeight: '800',
        flex: 1,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    cardMessage: {
        ...typography.caption,
        lineHeight: 19,
    },
    cardBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.s,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexShrink: 1,
    },
    timeText: {
        ...typography.caption,
        fontSize: 11,
        fontWeight: '600',
    },
    primaryAction: {
        minHeight: 34,
        borderRadius: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        flexShrink: 0,
    },
    primaryActionText: {
        ...typography.caption,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    centerState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing['3xl'],
        gap: spacing.m,
    },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: {
        ...typography.h3,
    },
    emptyText: {
        ...typography.bodySmall,
        textAlign: 'center',
        maxWidth: 280,
        lineHeight: 22,
    },
});
