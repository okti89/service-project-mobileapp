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

const PAGE_SIZE = 50;

const mergeNotifications = (currentItems, nextItems, replace = false) => {
    const source = replace ? nextItems : [...currentItems, ...nextItems];
    const seen = new Set();

    return source.filter((item) => {
        const key = String(item?.id ?? '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const parseNotificationResponse = (payload) => {
    if (Array.isArray(payload)) {
        return {
            items: payload,
            nextPage: null,
            totalCount: payload.length,
        };
    }

    const items = Array.isArray(payload?.results) ? payload.results : [];
    let nextPage = null;

    if (payload?.next) {
        const match = String(payload.next).match(/[?&]page=(\d+)/);
        nextPage = match ? Number(match[1]) : null;
    }

    return {
        items,
        nextPage,
        totalCount: Number(payload?.count || items.length || 0),
    };
};

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
        || blob.includes('görev')
        || blob.includes('gecikme')
        || blob.includes('hatırlatma')
        || blob.includes('uyarı')
        || relatedScreen.includes('service')
    ) {
        return {
            category: 'service',
            icon: blob.includes('gecikme') ? 'clock-outline' : 'wrench-outline',
            color: blob.includes('gecikme') ? serviceOrange : serviceBlue,
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
    if (date.isSame(dayjs(), 'day')) return 'Bugün';
    if (date.isSame(dayjs().subtract(1, 'day'), 'day')) return 'Dün';
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

function ListFooter({ loadingMore, hasMore, colors, onLoadMore }) {
    if (loadingMore) {
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
            </View>
        );
    }

    if (!hasMore) {
        return <View style={styles.footerSpacer} />;
    }

    return (
        <Pressable
            onPress={onLoadMore}
            style={({ pressed }) => [
                styles.moreButton,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.9 : 1,
                },
            ]}
        >
            <Text style={[styles.moreButtonText, { color: colors.primary }]}>Daha Fazla</Text>
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
    const [loadingMore, setLoadingMore] = useState(false);
    const [nextPage, setNextPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const loadNotifications = useCallback(async ({ page = 1, replace = false } = {}) => {
        try {
            const response = await api.get(ENDPOINTS.NOTIFICATIONS.LIST, {
                params: {
                    page,
                    page_size: PAGE_SIZE,
                },
            });

            const parsed = parseNotificationResponse(response?.data);
            const orderedItems = [...parsed.items].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

            setNotifications((prev) => mergeNotifications(prev, orderedItems, replace));
            setNextPage(parsed.nextPage);
            setTotalCount(parsed.totalCount);
        } catch (error) {
            console.log('Notifications load error:', error?.response?.data || error?.message || error);
            if (replace) {
                setNotifications([]);
                setNextPage(null);
                setTotalCount(0);
            }
        }
    }, []);

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            await loadNotifications({ page: 1, replace: true });
            setLoading(false);
        };
        run();
    }, [loadNotifications]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([
            loadNotifications({ page: 1, replace: true }),
            updateUnreadCount?.(),
        ]);
        setRefreshing(false);
    }, [loadNotifications, updateUnreadCount]);

    const handleLoadMore = useCallback(async () => {
        if (!nextPage || loading || refreshing || loadingMore) return;
        setLoadingMore(true);
        await loadNotifications({ page: nextPage, replace: false });
        setLoadingMore(false);
    }, [loadNotifications, loading, loadingMore, nextPage, refreshing]);

    const markAsRead = useCallback(async (item) => {
        if (item.is_read) return;

        setNotifications((prev) => prev.map((entry) => (
            entry.id === item.id ? { ...entry, is_read: true } : entry
        )));

        try {
            await api.patch(ENDPOINTS.NOTIFICATIONS.DETAIL(item.id));
            await updateUnreadCount?.();
        } catch (error) {
            console.log('Notification mark read error:', error?.response?.data || error?.message || error);
            setNotifications((prev) => prev.map((entry) => (
                entry.id === item.id ? { ...entry, is_read: item.is_read } : entry
            )));
        }
    }, [updateUnreadCount]);

    const deleteItem = useCallback(async (item) => {
        try {
            await api.delete(ENDPOINTS.NOTIFICATIONS.DETAIL(item.id));
            setNotifications((prev) => prev.filter((entry) => entry.id !== item.id));
            setTotalCount((prev) => Math.max(0, prev - 1));
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

        setNotifications((prev) => prev.map((entry) => ({ ...entry, is_read: true })));

        try {
            await Promise.all(unreadItems.map((entry) => api.patch(ENDPOINTS.NOTIFICATIONS.DETAIL(entry.id)).catch(() => null)));
            await updateUnreadCount?.();
        } catch (error) {
            console.log('Notification mark all error:', error?.response?.data || error?.message || error);
        }
    }, [notifications, updateUnreadCount]);

    const unreadCount = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);

    const listItems = useMemo(() => {
        const result = [];
        let currentGroup = '';

        notifications.forEach((item) => {
            const label = formatGroupLabel(item.created_at);
            if (label !== currentGroup) {
                currentGroup = label;
                result.push({ type: 'section', key: `section-${label}`, label });
            }
            result.push({ type: 'item', key: `notification-${item.id}`, item });
        });

        return result;
    }, [notifications]);

    const renderHeader = () => (
        <View style={styles.topArea}>
            {unreadCount > 0 ? (
                <Pressable onPress={markAllAsRead} style={styles.markAllWrap}>
                    <Text style={[styles.markAllText, { color: colors.primary }]}>Tümünü Okundu işaretle</Text>
                </Pressable>
            ) : null}

            <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                {`${notifications.length}${totalCount ? ` / ${totalCount}` : ''} bildirim`}
            </Text>
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
                    ListFooterComponent={<ListFooter loadingMore={loadingMore} hasMore={Boolean(nextPage)} colors={colors} onLoadMore={handleLoadMore} />}
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
    summaryText: {
        ...typography.caption,
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
    footerLoader: {
        paddingVertical: spacing.m,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerSpacer: {
        height: spacing.l,
    },
    moreButton: {
        minHeight: 46,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.s,
        marginBottom: spacing.m,
    },
    moreButtonText: {
        ...typography.bodySmall,
        fontWeight: '700',
    },
});
