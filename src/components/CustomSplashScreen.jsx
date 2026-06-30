import React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const CustomSplashScreen = ({ message = 'Yükleniyor', submessage }) => {
    const { colors, isDark } = useTheme();

    const gradientColors = isDark
        ? [colors.surface, colors.background]
        : ['#FFFFFF', '#F5F7FA'];

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                <View style={styles.content}>
                    {/* Logo */}
                    <View style={styles.logoBlock}>
                        <LinearGradient
                            colors={[colors.primary, colors.primaryDark || colors.primary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.logoCircle, { shadowColor: colors.primary }]}
                        >
                            <MaterialCommunityIcons
                                name="tools"
                                size={56}
                                color="#FFFFFF"
                            />
                        </LinearGradient>
                    </View>

                    {/* Metinler */}
                    <View style={styles.textBlock}>
                        <Text style={[styles.appName, { color: colors.text }]}>
                            Servis Yönetimi
                        </Text>
                        <Text style={[styles.tagline, { color: colors.textTertiary }]}>
                            Saha ekibinizi yöneteceğiniz platform
                        </Text>
                    </View>

                    {/* Yükleniyor göstergesi */}
                    <View style={styles.loadingBlock}>
                        <View
                            style={[
                                styles.loadingChip,
                                {
                                    backgroundColor: isDark
                                        ? 'rgba(255,255,255,0.06)'
                                        : `${colors.primary}10`,
                                },
                            ]}
                        >
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                                {message}
                            </Text>
                        </View>
                        {submessage ? (
                            <Text style={[styles.subText, { color: colors.textTertiary }]}>
                                {submessage}
                            </Text>
                        ) : null}
                    </View>
                </View>

                {/* Alt bilgi */}
                <View style={styles.footer}>
                    <View style={styles.footerBrand}>
                        <View
                            style={[
                                styles.footerDot,
                                { backgroundColor: colors.primary },
                            ]}
                        />
                        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
                            v1.0 • Service Management
                        </Text>
                    </View>
                </View>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        // Tüm ekranı kapla — NavigationContainer ile kardeş component olarak
        // flex layout'a girip yarım kalmamalı.
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        elevation: 12,
    },
    gradient: {
        flex: 1,
        paddingHorizontal: spacing.xxl,
        paddingTop: spacing['5xl'],
        paddingBottom: spacing['4xl'],
        justifyContent: 'space-between',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoBlock: {
        marginBottom: spacing.xxl,
    },
    logoCircle: {
        width: 104,
        height: 104,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 18,
        elevation: 10,
    },
    textBlock: {
        alignItems: 'center',
        marginBottom: spacing['4xl'],
    },
    appName: {
        fontSize: 28,
        fontFamily: typography.fontFamily.bold,
        fontWeight: '900',
        letterSpacing: -0.5,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    tagline: {
        fontSize: 15,
        fontFamily: typography.fontFamily.medium,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 22,
    },
    loadingBlock: {
        alignItems: 'center',
        gap: spacing.s,
    },
    loadingChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
        paddingHorizontal: spacing.l,
        paddingVertical: spacing.s + 2,
        borderRadius: 999,
    },
    loadingText: {
        fontSize: 14,
        fontFamily: typography.fontFamily.semiBold,
        fontWeight: '600',
    },
    subText: {
        fontSize: 12,
        fontFamily: typography.fontFamily.regular,
        fontWeight: '400',
        textAlign: 'center',
    },
    footer: {
        alignItems: 'center',
    },
    footerBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
    },
    footerDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    footerText: {
        fontSize: 11,
        fontFamily: typography.fontFamily.medium,
        fontWeight: '500',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
});

export default CustomSplashScreen;