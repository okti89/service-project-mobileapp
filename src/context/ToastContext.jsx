import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

const ToastContext = createContext();

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

const TYPE_META = {
    success: { color: '#16A34A', icon: 'check' },
    error: { color: '#DC2626', icon: 'close' },
    warning: { color: '#F59E0B', icon: 'alert-circle-outline' },
    info: { color: '#0284C7', icon: 'information' },
};

export const ToastProvider = ({ children }) => {
    const { colors, isDark } = useTheme();
    const [toastConfig, setToastConfig] = useState(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateYAnim = useRef(new Animated.Value(-20)).current;
    const timerRef = useRef(null);

    const hideToast = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.timing(translateYAnim, {
                toValue: -20,
                duration: 220,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setToastConfig(null);
        });
    }, [fadeAnim, translateYAnim]);

    const showToast = useCallback((type = 'success', title, message, duration = 3000) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        setToastConfig({ type, title, message });
        fadeAnim.setValue(0);
        translateYAnim.setValue(-20);

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 260,
                useNativeDriver: true,
            }),
            Animated.spring(translateYAnim, {
                toValue: 0,
                friction: 7,
                tension: 80,
                useNativeDriver: true,
            }),
        ]).start();

        timerRef.current = setTimeout(() => {
            hideToast();
        }, duration);
    }, [fadeAnim, translateYAnim, hideToast]);

    useEffect(() => () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
    }, []);

    const meta = TYPE_META[toastConfig?.type] || TYPE_META.info;

    // Stabil context value: aksi halde `useToast` her render'da yeni referans
    // dondurur, bunu kullanan `useCallback`'ler surekli yeniden olusur ve
    // `useEffect(() => { fetchX(); }, [fetchX])` gibi desenler sonsuz API
    // isteklerine yol acar (ornek: ServiceListScreen sonsuz liste cekme).
    const contextValue = useMemo(() => ({ showToast, hideToast }), [showToast, hideToast]);

    return (
        <ToastContext.Provider value={contextValue}>
            {children}
            <View pointerEvents="box-none" style={styles.overlay}>
                {toastConfig ? (
                    <Animated.View
                        pointerEvents="box-none"
                        style={[
                            styles.toastContainer,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: translateYAnim }],
                                backgroundColor: isDark ? '#111827' : '#FFFFFF',
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <TouchableOpacity activeOpacity={0.95} onPress={hideToast} style={styles.toastInner}>
                            <View style={[styles.iconContainer, { backgroundColor: meta.color }]}>
                                <MaterialCommunityIcons name={meta.icon} size={20} color="#FFFFFF" />
                            </View>
                            <View style={styles.textContainer}>
                                <Text style={[styles.title, { color: colors.text }]}>{toastConfig.title}</Text>
                                {toastConfig.message ? (
                                    <Text style={[styles.message, { color: colors.textSecondary }]}>{toastConfig.message}</Text>
                                ) : null}
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                ) : null}
            </View>
        </ToastContext.Provider>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        justifyContent: 'flex-start',
    },
    toastContainer: {
        marginTop: 58,
        marginHorizontal: 18,
        borderRadius: 14,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 40,
    },
    toastInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    iconContainer: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: '800',
    },
    message: {
        fontSize: 13,
        lineHeight: 18,
        marginTop: 2,
    },
});
