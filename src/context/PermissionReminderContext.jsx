import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';

import { useAuth } from '@/context/AuthContext';
import PermissionModal from '@/components/PermissionModal';

const PermissionReminderContext = createContext(null);

const STORAGE_KEY = 'permission_reminder_state_v1';
const REMINDER_MODAL_KEY = 'permission_reminder_modal_open_v1';

// Reminder cadence (ms)
const FIRST_REMINDER_DELAY_MS = 60 * 1000; // 1 minute after first eligible state
const RECHECK_INTERVAL_MS = 60 * 1000; // 1 minute scheduler tick
const MIN_GAP_BETWEEN_MODALS_MS = 30 * 1000; // do not spam two modals within 30s
const REMIND_AGAIN_AFTER_MS = 6 * 60 * 60 * 1000; // 6 hours after dismiss

const PERMISSION_STATES = {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
};

const DEFAULT_STATE = {
    dismissedForever: { notification: false, location: false },
    lastDismissedAt: { notification: 0, location: 0 },
    lastCheckedAt: 0,
};

const readStoredState = async () => {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_STATE;
        const parsed = JSON.parse(raw);
        return {
            dismissedForever: {
                notification: Boolean(parsed?.dismissedForever?.notification),
                location: Boolean(parsed?.dismissedForever?.location),
            },
            lastDismissedAt: {
                notification: Number(parsed?.lastDismissedAt?.notification || 0),
                location: Number(parsed?.lastDismissedAt?.location || 0),
            },
            lastCheckedAt: Number(parsed?.lastCheckedAt || 0),
        };
    } catch (e) {
        return DEFAULT_STATE;
    }
};

const writeStoredState = async (state) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        // ignore
    }
};

const checkNotificationStatus = async () => {
    try {
        const settings = await Notifications.getPermissionsAsync();
        if (settings?.status === 'granted') return PERMISSION_STATES.GRANTED;
        if (settings?.status === 'denied') return PERMISSION_STATES.DENIED;
        return PERMISSION_STATES.UNDETERMINED;
    } catch (e) {
        return PERMISSION_STATES.UNDETERMINED;
    }
};

const checkLocationStatus = async () => {
    try {
        const fg = await Location.getForegroundPermissionsAsync();
        if (fg?.status === 'denied') return PERMISSION_STATES.DENIED;
        if (fg?.status === 'granted') {
            // Foreground granted; check background too
            try {
                const bg = await Location.getBackgroundPermissionsAsync();
                if (bg?.status === 'denied') return PERMISSION_STATES.DENIED;
            } catch (e) {
                // ignore
            }
            return PERMISSION_STATES.GRANTED;
        }
        return PERMISSION_STATES.UNDETERMINED;
    } catch (e) {
        return PERMISSION_STATES.UNDETERMINED;
    }
};

const requestNotification = async () => {
    try {
        const result = await Notifications.requestPermissionsAsync();
        return result?.status === 'granted';
    } catch (e) {
        return false;
    }
};

const requestLocation = async () => {
    try {
        const fg = await Location.requestForegroundPermissionsAsync();
        if (fg?.status !== 'granted') return false;
        const bg = await Location.requestBackgroundPermissionsAsync();
        return bg?.status === 'granted';
    } catch (e) {
        return false;
    }
};

