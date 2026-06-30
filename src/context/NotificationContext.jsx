import React, { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useAuth } from '@/context/AuthContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { navigationRef } from '@/navigation/navigationRef';

const NotificationContext = createContext();
const DEVICE_ID_KEY = 'device_id';

const toUnreadCount = (value) => {
    const count = Number(value || 0);
    return Number.isFinite(count) ? count : 0;
};

const refreshUnreadNotificationCount = async ({ fallbackCount = 0, fetchProfile } = {}) => {
    if (typeof fetchProfile !== 'function') {
        return toUnreadCount(fallbackCount);
    }

    try {
        const profile = await fetchProfile();
        return toUnreadCount(profile?.unread_notifications_count);
    } catch (error) {
        return toUnreadCount(fallbackCount);
    }
};

const getLocationPermissionGranted = async () => {
    try {
        const foreground = await Location.getForegroundPermissionsAsync();
        if (foreground?.status !== 'granted') {
            return false;
        }

        try {
            const background = await Location.getBackgroundPermissionsAsync();
            if (background?.status === 'denied') {
                return false;
            }
        } catch (error) {
            // Some platforms may not expose background permission separately.
        }

        return true;
    } catch (error) {
        return false;
    }
};

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        // Expo SDK guncel API
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export const NotificationProvider = ({ children }) => {
    const { userToken, userInfo } = useAuth();
    const [expoPushToken, setExpoPushToken] = useState('');
    const [deviceId, setDeviceId] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const [notification, setNotification] = useState(false);
    const notificationListener = useRef();
    const responseListener = useRef();

    const fetchUnreadCount = useCallback(async () => {
        const count = await refreshUnreadNotificationCount({
            fallbackCount: userInfo?.unread_notifications_count,
            fetchProfile: userToken
                ? async () => {
                    const response = await api.get(ENDPOINTS.AUTH.CHECK_AUTH);
                    return response?.data || null;
                }
                : null,
        });
        setUnreadCount(count);
        return count;
    }, [userInfo?.unread_notifications_count, userToken]);

    useEffect(() => {
        const initNotifications = async () => {
            // 1. Get or Generate Device ID
            let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
            if (!id) {
                id = Platform.OS === 'ios' ?
                    (Constants?.sessionId || Math.random().toString(36).substring(7)) :
                    (Constants?.installationId || Math.random().toString(36).substring(7));

                // Fallback for newer Expo versions where installationId might be deprecated
                if (!id || id === 'uuid' || id.length < 5) {
                    id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                }
                await AsyncStorage.setItem(DEVICE_ID_KEY, id);
            }
            setDeviceId(id);

            // 2. If user is logged in, register token and set initial unread count
            if (userToken) {
                const token = await registerForPushNotificationsAsync();
                if (token) {
                    const locationPermission = await getLocationPermissionGranted();
                    setExpoPushToken(token);
                    await sendTokenToBackend(token, id, true, locationPermission);
                }
                fetchUnreadCount();
            }
        };

        initNotifications();

        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            setNotification(notification);
            // Foreground bildiriminde check-auth refresh'i disaridan tetiklenir, burada local sayiyi koruyoruz.
            fetchUnreadCount();
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            console.log('Notification interaction data:', data);

            if (data?.screen) {
                // Navigate to specific screen if provided in data
                const params = data.params || {};
                if (data.related_id) {
                    params.id = data.related_id;
                }

                if (navigationRef.isReady()) {
                    navigationRef.navigate(data.screen, params);
                } else {
                    // If navigation not ready, wait a bit
                    setTimeout(() => {
                        navigationRef.navigate(data.screen, params);
                    }, 1000);
                }
            }
            fetchUnreadCount();
        });

        return () => {
            notificationListener.current?.remove();
            responseListener.current?.remove();
        };
    }, [userToken, userInfo?.unread_notifications_count]);

    const sendTokenToBackend = async (
        token,
        currentDeviceId,
        notificationPermission = true,
        locationPermission = false
    ) => {
        try {
            await api.post(ENDPOINTS.AUTH.REGISTER_DEVICE, {
                token: token,
                platform: Platform.OS,
                device_name: Device.deviceName || 'Bilinmeyen Cihaz',
                device_id: currentDeviceId || deviceId,
                location_permission: locationPermission,
                notification_permission: notificationPermission,
                is_active: true,
            });
        } catch (error) {
            console.error('Error registering push token:', error);
        }
    };

    async function registerForPushNotificationsAsync() {
        let token;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                console.log('Failed to get push token for push notification!');
                return;
            }

            try {
                // IMPORTANT: In Expo SDK 50+, projectId is required.
                const projectId =
                    Constants?.expoConfig?.extra?.eas?.projectId ||
                    Constants?.easConfig?.projectId;

                if (!projectId) {
                    console.error('Expo Push Notifications Error: projectId not found in app.json. Please ensure it is defined under expo.extra.eas.projectId');
                }

                token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
                console.log('🔔 EXPO PUSH TOKEN:', token);
            } catch (e) {
                console.warn('Error getting push token:', e);
            }
        } else {
            console.log('Must use physical device for Push Notifications');
        }

        return token;
    }

    return (
        <NotificationContext.Provider value={{ expoPushToken, notification, unreadCount, updateUnreadCount: fetchUnreadCount }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    return useContext(NotificationContext);
};
