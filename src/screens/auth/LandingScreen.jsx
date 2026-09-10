import React from 'react';
import {
    Pressable,
    Image,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Polyline } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/context/ThemeContext';
import { serviceBlue, serviceGreen, serviceOrange } from '@/theme/color';
import WrapperContainer from '@/components/WrapperContainer';
import buildBrand from '@/config/buildBrand';

const THEME_OPTIONS = [
    { key: 'light', label: 'Açık', icon: 'weather-sunny' },
    { key: 'dark', label: 'Koyu', icon: 'weather-night' },
];

const TODAY_SERVICES = [
    { time: '11:30', name: 'Emine Şahin', address: 'Batarya Değişimi', district: 'Kadıköy, İstanbul', color: serviceGreen, icon: 'phone' },
    { time: '14:00', name: 'Ahmet Bulut', address: 'Ekran Değişimi', district: 'Bakırköy, İstanbul', color: serviceOrange, icon: 'cellphone' },
    { time: '16:30', name: 'Zeynep Aksoy', address: 'Batarya Değişimi', district: 'Kadıköy, İstanbul', color: serviceBlue, icon: 'tools' },
];

export default function LandingScreen({ navigation }) {
    const { colors, isDark, themeMode, setThemeMode } = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <WrapperContainer>
            <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }]}>
                <LinearGradient
                    colors={
                        isDark
                            ? ['#0F172A', '#1E293B', '#0F172A']
                            : ['#FFFFFF', '#F0F5FF', '#FFFFFF']
                    }
                    style={styles.gradient}
                >
                    {/* HEADER: Logo + Title + Theme icons */}
                    <View style={styles.header}>
                        <View style={[styles.logoWrap, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
                            <Image source={buildBrand.logo} style={styles.brandLogo} resizeMode="contain" />
                        </View>
                        <View style={styles.titleBlock}>
                            <Text style={[styles.appName, buildBrand.isWhiteLabel && styles.whiteLabelAppName, { color: colors.text }]}>
                                {buildBrand.isWhiteLabel ? buildBrand.name : <>Servis<Text style={{ color: serviceBlue }}>Asistanı</Text></>}
                            </Text>
                            <Text style={[styles.tagline, { color: colors.textSecondary }]}>
                                Teknik Servis Yönetimi
                            </Text>
                        </View>
                        <View style={styles.themeRow}>
                            {THEME_OPTIONS.map((option) => {
                                const selected = themeMode === option.key;
                                return (
                                    <Pressable
                                        key={option.key}
                                        onPress={() => setThemeMode(option.key)}
                                        style={[
                                            styles.themeIconBtn,
                                            {
                                                backgroundColor: selected ? `${serviceBlue}20` : 'transparent',
                                                borderColor: selected ? serviceBlue : (isDark ? '#334155' : '#E5E7EB'),
                                            },
                                        ]}
                                    >
                                        <MaterialCommunityIcons
                                            name={option.icon}
                                            size={14}
                                            color={selected ? serviceBlue : colors.textSecondary}
                                        />
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    {/* MOCKUP: Phone + Cards */}
                    <View style={styles.mockupWrap}>
                        <PreviewMockup isDark={isDark} />
                    </View>

                    {/* HEADING + DESCRIPTION */}
                    <View style={styles.headingBlock}>
                        <Text style={[styles.heading, { color: colors.text }]}>
                            Teknik servisinizi{' '}
                            <Text style={{ color: serviceBlue }}>tek yerden</Text> yönetin
                        </Text>
                        <Text style={[styles.description, { color: colors.textSecondary }]}>
                            Servislerinizi takip edin, müşterilerinizi yönetin, teknisyenlerinizi koordine edin,
                            rotalarınızı planlayın.
                        </Text>
                    </View>

                    {/* FEATURES */}
                    <View style={styles.featuresRow}>
                        <FeatureItem
                            icon="clipboard-list-outline"
                            color={serviceBlue}
                            title="Servis Takibi"
                            desc="Tüm servis süreçlerini anlık takip edin"
                            cardBg={isDark ? '#1E293B' : '#FFFFFF'}
                            borderColor={isDark ? '#334155' : '#E5E7EB'}
                            textColor={colors.text}
                            subColor={colors.textSecondary}
                        />
                        <FeatureItem
                            icon="map-marker-outline"
                            color={serviceGreen}
                            title="Canlı Konum"
                            desc="Teknisyenlerinizi harita üzerinde izleyin"
                            cardBg={isDark ? '#1E293B' : '#FFFFFF'}
                            borderColor={isDark ? '#334155' : '#E5E7EB'}
                            textColor={colors.text}
                            subColor={colors.textSecondary}
                        />
                        <FeatureItem
                            icon="briefcase-outline"
                            color={serviceOrange}
                            title="Muhasebe"
                            desc="Gelirlerinizi yönetin, ödemeleri takip edin"
                            cardBg={isDark ? '#1E293B' : '#FFFFFF'}
                            borderColor={isDark ? '#334155' : '#E5E7EB'}
                            textColor={colors.text}
                            subColor={colors.textSecondary}
                        />
                    </View>

                    {/* ACTIONS */}
                    <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 8) }]}>
                        <Pressable
                            onPress={() => navigation.navigate('Login')}
                            style={[styles.primaryButton, { backgroundColor: serviceBlue }]}
                        >
                            <Text style={styles.primaryButtonText}>Giriş Yap</Text>
                        </Pressable>

                        <Pressable
                            onPress={() => navigation.navigate('Register')}
                            style={[
                                styles.secondaryButton,
                                { borderColor: serviceBlue, backgroundColor: 'transparent' },
                            ]}
                        >
                            <Text style={[styles.secondaryButtonText, { color: serviceBlue }]}>
                                Kayıt Ol
                            </Text>
                        </Pressable>
                    </View>
                </LinearGradient>
            </View>
        </WrapperContainer>
    );
}

