import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

// Header, içinde bulunduğu navigator türünü tespit eder.
// Tab navigator içindeyken `showBack` bilinçli olarak yok sayılır —
// aksi halde navigation.goBack() üst Stack'e atlıyor ve tab bar state'i bozuluyor.
function useIsInsideTabNavigator() {
    const navigation = useNavigation();
    let current = navigation;
    // Yukarı doğru yürü: stack/tab/drawer atalarını gez
    while (current?.getParent?.()) {
        const parent = current.getParent();
        const parentType = parent?.getState?.()?.type;
        if (parentType === 'tab') return true;
        current = parent;
    }
    return false;
}

const VARIANT_TOKENS = {
    default: {
        text: (c) => c.text,
        subtitle: (c) => c.textSecondary,
        icon: (c) => c.textSecondary,
        buttonBg: (c) => c.surfaceMuted,
        buttonBorder: (c) => c.border,
        divider: (c) => c.border,
        badgeBorder: (c) => c.card,
    },
    hero: {
        text: () => '#FFFFFF',
        subtitle: () => 'rgba(255,255,255,0.78)',
        icon: () => '#FFFFFF',
        buttonBg: () => 'rgba(255,255,255,0.16)',
        buttonBorder: () => 'rgba(255,255,255,0.22)',
        divider: () => 'rgba(255,255,255,0.18)',
        badgeBorder: (c) => c.primaryDark || '#0052A3',
    },
    transparent: {
        text: (c) => c.text,
        subtitle: (c) => c.textSecondary,
        icon: (c) => c.textSecondary,
        buttonBg: (c) => c.surfaceMuted,
        buttonBorder: (c) => c.border,
        divider: (c) => c.border,
        badgeBorder: (c) => c.card,
    },
};

/**
 * Header
 *
 * Uygulamanın tüm ekranlarında ortak üst bar. Üç bölümden oluşur:
 *   [Left (back/logo)]   [Center (title/subtitle)]   [Right (actions)]
 *
 * Kullanım örnekleri:
 *
 *   // Basit: geri butonu + başlık
 *   <Header title="Bildirimler" showBack centered borderBottom />
 *
 *   // Logo + marka + sağ aksiyonlar (ana sayfa hero)
 *   <Header
 *     variant="hero"
 *     left={<LogoWithBrand />}
 *     rightActions={[
 *       { icon: 'weather-night', onPress: toggleTheme, accessibilityLabel: 'Tema' },
 *       { icon: 'bell-outline', onPress: onNotifications, badge: unreadCount },
 *       { icon: 'logout', onPress: logout },
 *     ]}
 *   />
 *
 *   // Özel sağ içerik
 *   <Header title="Profil" showBack right={<SaveButton />} />
 *
 * @param {'default'|'hero'|'transparent'} [variant] Renk şeması
 * @param {string} [title] Başlık metni
 * @param {string} [subtitle] Alt başlık
 * @param {boolean} [showBack] Geri butonu göster (default: navigation.goBack)
 * @param {Function} [onBackPress] Özel geri aksiyonu
 * @param {'default'|'minimal'} [backVariant] Geri butonu görünümü:
 *   'default' → yuvarlak border + arka plan (mevcut)
 *   'minimal' → sadece ikon, border/arkaplan yok
 * @param {ReactNode} [left] Özel sol içerik (varsa showBack geçersiz kalır)
 * @param {ReactNode} [right] Özel sağ içerik
 * @param {Array}  [rightActions] Hızlı sağ aksiyon listesi:
 *   { icon, onPress, badge?, size?, accessibilityLabel?, color?, variant? }
 * @param {boolean} [centered] Başlığı ortala
 * @param {boolean} [borderBottom] Alt çizgi
 * @param {boolean} [padded] Yatay gutter padding (default true)
 * @param {boolean} [compact] Küçük padding (44px yerine 48px)
 */
