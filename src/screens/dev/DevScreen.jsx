import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import React from 'react'
import { useTheme } from '@/context/ThemeContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const ALL_SCREENS = [
    { name: 'Landing', label: 'Landing (Auth)' },
    { name: 'Home', label: 'Home' },
    { name: 'AccountDeactivated', label: 'Account Deactivated' },
    { name: 'AccountPending', label: 'Account Pending' },
    { name: 'AppErrorBoundaryPreview', label: 'Error Boundary (Önizleme)' },
    { name: 'CustomSplash', label: 'Custom Splash' },
    { name: 'DevModals', label: 'Dev Modals' },
    { name: 'NetworkStatus', label: 'NetworkStatus' },
    { name: 'Login', label: 'Login' },
    { name: 'Register', label: 'Register' },
    { name: 'ForgotPassword', label: 'Forgot Password' },
    { name: 'ResetPassword', label: 'Reset Password' },
    { name: 'ResetCode', label: 'Reset Code' },
    {
        name: 'AdminTechnicians',
        label: 'Teknisyenler',
    },
];

const DevScreen = ({ navigation }) => {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <ScrollView
            style={[styles.screen, { backgroundColor: colors.background }]}
            contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
        >
            <Text style={[styles.title, { color: colors.text }]}>Geliştirici Menüsü</Text>
            <Text style={[styles.subtitle, { color: colors.textTertiary }]}>Tüm ekranlara hızlı erişim</Text>

            <View style={styles.grid}>
                {ALL_SCREENS.map((screen, index) => (
                    <Pressable
                        key={index}
                        onPress={() => navigation.navigate(screen.name)}
                        style={({ pressed }) => [
                            styles.card,
                            {
                                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                                borderColor: colors.border,
                                opacity: pressed ? 0.7 : 1
                            }
                        ]}
                    >
                        <Text style={[styles.cardTitle, { color: colors.primary }]}>{screen.name}</Text>
                        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>{screen.label}</Text>
                    </Pressable>
                ))}
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    container: {
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        marginBottom: 24,
    },
    grid: {
        gap: 12,
    },
    card: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 12,
    }
})
export default DevScreen