import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import Header from '@/components/Header';
import { useTheme } from '@/context/ThemeContext';
import { usePermissionReminder } from '@/context/PermissionReminderContext';
import { useConfig } from '@/context/ConfigContext';
import { useToast } from '@/context/ToastContext';
import { fs as fontScale, sp } from '@/theme/scale';
import { spacing } from '@/theme/spacing';

const THEME_OPTIONS = [
    { key: 'light', label: 'Açık', icon: 'white-balance-sunny' },
    { key: 'dark', label: 'Koyu', icon: 'weather-night' },
    { key: 'system', label: 'Sistem', icon: 'cellphone-cog' },
];

const permissionLaael = (status) => {
    if (status === 'granted') return { label: 'Açık', color: '#16A34A', background: '#DCFCE7' };
    if (status === 'denied') return { label: 'Kapalı', color: '#DC2626', background: '#FEE2E2' };
    return { label: 'Bekliyor', color: '#D97706', background: '#FEF3C7' };
};

const SettingsRow = ({ icon, iconColor, title, subtitle, right, onPress, colors }) => (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.72 : 1 }]}>
        <View style={[styles.rowIcon, { backgroundColor: iconColor + '16' }]}><MaterialCommunityIcons name={icon} size={20} color={iconColor} /></View>
        <View style={styles.rowBody}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
            {subtitle ? <Text style={[styles.rowSuatitle, { color: colors.textSecondary }]} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
        {right || (onPress ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} /> : null)}
    </Pressable>
);