const Header = ({
    variant = 'default',
    title,
    subtitle,
    showBack = false,
    onBackPress,
    backVariant = 'default',
    left,
    right,
    rightActions,
    centered = false,
    borderBottom = false,
    padded = true,
    compact = false,
    style,
}) => {
    const navigation = useNavigation();
    const isInsideTab = useIsInsideTabNavigator();
    const { colors } = useTheme();
    const tokens = VARIANT_TOKENS[variant] || VARIANT_TOKENS.default;
    const t = {
        text: tokens.text(colors),
        subtitle: tokens.subtitle(colors),
        icon: tokens.icon(colors),
        buttonBg: tokens.buttonBg(colors),
        buttonBorder: tokens.buttonBorder(colors),
        divider: tokens.divider(colors),
        badgeBorder: tokens.badgeBorder(colors),
    };

    const handleBack = () => {
        if (onBackPress) return onBackPress();
        if (navigation?.canGoBack?.()) return navigation.goBack();
    };

    const renderBackButton = () => {
        const isMinimal = backVariant === 'minimal';
        return (
            <Pressable
                onPress={handleBack}
                style={({ pressed }) => [
                    isMinimal ? styles.iconButtonMinimal : styles.iconButton,
                    {
                        backgroundColor: isMinimal ? 'transparent' : t.buttonBg,
                        borderColor: isMinimal ? 'transparent' : t.buttonBorder,
                        opacity: pressed ? 0.6 : 1,
                    },
                ]}
                accessibilityLabel="Geri"
                hitSlop={12}
            >
                <MaterialCommunityIcons name="arrow-left" size={24} color={t.icon} />
            </Pressable>
        );
    };

    const renderAction = (action, idx) => (
        <Pressable
            key={`${action.icon}-${idx}`}
            onPress={action.onPress}
            style={({ pressed }) => [
                styles.iconButton,
                {
                    backgroundColor: action.backgroundColor || t.buttonBg,
                    borderColor: action.borderColor || t.buttonBorder,
                    opacity: pressed ? 0.7 : 1,
                    width: action.size === 'small' ? 36 : 42,
                    height: action.size === 'small' ? 36 : 42,
                },
            ]}
            accessibilityLabel={action.accessibilityLabel || action.icon}
            hitSlop={6}
        >
            <MaterialCommunityIcons
                name={action.icon}
                size={action.iconSize || 19}
                color={action.color || t.icon}
            />
            {action.badge && action.badge > 0 ? (
                <View style={[styles.badge, { backgroundColor: action.badgeColor || colors.error, borderColor: t.badgeBorder }]}>
                    <Text style={styles.badgeText}>
                        {action.badge > 99 ? '99+' : action.badge}
                    </Text>
                </View>
            ) : null}
        </Pressable>
    );

    const renderLeft = () => {
        if (left) return left;
        // Tab navigator içindeyken showBack daha önceden engelleniyordu,
        // ancak Tab içindeki bir Stack'in alt sayfalarında (örn. AdminUsersScreen)
        // geri butonuna kesinlikle ihtiyaç vardır.
        if (showBack) return renderBackButton();
        return null;
    };

    const renderRight = () => {
        if (rightActions && rightActions.length > 0) {
            return (
                <View style={styles.actions}>
                    {rightActions.map(renderAction)}
                </View>
            );
        }
        if (right) return <View style={styles.actions}>{right}</View>;
        return <View style={styles.actionsPlaceholder} />;
    };

    const renderCenter = () => {
        if (!title && !subtitle) {
            // No title: leave center empty so left/right align naturally
            return <View style={styles.centerEmpty} />;
        }
        return (
            <View style={[styles.center, centered && styles.centered]}>
                {title ? (
                    <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
                        {title}
                    </Text>
                ) : null}
                {subtitle ? (
                    <Text style={[styles.subtitle, { color: t.subtitle }]} numberOfLines={1}>
                        {subtitle}
                    </Text>
                ) : null}
            </View>
        );
    };

    return (
        <View
            style={[
                styles.container,
                compact ? styles.containerCompact : null,
                {
                    paddingHorizontal: padded ? spacing.gutter : 0,
                    borderBottomWidth: borderBottom ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: t.divider,
                },
                style,
            ]}
        >
            <View style={styles.left}>{renderLeft()}</View>
            {renderCenter()}
            <View style={styles.right}>{renderRight()}</View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.s,
        minHeight: 56,
    },
    containerCompact: {
        paddingVertical: spacing.xs,
        minHeight: 48,
    },
    left: {
        flexShrink: 0,
    },
    center: {
        flex: 1,
        marginHorizontal: spacing.s,
        justifyContent: 'center',
    },
    centerEmpty: {
        flex: 1,
    },
    centered: {
        alignItems: 'center',
    },
    title: {
        ...typography.h3,
        fontSize: 17,
    },
    subtitle: {
        ...typography.caption,
        marginTop: 2,
        fontSize: 12,
    },
    right: {
        flexShrink: 0,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
    },
    actionsPlaceholder: {
        width: 40,
    },
    iconButton: {
        width: 42,
        height: 42,
        borderRadius: 13,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconButtonMinimal: {
        width: 40,
        height: 40,
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
});

export default Header;