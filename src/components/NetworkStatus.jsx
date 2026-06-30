import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '@/context/NetworkContext';
import { useTheme } from '@/context/ThemeContext';

export default function NetworkStatus() {
    const { isConnected, isInternetReachable } = useNetwork();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    const isOffline = isConnected === false || isInternetReachable === false;

    if (!isOffline) {
        return null;
    }

    return (
        <View
            pointerEvents="none"
            style={[
                styles.wrapper,
                {
                    top: insets.top + 8,
                },
            ]}
        >
            <View
                style={[
                    styles.banner,
                    {
                        backgroundColor: colors.warning,
                    },
                ]}
            >
                <Text style={styles.text}>Baglanti zayif. Veriler gec gelebilir.</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 9998,
        alignItems: 'center',
    },
    banner: {
        minHeight: 38,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 6,
    },
    text: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
        textAlign: 'center',
    },
});
