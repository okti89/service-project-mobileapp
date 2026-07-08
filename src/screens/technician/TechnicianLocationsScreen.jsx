import React, { memo, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';

// Initialize dayjs locale
dayjs.locale('tr');

import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { useTheme } from '@/context/ThemeContext';
import AppBottomSheet from '@/components/AppBottomSheet';
import { getMapProvider } from '@/config/maps';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import TechnicianPickerSheet from '@/components/home/TechnicianPickerSheet';

const { width } = Dimensions.get('window');

const DEFAULT_REGION = {
    latitude: 41.0082,
    longitude: 28.9784,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
};

const findNearestLocation = (coordinate, locations) => {
    if (!coordinate || !Array.isArray(locations) || locations.length === 0) return null;

    return locations.reduce((nearest, item) => {
        const distance = calculateDistanceMeters(
            coordinate.latitude,
            coordinate.longitude,
            item.latitude,
            item.longitude,
        );

        if (!nearest || distance < nearest.distance) {
            return { item, distance };
        }

        return nearest;
    }, null)?.item || null;
};

const formatDayKey = (dateValue) => dayjs(dateValue).format('YYYY-MM-DD');

// Simple Haversine formula for straight line distance fallback
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Simplify coordinate list to avoid long URL issues with OSRM (points within 20m are skipped)
function simplifyCoords(pts, minDistanceMeters = 20) {
    if (pts.length <= 2) return pts;
    const result = [pts[0]];
    let lastPoint = pts[0];
    for (let i = 1; i < pts.length - 1; i++) {
        const dist = calculateDistanceMeters(lastPoint.latitude, lastPoint.longitude, pts[i].latitude, pts[i].longitude);
        if (dist >= minDistanceMeters) {
            result.push(pts[i]);
            lastPoint = pts[i];
        }
    }
    result.push(pts[pts.length - 1]);
    return result;
}

// ---------- Reverse Geocoding (expo-location, OS native, kotasız) ----------
const reverseGeocodeCache = new Map();
const inFlightKeys = new Set();

const coordKey = (latitude, longitude) => `${Number(latitude).toFixed(5)},${Number(longitude).toFixed(5)}`;

const COORD_PATTERN = /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/;

const isCoordinateString = (value) => {
    if (!value) return true;
    return COORD_PATTERN.test(String(value).trim());
};

const formatGeocodeParts = (geocode) => {
    if (!geocode) return '';
    const parts = [];
    if (geocode.street) parts.push(geocode.street);
    if (geocode.name && geocode.name !== geocode.street) parts.push(geocode.name);
    if (geocode.district) parts.push(geocode.district);
    if (geocode.city) parts.push(geocode.city);
    else if (geocode.subregion) parts.push(geocode.subregion);
    if (geocode.region && geocode.region !== geocode.city) parts.push(geocode.region);
    return parts.filter(Boolean).join(', ');
};

const reverseGeocodeCoordinate = async (latitude, longitude) => {
    const key = coordKey(latitude, longitude);
    if (reverseGeocodeCache.has(key)) return reverseGeocodeCache.get(key);
    if (inFlightKeys.has(key)) return null;
    inFlightKeys.add(key);
    try {
        // Birincil: backend geocoding (reverse yon, 'geocode' kota tipi DB'de sayilir)
        try {
            const response = await api.get(ENDPOINTS.MAPS.GEOCODE, {
                params: { lat: latitude, lon: longitude },
            });
            if (response?.data?.display_name) {
                reverseGeocodeCache.set(key, response.data.display_name);
                return response.data.display_name;
            }
        } catch (err) {
            const status = err?.response?.status;
            if (__DEV__) {
                console.log(`[reverseGeocode] backend fail (${status ?? 'net'}): ${err?.message} → OS-native fallback`);
            }
            // 429 (quota) veya network hatasinda OS-native'e dus
        }

        // Ikincil (fallback): OS-native (expo-location) - kota harcamaz
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        const formatted = formatGeocodeParts(Array.isArray(results) ? results[0] : null) || `${latitude}, ${longitude}`;
        reverseGeocodeCache.set(key, formatted);
        return formatted;
    } catch (err) {
        if (__DEV__) console.log('[reverseGeocode] OS-native failed:', err?.message);
        return `${latitude}, ${longitude}`;
    } finally {
        inFlightKeys.delete(key);
    }
};

const buildDisplayAddress = (item, resolvedMap) => {
    if (!item) return '';
    const resolved = resolvedMap?.get?.(String(item.id));
    if (resolved) return resolved;
    if (item.location && !isCoordinateString(item.location)) return item.location;
    return `${Number(item.latitude).toFixed(5)}, ${Number(item.longitude).toFixed(5)}`;
};

const CalendarModal = ({ visible, selectedDate, onSelectDate, onClose, dayCountByDate }) => {
    const { colors } = useTheme();
    const [currentMonth, setCurrentMonth] = useState(selectedDate.toDate());

    useEffect(() => {
        if (visible) {
            setCurrentMonth(selectedDate.toDate());
        }
    }, [selectedDate, visible]);

    const daysInMonth = React.useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const normalizedOffset = firstDay === 0 ? 6 : firstDay - 1;
        const daysCount = new Date(year, month + 1, 0).getDate();
        const days = [];

        for (let i = 0; i < normalizedOffset; i += 1) days.push(null);
        for (let i = 1; i <= daysCount; i += 1) days.push(new Date(year, month, i));

        return days;
    }, [currentMonth]);

    const shiftMonth = (delta) => {
        setCurrentMonth((prev) => {
            const next = new Date(prev);
            next.setMonth(next.getMonth() + delta);
            return next;
        });
    };

    const selectedDayKey = formatDayKey(selectedDate);
    const todayKey = formatDayKey(new Date());

    return (
        <AppBottomSheet
            visible={visible}
            onClose={onClose}
            snapPoints={['64%']}
            contentContainerStyle={styles.calendarModal}
        >
            <View style={styles.calendarHeader}>
                <Text style={[styles.calendarTitle, { color: colors.text }]}>
                    {currentMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                </Text>
                <Pressable onPress={onClose} style={styles.calendarCloseButton}>
                    <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                </Pressable>
            </View>

            <View style={styles.calendarNav}>
                <Pressable onPress={() => shiftMonth(-1)} style={styles.calendarNavButton}>
                    <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
                </Pressable>
                <Pressable onPress={() => setCurrentMonth(new Date())} style={styles.calendarTodayButton}>
                    <Text style={[styles.calendarTodayText, { color: serviceBlue }]}>Bugun</Text>
                </Pressable>
                <Pressable onPress={() => shiftMonth(1)} style={styles.calendarNavButton}>
                    <MaterialCommunityIcons name="chevron-right" size={28} color={colors.text} />
                </Pressable>
            </View>

            <View style={styles.calendarWeekdays}>
                {['Pt', 'Sa', 'Ca', 'Pe', 'Cu', 'Ct', 'Pz'].map((label) => (
                    <Text key={label} style={[styles.calendarWeekdayText, { color: colors.textTertiary }]}>
                        {label}
                    </Text>
                ))}
            </View>

            <View style={styles.calendarDaysGrid}>
                {daysInMonth.map((day, index) => {
                    if (!day) {
                        return <View key={`empty-${index}`} style={styles.calendarDayCell} />;
                    }

                    const dayKey = formatDayKey(day);
                    const isSelected = dayKey === selectedDayKey;
                    const isToday = dayKey === todayKey;
                    const hasRecords = Boolean(dayCountByDate?.[dayKey]);

                    return (
                        <Pressable
                            key={dayKey}
                            onPress={() => {
                                onSelectDate(dayjs(day));
                                onClose();
                            }}
                            style={[
                                styles.calendarDayCell,
                                isSelected && styles.calendarDaySelected,
                                isSelected && { backgroundColor: serviceBlue },
                                isToday && !isSelected && { borderColor: serviceBlue, borderWidth: 2 },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.calendarDayText,
                                    { color: isSelected ? '#FFFFFF' : colors.text },
                                    hasRecords && !isSelected && styles.calendarDayHasRecords,
                                    hasRecords && !isSelected && { color: serviceBlue },
                                ]}
                            >
                                {day.getDate()}
                            </Text>
                            {hasRecords && !isSelected ? (
                                <View style={[styles.calendarDayDot, { backgroundColor: serviceBlue }]} />
                            ) : null}
                        </Pressable>
                    );
                })}
            </View>
        </AppBottomSheet>
    );
};

