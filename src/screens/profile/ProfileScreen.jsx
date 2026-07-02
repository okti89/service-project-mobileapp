import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Alert,
    Image,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { serviceBlue, serviceGreen, serviceRed } from '@/theme/color';

const MenuItem = ({ icon, label, value, onPress, danger, showChevron = true }) => {
    const { colors } = useTheme();

    return (
        <Pressable
            onPress={onPress}
            style={[styles.menuItem, { borderBottomColor: colors.divider }]}
        >
            <View style={styles.menuItemLeft}>
                <View
                    style={[
                        styles.menuIconWrap,
                        { backgroundColor: danger ? `${serviceRed}15` : `${serviceBlue}15` },
                    ]}
                >
                    <MaterialCommunityIcons
                        name={icon}
                        size={20}
                        color={danger ? serviceRed : serviceBlue}
                    />
                </View>
                <View style={styles.menuItemContent}>
                    <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
                    {value && (
                        <Text style={[styles.menuValue, { color: colors.textSecondary }]}>
                            {value}
                        </Text>
                    )}
                </View>
            </View>
            {showChevron && (
                <MaterialCommunityIcons
                    name="chevron-right"
                    size={22}
                    color={colors.textTertiary}
                />
            )}
        </Pressable>
    );
};

const SectionHeader = ({ title }) => {
    const { colors } = useTheme();

    return (
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
            {title}
        </Text>
    );
};

