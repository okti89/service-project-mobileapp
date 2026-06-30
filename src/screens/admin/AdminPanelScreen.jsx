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
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

const MENU_ITEMS = [
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
        key: 'users-passive',
        icon: 'account-cancel-outline',
        label: 'Pasif / Reddedilenler',
        description: 'Kapalı ve reddedilen hesaplar',
        route: 'AdminRejectedUsers',
        color: '#64748B',
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
        route: 'AdminTechnicianLocations',
        color: serviceGreen,
    },
    {
        key: 'technicians-shifts',
        icon: 'clock-outline',
        label: 'Teknisyen Mesaileri',
        description: 'Mesai kayıtlarını incele',
        route: 'AdminTechnicianShifts',
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
        key: 'company-settings',
        icon: 'cog-outline',
        label: 'Firma Ayarları',
        description: 'Sistem ayarlarını yönet',
        route: 'AdminCompanySettings',
        color: '#64748B',
    },
];

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
    const [pendingCount, setPendingCount] = useState(0);

    const fetchPendingCount = useCallback(async () => {
        try {
            const response = await api.get(ENDPOINTS.AUTH.USER_APPROVAL, {
                params: { status: 'pending' },
            });
            const data = Array.isArray(response?.data) ? response.data : [];
            setPendingCount(data.length);
        } catch (error) {
            console.log('Pending count fetch error:', error?.response?.data || error?.message || error);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchPendingCount();
        }, [fetchPendingCount])
    );

    const menuItems = useMemo(
        () => MENU_ITEMS.map((item) => ({
            ...item,
            badge: item.badgeKey === 'pendingUsers' ? pendingCount : 0,
        })),
        [pendingCount]
    );

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}> 
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}> 
                <Text style={[styles.headerTitle, { color: colors.text }]}>Yönetim</Text>
                <View style={[styles.badge, { backgroundColor: serviceBlue }]}> 
                    <Text style={styles.badgeText}>Admin</Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>YÖNETİM</Text>
                    {menuItems.map((item) => (
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
                    ))}
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
});