export const PermissionReminderProvider = ({ children }) => {
    const { isLoggedIn, canTrackLocationAsTechnician } = useAuth();

    const [stored, setStored] = useState(DEFAULT_STATE);
    const [notificationStatus, setNotificationStatus] = useState(PERMISSION_STATES.UNDETERMINED);
    const [locationStatus, setLocationStatus] = useState(PERMISSION_STATES.UNDETERMINED);
    const [activeModal, setActiveModal] = useState(null); // 'notification' | 'location' | null
    const [loadingAction, setLoadingAction] = useState(false);

    const stateRef = useRef(stored);
    const statusRef = useRef({ notification: notificationStatus, location: locationStatus });
    const modalOpenLockRef = useRef(false);
    const firstEligibleAtRef = useRef({ notification: 0, location: 0 });
    const lastModalShownAtRef = useRef(0);
    const tickIntervalRef = useRef(null);
    const appStateRef = useRef(AppState.currentState);

    // Load persisted preferences on mount
    useEffect(() => {
        (async () => {
            const s = await readStoredState();
            stateRef.current = s;
            setStored(s);
        })();
    }, []);

    // Keep refs in sync (avoid stale closures in tick)
    useEffect(() => {
        stateRef.current = stored;
    }, [stored]);

    useEffect(() => {
        statusRef.current = { notification: notificationStatus, location: locationStatus };
    }, [notificationStatus, locationStatus]);

    const refreshStatuses = useCallback(async () => {
        const [n, l] = await Promise.all([checkNotificationStatus(), checkLocationStatus()]);
        setNotificationStatus(n);
        setLocationStatus(l);
        statusRef.current = { notification: n, location: l };
        const next = { ...stateRef.current, lastCheckedAt: Date.now() };
        stateRef.current = next;
        setStored(next);
        await writeStoredState(next);
        return { n, l };
    }, []);

    // Initial status check + interval
    useEffect(() => {
        if (!isLoggedIn) {
            // No reminder when logged out
            setActiveModal(null);
            modalOpenLockRef.current = false;
            return;
        }

        refreshStatuses();

        tickIntervalRef.current = setInterval(() => {
            maybeShowReminder();
        }, RECHECK_INTERVAL_MS);

        // Also re-check on app foreground
        const sub = AppState.addEventListener('change', async (next) => {
            if (appStateRef.current !== 'active' && next === 'active') {
                await refreshStatuses();
                maybeShowReminder();
            }
            appStateRef.current = next;
        });

        return () => {
            if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
            sub.remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn]);

    const persistDismiss = useCallback(async (key, forever) => {
        const now = Date.now();
        const next = {
            ...stateRef.current,
            dismissedForever: { ...stateRef.current.dismissedForever, [key]: forever ? true : stateRef.current.dismissedForever[key] },
            lastDismissedAt: { ...stateRef.current.lastDismissedAt, [key]: now },
        };
        stateRef.current = next;
        setStored(next);
        await writeStoredState(next);
    }, []);

    const showModal = useCallback((which, options = {}) => {
        const { bypassLock = false } = options;
        if (modalOpenLockRef.current && !bypassLock) return false;
        const now = Date.now();
        if (!bypassLock && now - lastModalShownAtRef.current < MIN_GAP_BETWEEN_MODALS_MS) return false;
        modalOpenLockRef.current = true;
        lastModalShownAtRef.current = now;
        setActiveModal(which);
        AsyncStorage.setItem(REMINDER_MODAL_KEY, which).catch(() => { });
        return true;
    }, []);

    const closeModal = useCallback(() => {
        modalOpenLockRef.current = false;
        setActiveModal(null);
        AsyncStorage.removeItem(REMINDER_MODAL_KEY).catch(() => { });
    }, []);

    const maybeShowReminder = useCallback(() => {
        const current = stateRef.current;
        const status = statusRef.current;
        const now = Date.now();

        // Notification reminder
        const notifNeeded = status.notification !== PERMISSION_STATES.GRANTED;
        if (notifNeeded && !current.dismissedForever.notification) {
            if (!firstEligibleAtRef.current.notification) {
                firstEligibleAtRef.current.notification = now;
            }
            const sinceDismiss = now - (current.lastDismissedAt.notification || 0);
            if (sinceDismiss >= REMIND_AGAIN_AFTER_MS) {
                const sinceFirst = now - firstEligibleAtRef.current.notification;
                if (sinceFirst >= FIRST_REMINDER_DELAY_MS) {
                    if (showModal('notification')) {
                        return;
                    }
                }
            }
        } else {
            firstEligibleAtRef.current.notification = 0;
        }

        // Location reminder (only for technicians, since they need it for work)
        if (canTrackLocationAsTechnician) {
            const locNeeded = status.location !== PERMISSION_STATES.GRANTED;
            if (locNeeded && !current.dismissedForever.location) {
                if (!firstEligibleAtRef.current.location) {
                    firstEligibleAtRef.current.location = now;
                }
                const sinceDismiss = now - (current.lastDismissedAt.location || 0);
                if (sinceDismiss >= REMIND_AGAIN_AFTER_MS) {
                    const sinceFirst = now - firstEligibleAtRef.current.location;
                    if (sinceFirst >= FIRST_REMINDER_DELAY_MS) {
                        if (showModal('location')) return;
                    }
                }
            } else {
                firstEligibleAtRef.current.location = 0;
            }
        } else {
            firstEligibleAtRef.current.location = 0;
        }
    }, [canTrackLocationAsTechnician, showModal]);

    const handleAllow = useCallback(async () => {
        if (!activeModal) return;
        setLoadingAction(true);
        try {
            if (activeModal === 'notification') {
                const ok = await requestNotification();
                if (ok) {
                    await refreshStatuses();
                    closeModal();
                } else {
                    await refreshStatuses();
                }
            } else if (activeModal === 'location') {
                const ok = await requestLocation();
                if (ok) {
                    await refreshStatuses();
                    closeModal();
                } else {
                    await refreshStatuses();
                }
            }
        } finally {
            setLoadingAction(false);
        }
    }, [activeModal, closeModal, refreshStatuses]);

    const handleLater = useCallback(async () => {
        if (!activeModal) return;
        await persistDismiss(activeModal, false);
        closeModal();
    }, [activeModal, closeModal, persistDismiss]);

    const handleNever = useCallback(async () => {
        if (!activeModal) return;
        await persistDismiss(activeModal, true);
        closeModal();
    }, [activeModal, closeModal, persistDismiss]);

    const forceShow = useCallback((which) => {
        // Clear any active modal state first so dev preview always opens
        modalOpenLockRef.current = false;
        lastModalShownAtRef.current = 0;
        firstEligibleAtRef.current[which] = 0;
        return showModal(which, { bypassLock: true });
    }, [showModal]);

    const resetDismissed = useCallback(async () => {
        const next = { ...DEFAULT_STATE, lastCheckedAt: Date.now() };
        stateRef.current = next;
        setStored(next);
        await writeStoredState(next);
        firstEligibleAtRef.current = { notification: 0, location: 0 };
        // Also clear the modal open lock + last-shown timer so dev preview works immediately
        modalOpenLockRef.current = false;
        lastModalShownAtRef.current = 0;
        setActiveModal(null);
        await refreshStatuses();
    }, [refreshStatuses]);

    const value = useMemo(
        () => ({
            notificationStatus,
            locationStatus,
            activeModal,
            isModalOpen: Boolean(activeModal),
            isLoading: loadingAction,
            refreshStatuses,
            forceShow,
            resetDismissed,
            permissionStates: PERMISSION_STATES,
        }),
        [notificationStatus, locationStatus, activeModal, loadingAction, refreshStatuses, forceShow, resetDismissed]
    );

    return (
        <PermissionReminderContext.Provider value={value}>
            {children}
            <NotificationReminderModal
                visible={activeModal === 'notification'}
                onAllow={handleAllow}
                onLater={handleLater}
                onNever={handleNever}
                loading={loadingAction}
            />
            <LocationReminderModal
                visible={activeModal === 'location'}
                onAllow={handleAllow}
                onLater={handleLater}
                onNever={handleNever}
                loading={loadingAction}
            />
        </PermissionReminderContext.Provider>
    );
};

const NotificationReminderModal = ({ visible, onAllow, onLater, onNever, loading }) => (
    <PermissionModal
        visible={visible}
        icon="bell-ring-outline"
        iconColor="#F59E0B"
        title="Bildirimlere İzin Verin"
        description="Yeni iş atamaları, mesajlar ve önemli güncellemelerden anında haberdar olmak için bildirim iznini etkinleştirin."
        bullets={[
            {
                icon: 'briefcase-outline',
                title: 'Yeni iş atamaları',
                description: 'Size atanan servisler anında telefona düşer.',
            },
            {
                icon: 'message-text-outline',
                title: 'Mesajlar ve güncellemeler',
                description: 'Yönetici ve müşteri mesajlarını kaçırmazsınız.',
            },
            {
                icon: 'alarm-light-outline',
                title: 'Acil bildirimler',
                description: 'Acil durum ve kritik uyarılar için gereklidir.',
            },
        ]}
        primaryLabel="Bildirimlere İzin Ver"
        secondaryLabel="Daha Sonra"
        dismissLabel="Bir Daha Gösterme"
        onPrimary={onAllow}
        onSecondary={onLater}
        onDismissForever={onNever}
        loading={loading}
    />
);

const LocationReminderModal = ({ visible, onAllow, onLater, onNever, loading }) => (
    <PermissionModal
        visible={visible}
        icon="map-marker-radius-outline"
        iconColor="#0EA5E9"
        title="Konum İzni Gerekli"
        description="Saha operasyonlarının düzgün çalışabilmesi için konum iznini etkinleştirin. Bu sayede servis atamaları ve rota takibi düzgün yapılır."
        bullets={[
            {
                icon: 'map-marker-path',
                title: 'Servis atamalarında konum',
                description: 'Yakınınızdaki işlerin hızlı atanmasını sağlar.',
            },
            {
                icon: 'navigation-outline',
                title: 'Rota ve varış takibi',
                description: 'Müşterinin konumuna daha hızlı ulaşmanızı sağlar.',
            },
            {
                icon: 'shield-lock-outline',
                title: 'Sadece çalışma saatlerinde',
                description: 'Konum bilgisi yalnızca vardiya sırasında paylaşılır.',
            },
        ]}
        primaryLabel="Konum İznini Ver"
        secondaryLabel="Daha Sonra"
        dismissLabel="Bir Daha Gösterme"
        onPrimary={onAllow}
        onSecondary={onLater}
        onDismissForever={onNever}
        loading={loading}
    />
);

export const usePermissionReminder = () => {
    const ctx = useContext(PermissionReminderContext);
    if (!ctx) {
        throw new Error('usePermissionReminder must be used within PermissionReminderProvider');
    }
    return ctx;
};

export { PERMISSION_STATES };
