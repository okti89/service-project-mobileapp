import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '@/components/Header';
import WrapperContainer from '@/components/WrapperContainer';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';

const SECTION_MAP = {
    AdminUsers: {
        title: 'Kullanıcı Listesi',
        subtitle: 'Tüm kullanıcı kayıtları.',
        description: 'Tüm kullanıcı hesaplarını, rollerini ve temel yönetim bağlantılarını bu alanda toplayacağız.',
        icon: 'account-group-outline',
        color: '#2563EB',
    },
    AdminPendingUsers: {
        title: 'Onay Bekleyen Kullanıcılar',
        subtitle: 'Başvuru ve onay akışı.',
        description: 'Yeni kullanıcı başvurularını incelemek, onaylamak veya reddetmek için bu alan ayrıldı.',
        icon: 'account-clock-outline',
        color: '#F59E0B',
    },
    AdminRejectedUsers: {
        title: 'Pasif / Reddedilenler',
        subtitle: 'Pasif ve reddedilmiş hesaplar.',
        description: 'Pasife alınan veya reddedilen kullanıcıları yeniden değerlendirmek için bu ekran kullanılacak.',
        icon: 'account-cancel-outline',
        color: '#64748B',
    },
    AdminTechnicians: {
        title: 'Teknisyen Listesi',
        subtitle: 'Saha ekipleri ve operasyon özeti.',
        description: 'Teknisyen kartları, yetkiler, performans ve günlük operasyon bağlantıları bu akış altında toplanacak.',
        icon: 'account-hard-hat-outline',
        color: '#2563EB',
    },
    AdminTechnicianLocations: {
        title: 'Teknisyen Konumları',
        subtitle: 'Saha konum geçmişi.',
        description: 'Gün bazlı konum hareketleri, rota izleme ve ziyaret kayıtlarını bu bölümde yönetebilirsin.',
        icon: 'map-marker-path',
        color: '#0891B2',
    },
    AdminTechnicianShifts: {
        title: 'Teknisyen Mesaileri',
        subtitle: 'Mesai kayıtları ve vardiyalar.',
        description: 'Başlangıç, bitiş, açık mesai ve vardiya uyumluluğu gibi alanlar bu ekranda genişletilecek.',
        icon: 'clock-outline',
        color: '#0F766E',
    },
    AdminTechnicianLeaves: {
        title: 'Teknisyen İzinleri',
        subtitle: 'İzin ve devamsızlık yönetimi.',
        description: 'İzin talepleri, devamsızlıklar ve saha dışı günler için yönetim ekranı bu alanda yer alacak.',
        icon: 'calendar-account-outline',
        color: '#EA580C',
    },
    AdminCustomers: {
        title: 'Müşteri Listesi',
        subtitle: 'Müşteri kayıtları ve iletişim.',
        description: 'Müşteri kartları, servis geçmişi ve hızlı iletişim akışları için giriş ekranı hazırlandı.',
        icon: 'account-box-multiple-outline',
        color: '#8B5CF6',
    },
    AdminPayroll: {
        title: 'Maaş ve Bordro',
        subtitle: 'Bordro ve ödeme operasyonları.',
        description: 'Prim, avans, maaş ve bordro kalemlerinin yönetimi için bu ekran kullanılacak.',
        icon: 'cash-multiple',
        color: '#0F766E',
    },
    AdminAccounting: {
        title: 'Finans ve Muhasebe',
        subtitle: 'Tahsilat, gider ve kasa akışları.',
        description: 'Gelir gider, tahsilat ve muhasebe hareketleri için detay ekranı bu bölümde genişletilecek.',
        icon: 'finance',
        color: '#DC2626',
    },
    AdminCompanySettings: {
        title: 'Firma Ayarları',
        subtitle: 'Şirket yapılandırması ve ayarlar.',
        description: 'Çalışma saatleri, şirket bilgileri ve genel yönetim tercihleri bu alanda toplanacak.',
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
        { label: 'Kullanıcı Listesi', route: 'AdminUsers' },
        { label: 'Pasif / Reddedilenler', route: 'AdminRejectedUsers' },
    ],
    AdminRejectedUsers: [
        { label: 'Kullanıcı Listesi', route: 'AdminUsers' },
        { label: 'Onay Bekleyenler', route: 'AdminPendingUsers' },
    ],
    AdminTechnicians: [
        { label: 'Teknisyen Konumları', route: 'AdminTechnicianLocations' },
        { label: 'Teknisyen Mesaileri', route: 'AdminTechnicianShifts' },
        { label: 'Teknisyen İzinleri', route: 'AdminTechnicianLeaves' },
    ],
    AdminTechnicianLocations: [
        { label: 'Teknisyen Listesi', route: 'AdminTechnicians' },
        { label: 'Teknisyen Mesaileri', route: 'AdminTechnicianShifts' },
    ],
    AdminTechnicianShifts: [
        { label: 'Teknisyen Konumları', route: 'AdminTechnicianLocations' },
        { label: 'Teknisyen İzinleri', route: 'AdminTechnicianLeaves' },
    ],
    AdminTechnicianLeaves: [
        { label: 'Teknisyen Listesi', route: 'AdminTechnicians' },
        { label: 'Teknisyen Mesaileri', route: 'AdminTechnicianShifts' },
    ],
    AdminCustomers: [
        { label: 'Finans ve Muhasebe', route: 'AdminAccounting' },
    ],
    AdminPayroll: [
        { label: 'Finans ve Muhasebe', route: 'AdminAccounting' },
    ],
    AdminAccounting: [
        { label: 'Maaş ve Bordro', route: 'AdminPayroll' },
        { label: 'Müşteri Listesi', route: 'AdminCustomers' },
    ],
    AdminCompanySettings: [
        { label: 'Kullanıcı Listesi', route: 'AdminUsers' },
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
                        <Text style={[styles.linksTitle, { color: colors.text }]}>Bağlantılar</Text>
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
