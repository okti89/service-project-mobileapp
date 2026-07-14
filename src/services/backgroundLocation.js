import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

const BACKGROUND_LOCATION_TASK = 'background-location-task';
const LAST_LOCATION_META_KEY = 'last_location_sent_meta';
const MIN_SEND_INTERVAL_MS = 1000 * 60 * 10; // 10 dakika
const MIN_SEND_DISTANCE_METERS = 1000; // 1 kilometre
const MIN_RECEIVED_LOG_INTERVAL_MS = 1000 * 60; // 1 dakika

let isSendingInProgress = false;
let lastReceivedLogAt = 0;

function isMissingBackgroundTaskError(error) {
    const message = String(error?.message || error || '');
    return message.includes('TaskNotFoundException') || /task .* not found/i.test(message);
}

async function sendLocationToBackend(latitude, longitude) {
    try {
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) {
            console.log('[BG Location] No auth token, skipping.');
            return;
        }

        let addressString = '';
        try {
            const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (geocode && geocode.length > 0) {
                const addr = geocode[0];
                const parts = [];
                if (addr.city || addr.subregion) parts.push(addr.city || addr.subregion);
                if (addr.district) parts.push(addr.district);
                if (addr.name) parts.push(addr.name);
                if (addr.street && addr.street !== addr.name) parts.push(addr.street);
                addressString = parts.filter(Boolean).join(', ');
            }
        } catch (geocodeErr) {
            console.log('[BG Location] Reverse geocode err:', geocodeErr);
        }

        await api.post(
            ENDPOINTS.TECHNICIAN.LOCATION_PING,
            {
                latitude,
                longitude,
                location: addressString || `${latitude}, ${longitude}`,
            }
        );
        console.log('[BG Location] Location sent to backend.');
    } catch (error) {
        console.log('[BG Location] Failed to send location:', error?.response?.data || error.message);
    }
}

function distanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function shouldSendLocation(latitude, longitude) {
    try {
        const raw = await AsyncStorage.getItem(LAST_LOCATION_META_KEY);
        if (!raw) return true;
        const prev = JSON.parse(raw);
        const now = Date.now();
        const elapsed = now - Number(prev?.ts || 0);
        const moved = distanceMeters(
            Number(prev?.latitude || 0),
            Number(prev?.longitude || 0),
            latitude,
            longitude
        );
        return elapsed >= MIN_SEND_INTERVAL_MS || moved >= MIN_SEND_DISTANCE_METERS;
    } catch {
        return true;
    }
}

async function markLocationSent(latitude, longitude) {
    const payload = {
        latitude,
        longitude,
        ts: Date.now(),
    };
    await AsyncStorage.setItem(LAST_LOCATION_META_KEY, JSON.stringify(payload));
}

export async function sendCurrentLocationNow() {
    if (isSendingInProgress) return;
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            console.log('[BG Location] Foreground permission denied for instant send.');
            return;
        }

        const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = current.coords || {};
        if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
        if (!(await shouldSendLocation(latitude, longitude))) return;
        isSendingInProgress = true;
        try {
            await sendLocationToBackend(latitude, longitude);
            await markLocationSent(latitude, longitude);
        } finally {
            isSendingInProgress = false;
        }
    } catch (error) {
        console.log('[BG Location] Instant send failed:', error?.message || error);
    }
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
        console.error('[BG Location] Task error:', error.message);
        return;
    }
    if (data) {
        const { locations } = data;
        if (locations && locations.length > 0) {
            const { latitude, longitude } = locations[0].coords;
            const now = Date.now();
            if (now - lastReceivedLogAt >= MIN_RECEIVED_LOG_INTERVAL_MS) {
                console.log(`[BG Location] Received: ${latitude}, ${longitude}`);
                lastReceivedLogAt = now;
            }

            if (isSendingInProgress) return;
            if (!(await shouldSendLocation(latitude, longitude))) return;

            isSendingInProgress = true;
            try {
                await sendLocationToBackend(latitude, longitude);
                await markLocationSent(latitude, longitude);
            } finally {
                isSendingInProgress = false;
            }
        }
    }
});

export async function startBackgroundLocationTracking({ hasDisclosureConsent = false } = {}) {
    if (!hasDisclosureConsent) return false;
    try {
        const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        if (isRunning) {
            console.log('[BG Location] Already running, stopping first to apply new settings.');
            try {
                await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
            } catch (error) {
                if (!isMissingBackgroundTaskError(error)) throw error;
            }
        }

        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
            console.log('[BG Location] Foreground permission denied.');
            return;
        }

        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
            console.log('[BG Location] Background permission denied.');
            return;
        }

        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 0,
            timeInterval: 1000 * 60,
            deferredUpdatesInterval: 1000 * 60,
            deferredUpdatesDistance: 0,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
                notificationTitle: 'Servis Asistanı',
                notificationBody: 'Konum arka planda izleniyor.',
                notificationColor: '#4F46E5',
            },
        });

        await sendCurrentLocationNow();
        console.log('[BG Location] Background tracking started.');
        return true;
    } catch (error) {
        console.error('[BG Location] Failed to start:', error);
        return false;
    }
}

export async function stopBackgroundLocationTracking() {
    try {
        const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        if (isRunning) {
            try {
                await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
                console.log('[BG Location] Background tracking stopped.');
            } catch (error) {
                if (isMissingBackgroundTaskError(error)) return;
                throw error;
            }
        }
    } catch (error) {
        if (isMissingBackgroundTaskError(error)) return;
        console.error('[BG Location] Failed to stop:', error);
    }
}

export { BACKGROUND_LOCATION_TASK };
