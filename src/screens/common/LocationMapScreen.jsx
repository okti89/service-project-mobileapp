import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/context/ThemeContext';
import api from '@/api/axios';
import { serviceBlue, serviceGreen, serviceRed } from '@/theme/color';
import { getMapProvider, isGoogleMapsKeyConfigured } from '@/config/maps';

const formatRouteDuration = (seconds) => {
    const totalMinutes = Math.max(1, Math.round(Number(seconds || 0) / 60));
    if (totalMinutes < 60) return `${totalMinutes} dk`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours} sa ${minutes} dk` : `${hours} sa`;
};

const formatRouteDistance = (meters) => {
    const value = Number(meters || 0);
    if (value < 1000) return `${Math.round(value)} m`;
    return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} km`;
};

const decodePolyline = (encoded) => {
    if (!encoded || typeof encoded !== 'string') return [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates = [];

    while (index < encoded.length) {
        let shift = 0;
        let result = 0;
        let byte = null;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20 && index < encoded.length);

        const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += deltaLat;

        shift = 0;
        result = 0;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20 && index < encoded.length);

        const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += deltaLng;

        coordinates.push({
            latitude: lat / 1e5,
            longitude: lng / 1e5,
        });
    }

    return coordinates;
};

const parseDirectionsResponse = (data) => {
    const googleRoute = data?.routes?.[0];
    if (googleRoute?.overview_polyline?.points) {
        const leg = googleRoute.legs?.[0] || {};
        return {
            coordinates: decodePolyline(googleRoute.overview_polyline.points),
            distanceText: leg.distance?.text || '',
            durationText: leg.duration?.text || '',
            provider: 'google',
        };
    }

    const osrmRoute = data?.routes?.[0];
    const osrmCoordinates = osrmRoute?.geometry?.coordinates;
    if (Array.isArray(osrmCoordinates)) {
        return {
            coordinates: osrmCoordinates
                .filter((point) => Array.isArray(point) && point.length >= 2)
                .map(([longitude, latitude]) => ({ latitude, longitude })),
            distanceText: formatRouteDistance(osrmRoute.distance),
            durationText: formatRouteDuration(osrmRoute.duration),
            provider: 'osrm',
        };
    }

    return null;
};

const splitAddressParts = (text) => {
    return text
        .split(/[,;/|]+/)
        .map((p) => p.trim())
        .filter(Boolean);
};

