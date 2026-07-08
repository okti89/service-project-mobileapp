import React, { useCallback, useMemo, useState } from 'react';
import {
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

// ─── Menu Items (kullanıcının linkleri) ────────────────────────────────────────
const ADMIN_MENU_ITEMS = [
    {
        key: 'users-list',
        icon: 'account-group-outline',
        label: 'Kullanıcı Listesi',
        description: 'Tüm hesapları görüntüle',
        route: 'AdminUsers',
        color: serviceBlue,
    },
    {
        key: 'users-pending',
        icon: 'account-clock-outline',
        label: 'Onay Bekleyenler',
        description: 'Yeni başvuruları yönet',
        route: 'AdminPendingUsers',
        color: serviceOrange,
        badgeKey: 'pendingUsers',
    },

    {
        key: 'technicians-list',
        icon: 'account-hard-hat-outline',
        label: 'Teknisyen Listesi',
        description: 'Saha ekiplerini yönet',
        route: 'AdminTechnicians',
        color: serviceBlue,
    },

    {
        key: 'technicians-locations',
        icon: 'map-marker-account-outline',
        label: 'Teknisyen Konumları',
        description: 'Aktif konumları görüntüle',
        route: 'TechnicianLocations',
        color: serviceGreen,
    },

    {
        key: 'map-usage-test',
        icon: 'test-tube',
        label: 'Map & Geocoding KOTA Testi',
        description: 'Tile yükleme ve reverse geocoding sayaçlarını izle',
        route: 'AdminMapUsageTest',
        color: '#7B61FF',
    },
    {
        key: 'technicians-shifts',
        icon: 'clock-outline',
        label: 'Teknisyen Mesaileri',
        description: 'Mesai kayıtlarını incele',
        route: 'TechnicianShifts',
        color: serviceGreen,
    },
    {
        key: 'technicians-leaves',
        icon: 'calendar-account-outline',
        label: 'Teknisyen İzinleri',
        description: 'İzin ve devamsızlık akışları',
        route: 'AdminTechnicianLeaves',
        color: '#EA580C',
    },
    {
        key: 'customers-list',
        icon: 'card-account-phone-outline',
        label: 'Müşteri Listesi',
        description: 'Müşteri kayıtlarını yönet',
        route: 'AdminCustomers',
        color: serviceBlue,
    },
    {
        key: 'inventory',
        icon: 'package-variant-closed',
        label: 'Ürün ve Envanter',
        description: 'Ürün ve stok akışlarını yönet',
        route: 'AdminProducts',
        color: '#7C3AED',
    },
    {
        key: 'finance-payroll',
        icon: 'cash-multiple',
        label: 'Maaş ve Bordro',
        description: 'Bordro ve özlük süreçleri',
        route: 'AdminPayroll',
        color: '#14B8A6',
    },
    {
        key: 'finance-accounting',
        icon: 'finance',
        label: 'Finans ve Muhasebe',
        description: 'Gelir gider raporları',
        route: 'AdminAccounting',
        color: serviceOrange,
    },
    {
        key: 'services',
        icon: 'clipboard-text-outline',
        label: 'Servis Yonetimi',
        description: 'Servis operasyonlarini yonet',
        route: 'AdminServices',
        color: serviceGreen,
    },
    {
        key: 'notifications',
        icon: 'bell-outline',
        label: 'Bildirimler',
        description: 'Bildirim akislarini yonet',
        route: 'AdminNotifications',
        color: '#0EA5E9',
    },
    {
        key: 'reports',
        icon: 'chart-box-outline',
        label: 'Raporlar',
        description: 'Rapor ve analiz ekranlari',
        route: 'AdminReports',
        color: '#8B5CF6',
    },
    {
        key: 'company-settings',
        icon: 'cog-outline',
        label: 'Firma Ayarlari',
        description: 'Sistem ayarlarini yonet',
        route: 'AdminCompanySettings',
        color: '#64748B',
    },
];

const PERMISSION_ITEM_MAP = {
    can_manage_users: ['users-list', 'users-pending', 'users-passive'],
    can_manage_technicians: ['technicians-list', 'technicians-locations', 'technicians-shifts', 'technicians-leaves'],
    can_manage_customers: ['customers-list'],
    can_manage_inventory: ['inventory'],
    can_manage_hr: ['finance-payroll'],
    can_manage_accounting: ['finance-accounting'],
    can_manage_services: ['services'],
    can_manage_notifications: ['notifications'],
    can_manage_reports: ['reports'],
    can_manage_settings: ['company-settings'],
};

const MENU_ITEMS_BY_KEY = ADMIN_MENU_ITEMS.reduce((acc, item) => {
    acc[item.key] = item;
    return acc;
}, {});

// ─── Hızlı İşlemler ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
    { key: 'new-user', icon: 'account-plus-outline', label: 'Yeni Kullanıcı', route: 'AdminUsers', color: serviceBlue },
    { key: 'new-service', icon: 'clipboard-plus-outline', label: 'Yeni Servis', route: 'AdminServices', color: serviceGreen },
    { key: 'new-product', icon: 'package-variant-plus', label: 'Yeni Ürün', route: 'AdminInventory', color: '#7C3AED' },
    { key: 'reports', icon: 'chart-bar', label: 'Rapor Oluştur', route: 'AdminReports', color: serviceOrange },
];

