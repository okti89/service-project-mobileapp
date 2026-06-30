import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { serviceBlue } from '@/theme/color';

const getErrorCode = (error) => {
    const rawCode = error?.code || error?.errorCode || error?.name;
    if (rawCode && String(rawCode).trim()) {
        return String(rawCode)
            .replace(/[^A-Z0-9]+/gi, '_')
            .replace(/^_+|_+$/g, '')
            .toUpperCase();
    }

    const rawMessage = error?.message || 'Bilinmeyen hata';
    const compactMessage = String(rawMessage)
        .replace(/[^A-Z0-9]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase()
        .slice(0, 24);

    return compactMessage || 'UNKNOWN';
};

class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            retryKey: 0,
        };
    }

    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error, errorInfo) {
        console.log('App error boundary caught:', error, errorInfo);
    }

    handleReset = () => {
        this.setState((prevState) => ({
            hasError: false,
            error: null,
            retryKey: prevState.retryKey + 1,
        }));
    };

    render() {
        if (this.state.hasError) {
            const errorMessage = this.state.error?.message
                ? String(this.state.error.message)
                : 'Beklenmeyen bir hata oluştu.';
            const shortCode = `ERR_APP_${getErrorCode(this.state.error)}`;

            return (
                <View style={styles.screen}>
                    <View style={styles.card}>
                        <View style={styles.iconWrap}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={34} color={serviceBlue} />
                        </View>

                        <Text style={styles.title}>Bir şeyler ters gitti</Text>
                        <Text style={styles.message}>
                            Ekran güvenli şekilde durduruldu. Aşağıdaki butonla uygulamayı yeniden deneyebilirsin.
                        </Text>

                        <View style={styles.codeBadge}>
                            <Text style={styles.codeText}>{shortCode}</Text>
                        </View>

                        <Text style={styles.errorText} numberOfLines={4}>
                            {errorMessage}
                        </Text>

                        <Pressable
                            onPress={this.handleReset}
                            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                        >
                            <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
                            <Text style={styles.buttonText}>Uygulamayı Yeniden Dene</Text>
                        </Pressable>
                    </View>
                </View>
            );
        }

        return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
    }
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#F4F7FB',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: 22,
        paddingVertical: 24,
        borderWidth: 1,
        borderColor: 'rgba(0, 102, 204, 0.10)',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 4,
        alignItems: 'center',
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 102, 204, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    message: {
        marginTop: 10,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
        color: '#6B7280',
        textAlign: 'center',
    },
    codeBadge: {
        marginTop: 16,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: '#EEF4FF',
        borderWidth: 1,
        borderColor: 'rgba(0, 102, 204, 0.14)',
    },
    codeText: {
        color: serviceBlue,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    errorText: {
        marginTop: 14,
        fontSize: 13,
        lineHeight: 19,
        color: '#374151',
        textAlign: 'center',
    },
    button: {
        marginTop: 20,
        minHeight: 48,
        paddingHorizontal: 18,
        borderRadius: 14,
        backgroundColor: serviceBlue,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        alignSelf: 'stretch',
    },
    buttonPressed: {
        opacity: 0.85,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: -0.1,
    },
});

export default AppErrorBoundary;
