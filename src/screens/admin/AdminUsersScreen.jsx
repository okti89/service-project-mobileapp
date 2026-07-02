import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Linking,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';

import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import Header from '@/components/Header';
import WrapperContainer from '@/components/WrapperContainer';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { serviceBlue, serviceGreen, serviceRed } from '@/theme/color';
import { spacing } from '@/theme/spacing';

dayjs.locale('tr');

const TABS = [
    { key: 'all', label: 'Tum Kullanicilar' },
    { key: 'deleted', label: 'Silinenler' },
];

const STATUS_LABELS = {
    pending: 'Onay Bekliyor',
    approved: 'Onaylandi',
    rejected: 'Reddedildi',
};

const STATUS_COLORS = {
    pending: '#F59E0B',
    approved: serviceGreen,
    rejected: serviceRed,
};

const ROLE_LABELS = {
    admin: 'Yonetici',
    technician: 'Teknisyen',
};

const getFullName = (user) => user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || '-';

const getInitials = (user) => {
    const first = (user?.first_name || '').trim();
    const last = (user?.last_name || '').trim();
    if (first || last) {
        return `${first.charAt(0)}${last.charAt(0)}`.trim().toUpperCase() || first.slice(0, 2).toUpperCase();
    }
    return String(user?.email || '?').slice(0, 2).toUpperCase();
};

