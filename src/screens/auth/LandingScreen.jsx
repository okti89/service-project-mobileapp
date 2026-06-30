import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/context/ThemeContext';
import { serviceBlue, serviceGreen, serviceOrange } from '@/theme/color';

const THEME_OPTIONS = [
    { key: 'light', label: 'Açık', icon: 'weather-sunny' },
    { key: 'dark', label: 'Koyu', icon: 'weather-night' },
    { key: 'system', label: 'Sistem', icon: 'theme-light-dark' },
];

export default function LandingScreen({ navigation }) {
    const { colors, isDark, themeMode, setThemeMode } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <LinearGradient
                colors={isDark ? [colors.surface, colors.background] : ['#FFFFFF', '#F5F7FA']}
                style={styles.gradient}
            >
                <View style={styles.content}>
                    <View style={styles.logoSection}>
                        <Text style={[styles.appName, { color: colors.text }]}>
                            Servis Yönetimine Hoşgeldiniz
                        </Text>
                        <Text style={[styles.tagline, { color: colors.textTertiary }]}>
                            Saha ekibinizi yöneteceğiniz platform
                        </Text>
                    </View>

                    <View style={[styles.themeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.themeTitle, { color: colors.text }]}>Tema</Text>
                        <View style={styles.themeRow}>
                            {THEME_OPTIONS.map((option) => {
                                const selected = themeMode === option.key;
                                return (
                                    <Pressable
                                        key={option.key}
                                        onPress={() => setThemeMode(option.key)}
                                        style={[
                                            styles.themeOption,
                                            {
                                                backgroundColor: selected ? `${serviceBlue}15` : 'transparent',
                                                borderColor: selected ? serviceBlue : colors.border,
                                            },
                                        ]}
                                    >
                                        <MaterialCommunityIcons
                                            name={option.icon}
                                            size={16}
                                            color={selected ? serviceBlue : colors.textTertiary}
                                        />
                                        <Text
                                            style={[
                                                styles.themeOptionText,
                                                { color: selected ? serviceBlue : colors.textSecondary },
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.features}>
                        <View style={styles.featureItem}>
                            <View
                                style={[
                                    styles.featureIcon,
                                    { backgroundColor: `${serviceBlue}15` },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name="account-group-outline"
                                    size={24}
                                    color={serviceBlue}
                                />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={[styles.featureTitle, { color: colors.text }]}>
                                    Müşteri Yönetimi
                                </Text>
                                <Text style={[styles.featureDesc, { color: colors.textTertiary }]}>
                                    Müşterilerinizi kolayca yönetin
                                </Text>
                            </View>
                        </View>

                        <View style={styles.featureItem}>
                            <View
                                style={[
                                    styles.featureIcon,
                                    { backgroundColor: `${serviceGreen}15` },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name="clipboard-list-outline"
                                    size={24}
                                    color={serviceGreen}
                                />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={[styles.featureTitle, { color: colors.text }]}>
                                    Servis Takibi
                                </Text>
                                <Text style={[styles.featureDesc, { color: colors.textTertiary }]}>
                                    İşlerinizi anlık olarak izleyin
                                </Text>
                            </View>
                        </View>

                        <View style={styles.featureItem}>
                            <View
                                style={[
                                    styles.featureIcon,
                                    { backgroundColor: `${serviceOrange}15` },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name="chart-line"
                                    size={24}
                                    color={serviceOrange}
                                />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={[styles.featureTitle, { color: colors.text }]}>
                                    Finansal Raporlama
                                </Text>
                                <Text style={[styles.featureDesc, { color: colors.textTertiary }]}>
                                    Gelir ve giderlerinizi analiz edin
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.actions}>
                    <Pressable
                        onPress={() => navigation.navigate('Login')}
                        style={[styles.primaryButton, { backgroundColor: serviceBlue }]}
                    >
                        <Text style={styles.primaryButtonText}>Giriş Yap</Text>
                        <MaterialCommunityIcons
                            name="arrow-right"
                            size={20}
                            color="#FFFFFF"
                        />
                    </Pressable>

                    <Pressable
                        onPress={() => navigation.navigate('Register')}
                        style={[styles.secondaryButton, { borderColor: colors.border }]}
                    >
                        <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                            Hesap Oluştur
                        </Text>
                    </Pressable>
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        paddingHorizontal: 28,
        paddingTop: 20,
        paddingBottom: 40,
        justifyContent: 'space-between',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: 28,
    },
    appName: {
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: -0.8,
        marginBottom: 12,
        textAlign: 'center'
    },
    tagline: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 24,
    },
    themeCard: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginBottom: 28,
    },
    themeTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 12,
    },
    themeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    themeOption: {
        flex: 1,
        minHeight: 44,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    themeOptionText: {
        fontSize: 12,
        fontWeight: '700',
    },
    features: {
        gap: 20,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    featureIcon: {
        width: 52,
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    featureDesc: {
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 20,
    },
    actions: {
        gap: 14,
    },
    primaryButton: {
        flexDirection: 'row',
        height: 60,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        shadowColor: serviceBlue,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    secondaryButton: {
        height: 56,
        borderRadius: 16,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
});
