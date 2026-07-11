import React, { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import WrapperContainer from '@/components/WrapperContainer';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';

// Support Contact BottomSheet
function SupportSheet({ sheetRef, onClose }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { config } = useConfig();

    const email = config?.email || 'teknoktay@gmail.com';
    const phone = config?.phone_number || '905426907712';

    const renderBackdrop = React.useCallback(
        (props) => (
            <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="close" />
        ),
        []
    );

    const handleEmail = () => {
        Linking.openURL(`mailto:${email}?subject=Hesap Durumu Hakkında`);
        onClose();
    };

    const handleWhatsApp = () => {
        Linking.openURL(`https://wa.me/${phone}`);
        onClose();
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
            backgroundStyle={{ backgroundColor: isDark ? colors.background : colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
        >
            <BottomSheetView style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: Math.max(insets.bottom, 24) }}>
                <View style={bs.header}>
                    <View>
                        <Text style={[bs.title, { color: colors.text }]}>Destek ile İletişim</Text>
                        <Text style={[bs.sub, { color: colors.textSecondary }]}>Aşağıdaki kanallardan bize ulaşabilirsiniz</Text>
                    </View>
                    <Pressable onPress={onClose} style={({ pressed }) => [bs.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F1F5F9' }, pressed && { opacity: 0.6 }]} hitSlop={12}>
                        <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                    </Pressable>
                </View>

                <Pressable onPress={handleEmail} style={({ pressed }) => [bs.option, pressed && { opacity: 0.7 }]}>
                    <View style={[bs.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
                        <MaterialCommunityIcons name="email-outline" size={22} color={colors.primary} />
                    </View>
                    <View style={bs.optionBody}>
                        <Text style={[bs.optionTitle, { color: colors.text }]}>E-posta Gönder</Text>
                        <Text style={[bs.optionSub, { color: colors.textTertiary }]}>{email}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.border} />
                </Pressable>

                <View style={[bs.divider, { backgroundColor: colors.border }]} />

                <Pressable onPress={handleWhatsApp} style={({ pressed }) => [bs.option, pressed && { opacity: 0.7 }]}>
                    <View style={[bs.iconWrap, { backgroundColor: '#16A34A15' }]}>
                        <MaterialCommunityIcons name="whatsapp" size={22} color="#16A34A" />
                    </View>
                    <View style={bs.optionBody}>
                        <Text style={[bs.optionTitle, { color: colors.text }]}>WhatsApp ile Yaz</Text>
                        <Text style={[bs.optionSub, { color: colors.textTertiary }]}>+{phone}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.border} />
                </Pressable>

                <View style={[bs.divider, { backgroundColor: colors.border }]} />

                <Pressable onPress={onClose} style={({ pressed }) => [bs.cancelBtn, { backgroundColor: `${colors.primary}10` }, pressed && { opacity: 0.7 }]}>
                    <Text style={[bs.cancelText, { color: colors.primary }]}>Vazgeç</Text>
                </Pressable>
            </BottomSheetView>
        </BottomSheet>
    );
}

const AccountDeactivatedScreen = () => {
    const { colors, isDark } = useTheme();
    const { logout, checkAuth, userInfo } = useAuth();
    const { config } = useConfig();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isContactOpen, setIsContactOpen] = useState(false);

    const appName = config?.name || 'Servis Yönetimi';
    const appTagline = 'Teknik Servis Yönetimi';
    const appLogo = config?.logo;

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await checkAuth();
        setIsRefreshing(false);
    };

    const isRejected = String(userInfo?.approval_status || '').toLowerCase() === 'rejected';

    const title = isRejected ? "Başvurunuz Onaylanmadı" : "Hesabınız Askıya Alındı";
    const description = isRejected
        ? "Yaptığınız hesap başvurusu yönetici tarafından uygun görülmemiş ve onaylanmamıştır."
        : "Hesabınız yönetici tarafından geçici veya kalıcı olarak pasifleştirilmiştir.";

    return (
        <WrapperContainer bg={colors.background} edges={['top', 'bottom']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header Logo & Brand */}
                <View style={styles.brandContainer}>
                    <View style={[styles.logoWrap, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
                        {appLogo ? (
                            <Image source={{ uri: appLogo }} style={styles.logo} />
                        ) : (
                            <MaterialCommunityIcons name="wrench" size={32} color="#FFF" />
                        )}
                    </View>
                    <Text style={[styles.brandName, { color: colors.text }]}>
                        {appName.split(' ')[0]}<Text style={{ color: colors.primary }}>{appName.substring(appName.indexOf(' ')).trim()}</Text>
                    </Text>
                    <Text style={[styles.tagline, { color: colors.textTertiary }]}>{appTagline}</Text>
                </View>

                {/* Illustration */}
                <View style={styles.illustrationWrap}>

                    <MaterialCommunityIcons name="account-cancel" size={64} color={colors.error} />
                </View>

                {/* Title & Message */}
                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.message, { color: colors.textSecondary }]}>
                    {description}
                </Text>

                {/* Actions */}
                <View style={styles.actions}>
                    {/* Primary Blue Button */}
                    <Pressable
                        onPress={handleRefresh}
                        disabled={isRefreshing}
                        style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }, pressed && { opacity: 0.85 }]}
                    >
                        {isRefreshing ? <ActivityIndicator color="#FFF" /> : <MaterialCommunityIcons name="refresh" size={20} color="#FFF" />}
                        <Text style={styles.primaryBtnText}>Durumu Yenile</Text>
                    </Pressable>

                    {/* Secondary Contact Button */}
                    <Pressable
                        onPress={() => setIsContactOpen(true)}
                        style={({ pressed }) => [
                            styles.secondaryBtn,
                            { backgroundColor: isDark ? 'transparent' : colors.background, borderColor: colors.primary },
                            pressed && { opacity: 0.75 }
                        ]}
                    >
                        <MaterialCommunityIcons name="headset" size={20} color={colors.primary} />
                        <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Destek ile İletişim</Text>
                    </Pressable>

                    {/* Logout Red Button */}
                    <Pressable
                        onPress={logout}
                        style={({ pressed }) => [
                            styles.logoutBtn,
                            { borderColor: colors.error },
                            pressed && { opacity: 0.6 }
                        ]}
                    >
                        <MaterialCommunityIcons name="logout" size={20} color={colors.error} />
                        <Text style={[styles.logoutText, { color: colors.error }]}>Çıkış Yap</Text>
                    </Pressable>
                </View>
            </ScrollView>

            {isContactOpen && (
                <SupportSheet onClose={() => setIsContactOpen(false)} />
            )}
        </WrapperContainer>
    );
};

