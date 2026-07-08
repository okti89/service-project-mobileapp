import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { semanticRadius } from '@/theme/radius';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';

const TONE_META = {
    info: { color: serviceBlue, bg: `${serviceBlue}14`, ring: `${serviceBlue}33` },
    success: { color: serviceGreen, bg: `${serviceGreen}14`, ring: `${serviceGreen}33` },
    warning: { color: serviceOrange, bg: `${serviceOrange}14`, ring: `${serviceOrange}33` },
    danger: { color: serviceRed, bg: `${serviceRed}14`, ring: `${serviceRed}33` },
};

const ActionButton = ({ label, icon, onPress, variant = 'primary', loading = false, disabled = false, color }) => {
    const { colors, isDark } = useTheme();
    const palette = TONE_META[variant === 'primary' ? 'info' : 'success'];
    const accent = color || palette.color;

    const isDisabled = disabled || loading;
    const stylesByVariant = (() => {
        if (variant === 'primary') {
            return {
                bg: accent,
                border: accent,
                text: '#FFFFFF',
                pressedBg: isDark ? `${accent}D9` : `${accent}E6`,
            };
        }
        if (variant === 'outline') {
            return {
                bg: 'transparent',
                border: accent,
                text: accent,
                pressedBg: `${accent}14`,
            };
        }
        if (variant === 'danger') {
            return {
                bg: serviceRed,
                border: serviceRed,
                text: '#FFFFFF',
                pressedBg: isDark ? '#A02C39' : '#B02A37',
            };
        }
        return {
            bg: 'transparent',
            border: colors.border,
            text: colors.textSecondary,
            pressedBg: colors.surfaceMuted,
        };
    })();

    return (
        <Pressable
            onPress={onPress}
            disabled={isDisabled}
            style={({ pressed }) => [
                styles.actionBtn,
                {
                    backgroundColor: stylesByVariant.bg,
                    borderColor: stylesByVariant.border,
                    opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1,
                },
            ]}
        >
            {loading ? (
                <ActivityIndicator color={stylesByVariant.text} size="small" />
            ) : (
                <>
                    {icon ? (
                        <MaterialCommunityIcons
                            name={icon}
                            size={18}
                            color={stylesByVariant.text}
                        />
                    ) : null}
                    <Text style={[styles.actionText, { color: stylesByVariant.text }]}>
                        {label}
                    </Text>
                </>
            )}
        </Pressable>
    );
};

const InfoCard = ({ icon, iconColor, title, description, value, onPress }) => {
    const { colors } = useTheme();
    const accent = iconColor || serviceBlue;

    return (
        <Pressable
            onPress={onPress}
          disabled={!onPress}
            style={({ pressed }) => [
                styles.infoCard,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed && onPress ? 0.85 : 1,
                },
            ]}
        >
            <View style={[styles.infoIcon, { backgroundColor: `${accent}15` }]}>
                <MaterialCommunityIcons name={icon} size={20} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: colors.text }]} numberOfLines={1}>
                    {title}
                </Text>
                {description ? (
                    <Text
                        style={[styles.infoDescription, { color: colors.textSecondary }]}
                        numberOfLines={2}
                    >
                        {description}
                    </Text>
                ) : null}
            </View>
            {value ? (
                <View style={[styles.infoValue, { backgroundColor: `${accent}15` }]}>
                    <Text style={[styles.infoValueText, { color: accent }]}>{value}</Text>
                </View>
            ) : onPress ? (
                <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={colors.textTertiary}
                />
            ) : null}
        </Pressable>
    );
};

