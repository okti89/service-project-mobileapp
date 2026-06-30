import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useTheme } from '@/context/ThemeContext';
import { useConfig } from '@/context/ConfigContext';
import { useAuth } from '@/context/AuthContext';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const VARIANT_TOKENS = {
    default: {
        text: (c) => c.text,
        subtitle: (c) => c.textTertiary,
        icon: (c) => c.textSecondary,
        buttonBg: (c) => c.surfaceMuted,
        buttonBorder: (c) => c.border,
        badgeBorder: (c) => c.card,
        logoBg: (c) => `${c.primary}12`,
        logoBorder: (c) => c.border,
        logoFallbackIcon: (c) => c.primary,
    },
    hero: {
        text: () => '#FFFFFF',
        subtitle: () => 'rgba(255,255,255,0.78)',
        icon: () => '#FFFFFF',
        buttonBg: () => 'rgba(255,255,255,0.16)',
        buttonBorder: () => 'rgba(255,255,255,0.28)',
        badgeBorder: (c) => c.primaryDark || '#0052A3',
        logoBg: () => 'rgba(255,255,255,0.18)',
        logoBorder: () => 'rgba(255,255,255,0.32)',
        logoFallbackIcon: () => '#FFFFFF',
    },
};

const THEME_OPTIONS = [
    { key: 'light', label: 'Açık', icon: 'weather-sunny' },
    { key: 'dark', label: 'Koyu', icon: 'weather-night' },
    { key: 'system', label: 'Sistem', icon: 'theme-light-dark' },
];

const renderBackdrop = (props) => (
    <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.55}
        pressBehavior="close"
    />
);