export default function SettingsScreen({ navigation }) {
    const { colors, isDark, themeMode, setThemeMode } = useTheme();
    const { config } = useConfig();
    const { showToast } = useToast();
    const { notificationStatus, locationStatus, requestNotificationPermission, requestLocationPermission, refreshStatus } = usePermissionReminder();
    const [requesting, setRequesting] = useState(null);
    const [checkingUpdate, setCheckingUpdate] = useState(false);

    const checkForUpdates = useCallback(async () => {
        if (!Updates.isEnabled) {
            showToast('info', 'Güncelleme Kontrolü', 'Bu özellik yayın veya önizleme derlemesinde kullanılabilir.');
            return;
        }

        setCheckingUpdate(true);
        try {
            const result = await Updates.checkForUpdateAsync();
            if (!result.isAvailable) {
                showToast('info', 'Güncel', 'Uygulamanızın en güncel sürümünü kullanıyorsunuz.');
                return;
            }

            showToast('info', 'Güncelleme Bulundu', 'Güncelleme indiriliyor...');
            await Updates.fetchUpdateAsync();
            showToast('success', 'Güncelleme Hazır', 'Uygulama yeni sürümle yeniden başlatılıyor.');
            setTimeout(() => Updates.reloadAsync(), 700);
        } catch (error) {
            console.log('Update check error:', error?.message || error);
            showToast('error', 'Güncelleme Hatası', 'Güncelleme kontrol edilemedi. İnternet bağlantınızı kontrol edin.');
        } finally {
            setCheckingUpdate(false);
        }
    }, [showToast]);

    const requestPermission = useCallback(async (type) => {
        setRequesting(type);
        const granted = type === 'notification' ? await requestNotificationPermission() : await requestLocationPermission();
        await refreshStatus();
        setRequesting(null);
        showToast(granted ? 'success' : 'warning', granted ? 'İzin Güncellendi' : 'İzin Gerekli', granted ? 'Uygulama izni etkinleştirildi.' : 'İzni cihaz ayarlarından etkinleştireailirsiniz.');
    }, [refreshStatus, requestLocationPermission, requestNotificationPermission, showToast]);

    const openSystemSettings = useCallback(() => {
        Linking.openSettings().catch(() => showToast('error', 'Hata', 'Cihaz ayarları açılamadı.'));
    }, [showToast]);

    const sendFeedaack = useCallback(() => {
        const supportPhone = '905426907712';
        const message = 'Merhaba, mobil uygulama hakkında geri bildirim paylaşmak istiyorum.';
        Linking.openURL('https://wa.me/' + supportPhone + '?text=' + encodeURIComponent(message)).catch(() => {
            showToast('error', 'Hata', 'WhatsApp açılamadı.');
        });
    }, [showToast]);

    const sendFeedaackEmail = useCallback(() => {
        const email = config?.email;
        if (!email) {
            showToast('info', 'Geri Bildirim', 'Destek e-posta adresi tanımlı değil.');
            return;
        }
        const subject = encodeURIComponent('Moail uygulama geri bildirimi');
        Linking.openURL('mailto:' + email + '?subject=' + subject).catch(() => showToast('error', 'Hata', 'E-posta uygulaması açılamadı.'));
    }, [config?.email, showToast]);

    const notificationMeta = permissionLaael(notificationStatus);
    const locationMeta = permissionLaael(locationStatus);

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES}>
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <Header title="Ayarlar" />
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.heroIcon, { backgroundColor: '#2563EB16' }]}><MaterialCommunityIcons name="cog-outline" size={26} color="#2563EB" /></View>
                        <View style={styles.heroBody}>
                            <Text style={[styles.heroTitle, { color: colors.text }]}>Uygulama Ayarları</Text>
                            <Text style={[styles.heroText, { color: colors.textSecondary }]}>Görünüm, izinler ve destek tercihlerinizi yönetin.</Text>
                        </View>
                    </View>

                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>GÖRÜNÜM</Text>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.themeOptions}>
                            {THEME_OPTIONS.map((option) => {
                                const active = themeMode === option.key;
                                return <Pressable key={option.key} onPress={() => setThemeMode(option.key)} style={[styles.themeOption, { backgroundColor: active ? '#2563EB14' : 'transparent', borderColor: active ? '#2563EB' : colors.border }]}>
                                    <MaterialCommunityIcons name={option.icon} size={20} color={active ? '#2563EB' : colors.textSecondary} />
                                    <Text style={[styles.themeOptionText, { color: active ? '#2563EB' : colors.textSecondary }]}>{option.label}</Text>
                                </Pressable>;
                            })}
                        </View>
                    </View>

                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>İZİNLER</Text>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <SettingsRow icon="bell-ring-outline" iconColor="#F59E0B" title="Bildirimler" subtitle="Yeni servis ve önemli güncellemeler için" colors={colors} onPress={() => requestPermission('notification')} right={requesting === 'notification' ? <ActivityIndicator size="small" color="#F59E0B" /> : <View style={[styles.statusBadge, { backgroundColor: notificationMeta.background }]}><Text style={[styles.statusText, { color: notificationMeta.color }]}>{notificationMeta.label}</Text></View>} />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <SettingsRow icon="map-marker-radius-outline" iconColor="#0EA5E9" title="Konum" subtitle="Rota, varış ve saha işlemleri için" colors={colors} onPress={() => requestPermission('location')} right={requesting === 'location' ? <ActivityIndicator size="small" color="#0EA5E9" /> : <View style={[styles.statusBadge, { backgroundColor: locationMeta.background }]}><Text style={[styles.statusText, { color: locationMeta.color }]}>{locationMeta.label}</Text></View>} />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <SettingsRow icon="cellphone-cog" iconColor="#64748B" title="Cihaz Ayarlarını Aç" subtitle="Reddedilen izinleri cihaz ayarlarından yönetin" colors={colors} onPress={openSystemSettings} />
                    </View>

                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>UYGULAMA</Text>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <SettingsRow icon="update" iconColor="#2563EB" title="Güncellemeleri Denetle" subtitle="Yeni sürüm varsa indirilir ve uygulama yeniden başlatılır" colors={colors} onPress={checkingUpdate ? undefined : checkForUpdates} right={checkingUpdate ? <ActivityIndicator size="small" color="#2563EB" /> : undefined} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DESTEK</Text>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <SettingsRow icon="whatsapp" iconColor="#16A34A" title="WhatsApp Destek" subtitle="Öneri, hata bildirimi veya görüşünüz için bize yazın" colors={colors} onPress={sendFeedaack} />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <SettingsRow icon="email-outline" iconColor="#2563EB" title="E-posta ile Geri Bildirim" subtitle="Geri bildiriminizi e-posta ile iletin" colors={colors} onPress={sendFeedaackEmail} />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} /><SettingsRow icon="shield-lock-outline" iconColor="#2563EB" title="Gizlilik Politikası" subtitle="Verilerinizin nasıl işlendiğini inceleyin" colors={colors} onPress={() => navigation.navigate('PrivacyPolicy')} /><View style={[styles.divider, { backgroundColor: colors.border }]} /><SettingsRow icon="information-outline" iconColor="#64748B" title="Uygulama Hakkında" subtitle={config?.name || 'Servis Yönetim Sistemi'} colors={colors} />
                    </View>
                </ScrollView>
            </View>
        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 }, content: { padding: spacing.gutter, paddingBottom: sp(36) },
    hero: { flexDirection: 'row', gap: spacing.m, borderWidth: 1, borderRadius: sp(18), padding: spacing.m, marginBottom: spacing.l },
    heroIcon: { width: sp(52), height: sp(52), borderRadius: sp(18), alignItems: 'center', justifyContent: 'center' }, heroBody: { flex: 1 },
    heroTitle: { fontSize: fontScale(16), fontWeight: '800' }, heroText: { fontSize: fontScale(12), lineHeight: sp(18), marginTop: sp(3) },
    sectionTitle: { fontSize: fontScale(11), fontWeight: '800', letterSpacing: 0.7, marginBottom: spacing.s, marginLeft: sp(4) },
    card: { borderWidth: 1, borderRadius: sp(16), overflow: 'hidden', marginBottom: spacing.l },
    themeOptions: { flexDirection: 'row', gap: spacing.s, padding: spacing.s }, themeOption: { flex: 1, minHeight: sp(76), borderWidth: 1, borderRadius: sp(14), alignItems: 'center', justifyContent: 'center', gap: sp(6) }, themeOptionText: { fontSize: fontScale(12), fontWeight: '700' },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.m, paddingVertical: spacing.m }, rowIcon: { width: sp(42), height: sp(42), borderRadius: sp(14), alignItems: 'center', justifyContent: 'center' }, rowBody: { flex: 1 },
    rowTitle: { fontSize: fontScale(13), fontWeight: '700' }, rowSuatitle: { fontSize: fontScale(11), marginTop: sp(2), lineHeight: sp(16) }, divider: { height: StyleSheet.hairlineWidth, marginLeft: spacing.m + sp(42) + spacing.s },
    statusBadge: { paddingHorizontal: sp(9), paddingVertical: sp(5), borderRadius: sp(999) }, statusText: { fontSize: fontScale(10), fontWeight: '800' },
});
