import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';

import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { serviceBlue, serviceGreen, serviceRed } from '@/theme/color';

dayjs.locale('tr');

const STATUS_TABS = [
    { key: 'pending', label: 'Bekleyenler', color: '#F59E0B', icon: 'account-clock-outline' },
    { key: 'approved', label: 'Onaylı', color: serviceGreen, icon: 'check-decagram-outline' },
    { key: 'rejected', label: 'Reddedilen', color: serviceRed, icon: 'close-circle-outline' },
];

const STATUS_COLORS = {
    pending: '#F59E0B',
    approved: serviceGreen,
    rejected: serviceRed,
};

const STATUS_LABELS = {
    pending: 'Onay Bekliyor',
    approved: 'Onaylandı',
    rejected: 'Reddedildi',
};

const UserCard = ({ user, onApprove, onReject, onCall, onWhatsApp, actionLoading }) => {
    const { colors } = useTheme();
    const statusColor = STATUS_COLORS[user.approval_status] || serviceBlue;
    const fullName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
    const initials = (user.first_name || user.email || '?').slice(0, 2).toUpperCase();
    const avatar = user.avatar_url || user.avatar;
    const phone = user.phone_number;

    const isPending = user.approval_status === 'pending';
    const isApproved = user.approval_status === 'approved';
    const isRejected = user.approval_status === 'rejected';

    return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardMain}>
                <View style={styles.avatarWrap}>
                    {avatar ? (
                        <Image source={{ uri: avatar }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatarInitials, { backgroundColor: `${statusColor}20` }]}>
                            <Text style={[styles.avatarText, { color: statusColor }]}>{initials}</Text>
                        </View>
                    )}
                    <View style={[styles.statusDot, { backgroundColor: statusColor, borderColor: colors.surface }]} />
                </View>
                <View style={styles.cardContent}>
                    <View style={styles.infoRow}>
                        <View style={styles.infoLeft}>
                            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                                {fullName}
                            </Text>
                            <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>
                                {user.email}
                            </Text>
                            {phone ? (
                                <Text style={[styles.phone, { color: colors.textTertiary }]} numberOfLines={1}>
                                    {phone}
                                </Text>
                            ) : null}
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
                            <Text style={[styles.statusText, { color: statusColor }]}>
                                {STATUS_LABELS[user.approval_status] || user.approval_status}
                            </Text>
                        </View>
                    </View>

                    {user.user_type ? (
                        <View style={styles.metaRow}>
                            <MaterialCommunityIcons
                                name={user.user_type === 'admin' ? 'shield-crown-outline' : 'toolbox-outline'}
                                size={14}
                                color={colors.textTertiary}
                            />
                            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                                {user.user_type === 'admin' ? 'Yönetici' : 'Teknisyen'}
                            </Text>
                            <View style={[styles.metaDivider, { backgroundColor: colors.divider }]} />
                            <MaterialCommunityIcons name="calendar-outline" size={14} color={colors.textTertiary} />
                            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                                {user.date_joined ? dayjs(user.date_joined).format('DD MMM YYYY') : '-'}
                            </Text>
                        </View>
                    ) : null}

                    <View style={styles.actionsRow}>
                        {phone ? (
                            <>
                                <Pressable
                                    onPress={() => onWhatsApp(phone)}
                                    style={styles.actionBtn}
                                >
                                    <MaterialCommunityIcons name="whatsapp" size={16} color="#25D366" />
                                    <Text style={[styles.actionText, { color: '#25D366' }]}>WhatsApp</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => onCall(phone)}
                                    style={styles.actionBtn}
                                >
                                    <MaterialCommunityIcons name="phone" size={16} color={serviceBlue} />
                                    <Text style={[styles.actionText, { color: serviceBlue }]}>Ara</Text>
                                </Pressable>
                            </>
                        ) : null}

                        {isPending ? (
                            <>
                                <Pressable
                                    onPress={() => onReject(user)}
                                    disabled={actionLoading}
                                    style={[
                                        styles.actionBtn,
                                        styles.rejectBtn,
                                        { backgroundColor: `${serviceRed}15`, opacity: actionLoading ? 0.5 : 1 },
                                    ]}
                                >
                                    <MaterialCommunityIcons name="close" size={16} color={serviceRed} />
                                    <Text style={[styles.actionText, { color: serviceRed }]}>Reddet</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => onApprove(user)}
                                    disabled={actionLoading}
                                    style={[
                                        styles.actionBtn,
                                        styles.approveBtn,
                                        { backgroundColor: `${serviceGreen}15`, opacity: actionLoading ? 0.5 : 1 },
                                    ]}
                                >
                                    <MaterialCommunityIcons name="check" size={16} color={serviceGreen} />
                                    <Text style={[styles.actionText, { color: serviceGreen }]}>Onayla</Text>
                                </Pressable>
                            </>
                        ) : null}

                        {isRejected ? (
                            <Pressable
                                onPress={() => onApprove(user)}
                                disabled={actionLoading}
                                style={[
                                    styles.actionBtn,
                                    styles.approveBtn,
                                    { backgroundColor: `${serviceGreen}15`, opacity: actionLoading ? 0.5 : 1 },
                                ]}
                            >
                                <MaterialCommunityIcons name="check" size={16} color={serviceGreen} />
                                <Text style={[styles.actionText, { color: serviceGreen }]}>Onayla</Text>
                            </Pressable>
                        ) : null}

                        {isApproved ? (
                            <Pressable
                                onPress={() => onReject(user)}
                                disabled={actionLoading}
                                style={[
                                    styles.actionBtn,
                                    styles.rejectBtn,
                                    { backgroundColor: `${serviceRed}15`, opacity: actionLoading ? 0.5 : 1 },
                                ]}
                            >
                                <MaterialCommunityIcons name="close" size={16} color={serviceRed} />
                                <Text style={[styles.actionText, { color: serviceRed }]}>İptal Et</Text>
                            </Pressable>
                        ) : null}
                    </View>
                </View>
            </View>
        </View>
    );
};