export default AccountDeactivatedScreen;

const styles = StyleSheet.create({
    scrollContent: {
        flexGrow: 1,
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 32,
    },
    brandContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoWrap: {
        width: 60,
        height: 60,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    brandName: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 4,
    },
    tagline: {
        fontSize: 13,
        fontWeight: '500',
    },
    illustrationWrap: {
        width: '100%',
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    illustration: {
        width: 240,
        height: 220,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 28,
        paddingHorizontal: 10,
    },
    actions: {
        width: '100%',
        gap: 12,
        marginBottom: 24,
    },
    primaryBtn: {
        flexDirection: 'row',
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
        gap: 8,
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryBtn: {
        flexDirection: 'row',
        height: 54,
        borderRadius: 16,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    secondaryBtnText: {
        fontSize: 16,
        fontWeight: '700',
    },
    logoutBtn: {
        flexDirection: 'row',
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
    },
    logo: {
        width: 50,
        height: 50,
        borderRadius: 10,
        resizeMode: 'cover',
    },
    logoutText: {
        fontSize: 15,
        fontWeight: '700',
    },
});

const bs = StyleSheet.create({
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
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    sub: {
        fontSize: 13,
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
    },
    optionSub: {
        fontSize: 12,
        marginTop: 2,
        fontWeight: '500',
    },
    divider: {
        height: 1,
    },
    cancelBtn: {
        marginTop: 16,
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelText: {
        fontSize: 15,
        fontWeight: '700',
    },
});