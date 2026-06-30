import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

const TrackingContext = createContext(null);

const TRACKING_INTERVAL_MS = 15000; // 15 saniye

export const TrackingProvider = ({ children }) => {
    const [trackedTechnician, setTrackedTechnician] = useState(null);
    // trackedTechnician shape: { technicianId, fullName, markerColor }

    const [lastKnownLocation, setLastKnownLocation] = useState(null);
    // lastKnownLocation shape: { latitude, longitude, locationText, createdAt }

    const [isTracking, setIsTracking] = useState(false);
    const intervalRef = useRef(null);
    const appStateRef = useRef(AppState.currentState);

    const fetchTrackedLocation = useCallback(async (techId) => {
        if (!techId) return;
        try {
            const response = await api.get(ENDPOINTS.TECHNICIAN.LOCATION_LOGS, {
                params: { technician: techId },
            });
            const rows = Array.isArray(response.data) ? response.data : [];

            // Find the latest location for this specific technician
            let latest = null;
            rows.forEach((loc) => {
                if (!latest || new Date(loc.created_at || loc.arrived_at) > new Date(latest.created_at || latest.arrived_at)) {
                    latest = loc;
                }
            });

            if (latest) {
                setLastKnownLocation({
                    latitude: Number(latest.latitude),
                    longitude: Number(latest.longitude),
                    locationText: latest.location || `${latest.latitude}, ${latest.longitude}`,
                    createdAt: latest.created_at || latest.arrived_at,
                });
            }
        } catch (error) {
            console.log('[Tracking] Failed to fetch location:', error.message);
        }
    }, []);

    const startTracking = useCallback((technician) => {
        // technician: { technicianId, fullName, markerColor }
        setTrackedTechnician(technician);
        setIsTracking(true);
        setLastKnownLocation(null);
        // fetch immediately
        fetchTrackedLocation(technician.technicianId);
    }, [fetchTrackedLocation]);

    const stopTracking = useCallback(() => {
        setTrackedTechnician(null);
        setIsTracking(false);
        setLastKnownLocation(null);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    // Periodic fetch
    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (!isTracking || !trackedTechnician?.technicianId) return;

        intervalRef.current = setInterval(() => {
            if (appStateRef.current === 'active') {
                fetchTrackedLocation(trackedTechnician.technicianId);
            }
        }, TRACKING_INTERVAL_MS);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isTracking, trackedTechnician, fetchTrackedLocation]);

    // AppState listener — re-fetch on foreground return
    useEffect(() => {
        const sub = AppState.addEventListener('change', (nextState) => {
            if (appStateRef.current !== 'active' && nextState === 'active' && isTracking && trackedTechnician?.technicianId) {
                fetchTrackedLocation(trackedTechnician.technicianId);
            }
            appStateRef.current = nextState;
        });
        return () => sub.remove();
    }, [isTracking, trackedTechnician, fetchTrackedLocation]);

    return (
        <TrackingContext.Provider
            value={{
                trackedTechnician,
                lastKnownLocation,
                isTracking,
                startTracking,
                stopTracking,
            }}
        >
            {children}
        </TrackingContext.Provider>
    );
};

export const useTracking = () => {
    const context = useContext(TrackingContext);
    if (!context) {
        throw new Error('useTracking must be used within a TrackingProvider');
    }
    return context;
};
