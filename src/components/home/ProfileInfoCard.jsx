import React, { useMemo } from 'react';
import {
    Image,
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const getInitials = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const ROLE_LABELS = {
    admin: 'Yönetici',
    technician: 'Saha Teknisyeni',
    customer: 'Müşteri',
};

const ProfileInfoCard = ({
    userInfo,
    onPress,
    onCallPress,
    onEmailPress,
    onStatsPress,
    stats,
}) => {
    const { colors, isDark } = useTheme();

    const fullName = useMemo(() => {
        if (userInfo?.full_name) return userInfo.full_name;
        const first = userInfo?.first_name || '';
        const last = userInfo?.last_name || '';
        return `${first} ${last}`.trim() || 'Kullanıcı';
    }, [userInfo]);

    const initials = useMemo(() => getInitials(fullName), [fullName]);
    const avatarUri = resolveMediaUrl(userInfo?.avatar || userInfo?.avatar_url);

    const userType = userInfo?.user_type || (userInfo?.is_admin ? 'admin' : 'technician');
    const roleLabel = ROLE_LABELS[userType] || 'Kullanıcı';
    const isAdmin = Boolean(userInfo?.is_admin || userType === 'admin');

    const phone = userInfo?.phone_number || userInfo?.phone;
    const email = userInfo?.email;

    const handleCall = () => {
        if (onCallPress) return onCallPress(phone);
        if (phone) Linking.openURL(`tel:${String(phone).replace(/\s/g, '')}`);
    };

    const handleEmail = () => {
        if (onEmailPress) return onEmailPress(email);
        if (email) Linking.openURL(`mailto:${email}`);
    };

    const accentColor = isAdmin ? colors.error : colors.primary;
    const isOnline = userInfo?.is_active !== false;

    return (
        <Pressable
            onPress={onPress}
            android_ripple={{ color: `${colors.primary}0C`, borderless: false }}
            style={({ pressed }) => [
                { opacity: pressed ? 0.97 : 1 },
            ]}
        >
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: isDark ? colors.surface : colors.surface,
                        borderColor: isDark ? colors.border : colors.border,
                        ...Platform.select({
                            ios: {
                                shadowColor: isDark ? '#000' : colors.primary,
                                shadowOffset: { width: 0, height: 6 },
                                shadowOpacity: isDark ? 0.28 : 0.08,
                                shadowRadius: 14,
                            },
                            android: { elevation: 4 },
                        }),
                    },
                ]}
            >
                {/* Sol aksan çizgisi */}
                <View
                    style={[
                        styles.accentRail,
                        { backgroundColor: accentColor },
                    ]}
                />

                <View style={styles.row}>
                    {/* Avatar */}
                    <View style={styles.avatarWrap}>
                        <LinearGradient
                            colors={[accentColor, colors.primaryDark || accentColor]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.avatarRing}
                        >
                            {avatarUri ? (
                                <Image
                                    source={{ uri: avatarUri }}
                                    style={styles.avatar}
                                    resizeMode="cover"
                                />
                            ) : (
                                <Text style={[styles.initials, { color: '#FFFFFF' }]}>
                                    {initials}
                                </Text>
                            )}
                        </LinearGradient>
                        <View
                            style={[
                                styles.statusDot,
                                {
                                    backgroundColor: isOnline
                                        ? colors.success
                                        : colors.textTertiary,
                                    borderColor: isDark ? colors.surface : '#FFFFFF',
                                },
                            ]}
                        />
                    </View>

                    {/* Bilgi */}
                    <View style={styles.info}>
                        <View style={styles.nameRow}>
                            <Text
                                style={[styles.name, { color: colors.text }]}
                                numberOfLines={1}
                            >
                                {fullName}
                            </Text>
                            {isAdmin ? (
                                <View
                                    style={[
                                        styles.adminBadge,
                                        { backgroundColor: `${colors.error}14` },
                                    ]}
                                >
                                    <MaterialCommunityIcons
                                        name="shield-crown"
                                        size={10}
                                        color={colors.error}
                                    />
                                </View>
                            ) : null}
                        </View>

                        <View style={styles.metaRow}>
                            <MaterialCommunityIcons
                                name={isAdmin ? 'shield-crown-outline' : 'wrench-outline'}
                                size={12}
                                color={colors.textSecondary}
                            />
                            <Text
                                style={[
                                    styles.role,
                                    { color: colors.textSecondary },
                                ]}
                                numberOfLines={1}
                            >
                                {roleLabel}
                            </Text>
                            {userInfo?.tenant_code ? (
                                <>
                                    <View
                                        style={[
                                            styles.dot,
                                            { backgroundColor: colors.textTertiary },
                                        ]}
                                    />
                                    <Text
                                        style={[
                                            styles.tenant,
                                            { color: colors.textTertiary },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {String(userInfo.tenant_code).toUpperCase()}
                                    </Text>
                                </>
                            ) : null}
                        </View>

                    </View>
                </View>

                {/* İstatistik şeridi (opsiyonel, kompakt) */}
                {stats && stats.length > 0 ? (
                    <Pressable
                        onPress={onStatsPress}
                        style={({ pressed }) => [
                            styles.statsRow,
                            {
                                borderTopColor: isDark
                                    ? 'rgba(255,255,255,0.06)'
                                    : colors.divider,
                                opacity: pressed ? 0.85 : 1,
                            },
                        ]}
                    >
                        {stats.map((item, index) => (
                            <View
                                key={item.key || `${item.label}-${index}`}
                                style={[
                                    styles.statItem,
                                    index > 0 && {
                                        borderLeftWidth: StyleSheet.hairlineWidth,
                                        borderLeftColor: isDark
                                            ? 'rgba(255,255,255,0.08)'
                                            : colors.divider,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.statValue,
                                        { color: item.color || colors.primary },
                                    ]}
                                >
                                    {item.value}
                                </Text>
                                <Text
                                    style={[
                                        styles.statLabel,
                                        { color: colors.textTertiary },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {item.label}
                                </Text>
                            </View>
                        ))}
                    </Pressable>
                ) : null}
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 18,
        borderWidth: 1,
        overflow: 'hidden',
    },
    accentRail: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: 3,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.m + 2,
        paddingHorizontal: spacing.l,
        paddingLeft: spacing.l + 4,
        gap: spacing.m,
    },
    avatarWrap: {
        position: 'relative',
    },
    avatarRing: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 24,
    },
    initials: {
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    statusDot: {
        position: 'absolute',
        bottom: -1,
        right: -1,
        width: 13,
        height: 13,
        borderRadius: 7,
        borderWidth: 2,
    },
    info: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    name: {
        ...typography.body,
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: -0.2,
        flexShrink: 1,
    },
    adminBadge: {
        width: 18,
        height: 18,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    role: {
        fontSize: 12,
        fontWeight: '500',
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 2,
        marginHorizontal: 4,
    },
    tenant: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    contactRow: {
        flexDirection: 'row',
        gap: spacing.xs + 2,
        marginTop: spacing.s,
        flexWrap: 'wrap',
    },
    contactChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: spacing.s + 2,
        paddingVertical: 5,
        borderRadius: 999,
        maxWidth: '70%',
    },
    contactText: {
        fontSize: 11,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingVertical: spacing.m,
        paddingHorizontal: spacing.s,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statValue: {
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
        letterSpacing: 0.2,
    },
});

export default ProfileInfoCard;