import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    BackHandler,
    Image,
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

// ─── Sabit iletişim bilgileri ───────────────────────────────────────────────
const SUPPORT_EMAIL = 'teknoktay@gmail.com';
const SUPPORT_WHATSAPP = '905426907712';

// ─── Yardımcılar ────────────────────────────────────────────────────────────
const getErrorCode = (error) => {
    const rawCode = error?.code || error?.errorCode || error?.name;
    if (rawCode && String(rawCode).trim()) {
        return String(rawCode)
            .replace(/[^A-Z0-9]+/gi, '_')
            .replace(/^_+|_+$/g, '')
            .toUpperCase();
    }
    const rawMessage = error?.message || 'UNKNOWN';
    const compact = String(rawMessage)
        .replace(/[^A-Z0-9]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase()
        .slice(0, 24);
    return compact || 'UNKNOWN';
};

// ─── İletişim BottomSheet (sadece açıkken mount edilir) ──────────────────────────
function ContactBottomSheet({ errorCode, onClose }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const sheetRef = useCallback((node) => {
        // Sheet mount olunca hemen aç
        if (node) node.expand();
    }, []);

    const renderBackdrop = useCallback(
        (props) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                opacity={0.5}
                pressBehavior="close"
            />
        ),
        []
    );

    const openEmail = async () => {
        onClose();
        const subject = encodeURIComponent(`Uygulama Hatası: ${errorCode}`);
        const body = encodeURIComponent(
            `Merhaba,\n\nUygulamada bir hata oluştu.\nHata Kodu: ${errorCode}\n\nLütfen yardımcı olur musunuz?\n\nTeşekkürler.`
        );
        const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
        const supported = await Linking.canOpenURL(url);
        if (supported) { await Linking.openURL(url); }
        else { Alert.alert('Hata', 'E-posta uygulaması bulunamadı.'); }
    };

    const openWhatsApp = async () => {
        onClose();
        const message = encodeURIComponent(
            `Merhaba, uygulamada bir hata oluştu.\nHata Kodu: ${errorCode}\nYardım alabilir miyim?`
        );
        const url = `https://wa.me/${SUPPORT_WHATSAPP}?text=${message}`;
        const supported = await Linking.canOpenURL(url);
        if (supported) { await Linking.openURL(url); }
        else { Alert.alert('Hata', 'WhatsApp uygulaması bulunamadı.'); }
    };

    return (
        <BottomSheet
            ref={sheetRef}
            index={0}
            snapPoints={['50%']}
            enablePanDownToClose
            onClose={onClose}
            backdropComponent={renderBackdrop}
            handleComponent={null}
            backgroundStyle={[bs.background, { backgroundColor: isDark ? colors.background : colors.surface }]}
        >
            <BottomSheetView style={[bs.content, { paddingBottom: Math.max(insets.bottom, 24) }]}>
                {/* Başlık satırı */}
                <View style={bs.header}>
                    <View>
                        <Text style={[bs.title, { color: colors.text }]}>Destek ile İletişim</Text>
                        <Text style={[bs.sub, { color: colors.textSecondary }]}>Aşağıdaki kanallardan bize ulaşabilirsiniz</Text>
                    </View>
                    <Pressable
                        onPress={onClose}
                        style={({ pressed }) => [bs.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F1F5F9' }, pressed && { opacity: 0.6 }]}
                        hitSlop={12}
                    >
                        <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                    </Pressable>
                </View>

                {/* E-posta */}
                <Pressable onPress={openEmail} style={({ pressed }) => [bs.option, pressed && { opacity: 0.7 }]}>
                    <View style={[bs.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
                        <MaterialCommunityIcons name="email-outline" size={22} color={colors.primary} />
                    </View>
                    <View style={bs.optionBody}>
                        <Text style={[bs.optionTitle, { color: colors.text }]}>E-posta Gönder</Text>
                        <Text style={[bs.optionSub, { color: colors.textTertiary }]}>{SUPPORT_EMAIL}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.border} />
                </Pressable>

                <View style={[bs.divider, { backgroundColor: colors.border }]} />

                {/* WhatsApp */}
                <Pressable onPress={openWhatsApp} style={({ pressed }) => [bs.option, pressed && { opacity: 0.7 }]}>
                    <View style={[bs.iconWrap, { backgroundColor: '#16A34A15' }]}>
                        <MaterialCommunityIcons name="whatsapp" size={22} color="#16A34A" />
                    </View>
                    <View style={bs.optionBody}>
                        <Text style={[bs.optionTitle, { color: colors.text }]}>WhatsApp ile Yaz</Text>
                        <Text style={[bs.optionSub, { color: colors.textTertiary }]}>+90 542 690 77 12</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.border} />
                </Pressable>

                <View style={[bs.divider, { backgroundColor: colors.border }]} />

                {/* Vazgeç */}
                <Pressable
                    onPress={onClose}
                    style={({ pressed }) => [bs.cancelBtn, { backgroundColor: `${colors.primary}10` }, pressed && { opacity: 0.7 }]}
                >
                    <Text style={[bs.cancelText, { color: colors.primary }]}>Vazgeç</Text>
                </Pressable>
            </BottomSheetView>
        </BottomSheet>
    );
}

// ─── Hata Ekranı Bileşeni ────────────────────────────────────────────────────
function ErrorFallback({ error, onRetry, contactSheetRef }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const errorCode = `ERR-${getErrorCode(error)}`;
    const [isContactOpen, setIsContactOpen] = useState(false);

    // Geri tuşu: sheet açıksa kapat, kapalıysa geçir
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (isContactOpen) {
                setIsContactOpen(false);
                return true; // event yutuldu
            }
            return false; // navigasyon'a geçir
        });
        return () => sub.remove();
    }, [isContactOpen]);

    return (
        <View
            style={[
                styles.screen,
                {
                    paddingTop: Math.max(insets.top, 40),
                    paddingBottom: Math.max(insets.bottom, 32),
                    backgroundColor: colors.background,
                },
            ]}
        >
            {/* Illustration */}
            <View style={styles.illustrationContainer}>
                <Image
                    source={require('../../assets/error_illustration.png')}
                    style={styles.illustration}
                    resizeMode="contain"
                />
            </View>

            {/* Metinler */}
            <Text style={[styles.title, { color: colors.text }]}>Bir şeyler ters gitti</Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
                Beklenmeyen bir hata oluştu. Lütfen tekrar{'\n'}deneyin veya daha sonra yeniden kontrol edin.
            </Text>

            {/* Hata Kodu */}
            <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.surface, shadowColor: colors.primary }]}>
                <View style={[styles.errorIconWrap, { backgroundColor: `${colors.error}15` }]}>
                    <MaterialCommunityIcons name="alert-outline" size={18} color={colors.error} />
                </View>
                <Text style={[styles.errorBoxText, { color: colors.text }]}>
                    Hata kodu:{' '}
                    <Text style={[styles.errorHighlight, { color: colors.error }]}>{errorCode}</Text>
                </Text>
            </View>

            {/* Butonlar */}
            <View style={styles.actions}>
                <Pressable
                    onPress={onRetry}
                    style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }, pressed && { opacity: 0.85 }]}
                >
                    <Text style={styles.primaryBtnText}>Tekrar Dene</Text>
                </Pressable>

                <Pressable
                    onPress={() => setIsContactOpen(true)}
                    style={({ pressed }) => [
                        styles.secondaryBtn,
                        { backgroundColor: isDark ? 'transparent' : colors.surface, borderColor: colors.border },
                        pressed && { opacity: 0.75 }
                    ]}
                >
                    <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Destek ile İletişim</Text>
                </Pressable>

                <Pressable
                    onPress={onRetry}
                    style={({ pressed }) => [
                        styles.logoutBtn,
                        { backgroundColor: `${colors.error}10`, borderColor: `${colors.error}40` },
                        pressed && { opacity: 0.75 }
                    ]}
                >
                    <MaterialCommunityIcons name="logout" size={16} color={colors.error} />
                    <Text style={[styles.logoutBtnText, { color: colors.error }]}>Çıkış Yap</Text>
                </Pressable>
            </View>

            {/* Sheet yalnızca açıkken mount edilir → ilk açılışta peek olmaz */}
            {isContactOpen && (
                <ContactBottomSheet
                    errorCode={errorCode}
                    onClose={() => setIsContactOpen(false)}
                />
            )}
        </View>
    );
}

