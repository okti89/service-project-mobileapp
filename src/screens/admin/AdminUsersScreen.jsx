import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    FlatList,
    Image,
    Linking,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

/** Rol filtreleri */
const ROLE_FILTERS = [
    { key: 'all', label: 'Tümü' },
    { key: 'admin', label: 'Admin' },
    { key: 'technician', label: 'Teknisyen' },
];

/** Durum → görsel meta */
const STATUS_META = {
    approved: { label: 'Aktif', color: serviceGreen },
    pending: { label: 'Onay Bekliyor', color: serviceOrange },
    rejected: { label: 'Reddedildi', color: serviceRed },
    inactive: { label: 'Pasif', color: '#64748B' },
};

/** Rol → görsel meta */
const ROLE_META = {
    admin: { label: 'Admin', color: serviceBlue },
    technician: { label: 'Teknisyen', color: serviceOrange },
};

/**
 * Stat filtre kartları — hangi statusKey'leri kapsar
 * null = filtre yok (tümü gösterilir)
 */
const STAT_FILTERS = [
    { key: 'total', icon: 'account-group-outline', iconColor: serviceBlue, label: 'Toplam', statusKey: null },
    { key: 'active', icon: 'account-check-outline', iconColor: serviceGreen, label: 'Aktif', statusKey: 'approved' },
    { key: 'passive', icon: 'account-off-outline', iconColor: '#64748B', label: 'Pasif', statusKey: 'inactive' },
    { key: 'pending', icon: 'account-clock-outline', iconColor: serviceOrange, label: 'Onay Bekleyen', statusKey: 'pending' },
    { key: 'rejected', icon: 'account-cancel-outline', iconColor: serviceRed, label: 'Reddedildi', statusKey: 'rejected' },
];

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

const getFullName = (u) =>
    u?.full_name ||
    [u?.first_name, u?.last_name].filter(Boolean).join(' ') ||
    u?.email ||
    '-';

const getInitials = (u) => {
    const f = (u?.first_name || '').trim();
    const l = (u?.last_name || '').trim();
    if (f || l) return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();
    return String(u?.email || '?').slice(0, 2).toUpperCase();
};

/** Kullanıcının anlık durum anahtarını döner */
const getUserStatusKey = (u) => {
    const a = String(u?.approval_status || '').toLowerCase();
    if (a === 'rejected') return 'rejected';
    if (a === 'pending') return 'pending';
    if (!u?.is_active) return 'inactive';
    return 'approved';
};

/** ISO tarih → "12 Mart 2024" gibi Türkçe kısa format */
const formatDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
};

// ─── Stat Kartı ───────────────────────────────────────────────────────────────

function StatCard({ label, value, iconColor, active, onPress, colors }) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.statCard,
                {
                    backgroundColor: active ? iconColor : 'transparent',
                    borderColor: iconColor,
                    borderWidth: 1.5,
                    opacity: pressed ? 0.85 : 1,
                },
            ]}
        >
            <Text style={[styles.statLabel, { color: active ? '#FFFFFF' : colors.textSecondary }]} numberOfLines={2}>
                {label}
            </Text>
            <Text style={[styles.statValue, { color: active ? '#FFFFFF' : colors.text }]}>
                {value}
            </Text>
        </Pressable>
    );
}

// ─── Kullanıcı Kartı ──────────────────────────────────────────────────────────