const TechnicianMapSection = memo(function TechnicianMapSection({
    colors,
    insetsBottom,
    loadingLocations,
    locations,
    mapRef,
    routePoints,
    totalDistance,
    onOpenRouteHistory,
    onLocationPress,
    selectedLocationId,
    resolvedAddresses,
}) {
    const provider = useMemo(() => getMapProvider(), []);

    const handleRoutePress = useCallback((event) => {
        const coordinate = event?.nativeEvent?.coordinate;
        const nearest = findNearestLocation(coordinate, locations);
        if (nearest) {
            onLocationPress?.(nearest);
        }
    }, [locations, onLocationPress]);

    const markers = useMemo(() => {
        if (locations.length === 0) return [];

        const total = locations.length;
        const maxIntermediateMarkers = 15;

        return locations.map((item, index) => {
            const isStart = index === 0;
            const isEnd = index === total - 1;
            const isSelected = String(selectedLocationId || '') === String(item.id);

            // Determine if we should render this marker
            let shouldRender = isStart || isEnd || isSelected;

            if (!shouldRender && total > 2) {
                // Sample intermediate markers: only render if index matches the step size
                const step = Math.ceil((total - 2) / maxIntermediateMarkers);
                if ((index - 1) % step === 0) {
                    shouldRender = true;
                }
            }

            if (!shouldRender) return null;

            let color = serviceBlue;
            let icon = null;
            const displayAddress = buildDisplayAddress(item, resolvedAddresses);

            if (isStart) {
                color = serviceGreen;
                icon = 'play';
            } else if (isEnd) {
                color = serviceRed;
                icon = 'flag-checkered';
            }

            return (
                <Marker
                    key={`${item.id}-${isSelected ? 'selected' : 'normal'}`}
                    coordinate={{ latitude: item.latitude, longitude: item.longitude }}
                    title={isStart ? 'Başlangıç' : isEnd ? 'Bitiş' : `${index + 1}. Konum`}
                    description={`${dayjs(item.created_at).format('HH:mm')} · ${displayAddress}`}
                    anchor={{ x: 0.5, y: 0.72 }}
                    onPress={() => onLocationPress?.(item)}
                >
                    <View style={[styles.markerTapArea, isSelected && styles.markerTapAreaSelected]}>
                        <View style={styles.markerWrap}>
                            {isStart || isEnd ? (
                                <View style={[
                                    styles.markerSpecial,
                                    { backgroundColor: color, borderColor: isSelected ? serviceOrange : '#fff' },
                                    isSelected && styles.markerSelected,
                                ]}>
                                    <Text style={styles.markerText}>{index + 1}</Text>
                                </View>
                            ) : (
                                <View style={[
                                    styles.markerNumber,
                                    { backgroundColor: color, borderColor: isSelected ? serviceOrange : '#fff' },
                                    isSelected && styles.markerSelected,
                                ]}>
                                    <Text style={styles.markerText}>{index + 1}</Text>
                                </View>
                            )}
                            <View style={[styles.markerTail, { borderTopColor: color }]} />
                        </View>
                    </View>
                </Marker>
            );
        }).filter(Boolean);
    }, [locations, onLocationPress, selectedLocationId, resolvedAddresses]);

    if (loadingLocations) {
        return (
            <View style={styles.mapWrapper}>
                <View style={[styles.loaderContainer, { backgroundColor: colors.surfaceMuted }]}>
                    <ActivityIndicator size="large" color={colors.info} />
                    <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Konumlar yükleniyor...</Text>
                </View>
            </View>
        );
    }

    if (locations.length === 0) {
        return (
            <View style={styles.mapWrapper}>
                <View style={[styles.emptyContainer, { backgroundColor: colors.surfaceMuted }]}>
                    <View style={[styles.emptyIconCircle, { backgroundColor: `${colors.info}15` }]}>
                        <MaterialCommunityIcons name="map-marker-off-outline" size={44} color={colors.info} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>Konum Verisi Bulunamadı</Text>
                    <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                        Seçilen teknisyen için bu tarihte kaydedilmiş herhangi bir konum verisi mevcut değil.
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.mapWrapper}>
            <View style={StyleSheet.absoluteFillObject}>
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFill}
                    provider={provider}
                    initialRegion={DEFAULT_REGION}
                    showsUserLocation={false}
                    showsMyLocationButton={false}
                    showsCompass
                    showsScale
                    rotateEnabled
                    pitchEnabled={false}
                    toolbarEnabled={false}
                    moveOnMarkerPress={false}
                >
                    {routePoints.length >= 2 && (
                        <>
                            <Polyline
                                coordinates={routePoints}
                                strokeColor="rgba(0,0,0,0.01)"
                                strokeWidth={24}
                                tappable
                                onPress={handleRoutePress}
                            />
                            <Polyline
                                coordinates={routePoints}
                                strokeColor={serviceBlue}
                                strokeWidth={5}
                                lineJoin="round"
                                lineCap="round"
                            />
                        </>
                    )}
                    {markers}
                </MapView>

                <View style={[styles.floatingMetrics, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
                    <View style={styles.metricItem}>
                        <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>TOPLAM YOL</Text>
                        <Text style={[styles.metricVal, { color: colors.text }]}>
                            {totalDistance > 0 ? `${totalDistance.toFixed(2)} km` : '0 km'}
                        </Text>
                    </View>
                    <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.metricItem}>
                        <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>KONUM SAYISI</Text>
                        <Text style={[styles.metricVal, { color: colors.text }]}>{locations.length}</Text>
                    </View>
                </View>

                <Pressable
                    onPress={onOpenRouteHistory}
                    style={({ pressed }) => [
                        styles.fabButton,
                        {
                            backgroundColor: colors.info,
                            shadowColor: colors.shadow,
                            opacity: pressed ? 0.85 : 1,
                            bottom: 12 + insetsBottom,
                        },
                    ]}
                >
                    <MaterialCommunityIcons name="map-marker-path" size={20} color="#fff" />
                    <Text style={styles.fabLabel}>Rota Geçmişi</Text>
                    {locations.length > 0 && (
                        <View style={styles.fabBadge}>
                            <Text style={styles.fabBadgeText}>{locations.length}</Text>
                        </View>
                    )}
                </Pressable>
            </View>
        </View>
    );
});

