import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '@/components/Header';
import WrapperContainer from '@/components/WrapperContainer';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';

const SECTION_MAP = {
    AdminUsers: {
        title: 'Kullanici Listesi',
        subtitle: 'Tum kullanici kayitlari.',
        description: 'Tum kullanici hesaplarini, rollerini ve temel yonetim baglantilarini bu alanda toplayacagiz.',
        icon: 'account-group-outline',
        color: '#2563EB',
    },
    AdminPendingUsers: {
        title: 'Onay Bekleyen Kullanicilar',
        subtitle: 'Basvuru ve onay akisi.',
        description: 'Yeni kullanici basvurularini incelemek, onaylamak veya reddetmek icin bu alan ayrildi.',
        icon: 'account-clock-outline',
        color: '#F59E0B',
    },
    AdminRejectedUsers: {
        title: 'Pasif / Reddedilenler',
        subtitle: 'Pasif ve reddedilmis hesaplar.',
        description: 'Pasife alinan veya reddedilen kullanicilari yeniden degerlendirmek icin bu ekran kullanilacak.',
        icon: 'account-cancel-outline',
        color: '#64748B',
    },
    AdminTechnicians: {
        title: 'Teknisyen Listesi',
        subtitle: 'Saha ekipleri ve operasyon ozeti.',
        description: 'Teknisyen kartlari, yetkiler, performans ve gunluk operasyon baglantilari bu akis altinda toplanacak.',
        icon: 'account-hard-hat-outline',
        color: '#2563EB',
    },
    AdminTechnicianLocations: {
        title: 'Teknisyen Konumlari',
        subtitle: 'Saha konum gecmisi.',
        description: 'Gun bazli konum hareketleri, rota izleme ve ziyaret kayitlarini bu bolumde yonetebilirsin.',
        icon: 'map-marker-path',
        color: '#0891B2',
    },
    AdminTechnicianShifts: {
        title: 'Teknisyen Mesaileri',
        subtitle: 'Mesai kayitlari ve vardiyalar.',
        description: 'Baslangic, bitis, acik mesai ve vardiya uyumlulugu gibi alanlar bu ekranda genisletilecek.',
        icon: 'clock-outline',
        color: '#0F766E',
    },
    AdminTechnicianLeaves: {
        title: 'Teknisyen Izinleri',
        subtitle: 'Izin ve devamsizlik yonetimi.',
        description: 'Izin talepleri, devamsizliklar ve saha disi gunler icin yonetim ekrani bu alanda yer alacak.',
        icon: 'calendar-account-outline',
        color: '#EA580C',
    },
    AdminCustomers: {
        title: 'Musteri Listesi',
        subtitle: 'Musteri kayitlari ve iletisim.',
        description: 'Musteri kartlari, servis gecmisi ve hizli iletisim akislari icin giris ekrani hazirlandi.',
        icon: 'account-box-multiple-outline',
        color: '#8B5CF6',
    },
    AdminInventory: {
        title: 'Urun ve Envanter',
        subtitle: 'Stok ve urun akislari.',
        description: 'Urun kartlari, stok hareketleri ve depo yonetimi baglantilari bu alanda toplanacak.',
        icon: 'package-variant-closed',
        color: '#7C3AED',
    },
    AdminPayroll: {
        title: 'Maas ve Bordro',
        subtitle: 'Bordro ve odeme operasyonlari.',
        description: 'Prim, avans, maas ve bordro kalemlerinin yonetimi icin bu ekran kullanilacak.',
        icon: 'cash-multiple',
        color: '#0F766E',
    },
    AdminAccounting: {
        title: 'Finans ve Muhasebe',
        subtitle: 'Tahsilat, gider ve kasa akislari.',
        description: 'Gelir gider, tahsilat ve muhasebe hareketleri icin detay ekrani bu bolumde genisletilecek.',
        icon: 'finance',
        color: '#DC2626',
    },
    AdminServices: {
        title: 'Servis Yonetimi',
        subtitle: 'Servis operasyonlari ve planlama.',
        description: 'Servis isleri, atamalar ve operasyon surecleri bu ekran altinda toplanacak.',
        icon: 'clipboard-text-outline',
        color: '#16A34A',
    },
    AdminNotifications: {
        title: 'Bildirimler',
        subtitle: 'Uygulama bildirim akisi.',
        description: 'Bildirim turleri, gonderimler ve sistem mesajlari icin baglantilar bu bolumde yer alacak.',
        icon: 'bell-outline',
        color: '#0284C7',
    },
    AdminReports: {
        title: 'Raporlar',
        subtitle: 'Rapor ve analiz ozeti.',
        description: 'Performans, finans ve saha raporlari icin detay ekranlari burada genisletilecek.',
        icon: 'chart-box-outline',
        color: '#7C3AED',
    },
    AdminCompanySettings: {
        title: 'Firma Ayarlari',
        subtitle: 'Sirket yapilandirmasi ve ayarlar.',
        description: 'Calisma saatleri, sirket bilgileri ve genel yonetim tercihleri bu alanda toplanacak.',
        icon: 'office-building-cog-outline',
        color: '#475569',
    },
};

