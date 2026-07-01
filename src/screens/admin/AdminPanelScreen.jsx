import React, { useCallback, useMemo, useState } from 'react';
import {
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
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

const ADMIN_MENU_ITEMS = [
    {
        key: 'users-list',
        icon: 'account-group-outline',
        label: 'Kullanici Listesi',
        description: 'Tum hesaplari goruntule',
        route: 'AdminUsers',
        color: serviceBlue,
    },
    {
        key: 'users-pending',
        icon: 'account-clock-outline',
        label: 'Onay Bekleyenler',
        description: 'Yeni basvurulari yonet',
        route: 'AdminPendingUsers',
        color: serviceOrange,
        badgeKey: 'pendingUsers',
    },
    {
        key: 'users-passive',
        icon: 'account-cancel-outline',
        label: 'Pasif / Reddedilenler',
        description: 'Kapali ve reddedilen hesaplar',
        route: 'AdminRejectedUsers',
        color: '#64748B',
    },
    {
        key: 'technicians-list',
        icon: 'account-hard-hat-outline',
        label: 'Teknisyen Listesi',
        description: 'Saha ekiplerini yonet',
        route: 'AdminTechnicians',
        color: serviceBlue,
    },
    {
        key: 'technicians-locations',
        icon: 'map-marker-account-outline',
        label: 'Teknisyen Konumlari',
        description: 'Aktif konumlari goruntule',
        route: 'AdminTechnicianLocations',
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
        description: 'Mesai kayitlarini incele',
        route: 'AdminTechnicianShifts',
        color: serviceGreen,
    },
    {
        key: 'technicians-leaves',
        icon: 'calendar-account-outline',
        label: 'Teknisyen Izinleri',
        description: 'Izin ve devamsizlik akislari',
        route: 'AdminTechnicianLeaves',
        color: '#EA580C',
    },
    {
        key: 'customers-list',
        icon: 'card-account-phone-outline',
        label: 'Musteri Listesi',
        description: 'Musteri kayitlarini yonet',
        route: 'AdminCustomers',
        color: serviceBlue,
    },
    {
        key: 'inventory',
        icon: 'package-variant-closed',
        label: 'Urun ve Envanter',
        description: 'Urun ve stok akislarini yonet',
        route: 'AdminInventory',
        color: '#7C3AED',
    },
    {
        key: 'finance-payroll',
        icon: 'cash-multiple',
        label: 'Maas ve Bordro',
        description: 'Bordro ve ozluk surecleri',
        route: 'AdminPayroll',
        color: '#14B8A6',
    },
    {
        key: 'finance-accounting',
        icon: 'finance',
        label: 'Finans ve Muhasebe',
        description: 'Gelir gider raporlari',
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

const MENU_ITEMS_BY_KEY = ADMIN_MENU_ITEMS.reduce((accumulator, item) => {
    accumulator[item.key] = item;
    return accumulator;
}, {});

function MenuItem({ icon, label, description, onPress, color, badge, colors }) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.menuItem,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.88 : 1,
                },
            ]}
        >
            <View style={[styles.menuIcon, { backgroundColor: `${color}20` }]}>
                <MaterialCommunityIcons name={icon} size={24} color={color} />
            </View>
            <View style={styles.menuContent}>
                <View style={styles.menuLabelRow}>
                    <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
                    {badge > 0 ? (
                        <View style={[styles.badge, { backgroundColor: serviceRed }]}>
                            <Text style={styles.badgeText}>{badge}</Text>
                        </View>
                    ) : null}
                </View>
                <Text style={[styles.menuDesc, { color: colors.textSecondary }]}>{description}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textTertiary} />
        </Pressable>
    );
}

export default function AdminPanelScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { isAdmin, mobilePermissions } = useAuth();
    const [pendingCount, setPendingCount] = useState(0);

    const permissionKeys = useMemo(
        () => Object.keys(mobilePermissions || {}).filter((key) => Boolean(mobilePermissions?.[key])),
        [mobilePermissions]
    );

    const shouldFetchPendingCount = isAdmin || Boolean(mobilePermissions?.can_manage_users);

    const fetchPendingCount = useCallback(async () => {
        if (!shouldFetchPendingCount) {
            setPendingCount(0);
            return;
        }

        try {
            const response = await api.get(ENDPOINTS.AUTH.USER_APPROVAL, {
                params: { status: 'pending' },
            });
            const data = Array.isArray(response?.data) ? response.data : [];
            setPendingCount(data.length);
        } catch (error) {
            console.log('Pending count fetch error:', error?.response?.data || error?.message || error);
        }
    }, [shouldFetchPendingCount]);

    useFocusEffect(
        useCallback(() => {
            fetchPendingCount();
        }, [fetchPendingCount])
    );

    const baseItems = useMemo(() => {
        if (isAdmin) {
            return ADMIN_MENU_ITEMS;
        }

        const keys = [];
        permissionKeys.forEach((permissionKey) => {
            const mappedKeys = PERMISSION_ITEM_MAP[permissionKey] || [];
            mappedKeys.forEach((itemKey) => {
                if (!keys.includes(itemKey) && MENU_ITEMS_BY_KEY[itemKey]) {
                    keys.push(itemKey);
                }
            });
        });

        return keys.map((itemKey) => MENU_ITEMS_BY_KEY[itemKey]);
    }, [isAdmin, permissionKeys]);

    const menuItems = useMemo(
        () => baseItems.map((item) => ({
            ...item,
            badge: item.badgeKey === 'pendingUsers' ? pendingCount : 0,
        })),
        [baseItems, pendingCount]
    );

    const panelTitle = isAdmin ? 'Yonetim' : 'Teknisyen Paneli';
    const panelBadge = isAdmin ? 'Admin' : 'Teknisyen';
    const sectionTitle = isAdmin ? 'YONETIM' : 'YETKILI ALANLAR';

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{panelTitle}</Text>
                <View style={[styles.badge, { backgroundColor: isAdmin ? serviceBlue : serviceGreen }]}>
                    <Text style={styles.badgeText}>{panelBadge}</Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{sectionTitle}</Text>

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
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>Henuz erisim verilmedi</Text>
                            <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>Bu panelde gosterilecek sayfalar teknisyen izinlerine gore acilacak.</Text>
                        </View>
                    )}
                </View>
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
        paddingBottom: 16,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    container: {
        paddingHorizontal: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: 12,
        marginLeft: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
    },
    menuIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
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
        fontSize: 16,
        fontWeight: '700',
    },
    menuDesc: {
        fontSize: 13,
    },
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