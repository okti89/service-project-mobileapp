import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/tr';

import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { useTheme } from '@/context/ThemeContext';
import { useNotifications } from '@/context/NotificationContext';
import Header from '@/components/Header';
import WrapperContainer from '@/components/WrapperContainer';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { semanticRadius } from '@/theme/radius';

dayjs.extend(relativeTime);
dayjs.locale('tr');

const formatTimeSince = (seconds) => {
    if (!Number.isFinite(seconds)) return '';
    return dayjs().subtract(seconds, 'second').fromNow();
};

const NotificationItem = ({ item, colors, onPress }) => (
    <Pressable
        onPress={() => onPress(item)}
        style={[
            styles.item,
            {
                backgroundColor: item.is_read ? colors.card : `${colors.primary}08`,
                borderColor: colors.border,
            },
        ]}
    >
        <View style={styles.itemHeader}>
            <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                {item.title}
            </Text>
            {!item.is_read ? (
                <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
            ) : null}
        </View>
        <Text style={[styles.itemMessage, { color: colors.textSecondary }]} numberOfLines={3}>
            {item.message}
        </Text>
        <Text style={[styles.itemTime, { color: colors.textTertiary }]}>
            {formatTimeSince(item.time_since)}
        </Text>
    </Pressable>
);

export default function NotificationsScreen() {
    const { colors } = useTheme();
    const { updateUnreadCount } = useNotifications();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadNotifications = useCallback(async () => {
        try {
            const response = await api.get(ENDPOINTS.NOTIFICATIONS.LIST);
            setNotifications(Array.isArray(response?.data) ? response.data : []);
        } catch (error) {
            console.log('Bildirimler yuklenemedi:', error?.response?.data || error?.message);
            setNotifications([]);
        }
    }, []);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([loadNotifications(), updateUnreadCount()]);
        setRefreshing(false);
    }, [loadNotifications, updateUnreadCount]);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await loadNotifications();
            setLoading(false);
        };
        init();
    }, [loadNotifications]);

    const markAsRead = async (item) => {
        if (item.is_read) return;
        try {
            await api.patch(ENDPOINTS.NOTIFICATIONS.DETAIL(item.id));
            setNotifications((prev) =>
                prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
            );
            updateUnreadCount();
        } catch (error) {
            console.log('Bildirim okundu isaretlenemedi:', error?.response?.data || error?.message);
        }
    };

    return (
        <WrapperContainer bg={colors.background}>
            <Header
                title="Bildirimler"
                showBack
                backVariant="minimal"
                centered
                borderBottom
            />

            {loading ? (
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={[
                        styles.listContent,
                        notifications.length === 0 && styles.emptyList,
                    ]}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={refresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.centerState}>
                            <MaterialCommunityIcons
                                name="bell-off-outline"
                                size={48}
                                color={colors.textTertiary}
                            />
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>
                                Bildirim yok
                            </Text>
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                                Yeni bildirimler burada görünecek.
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <NotificationItem item={item} colors={colors} onPress={markAsRead} />
                    )}
                />
            )}
        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    listContent: {
        padding: spacing.gutter,
        gap: spacing.itemGap,
    },
    emptyList: {
        flexGrow: 1,
    },
    item: {
        borderRadius: semanticRadius.card,
        borderWidth: 1,
        padding: spacing.l,
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.s,
    },
    itemTitle: {
        ...typography.body,
        fontWeight: '600',
        flex: 1,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    itemMessage: {
        ...typography.bodySmall,
        marginTop: spacing.xs,
    },
    itemTime: {
        ...typography.caption,
        marginTop: spacing.s,
    },
    centerState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.gutter,
        gap: spacing.m,
    },
    emptyTitle: {
        ...typography.h3,
    },
    emptyText: {
        ...typography.bodySmall,
        textAlign: 'center',
    },
});
