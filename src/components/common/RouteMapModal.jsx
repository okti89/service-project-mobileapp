import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Linking, ActivityIndicator, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { sp, fs } from '@/theme/scale';
import { spacing } from '@/theme/spacing';
import api from '@/api/axios';
import AppBottomSheet from '@/components/AppBottomSheet';

export default function RouteMapModal({ visible, onClose, address, customerName }) {
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();
    const mapRef = useRef(null);

    const [geocoding, setGeocoding] = useState(false);
    const [mapCoords, setMapCoords] = useState(null);
    const [userCoords, setUserCoords] = useState(null);
    const [routePoints, setRoutePoints] = useState([]);
    const [routeDistance, setRouteDistance] = useState('');
    const [routeDuration, setRouteDuration] = useState('');

    const decodePolyline = (encoded) => {
        if (!encoded) return [];
        let index = 0, lat = 0, lng = 0;
        const coordinates = [];
        while (index < encoded.length) {
            let b, shift = 0, result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lat += dlat;
            shift = 0; result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lng += dlng;
            coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
        }
        return coordinates;
    };

    useEffect(() => {
        if (visible && address) {
            fetchMapData();
        } else {
            setMapCoords(null);
            setUserCoords(null);
            setRoutePoints([]);
            setRouteDistance('');
            setRouteDuration('');
        }
    }, [visible, address]);

    const fetchMapData = async () => {
        setGeocoding(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showToast('error', 'İzin', 'Konum izni verilmedi. Rota gösterilemiyor.');
                setGeocoding(false);
                return;
            }

            const results = await Location.geocodeAsync(address);
            if (results && results.length > 0) {
                const target = results[0];
                const targetCoords = {
                    latitude: target.latitude,
                    longitude: target.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                };
                setMapCoords(targetCoords);

                fetchRouteInBackground(target);
            } else {
                showToast('error', 'Hata', 'Adres koordinatları bulunamadı.');
            }
        } catch (err) {
            showToast('error', 'Hata', 'Konum sorgulanırken bir sorun oluştu.');
        } finally {
            setGeocoding(false);
        }
    };

    const fetchRouteInBackground = async (target) => {
        try {
            let currentPos = await Location.getLastKnownPositionAsync();
            if (!currentPos) {
                currentPos = await Promise.race([
                    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
                ]);
            }

            if (currentPos?.coords) {
                const currentVal = { latitude: currentPos.coords.latitude, longitude: currentPos.coords.longitude };
                setUserCoords(currentVal);

                const origin = `${currentVal.latitude},${currentVal.longitude}`;
                const dest = `${target.latitude},${target.longitude}`;

                const response = await api.get('/maps/directions/', { params: { origin, dest } });
                const route = response?.data?.routes?.[0];
                if (route) {
                    if (route.overview_polyline?.points) {
                        setRoutePoints(decodePolyline(route.overview_polyline.points));
                    } else if (Array.isArray(route.geometry?.coordinates)) {
                        setRoutePoints(route.geometry.coordinates.map(([lon, lat]) => ({ latitude: lat, longitude: lon })));
                    }

                    const leg = route.legs?.[0];
                    if (leg) {
                        setRouteDistance(leg.distance?.text || '');
                        setRouteDuration(leg.duration?.text || '');
                    }

                    setTimeout(() => {
                        if (mapRef.current && currentVal && target) {
                            mapRef.current.fitToCoordinates(
                                [ { latitude: currentVal.latitude, longitude: currentVal.longitude }, { latitude: target.latitude, longitude: target.longitude } ],
                                { edgePadding: { top: 80, right: 80, bottom: 80, left: 80 }, animated: true }
                            );
                        }
                    }, 600);
                }
            }
        } catch (posErr) {
            console.log('Arka planda konum/yol tarifi alınamadı:', posErr);
        }
    };

    const handleExternalNavigation = () => {
        if (!mapCoords) return;
        const url = Platform.select({
            ios: `maps:0,0?q=${mapCoords.latitude},${mapCoords.longitude}`,
            android: `geo:${mapCoords.latitude},${mapCoords.longitude}?q=${mapCoords.latitude},${mapCoords.longitude}`,
            default: `https://www.google.com/maps/search/?api=1&query=${mapCoords.latitude},${mapCoords.longitude}`,
        });
        Linking.openURL(url).catch(() => {
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${mapCoords.latitude},${mapCoords.longitude}`);
        });
    };

    return (
        <AppBottomSheet visible={visible} onClose={onClose} snapPoints={['90%']} wrapContent={false}>
                <View style={styles.mapModalContainer}>
                    <View style={styles.mapModalHeader}>
                        <View style={{ flex: 1, paddingRight: spacing.m }}>
                            <Text style={[styles.mapModalTitle, { color: colors.text }]} numberOfLines={1}>
                                {customerName || 'Müşteri Konumu'}
                            </Text>
                            {routeDistance && routeDuration ? (
                                <Text style={[styles.mapModalSubtitle, { color: colors.textSecondary }]}>
                                    {routeDistance} • {routeDuration}
                                </Text>
                            ) : null}
                        </View>
                        <Pressable onPress={onClose} style={[styles.mapModalCloseBtn, { backgroundColor: isDark ? colors.background : '#F1F5F9' }]}>
                            <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                        </Pressable>
                    </View>

                    <View style={[styles.mapWrap, { borderColor: colors.border }]}>
                        {geocoding && !mapCoords ? (
                            <View style={[styles.center, { backgroundColor: isDark ? colors.background : '#F8FAFC' }]}>
                                <ActivityIndicator size="large" color="#2563EB" />
                                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Adres bulunuyor...</Text>
                            </View>
                        ) : mapCoords ? (
                            <MapView
                                ref={mapRef}
                                style={StyleSheet.absoluteFillObject}
                                initialRegion={{
                                    ...mapCoords,
                                    latitudeDelta: 0.01,
                                    longitudeDelta: 0.01,
                                }}
                                showsUserLocation={true}
                                showsMyLocationButton={true}
                            >
                                {userCoords && (
                                    <Marker
                                        coordinate={userCoords}
                                        title="Senin Konumun"
                                        pinColor="blue"
                                    />
                                )}
                                <Marker
                                    coordinate={mapCoords}
                                    title={customerName || "Hedef Konum"}
                                    description={address}
                                    pinColor="red"
                                />
                                {routePoints.length > 0 && (
                                    <Polyline
                                        coordinates={routePoints}
                                        strokeColor="#2563EB"
                                        strokeWidth={4}
                                    />
                                )}
                            </MapView>
                        ) : (
                            <View style={[styles.center, { backgroundColor: isDark ? colors.background : '#F8FAFC' }]}>
                                <MaterialCommunityIcons name="map-marker-off-outline" size={32} color={colors.textTertiary} />
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Harita yüklenemedi.</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.mapModalFooter}>
                        <Text style={[styles.mapAddressText, { color: colors.textTertiary }]} numberOfLines={2}>
                            {address}
                        </Text>
                        <Pressable
                            style={({ pressed }) => [styles.mapNavBtn, { backgroundColor: '#2563EB', opacity: pressed ? 0.8 : 1 }]}
                            onPress={handleExternalNavigation}
                            disabled={!mapCoords}
                        >
                            <MaterialCommunityIcons name="navigation-variant-outline" size={18} color="#fff" />
                            <Text style={styles.mapNavBtnText}>Navigasyonu Başlat</Text>
                        </Pressable>
                    </View>
                </View>
        </AppBottomSheet>
    );
}

const styles = StyleSheet.create({
        mapModalContainer: { flex: 1, paddingHorizontal: spacing.gutter, paddingTop: spacing.s },
    mapModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.m },
    mapModalTitle: { fontSize: 16, fontWeight: '800' },
    mapModalSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    mapModalCloseBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    mapWrap: { flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
    mapModalFooter: { paddingVertical: spacing.m, gap: spacing.s, paddingBottom: 100 },
    mapAddressText: { fontSize: fs(12), fontWeight: '500', lineHeight: sp(18), textAlign: 'center' },
    mapNavBtn: { minHeight: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.s },
    mapNavBtnText: { color: '#fff', fontSize: fs(14), fontWeight: '700' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: sp(12) },
    loadingText: { fontSize: fs(14), fontWeight: '500' },
    emptyText: { fontSize: fs(14), fontWeight: '500' },
});