/* ----------------------------- Feature Item ----------------------------- */
function FeatureItem({ icon, color, title, desc, cardBg, borderColor, textColor, subColor }) {
    return (
        <View
            style={[
                styles.featureCard,
                { backgroundColor: cardBg, borderColor },
            ]}
        >
            <View style={[styles.featureIcon, { backgroundColor: `${color}15` }]}>
                <MaterialCommunityIcons name={icon} size={18} color={color} />
            </View>
            <Text style={[styles.featureTitle, { color: textColor }]} numberOfLines={1}>
                {title}
            </Text>
            <Text style={[styles.featureDesc, { color: subColor }]} numberOfLines={3}>
                {desc}
            </Text>
        </View>
    );
}

/* ----------------------------- Preview Mockup ----------------------------- */
function PreviewMockup({ isDark }) {
    const mapBg = isDark ? '#1E293B' : '#EEF2FF';
    const cardBg = isDark ? '#0F172A' : '#FFFFFF';
    const cardBorder = isDark ? '#334155' : '#E5E7EB';
    const textColor = isDark ? '#F8FAFC' : '#1A1A2E';
    const subColor = isDark ? '#94A3B8' : '#64748B';
    const mapGrid = isDark ? '#334155' : '#CBD5E1';

    return (
        <View style={styles.mockupContainer}>
            {/* Phone frame (left side) */}
            <View style={[styles.phoneFrame, { backgroundColor: mapBg, borderColor: cardBorder }]}>
                {/* Map grid background */}
                <View style={StyleSheet.absoluteFill}>
                    <Svg width="100%" height="100%" preserveAspectRatio="none">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Path
                                key={`h-${i}`}
                                d={`M0 ${i * 22} L200 ${i * 22}`}
                                stroke={mapGrid}
                                strokeWidth={0.5}
                                opacity={0.45}
                            />
                        ))}
                        {Array.from({ length: 9 }).map((_, i) => (
                            <Path
                                key={`v-${i}`}
                                d={`M${i * 22} 0 L${i * 22} 130`}
                                stroke={mapGrid}
                                strokeWidth={0.5}
                                opacity={0.45}
                            />
                        ))}
                    </Svg>
                </View>

                {/* Route line */}
                <View style={styles.routeOverlay}>
                    <Svg width="100%" height="100%" viewBox="0 0 200 130" preserveAspectRatio="none">
                        <Path
                            d="M 30 110 Q 60 80, 90 70 T 150 25"
                            stroke={serviceBlue}
                            strokeWidth={2.5}
                            fill="none"
                            strokeLinecap="round"
                        />
                        <Circle cx="30" cy="110" r="4" fill={serviceBlue} />
                        <Circle cx="90" cy="70" r="3.5" fill="#22C55E" />
                        <Circle cx="150" cy="25" r="4" fill={serviceBlue} />
                    </Svg>
                </View>

                {/* Floating "Bugünkü Servisler" card inside phone */}
                <View style={[styles.todayCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <View style={styles.todayHeader}>
                        <Text style={[styles.todayTitle, { color: textColor }]}>Bugünkü Servisler</Text>
                        <MaterialCommunityIcons name="chevron-right" size={14} color={subColor} />
                    </View>
                    {TODAY_SERVICES.map((s, idx) => (
                        <View
                            key={idx}
                            style={[
                                styles.todayRow,
                                idx > 0 && { borderTopColor: cardBorder, borderTopWidth: 0.5 },
                            ]}
                        >
                            <Text style={[styles.todayTime, { color: s.color }]}>{s.time}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.todayName, { color: textColor }]} numberOfLines={1}>
                                    {s.name}
                                </Text>
                                <View style={styles.todayMeta}>
                                    <MaterialCommunityIcons name="map-marker" size={9} color={subColor} />
                                    <Text style={[styles.todayAddress, { color: subColor }]} numberOfLines={1}>
                                        {' '}{s.address}
                                    </Text>
                                </View>
                                <View style={styles.todayMeta}>
                                    <MaterialCommunityIcons name="map-marker-outline" size={9} color={subColor} />
                                    <Text style={[styles.todayAddress, { color: subColor }]} numberOfLines={1}>
                                        {' '}{s.district}
                                    </Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name={s.icon} size={14} color={s.color} />
                        </View>
                    ))}
                </View>
            </View>

            {/* Right side floating cards */}
            <View style={styles.rightStack}>
                {/* Profile card */}
                <View style={[styles.floatCard, styles.profileCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>MY</Text>
                        <View style={styles.statusDot} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[styles.profileName, { color: textColor }]} numberOfLines={1}>
                            Mehmet Yılmaz
                        </Text>
                        <Text style={[styles.profileRole, { color: subColor }]} numberOfLines={1}>
                            Teknisyen Servis Uzmanı
                        </Text>
                        <View style={styles.profileStatus}>
                            <View style={[styles.statusDotSmall, { backgroundColor: serviceGreen }]} />
                            <Text style={[styles.profileStatusText, { color: serviceGreen }]}>
                                Müsait
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Earnings card */}
                <View style={[styles.floatCard, styles.earningsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <Text style={[styles.earningsLabel, { color: subColor }]}>Günlük Tahsilat</Text>
                    <Text style={[styles.earningsAmount, { color: textColor }]}>₺4.160,00</Text>
                    <Text style={[styles.earningsSub, { color: subColor }]}>4 Ödeme alındı</Text>
                    <View style={styles.chartWrap}>
                        <Svg width="100%" height={26} viewBox="0 0 100 26" preserveAspectRatio="none">
                            <Polyline
                                points="0,22 12,16 24,18 36,10 48,12 60,6 72,9 84,2 100,4"
                                fill="none"
                                stroke={serviceGreen}
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </View>
                </View>

                {/* Completed card */}
                <View style={[styles.floatCard, styles.completedCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <View style={[styles.completedIcon, { backgroundColor: '#8B5CF615' }]}>
                        <MaterialCommunityIcons name="instagram" size={15} color="#8B5CF6" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[styles.completedTitle, { color: textColor }]} numberOfLines={1}>
                            Servis Tamamlandı
                        </Text>
                        <Text style={[styles.completedSub, { color: subColor }]} numberOfLines={1}>
                            Batarya Değişimi · Emine Şahin
                        </Text>
                    </View>
                    <View style={[styles.checkCircle, { backgroundColor: `${serviceGreen}15` }]}>
                        <MaterialCommunityIcons name="check" size={14} color={serviceGreen} />
                    </View>
                </View>
            </View>
        </View>
    );
}

/* --------------------------------- Styles --------------------------------- */
const styles = StyleSheet.create({
    container: { flex: 1 },
    gradient: {
        flex: 1,
        paddingHorizontal: 18,
        paddingTop: 4,
        paddingBottom: 4,
    },

    /* Header */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 16,
    },
    logoWrap: {
        width: 60,
        height: 60,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },
    brandLogo: {
        width: 50,
        height: 50,
    },
    titleBlock: {
        flex: 1,
        marginLeft: 14,
    },
    appName: {
        fontSize: 26,
        fontWeight: '900',
        letterSpacing: 0,
    },
    whiteLabelAppName: {
        fontSize: 19,
    },
    tagline: {
        fontSize: 14,
        fontWeight: '500',
        marginTop: 2,
    },
    themeRow: {
        flexDirection: 'row',
        gap: 6,
    },
    themeIconBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* Mockup */
    mockupWrap: {
        flex: 1.3,
        minHeight: 220,
        marginBottom: 18,
    },
    mockupContainer: {
        flex: 1,
        flexDirection: 'row',
    },
    phoneFrame: {
        width: '52%',
        height: '100%',
        borderRadius: 18,
        borderWidth: 1,
        overflow: 'hidden',
        position: 'relative',
        shadowColor: serviceBlue,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 4,
    },
    routeOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    todayCard: {
        position: 'absolute',
        top: 12,
        left: 10,
        right: 10,
        borderRadius: 12,
        borderWidth: 1,
        padding: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    todayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    todayTitle: {
        fontSize: 11.5,
        fontWeight: '800',
    },
    todayRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        gap: 6,
    },
    todayTime: {
        fontSize: 10.5,
        fontWeight: '800',
        width: 32,
    },
    todayName: {
        fontSize: 10.5,
        fontWeight: '700',
    },
    todayMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 1,
    },
    todayAddress: {
        fontSize: 8.5,
        fontWeight: '500',
    },

    /* Right cards */
    rightStack: {
        flex: 1,
        marginLeft: 8,
        justifyContent: 'space-between',
    },
    floatCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#0066CC',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    statusDot: {
        position: 'absolute',
        bottom: -1,
        right: -1,
        width: 11,
        height: 11,
        borderRadius: 5.5,
        backgroundColor: serviceGreen,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    profileName: {
        fontSize: 13,
        fontWeight: '800',
    },
    profileRole: {
        fontSize: 9.5,
        fontWeight: '500',
        marginTop: 1,
    },
    profileStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        gap: 4,
    },
    statusDotSmall: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    profileStatusText: {
        fontSize: 9.5,
        fontWeight: '700',
    },

    earningsCard: {},
    earningsLabel: {
        fontSize: 10,
        fontWeight: '600',
    },
    earningsAmount: {
        fontSize: 20,
        fontWeight: '900',
        marginTop: 2,
    },
    earningsSub: {
        fontSize: 9,
        fontWeight: '500',
        marginTop: 1,
    },
    chartWrap: {
        marginTop: 6,
    },

    completedCard: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    completedIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    completedTitle: {
        fontSize: 12,
        fontWeight: '800',
    },
    completedSub: {
        fontSize: 9.5,
        fontWeight: '500',
        marginTop: 1,
    },
    checkCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* Heading */
    headingBlock: {
        alignItems: 'center',
        marginBottom: 18,
    },
    heading: {
        fontSize: 28,
        fontWeight: '900',
        textAlign: 'center',
        lineHeight: 38,
        letterSpacing: -0.5,
    },
    description: {
        fontSize: 13.5,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 22,
        marginTop: 10,
        paddingHorizontal: 6,
    },

    /* Features */
    featuresRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 18,
    },
    featureCard: {
        flex: 1,
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        alignItems: 'center',
    },
    featureIcon: {
        width: 46,
        height: 46,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    featureTitle: {
        fontSize: 13,
        fontWeight: '800',
        textAlign: 'center',
    },
    featureDesc: {
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 16,
        marginTop: 4,
    },

    /* Actions */
    actions: {
        gap: 12,
    },
    primaryButton: {
        height: 58,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: serviceBlue,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    secondaryButton: {
        height: 52,
        borderRadius: 14,
        borderWidth: 1.6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '800',
    },
});
