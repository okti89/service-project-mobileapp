import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { useToast } from '@/context/ToastContext';
import WrapperContainer from '@/components/WrapperContainer';

const SubscriptionExpiredScreen = () => {
    const { colors, isDark } = useTheme();
    const { checkAuth, logout, userInfo } = useAuth();
    const { config } = useConfig();
    const { showToast } = useToast();
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const result = await checkAuth();
            if (result?.kind === 'active') {
                showToast('success', 'Üyelik Aktif', 'Uygulamaya yönlendiriliyorsunuz.');
            } else {
                showToast('warning', 'Üyelik Yenilemesi Bekleniyor', 'Firma üyeliğiniz henüz yenilenmedi.');
            }
        } finally {
            setRefreshing(false);
        }
    };

    const endDate = userInfo?.subscription?.ends_at;
    const formattedDate = endDate
        ? new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${endDate}T12:00:00`))
        : null;
    const email = config?.email || 'teknoktay@gmail.com';
    const phone = String(config?.phone_number || '905426907712').replace(/\D/g, '');

    return (
        <WrapperContainer bg={colors.background} edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.icon, { backgroundColor: `${colors.error}16` }]}>
                    <MaterialCommunityIcons name="calendar-remove-outline" size={42} color={colors.error} />
                </View>
                <Text style={[styles.eyebrow, { color: colors.error }]}>FIRMA ÜYELİĞİ</Text>
                <Text style={[styles.title, { color: colors.text }]}>Üyelik süresi doldu</Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>Bu firmaya ait deneme veya premium üyelik sona erdi. Verileriniz korunuyor; erişimi açmak için üyeliği yenilemeniz yeterli.</Text>
                {formattedDate && <View style={[styles.dateCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF', borderColor: colors.border }]}><MaterialCommunityIcons name="calendar-clock-outline" size={20} color={colors.primary} /><Text style={[styles.dateText, { color: colors.text }]}>Bitiş tarihi: {formattedDate}</Text></View>}
                <View style={styles.actions}>
                    <Pressable onPress={() => Linking.openURL(`mailto:${email}?subject=Üyelik Yenileme`)} style={[styles.primary, { backgroundColor: colors.primary }]}><MaterialCommunityIcons name="email-outline" size={20} color="#fff" /><Text style={styles.primaryText}>Üyelik İçin İletişime Geç</Text></Pressable>
                    <Pressable onPress={() => Linking.openURL(`https://wa.me/${phone}`)} style={[styles.secondary, { borderColor: colors.primary }]}><MaterialCommunityIcons name="whatsapp" size={20} color={colors.primary} /><Text style={[styles.secondaryText, { color: colors.primary }]}>WhatsApp ile Yaz</Text></Pressable>
                    <Pressable onPress={handleRefresh} disabled={refreshing} style={[styles.refresh, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EAF2FF' }]}>{refreshing ? <ActivityIndicator color={colors.primary} /> : <MaterialCommunityIcons name="refresh" size={20} color={colors.primary} />}<Text style={[styles.refreshText, { color: colors.primary }]}>Durumu Yenile</Text></Pressable>
                    <Pressable onPress={logout} style={styles.logout}><MaterialCommunityIcons name="logout" size={18} color={colors.error} /><Text style={[styles.logoutText, { color: colors.error }]}>Çıkış Yap</Text></Pressable>
                </View>
            </ScrollView>
        </WrapperContainer>
    );
};

const styles = StyleSheet.create({
    content: { flexGrow: 1, justifyContent: 'center', padding: 28, paddingBottom: 42 },
    icon: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 24 },
    eyebrow: { textAlign: 'center', fontSize: 12, fontWeight: '800', letterSpacing: 1.1, marginBottom: 8 },
    title: { textAlign: 'center', fontSize: 27, fontWeight: '800', letterSpacing: -0.6, marginBottom: 12 },
    description: { textAlign: 'center', fontSize: 15, lineHeight: 23, marginBottom: 24 },
    dateCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderWidth: 1, borderRadius: 15, padding: 14, marginBottom: 26 },
    dateText: { fontSize: 14, fontWeight: '700' },
    actions: { gap: 11 },
    primary: { minHeight: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
    primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    secondary: { minHeight: 52, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
    secondaryText: { fontSize: 15, fontWeight: '800' },
    refresh: { minHeight: 50, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    refreshText: { fontSize: 15, fontWeight: '800' },
    logout: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
    logoutText: { fontSize: 14, fontWeight: '700' },
});

export default SubscriptionExpiredScreen;