const UserCard = ({
    user,
    tabKey,
    colors,
    busy,
    onApprove,
    onReject,
    onDeactivate,
    onRestore,
    onCall,
    onWhatsApp,
}) => {
    const statusColor = STATUS_COLORS[user?.approval_status] || serviceBlue;
    const avatarUri = user?.avatar_url || user?.avatar || null;
    const isPending = user?.approval_status === 'pending';
    const isDeleted = tabKey === 'deleted' || !user?.is_active;
    const fullName = getFullName(user);

    return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardTopRow}>
                <View style={styles.userBlock}>
                    {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.initialsAvatar, { backgroundColor: `${statusColor}18` }]}>
                            <Text style={[styles.initialsText, { color: statusColor }]}>{getInitials(user)}</Text>
                        </View>
                    )}

                    <View style={styles.userTextWrap}>
                        <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                            {fullName}
                        </Text>
                        <Text style={[styles.userMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                            {user?.email || '-'}
                        </Text>
                        {user?.phone_number ? (
                            <Text style={[styles.userMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                                {user.phone_number}
                            </Text>
                        ) : null}
                    </View>
                </View>

                <View style={[styles.statusPill, { borderColor: `${statusColor}33`, backgroundColor: `${statusColor}12` }]}>
                    <Text style={[styles.statusPillText, { color: statusColor }]}>
                        {STATUS_LABELS[user?.approval_status] || 'Durum'}
                    </Text>
                </View>
            </View>

            <View style={styles.metaRow}>
                <View style={[styles.metaChip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                    <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>
                        {ROLE_LABELS[user?.user_type] || 'Kullanici'}
                    </Text>
                </View>
                <View style={[styles.metaChip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                    <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>
                        {user?.date_joined ? dayjs(user.date_joined).format('DD MMM YYYY') : '-'}
                    </Text>
                </View>
            </View>

            <View style={styles.actionRow}>
                {user?.phone_number ? (
                    <>
                        <Pressable
                            onPress={() => onWhatsApp(user.phone_number)}
                            style={[styles.secondaryAction, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                        >
                            <Text style={[styles.secondaryActionText, { color: '#25D366' }]}>WhatsApp</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => onCall(user.phone_number)}
                            style={[styles.secondaryAction, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                        >
                            <Text style={[styles.secondaryActionText, { color: serviceBlue }]}>Ara</Text>
                        </Pressable>
                    </>
                ) : null}

                {isPending ? (
                    <>
                        <Pressable
                            onPress={() => onReject(user)}
                            disabled={busy}
                            style={[styles.primaryAction, { backgroundColor: serviceRed, opacity: busy ? 0.55 : 1 }]}
                        >
                            <Text style={styles.primaryActionText}>Reddet</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => onApprove(user)}
                            disabled={busy}
                            style={[styles.primaryAction, { backgroundColor: serviceGreen, opacity: busy ? 0.55 : 1 }]}
                        >
                            <Text style={styles.primaryActionText}>Onayla</Text>
                        </Pressable>
                    </>
                ) : isDeleted ? (
                    <Pressable
                        onPress={() => onRestore(user)}
                        disabled={busy}
                        style={[styles.primaryAction, { backgroundColor: serviceGreen, opacity: busy ? 0.55 : 1 }]}
                    >
                        <Text style={styles.primaryActionText}>Aktif Et</Text>
                    </Pressable>
                ) : (
                    <Pressable
                        onPress={() => onDeactivate(user)}
                        disabled={busy}
                        style={[styles.primaryAction, { backgroundColor: '#475569', opacity: busy ? 0.55 : 1 }]}
                    >
                        <Text style={styles.primaryActionText}>Pasife Al</Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
};

export default function AdminUsersScreen({ navigation }) {
    const { colors } = useTheme();
    const { showToast } = useToast();

    const [activeTab, setActiveTab] = useState('all');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busyUserId, setBusyUserId] = useState(null);

    const fetchUsers = async (tabKey, silent = false) => {
        if (!silent) setLoading(true);
        try {
            const response = await api.get(ENDPOINTS.AUTH.USER_LIST, {
                params: { tab: tabKey },
            });
            const rows = Array.isArray(response?.data) ? response.data : [];
            setUsers(
                rows.slice().sort((a, b) =>
                    getFullName(a).localeCompare(getFullName(b), 'tr', { sensitivity: 'base' })
                )
            );
        } catch (error) {
            console.log('Admin users fetch error:', error?.response?.data || error?.message || error);
            setUsers([]);
            showToast('error', 'Hata', 'Kullanici listesi alinamadi');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchUsers(activeTab);
    }, [activeTab]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchUsers(activeTab, true);
    };

    const postStatusUpdate = async (user, statusValue, successMessage) => {
        if (!user?.id) return;
        setBusyUserId(user.id);
        try {
            await api.post(ENDPOINTS.AUTH.USER_APPROVAL, {
                user_id: user.id,
                status: statusValue,
            });
            showToast('success', 'Basarili', successMessage);
            await fetchUsers(activeTab, true);
        } catch (error) {
            const detail = error?.response?.data?.detail || 'Islem tamamlanamadi';
            showToast('error', 'Hata', detail);
        } finally {
            setBusyUserId(null);
        }
    };

    const deactivateUser = async (user) => {
        if (!user?.id) return;
        setBusyUserId(user.id);
        try {
            await api.delete(ENDPOINTS.AUTH.USER_DETAIL(user.id));
            showToast('success', 'Basarili', 'Kullanici pasife alindi');
            await fetchUsers(activeTab, true);
        } catch (error) {
            const detail = error?.response?.data?.detail || error?.response?.data?.error || 'Kullanici pasife alinamadi';
            showToast('error', 'Hata', detail);
        } finally {
            setBusyUserId(null);
        }
    };

    const confirmApprove = (user) => {
        Alert.alert('Kullaniciyi Onayla', `${getFullName(user)} hesabi aktif edilsin mi?`, [
            { text: 'Vazgec', style: 'cancel' },
            { text: 'Onayla', onPress: () => postStatusUpdate(user, 'approved', 'Kullanici onaylandi') },
        ]);
    };

    const confirmReject = (user) => {
        Alert.alert('Kullaniciyi Reddet', `${getFullName(user)} hesabi reddedilsin mi?`, [
            { text: 'Vazgec', style: 'cancel' },
            { text: 'Reddet', style: 'destructive', onPress: () => postStatusUpdate(user, 'rejected', 'Kullanici reddedildi') },
        ]);
    };

    const confirmDeactivate = (user) => {
        Alert.alert('Kullaniciyi Pasife Al', `${getFullName(user)} hesabi pasife alinsin mi?`, [
            { text: 'Vazgec', style: 'cancel' },
            { text: 'Pasife Al', style: 'destructive', onPress: () => deactivateUser(user) },
        ]);
    };

    const confirmRestore = (user) => {
        Alert.alert('Kullaniciyi Geri Ac', `${getFullName(user)} hesabi tekrar aktif edilsin mi?`, [
            { text: 'Vazgec', style: 'cancel' },
            { text: 'Aktif Et', onPress: () => postStatusUpdate(user, 'approved', 'Kullanici tekrar aktif edildi') },
        ]);
    };

    const handleCall = (phone) => {
        if (!phone) {
            showToast('warning', 'Uyari', 'Telefon numarasi bulunamadi');
            return;
        }
        Linking.openURL(`tel:${String(phone).replace(/\D/g, '')}`).catch(() => {
            showToast('error', 'Hata', 'Arama baslatilamadi');
        });
    };

    const handleWhatsApp = (phone) => {
        if (!phone) {
            showToast('warning', 'Uyari', 'Telefon numarasi bulunamadi');
            return;
        }
        Linking.openURL(`https://wa.me/${String(phone).replace(/\D/g, '')}`).catch(() => {
            showToast('error', 'Hata', 'WhatsApp acilamadi');
        });
    };

    const summary = useMemo(() => {
        if (activeTab === 'deleted') {
            return {
                title: 'Silinen Hesaplar',
                description: `${users.length} pasif veya reddedilmis hesap listeleniyor.`,
            };
        }
        return {
            title: 'Tum Kullanici Hesaplari',
            description: `${users.length} aktif veya bekleyen hesap listeleniyor.`,
        };
    }, [activeTab, users.length]);

    return (
        <WrapperContainer withTabBar style={styles.wrapper}>
            <Header
                title="Kullanici Yonetimi"
                subtitle="Tum kullanicilar ve silinen hesaplar"
                left={(
                    <Pressable
                        onPress={() => navigation.goBack()}
                        style={[styles.backButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                    >
                        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                    </Pressable>
                )}
                borderBottom
            />

            <View style={[styles.tabBar, { borderBottomColor: colors.border }]}> 
                {TABS.map((tab) => {
                    const isActive = tab.key === activeTab;
                    return (
                        <Pressable
                            key={tab.key}
                            onPress={() => setActiveTab(tab.key)}
                            style={[styles.tabItem, isActive && { borderBottomColor: serviceGreen, borderBottomWidth: 3 }]}
                        >
                            <Text style={[styles.tabText, { color: isActive ? serviceGreen : colors.textSecondary }]}>
                                {tab.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            <FlatList
                data={users}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                    <UserCard
                        user={item}
                        tabKey={activeTab}
                        colors={colors}
                        busy={busyUserId === item.id}
                        onApprove={confirmApprove}
                        onReject={confirmReject}
                        onDeactivate={confirmDeactivate}
                        onRestore={confirmRestore}
                        onCall={handleCall}
                        onWhatsApp={handleWhatsApp}
                    />
                )}
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: 24 },
                    users.length === 0 && !loading ? styles.emptyListContent : null,
                ]}
                ItemSeparatorComponent={() => <View style={{ height: spacing.m }} />}
                refreshControl={(
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={serviceBlue}
                        colors={[serviceBlue]}
                    />
                )}
                ListHeaderComponent={(
                    <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                        <Text style={[styles.summaryTitle, { color: colors.text }]}>{summary.title}</Text>
                        <Text style={[styles.summaryDescription, { color: colors.textSecondary }]}>{summary.description}</Text>
                    </View>
                )}
                ListFooterComponent={loading ? null : <View style={{ height: spacing.s }} />}
                ListEmptyComponent={
                    loading ? (
                        <View style={styles.loadingWrap}>
                            <ActivityIndicator size="large" color={serviceBlue} />
                        </View>
                    ) : (
                        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                            <MaterialCommunityIcons name="account-off-outline" size={40} color={colors.textTertiary} />
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>Liste bos</Text>
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}> 
                                {activeTab === 'deleted'
                                    ? 'Silinen kullanici kaydi bulunmuyor.'
                                    : 'Gosterilecek kullanici kaydi bulunmuyor.'}
                            </Text>
                        </View>
                    )
                }
                showsVerticalScrollIndicator={false}
            />
        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
    },
    backButton: {
        width: 42,
        height: 42,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: spacing.gutter,
        backgroundColor: 'transparent',
    },
    tabItem: {
        flex: 1,
        minHeight: 46,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomColor: 'transparent',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '700',
    },
    listContent: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.m,
    },
    emptyListContent: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    summaryCard: {
        borderWidth: 1,
        paddingHorizontal: spacing.l,
        paddingVertical: spacing.l,
        marginBottom: spacing.m,
        gap: spacing.xs,
    },
    summaryTitle: {
        fontSize: 17,
        fontWeight: '800',
    },
    summaryDescription: {
        fontSize: 13,
        lineHeight: 19,
        fontWeight: '500',
    },
    card: {
        borderWidth: 1,
        padding: spacing.l,
        gap: spacing.m,
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.s,
    },
    userBlock: {
        flex: 1,
        flexDirection: 'row',
        gap: spacing.m,
    },
    avatar: {
        width: 52,
        height: 52,
    },
    initialsAvatar: {
        width: 52,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
    },
    initialsText: {
        fontSize: 17,
        fontWeight: '800',
    },
    userTextWrap: {
        flex: 1,
        gap: 2,
        justifyContent: 'center',
    },
    userName: {
        fontSize: 15,
        fontWeight: '800',
    },
    userMeta: {
        fontSize: 12,
        fontWeight: '500',
    },
    statusPill: {
        minHeight: 30,
        paddingHorizontal: spacing.s,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
    },
    statusPillText: {
        fontSize: 11,
        fontWeight: '800',
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.s,
    },
    metaChip: {
        minHeight: 28,
        paddingHorizontal: spacing.s,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    metaChipText: {
        fontSize: 11,
        fontWeight: '700',
    },
    actionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.s,
    },
    secondaryAction: {
        minHeight: 36,
        paddingHorizontal: spacing.m,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryActionText: {
        fontSize: 12,
        fontWeight: '700',
    },
    primaryAction: {
        minHeight: 36,
        paddingHorizontal: spacing.m,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryActionText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    loadingWrap: {
        paddingVertical: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyCard: {
        borderWidth: 1,
        paddingHorizontal: spacing.l,
        paddingVertical: spacing.xxl,
        alignItems: 'center',
        gap: spacing.s,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '800',
    },
    emptyText: {
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
    },
});