function UserCard({
    user,
    colors,
    isDark,
    busy,
    onApprove,
    onReject,
    onDeactivate,
    onRestore,
    onCall,
    onWhatsApp,
}) {
    const statusKey = getUserStatusKey(user);
    const statusMeta = STATUS_META[statusKey] || STATUS_META.approved;
    const roleMeta = ROLE_META[user?.user_type] || { label: 'Kullanıcı', color: colors.textSecondary };
    const avatarUri = resolveMediaUrl(user?.avatar || user?.avatar_url);
    const fullName = getFullName(user);
    const isPending = statusKey === 'pending';
    const isInactive = statusKey === 'inactive' || statusKey === 'rejected';

    return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Üst Satır */}
            <View style={styles.cardTop}>
                {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: `${statusMeta.color}18` }]}>
                        <Text style={[styles.avatarInitials, { color: statusMeta.color }]}>
                            {getInitials(user)}
                        </Text>
                    </View>
                )}

                <View style={styles.cardInfo}>
                    <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                        {fullName}
                    </Text>
                    <Text style={[styles.cardRole, { color: roleMeta.color }]} numberOfLines={1}>
                        {roleMeta.label}
                    </Text>
                    <Text style={[styles.cardEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                        {user?.email || '-'}
                    </Text>
                    {user?.phone_number ? (
                        <View style={styles.joinDateRow}>
                            <MaterialCommunityIcons name="phone" size={12} color={colors.textTertiary} />
                            <Text style={[styles.cardPhone, { color: colors.textTertiary }]} numberOfLines={1}>
                                Tel: {user.phone_number}
                            </Text>
                        </View>
                    ) : null}
                    {user?.date_joined ? (
                        <View style={styles.joinDateRow}>
                            <MaterialCommunityIcons name="calendar-clock-outline" size={12} color={colors.textTertiary} />
                            <Text style={[styles.cardJoinDate, { color: colors.textTertiary }]} numberOfLines={1}>
                                Katılım: {formatDate(user.date_joined)}
                            </Text>
                        </View>
                    ) : null}
                </View>

                <View style={[
                    styles.statusBadge,
                    { backgroundColor: `${statusMeta.color}15`, borderColor: `${statusMeta.color}35` },
                ]}>
                    <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>
                        {statusMeta.label}
                    </Text>
                </View>
            </View>

            {/* Ayraç */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Aksiyonlar */}
            <View style={styles.actionRow}>
                {/* WhatsApp + Ara */}
                {user?.phone_number ? (
                    <>
                        <Pressable
                            onPress={() => onWhatsApp(user.phone_number)}
                            style={({ pressed }) => [
                                styles.actionBtn,
                                {
                                    borderColor: '#16A34A40',
                                    backgroundColor: isDark ? '#16A34A18' : '#F0FDF4',
                                },
                                pressed && { opacity: 0.7 },
                            ]}
                        >
                            <MaterialCommunityIcons name="whatsapp" size={15} color="#16A34A" />
                            <Text style={[styles.actionBtnText, { color: '#16A34A' }]}>Mesaj</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => onCall(user.phone_number)}
                            style={({ pressed }) => [
                                styles.actionBtn,
                                {
                                    borderColor: `${serviceBlue}40`,
                                    backgroundColor: isDark ? `${serviceBlue}18` : '#EFF6FF',
                                },
                                pressed && { opacity: 0.7 },
                            ]}
                        >
                            <MaterialCommunityIcons name="phone" size={15} color={serviceBlue} />
                            <Text style={[styles.actionBtnText, { color: serviceBlue }]}>Ara</Text>
                        </Pressable>
                    </>
                ) : null}

                {/* Durum Aksiyonu */}
                {isPending ? (
                    <>
                        <Pressable
                            onPress={() => onApprove(user)}
                            disabled={busy}
                            style={({ pressed }) => [
                                styles.actionBtnFilled,
                                { backgroundColor: serviceGreen, opacity: (busy || pressed) ? 0.65 : 1 },
                            ]}
                        >
                            <Text style={styles.actionBtnFilledText}>Onayla</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => onReject(user)}
                            disabled={busy}
                            style={({ pressed }) => [
                                styles.actionBtnFilled,
                                { backgroundColor: serviceRed, opacity: (busy || pressed) ? 0.65 : 1 },
                            ]}
                        >
                            <Text style={styles.actionBtnFilledText}>Reddet</Text>
                        </Pressable>
                    </>
                ) : isInactive ? (
                    <Pressable
                        onPress={() => onRestore(user)}
                        disabled={busy}
                        style={({ pressed }) => [
                            styles.actionBtnOutline,
                            { borderColor: serviceGreen, opacity: (busy || pressed) ? 0.65 : 1 },
                        ]}
                    >
                        {busy
                            ? <ActivityIndicator size="small" color={serviceGreen} />
                            : <Text style={[styles.actionBtnOutlineText, { color: serviceGreen }]}>Aktif Et</Text>
                        }
                    </Pressable>
                ) : (
                    <Pressable
                        onPress={() => onDeactivate(user)}
                        disabled={busy}
                        style={({ pressed }) => [
                            styles.actionBtnOutline,
                            { borderColor: serviceRed, opacity: (busy || pressed) ? 0.65 : 1 },
                        ]}
                    >
                        {busy
                            ? <ActivityIndicator size="small" color={serviceRed} />
                            : <Text style={[styles.actionBtnOutlineText, { color: serviceRed }]}>Pasife Al</Text>
                        }
                    </Pressable>
                )}
            </View>
        </View>
    );
}

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