export default function ApprovalPendingUsersScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { showToast } = useToast();

    const [activeTab, setActiveTab] = useState('pending');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchUsers = useCallback(async (status) => {
        try {
            const response = await api.get(ENDPOINTS.AUTH.USER_APPROVAL, {
                params: { status },
            });
            setUsers(Array.isArray(response?.data) ? response.data : []);
        } catch (error) {
            console.log('Approval users fetch error:', error?.response?.data || error?.message || error);
            setUsers([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        fetchUsers(activeTab);
    }, [activeTab, fetchUsers]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchUsers(activeTab);
        setRefreshing(false);
    };

    const updateUserStatus = async (user, newStatus) => {
        if (!user?.id) return;
        setActionLoading(true);
        try {
            await api.post(ENDPOINTS.AUTH.USER_APPROVAL, {
                user_id: user.id,
                status: newStatus,
            });
            showToast(
                'success',
                'Başarılı',
                newStatus === 'approved'
                    ? 'Kullanıcı onaylandı'
                    : 'Kullanıcı reddedildi'
            );
            await fetchUsers(activeTab);
        } catch (error) {
            const detail = error?.response?.data?.detail || 'İşlem gerçekleştirilemedi';
            showToast('error', 'Hata', detail);
        } finally {
            setActionLoading(false);
        }
    };

    const handleApprove = (user) => {
        const fullName = user.full_name || user.email;
        Alert.alert(
            'Kullanıcıyı Onayla',
            `${fullName} kullanıcısını onaylamak istediğinize emin misiniz?`,
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Onayla',
                    style: 'default',
                    onPress: () => updateUserStatus(user, 'approved'),
                },
            ]
        );
    };

    const handleReject = (user) => {
        const fullName = user.full_name || user.email;
        Alert.alert(
            'Kullanıcıyı Reddet',
            `${fullName} kullanıcısını reddetmek istediğinize emin misiniz?`,
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Reddet',
                    style: 'destructive',
                    onPress: () => updateUserStatus(user, 'rejected'),
                },
            ]
        );
    };

    const handleCall = (phone) => {
        if (!phone) {
            showToast('warning', 'Uyarı', 'Telefon numarası bulunamadı');
            return;
        }
        Linking.openURL(`tel:${phone.replace(/\D/g, '')}`).catch(() => {
            showToast('error', 'Hata', 'Arama başlatılamadı');
        });
    };

    const handleWhatsApp = (phone) => {
        if (!phone) {
            showToast('warning', 'Uyarı', 'Telefon numarası bulunamadı');
            return;
        }
        Linking.openURL(`https://wa.me/${phone.replace(/\D/g, '')}`).catch(() => {
            showToast('error', 'Hata', 'WhatsApp açılamadı');
        });
    };

    const totalByStatus = {
        pending: users.length,
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Kullanıcı Onayı</Text>
                <View style={styles.headerBtn} />
            </View>

            <View style={[styles.tabsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {STATUS_TABS.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <Pressable
                            key={tab.key}
                            onPress={() => setActiveTab(tab.key)}
                            style={[
                                styles.tab,
                                isActive && {
                                    backgroundColor: `${tab.color}15`,
                                    borderColor: tab.color,
                                },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name={tab.icon}
                                size={18}
                                color={isActive ? tab.color : colors.textTertiary}
                            />
                            <Text
                                style={[
                                    styles.tabLabel,
                                    { color: isActive ? tab.color : colors.textSecondary },
                                ]}
                            >
                                {tab.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={serviceBlue}
                        colors={[serviceBlue]}
                    />
                }
            >
                {activeTab === 'pending' && !loading && users.length > 0 ? (
                    <View style={[styles.banner, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}>
                        <MaterialCommunityIcons name="account-clock-outline" size={20} color="#F59E0B" />
                        <Text style={[styles.bannerText, { color: '#F59E0B' }]}>
                            {users.length} kullanıcı onayınızı bekliyor
                        </Text>
                    </View>
                ) : null}

                {loading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="large" color={serviceBlue} />
                    </View>
                ) : users.length > 0 ? (
                    users.map((user) => (
                        <UserCard
                            key={user.id}
                            user={user}
                            onApprove={handleApprove}
                            onReject={handleReject}
                            onCall={handleCall}
                            onWhatsApp={handleWhatsApp}
                            actionLoading={actionLoading}
                        />
                    ))
                ) : (
                    <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
                        <MaterialCommunityIcons
                            name={
                                activeTab === 'pending'
                                    ? 'account-check-outline'
                                    : activeTab === 'approved'
                                        ? 'account-group-outline'
                                        : 'account-remove-outline'
                            }
                            size={48}
                            color={colors.textTertiary}
                        />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            {activeTab === 'pending'
                                ? 'Bekleyen kullanıcı yok'
                                : activeTab === 'approved'
                                    ? 'Onaylanmış kullanıcı yok'
                                    : 'Reddedilmiş kullanıcı yok'}
                        </Text>
                        <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>
                            {activeTab === 'pending'
                                ? 'Yeni kayıtlar burada görünecek'
                                : 'Bu kategoride kullanıcı bulunmuyor'}
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    tabsRow: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 14,
        padding: 4,
        borderWidth: 1,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'transparent',
        gap: 6,
    },
    tabLabel: { fontSize: 13, fontWeight: '700' },
    scrollView: { flex: 1 },
    container: { paddingHorizontal: 16, paddingTop: 4 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
        gap: 10,
    },
    bannerText: { fontSize: 13, fontWeight: '600', flex: 1 },
    card: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardMain: { flexDirection: 'row', alignItems: 'flex-start', flex: 1 },
    avatarWrap: { position: 'relative', marginRight: 12 },
    avatar: { width: 52, height: 52, borderRadius: 26 },
    avatarInitials: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 18, fontWeight: '800' },
    statusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
    },
    cardContent: { flex: 1 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
    infoLeft: { flex: 1, marginRight: 8 },
    name: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    email: { fontSize: 12 },
    phone: { fontSize: 12, marginTop: 2 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusText: { fontSize: 11, fontWeight: '700' },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    metaText: { fontSize: 11, fontWeight: '500' },
    metaDivider: { width: 1, height: 12 },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
    },
    actionText: { fontSize: 12, fontWeight: '700' },
    approveBtn: {},
    rejectBtn: {},
    emptyCard: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        borderRadius: 16,
        marginTop: 20,
    },
    emptyText: { fontSize: 15, marginTop: 12, fontWeight: '600' },
    emptyHint: { fontSize: 13, marginTop: 4 },
});
