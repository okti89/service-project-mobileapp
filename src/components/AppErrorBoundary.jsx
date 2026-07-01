import React from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
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

    const rawMessage = error?.message || 'UNKNOWN';
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
        this.setState({
            hasError: false,
            error: null,
        });
    };

    render() {
        if (this.state.hasError) {
            const errorMessage = this.state.error?.message
                ? String(this.state.error.message)
                : 'Beklenmeyen bir hata olustu.';
            const shortCode = `ERR_APP_${getErrorCode(this.state.error)}`;

            return (
                <View style={styles.screen}>
                    <View style={styles.content}>
                        <View style={styles.illustrationWrap}>
                            <View style={styles.illustrationCircle}>
                                <MaterialCommunityIcons name="tools" size={38} color={serviceBlue} />
                            </View>
                            <View style={styles.alertBadge}>
                                <MaterialCommunityIcons name="alert-circle" size={18} color="#FFFFFF" />
                            </View>
                        </View>

                        <Text style={styles.title}>Beklenmedik Bir Durum{'\n'}Olustu</Text>
                        <Text style={styles.message}>
                            Sistemde gecici bir aksaklik yasaniyor. Endiselenmeyin, verileriniz guvende. Sayfayi yenilemeyi veya ana ekrana donmeyi deneyebilirsiniz.
                        </Text>

                        <View style={styles.actions}>
                            <Pressable onPress={this.handleReset} style={styles.primaryButton}>
                                <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
                                <Text style={styles.primaryButtonText}>Sayfayi Yenile</Text>
                            </Pressable>

                            <Pressable onPress={this.handleReset} style={styles.secondaryButton}>
                                <MaterialCommunityIcons name="view-dashboard-outline" size={18} color={serviceBlue} />
                                <Text style={styles.secondaryButtonText}>Dashboard'a Don</Text>
                            </Pressable>
                        </View>

                        <View style={styles.footer}>
                            <Text style={styles.supportText}>
                                Sorun devam ederse <Text style={styles.supportLink}>teknik destek ekibiyle</Text> iletisime gecin.
                            </Text>
                            <Text style={styles.errorCode}>Hata Kodu: {shortCode}</Text>
                            <Text style={styles.hiddenDetail} numberOfLines={2}>
                                {errorMessage}
                            </Text>
                        </View>
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#F7F9FE',
        justifyContent: 'center',
    },
    content: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 32,
    },
    illustrationWrap: {
        width: 96,
        height: 96,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
    },
    illustrationCircle: {
        width: 82,
        height: 82,
        borderRadius: 41,
        backgroundColor: '#EEF4FF',
        borderWidth: 1,
        borderColor: '#D8E4FA',
        alignItems: 'center',
        justifyContent: 'center',
    },
    alertBadge: {
        position: 'absolute',
        top: 10,
        right: 6,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#D71919',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#081F5C',
        marginBottom: 10,
        textAlign: 'center',
        lineHeight: 28,
    },
    message: {
        fontSize: 15,
        lineHeight: 23,
        color: '#3F4655',
        textAlign: 'center',
        maxWidth: 360,
    },
    actions: {
        width: '100%',
        maxWidth: 360,
        marginTop: 24,
        gap: 10,
    },
    primaryButton: {
        minHeight: 52,
        borderRadius: 14,
        backgroundColor: serviceBlue,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    secondaryButton: {
        minHeight: 50,
        borderRadius: 14,
        backgroundColor: '#F4F7FF',
        borderWidth: 1,
        borderColor: '#D8E4FA',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    secondaryButtonText: {
        color: serviceBlue,
        fontSize: 15,
        fontWeight: '700',
    },
    footer: {
        width: '100%',
        maxWidth: 360,
        marginTop: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#D8E0EF',
        alignItems: 'center',
    },
    supportText: {
        fontSize: 14,
        lineHeight: 22,
        color: '#6B7280',
        textAlign: 'center',
        fontWeight: '600',
    },
    supportLink: {
        color: serviceBlue,
        fontWeight: '800',
    },
    errorCode: {
        marginTop: 16,
        fontSize: 12,
        color: '#A0A7B6',
        fontWeight: '600',
    },
    hiddenDetail: {
        marginTop: 8,
        fontSize: 11,
        color: '#C0C6D4',
    },
});

export default AppErrorBoundary;