export default function TechnicianLocationsScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const mapRef = useRef(null);
    const routeHistoryListRef = useRef(null);
    const routeHistoryScrollTimerRef = useRef(null);

    // States
    const [selectedDate, setSelectedDate] = useState(dayjs());
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [technicians, setTechnicians] = useState([]);
    const [selectedTechnician, setSelectedTechnician] = useState(null);
    const [selectedLocationId, setSelectedLocationId] = useState(null);
    const [isRouteHistoryVisible, setIsRouteHistoryVisible] = useState(false);
    const techPickerRef = useRef(null);

    const [locations, setLocations] = useState([]);
    const [locationDayCounts, setLocationDayCounts] = useState({});
    const [routePoints, setRoutePoints] = useState([]);
    const [totalDistance, setTotalDistance] = useState(0); // in kilometers
    const [resolvedAddresses, setResolvedAddresses] = useState(() => new Map());

    const resolvedAddressesRef = useRef(resolvedAddresses);
    useEffect(() => {
        resolvedAddressesRef.current = resolvedAddresses;
    }, [resolvedAddresses]);

    const [loadingTechs, setLoadingTechs] = useState(false);
    const [loadingLocations, setLoadingLocations] = useState(false);
    const [loadingRoute, setLoadingRoute] = useState(false);

    // Fetch technicians list on load
    useEffect(() => {
        const fetchTechnicians = async () => {
            setLoadingTechs(true);
            try {
                const response = await api.get(ENDPOINTS.TECHNICIAN.LIST);
                const data = Array.isArray(response.data) ? response.data : [];
                const sorted = data.sort((a, b) =>
                    (a.full_name || '').localeCompare(b.full_name || '', 'tr', { sensitivity: 'base' })
                );
                setTechnicians(sorted);
                if (sorted.length > 0) {
                    setSelectedTechnician(sorted[0]);
                }
            } catch (err) {
                console.error('Failed to fetch technicians:', err);
            } finally {
                setLoadingTechs(false);
            }
        };
        fetchTechnicians();
    }, []);

    useEffect(() => () => {
        if (routeHistoryScrollTimerRef.current) {
            clearTimeout(routeHistoryScrollTimerRef.current);
        }
    }, []);

    // Fetch locations when selected technician or date changes
    useEffect(() => {
        if (!selectedTechnician) return;

        const fetchLocations = async () => {
            setLoadingLocations(true);
            setRoutePoints([]);
            setTotalDistance(0);
            setSelectedLocationId(null);
            const dateStr = selectedDate.format('YYYY-MM-DD');
            try {
                // Fetch location logs for technician & date
                const response = await api.get(
                    `technicians/technician/${selectedTechnician.id}/locations/`,
                    { params: { date: dateStr } }
                );

                // Parse fields and guarantee chronologically sorted
                const parsed = response.data.map(loc => ({
                    ...loc,
                    latitude: parseFloat(loc.latitude),
                    longitude: parseFloat(loc.longitude)
                })).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                setLocations(parsed);
                setResolvedAddresses(new Map());

                if (parsed.length >= 2) {
                    fetchDrivingRoute(parsed);
                } else {
                    setRoutePoints([]);
                    setTotalDistance(0);
                }
            } catch (err) {
                console.error('Failed to fetch locations:', err);
            } finally {
                setLoadingLocations(false);
            }
        };

        fetchLocations();
    }, [selectedTechnician, selectedDate]);

    // Eksi adresli lokasyonlar icin arka planda reverse geocoding (kotasiz, OS native).
    // Zaten adres string'i olan veya cache'te bulunan kayitlar icin tekrar cagri yapilmaz.
    useEffect(() => {
        if (!locations || locations.length === 0) return undefined;

        let cancelled = false;
        const updateMap = (key, value) => {
            if (cancelled) return;
            setResolvedAddresses((prev) => {
                const next = new Map(prev);
                next.set(key, value);
                return next;
            });
        };

        (async () => {
            for (const item of locations) {
                if (cancelled) return;
                if (!isCoordinateString(item.location)) continue;
                const key = String(item.id);
                const cacheKey = coordKey(item.latitude, item.longitude);
                if (reverseGeocodeCache.has(cacheKey)) {
                    updateMap(key, reverseGeocodeCache.get(cacheKey));
                    continue;
                }
                const address = await reverseGeocodeCoordinate(item.latitude, item.longitude);
                if (address && !cancelled) updateMap(key, address);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [locations]);

    useEffect(() => {
        if (!selectedTechnician) {
            setLocationDayCounts({});
            return;
        }

        const fetchLocationDayCounts = async () => {
            try {
                const response = await api.get(
                    `technicians/technician/${selectedTechnician.id}/locations/`,
                );
                const rows = Array.isArray(response.data) ? response.data : [];
                const counts = rows.reduce((acc, item) => {
                    const dayKey = formatDayKey(item.created_at);
                    acc[dayKey] = (acc[dayKey] || 0) + 1;
                    return acc;
                }, {});
                setLocationDayCounts(counts);
            } catch (err) {
                console.error('Failed to fetch location day counts:', err);
                setLocationDayCounts({});
            }
        };

        fetchLocationDayCounts();
    }, [selectedTechnician]);

    // Fit map to markers whenever locations are loaded
    useEffect(() => {
        if (!mapRef.current || locations.length === 0) return undefined;

        const coords = locations.map(l => ({
            latitude: l.latitude,
            longitude: l.longitude
        }));

        const timer = setTimeout(() => {
            // Harita bu esnada unmount olmus ya da ref kopmus olabilir; guvenli sekilde cik
            if (!mapRef.current) return;

            if (coords.length === 1) {
                mapRef.current.animateToRegion({
                    latitude: coords[0].latitude,
                    longitude: coords[0].longitude,
                    latitudeDelta: 0.012,
                    longitudeDelta: 0.012,
                }, 500);
            } else {
                mapRef.current.fitToCoordinates(coords, {
                    edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                    animated: true
                });
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [locations]);

    // Fetch route geometry and distance from backend (/maps/directions/)
    // Backend Google Directions + OSRM fallback ile cevap verir, rate limit/cache saglar.
    // Waypoints destegi sayesinde 25 noktaya kadar tek istek yeterli.
    const fetchDrivingRoute = async (points) => {
        setLoadingRoute(true);
        const simplified = simplifyCoords(points, 30); // Skip points closer than 30m

        try {
            // Google Directions 25 waypoint destekler (toplam 25 nokta)
            // 25'ten fazla nokta varsa, parcalar halinde istek at ve birlestir
            const MAX_WAYPOINTS_PER_REQUEST = 23; // + origin + dest = 25
            const segments = [];
            let totalMeters = 0;

            for (let i = 0; i < simplified.length - 1; i += MAX_WAYPOINTS_PER_REQUEST) {
                const slice = simplified.slice(i, i + MAX_WAYPOINTS_PER_REQUEST + 1);
                if (slice.length < 2) break;

                const origin = `${slice[0].latitude},${slice[0].longitude}`;
                const dest = `${slice[slice.length - 1].latitude},${slice[slice.length - 1].longitude}`;
                // Aradaki noktalar waypoints olarak gonderilir
                const waypoints = slice
                    .slice(1, -1)
                    .map(p => `${p.latitude},${p.longitude}`)
                    .join('|');

                try {
                    const response = await api.get('/maps/directions/', {
                        params: waypoints ? { origin, dest, waypoints } : { origin, dest },
                    });
                    const route = response?.data?.routes?.[0];
                    const fromCache = response?.data?.cached === true;

                    if (!route) {
                        // Bu segment icin yol bulunamadi, Haversine mesafesi kullan
                        for (let j = 0; j < slice.length - 1; j++) {
                            segments.push([
                                { latitude: slice[j].latitude, longitude: slice[j].longitude },
                                { latitude: slice[j + 1].latitude, longitude: slice[j + 1].longitude },
                            ]);
                            totalMeters += calculateDistanceMeters(
                                slice[j].latitude, slice[j].longitude,
                                slice[j + 1].latitude, slice[j + 1].longitude
                            );
                        }
                        continue;
                    }

                    let decoded = [];
                    if (route.overview_polyline?.points) {
                        decoded = decodePolyline(route.overview_polyline.points);
                    } else if (Array.isArray(route.geometry?.coordinates)) {
                        decoded = route.geometry.coordinates.map(([lon, lat]) => ({
                            latitude: lat,
                            longitude: lon,
                        }));
                    }

                    if (decoded.length >= 2) {
                        if (segments.length > 0) segments.push(decoded.slice(1));
                        else segments.push(decoded);
                    }

                    if (__DEV__) {
                        console.log(`[Route] segment cached=${fromCache}, waypoints=${waypoints ? waypoints.split('|').length : 0}`);
                    }
                } catch (segErr) {
                    if (__DEV__) console.log('[Route] segment failed:', segErr?.message);
                    for (let j = 0; j < slice.length - 1; j++) {
                        segments.push([
                            { latitude: slice[j].latitude, longitude: slice[j].longitude },
                            { latitude: slice[j + 1].latitude, longitude: slice[j + 1].longitude },
                        ]);
                        totalMeters += calculateDistanceMeters(
                            slice[j].latitude, slice[j].longitude,
                            slice[j + 1].latitude, slice[j + 1].longitude
                        );
                    }
                }
            }

            if (segments.length > 0) {
                const combined = segments.flat();
                setRoutePoints(combined);
                // KRITIK: Polyline uzerindeki gercek mesafeyi hesapla,
                // backend'in dondugu route.distance guvenilir degil (overview polyline sadece ana yol)
                const polylineKm = calculatePolylineDistanceKm(combined);
                if (__DEV__) {
                    console.log(`[Route] polyline nokta sayisi: ${combined.length}, mesafe: ${polylineKm.toFixed(3)} km`);
                }
                setTotalDistance(polylineKm);
            } else {
                throw new Error('No segments');
            }
        } catch (err) {
            if (__DEV__) console.log('Backend routing failed, falling back to straight lines:', err?.message);
            setRoutePoints(points.map(p => ({ latitude: p.latitude, longitude: p.longitude })));
            let distanceSum = 0;
            for (let i = 0; i < points.length - 1; i++) {
                distanceSum += calculateDistanceMeters(
                    points[i].latitude, points[i].longitude,
                    points[i + 1].latitude, points[i + 1].longitude
                );
            }
            setTotalDistance(distanceSum / 1000);
        } finally {
            setLoadingRoute(false);
        }
    };

    // Polyline decode (Google encoded polyline algorithm)
    const decodePolyline = (encoded) => {
        if (!encoded) return [];
        let index = 0;
        let lat = 0;
        let lng = 0;
        const coordinates = [];
        while (index < encoded.length) {
            let shift = 0;
            let result = 0;
            let byte;
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
            coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
        }
        return coordinates;
    };

    const calculatePolylineDistanceKm = (pts) => {
        let sum = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            sum += calculateDistanceMeters(
                pts[i].latitude, pts[i].longitude,
                pts[i + 1].latitude, pts[i + 1].longitude
            );
        }
        return sum / 1000;
    };

    // Date navigation helpers
    const changeDate = (days) => {
        setSelectedDate(prev => prev.add(days, 'day'));
    };

    // Center map on clicked location item
    const focusOnLocation = (item) => {
        if (mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: item.latitude,
                longitude: item.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            }, 600);
        }
    };

    const openRouteHistory = useCallback(() => {
        setIsRouteHistoryVisible(true);
    }, []);

    const selectedLocation = useMemo(
        () => locations.find((loc) => String(loc.id) === String(selectedLocationId || '')) || null,
        [locations, selectedLocationId],
    );

    const scrollRouteHistoryToLocation = useCallback((locationId, delay = 260) => {
        if (routeHistoryScrollTimerRef.current) {
            clearTimeout(routeHistoryScrollTimerRef.current);
        }

        routeHistoryScrollTimerRef.current = setTimeout(() => {
            const index = locations.findIndex((loc) => String(loc.id) === String(locationId));
            if (index < 0) return;

            routeHistoryListRef.current?.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0.25,
            });
        }, delay);
    }, [locations]);

    const handleMapLocationPress = useCallback((item) => {
        setSelectedLocationId(item?.id || null);
        setIsRouteHistoryVisible(true);
        if (item) {
            focusOnLocation(item);
            scrollRouteHistoryToLocation(item.id, 380);
        }
    }, [scrollRouteHistoryToLocation]);

    // Render helper for custom marker views
    const renderMarker = (item, index) => {
        const isStart = index === 0;
        const isEnd = index === locations.length - 1;
        const isMiddle = !isStart && !isEnd;
        let color = serviceBlue;
        let icon = null;
        if (isStart) { color = serviceGreen; icon = 'play'; }
        else if (isEnd) { color = serviceRed; icon = 'flag-checkered'; }
        else { icon = null; }
        const displayAddress = buildDisplayAddress(item, resolvedAddresses);

        return (
            <Marker
                key={item.id}
                coordinate={{ latitude: item.latitude, longitude: item.longitude }}
                title={isStart ? 'Baslangic' : isEnd ? 'Bitis' : `${index + 1}. Konum`}
                description={`${dayjs(item.created_at).format('HH:mm')} · ${displayAddress}`}
                anchor={{ x: 0.5, y: 1 }}
            >
                <View style={styles.markerWrap}>
                    {isStart || isEnd ? (
                        <View style={[styles.markerSpecial, { backgroundColor: color, borderColor: '#fff' }]}>
                            <MaterialCommunityIcons name={icon} size={14} color="#fff" />
                        </View>
                    ) : (
                        <View style={[styles.markerNumber, { backgroundColor: color, borderColor: '#fff' }]}>
                            <Text style={styles.markerText}>{index + 1}</Text>
                        </View>
                    )}
                    <View style={[styles.markerTail, { borderTopColor: color }]} />
                </View>
            </Marker>
        );
    };

    // Main layout config
    const defaultRegion = {
        latitude: 41.0082,
        longitude: 28.9784,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
                </Pressable>
                <View style={styles.headerTitleContainer}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Teknisyen Konumları</Text>
                </View>
            </View>

            {/* Filter Bar: Date and Technician select triggers */}
            <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                {/* Technician Selector */}
                <Pressable
                    onPress={() => techPickerRef.current?.present()}
                    style={[styles.techFilterBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                    <MaterialCommunityIcons name="account" size={16} color={colors.info} style={{ marginRight: 6 }} />
                    <Text style={[styles.techFilterBtnText, { color: colors.text }]} numberOfLines={1}>
                        {selectedTechnician ? selectedTechnician.full_name : 'Teknisyen Seçin'}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={14} color={colors.textSecondary} />
                </Pressable>

                {/* Date Navigator */}
                <View style={styles.dateNavigatorCompact}>
                    <Pressable onPress={() => changeDate(-1)} style={styles.dateNavButtonCompact}>
                        <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateDisplayCompact}>
                        <MaterialCommunityIcons name="calendar-month-outline" size={14} color={colors.info} style={{ marginRight: 4 }} />
                        <Text style={[styles.dateTextCompact, { color: colors.text }]}>
                            {selectedDate.format('DD MMM YYYY')}
                        </Text>
                    </Pressable>
                    <Pressable onPress={() => changeDate(1)} style={styles.dateNavButtonCompact}>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                    </Pressable>
                </View>
            </View>

            <CalendarModal
                visible={showDatePicker}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onClose={() => setShowDatePicker(false)}
                dayCountByDate={locationDayCounts}
            />

            {/* Map Section */}
            <TechnicianMapSection
                colors={colors}
                insetsBottom={insets.bottom}
                loadingLocations={loadingLocations}
                locations={locations}
                mapRef={mapRef}
                routePoints={routePoints}
                totalDistance={totalDistance}
                onOpenRouteHistory={openRouteHistory}
                onLocationPress={handleMapLocationPress}
                selectedLocationId={selectedLocationId}
                resolvedAddresses={resolvedAddresses}
            />
            {false && (
                <View style={styles.mapWrapper}>
                    {loadingLocations ? (
                        <View style={[styles.loaderContainer, { backgroundColor: colors.surfaceMuted }]}>
                            <ActivityIndicator size="large" color={colors.info} />
                            <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Konumlar yükleniyor...</Text>
                        </View>
                    ) : locations.length === 0 ? (
                        <View style={[styles.emptyContainer, { backgroundColor: colors.surfaceMuted }]}>
                            <View style={[styles.emptyIconCircle, { backgroundColor: `${colors.info}15` }]}>
                                <MaterialCommunityIcons name="map-marker-off-outline" size={44} color={colors.info} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>Konum Verisi Bulunamadı</Text>
                            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                                Seçilen teknisyen için bu tarihte kaydedilmiş herhangi bir konum verisi mevcut değil.
                            </Text>
                        </View>
                    ) : (
                        <View style={StyleSheet.absoluteFillObject}>
                            <MapView
                                ref={mapRef}
                                style={StyleSheet.absoluteFill}
                                provider={getMapProvider()}
                                initialRegion={defaultRegion}
                                showsUserLocation={false}
                                showsMyLocationButton={false}
                                showsCompass={true}
                                showsScale={true}
                                rotateEnabled={true}
                                pitchEnabled={false}
                                toolbarEnabled={false}
                            >
                                {/* Route Path (Polyline) */}
                                {routePoints.length >= 2 && (
                                    <Polyline
                                        coordinates={routePoints}
                                        strokeColor={serviceBlue}
                                        strokeWidth={5}
                                        lineJoin="round"
                                        lineCap="round"
                                    />
                                )}

                                {/* Markers */}
                                {locations.map((loc, idx) => renderMarker(loc, idx))}
                            </MapView>

                            {/* Top floating overlay card showing metrics */}
                            <View style={[styles.floatingMetrics, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
                                <View style={styles.metricItem}>
                                    <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>TOPLAM YOL</Text>
                                    <Text style={[styles.metricVal, { color: colors.text }]}>
                                        {totalDistance > 0 ? `${totalDistance.toFixed(2)} km` : '0 km'}
                                    </Text>
                                </View>
                                <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
                                <View style={styles.metricItem}>
                                    <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>KONUM SAYISI</Text>
                                    <Text style={[styles.metricVal, { color: colors.text }]}>{locations.length}</Text>
                                </View>
                            </View>

                            {/* Extended FAB: open daily route history bottom sheet */}
                            <Pressable
                                onPress={() => setIsRouteHistoryVisible(true)}
                                style={({ pressed }) => [
                                    styles.fabButton,
                                    {
                                        backgroundColor: colors.info,
                                        shadowColor: colors.shadow,
                                        opacity: pressed ? 0.85 : 1,
                                        bottom: 24 + insets.bottom,
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons name="map-marker-path" size={20} color="#fff" />
                                <Text style={styles.fabLabel}>Rota Geçmişi</Text>
                                {locations.length > 0 && (
                                    <View style={styles.fabBadge}>
                                        <Text style={styles.fabBadgeText}>{locations.length}</Text>
                                    </View>
                                )}
                            </Pressable>
                        </View>
                    )}
                </View>
            )}

            {/* Modal: Technician Selection List */}
            <TechnicianPickerSheet
                ref={techPickerRef}
                technicians={technicians}
                loading={loadingTechs}
                selectedTechnicianId={selectedTechnician?.id}
                includeUnassigned={false}
                onSelect={(tech) => {
                    setSelectedTechnician(tech);
                    techPickerRef.current?.dismiss();
                }}
            />

            {/* Bottom Sheet: Daily Route History */}
            <AppBottomSheet
                visible={isRouteHistoryVisible}
                onClose={() => setIsRouteHistoryVisible(false)}
                snapPoints={['45%', '90%']}
                contentContainerStyle={styles.routeHistoryContainer}
                wrapContent={false}
            >
                <BottomSheetFlatList
                    ref={routeHistoryListRef}
                    style={styles.routeHistoryList}
                    data={locations}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.routeHistoryListContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        <View style={[styles.routeHistoryHeader, { borderBottomColor: colors.border }]}>
                            <View style={styles.routeHistoryTitleWrap}>
                                <MaterialCommunityIcons
                                    name="history"
                                    size={20}
                                    color={colors.info}
                                    style={{ marginRight: 8 }}
                                />
                                <Text style={[styles.routeHistoryTitle, { color: colors.text }]}>
                                    Günlük Rota Geçmişi
                                </Text>
                                <View style={[styles.routeHistoryCount, { backgroundColor: `${colors.info}15` }]}>
                                    <Text style={[styles.routeHistoryCountText, { color: colors.info }]}>
                                        {locations.length}
                                    </Text>
                                </View>
                                {selectedLocation && (
                                    <Text
                                        style={[styles.routeHistoryActiveText, { color: colors.textSecondary }]}
                                        numberOfLines={1}
                                    >
                                        Aktif: {dayjs(selectedLocation.created_at).format('HH:mm')} - {selectedLocation.location || `${selectedLocation.latitude}, ${selectedLocation.longitude}`}
                                    </Text>
                                )}
                            </View>
                            <Pressable
                                onPress={() => setIsRouteHistoryVisible(false)}
                                style={styles.routeHistoryCloseButton}
                            >
                                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                            </Pressable>
                        </View>
                    }
                    onScrollToIndexFailed={({ index }) => {
                        setTimeout(() => {
                            routeHistoryListRef.current?.scrollToIndex({
                                index,
                                animated: true,
                                viewPosition: 0.25,
                            });
                        }, 180);
                    }}
                    ListEmptyComponent={
                        !loadingLocations && (
                            <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>
                                Haritada rota oluşturmak için en az iki nokta bulunmalıdır.
                            </Text>
                        )
                    }
                    renderItem={({ item, index }) => {
                        const isFirst = index === 0;
                        const isLast = index === locations.length - 1;
                        const isSelected = String(selectedLocationId || '') === String(item.id);
                        let badgeColor = colors.info;
                        if (isFirst) badgeColor = serviceGreen;
                        if (isLast) badgeColor = serviceRed;

                        return (
                            <Pressable
                                onPress={() => {
                                    setSelectedLocationId(item.id);
                                    focusOnLocation(item);
                                    setIsRouteHistoryVisible(false);
                                }}
                                style={({ pressed }) => [
                                    styles.listItem,
                                    {
                                        backgroundColor: isSelected ? `${colors.info}10` : colors.surface,
                                        borderColor: isSelected ? colors.info : colors.border,
                                        opacity: pressed ? 0.8 : 1,
                                    },
                                ]}
                            >
                                <View style={[styles.listItemBadge, { backgroundColor: badgeColor }]}>
                                    <Text style={styles.badgeNumberText}>{index + 1}</Text>
                                </View>
                                <View style={styles.listItemContent}>
                                    <Text
                                        style={[styles.listItemAddress, { color: colors.text }]}
                                        numberOfLines={2}
                                    >
                                        {buildDisplayAddress(item, resolvedAddresses)}
                                    </Text>
                                    <View style={styles.listItemMeta}>
                                        <MaterialCommunityIcons
                                            name="clock-outline"
                                            size={12}
                                            color={colors.textSecondary}
                                            style={{ marginRight: 3 }}
                                        />
                                        <Text style={[styles.listItemTime, { color: colors.textSecondary }]}>
                                            Saat: {dayjs(item.created_at).format('HH:mm:ss')}
                                        </Text>
                                    </View>
                                </View>
                                <MaterialCommunityIcons
                                    name="crosshairs-gps"
                                    size={18}
                                    color={colors.textTertiary}
                                />
                            </Pressable>
                        );
                    }}
                />
            </AppBottomSheet>
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
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 4,
        marginLeft: -8,
    },
    headerTitleContainer: {
        flex: 1,
        marginLeft: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    headerSub: {
        fontSize: 13,
        marginTop: 1,
    },
    techSelectButton: {
        padding: 8,
        borderRadius: 10,
        borderWidth: 1,
    },
    calendarModal: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 24,
    },
    calendarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    calendarCloseButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calendarTitle: {
        fontSize: 18,
        fontWeight: '800',
        textTransform: 'capitalize',
    },
    calendarNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 14,
        marginBottom: 18,
    },
    calendarNavButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calendarTodayButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
    },
    calendarTodayText: {
        fontSize: 13,
        fontWeight: '800',
    },
    calendarWeekdays: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    calendarWeekdayText: {
        flex: 1,
        textAlign: 'center',
        fontSize: 12,
        fontWeight: '700',
    },
    calendarDaysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    calendarDayCell: {
        width: '14.2857%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        position: 'relative',
    },
    calendarDaySelected: {
        borderRadius: 20,
    },
    calendarDayText: {
        fontSize: 15,
        fontWeight: '600',
    },
    calendarDayHasRecords: {
        fontWeight: '800',
    },
    calendarDayDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginTop: 4,
    },
    filterBar: {
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        alignItems: 'center',
        gap: 8,
    },
    techFilterBtn: {
        flex: 1.2,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
    techFilterBtnText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '700',
    },
    dateNavigatorCompact: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dateNavButtonCompact: {
        padding: 4,
    },
    dateDisplayCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    dateTextCompact: {
        fontSize: 13,
        fontWeight: '700',
    },
    mapWrapper: {
        flex: 1,
        width: '100%',
        position: 'relative',
    },
    loaderContainer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loaderText: {
        marginTop: 12,
        fontSize: 14,
        fontWeight: '600',
    },
    emptyContainer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '800',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyDesc: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },
    floatingMetrics: {
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    metricItem: {
        flex: 1,
        alignItems: 'center',
    },
    metricLabel: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    metricVal: {
        fontSize: 16,
        fontWeight: '800',
    },
    metricDivider: {
        width: 1,
        height: 28,
        marginHorizontal: 8,
    },
    fabButton: {
        position: 'absolute',
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 14,
        paddingRight: 14,
        height: 48,
        borderRadius: 24,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 6,
    },
    fabLabel: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
        marginLeft: 8,
    },
    fabBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        minWidth: 22,
        height: 22,
        paddingHorizontal: 6,
        borderRadius: 11,
        backgroundColor: serviceOrange,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    fabBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '800',
    },
    routeHistoryContainer: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 8,
    },
    routeHistoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingTop: 4,
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    routeHistoryTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        flex: 1,
    },
    routeHistoryTitle: {
        fontSize: 16,
        fontWeight: '800',
    },
    routeHistoryActiveText: {
        width: '100%',
        marginTop: 4,
        paddingLeft: 28,
        fontSize: 11,
        fontWeight: '700',
    },
    routeHistoryCount: {
        marginLeft: 10,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 999,
    },
    routeHistoryCountText: {
        fontSize: 12,
        fontWeight: '800',
    },
    routeHistoryCloseButton: {
        padding: 4,
        marginLeft: 8,
    },
    routeHistoryListContent: {
        padding: 16,
        paddingBottom: 32,
    },
    routeHistoryList: {
        flex: 1,
    },
    emptyListText: {
        fontSize: 13,
        textAlign: 'center',
        marginTop: 20,
        fontStyle: 'italic',
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 8,
    },
    listItemBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    badgeNumberText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '800',
    },
    listItemContent: {
        flex: 1,
        marginRight: 8,
    },
    listItemAddress: {
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
    },
    listItemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    listItemTime: {
        fontSize: 11,
    },
    // Markers style
    markerWrap: {
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    markerTapArea: {
        width: 52,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
    },
    markerTapAreaSelected: {
        width: 58,
        height: 58,
    },
    markerNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 4,
    },
    markerSpecial: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    markerSelected: {
        borderWidth: 3,
        transform: [{ scale: 1.12 }],
    },
    markerText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '900',
    },
    markerTail: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        marginTop: -2,
    },
    // Modal Select Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '75%',
        paddingBottom: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    closeButton: {
        padding: 4,
    },
    modalLoader: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetList: {
        flex: 1,
    },
    modalListContent: {
        padding: 16,
        paddingBottom: 48,
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 8,
    },
    avatarCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    avatarText: {
        fontSize: 14,
        fontWeight: '700',
    },
    modalItemDetails: {
        flex: 1,
    },
    techName: {
        fontSize: 14,
        fontWeight: '700',
    },
    techStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    techStatusText: {
        fontSize: 11,
    },
});