const QUICK_LINKS = {
    AdminUsers: [
        { label: 'Onay Bekleyenler', route: 'AdminPendingUsers' },
        { label: 'Pasif / Reddedilenler', route: 'AdminRejectedUsers' },
    ],
    AdminPendingUsers: [
        { label: 'Kullanici Listesi', route: 'AdminUsers' },
        { label: 'Pasif / Reddedilenler', route: 'AdminRejectedUsers' },
    ],
    AdminRejectedUsers: [
        { label: 'Kullanici Listesi', route: 'AdminUsers' },
        { label: 'Onay Bekleyenler', route: 'AdminPendingUsers' },
    ],
    AdminTechnicians: [
        { label: 'Teknisyen Konumlari', route: 'AdminTechnicianLocations' },
        { label: 'Teknisyen Mesaileri', route: 'AdminTechnicianShifts' },
        { label: 'Teknisyen Izinleri', route: 'AdminTechnicianLeaves' },
    ],
    AdminTechnicianLocations: [
        { label: 'Teknisyen Listesi', route: 'AdminTechnicians' },
        { label: 'Teknisyen Mesaileri', route: 'AdminTechnicianShifts' },
    ],
    AdminTechnicianShifts: [
        { label: 'Teknisyen Konumlari', route: 'AdminTechnicianLocations' },
        { label: 'Teknisyen Izinleri', route: 'AdminTechnicianLeaves' },
    ],
    AdminTechnicianLeaves: [
        { label: 'Teknisyen Listesi', route: 'AdminTechnicians' },
        { label: 'Teknisyen Mesaileri', route: 'AdminTechnicianShifts' },
    ],
    AdminCustomers: [
        { label: 'Finans ve Muhasebe', route: 'AdminAccounting' },
        { label: 'Urun ve Envanter', route: 'AdminInventory' },
    ],
    AdminInventory: [
        { label: 'Servis Yonetimi', route: 'AdminServices' },
        { label: 'Musteri Listesi', route: 'AdminCustomers' },
    ],
    AdminPayroll: [
        { label: 'Finans ve Muhasebe', route: 'AdminAccounting' },
    ],
    AdminAccounting: [
        { label: 'Maas ve Bordro', route: 'AdminPayroll' },
        { label: 'Musteri Listesi', route: 'AdminCustomers' },
    ],
    AdminServices: [
        { label: 'Teknisyen Listesi', route: 'AdminTechnicians' },
        { label: 'Musteri Listesi', route: 'AdminCustomers' },
    ],
    AdminNotifications: [
        { label: 'Raporlar', route: 'AdminReports' },
    ],
    AdminReports: [
        { label: 'Finans ve Muhasebe', route: 'AdminAccounting' },
        { label: 'Servis Yonetimi', route: 'AdminServices' },
    ],
    AdminCompanySettings: [
        { label: 'Kullanici Listesi', route: 'AdminUsers' },
        { label: 'Finans ve Muhasebe', route: 'AdminAccounting' },
    ],
};

const AdminSectionScreen = ({ route, navigation }) => {
    const { colors } = useTheme();
    const screenName = route?.name || 'AdminUsers';
    const meta = SECTION_MAP[screenName] || SECTION_MAP.AdminUsers;
    const links = QUICK_LINKS[screenName] || [];

    return (
        <WrapperContainer withTabBar scroll>
            <Header
                title={meta.title}
                subtitle={meta.subtitle}
                showBack
                borderBottom
                onBackPress={() => navigation.goBack()}
            />

            <View style={styles.content}>
                <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                    <View style={[styles.heroIcon, { backgroundColor: `${meta.color}16` }]}>
                        <MaterialCommunityIcons name={meta.icon} size={22} color={meta.color} />
                    </View>
                    <Text style={[styles.heroTitle, { color: colors.text }]}>{meta.title}</Text>
                    <Text style={[styles.heroDescription, { color: colors.textSecondary }]}>{meta.description}</Text>
                </View>

                {links.length > 0 ? (
                    <View style={[styles.linksCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.linksTitle, { color: colors.text }]}>Baglantilar</Text>
                        <View style={styles.linksWrap}>
                            {links.map((item, index) => (
                                <Pressable
                                    key={item.route}
                                    onPress={() => navigation.navigate(item.route)}
                                    style={({ pressed }) => [
                                        styles.linkRow,
                                        {
                                            borderBottomColor: index === links.length - 1 ? 'transparent' : colors.border,
                                            backgroundColor: pressed ? `${meta.color}10` : 'transparent',
                                        },
                                    ]}
                                >
                                    <Text style={[styles.linkText, { color: colors.text }]}>{item.label}</Text>
                                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                                </Pressable>
                            ))}
                        </View>
                    </View>
                ) : null}
            </View>
        </WrapperContainer>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.m,
        paddingBottom: spacing['2xl'],
        gap: spacing.m,
    },
    heroCard: {
        borderWidth: 1,
        borderRadius: 18,
        paddingHorizontal: spacing.l,
        paddingVertical: spacing.l,
        gap: spacing.s,
    },
    heroIcon: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroTitle: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    heroDescription: {
        fontSize: 13,
        lineHeight: 20,
        fontWeight: '500',
    },
    linksCard: {
        borderWidth: 1,
        borderRadius: 18,
        overflow: 'hidden',
    },
    linksTitle: {
        fontSize: 14,
        fontWeight: '800',
        paddingHorizontal: spacing.l,
        paddingTop: spacing.m + 2,
        paddingBottom: spacing.s,
    },
    linksWrap: {
        paddingBottom: spacing.xs,
    },
    linkRow: {
        minHeight: 46,
        paddingHorizontal: spacing.l,
        paddingVertical: spacing.s + 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    linkText: {
        fontSize: 14,
        fontWeight: '600',
    },
});

export default AdminSectionScreen;