export default function AdminUsersScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busyUserId, setBusyUserId] = useState(null);

    // Filtreler
    const [statFilter, setStatFilter] = useState('total');   // stat kartı filtresi
    const [roleFilter, setRoleFilter] = useState('all');     // rol filtresi
    const [search, setSearch] = useState('');        // arama

    // Onay modal state'i
    const [confirmModal, setConfirmModal] = useState({
        visible: false,
        icon: 'alert-circle-outline',
        iconColor: serviceRed,
        title: '',
        description: '',
        primaryLabel: 'Evet',
        onConfirm: null,
    });

    const sheetRef = useRef(null);

    const renderBackdrop = useCallback(
        (props) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                opacity={0.5}
                pressBehavior="close"
            />
        ),
        []
    );

    const closeModal = useCallback(() => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        sheetRef.current?.close();
    }, []);

    const openModal = useCallback((config) => {
        setConfirmModal({ visible: true, ...config });
        sheetRef.current?.expand();
    }, []);

    useEffect(() => {
        const backAction = () => {
            if (confirmModal.visible) {
                closeModal();
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );

        return () => backHandler.remove();
    }, [confirmModal.visible, closeModal]);

    // ── Veri çekme ────────────────────────────────────────────────────────────

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get(ENDPOINTS.AUTH.USER_LIST, {
                params: { include_inactive: 'true' },
            });
            const rows = Array.isArray(response?.data) ? response.data : [];
            setUsers(rows.sort((a, b) =>
                getFullName(a).localeCompare(getFullName(b), 'tr', { sensitivity: 'base' })
            ));
        } catch (err) {
            console.log('User list error:', err?.response?.data || err?.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);
    const handleRefresh = useCallback(() => { setRefreshing(true); fetchUsers(true); }, [fetchUsers]);

    // ── İstatistikler ─────────────────────────────────────────────────────────

    const stats = useMemo(() => ({
        total: users.length,
        active: users.filter(u => getUserStatusKey(u) === 'approved').length,
        passive: users.filter(u => getUserStatusKey(u) === 'inactive').length,
        pending: users.filter(u => getUserStatusKey(u) === 'pending').length,
        rejected: users.filter(u => getUserStatusKey(u) === 'rejected').length,
    }), [users]);

    const statValues = { total: stats.total, active: stats.active, passive: stats.passive, pending: stats.pending, rejected: stats.rejected };

    // ── Filtreli liste ────────────────────────────────────────────────────────

    const filtered = useMemo(() => {
        let list = users;

        // Stat kartı filtresi
        const statDef = STAT_FILTERS.find(f => f.key === statFilter);
        if (statDef?.statusKey) {
            list = list.filter(u => getUserStatusKey(u) === statDef.statusKey);
        }

        // Rol filtresi
        if (roleFilter !== 'all') {
            list = list.filter(u => u.user_type === roleFilter);
        }

        // Arama
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(u =>
                getFullName(u).toLowerCase().includes(q) ||
                (u.email || '').toLowerCase().includes(q) ||
                (u.phone_number || '').includes(q)
            );
        }

        return list;
    }, [users, statFilter, roleFilter, search]);

    // ── API aksiyonları ───────────────────────────────────────────────────────

    const postStatusUpdate = useCallback(async (user, status, successMsg) => {
        if (!user?.id) return;
        setBusyUserId(user.id);
        try {
            await api.post(ENDPOINTS.AUTH.USER_APPROVAL, { user_id: user.id, status });
            showToast('success', 'İşlem Başarılı', successMsg);
            await fetchUsers(true);
        } catch (err) {
            console.log('Status update error:', err?.response?.data || err?.message);
            showToast('error', 'Hata', 'Durum güncellenemedi: ' + (err?.response?.data?.detail || err?.response?.data?.error || err?.message));
        } finally {
            setBusyUserId(null);
        }
    }, [fetchUsers, showToast]);

    const deactivateUser = useCallback(async (user) => {
        if (!user?.id) return;
        setBusyUserId(user.id);
        try {
            await api.delete(ENDPOINTS.AUTH.USER_DETAIL(user.id));
            showToast('success', 'İşlem Başarılı', 'Kullanıcı başarıyla pasife alındı.');
            await fetchUsers(true);
        } catch (err) {
            console.log('Deactivate error:', err?.response?.data || err?.message);
            showToast('error', 'Hata', 'Kullanıcı pasife alınamadı: ' + (err?.response?.data?.detail || err?.response?.data?.error || err?.message));
        } finally {
            setBusyUserId(null);
        }
    }, [fetchUsers, showToast]);

    const restoreUser = useCallback(async (user) => {
        if (!user?.id) return;
        setBusyUserId(user.id);
        try {
            await api.put(ENDPOINTS.AUTH.USER_DETAIL(user.id));
            showToast('success', 'İşlem Başarılı', 'Kullanıcı başarıyla aktif edildi.');
            await fetchUsers(true);
        } catch (err) {
            console.log('Restore error:', err?.response?.data || err?.message);
            showToast('error', 'Hata', 'Kullanıcı aktif edilemedi: ' + (err?.response?.data?.detail || err?.response?.data?.error || err?.message));
        } finally {
            setBusyUserId(null);
        }
    }, [fetchUsers, showToast]);

    // ── Modal onay aksiyonları ────────────────────────────────────────────────

    const confirmApprove = useCallback((u) => {
        openModal({
            icon: 'account-check-outline',
            iconColor: serviceGreen,
            title: 'Kullanıcıyı Onayla',
            description: `${getFullName(u)} hesabı onaylanacak ve kullanıcı uygulamaya erişebilecek.`,
            primaryLabel: 'Onayla',
            onConfirm: () => postStatusUpdate(u, 'approved', 'Kullanıcı onaylandı'),
        });
    }, [openModal, postStatusUpdate]);

    const confirmReject = useCallback((u) => {
        openModal({
            icon: 'account-cancel-outline',
            iconColor: serviceRed,
            title: 'Kullanıcıyı Reddet',
            description: `${getFullName(u)} hesabı reddedilecek. Kullanıcı uygulamaya giremeyecek.`,
            primaryLabel: 'Reddet',
            onConfirm: () => postStatusUpdate(u, 'rejected', 'Kullanıcı reddedildi'),
        });
    }, [openModal, postStatusUpdate]);

    const confirmDeactivate = useCallback((u) => {
        openModal({
            icon: 'account-off-outline',
            iconColor: serviceRed,
            title: 'Kullanıcıyı Pasife Al',
            description: `${getFullName(u)} hesabı pasife alınacak. İstediğinizde tekrar aktif edebilirsiniz.`,
            primaryLabel: 'Pasife Al',
            onConfirm: () => deactivateUser(u),
        });
    }, [openModal, deactivateUser]);

    const confirmRestore = useCallback((u) => {
        openModal({
            icon: 'account-reactivate-outline',
            iconColor: serviceGreen,
            title: 'Hesabı Aktif Et',
            description: `${getFullName(u)} hesabı yeniden aktif edilecek ve kullanıcı sisteme erişebilecek.`,
            primaryLabel: 'Aktif Et',
            onConfirm: () => restoreUser(u),
        });
    }, [openModal, restoreUser]);

    // ── İletişim aksiyonları ──────────────────────────────────────────────────

    const handleCall = useCallback((phone) => {
        let clean = String(phone || '').replace(/\D/g, '');
        if (!clean) return;
        if (clean.startsWith('9')) {
            clean = '+' + clean;
        }
        Linking.openURL(`tel:${clean}`).catch(console.warn);
    }, []);

    const handleWhatsApp = useCallback((phone) => {
        const clean = String(phone || '').replace(/\D/g, '');
        if (!clean) return;
        Linking.openURL(`https://wa.me/${clean}`).catch(console.warn);
    }, []);

    // ── Render ────────────────────────────────────────────────────────────────

    const renderItem = useCallback(({ item }) => (
        <UserCard
            user={item}
            colors={colors}
            isDark={isDark}
            busy={busyUserId === item.id}
            onApprove={confirmApprove}
            onReject={confirmReject}
            onDeactivate={confirmDeactivate}
            onRestore={confirmRestore}
            onCall={handleCall}
            onWhatsApp={handleWhatsApp}
        />
    ), [colors, isDark, busyUserId, confirmApprove, confirmReject, confirmDeactivate, confirmRestore, handleCall, handleWhatsApp]);

    const ListHeader = useMemo(() => (
        <>
            {/* ── Stat Kartları ── */}
            <View style={styles.statsRow}>
                {STAT_FILTERS.map(f => (
                    <StatCard
                        key={f.key}
                        iconColor={f.iconColor}
                        label={f.label}
                        value={statValues[f.key] ?? 0}
                        active={statFilter === f.key}
                        onPress={() => setStatFilter(prev => prev === f.key ? 'total' : f.key)}
                        colors={colors}
                    />
                ))}
            </View>

            {/* ── Rol Filtresi (Material Top Tab Görünümü) ── */}
            <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
                {ROLE_FILTERS.map(f => {
                    const active = f.key === roleFilter;
                    return (
                        <Pressable
                            key={f.key}
                            onPress={() => setRoleFilter(f.key)}
                            style={[
                                styles.filterTab,
                                { borderBottomColor: active ? colors.primary : 'transparent' },
                            ]}
                        >
                            <Text style={[styles.filterTabText, { color: active ? colors.primary : colors.textSecondary }]}>
                                {f.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* ── Arama ── */}
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="magnify" size={18} color={colors.textTertiary} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Kullanıcı ara..."
                    placeholderTextColor={colors.textTertiary}
                    value={search}
                    onChangeText={setSearch}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                />
                {search.length > 0 && (
                    <Pressable onPress={() => setSearch('')} hitSlop={8}>
                        <MaterialCommunityIcons name="close-circle" size={16} color={colors.textTertiary} />
                    </Pressable>
                )}
            </View>

            {/* ── Sonuç sayısı ── */}
            {(statFilter !== 'total' || roleFilter !== 'all' || search.length > 0) ? (
                <View style={styles.resultCountRow}>
                    <MaterialCommunityIcons name="filter-check" size={14} color={colors.textTertiary} />
                    <Text style={[styles.resultCount, { color: colors.textTertiary }]}>
                        {filtered.length} sonuç
                    </Text>
                    <Pressable
                        onPress={() => { setStatFilter('total'); setRoleFilter('all'); setSearch(''); }}
                        hitSlop={8}
                    >
                        <Text style={[styles.clearFilters, { color: colors.primary }]}>Temizle</Text>
                    </Pressable>
                </View>
            ) : null}
        </>
    ), [stats, statValues, statFilter, roleFilter, search, filtered.length, colors]);

    return (
        <>

            <WrapperContainer edges={NO_BOTTOM_EDGES}>
                <Header
                    title="Kullanıcılar"
                    subtitle="Kullanıcı yönetimi"
                    showBack
                    borderBottom
                    rightActions={[
                        {
                            icon: 'account-plus-outline',
                            onPress: () => navigation.navigate('AdminCreateUser'),
                            accessibilityLabel: 'Yeni Kullanıcı Ekle',
                        },
                    ]}
                />

                {loading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={filtered}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderItem}
                        ListHeaderComponent={ListHeader}
                        contentContainerStyle={[
                            styles.listContent,
                            { paddingBottom: insets.bottom + 24 },
                            filtered.length === 0 && styles.listContentEmpty,
                        ]}
                        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={handleRefresh}
                                tintColor={colors.primary}
                                colors={[colors.primary]}
                            />
                        }
                        ListEmptyComponent={
                            <View style={[styles.emptyWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <MaterialCommunityIcons name="account-search-outline" size={42} color={colors.textTertiary} />
                                <Text style={[styles.emptyTitle, { color: colors.text }]}>Kullanıcı bulunamadı</Text>
                                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                                    {search
                                        ? 'Arama kriterlerinize uygun sonuç yok.'
                                        : 'Bu filtreye ait kullanıcı kaydı bulunmuyor.'
                                    }
                                </Text>
                            </View>
                        }
                    />
                )}
            </WrapperContainer>

            {/* ── Onay BottomSheet ── */}
            <BottomSheet
                ref={sheetRef}
                index={-1}
                snapPoints={['40%']}
                enablePanDownToClose
                onClose={closeModal}
                backdropComponent={renderBackdrop}
                backgroundStyle={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                }}
                handleIndicatorStyle={{
                    backgroundColor: colors.textTertiary,
                }}
            >
                <BottomSheetView style={[styles.sheetContent, { paddingBottom: insets.bottom + 10 }]}>
                    <Pressable
                        onPress={closeModal}
                        style={({ pressed }) => [
                            styles.sheetCloseBtn,
                            { backgroundColor: colors.border + '30' },
                            pressed && { opacity: 0.7 }
                        ]}
                        hitSlop={12}
                    >
                        <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
                    </Pressable>
                    <View style={[styles.confirmIcon, { backgroundColor: `${confirmModal.iconColor}15` }]}>
                        <MaterialCommunityIcons name={confirmModal.icon} size={26} color={confirmModal.iconColor} />
                    </View>
                    <Text style={[styles.confirmTitle, { color: colors.text }]}>{confirmModal.title}</Text>
                    <Text style={[styles.confirmDesc, { color: colors.textSecondary }]}>
                        {confirmModal.description}
                    </Text>
                    <View style={styles.confirmRow}>
                        <Pressable
                            onPress={closeModal}
                            style={[styles.confirmBtn, styles.confirmBtnOutline, { borderColor: colors.border }]}
                        >
                            <Text style={[styles.confirmBtnText, { color: colors.text }]}>Vazgeç</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => {
                                closeModal();
                                confirmModal.onConfirm?.();
                            }}
                            style={[styles.confirmBtn, { backgroundColor: confirmModal.iconColor }]}
                        >
                            <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>{confirmModal.primaryLabel}</Text>
                        </Pressable>
                    </View>
                </BottomSheetView>
            </BottomSheet>
        </>
    );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    listContentEmpty: {
        flexGrow: 1,
    },

    // Stat kartları
    statsRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 14,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderRadius: 14,
        gap: 4,
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        opacity: 0.92,
    },
    statValue: {
        fontSize: 19,
        fontWeight: '800',
        color: '#FFFFFF',
        textAlign: 'center',
    },

    // Rol filtre (Material Top Tab)
    filterRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        marginBottom: 14,
    },
    filterTab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 2,
    },
    filterTabText: {
        fontSize: 14,
        fontWeight: '700',
    },

    // Arama
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 42,
        gap: 8,
        marginBottom: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        paddingVertical: 0,
    },

    // Sonuç sayısı satırı
    resultCountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 10,
    },
    resultCount: {
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
    },
    clearFilters: {
        fontSize: 12,
        fontWeight: '700',
    },

    // Kullanıcı kartı
    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        gap: 12,
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    avatarFallback: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitials: {
        fontSize: 16,
        fontWeight: '800',
    },
    cardInfo: {
        flex: 1,
        gap: 2,
    },
    cardName: { fontSize: 15, fontWeight: '700' },
    cardRole: { fontSize: 13, fontWeight: '600' },
    cardEmail: { fontSize: 12 },
    cardPhone: { fontSize: 12 },
    joinDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    cardJoinDate: { fontSize: 11, fontWeight: '500' },
    statusBadge: {
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginHorizontal: -2,
    },

    // Aksiyon satırı
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 7,
        borderRadius: 9,
        borderWidth: 1,
    },
    actionBtnText: { fontSize: 12, fontWeight: '700' },
    actionBtnFilled: {
        flex: 1,
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnFilledText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    actionBtnOutline: {
        flex: 1,
        paddingHorizontal: 8,
        paddingVertical: 7,
        borderRadius: 9,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnOutlineText: { fontSize: 12, fontWeight: '700' },

    // Boş durum
    emptyWrap: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 32,
        alignItems: 'center',
        gap: 10,
        marginTop: 8,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700' },
    emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

    // Onay BottomSheet
    sheetContent: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
    sheetCloseBtn: {
        position: 'absolute',
        top: 8,
        right: 16,
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    confirmIcon: {
        width: 56,
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16, // spacing.m
    },
    confirmTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
    confirmDesc: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 16 }, // spacing.m
    confirmRow: {
        flexDirection: 'row',
        gap: 12, // spacing.s
        alignSelf: 'stretch',
    },
    confirmBtn: {
        flex: 1,
        height: 46,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmBtnOutline: {
        borderWidth: 1.5,
    },
    confirmBtnText: { fontSize: 14, fontWeight: '800' },
});