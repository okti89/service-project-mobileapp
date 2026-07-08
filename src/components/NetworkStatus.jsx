import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useNetwork } from '@/context/NetworkContext';
import { useTheme } from '@/context/ThemeContext';

export default function NetworkStatus() {
    const { isConnected, isInternetReachable } = useNetwork();
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [isChecking, setIsChecking] = useState(false);

    // Determine states dynamically
    const showNoInternet = isConnected === false;
    const showWeakConnection = isConnected === true && isInternetReachable === false;
    const isOffline = showNoInternet || showWeakConnection;

    if (!isOffline) {
        return null;
    }

    const handleRetry = async () => {
        setIsChecking(true);
        try {
            await NetInfo.refresh();
        } catch (error) {
            console.log('Retry failed:', error);
        } finally {
            setTimeout(() => {
                setIsChecking(false);
            }, 600);
        }
    };

    // Solid color schemas according to state (avoids blending/transparency artifacts)
    const cardBg = showNoInternet
        ? (isDark ? '#2D1F22' : '#FEF2F2')
        : (isDark ? '#2D281F' : '#FFFBEB');

    const borderColor = showNoInternet
        ? (isDark ? '#5C252E' : '#FCA5A5')
        : (isDark ? '#5C4425' : '#FDE68A');

    const iconColor = showNoInternet ? '#DC3545' : '#FF8C00';
    const iconBg = showNoInternet
        ? (isDark ? '#3D2227' : '#FEE2E2')
        : (isDark ? '#3D3122' : '#FEF3C7');

    const title = showNoInternet ? "İnternet bağlantısı yok" : "Bağlantı zayıf";
    const description = showNoInternet
        ? "Şu anda çevrimdışısınız. Son senkronize edilen veriler gösteriliyor."
        : "Bazı veriler geç yüklenebilir. Çalışmaya devam edebilirsiniz.";

    const actionLabel = showNoInternet ? "Yeniden Bağlan" : "Tekrar Dene";
    const iconName = showNoInternet ? "wifi-off" : "wifi-strength-1";

    return (
        <View
            style={[
                styles.wrapper,
                {
                    top: insets.top + 8,
                },
            ]}
        >
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: cardBg,
                        borderColor: borderColor,
                    },
                ]}
            >
                {/* Left circular Icon container */}
                <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
                    <MaterialCommunityIcons name={iconName} size={18} color={iconColor} />
                </View>

                {/* Middle Text Content */}
                <View style={styles.textContainer}>
                    <Text style={[styles.titleText, { color: colors.text }]}>{title}</Text>
                    <Text style={[styles.descText, { color: colors.textSecondary }]}>{description}</Text>
                </View>

                {/* Right Action Trigger */}
                <Pressable
                    onPress={handleRetry}
                    disabled={isChecking}
                    style={({ pressed }) => [
                        styles.actionButton,
                        pressed && { opacity: 0.6 }
                    ]}
                >
                    {isChecking ? (
                        <ActivityIndicator size="small" color={iconColor} />
                    ) : (
                        <Text style={[styles.actionText, { color: iconColor }]}>{actionLabel}</Text>
                    )}
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 9999,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden', // Prevents background bleed and border color aliasing issues
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
        marginRight: 8,
    },
    titleText: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    descText: {
        fontSize: 11,
        lineHeight: 15,
    },
    actionButton: {
        paddingVertical: 6,
        paddingHorizontal: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionText: {
        fontSize: 13,
        fontWeight: '700',
    },
});
