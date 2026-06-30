import React, { useMemo } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';

const ALL_EDGES = ['top', 'left', 'right'];
const NO_BOTTOM_EDGES = ['top', 'left', 'right'];

/**
 * WrapperContainer
 *
 * Tüm ekranlar için merkezi sarmalayıcı. Safe area, status bar, scroll,
 * klavye kaçınma, arka plan ve refresh control gibi ortak endişeleri tek
 * noktada toplar; her ekranda useSafeAreaInsets / SafeAreaView / KAV /
 * StatusBar tekrarını ortadan kaldırır.
 *
 * Notlar:
 *  - Tab bar'lı ekranlarda `bottomOffset` kullanarak içeriğin tab bar'ın
 *    altına kaymasını önleyin (örn. 90 + insets.bottom).
 *  - Gradient arka plan için içeride LinearGradient kullanabilir veya
 *    `bg="transparent"` verip dıştan sarmalayabilirsiniz.
 *
 * @param {string} [bg]                Arka plan rengi. Varsayılan: theme.background
 * @param {string[]} [edges]           Safe area kenarları. Varsayılan: tümü.
 *                                     Tab bar'lı ekranlarda ['top','left','right'] önerilir.
 * @param {boolean} [padded]           Yatayda spacing.gutter padding uygular
 * @param {boolean} [scroll]           İçeriği ScrollView ile sarar
 * @param {boolean} [keyboardAvoiding] KeyboardAvoidingView ile sarar
 * @param {boolean} [withTabBar]       Tab bar'lı ekran kısayolu:
 *                                     `edges` bottom çıkarılır, `bottomOffset` 90 eklenir
 * @param {ReactElement|Function} [refreshControl] ScrollView için RefreshControl.
 *                                          Fonksiyon olarak verilirse insets parametresi alır
 *                                          (örn. progressViewOffset için) — böylece ekran
 *                                          useSafeAreaInsets çağırmak zorunda kalmaz.
 * @param {number} [topOffset]         Safe area üstüne ek üst padding (içeride)
 * @param {number} [bottomOffset]      Safe area altına ek alt padding (içeride)
 * @param {string} [statusBarStyle]    'light-content' | 'dark-content' | 'default'
 * @param {object} [contentContainerStyle] ScrollView contentContainerStyle override
 * @param {object} [style]             İç View/ScrollView stili
 * @param {object} [scrollProps]       ScrollView'a geçilecek ek props
 */
const WrapperContainer = ({
    children,
    bg,
    edges,
    padded = false,
    scroll = false,
    keyboardAvoiding = false,
    withTabBar = false,
    refreshControl,
    topOffset = 0,
    bottomOffset = 0,
    statusBarStyle,
    contentContainerStyle,
    style,
    scrollProps,
}) => {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const backgroundColor = bg || colors.background;

    const resolvedEdges = withTabBar
        ? NO_BOTTOM_EDGES
        : edges || ALL_EDGES;

    // Tab bar akış içinde (flow layout) → kendi yüksekliğini zaten kaplıyor.
    // Bu yüzden sadece alt safe-area (klavye/gesture bar) kadar ek padding bırakıyoruz,
    // TAB_BAR_HEIGHT ekleyerek ÇİFT SAYIM yapmıyoruz.
    const TAB_BAR_HEIGHT = 0;
    const finalBottomOffset = withTabBar
        ? bottomOffset + TAB_BAR_HEIGHT + Math.max(insets.bottom, 8)
        : bottomOffset;

    const barStyle = statusBarStyle || (isDark ? 'light-content' : 'dark-content');

    const innerPadded = padded ? { paddingHorizontal: spacing.gutter } : null;

    const resolvedRefreshControl = useMemo(() => {
        if (typeof refreshControl === 'function') {
            return refreshControl(insets);
        }
        return refreshControl;
    }, [refreshControl, insets]);

    const renderScrollContent = () => (
        <ScrollView
            style={[styles.fill, style]}
            contentContainerStyle={[
                { paddingTop: topOffset, paddingBottom: finalBottomOffset },
                innerPadded,
                contentContainerStyle,
            ]}
            refreshControl={resolvedRefreshControl}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            {...scrollProps}
        >
            {children}
        </ScrollView>
    );

    const renderStaticContent = () => (
        <View
            style={[
                styles.fill,
                { paddingTop: topOffset, paddingBottom: finalBottomOffset },
                innerPadded,
                style,
            ]}
        >
            {children}
        </View>
    );

    const inner = scroll ? renderScrollContent() : renderStaticContent();

    const body = keyboardAvoiding ? (
        <KeyboardAvoidingView
            style={styles.fill}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {inner}
        </KeyboardAvoidingView>
    ) : (
        inner
    );

    return (
        <View style={[styles.root, { backgroundColor }]}>
            <StatusBar barStyle={barStyle} backgroundColor={backgroundColor} />
            <SafeAreaView
                edges={resolvedEdges}
                style={[styles.fill, { backgroundColor }]}
            >
                {body}
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1 },
    fill: { flex: 1 },
});

export default WrapperContainer;