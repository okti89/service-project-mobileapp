import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { AppState, DeviceEventEmitter, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import authService from '@/services/authService';
import {
    sendCurrentLocationNow,
    startBackgroundLocationTracking,
    stopBackgroundLocationTracking,
} from '../services/backgroundLocation';

const AuthContext = createContext(null);

const ONBOARDING_VERSION = 'v1';
const ONBOARDING_VERSION_KEY = 'onboarding_version_seen';
const TENANT_CODE_KEY = 'tenant_code';
const AUTH_CHECK_TIMEOUT_MS = 4000;
const EMPTY_PERMISSIONS = Object.freeze({});
const LocationDisclosureModal = ({ visible, onAccept, onDecline }) => (
    <Modal
        animationType="fade"
        transparent
        visible={visible}
        onRequestClose={onDecline}
    >
        <View style={styles.modalOverlay}>
            <View style={styles.disclosureCard}>
                <View style={styles.disclosureIcon}>
                    <MaterialCommunityIcons name="map-marker-radius-outline" size={28} color="#1D4ED8" />
                </View>
                <Text style={styles.disclosureTitle}>Arka plan konum izni</Text>
                <Text style={styles.disclosureText}>
                    Canlı takip için konumunuz, uygulama arka plandayken de aktif mesai boyunca güncellenir.
                </Text>
                <Text style={styles.disclosureText}>
                    Açılacak izin ekranında “Her zaman izin ver” seçeneğini kullanın. Bu izin verilmezse mesainizi canlı takip olmadan başlatabilirsiniz.
                </Text>
                <View style={styles.disclosureNote}>
                    <MaterialCommunityIcons name="information-outline" size={18} color="#475569" />
                    <Text style={styles.disclosureNoteText}>Mesai bittiğinde arka plan takibi otomatik olarak durur.</Text>
                </View>
                <View style={styles.disclosureActions}>
                    <Pressable onPress={onDecline} style={styles.secondaryAction}>
                        <Text style={styles.secondaryActionText}>Şimdi değil</Text>
                    </Pressable>
                    <Pressable onPress={onAccept} style={styles.primaryAction}>
                        <Text style={styles.primaryActionText}>Arka Plan İznini Aç</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    </Modal>
);

const formatDateForApi = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const persistTenantCode = async (tenantCode) => {
    const resolved = String(tenantCode || '').trim().toLowerCase();
    if (resolved) {
        await AsyncStorage.setItem(TENANT_CODE_KEY, resolved);
    } else {
        await AsyncStorage.removeItem(TENANT_CODE_KEY);
    }
};

const clearStoredSession = async () => {
    await Promise.all([
        AsyncStorage.removeItem('auth_token'),
        AsyncStorage.removeItem('user_info'),
        AsyncStorage.removeItem(TENANT_CODE_KEY),
    ]);
};

const withTimeout = (promise, ms) =>
    Promise.race([
        promise,
        new Promise((_, reject) => {
            const timer = setTimeout(() => {
                clearTimeout(timer);
                reject(new Error('AUTH_CHECK_TIMEOUT'));
            }, ms);
        }),
    ]);

export const AuthProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [userToken, setUserToken] = useState(null);
    const [userInfo, setUserInfo] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isFirstLaunch, setIsFirstLaunch] = useState(true);
    const [isLocationDisclosureVisible, setIsLocationDisclosureVisible] = useState(false);

    const syncingRef = useRef(false);
    const pendingLocationConsentRef = useRef(false);
    const locationTrackingVersionRef = useRef(0);
    const authHydratedRef = useRef(false);
    const locationDisclosureResolverRef = useRef(null);

    const resolveLocationDisclosure = useCallback((accepted) => {
        setIsLocationDisclosureVisible(false);
        locationDisclosureResolverRef.current?.(accepted);
        locationDisclosureResolverRef.current = null;
    }, []);

    const showLocationDisclosure = useCallback(() => new Promise((resolve) => {
        locationDisclosureResolverRef.current = resolve;
        setIsLocationDisclosureVisible(true);
    }), []);

    useEffect(() => () => {
        locationDisclosureResolverRef.current?.(false);
    }, []);

    const applyAuthState = useCallback(({ token = null, user = null, loggedIn = false }) => {
        setUserToken(token);
        setUserInfo(user);
        setIsLoggedIn(Boolean(loggedIn && token && user));
    }, []);

    const isAdmin = Boolean(
        userInfo?.is_admin || userInfo?.user_type === 'admin'
    );

    const isTechnician = Boolean(
        !isAdmin && (userInfo?.is_technician || userInfo?.user_type === 'technician')
    );
    const canTrackLocationAsTechnician = Boolean(
        isAdmin || userInfo?.is_technician || userInfo?.user_type === 'technician' || userInfo?.technician_profile_id
    );

    const mobilePermissions = userInfo?.mobile_permissions || EMPTY_PERMISSIONS;
    const shouldShowOnboarding = !isLoggedIn && isFirstLaunch;

    const hasActiveShiftToday = useCallback(async () => {
        try {
            const todayStr = formatDateForApi();
            const response = await api.get(ENDPOINTS.TECHNICIAN.SHIFTS, {
                params: {
                    start_date: todayStr,
                    end_date: todayStr,
                },
            });

            const shifts = Array.isArray(response?.data) ? response.data : [];
            return shifts.some((shift) => shift && shift.start_time && !shift.end_time);
        } catch (error) {
            console.log(
                'Failed to check active shift:',
                error?.response?.data || error?.message || error
            );
            return false;
        }
    }, []);

    const requestBackgroundLocationConsent = useCallback(async () => {
        const backgroundPermission = await Location.getBackgroundPermissionsAsync();
        if (backgroundPermission.status === 'granted') return true;

        const accepted = await showLocationDisclosure();
        if (!accepted) return false;

        const requestedPermission = await Location.requestBackgroundPermissionsAsync();
        return requestedPermission.status === 'granted';
    }, [showLocationDisclosure]);
    const hasLocationTrackingPermissions = useCallback(async () => {
        const [foregroundPermission, backgroundPermission] = await Promise.all([
            Location.getForegroundPermissionsAsync(),
            Location.getBackgroundPermissionsAsync(),
        ]);
        return foregroundPermission.status === 'granted' && backgroundPermission.status === 'granted';
    }, []);

    const ensureLocationTrackingPermissions = useCallback(async () => {
        let foregroundPermission = await Location.getForegroundPermissionsAsync();
        if (foregroundPermission.status !== 'granted') {
            foregroundPermission = await Location.requestForegroundPermissionsAsync();
        }
        if (foregroundPermission.status !== 'granted') return false;

        return requestBackgroundLocationConsent();
    }, [requestBackgroundLocationConsent]);
    const syncLocationTrackingByShift = useCallback(async ({ requestConsent = false, forceStop = false } = {}) => {
        if (forceStop) {
            // A pending start must not restart tracking after the shift has ended.
            locationTrackingVersionRef.current += 1;
            pendingLocationConsentRef.current = false;
            await stopBackgroundLocationTracking();
            return;
        }

        if (syncingRef.current) {
            pendingLocationConsentRef.current = pendingLocationConsentRef.current || requestConsent;
            return;
        }

        syncingRef.current = true;
        const trackingVersion = locationTrackingVersionRef.current;
        try {
            if (!isLoggedIn || !canTrackLocationAsTechnician) {
                await stopBackgroundLocationTracking();
                return;
            }

            const isShiftRunning = await hasActiveShiftToday();
            if (trackingVersion !== locationTrackingVersionRef.current) return;

            if (isShiftRunning) {
                const hasTrackingPermissions = requestConsent
                    ? await ensureLocationTrackingPermissions()
                    : await hasLocationTrackingPermissions();
                if (trackingVersion !== locationTrackingVersionRef.current) return;

                if (hasTrackingPermissions) {
                    await startBackgroundLocationTracking();
                    await sendCurrentLocationNow();
                }
            } else {
                await stopBackgroundLocationTracking();
            }
        } catch (error) {
            console.log(
                'Failed to sync location tracking by shift:',
                error?.response?.data || error?.message || error
            );
        } finally {
            syncingRef.current = false;
            if (pendingLocationConsentRef.current) {
                pendingLocationConsentRef.current = false;
                void syncLocationTrackingByShift({ requestConsent: true });
            }
        }
    }, [canTrackLocationAsTechnician, ensureLocationTrackingPermissions, hasActiveShiftToday, hasLocationTrackingPermissions, isLoggedIn]);

    const register = useCallback(async (
        email,
        password,
        phone_number,
        first_name,
        last_name,
        avatar,
        tenant_code
    ) => {
        try {
            const data = await authService.register({
                email,
                password,
                phone_number,
                first_name,
                last_name,
                avatar,
                tenant_code,
            });

            if (!data?.token || !data?.user) {
                return {
                    success: false,
                    error: 'Bir sorun olustu. Lutfen tekrar deneyin.',
                };
            }

            await Promise.all([
                AsyncStorage.setItem('auth_token', data.token),
                AsyncStorage.setItem('user_info', JSON.stringify(data.user)),
                persistTenantCode(data?.user?.tenant_code || tenant_code),
                AsyncStorage.setItem('saved_email', email),
                AsyncStorage.setItem('saved_password', password),
            ]);

            applyAuthState({
                token: data.token,
                user: data.user,
                loggedIn: true,
            });

            return { success: true };
        } catch (error) {
            console.error('Register error:', error?.response?.data || error?.message);
            const data = error?.response?.data || {};
            return {
                success: false,
                error:
                    data?.non_field_errors?.[0] ||
                    data?.detail ||
                    'Bir sorun olustu. Lutfen tekrar deneyin.',
                fieldErrors: data,
            };
        }
    }, [applyAuthState]);

    const login = useCallback(async (email, password) => {
        try {
            const data = await authService.login(email, password);

            if (!data?.token || !data?.user) {
                return {
                    success: false,
                    error: 'Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.',
                };
            }

            await Promise.all([
                AsyncStorage.setItem('auth_token', data.token),
                AsyncStorage.setItem('user_info', JSON.stringify(data.user)),
                persistTenantCode(data?.user?.tenant_code),
                AsyncStorage.setItem('saved_email', email),
                AsyncStorage.setItem('saved_password', password),
            ]);

            applyAuthState({
                token: data.token,
                user: data.user,
                loggedIn: true,
            });

            return { success: true };
        } catch (error) {
            console.error('Login error:', error?.response?.data || error?.message);
            const data = error?.response?.data || {};
            return {
                success: false,
                error:
                    data?.non_field_errors?.[0] ||
                    data?.detail ||
                    'Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.',
                fieldErrors: data,
            };
        }
    }, [applyAuthState]);

    const logout = useCallback(async () => {
        try {
            await stopBackgroundLocationTracking();

            try {
                await authService.logout();
            } catch (error) {
                const status = error?.response?.status;
                // 401/403 beklenen senaryolar (token zaten geçersiz);
                // sadece beklenmeyen hataları uyarı olarak logluyoruz.
                if (status !== 401 && status !== 403) {
                    console.warn('Logout sırasında beklenmeyen hata:', status, error?.message);
                }
            }
            finally {
                await clearStoredSession();
                applyAuthState({ token: null, user: null, loggedIn: false });
            }
        } catch (error) {
            console.warn('Logout sırasında beklenmeyen hata:', error?.message);
        }
    }, [applyAuthState]);

    const deleteAccount = useCallback(async (password) => {
        await stopBackgroundLocationTracking();
        await authService.deleteAccount(password);
        await clearStoredSession();
        applyAuthState({ token: null, user: null, loggedIn: false });
    }, [applyAuthState]);

    const checkAuth = useCallback(async ({ silent = false } = {}) => {
        if (!silent) {
            setIsLoading(true);
        }

        try {
            const [token, storedUserInfo, seenVersion] = await Promise.all([
                AsyncStorage.getItem('auth_token'),
                AsyncStorage.getItem('user_info'),
                AsyncStorage.getItem(ONBOARDING_VERSION_KEY),
            ]);

            const parsedStoredUser = storedUserInfo ? JSON.parse(storedUserInfo) : null;
            setIsFirstLaunch(seenVersion !== ONBOARDING_VERSION);

            if (!token) {
                applyAuthState({ token: null, user: null, loggedIn: false });
                return { kind: 'logged-out' };
            }

            if (parsedStoredUser?.id) {
                applyAuthState({
                    token,
                    user: parsedStoredUser,
                    loggedIn: true,
                });
            }

            try {
                const response = await withTimeout(
                    api.get(ENDPOINTS.AUTH.CHECK_AUTH),
                    AUTH_CHECK_TIMEOUT_MS
                );

                if (response?.data?.id) {
                    await Promise.all([
                        AsyncStorage.setItem('user_info', JSON.stringify(response.data)),
                        persistTenantCode(response?.data?.tenant_code),
                    ]);

                    applyAuthState({
                        token,
                        user: response.data,
                        loggedIn: true,
                    });
                    return { kind: 'active' };
                }

                throw new Error('Invalid auth response');
            } catch (verifyError) {
                const status = verifyError?.response?.status;
                const accountStatus = verifyError?.response?.data?.account_status;
                const isTimeout = verifyError?.message === 'AUTH_CHECK_TIMEOUT';

                if (isTimeout && parsedStoredUser?.id) {
                    console.log('Auth verify timeout, using cached session fallback.');
                    return { kind: 'cached' };
                }

                if (status === 403 && accountStatus && parsedStoredUser?.id) {
                    const gatedUser = {
                        ...parsedStoredUser,
                        approval_status: accountStatus === 'pending' ? 'pending' : accountStatus === 'rejected' ? 'rejected' : parsedStoredUser.approval_status,
                        is_active: accountStatus === 'deactivated' ? false : parsedStoredUser.is_active,
                        subscription: verifyError?.response?.data?.subscription || parsedStoredUser.subscription,
                    };
                    await AsyncStorage.setItem('user_info', JSON.stringify(gatedUser));
                    applyAuthState({ token, user: gatedUser, loggedIn: true });
                    return { kind: accountStatus };
                }

                if (status === 401 || status === 403 || !parsedStoredUser?.id) {
                    console.log(
                        'Token verification failed:',
                        verifyError?.response?.data || verifyError?.message
                    );
                    await clearStoredSession();
                    applyAuthState({ token: null, user: null, loggedIn: false });
                    return { kind: 'logged-out' };
                }
            }
        } catch (error) {
            console.error('Check auth error:', error);
            applyAuthState({ token: null, user: null, loggedIn: false });
            return { kind: 'logged-out' };
        } finally {
            authHydratedRef.current = true;
            setIsLoading(false);
        }
    }, [applyAuthState]);

    const completeOnboarding = useCallback(async () => {
        try {
            await AsyncStorage.setItem(ONBOARDING_VERSION_KEY, ONBOARDING_VERSION);
            setIsFirstLaunch(false);
        } catch (error) {
            console.error('Error saving onboarding status:', error);
        }
    }, []);

    useEffect(() => {
        checkAuth();

        const sub = DeviceEventEmitter.addListener('generic_401_error', async () => {
            console.log('401 Unauthorized intercepted, logging out...');
            await logout();
        });

        return () => sub.remove();
    }, [checkAuth, logout]);

    useEffect(() => {
        if (!authHydratedRef.current) return;
        syncLocationTrackingByShift();
    }, [syncLocationTrackingByShift]);

    // Track online/offline status and tie location tracking to active shift.
    useEffect(() => {
        let appStateSubscription = null;

        const handleAppStateChange = async (nextAppState) => {
            if (isLoggedIn && canTrackLocationAsTechnician) {
                try {
                    const isOnline = nextAppState === 'active';
                    await api.post(ENDPOINTS.TECHNICIAN.STATUS, { is_online: isOnline });
                    if (isOnline) {
                        await syncLocationTrackingByShift();
                        // Android may apply a settings-screen permission change after the activity resumes.
                        setTimeout(() => {
                            void syncLocationTrackingByShift();
                        }, 900);

                    }
                } catch (error) {
                    console.log('Failed to update online status:', error);
                }
            }
        };

        if (isLoggedIn && canTrackLocationAsTechnician) {
            // Set online status immediately
            handleAppStateChange(AppState.currentState);
            appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
        } else {
            // Not logged in or not technician — ensure background location is stopped
            stopBackgroundLocationTracking();
        }

        return () => {
            if (appStateSubscription) {
                appStateSubscription.remove();
            }
        };
    }, [canTrackLocationAsTechnician, isLoggedIn, syncLocationTrackingByShift]);

    const value = useMemo(() => ({
        isLoading,
        userToken,
        userInfo,
        isLoggedIn,
        isFirstLaunch,
        shouldShowOnboarding,
        isAdmin,
        isTechnician,
        canTrackLocationAsTechnician,
        mobilePermissions,
        login,
        register,
        logout,
        deleteAccount,
        checkAuth,
        completeOnboarding,
        ensureLocationTrackingPermissions,
        hasLocationTrackingPermissions,
        syncLocationTrackingByShift,
    }), [
        checkAuth,
        completeOnboarding,
        ensureLocationTrackingPermissions,
        hasLocationTrackingPermissions,
        isAdmin,
        canTrackLocationAsTechnician,
        isFirstLaunch,
        isLoading,
        isLoggedIn,
        isTechnician,
        login,
        logout,
        deleteAccount,
        mobilePermissions,
        register,
        shouldShowOnboarding,
        syncLocationTrackingByShift,
        userInfo,
        userToken,
    ]);

    return (
        <AuthContext.Provider value={value}>
            {children}
            <LocationDisclosureModal
                visible={isLocationDisclosureVisible}
                onAccept={() => resolveLocationDisclosure(true)}
                onDecline={() => resolveLocationDisclosure(false)}
            />
        </AuthContext.Provider>
    );
};

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.56)', padding: 24 },
    disclosureCard: { width: '100%', maxWidth: 440, backgroundColor: '#FFFFFF', borderRadius: 26, padding: 24, paddingBottom: 18 },
    disclosureIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DBEAFE', marginBottom: 16 },
    disclosureTitle: { color: '#0F172A', fontSize: 21, fontWeight: '800', letterSpacing: -0.35, marginBottom: 10 },
    disclosureText: { color: '#475569', fontSize: 15, lineHeight: 22, marginBottom: 10 },
    disclosureNote: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 12, marginTop: 4 },
    disclosureNoteText: { flex: 1, color: '#475569', fontSize: 13, lineHeight: 18, fontWeight: '600' },
    disclosureActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
    secondaryAction: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 13, backgroundColor: '#F1F5F9' },
    secondaryActionText: { color: '#334155', fontSize: 15, fontWeight: '800' },
    primaryAction: { flex: 1.2, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 13, backgroundColor: '#2563EB' },
    primaryActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};