// ─── Class Component Wrapper ─────────────────────────────────────────────────
class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.log('AppErrorBoundary caught:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <ErrorFallback
                    error={this.state.error}
                    onRetry={this.handleReset}
                    contactSheetRef={this.contactSheetRef}
                />
            );
        }
        return this.props.children;
    }
}

// ─── Ana Stiller ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#F4F7FF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    illustrationContainer: {
        width: 240,
        height: 220,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
    },
    illustration: {
        width: 240,
        height: 220,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0A1931',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -0.4,
    },
    message: {
        fontSize: 15,
        lineHeight: 23,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 24,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 18,
        width: '100%',
        marginBottom: 32,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
    },
    errorIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: '#FEF2F2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorBoxText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    errorHighlight: {
        color: '#EF4444',
        fontWeight: '800',
    },
    actions: {
        width: '100%',
        gap: 12,
    },
    primaryBtn: {
        height: 54,
        borderRadius: 16,
        backgroundColor: '#2563EB',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    secondaryBtn: {
        height: 54,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryBtnText: {
        color: '#2563EB',
        fontSize: 16,
        fontWeight: '700',
    },
    logoutBtn: {
        height: 50,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#FECACA',
        backgroundColor: '#FFF5F5',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    logoutBtnText: {
        color: '#EF4444',
        fontSize: 15,
        fontWeight: '700',
    },
});

// ─── BottomSheet Stilleri ─────────────────────────────────────────────────────
const bs = StyleSheet.create({
    background: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 20,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#E2E8F0',
        borderRadius: 2,
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0A1931',
        marginBottom: 4,
    },
    sub: {
        fontSize: 13,
        color: '#94A3B8',
        marginBottom: 20,
        fontWeight: '500',
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
    },
    iconWrap: {
        width: 46,
        height: 46,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionBody: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
    },
    optionSub: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 2,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
    },
    cancelBtn: {
        marginTop: 16,
        height: 52,
        borderRadius: 14,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#2563EB',
    },
});

export default AppErrorBoundary;