export default function ProfileScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark, themeMode, setThemeMode } = useTheme();
    const { userInfo, isAdmin, isTechnician, logout } = useAuth();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const avatar = userInfo?.avatar || userInfo?.avatar_url;
    const displayName =
        [userInfo?.first_name, userInfo?.last_name].filter(Boolean).join(' ') ||
        userInfo?.full_name ||
        userInfo?.email ||
        'Kullanici';
    const initials = displayName
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'KL';

    const roleLabel = isAdmin ? 'Yonetici' : isTechnician ? 'Teknisyen' : 'Kullanici';
    const roleColor = isAdmin ? serviceBlue : isTechnician ? serviceGreen : colors.textSecondary;

    const handleLogout = () => {
        Alert.alert(
            'Cikis Yap',
            'Hesabinizdan cikis yapmak istediginize emin misiniz?',
            [
                { text: 'Iptal', style: 'cancel' },
                {
                    text: 'Cikis Yap',
                    style: 'destructive',
                    onPress: async () => {
                        setIsLoggingOut(true);
                        try {
                            await logout();
                        } catch (error) {
                            console.log('Logout error:', error);
                            setIsLoggingOut(false);
                        }
                    },
                },
            ]
        );
    };

    const toggleTheme = () => {
        setThemeMode(themeMode === 'light' ? 'dark' : 'light');
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.container,
                    {
                        paddingTop: insets.top + 16,
                        paddingBottom: Math.max(insets.bottom, 20) + 20,
                    },
                ]}
            >
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Profil</Text>
                    <Pressable
                        onPress={toggleTheme}
                        style={[styles.themeToggleBtn, { borderColor: colors.border }]}
                    >
                        <MaterialCommunityIcons
                            name={themeMode === 'light' ? 'weather-sunny' : 'weather-night'}
                            size={20}
                            color={colors.text}
                        />
                    </Pressable>
                </View>

                <LinearGradient
                    colors={isDark ? ['#2D2D44', '#252538'] : ['#0066CC', '#0052A3']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.profileCard}
                >
                    <View style={styles.profileHeader}>
                        <View style={styles.avatarContainer}>
                            {avatar ? (
                                <Image source={{ uri: avatar }} style={styles.avatar} />
                            ) : (
                                <View style={styles.avatarInitials}>
                                    <Text style={styles.avatarInitialsText}>{initials}</Text>
                                </View>
                            )}
                            <View style={styles.statusBadge}>
                                <View
                                    style={[
                                        styles.statusDot,
                                        { backgroundColor: isAdmin ? serviceGreen : serviceBlue },
                                    ]}
                                />
                            </View>
                        </View>

                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName} numberOfLines={1}>
                                {displayName}
                            </Text>
                            <View style={styles.roleBadge}>
                                <Text style={styles.roleBadgeText}>{roleLabel}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.profileMeta}>
                        <View style={styles.metaItem}>
                            <MaterialCommunityIcons name="email-outline" size={16} color="rgba(255,255,255,0.7)" />
                            <Text style={styles.metaText} numberOfLines={1}>
                                {userInfo?.email || '-'}
                            </Text>
                        </View>
                        {userInfo?.phone_number && (
                            <View style={styles.metaItem}>
                                <MaterialCommunityIcons name="phone-outline" size={16} color="rgba(255,255,255,0.7)" />
                                <Text style={styles.metaText}>{userInfo.phone_number}</Text>
                            </View>
                        )}
                    </View>
                </LinearGradient>

                <View style={[styles.statsRow, { backgroundColor: colors.surface }]}>
                    <View style={[styles.statItem, { borderRightColor: colors.divider }]}>
                        <Text style={[styles.statValue, { color: serviceBlue }]}>
                            {userInfo?.tenant_code || '-'}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                            Tenant
                        </Text>
                    </View>
                    <View style={[styles.statItem, { borderRightColor: colors.divider }]}>
                        <Text style={[styles.statValue, { color: serviceGreen }]}>
                            {userInfo?.is_active ? 'Aktif' : 'Pasif'}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                            Durum
                        </Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: roleColor }]}>
                            {userInfo?.date_joined
                                ? new Date(userInfo.date_joined).toLocaleDateString('tr-TR', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                  })
                                : '-'}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                            Katilim
                        </Text>
                    </View>
                </View>

                <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                    <SectionHeader title="HESAP AYARLARI" />
                    {isTechnician && (
                        <MenuItem
                            icon="chart-box-outline"
                            label="Performansim"
                            onPress={() => navigation.navigate('TechnicianPerformance')}
                        />
                    )}
                    <MenuItem
                        icon="file-document-multiple-outline"
                        label="Bordrolarim"
                        value="Maas gecmisi ve bordro detaylari"
                        onPress={() => navigation.navigate('MyPayrolls')}
                    />
                    <MenuItem
                        icon="account-outline"
                        label="Sifre Degistir"
                        onPress={() => navigation.navigate('ChangePassword')}
                    />
                    <MenuItem
                        icon="palette-outline"
                        label="Gorunum Ayarlari"
                        onPress={() => navigation.navigate('AppearanceSettings')}
                    />
                    {isAdmin && (
                        <MenuItem
                            icon="cellphone-cog"
                            label="Cihaz Yonetimi"
                            value="Tum kullanicilara ait cihazlar"
                            onPress={() => navigation.navigate('AdminDeviceList')}
                        />
                    )}
                    <MenuItem
                        icon={themeMode === 'light' ? 'weather-night' : 'weather-sunny'}
                        label="Tema Degistir"
                        value={themeMode === 'light' ? 'Acik' : 'Koyu'}
                        onPress={toggleTheme}
                        showChevron={false}
                    />
                </View>

                <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                    <SectionHeader title="BILGI" />
                    <MenuItem
                        icon="shield-check-outline"
                        label="Gizlilik Politikasi"
                        onPress={() => {}}
                    />
                    <MenuItem
                        icon="file-document-outline"
                        label="Kullanim Kosullari"
                        onPress={() => {}}
                    />
                    <MenuItem
                        icon="information-outline"
                        label="Uygulama Bilgisi"
                        value="v1.0.0"
                        onPress={() => {}}
                        showChevron={false}
                    />
                </View>

                <Pressable
                    onPress={handleLogout}
                    disabled={isLoggingOut}
                    style={[styles.logoutButton, { borderColor: serviceRed }]}
                >
                    {isLoggingOut ? (
                        <ActivityIndicator size="small" color={serviceRed} />
                    ) : (
                        <>
                            <MaterialCommunityIcons name="logout" size={22} color={serviceRed} />
                            <Text style={[styles.logoutText, { color: serviceRed }]}>
                                Cikis Yap
                            </Text>
                        </>
                    )}
                </Pressable>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    container: {
        paddingHorizontal: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
    },
    themeToggleBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileCard: {
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    avatarInitials: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    avatarInitialsText: {
        fontSize: 26,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    statusBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    profileInfo: {
        flex: 1,
        marginLeft: 16,
    },
    profileName: {
        fontSize: 22,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 6,
    },
    roleBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    roleBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    profileMeta: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.15)',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    metaText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        marginLeft: 8,
    },
    statsRow: {
        flexDirection: 'row',
        borderRadius: 16,
        paddingVertical: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        borderRightWidth: 1,
    },
    statValue: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '500',
    },
    menuCard: {
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionHeader: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: 12,
        marginLeft: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    menuIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    menuItemContent: {
        flex: 1,
    },
    menuLabel: {
        fontSize: 15,
        fontWeight: '600',
    },
    menuValue: {
        fontSize: 12,
        marginTop: 2,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 2,
        marginTop: 8,
        marginBottom: 20,
        gap: 8,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '700',
    },
});
