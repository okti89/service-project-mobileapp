import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const VARIANTS = {
    primary: 'primary',
    secondary: 'secondary',
    outline: 'outline',
    ghost: 'ghost',
    danger: 'danger',
    success: 'success',
};

const SIZES = {
    sm: 'sm',
    md: 'md',
    lg: 'lg',
};

const BUTTON_HEIGHT = 55;

const CustomButton = ({
    title,
    onPress,
    variant = VARIANTS.primary,
    size = SIZES.md,
    icon,
    iconPosition = 'left',
    loading = false,
    disabled = false,
    block = false,
    rounded = false,
    style,
    textStyle,
    gradient,
}) => {
    const { colors, isDark } = useTheme();

    const isDisabled = disabled || loading;
    const isOutlineLike =
        variant === VARIANTS.outline || variant === VARIANTS.ghost;

    const palette = (() => {
        switch (variant) {
            case VARIANTS.secondary:
                return {
                    bg: colors.surface,
                    border: colors.border,
                    text: colors.text,
                    pressedBg: isDark ? colors.surfaceMuted : colors.backgroundSecondary,
                    spinnerColor: colors.primary,
                    useGradient: false,
                };
            case VARIANTS.outline:
                return {
                    bg: 'transparent',
                    border: colors.primary,
                    text: colors.primary,
                    pressedBg: `${colors.primary}14`,
                    spinnerColor: colors.primary,
                    useGradient: false,
                };
            case VARIANTS.ghost:
                return {
                    bg: 'transparent',
                    border: 'transparent',
                    text: colors.primary,
                    pressedBg: `${colors.primary}18`,
                    spinnerColor: colors.primary,
                    useGradient: false,
                };
            case VARIANTS.danger:
                return {
                    bg: colors.error,
                    border: colors.error,
                    text: colors.white,
                    pressedBg: isDark ? '#A02C39' : '#B02A37',
                    spinnerColor: colors.white,
                    useGradient: true,
                    gradientColors: gradient || [colors.error, '#B02A37'],
                };
            case VARIANTS.success:
                return {
                    bg: colors.success,
                    border: colors.success,
                    text: colors.white,
                    pressedBg: isDark ? '#007F54' : '#008F5F',
                    spinnerColor: colors.white,
                    useGradient: true,
                    gradientColors: gradient || [colors.success, '#008F5F'],
                };
            case VARIANTS.primary:
            default:
                return {
                    bg: colors.primary,
                    border: colors.primary,
                    text: colors.white,
                    pressedBg: colors.primaryDark || colors.primary,
                    spinnerColor: colors.white,
                    useGradient: true,
                    gradientColors:
                        gradient || [colors.primary, colors.primaryDark || colors.primary],
                };
        }
    })();

    const sizing = (() => {
        switch (size) {
            case SIZES.sm:
                return {
                    height: 40,
                    paddingHorizontal: spacing.l,
                    fontSize: 14,
                    iconSize: 16,
                    letterSpacing: 0.5,
                };
            case SIZES.lg:
                return {
                    height: 60,
                    paddingHorizontal: spacing.xxl,
                    fontSize: 18,
                    iconSize: 22,
                    letterSpacing: 1,
                };
            case SIZES.md:
            default:
                return {
                    height: BUTTON_HEIGHT,
                    paddingHorizontal: spacing.xl,
                    fontSize: 17,
                    iconSize: 20,
                    letterSpacing: 0.8,
                };
        }
    })();

    const containerBorderRadius = rounded ? sizing.height / 2 : 14;

    const renderIcon = () => {
        if (!icon || loading) return null;
        const iconColor = isDisabled ? colors.disabled : palette.text;
        return (
            <MaterialCommunityIcons
                name={icon}
                size={sizing.iconSize}
                color={iconColor}
                style={iconPosition === 'right' ? styles.iconRight : styles.iconLeft}
            />
        );
    };

    const textColor = isDisabled ? colors.disabled : palette.text;
    const spinnerColor = isDisabled ? colors.disabled : palette.spinnerColor;

    const renderContent = () => (
        <View style={styles.inner}>
            {loading ? (
                <ActivityIndicator size="small" color={spinnerColor} />
            ) : (
                <>
                    {iconPosition === 'left' && renderIcon()}
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.text,
                            {
                                color: textColor,
                                fontSize: sizing.fontSize,
                                letterSpacing: sizing.letterSpacing,
                                fontFamily: typography.fontFamily.bold,
                            },
                            textStyle,
                        ]}
                    >
                        {title}
                    </Text>
                    {iconPosition === 'right' && renderIcon()}
                </>
            )}
        </View>
    );

    const shadowStyle = isOutlineLike || variant === VARIANTS.ghost
        ? null
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 5,
        };

    const pressedShadowStyle = isOutlineLike || variant === VARIANTS.ghost
        ? null
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 3,
        };

    const containerStyle = ({ pressed }) => [
        styles.base,
        {
            height: sizing.height,
            paddingHorizontal: sizing.paddingHorizontal,
            borderRadius: containerBorderRadius,
            alignSelf: block ? 'stretch' : 'flex-start',
            backgroundColor: isDisabled
                ? (isOutlineLike ? 'transparent' : colors.disabledSurface)
                : palette.bg,
            borderColor: isDisabled ? colors.disabled : palette.border,
            borderWidth: variant === VARIANTS.outline ? 1.5 : 0,
            opacity: isDisabled && isOutlineLike ? 0.55 : 1,
            ...(pressed && !isDisabled ? pressedShadowStyle : shadowStyle),
        },
        pressed && !isDisabled && !isOutlineLike && {
            backgroundColor: palette.pressedBg,
        },
        pressed && !isDisabled && isOutlineLike && {
            backgroundColor: palette.pressedBg,
        },
        style,
    ];

    const showGradient =
        palette.useGradient && !isDisabled && !isOutlineLike;

    return (
        <Pressable
            disabled={isDisabled}
            onPress={onPress}
            android_ripple={
                isOutlineLike
                    ? { color: palette.pressedBg, borderless: false }
                    : { color: 'rgba(255,255,255,0.18)', borderless: false }
            }
            style={containerStyle}
        >
            {showGradient ? (
                <LinearGradient
                    colors={palette.gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.gradient,
                        { borderRadius: containerBorderRadius },
                    ]}
                >
                    {renderContent()}
                </LinearGradient>
            ) : (
                renderContent()
            )}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    base: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    gradient: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    inner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xs,
    },
    text: {
        textAlign: 'center',
        fontWeight: '700',
    },
    iconLeft: {
        marginRight: spacing.xs + 2,
    },
    iconRight: {
        marginLeft: spacing.xs + 2,
    },
});

export default CustomButton;