const AccountStatusLayout = ({
    icon,
    iconColor,
    tone = 'info',
    title,
    subtitle,
    description,
    highlights = [],
    infos = [],
    primaryAction,
    secondaryAction,
    tertiaryAction,
    children,
}) => {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const meta = TONE_META[tone] || TONE_META.info;
    const accent = iconColor || meta.color;

    return (
        <View
            style={[
                styles.screen,
                {
                    backgroundColor: colors.background,
                    paddingTop: insets.top + spacing.l,
                    paddingBottom: insets.bottom + spacing.l,
                },
            ]}
        >
            <View style={styles.scrollContent}>
                <View
                    style={[
                        styles.iconHero,
                        {
                            backgroundColor: meta.bg,
                            borderColor: meta.ring,
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.iconHeroInner,
                            { backgroundColor: `${accent}26` },
                        ]}
                    >
                        <MaterialCommunityIcons name={icon} size={42} color={accent} />
                    </View>
                </View>

                {subtitle ? (
                    <View style={[styles.subtitleChip, { backgroundColor: `${accent}14` }]}>
                        <Text style={[styles.subtitleText, { color: accent }]}>{subtitle}</Text>
                    </View>
                ) : null}

                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

                {description ? (
                    <Text style={[styles.description, { color: colors.textSecondary }]}>
                        {description}
                    </Text>
                ) : null}

                {highlights.length ? (
                    <View style={styles.highlightsWrap}>
                        {highlights.map((item, index) => (
                            <View
                                key={`${item?.title || 'hl'}-${index}`}
                                style={[
                                    styles.highlight,
                                    {
                                        backgroundColor: colors.surfaceMuted,
                                        borderColor: colors.border,
                                    },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.highlightIcon,
                                        { backgroundColor: `${item.color || accent}1F` },
                                    ]}
                                >
                                    <MaterialCommunityIcons
                                        name={item.icon || 'check'}
                                        size={16}
                                        color={item.color || accent}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.highlightTitle, { color: colors.text }]}>
                                        {item.title}
                                    </Text>
                                    {item.description ? (
                                        <Text
                                            style={[
                                                styles.highlightDescription,
                                                { color: colors.textSecondary },
                                            ]}
                                        >
                                            {item.description}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </View>
                ) : null}

                {infos.length ? (
                    <View style={styles.infosWrap}>
                        {infos.map((info, index) => (
                            <InfoCard
                                key={`${info?.title || 'info'}-${index}`}
                                icon={info.icon}
                                iconColor={info.iconColor || accent}
                                title={info.title}
                                description={info.description}
                                value={info.value}
                                onPress={info.onPress}
                            />
                        ))}
                    </View>
                ) : null}

                {children}
            </View>

            {(primaryAction || secondaryAction || tertiaryAction) ? (
                <View style={[styles.actionsBar, { borderTopColor: colors.divider }]}>
                    {tertiaryAction ? (
                        <ActionButton {...tertiaryAction} variant="ghost" />
                    ) : null}
                    {secondaryAction ? (
                        <ActionButton {...secondaryAction} variant="outline" />
                    ) : null}
                    {primaryAction ? (
                        <ActionButton {...primaryAction} variant="primary" color={accent} />
                    ) : null}
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        paddingHorizontal: spacing.gutter,
    },
    scrollContent: {
        flex: 1,
        alignItems: 'center',
        paddingTop: spacing['3xl'],
        gap: spacing.m,
    },
    iconHero: {
        width: 124,
        height: 124,
        borderRadius: 62,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        marginBottom: spacing.m,
    },
    iconHeroInner: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    subtitleChip: {
        paddingHorizontal: spacing.m,
        paddingVertical: 4,
        borderRadius: 999,
        marginBottom: spacing.s,
    },
    subtitleText: {
        ...typography.caption,
        fontWeight: '800',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    title: {
        ...typography.h1,
        textAlign: 'center',
    },
    description: {
        ...typography.body,
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 360,
    },
    highlightsWrap: {
        width: '100%',
        gap: spacing.s,
        marginTop: spacing.m,
    },
    highlight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
        padding: spacing.m,
        borderRadius: semanticRadius.card,
        borderWidth: 1,
    },
    highlightIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    highlightTitle: {
        ...typography.bodySmall,
        fontWeight: '700',
    },
    highlightDescription: {
        ...typography.caption,
        marginTop: 2,
        lineHeight: 17,
    },
    infosWrap: {
        width: '100%',
        gap: spacing.s,
        marginTop: spacing.m,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
        padding: spacing.m,
        borderRadius: semanticRadius.card,
        borderWidth: 1,
    },
    infoIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoTitle: {
        ...typography.bodySmall,
        fontWeight: '700',
    },
    infoDescription: {
        ...typography.caption,
        marginTop: 2,
        lineHeight: 17,
    },
    infoValue: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
    },
    infoValueText: {
        ...typography.caption,
        fontWeight: '800',
    },
    actionsBar: {
        flexDirection: 'row',
        gap: spacing.s,
        paddingTop: spacing.m,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    actionBtn: {
        flex: 1,
        minHeight: 50,
        paddingHorizontal: spacing.m,
        borderRadius: semanticRadius.button,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    actionText: {
        ...typography.bodySmall,
        fontWeight: '800',
    },
});

export default AccountStatusLayout;