export default function HomeHeader({
    unreadCount = 0,
    onNotificationsPress,
    variant = 'default',
    isAdmin = false
}) {
    const { colors, isDark, themeMode, setThemeMode, toggleTheme } = useTheme();
    const { config } = useConfig();
    const { logout } = useAuth();

    const themeSheetRef = useRef(null);
    const logoutSheetRef = useRef(null);

    const logoUri = resolveMediaUrl(config?.logo);
    const tokens = VARIANT_TOKENS[variant] || VARIANT_TOKENS.default;
    const t = {
        text: tokens.text(colors),
        subtitle: tokens.subtitle(colors),
        icon: tokens.icon(colors),
        buttonBg: tokens.buttonBg(colors),
        buttonBorder: tokens.buttonBorder(colors),
        badgeBorder: tokens.badgeBorder(colors),
        logoBg: tokens.logoBg(colors),
        logoBorder: tokens.logoBorder(colors),
        logoFallbackIcon: tokens.logoFallbackIcon(colors),
    };

    // Snap points — content'e göre otomatik ayarlanır, scroll/drag ile küçültülebilir
    const themeSnapPoints = useMemo(() => ['45%'], []);
    const logoutSnapPoints = useMemo(() => ['38%'], []);

    const openThemeSheet = useCallback(() => {
        themeSheetRef.current?.present();
    }, []);
    const openLogoutSheet = useCallback(() => {
        logoutSheetRef.current?.present();
    }, []);

    const confirmLogout = useCallback(async () => {
        logoutSheetRef.current?.dismiss();
        try {
            await logout?.();
        } catch (err) {
            Alert.alert('Hata', 'Çıkış yapılırken bir sorun oluştu.');
        }
    }, [logout]);

    return (
        <>
            <View style={styles.container}>
                {/* Sol: Logo + Marka */}
                <View style={styles.brandRow}>
                    <View
                        style={[
                            styles.logoFrame,
                            { backgroundColor: t.logoBg, borderColor: t.logoBorder },
                        ]}
                    >
                        {logoUri ? (
                            <Image
                                source={{ uri: logoUri }}
                                style={styles.logo}
                                resizeMode="contain"
                            />
                        ) : (
                            <MaterialCommunityIcons
                                name="domain"
                                size={22}
                                color={t.logoFallbackIcon}
                            />
                        )}
                    </View>

                    <View style={styles.brandText}>
                        <Text
                            style={[styles.companyName, { color: t.text }]}
                            numberOfLines={1}
                        >
                            {config?.name || 'Servis Yönetim Sistemi'}
                        </Text>
                        <Text
                            style={[styles.subtitle, { color: t.subtitle }]}
                            numberOfLines={1}
                        >
                            Servis Uygulaması
                        </Text>
                    </View>
                </View>

                {/* Sağ: Aksiyonlar */}
                <View style={styles.actions}>
                    <Pressable
                        onPress={openThemeSheet}
                        style={({ pressed }) => [
                            styles.iconButton,
                            {
                                backgroundColor: t.buttonBg,
                                borderColor: t.buttonBorder,
                                opacity: pressed ? 0.7 : 1,
                            },
                        ]}
                        accessibilityLabel="Tema seç"
                    >
                        <MaterialCommunityIcons
                            name={isDark ? 'weather-night' : 'weather-sunny'}
                            size={20}
                            color={t.icon}
                        />
                    </Pressable>

                    <Pressable
                        onPress={onNotificationsPress}
                        style={({ pressed }) => [
                            styles.iconButton,
                            {
                                backgroundColor: t.buttonBg,
                                borderColor: t.buttonBorder,
                                opacity: pressed ? 0.7 : 1,
                            },
                        ]}
                        accessibilityLabel="Bildirimler"
                    >
                        <MaterialCommunityIcons
                            name="bell-outline"
                            size={20}
                            color={t.icon}
                        />
                        {unreadCount > 0 ? (
                            <View
                                style={[
                                    styles.badge,
                                    {
                                        backgroundColor: colors.error,
                                        borderColor: t.badgeBorder,
                                    },
                                ]}
                            >
                                <Text style={styles.badgeText}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </Text>
                            </View>
                        ) : null}
                    </Pressable>

                    <Pressable
                        onPress={openLogoutSheet}
                        style={({ pressed }) => [
                            styles.iconButton,
                            {
                                backgroundColor: t.buttonBg,
                                borderColor: t.buttonBorder,
                                opacity: pressed ? 0.7 : 1,
                            },
                        ]}
                        accessibilityLabel="Çıkış yap"
                    >
                        <MaterialCommunityIcons
                            name="logout"
                            size={20}
                            color={t.icon}
                        />
                    </Pressable>
                </View>
            </View>

            {/* ─────────── Tema Seçim BottomSheet ─────────── */}
            <BottomSheetModal
                ref={themeSheetRef}
                index={0}
                snapPoints={themeSnapPoints}
                backdropComponent={renderBackdrop}
                handleComponent={null}
                backgroundStyle={{
                    backgroundColor: colors.surface,
                }}
                bottomInset={0}
                enableDynamicSizing={false}
            >
                <BottomSheetView style={styles.sheetContent}>
                    <View style={styles.handle} />
                    <View style={styles.sheetHeader}>
                        <View style={styles.sheetTitleRow}>
                            <MaterialCommunityIcons
                                name="palette-outline"
                                size={22}
                                color={colors.primary}
                            />
                            <Text style={[styles.sheetTitle, { color: colors.text }]}>
                                Tema Seçimi
                            </Text>
                        </View>
                        <Pressable
                            onPress={() => themeSheetRef.current?.dismiss()}
                            hitSlop={10}
                            style={({ pressed }) => [
                                styles.closeBtn,
                                {
                                    backgroundColor: isDark
                                        ? 'rgba(255,255,255,0.08)'
                                        : colors.backgroundSecondary,
                                    borderColor: colors.border,
                                    opacity: pressed ? 0.6 : 1,
                                },
                            ]}
                            accessibilityLabel="Kapat"
                        >
                            <MaterialCommunityIcons
                                name="close"
                                size={18}
                                color={colors.textSecondary}
                            />
                        </Pressable>
                    </View>

                    <View style={styles.themeList}>
                        {THEME_OPTIONS.map((option) => {
                            const selected = themeMode === option.key;
                            return (
                                <Pressable
                                    key={option.key}
                                    onPress={() => {
                                        setThemeMode(option.key);
                                        themeSheetRef.current?.dismiss();
                                    }}
                                    style={({ pressed }) => [
                                        styles.themeOption,
                                        {
                                            backgroundColor: selected
                                                ? `${colors.primary}14`
                                                : isDark
                                                    ? 'rgba(255,255,255,0.04)'
                                                    : colors.backgroundSecondary,
                                            borderColor: selected
                                                ? colors.primary
                                                : colors.border,
                                            opacity: pressed ? 0.85 : 1,
                                        },
                                    ]}
                                >
                                    <MaterialCommunityIcons
                                        name={option.icon}
                                        size={20}
                                        color={
                                            selected
                                                ? colors.primary
                                                : colors.textSecondary
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.themeOptionLabel,
                                            {
                                                color: selected
                                                    ? colors.primary
                                                    : colors.text,
                                            },
                                        ]}
                                    >
                                        {option.label}
                                    </Text>
                                    {selected ? (
                                        <MaterialCommunityIcons
                                            name="check-circle"
                                            size={20}
                                            color={colors.primary}
                                        />
                                    ) : (
                                        <View style={styles.themeOptionSpacer} />
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>


                </BottomSheetView>
            </BottomSheetModal>

            {/* ─────────── Çıkış Onay BottomSheet ─────────── */}
            <BottomSheetModal
                ref={logoutSheetRef}
                index={0}
                snapPoints={logoutSnapPoints}
                backdropComponent={renderBackdrop}
                handleComponent={null}
                backgroundStyle={{
                    backgroundColor: colors.surface,
                }}
                bottomInset={0}
                enableDynamicSizing={false}
            >
                <BottomSheetView style={styles.sheetContent}>
                    {/* Sağ üstte sabit kapat butonu */}
                    <Pressable
                        onPress={() => logoutSheetRef.current?.dismiss()}
                        hitSlop={10}
                        style={({ pressed }) => [
                            styles.closeBtnAbsolute,
                            {
                                backgroundColor: isDark
                                    ? 'rgba(255,255,255,0.08)'
                                    : colors.backgroundSecondary,
                                borderColor: colors.border,
                                opacity: pressed ? 0.6 : 1,
                            },
                        ]}
                        accessibilityLabel="Kapat"
                    >
                        <MaterialCommunityIcons
                            name="close"
                            size={18}
                            color={colors.textSecondary}
                        />
                    </Pressable>

                    <View style={styles.handle} />
                    <View
                        style={[
                            styles.iconWrap,
                            {
                                backgroundColor: `${colors.error}14`,
                                borderColor: `${colors.error}40`,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="logout-variant"
                            size={32}
                            color={colors.error}
                        />
                    </View>

                    <Text
                        style={[
                            styles.sheetTitle,
                            { color: colors.text, textAlign: 'center' },
                        ]}
                    >
                        Çıkış Yap
                    </Text>
                    <Text
                        style={[
                            styles.sheetSubtitle,
                            {
                                color: colors.textSecondary,
                                textAlign: 'center',
                            },
                        ]}
                    >
                        Oturumunuzu kapatmak istediğinize emin misiniz?
                    </Text>

                    <View style={styles.logoutActions}>
                        <Pressable
                            onPress={() => logoutSheetRef.current?.dismiss()}
                            style={({ pressed }) => [
                                styles.cancelBtn,
                                {
                                    backgroundColor: colors.backgroundSecondary,
                                    borderColor: colors.border,
                                    opacity: pressed ? 0.85 : 1,
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.cancelBtnText,
                                    { color: colors.text },
                                ]}
                            >
                                Vazgeç
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={confirmLogout}
                            style={({ pressed }) => [
                                styles.confirmBtn,
                                {
                                    backgroundColor: colors.error,
                                    opacity: pressed ? 0.9 : 1,
                                },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name="logout"
                                size={18}
                                color="#FFFFFF"
                            />
                            <Text style={styles.confirmBtnText}>Çıkış Yap</Text>
                        </Pressable>
                    </View>
                </BottomSheetView>
            </BottomSheetModal>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.gutter,

    },
    brandRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
        marginRight: spacing.m,
    },
    logoFrame: {
        width: 46,
        height: 46,
        borderRadius: 23,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    logo: {
        width: 34,
        height: 34,
        borderRadius: 17,
    },
    brandText: {
        flex: 1,
    },
    companyName: {
        ...typography.h3,
        fontSize: 16,
        letterSpacing: -0.2,
    },
    subtitle: {
        ...typography.caption,
        marginTop: 3,
        fontSize: 12,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
    },
    iconButton: {
        width: 42,
        height: 42,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        position: 'absolute',
        top: -5,
        right: -5,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },

    /* BottomSheet içerik */
    sheetContent: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.l,
        paddingBottom: spacing['3xl'],
    },
    handle: {
        width: 44,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(0,0,0,0.18)',
        alignSelf: 'center',
        marginBottom: spacing.l,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.l,
    },
    sheetTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnAbsolute: {
        position: 'absolute',
        top: spacing.l,
        right: spacing.xl,
        width: 34,
        height: 34,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    sheetTitle: {
        ...typography.h3,
        fontSize: 18,
    },
    sheetSubtitle: {
        ...typography.bodySmall,
        lineHeight: 20,
        marginBottom: spacing.xl,
    },
    iconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        alignSelf: 'center',
        marginBottom: spacing.l,
    },
    themeList: {
        gap: spacing.s,
    },
    themeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
        paddingHorizontal: spacing.l,
        paddingVertical: spacing.m + 2,
        borderRadius: 14,
        borderWidth: 1.5,
    },
    themeOptionLabel: {
        flex: 1,
        ...typography.body,
        fontWeight: '600',
    },
    themeOptionSpacer: {
        width: 20,
        height: 20,
    },
    quickToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.s,
        paddingVertical: spacing.m,
        marginTop: spacing.l,
        borderRadius: 12,
        borderWidth: 1,
    },
    quickToggleText: {
        fontSize: 13,
        fontWeight: '600',
    },
    logoutActions: {
        flexDirection: 'row',
        gap: spacing.s,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: spacing.m + 2,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        fontSize: 15,
        fontWeight: '700',
    },
    confirmBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: spacing.m + 2,
        borderRadius: 14,
    },
    confirmBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
});