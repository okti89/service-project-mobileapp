import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
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

    const syncingRef = useRef(false);
    const authHydratedRef = useRef(false);

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

    const syncLocationTrackingByShift = useCallback(async () => {
        if (syncingRef.current) return;

        syncingRef.current = true;
        try {
            if (!isLoggedIn || !canTrackLocationAsTechnician) {
                await stopBackgroundLocationTracking();
                return;
            }

            const isShiftRunning = await hasActiveShiftToday();
            if (isShiftRunning) {
                await startBackgroundLocationTracking();
                await sendCurrentLocationNow();
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
        }
    }, [canTrackLocationAsTechnician, hasActiveShiftToday, isLoggedIn]);

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
                return;
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
                    return;
                }

                throw new Error('Invalid auth response');
            } catch (verifyError) {
                const status = verifyError?.response?.status;
                const isTimeout = verifyError?.message === 'AUTH_CHECK_TIMEOUT';

                if (isTimeout && parsedStoredUser?.id) {
                    console.log('Auth verify timeout, using cached session fallback.');
                    return;
                }

                if (status === 401 || status === 403 || !parsedStoredUser?.id) {
                    console.log(
                        'Token verification failed:',
                        verifyError?.response?.data || verifyError?.message
                    );
                    await clearStoredSession();
                    applyAuthState({ token: null, user: null, loggedIn: false });
                }
            }
        } catch (error) {
            console.error('Check auth error:', error);
            applyAuthState({ token: null, user: null, loggedIn: false });
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
                    } else {
                        await stopBackgroundLocationTracking();
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
        checkAuth,
        completeOnboarding,
        syncLocationTrackingByShift,
    }), [
        checkAuth,
        completeOnboarding,
        isAdmin,
        canTrackLocationAsTechnician,
        isFirstLaunch,
        isLoading,
        isLoggedIn,
        isTechnician,
        login,
        logout,
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
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
