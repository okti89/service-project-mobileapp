import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { useNotifications } from '@/context/NotificationContext';
import { useTheme } from '@/context/ThemeContext';
import technicianService from '@/services/technicianService';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { serviceGreen } from '@/theme/color';

const initialsOf = (label) => String(label || '').trim().split(/\s+/).map((chunk) => chunk[0]).join('').slice(0, 2).toUpperCase();

function SectionCard({ title, colors, children }) {
    return <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>{title ? <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text></View> : null}{children}</View>;
}

function MenuItem({ icon, title, colors, onPress, danger = false }) {
    return <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.72 : 1 }]}><View style={styles.menuLeft}><MaterialCommunityIcons name={icon} size={20} color={danger ? colors.error : colors.textSecondary} /><Text style={[styles.menuText, { color: danger ? colors.error : colors.text }]}>{title}</Text></View>{!danger ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} /> : null}</Pressable>;
}

export default function ProfileScreen({ navigation }) {
    const { colors } = useTheme();
    const { userInfo, logout, checkAuth } = useAuth();
    const { config } = useConfig();
    const { unreadCount = 0 } = useNotifications() || {};
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        try {
            await checkAuth?.({ silent: true });
            const myProfile = await technicianService.getMyProfile().catch(() => null);
            setProfile(myProfile || null);
        } catch (error) {
            console.log('Profile load error:', error?.response?.data || error?.message || error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [checkAuth]);

    useEffect(() => { setLoading(true); loadData(); }, [loadData]);
    const handleRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);
    const handleLogoutPress = useCallback(() => {
        Alert.alert('Çıkış Yap', 'Çıkış yapmak istediğinize emin misiniz?', [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Çıkış Yap', style: 'destructive', onPress: () => logout?.() },
        ]);
    }, [logout]);

    const fullName = userInfo?.full_name || [userInfo?.first_name, userInfo?.last_name].filter(Boolean).join(' ') || userInfo?.email || 'Kullanıcı';
    const roleLabel = userInfo?.user_type_display || 'Teknik Servis Uzmanı';
    const companyName = config?.name || 'Servis Yönetim Sistemi';
    const avatarUri = resolveMediaUrl(userInfo?.avatar);
    const statusName = profile?.status_display || 'Müsait';
    const statusColor = profile?.status_info?.color || serviceGreen;
    const rightActions = [{ icon: 'bell-outline', onPress: () => navigation.navigate('Notifications'), badge: unreadCount, accessibilityLabel: 'Bildirimler' }];

    if (loading) {
        return <WrapperContainer bg={colors.background} edges={NO_BOTTOM_EDGES}><Header title="Profil" rightActions={rightActions} borderBottom /><View style={styles.centerState}><ActivityIndicator size="large" color={colors.primary} /></View></WrapperContainer>;
    }

    return <WrapperContainer bg={colors.background} edges={NO_BOTTOM_EDGES}><Header title="Profil" rightActions={rightActions} borderBottom /><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}><SectionCard colors={colors}><Pressable style={styles.heroRow} onPress={() => navigation.navigate('ProfileEdit')}>{avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatar} /> : <View style={[styles.avatarFallback, { backgroundColor: `${colors.primary}16` }]}><Text style={[styles.avatarFallbackText, { color: colors.primary }]}>{initialsOf(fullName)}</Text></View>}<View style={styles.heroContent}><Text style={[styles.heroName, { color: colors.text }]}>{fullName}</Text><Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>{roleLabel}</Text><Text style={[styles.heroSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{companyName}</Text><View style={styles.statusRow}><View style={[styles.statusDot, { backgroundColor: statusColor }]} /><Text style={[styles.statusText, { color: colors.textSecondary }]}>{statusName}</Text></View></View><MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} /></Pressable></SectionCard><SectionCard title="Hesap" colors={colors}><MenuItem icon="account-edit-outline" title="Profili Düzenle" colors={colors} onPress={() => navigation.navigate('ProfileEdit')} /><MenuItem icon="account-outline" title="Kişisel Bilgiler" colors={colors} onPress={() => navigation.navigate('ProfilePersonalInfo')} /><MenuItem icon="lock-reset" title="Parola Değiştir" colors={colors} onPress={() => navigation.navigate('ProfileChangePassword')} /><MenuItem icon="chart-line" title="Performansım" colors={colors} onPress={() => navigation.navigate('ProfilePerformance')} /><MenuItem icon="clock-outline" title="Mesailerim" colors={colors} onPress={() => navigation.navigate('ProfileMyShifts')} /><MenuItem icon="file-document-outline" title="Maaş Bordro" colors={colors} onPress={() => navigation.navigate('TechnicianPayroll')} /></SectionCard><SectionCard colors={colors}><MenuItem icon="logout" title="Çıkış Yap" colors={colors} danger onPress={handleLogoutPress} /></SectionCard></ScrollView></WrapperContainer>;
}

const styles = StyleSheet.create({
    content: { paddingHorizontal: spacing.gutter, paddingTop: spacing.l, paddingBottom: spacing['5xl'], gap: spacing.m },
    centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    sectionCard: { borderWidth: 1, borderRadius: 24, padding: spacing.l, gap: spacing.m, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.m },
    sectionTitle: { ...typography.body, fontWeight: '800' },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
    avatar: { width: 88, height: 88, borderRadius: 28 },
    avatarFallback: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    avatarFallbackText: { fontSize: 28, fontWeight: '800' },
    heroContent: { flex: 1, gap: 4 },
    heroName: { ...typography.h3, fontWeight: '800' },
    heroSubtitle: { ...typography.bodySmall },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.xs },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusText: { ...typography.bodySmall, fontWeight: '600' },
    menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.m, paddingVertical: spacing.s },
    menuLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
    menuText: { ...typography.body, fontWeight: '600' },
});