// ─── Sub-components ─────────────────────────────────────────────────────────────
function QuickAction({ icon, label, color, onPress, colors }) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.quickActionItem,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
        >
            <View style={[styles.quickActionIcon, { backgroundColor: `${color}18` }]}>
                <MaterialCommunityIcons name={icon} size={26} color={color} />
            </View>
            <Text style={[styles.quickActionLabel, { color: colors.textSecondary }]}>{label}</Text>
        </Pressable>
    );
}

function MenuItem({ icon, label, description, onPress, color, badge, colors }) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.menuItem,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
            ]}
        >
            <View style={[styles.menuIcon, { backgroundColor: `${color}18` }]}>
                <MaterialCommunityIcons name={icon} size={22} color={color} />
            </View>
            <View style={styles.menuContent}>
                <View style={styles.menuLabelRow}>
                    <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
                    {badge > 0 ? (
                        <View style={[styles.badge, { backgroundColor: serviceRed }]}>
                            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                        </View>
                    ) : null}
                </View>
                <Text style={[styles.menuDesc, { color: colors.textSecondary }]} numberOfLines={1}>{description}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
        </Pressable>
    );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function AdminPanelScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { isAdmin, mobilePermissions, userInfo } = useAuth();
    const { unreadCount = 0 } = useNotifications() || {};
    const [pendingCount, setPendingCount] = useState(0);

    // User display info
    const firstName = userInfo?.first_name || '';
    const lastName = userInfo?.last_name || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || userInfo?.email || 'Kullanici';
    const roleLabel = isAdmin ? 'Sistem Yöneticisi' : 'Teknisyen';
    const avatarUri = resolveMediaUrl(userInfo?.avatar || userInfo?.profile_photo);

    const panelTitle = isAdmin ? 'Yönetim Merkezi' : 'Teknisyen Paneli';

    // Permissions
    const permissionKeys = useMemo(
        () => Object.keys(mobilePermissions || {}).filter((key) => Boolean(mobilePermissions?.[key])),
        [mobilePermissions]
    );
    const shouldFetchPendingCount = isAdmin || Boolean(mobilePermissions?.can_manage_users);

    const fetchPendingCount = useCallback(async () => {
        if (!shouldFetchPendingCount) { setPendingCount(0); return; }
        try {
            const response = await api.get(ENDPOINTS.AUTH.USER_APPROVAL, { params: { status: 'pending' } });
            const data = Array.isArray(response?.data) ? response.data : [];
            setPendingCount(data.length);
        } catch (error) {
            console.log('Pending count fetch error:', error?.response?.data || error?.message || error);
        }
    }, [shouldFetchPendingCount]);

    useFocusEffect(useCallback(() => { fetchPendingCount(); }, [fetchPendingCount]));

    const baseItems = useMemo(() => {
        if (isAdmin) return ADMIN_MENU_ITEMS;
        const keys = [];
        permissionKeys.forEach((permKey) => {
            (PERMISSION_ITEM_MAP[permKey] || []).forEach((itemKey) => {
                if (!keys.includes(itemKey) && MENU_ITEMS_BY_KEY[itemKey]) keys.push(itemKey);
            });
        });
        return keys.map((k) => MENU_ITEMS_BY_KEY[k]);
    }, [isAdmin, permissionKeys]);

    const menuItems = useMemo(
        () => baseItems.map((item) => ({ ...item, badge: item.badgeKey === 'pendingUsers' ? pendingCount : 0 })),
        [baseItems, pendingCount]
    );

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            {/* ─── Header ─── */}
            <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
                <View style={styles.headerLeft}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{panelTitle}</Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* ─── Profile Card ─── */}
                <Pressable
                    style={({ pressed }) => [
                        styles.profileCard,
                        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
                    ]}
                    onPress={() => navigation.navigate('Profile')}
                >
                    {/* Avatar */}
                    <View style={[styles.avatarWrap, { backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}30` }]}>
                        {avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                        ) : (
                            <MaterialCommunityIcons name="account" size={26} color={colors.primary} />
                        )}
                        {/* Online dot */}
                        <View style={[styles.onlineDot, { backgroundColor: colors.success, borderColor: colors.surface }]} />
                    </View>

                    {/* Name & Role */}
                    <View style={styles.profileInfo}>
                        <Text style={[styles.profileName, { color: colors.text }]}>{fullName}</Text>
                        <Text style={[styles.profileRole, { color: colors.textSecondary }]}>{roleLabel}</Text>
                    </View>

                    <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} />
                </Pressable>

                {/* ─── Hızlı İşlemler ─── */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Hızlı İşlemler</Text>
                </View>

                <View style={[styles.quickActionsGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {QUICK_ACTIONS.map((action, index) => (
                        <QuickAction
                            key={action.key}
                            icon={action.icon}
                            label={action.label}
                            color={action.color}
                            onPress={() => navigation.navigate(action.route)}
                            colors={colors}
                        />
                    ))}
                </View>

                {/* ─── Yönetim Modülleri ─── */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Yönetim Modülleri</Text>
                </View>

                {menuItems.length > 0 ? (
                    menuItems.map((item) => (
                        <MenuItem
                            key={item.key}
                            icon={item.icon}
                            label={item.label}
                            description={item.description}
                            color={item.color}
                            badge={item.badge}
                            onPress={() => navigation.navigate(item.route)}
                            colors={colors}
                        />
                    ))
                ) : (
                    <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>Henüz erişim verilmedi</Text>
                        <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
                            Bu panelde gösterilecek sayfalar teknisyen izinlerine göre açılacak.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },

    // ─── Header ───
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerLeft: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        letterSpacing: -0.3,
    },

    // ─── Scroll ───
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },

    // ─── Profile Card ───
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 20,
        gap: 12,
    },
    avatarWrap: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImg: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    onlineDot: {
        position: 'absolute',
        bottom: 1,
        right: 1,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 2,
    },
    profileRole: {
        fontSize: 13,
    },

    // ─── Section Header ───
    sectionHeader: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
    },

    // ─── Quick Actions ───
    quickActionsGrid: {
        flexDirection: 'row',
        borderRadius: 16,
        borderWidth: 1,
        padding: 4,
        marginBottom: 24,
        overflow: 'hidden',
    },
    quickActionItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 4,
        gap: 8,
        borderRadius: 12,
    },
    quickActionIcon: {
        width: 50,
        height: 50,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickActionLabel: {
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
    },

    // ─── Menu Items ───
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        marginBottom: 8,
        borderWidth: 1,
    },
    menuIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    menuContent: {
        flex: 1,
    },
    menuLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    menuLabel: {
        fontSize: 15,
        fontWeight: '700',
    },
    menuDesc: {
        fontSize: 12,
        lineHeight: 17,
    },
    badge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },

    // ─── Empty ───
    emptyCard: {
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 18,
        gap: 6,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    emptyDescription: {
        fontSize: 13,
        lineHeight: 20,
    },
});