const geocodeWithPhoton = async (query) => {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`;
    const response = await fetch(url, {
        headers: { 'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || !Array.isArray(data.features) || data.features.length === 0) return null;
    const feature = data.features[0];
    const coords = feature?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    const props = feature.properties || {};
    const displayName = [
        props.name,
        props.street,
        props.housenumber,
        props.city || props.town || props.village,
        props.state,
        props.country,
    ].filter(Boolean).join(', ');
    return {
        latitude: lat,
        longitude: lon,
        displayName: displayName || query,
        address: props,
    };
};

const geocodeAddress = async (rawAddress) => {
    if (!rawAddress || typeof rawAddress !== 'string') {
        return { error: 'EMPTY' };
    }
    const trimmed = rawAddress.trim();
    if (!trimmed) {
        return { error: 'EMPTY' };
    }

    try {
        const response = await api.post('/maps/geocode/', { address: trimmed });
        const data = response?.data;
        if (data && data.latitude != null && data.longitude != null) {
            if (__DEV__) console.log('[geocode] backend matched', data.matchedQuery || trimmed, '| quota', data.quota);
            return {
                latitude: Number(data.latitude),
                longitude: Number(data.longitude),
                displayName: data.display_name || trimmed,
                address: data.address || null,
                matchedQuery: data.matchedQuery || trimmed,
                approximate: false,
                quota: data.quota,
                provider: data.provider || 'backend',
            };
        }
    } catch (error) {
        const status = error?.response?.status;
        if (status === 429) {
            if (__DEV__) console.log('[geocode] backend 429 (quota exceeded), falling back to Photon');
        } else if (status === 404) {
            if (__DEV__) console.log('[geocode] backend 404, falling back to Photon');
        } else {
            if (__DEV__) console.log('[geocode] backend error', status, error?.message);
        }
    }

    const parts = splitAddressParts(trimmed);
    const candidates = [];
    candidates.push(trimmed);
    for (let i = parts.length - 1; i >= 1; i -= 1) {
        const piece = parts.slice(0, i).join(', ');
        if (piece && piece !== trimmed) candidates.push(piece);
    }
    if (parts.length > 0) {
        const last = parts[parts.length - 1];
        if (last && last.length >= 3 && !candidates.includes(last)) {
            candidates.push(last);
        }
    }

    const isApproximateQuery = (q) => {
        return !/No[:\s]/i.test(q) && !/Mah(\.|\b)/i.test(q) && !/Cad(\.|\b)/i.test(q) && !/Sok(\.|\b)/i.test(q);
    };

    for (let i = 0; i < candidates.length; i += 1) {
        const query = candidates[i];
        try {
            if (__DEV__) console.log('[geocode] Photon fallback ->', query);
            const result = await geocodeWithPhoton(query);
            if (result) {
                if (__DEV__) console.log('[geocode] Photon matched', query);
                return {
                    ...result,
                    matchedQuery: query,
                    approximate: isApproximateQuery(query),
                    provider: 'photon-fallback',
                };
            }
        } catch (error) {
            if (__DEV__) console.log('[geocode] Photon error', error?.message);
        }
    }
    return { error: 'NOT_FOUND' };
};

const formatAddressParts = (address) => {
    if (!address) return [];
    const parts = [];
    if (address.road) parts.push(address.road + (address.house_number ? ` No:${address.house_number}` : ''));
    if (address.neighbourhood) parts.push(address.neighbourhood);
    if (address.suburb) parts.push(address.suburb);
    if (address.city_district) parts.push(address.city_district);
    if (address.city || address.town || address.village) {
        parts.push(address.city || address.town || address.village);
    }
    if (address.state) parts.push(address.state);
    if (address.postcode) parts.push(address.postcode);
    if (address.country) parts.push(address.country);
    return parts;
};

/**
 * Iki koordinat arasindaki mesafeyi metre olarak hesaplar (Haversine).
 */
const distanceMeters = (a, b) => {
    if (!a || !b) return 0;
    const R = 6371000; // Dunya yaricapi metre
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

/**
 * Bir polyline uzerindeki en yakin noktayi bulur (projeksiyon).
 * Kullanicinin rotadan ne kadar saptigini olcmek icin kullanilir.
 */
const nearestPointOnPolyline = (point, polyline) => {
    if (!Array.isArray(polyline) || polyline.length < 2 || !point) {
        return null;
    }
    let minDist = Infinity;
    let nearest = null;
    for (let i = 0; i < polyline.length; i += 1) {
        const d = distanceMeters(point, polyline[i]);
        if (d < minDist) {
            minDist = d;
            nearest = polyline[i];
        }
    }
    return { point: nearest, distance: minDist };
};

const MapActionButton = ({ icon, label, color, onPress, backgroundColor, isDark, disabled = false, loading = false }) => (
    <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
            styles.actionBtn,
            {
                backgroundColor: backgroundColor || (isDark ? '#1F2937' : '#FFFFFF'),
                borderColor: color ? `${color}30` : 'transparent',
                opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
            },
        ]}
    >
        <View
            style={[
                styles.actionIconWrap,
                { backgroundColor: color ? `${color}18` : 'transparent' },
            ]}
        >
            {loading ? (
                <ActivityIndicator size="small" color={color} />
            ) : (
                <MaterialCommunityIcons name={icon} size={18} color={color} />
            )}
        </View>
        <Text style={[styles.actionLabel, { color: isDark ? '#F3F4F6' : '#111827' }]} numberOfLines={1}>
            {label}
        </Text>
    </Pressable>
);

export default function LocationMapScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const mapRef = useRef(null);

    const {
        address = '',
        title = 'Konum',
        subtitle = '',
        latitude: initialLatitude = null,
        longitude: initialLongitude = null,
        showOpenExternal = true,
        showDirections = false,
    } = route?.params || {};

    const FALLBACK_LAT = 39.9334;
    const FALLBACK_LON = 32.8597;

    const [coords, setCoords] = useState(
        Number.isFinite(initialLatitude) && Number.isFinite(initialLongitude)
            ? { latitude: initialLatitude, longitude: initialLongitude }
            : null,
    );
    const [meta, setMeta] = useState(null);
    const [approximate, setApproximate] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const [routeSummary, setRouteSummary] = useState(null);
    const [directionsLoading, setDirectionsLoading] = useState(false);
    const [directionsError, setDirectionsError] = useState(null);
    const autoDirectionsStartedRef = useRef(false);
    const [mapProvider] = useState(() => getMapProvider());

    // Canli takip state'leri
    const [isTracking, setIsTracking] = useState(false);
    const [offRouteDistance, setOffRouteDistance] = useState(0);
    const [remainingDistance, setRemainingDistance] = useState(null);
    const locationSubscriptionRef = useRef(null);
    const lastDirectionsCallRef = useRef(0); // Son directions cagrisi (timestamp)

    const fetchGeocode = useCallback(async () => {
        if (__DEV__) console.log('[LocationMap] received address:', JSON.stringify(address));
        if (coords) {
            setLoading(false);
            return;
        }
        if (!address) {
            setError('Adres bilgisi bos');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        const result = await geocodeAddress(address);
        if (result && !result.error) {
            setCoords({ latitude: result.latitude, longitude: result.longitude });
            setMeta({ displayName: result.displayName, address: result.address });
            setApproximate(Boolean(result.approximate));
            setError(null);
        } else {
            const reason = result?.error;
            const messageMap = {
                EMPTY: 'Adres bilgisi bulunamadi.',
                NETWORK: 'Internet baglantisi yok veya Nominatim yanit vermedi.',
                NOT_FOUND: 'Bu adres haritada bulunamadi. Harita uygulamasinda acmayi deneyin.',
            };
            if (__DEV__) console.log('[LocationMap] geocode failed:', reason, 'for', address);
            setError(messageMap[reason] || 'Adres haritada bulunamadi.');
        }
        setLoading(false);
    }, [address, coords]);

    useEffect(() => {
        fetchGeocode();
    }, [fetchGeocode]);

    const handleOpenExternal = useCallback(() => {
        if (!coords) {
            Linking.openURL(
                `https://maps.google.com/?q=${encodeURIComponent(address)}`,
            ).catch(() => {
                Alert.alert('Hata', 'Harita uygulamasi acilamadi');
            });
            return;
        }
        const { latitude: lat, longitude: lon } = coords;
        const label = encodeURIComponent(title || address || 'Konum');
        const url = Platform.select({
            ios: `https://maps.apple.com/?ll=${lat},${lon}&q=${label}`,
            android: `geo:${lat},${lon}?q=${lat},${lon}(${label})`,
            default: `https://maps.google.com/?q=${lat},${lon}`,
        });
        Linking.openURL(url).catch(() => {
            Linking.openURL(`https://maps.google.com/?q=${lat},${lon}`);
        });
    }, [coords, address, title]);

    const handleDirections = useCallback(async () => {
        if (!coords) {
            Alert.alert('Hata', 'Yol tarifi icin once konum bulunmali');
            return;
        }
        if (directionsLoading) return;

        setDirectionsLoading(true);
        setDirectionsError(null);
        setRouteCoordinates([]);
        setRouteSummary(null);

        try {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (permission.status !== 'granted') {
                setDirectionsError('Mevcut konum izni verilmedi.');
                Alert.alert('Konum izni gerekli', 'Uygulama icinde yol tarifi almak icin mevcut konum izni gerekiyor.');
                return;
            }

            const current = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const origin = {
                latitude: current.coords.latitude,
                longitude: current.coords.longitude,
            };
            setUserLocation(origin);

            const response = await api.get('/maps/directions/', {
                params: {
                    origin: `${origin.latitude},${origin.longitude}`,
                    dest: `${coords.latitude},${coords.longitude}`,
                },
            });
            const parsed = parseDirectionsResponse(response?.data);
            if (!parsed || parsed.coordinates.length < 2) {
                throw new Error('ROUTE_NOT_FOUND');
            }

            setRouteCoordinates(parsed.coordinates);
            setRouteSummary({
                distanceText: parsed.distanceText,
                durationText: parsed.durationText,
                provider: parsed.provider,
            });

            if (mapRef.current) {
                const allCoords = [origin, ...parsed.coordinates, coords];
                const lats = allCoords.map(c => c.latitude);
                const lngs = allCoords.map(c => c.longitude);
                mapRef.current.fitToCoordinates(allCoords, {
                    edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                    animated: true,
                });
            }
        } catch (err) {
            if (__DEV__) console.log('[LocationMap] directions failed:', err?.response?.data || err?.message || err);
            setRouteCoordinates([]);
            setRouteSummary(null);
            setDirectionsError('Rota olusturulamadi. Adresi veya internet baglantisini kontrol edin.');
            Alert.alert('Rota bulunamadi', 'Uygulama icinde yol tarifi olusturulamadi. Adresi veya internet baglantisini kontrol edin.');
        } finally {
            setDirectionsLoading(false);
        }
    }, [coords, directionsLoading]);

    const handleShare = useCallback(() => {
        const text = coords
            ? `Konum: ${title}\nhttps://maps.google.com/?q=${coords.latitude},${coords.longitude}`
            : `Adres: ${address}`;
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
            Linking.openURL(
                `https://wa.me/?text=${encodeURIComponent(text)}`,
            ).catch(() => {});
        }
    }, [coords, title, address]);

    /**
     * Dis navigasyon uygulamasini acar (Google Maps veya Apple Maps).
     * API kotasina dokunmaz, profesyonel sesli yonlendirme saglar.
     */
    const handleStartNavigation = useCallback(() => {
        if (!coords) {
            Alert.alert('Hata', 'Yol tarifi icin once konum bulunmali');
            return;
        }
        const { latitude: lat, longitude: lon } = coords;
        const label = encodeURIComponent(title || address || 'Konum');
        const url = Platform.select({
            // Google Maps uygulamasini acar, mode=driving ile surus modu
            android: `google.navigation:q=${lat},${lon}&mode=d`,
            // iOS: Google Maps app varsa, yoksa Apple Maps fallback
            ios: `comgooglemaps://?daddr=${lat},${lon}&directionsmode=driving&zoom=14`,
            default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`,
        });
        Linking.openURL(url).catch(() => {
            // iOS'ta Google Maps yoksa Apple Maps'e dus
            const fallback = Platform.OS === 'ios'
                ? `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`
                : `geo:${lat},${lon}?q=${lat},${lon}(${label})`;
            Linking.openURL(fallback).catch(() => {
                Alert.alert('Hata', 'Navigasyon uygulamasi acilamadi');
            });
        });
    }, [coords, title, address]);

    /**
     * Canli takibi baslatir/durdurur. watchPositionAsync ile her 3-5 saniyede
     * konum alir, marker canli guncellenir, polyline sabit kalir.
     * API kotasina dokunmaz, sadece OS/cihaz konum servisi kullanir.
     */
    const startTracking = useCallback(async () => {
        if (isTracking) return;
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Konum izni gerekli', 'Canli takip icin konum izni gerekiyor.');
                return;
            }
            const sub = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 3000, // 3 saniye
                    distanceInterval: 10, // 10 metre hareket edince
                },
                (loc) => {
                    const pos = {
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                    };
                    setUserLocation(pos);

                    // Rotadan sapma kontrolu
                    if (routeCoordinates.length > 1) {
                        const nearest = nearestPointOnPolyline(pos, routeCoordinates);
                        if (nearest) {
                            setOffRouteDistance(nearest.distance);
                            // Kalan mesafe: hedefe olan mesafe
                            if (coords) {
                                setRemainingDistance(distanceMeters(pos, coords));
                            }
                        }
                    } else if (coords) {
                        setRemainingDistance(distanceMeters(pos, coords));
                    }
                }
            );
            locationSubscriptionRef.current = sub;
            setIsTracking(true);
        } catch (err) {
            if (__DEV__) console.log('[LocationMap] startTracking error:', err?.message);
            Alert.alert('Hata', 'Canli takip baslatilamadi');
        }
    }, [isTracking, routeCoordinates, coords]);

    const stopTracking = useCallback(() => {
        if (locationSubscriptionRef.current) {
            locationSubscriptionRef.current.remove();
            locationSubscriptionRef.current = null;
        }
        setIsTracking(false);
        setOffRouteDistance(0);
    }, []);

    /**
     * Buyuk sapma (>200m) veya en az 2 dakika gectiyse yeniden rota hesaplar.
     * Rate limit korumasi: minimum 120 saniye aralikla cagirir.
     */
    const maybeRecalculateRoute = useCallback(async () => {
        if (!coords || !userLocation) return;
        const now = Date.now();
        const MIN_INTERVAL = 120 * 1000; // 2 dakika
        if (now - lastDirectionsCallRef.current < MIN_INTERVAL) return;
        if (offRouteDistance < 200) return;

        lastDirectionsCallRef.current = now;
        if (__DEV__) console.log('[LocationMap] recalculating route, offRoute=', offRouteDistance);

        try {
            const response = await api.get('/maps/directions/', {
                params: {
                    origin: `${userLocation.latitude},${userLocation.longitude}`,
                    dest: `${coords.latitude},${coords.longitude}`,
                },
            });
            const parsed = parseDirectionsResponse(response?.data);
            if (parsed && parsed.coordinates.length >= 2) {
                setRouteCoordinates(parsed.coordinates);
                setRouteSummary({
                    distanceText: parsed.distanceText,
                    durationText: parsed.durationText,
                    provider: parsed.provider,
                });
                if (mapRef.current) {
                    mapRef.current.fitToCoordinates(
                        [userLocation, ...parsed.coordinates, coords],
                        { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true }
                    );
                }
            }
        } catch (err) {
            if (__DEV__) console.log('[LocationMap] recalc failed:', err?.message);
        }
    }, [coords, userLocation, offRouteDistance]);

    useEffect(() => {
        if (isTracking && offRouteDistance >= 200) {
            maybeRecalculateRoute();
        }
    }, [isTracking, offRouteDistance, maybeRecalculateRoute]);

    // Component unmount olunca tracking'i durdur
    useEffect(() => {
        return () => {
            if (locationSubscriptionRef.current) {
                locationSubscriptionRef.current.remove();
            }
        };
    }, []);

    const handleRecenter = useCallback(() => {
        if (!coords || !mapRef.current) return;
        
        if (routeCoordinates.length > 0 && userLocation) {
            const allCoords = [userLocation, ...routeCoordinates, coords];
            mapRef.current.fitToCoordinates(allCoords, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
            });
        } else {
            mapRef.current.animateToRegion({
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 1000);
        }
    }, [coords, routeCoordinates, userLocation]);

    useEffect(() => {
        if (!showDirections || !coords || autoDirectionsStartedRef.current) return;
        autoDirectionsStartedRef.current = true;
        handleDirections();
    }, [coords, handleDirections, showDirections]);

    const addressParts = useMemo(() => formatAddressParts(meta?.address), [meta]);
    const displayAddress = meta?.displayName || address || '';

    const mapLat = coords?.latitude ?? FALLBACK_LAT;
    const mapLon = coords?.longitude ?? FALLBACK_LON;
    const initialRegion = {
        latitude: mapLat,
        longitude: mapLon,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    style={({ pressed }) => [
                        styles.headerBtn,
                        {
                            backgroundColor: isDark ? colors.surface : '#FFFFFF',
                            borderColor: colors.border,
                            opacity: pressed ? 0.7 : 1,
                        },
                    ]}
                >
                    <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                </Pressable>
                <View style={styles.headerTitleBlock}>
                    <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                        {title}
                    </Text>
                    {!!subtitle && (
                        <Text
                            style={[styles.headerSubtitle, { color: colors.textSecondary }]}
                            numberOfLines={1}
                        >
                            {subtitle}
                        </Text>
                    )}
                </View>
                {showOpenExternal ? (
                    <Pressable
                        onPress={handleOpenExternal}
                        style={({ pressed }) => [
                            styles.headerBtn,
                            {
                                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                                borderColor: colors.border,
                                opacity: pressed ? 0.7 : 1,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="open-in-new"
                            size={18}
                            color={serviceBlue}
                        />
                    </Pressable>
                ) : (
                    <View style={styles.headerBtn} />
                )}
            </View>

            <View style={styles.mapContainer}>
                {loading ? (
                    <View
                        style={[
                            styles.mapLoading,
                            { backgroundColor: isDark ? colors.surface : '#F1F5F9' },
                        ]}
                    >
                        <ActivityIndicator size="large" color={serviceBlue} />
                        <Text style={[styles.mapLoadingText, { color: colors.textSecondary }]}>
                            Konum aranıyor...
                        </Text>
                    </View>
                ) : (
                    <MapView
                        ref={mapRef}
                        style={StyleSheet.absoluteFill}
                        provider={mapProvider}
                        initialRegion={initialRegion}
                        showsUserLocation={true}
                        showsMyLocationButton={false}
                        showsCompass={true}
                        showsScale={true}
                        followsUserLocation={isTracking}
                        loadingEnabled={true}
                    >
                        {coords && (
                            <Marker
                                coordinate={coords}
                                title={title}
                                description={displayAddress}
                                pinColor={serviceBlue}
                            />
                        )}

                        {userLocation && (
                            <Marker
                                coordinate={userLocation}
                                title="Mevcut Konum"
                                pinColor={serviceGreen}
                            />
                        )}

                        {routeCoordinates.length > 1 && (
                            <Polyline
                                coordinates={routeCoordinates}
                                strokeColor={serviceBlue}
                                strokeWidth={5}
                                lineCap="round"
                                lineJoin="round"
                            />
                        )}
                    </MapView>
                )}

                {!loading && coords && (
                    <Pressable
                        onPress={handleRecenter}
                        style={({ pressed }) => [
                            styles.recenterBtn,
                            {
                                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                                borderColor: colors.border,
                                opacity: pressed ? 0.7 : 1,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="crosshairs-gps"
                            size={20}
                            color={serviceBlue}
                        />
                    </Pressable>
                )}
            </View>

            <View
                style={[
                    styles.bottomCard,
                    {
                        backgroundColor: isDark ? colors.surface : '#FFFFFF',
                        borderColor: colors.border,
                        paddingBottom: insets.bottom + 12,
                    },
                ]}
            >
                <LinearGradient
                    colors={error
                        ? (isDark ? [`${serviceRed}30`, `${serviceRed}00`] : [`${serviceRed}1A`, `${serviceRed}00`])
                        : (isDark ? [`${serviceBlue}30`, `${serviceBlue}00`] : [`${serviceBlue}1A`, `${serviceBlue}00`])}
                    style={styles.cardGradient}
                />
                <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                        <View
                            style={[
                                styles.cardIcon,
                                {
                                    backgroundColor: error
                                        ? (isDark ? `${serviceRed}30` : `${serviceRed}18`)
                                        : (isDark ? `${serviceBlue}30` : `${serviceBlue}18`),
                                },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name={error ? 'map-marker-off' : 'map-marker'}
                                size={20}
                                color={error ? serviceRed : serviceBlue}
                            />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                                style={[styles.cardTitle, { color: colors.text }]}
                                numberOfLines={1}
                            >
                                {error ? 'Konum bulunamadi' : title}
                            </Text>
                            <Text
                                style={[styles.cardSubtitle, { color: colors.textSecondary }]}
                                numberOfLines={1}
                            >
                                {coords
                                    ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
                                    : (address ? 'Adres aranıyor' : 'Koordinat yok')}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.addressBox}>
                        {error ? (
                            <Text style={[styles.addressText, { color: colors.text }]}>
                                {error}
                            </Text>
                        ) : (
                            <>
                                <Text
                                    style={[styles.addressText, { color: colors.text }]}
                                    numberOfLines={2}
                                >
                                    {displayAddress}
                                </Text>
                                {addressParts.length > 0 && (
                                    <View style={styles.partsList}>
                                        {addressParts.map((part, idx) => (
                                            <View
                                                key={`${part}-${idx}`}
                                                style={[
                                                    styles.partsPill,
                                                    { backgroundColor: isDark ? colors.surfaceMuted : '#F3F4F6' },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.partsPillText,
                                                        { color: colors.textSecondary },
                                                    ]}
                                                    numberOfLines={1}
                                                >
                                                    {part}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </>
                        )}
                    </View>

                    {(routeSummary || directionsError) && (
                        <View
                            style={[
                                styles.routeInfoBox,
                                {
                                    backgroundColor: routeSummary
                                        ? (isDark ? `${serviceGreen}18` : `${serviceGreen}10`)
                                        : (isDark ? `${serviceRed}18` : `${serviceRed}10`),
                                    borderColor: routeSummary
                                        ? `${serviceGreen}35`
                                        : `${serviceRed}35`,
                                },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name={routeSummary ? 'routes' : 'alert-circle-outline'}
                                size={18}
                                color={routeSummary ? serviceGreen : serviceRed}
                            />
                            <Text
                                style={[
                                    styles.routeInfoText,
                                    { color: routeSummary ? colors.text : serviceRed },
                                ]}
                                numberOfLines={2}
                            >
                                {routeSummary
                                    ? `Rota hazır${routeSummary.durationText ? ` • ${routeSummary.durationText}` : ''}${routeSummary.distanceText ? ` • ${routeSummary.distanceText}` : ''}`
                                    : directionsError}
                            </Text>
                        </View>
                    )}

                    <View style={styles.actionsRow}>
                        <MapActionButton
                            icon="navigation-variant"
                            label={directionsLoading ? 'Rota...' : 'Yol Tarifi'}
                            color={serviceBlue}
                            onPress={handleDirections}
                            disabled={directionsLoading || !coords}
                            loading={directionsLoading}
                            isDark={isDark}
                        />
                        <MapActionButton
                            icon="map-search-outline"
                            label="Maps'te Aç"
                            color={serviceGreen}
                            onPress={handleOpenExternal}
                            isDark={isDark}
                        />
                        <MapActionButton
                            icon="share-variant-outline"
                            label="Paylaş"
                            color="#8B5CF6"
                            onPress={handleShare}
                            isDark={isDark}
                        />
                    </View>

                    {/* Canli takip ve dis navigasyon satiri */}
                    {coords && (
                        <View style={[styles.actionsRow, { marginTop: 8 }]}>
                            <Pressable
                                onPress={isTracking ? stopTracking : startTracking}
                                style={({ pressed }) => [
                                    styles.trackButton,
                                    {
                                        backgroundColor: isTracking
                                            ? (isDark ? `${serviceRed}30` : `${serviceRed}18`)
                                            : (isDark ? `${serviceBlue}30` : `${serviceBlue}18`),
                                        borderColor: isTracking ? serviceRed : serviceBlue,
                                        opacity: pressed ? 0.7 : 1,
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name={isTracking ? 'stop-circle' : 'crosshairs-gps'}
                                    size={20}
                                    color={isTracking ? serviceRed : serviceBlue}
                                />
                                <Text style={[styles.trackButtonText, { color: isTracking ? serviceRed : serviceBlue }]}>
                                    {isTracking ? 'Takibi Durdur' : 'Takibi Başlat'}
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={handleStartNavigation}
                                style={({ pressed }) => [
                                    styles.navButton,
                                    {
                                        backgroundColor: serviceBlue,
                                        opacity: pressed ? 0.85 : 1,
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons name="directions" size={20} color="#fff" />
                                <Text style={styles.navButtonText}>Navigasyonu Başlat</Text>
                            </Pressable>
                        </View>
                    )}

                    {/* Canli takip sirasinda kalan mesafe / sapma bilgisi */}
                    {isTracking && (remainingDistance != null || offRouteDistance > 0) && (
                        <View style={[styles.trackingInfoBox, { backgroundColor: isDark ? colors.surfaceMuted : '#F8FAFC', borderColor: colors.border }]}>
                            {remainingDistance != null && (
                                <View style={styles.trackingInfoItem}>
                                    <MaterialCommunityIcons name="map-marker-distance" size={16} color={serviceBlue} />
                                    <Text style={[styles.trackingInfoText, { color: colors.text }]}>
                                        Kalan: {formatRouteDistance(remainingDistance)}
                                    </Text>
                                </View>
                            )}
                            {offRouteDistance > 30 && (
                                <View style={styles.trackingInfoItem}>
                                    <MaterialCommunityIcons
                                        name={offRouteDistance > 200 ? 'alert' : 'information'}
                                        size={16}
                                        color={offRouteDistance > 200 ? serviceRed : '#F59E0B'}
                                    />
                                    <Text style={[styles.trackingInfoText, { color: offRouteDistance > 200 ? serviceRed : colors.textSecondary }]}>
                                        Rotadan {Math.round(offRouteDistance)}m uzakta
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    headerBtn: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    headerTitleBlock: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
    headerTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.2 },
    headerSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 2, letterSpacing: 0.2 },

    mapContainer: { flex: 1, overflow: 'hidden' },
    mapLoading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    mapLoadingText: { fontSize: 13, fontWeight: '600' },

    recenterBtn: {
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },

    bottomCard: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingTop: 0,
        overflow: 'hidden',
    },
    cardGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 80,
    },
    cardContent: { paddingTop: 16 },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    cardIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: { fontSize: 15, fontWeight: '900' },
    cardSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 2, letterSpacing: 0.2 },

    addressBox: { marginBottom: 14 },
    addressText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
    routeInfoBox: {
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    routeInfoText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '800',
        lineHeight: 17,
    },
    partsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
    },
    partsPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        maxWidth: 200,
    },
    partsPillText: { fontSize: 11, fontWeight: '600' },

    actionsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        gap: 6,
    },
    actionIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionLabel: { fontSize: 12, fontWeight: '800', flex: 1 },

    trackButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1.5,
    },
    trackButtonText: { fontSize: 13, fontWeight: '800' },
    navButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    navButtonText: { fontSize: 13, fontWeight: '800', color: '#fff' },

    trackingInfoBox: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 10,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
    trackingInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    trackingInfoText: { fontSize: 12, fontWeight: '700' },
});
