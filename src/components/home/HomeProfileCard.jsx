import React, { useMemo, useState } from 'react';
import {
    Image,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import { spacing } from '@/theme/spacing';
import ImageView from 'react-native-image-viewing';

const ROLE_META = {
    admin: { label: 'Yönetici', icon: 'shield-crown' },
    technician: { label: 'Saha Teknisyeni', icon: 'wrench' },
    customer: { label: 'Müşteri', icon: 'account' },
};

const getInitials = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 6) return 'İyi geceler';
    if (h < 12) return 'Günaydın';
    if (h < 18) return 'İyi günler';
    return 'İyi akşamlar';
};

const HomeProfileCard = ({ userInfo, shiftSummary, onPressShift }) => {
    const { colors, isDark } = useTheme();
    const [imgVisible, setImgVisible] = useState(false);

    const fullName = useMemo(() => {
        if (userInfo?.full_name) return userInfo.full_name;
        const first = userInfo?.first_name || '';
        const last = userInfo?.last_name || '';
        return `${first} ${last}`.trim() || 'Kullanıcı';
    }, [userInfo]);

    const initials = useMemo(() => getInitials(fullName), [fullName]);
    const avatarUri = resolveMediaUrl(userInfo?.avatar || userInfo?.avatar_url);

    const userType = userInfo?.user_type || (userInfo?.is_admin ? 'admin' : 'technician');
    const isAdmin = Boolean(userInfo?.is_admin || userType === 'admin');
    const meta = ROLE_META[userType] || { label: 'Ekip Üyesi', icon: 'account' };

    const accentColor = isAdmin ? colors.error : colors.primary;
    const greeting = getGreeting();
    const shouldStopShift = Boolean(shiftSummary?.shouldStopShift);
    const shiftButtonLabel = shouldStopShift ? 'Mesaiyi Bitir' : 'Mesai Başlat';
    const shiftButtonColor = shouldStopShift ? colors.error : colors.success;
    const remainingShortLabel = shiftSummary?.remainingLabel === 'Fazla mesai' ? 'Fazla' : 'Kalan';
    const progressValue = Math.max(0, Math.min(100, Number(shiftSummary?.completedPercentage || 0)));
    const progressWidth = `${progressValue}%`;

    return (
        <View style={styles.wrapper}>
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        ...Platform.select({
                            ios: {
                                shadowColor: isDark ? '#000' : accentColor,
                                shadowOffset: { width: 0, height: 6 },
                                shadowOpacity: isDark ? 0.2 : 0.08,
                                shadowRadius: 16,
                            },
                            android: { elevation: 3 },
                        }),
                    },
                ]}
            >
                <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

                <View style={styles.row}>
                    <Pressable
                        onPress={avatarUri ? () => setImgVisible(true) : undefined}
                        style={styles.avatarOuter}
                    >
                        <LinearGradient
                            colors={[accentColor, `${accentColor}BB`]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.avatarRing}
                        >
                            {avatarUri ? (
                                <Image source={{ uri: avatarUri }} style={styles.avatarImg} resizeMode="cover" />
                            ) : (
                                <Text style={styles.avatarInitials}>{initials}</Text>
                            )}
                        </LinearGradient>

                        <View
                            style={[
                                styles.onlineDot,
                                {
                                    backgroundColor: colors.success,
                                    borderColor: colors.surface,
                                },
                            ]}
                        />
                    </Pressable>

                    <View style={styles.info}>
                        <Text style={[styles.greeting, { color: colors.textTertiary }]}>{greeting}</Text>
                        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{fullName}</Text>
                        <View
                            style={[
                                styles.roleBadge,
                                {
                                    backgroundColor: `${accentColor}14`,
                                    borderColor: `${accentColor}28`,
                                },
                            ]}
                        >
                            <MaterialCommunityIcons name={meta.icon} size={11} color={accentColor} />
                            <Text style={[styles.roleText, { color: accentColor }]}>{meta.label}</Text>
                        </View>
                    </View>

                    {isAdmin && (
                        <View
                            style={[
                                styles.adminBadge,
                                {
                                    backgroundColor: `${accentColor}12`,
                                    borderColor: `${accentColor}30`,
                                },
                            ]}
                        >
                            <MaterialCommunityIcons name="shield-crown" size={18} color={accentColor} />
                        </View>
                    )}
                </View>

                {shiftSummary?.visible ? (
                    <View style={[styles.shiftRow, { borderTopColor: colors.border }]}>
                        <View style={styles.shiftInfo}>
                            <View style={styles.shiftTopLine}>
                                <Text style={[styles.shiftStatus, { color: shiftSummary.statusColor || colors.primary }]}>
                                    {shiftSummary.statusLabel}
                                </Text>
                                <Text style={[styles.shiftPercent, { color: shiftSummary.statusColor || colors.primary }]}>
                                    {shiftSummary.progressShortLabel || shiftSummary.progressLabel}
                                </Text>
                            </View>

                            <Text style={[styles.shiftMeta, { color: colors.textSecondary }]} numberOfLines={2}>
                                {shiftSummary.todayScheduleLabel || 'Tanımlı değil'}
                                {shiftSummary.targetDurationLabel ? ` • Hedef ${shiftSummary.targetDurationLabel}` : ''}
                            </Text>

                            <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }]}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            width: progressWidth,
                                            backgroundColor: shiftSummary.statusColor || colors.primary,
                                        },
                                    ]}
                                />
                            </View>

                            <View style={styles.progressFooter}>
                                <Text
                                    style={[styles.progressHint, { color: colors.textTertiary }]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                >
                                    Çalışılan {shiftSummary.workedDurationLabel || '00:00:00'}
                                </Text>
                                <Text
                                    style={[styles.progressHint, styles.progressHintRight, { color: colors.textTertiary }]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                >
                                    {`${remainingShortLabel}: ${shiftSummary.remainingDurationLabel || '00:00:00'}`}
                                </Text>
                            </View>
                        </View>

                        <Pressable
                            onPress={onPressShift}
                            android_ripple={{ color: shouldStopShift ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.18)', borderless: false }}
                            style={({ pressed }) => [
                                styles.shiftButton,
                                {
                                    backgroundColor: pressed ? `${shiftButtonColor}D9` : shiftButtonColor,
                                    borderColor: shiftButtonColor,
                                },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name={shouldStopShift ? 'stop-circle-outline' : 'play-circle-outline'}
                                size={16}
                                color="#FFFFFF"
                            />
                            <Text style={styles.shiftButtonText}>{shiftButtonLabel}</Text>
                        </Pressable>
                    </View>
                ) : null}
            </View>

            <ImageView
                images={avatarUri ? [{ uri: avatarUri }] : []}
                imageIndex={0}
                visible={imgVisible}
                onRequestClose={() => setImgVisible(false)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        marginHorizontal: spacing.gutter,
        marginTop: spacing.m,
        marginBottom: spacing.s,
    },
    card: {
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    accentBar: {
        width: 4,
        alignSelf: 'stretch',
    },
    row: {
        flex: 1,
        minWidth: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.m + 2,
        paddingHorizontal: spacing.m + 2,
        gap: spacing.m,
    },
    avatarOuter: {
        position: 'relative',
    },
    avatarRing: {
        width: 54,
        height: 54,
        borderRadius: 27,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2.5,
    },
    avatarImg: {
        width: '100%',
        height: '100%',
        borderRadius: 24,
    },
    avatarInitials: {
        fontSize: 18,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.4,
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
    info: {
        flex: 1,
        minWidth: 0,
        gap: 3,
    },
    greeting: {
        fontSize: 12,
        fontWeight: '500',
    },
    name: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.4,
        lineHeight: 22,
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 20,
        borderWidth: 1,
        marginTop: 2,
    },
    roleText: {
        fontSize: 11,
        fontWeight: '700',
    },
    adminBadge: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    shiftRow: {
        width: '100%',
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: spacing.m + 2,
        paddingVertical: spacing.m,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
    },
    shiftInfo: {
        flex: 1,
        minWidth: 0,
    },
    shiftTopLine: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.s,
    },
    shiftStatus: {
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: -0.2,
        flexShrink: 1,
    },
    shiftPercent: {
        fontSize: 11,
        fontWeight: '800',
    },
    shiftMeta: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
        lineHeight: 16,
    },
    progressTrack: {
        marginTop: 8,
        height: 7,
        borderRadius: 999,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 999,
    },
    progressFooter: {
        marginTop: 6,
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.s,
    },
    progressHint: {
        fontSize: 10,
        fontWeight: '600',
        flex: 1,
        minWidth: 0,
    },
    progressHintRight: {
        textAlign: 'right',
    },
    shiftButton: {
        minHeight: 38,
        minWidth: 126,
        borderRadius: 0,
        borderWidth: 1,
        paddingHorizontal: spacing.m,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs + 1,
        alignSelf: 'flex-end',
        marginBottom: 2,
    },
    shiftButtonText: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: -0.1,
        color: '#FFFFFF',
    },
});

export default HomeProfileCard;
