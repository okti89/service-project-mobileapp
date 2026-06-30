import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { semanticRadius } from '@/theme/radius';

const getInitials = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

export default function TechnicianProfileCard({ userInfo, technicianProfile, loading }) {
    const { colors, isDark } = useTheme();

    const fullName = useMemo(() => {
        if (technicianProfile?.full_name) return technicianProfile.full_name;
        if (userInfo?.full_name) return userInfo.full_name;
        const first = userInfo?.first_name || '';
        const last = userInfo?.last_name || '';
        return `${first} ${last}`.trim() || 'Teknisyen';
    }, [technicianProfile, userInfo]);

    const avatarUri = resolveMediaUrl(userInfo?.avatar);
    const statusInfo = technicianProfile?.status_info;
    const statusColor = statusInfo?.color || colors.success;
    const statusLabel = technicianProfile?.status_display || statusInfo?.name || 'Müsait';
    const isOnline = Boolean(technicianProfile?.is_online);

    return (
        <View style={styles.wrapper}>
            <LinearGradient
                colors={isDark ? ['#3A3A58', '#2D2D44'] : ['#FFFFFF', '#F8FAFD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                    styles.card,
                    {
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                        ...Platform.select({
                            ios: {
                                shadowColor: isDark ? '#000' : colors.primary,
                                shadowOffset: { width: 0, height: 10 },
                                shadowOpacity: isDark ? 0.35 : 0.12,
                                shadowRadius: 20,
                            },
                            android: { elevation: 8 },
                        }),
                    },
                ]}
            >
                <View style={[styles.accentLine, { backgroundColor: statusColor }]} />

                <View style={styles.topRow}>
                    <View style={styles.avatarWrap}>
                        <LinearGradient
                            colors={[colors.primary, colors.primaryDark || colors.primary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.avatarRing}
                        >
                            {avatarUri ? (
                                <Image source={{ uri: avatarUri }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatarFallback, { backgroundColor: colors.surface }]}>
                                    <Text style={[styles.initials, { color: colors.primary }]}>
                                        {getInitials(fullName)}
                                    </Text>
                                </View>
                            )}
                        </LinearGradient>
                        <View
                            style={[
                                styles.onlineBadge,
                                {
                                    backgroundColor: isOnline ? colors.success : colors.textTertiary,
                                    borderColor: isDark ? '#2D2D44' : '#FFFFFF',
                                },
                            ]}
                        />
                    </View>

                    <View style={styles.info}>
                        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                            {fullName}
                        </Text>
                        <View style={styles.roleRow}>
                            <MaterialCommunityIcons
                                name="wrench-outline"
                                size={13}
                                color={colors.primary}
                            />
                            <Text style={[styles.role, { color: colors.textSecondary }]}>
                                Saha Teknisyeni
                            </Text>
                        </View>

                        <View style={styles.chipRow}>
                            <View style={[styles.chip, { backgroundColor: `${statusColor}14` }]}>
                                <View style={[styles.chipDot, { backgroundColor: statusColor }]} />
                                <Text style={[styles.chipText, { color: statusColor }]} numberOfLines={1}>
                                    {statusLabel}
                                </Text>
                            </View>
                            <View style={[styles.chip, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                                <MaterialCommunityIcons
                                    name={isOnline ? 'access-point' : 'access-point-off'}
                                    size={13}
                                    color={isOnline ? colors.success : colors.textTertiary}
                                />
                                <Text
                                    style={[
                                        styles.chipText,
                                        { color: isOnline ? colors.success : colors.textTertiary },
                                    ]}
                                >
                                    {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {(userInfo?.phone_number || userInfo?.email) ? (
                    <View style={[styles.details, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : colors.divider }]}>
                        {userInfo?.phone_number ? (
                            <View style={[styles.detailPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F6FB' }]}>
                                <MaterialCommunityIcons name="phone-outline" size={15} color={colors.primary} />
                                <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {userInfo.phone_number}
                                </Text>
                            </View>
                        ) : null}
                        {userInfo?.email ? (
                            <View style={[styles.detailPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F6FB' }]}>
                                <MaterialCommunityIcons name="email-outline" size={15} color={colors.primary} />
                                <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {userInfo.email}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {loading ? (
                    <Text style={[styles.loadingHint, { color: colors.textTertiary }]}>
                        Profil güncelleniyor...
                    </Text>
                ) : null}
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginHorizontal: spacing.gutter,
        marginTop: -28,
    },
    card: {
        borderRadius: 22,
        borderWidth: 1,
        padding: spacing.l,
        overflow: 'hidden',
    },
    accentLine: {
        position: 'absolute',
        top: 0,
        left: 24,
        right: 24,
        height: 3,
        borderRadius: 2,
        opacity: 0.85,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    avatarWrap: {
        position: 'relative',
    },
    avatarRing: {
        width: 72,
        height: 72,
        borderRadius: 36,
        padding: 3,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 33,
    },
    avatarFallback: {
        flex: 1,
        borderRadius: 33,
        alignItems: 'center',
        justifyContent: 'center',
    },
    initials: {
        fontSize: 22,
        fontWeight: '700',
    },
    onlineBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 2.5,
    },
    info: {
        flex: 1,
        marginLeft: spacing.m,
    },
    name: {
        ...typography.h3,
        fontSize: 19,
        letterSpacing: -0.3,
    },
    roleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    role: {
        ...typography.caption,
        fontWeight: '500',
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.s,
        marginTop: spacing.m,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: semanticRadius.full,
    },
    chipDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    chipText: {
        fontSize: 11,
        fontWeight: '600',
    },
    details: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.s,
        marginTop: spacing.l,
        paddingTop: spacing.l,
        borderTopWidth: 1,
    },
    detailPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s,
        borderRadius: semanticRadius.button,
        maxWidth: '100%',
    },
    detailText: {
        ...typography.caption,
        fontWeight: '500',
        flexShrink: 1,
    },
    loadingHint: {
        ...typography.caption,
        marginTop: spacing.s,
        textAlign: 'center',
    },
});
