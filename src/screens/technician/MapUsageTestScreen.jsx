import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView from 'react-native-maps';

import { useTheme } from '@/context/ThemeContext';
import { getMapProvider, isGoogleMapsKeyConfigured } from '@/config/maps';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

// İstanbul içinde farklı bölgeler (reverse geocoding çağrıları için)
const STRESS_COORDS = [
    { name: 'Taksim', latitude: 41.037, longitude: 28.985 },
    { name: 'Kadıköy', latitude: 40.9928, longitude: 29.0245 },
    { name: 'Beşiktaş', latitude: 41.0426, longitude: 29.0086 },
    { name: 'Üsküdar', latitude: 41.0214, longitude: 29.0108 },
    { name: 'Beyoğlu', latitude: 41.0369, longitude: 28.9844 },
    { name: 'Şişli', latitude: 41.0606, longitude: 28.9876 },
    { name: 'Fatih', latitude: 41.0186, longitude: 28.9493 },
    { name: 'Bakırköy', latitude: 40.9819, longitude: 28.8611 },
    { name: 'Ataşehir', latitude: 40.9923, longitude: 29.1244 },
    { name: 'Maltepe', latitude: 40.9243, longitude: 29.1492 },
    { name: 'Pendik', latitude: 40.8783, longitude: 29.2545 },
    { name: 'Kartal', latitude: 40.8861, longitude: 29.1842 },
    { name: 'Sarıyer', latitude: 41.1664, longitude: 29.0479 },
    { name: 'Beykoz', latitude: 41.1284, longitude: 29.1056 },
    { name: 'Sancaktepe', latitude: 41.0025, longitude: 29.2319 },
];

const ANIMATE_TARGETS = [
    { name: 'Türkiye Geneli', latitude: 39.0, longitude: 35.0, latitudeDelta: 12, longitudeDelta: 12 },
    { name: 'İstanbul Detay', latitude: 41.0082, longitude: 28.9784, latitudeDelta: 0.1, longitudeDelta: 0.1 },
    { name: 'Sokak Seviyesi', latitude: 41.0082, longitude: 28.9784, latitudeDelta: 0.005, longitudeDelta: 0.005 },
    { name: 'Bina Seviyesi', latitude: 41.0082, longitude: 28.9784, latitudeDelta: 0.0008, longitudeDelta: 0.0008 },
];

const StatCard = memo(function StatCard({ label, value, color, icon }) {
    return (
        <View style={[styles.statCard, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
            <View style={[styles.statIconWrap, { backgroundColor: color }]}>
                <MaterialCommunityIcons name={icon} size={14} color="#fff" />
            </View>
            <View style={styles.statBody}>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
            </View>
        </View>
    );
});

const ActionButton = memo(function ActionButton({ icon, label, onPress, color, disabled }) {
    return (
        <Pressable
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: color, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
            ]}
        >
            <MaterialCommunityIcons name={icon} size={16} color="#fff" />
            <Text style={styles.actionBtnText}>{label}</Text>
        </Pressable>
    );
});

const LogRow = memo(function LogRow({ item, colors }) {
    return (
        <View style={[styles.logRow, { borderBottomColor: colors.divider }]}>
            <View style={[styles.logDot, { backgroundColor: item.color }]} />
            <View style={styles.logBody}>
                <Text style={[styles.logLabel, { color: colors.text }]}>{item.label}</Text>
                {item.detail ? (
                    <Text style={[styles.logDetail, { color: colors.textSecondary }]} numberOfLines={2}>
                        {item.detail}
                    </Text>
                ) : null}
            </View>
            <Text style={[styles.logTime, { color: colors.textTertiary }]}>{item.time}</Text>
        </View>
    );
});

export default function MapUsageTestScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const mapRef = useRef(null);
    const sessionStartRef = useRef(Date.now());

    // Sayaçlar (kullanıcı butonlarla artırır)
    const [mapMounts, setMapMounts] = useState(0);
    const [mapReady, setMapReady] = useState(0);
    const [willRenderMap, setWillRenderMap] = useState(0);
    const [didFinishRender, setDidFinishRender] = useState(0);
    const [regionChange, setRegionChange] = useState(0);
    const [regionChangeComplete, setRegionChangeComplete] = useState(0);
    const [pressCount, setPressCount] = useState(0);
    const [longPressCount, setLongPressCount] = useState(0);
    const [markerSelect, setMarkerSelect] = useState(0);
    const [cameraMove, setCameraMove] = useState(0);
    const [cameraIdle, setCameraIdle] = useState(0);

    // Reverse geocoding sayaçları
    const [geocodeCalls, setGeocodeCalls] = useState(0);
    const [geocodeCacheHits, setGeocodeCacheHits] = useState(0);
    const [geocodeFailures, setGeocodeFailures] = useState(0);
    const [geocodeAvgMs, setGeocodeAvgMs] = useState(0);
    const geocodeTimerRef = useRef(null);

    // Backend reverse geocoding sayaçları (DB kota takibi için)
    const [backendGeocodeCalls, setBackendGeocodeCalls] = useState(0);
    const [backendGeocodeCacheHits, setBackendGeocodeCacheHits] = useState(0);
    const [backendGeocodeFallback, setBackendGeocodeFallback] = useState(0);
    const [backendGeocodeQuotaExceeded, setBackendGeocodeQuotaExceeded] = useState(0);
    const [backendGeocodeAvgMs, setBackendGeocodeAvgMs] = useState(0);
    const [lastBackendQuota, setLastBackendQuota] = useState(null);
    const [backendStressRunning, setBackendStressRunning] = useState(false);

    // Sayaç + log state
    const [logs, setLogs] = useState([]);
    const [mapKey, setMapKey] = useState(0);
    const [resetTick, setResetTick] = useState(0);
    const [stressRunning, setStressRunning] = useState(false);
    const [elapsedSec, setElapsedSec] = useState(0);

    // Sayaçlar tek bir objede gruplanır - reset kolaylığı için
    const counterSetters = useMemo(() => ([
        setMapMounts, setMapReady, setWillRenderMap, setDidFinishRender,
        setRegionChange, setRegionChangeComplete, setPressCount, setLongPressCount,
        setMarkerSelect, setCameraMove, setCameraIdle,
        setGeocodeCalls, setGeocodeCacheHits, setGeocodeFailures, setGeocodeAvgMs,
        setBackendGeocodeCalls, setBackendGeocodeCacheHits, setBackendGeocodeFallback,
        setBackendGeocodeQuotaExceeded, setBackendGeocodeAvgMs,
    ]), []);

    // Sayaç değerleri (render için)
    const counters = useMemo(() => ({
        mapMounts, mapReady, willRenderMap, didFinishRender,
        regionChange, regionChangeComplete, pressCount, longPressCount,
        markerSelect, cameraMove, cameraIdle,
        geocodeCalls, geocodeCacheHits, geocodeFailures, geocodeAvgMs,
        backendGeocodeCalls, backendGeocodeCacheHits, backendGeocodeFallback,
        backendGeocodeQuotaExceeded, backendGeocodeAvgMs,
    }), [resetTick,
        mapMounts, mapReady, willRenderMap, didFinishRender,
        regionChange, regionChangeComplete, pressCount, longPressCount,
        markerSelect, cameraMove, cameraIdle,
        geocodeCalls, geocodeCacheHits, geocodeFailures, geocodeAvgMs,
        backendGeocodeCalls, backendGeocodeCacheHits, backendGeocodeFallback,
        backendGeocodeQuotaExceeded, backendGeocodeAvgMs,
    ]);

    // Geçen süre (her saniye güncellenir)
    React.useEffect(() => {
        const id = setInterval(() => {
            setElapsedSec(Math.floor((Date.now() - sessionStartRef.current) / 1000));
        }, 1000);
        return () => clearInterval(id);
    }, []);

    React.useEffect(() => () => {
        if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    }, []);

    const provider = useMemo(() => getMapProvider(), []);
    const googleKeyReady = useMemo(() => isGoogleMapsKeyConfigured(), []);

    // MapView ilk mount
    React.useEffect(() => {
        setMapMounts(c => c + 1);
        pushLog('MapView mount edildi (sayfa açıldı)', 'mapMount', `${Platform.OS} · provider=${provider === 'google' ? 'GOOGLE' : 'DEFAULT'}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- LOG yardımcıları ----
    const pushLog = useCallback((label, color, detail) => {
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        setLogs(prev => [
            { id: `${Date.now()}-${Math.random()}`, label, detail, time, color: COLORS_MAP[color] || COLORS_MAP.info },
            ...prev,
        ].slice(0, 60));
    }, []);

    // ---- Map lifecycle ----
    const handleMapReady = useCallback(() => {
        setMapReady(c => c + 1);
        pushLog('onMapReady', 'success', 'Tile yükleme altyapısı hazır');
    }, [pushLog]);

    const handleWillStart = useCallback(() => {
        setWillRenderMap(c => c + 1);
        pushLog('onWillStartRenderingMap', 'warning', 'Yeni frame render başlıyor');
    }, [pushLog]);

    const handleDidFinish = useCallback((args) => {
        setDidFinishRender(c => c + 1);
        pushLog('onDidFinishRenderingMap', 'success', `Fully=${args?.fully ? 'true' : 'false'}`);
    }, [pushLog]);

    const handleRegionChange = useCallback((region) => {
        setRegionChange(c => c + 1);
    }, []);

    const handleRegionChangeComplete = useCallback((region) => {
        setRegionChangeComplete(c => c + 1);
        const delta = region?.latitudeDelta?.toFixed(3) ?? '?';
        pushLog('onRegionChangeComplete', 'info', `zoom delta=${delta} (küçük = yakın, fazla tile)`);
    }, [pushLog]);

    const handlePress = useCallback((e) => {
        setPressCount(c => c + 1);
        const c2 = e?.nativeEvent?.coordinate;
        pushLog('onPress (harita)', 'info', c2 ? `${c2.latitude.toFixed(4)}, ${c2.longitude.toFixed(4)}` : null);
    }, [pushLog]);

    const handleLongPress = useCallback((e) => {
        setLongPressCount(c => c + 1);
        const c2 = e?.nativeEvent?.coordinate;
        pushLog('onLongPress', 'warning', c2 ? `${c2.latitude.toFixed(4)}, ${c2.longitude.toFixed(4)}` : null);
    }, [pushLog]);

    const handleMarkerSelect = useCallback((e) => {
        setMarkerSelect(c => c + 1);
        pushLog('onMarkerSelect', 'success');
    }, [pushLog]);

    const handleMarkerDeselect = useCallback(() => {
        pushLog('onMarkerDeselect', 'info');
    }, [pushLog]);

    const handleCalloutPress = useCallback(() => {
        pushLog('onCalloutPress', 'info');
    }, [pushLog]);

    const handleCameraMove = useCallback(() => {
        setCameraMove(c => c + 1);
    }, []);

    const handleCameraIdle = useCallback(() => {
        setCameraIdle(c => c + 1);
        pushLog('onCameraIdle', 'success', 'Tüm tile animasyonları tamamlandı');
    }, [pushLog]);

    // ---- Reverse Geocoding test ----
    const geocodeCacheRef = useRef(new Map());

    const runSingleGeocode = useCallback(async (coord, label) => {
        const key = `${coord.latitude.toFixed(5)},${coord.longitude.toFixed(5)}`;
        if (geocodeCacheRef.current.has(key)) {
            setGeocodeCacheHits(c => c + 1);
            pushLog('Geocode cache HIT', 'success', `${label} · ${key}`);
            return;
        }
        const t0 = Date.now();
        setGeocodeCalls(c => c + 1);
        try {
            const results = await Location.reverseGeocodeAsync({
                latitude: coord.latitude,
                longitude: coord.longitude,
            });
            const elapsed = Date.now() - t0;
            setGeocodeAvgMs(prev => prev === 0 ? elapsed : Math.round((prev * 0.7) + (elapsed * 0.3)));
            if (results && results.length > 0) {
                const g = results[0];
                const composed = [g.street, g.name, g.district, g.city].filter(Boolean).join(', ') || `${coord.latitude},${coord.longitude}`;
                geocodeCacheRef.current.set(key, composed);
                pushLog('Geocode OK', 'success', `${label} · ${elapsed}ms · ${composed}`);
            } else {
                pushLog('Geocode EMPTY', 'warning', `${label} · ${elapsed}ms`);
            }
        } catch (err) {
            setGeocodeFailures(c => c + 1);
            pushLog('Geocode FAIL', 'error', `${label} · ${err?.message || 'bilinmeyen'}`);
        }
    }, [pushLog]);

    const runStressGeocode = useCallback(async () => {
        if (stressRunning) return;
        setStressRunning(true);
        pushLog('Stres testi başladı', 'warning', `${STRESS_COORDS.length} ardışık istek`);
        for (const coord of STRESS_COORDS) {
            await runSingleGeocode(coord, coord.name);
            // iOS yumuşak rate-limit'e takılmamak için kısa bekleme
            await new Promise(r => setTimeout(r, 250));
        }
        pushLog('Stres testi tamamlandı', 'success', `${STRESS_COORDS.length} istek bitti`);
        setStressRunning(false);
    }, [stressRunning, runSingleGeocode, pushLog]);

    // ---- BACKEND Reverse Geocoding (DB kota takibi) ----
    const backendGeocodeCacheRef = useRef(new Map());

    const runSingleBackendGeocode = useCallback(async (coord, label) => {
        const key = `${coord.latitude.toFixed(5)},${coord.longitude.toFixed(5)}`;
        if (backendGeocodeCacheRef.current.has(key)) {
            setBackendGeocodeCacheHits(c => c + 1);
            pushLog('Backend cache HIT', 'success', `${label} · ${key}`);
            return;
        }
        const t0 = Date.now();
        setBackendGeocodeCalls(c => c + 1);
        try {
            const response = await api.get(ENDPOINTS.MAPS.GEOCODE, {
                params: { lat: coord.latitude, lon: coord.longitude },
            });
            const elapsed = Date.now() - t0;
            setBackendGeocodeAvgMs(prev => prev === 0 ? elapsed : Math.round((prev * 0.7) + (elapsed * 0.3)));
            if (response?.data?.quota) {
                setLastBackendQuota(response.data.quota);
            }
            if (response?.data?.cached) {
                setBackendGeocodeCacheHits(c => c + 1);
                const noCharge = response?.data?.from_cache_no_charge ? '✓ kota DÜŞMEDİ' : '✗ kota düştü (bug)';
                pushLog('Backend CACHED', 'info', `${label} · ${elapsed}ms · ${noCharge} · ${response.data.display_name}`);
            } else {
                pushLog('Backend OK (charged)', 'success', `${label} · ${elapsed}ms · kota düştü · ${response.data.display_name}`);
            }
            backendGeocodeCacheRef.current.set(key, response.data.display_name);
        } catch (err) {
            const status = err?.response?.status;
            const elapsed = Date.now() - t0;
            if (status === 429) {
                setBackendGeocodeQuotaExceeded(c => c + 1);
                pushLog('Backend 429 QUOTA', 'error', `${label} · kota aşıldı → OS-native fallback`);
            } else {
                setBackendGeocodeFallback(c => c + 1);
                pushLog('Backend FAIL', 'warning', `${label} · ${status ?? 'net'} · ${elapsed}ms → OS-native fallback`);
            }
        }
    }, [pushLog]);

    const runStressBackendGeocode = useCallback(async () => {
        if (backendStressRunning) return;
        setBackendStressRunning(true);
        pushLog('Backend stres testi başladı', 'warning', `${STRESS_COORDS.length} ardışık istek (kota artacak!)`);
        for (const coord of STRESS_COORDS) {
            await runSingleBackendGeocode(coord, coord.name);
            await new Promise(r => setTimeout(r, 200));
        }
        pushLog('Backend stres testi tamamlandı', 'success', `${STRESS_COORDS.length} istek bitti`);
        setBackendStressRunning(false);
    }, [backendStressRunning, runSingleBackendGeocode, pushLog]);

    // ---- Harita aksiyonları ----
    const animateToTarget = useCallback((target) => {
        if (!mapRef.current) return;
        mapRef.current.animateToRegion(target, 600);
        pushLog('animateToRegion', 'info', target.name);
    }, [pushLog]);

    const forceRemount = useCallback(() => {
        setMapKey(k => k + 1);
        setMapMounts(c => c + 1);
        pushLog('MapView yeniden mount', 'warning', 'Bu bir "Map Load" sayılır (Google faturalama)');
    }, [pushLog]);

    // ---- Sayaçları sıfırla ----
    const resetCounters = useCallback(() => {
        counterSetters.forEach(setter => setter(0));
        setLogs([]);
        sessionStartRef.current = Date.now();
        setElapsedSec(0);
        setResetTick(t => t + 1);
        geocodeCacheRef.current = new Map();
        backendGeocodeCacheRef.current = new Map();
        setLastBackendQuota(null);
    }, [counterSetters]);

    const goBack = useCallback(() => {
        if (navigation?.canGoBack?.()) navigation.goBack();
    }, [navigation]);

    const providerLabel = provider === 'google' ? 'Google Maps' : (Platform.OS === 'ios' ? 'Apple Maps' : 'Google (no key)');
    const tileEngine = Platform.OS === 'ios' ? 'Apple Maps (kota yok)' : (googleKeyReady ? 'Google Maps SDK (kotalı)' : 'Default (boş tile)');

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
                <Pressable onPress={goBack} hitSlop={12} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Map & Geocoding Kotası Testi</Text>
                    <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
                        {providerLabel} · {tileEngine}
                    </Text>
                </View>
                <Pressable onPress={resetCounters} hitSlop={12} style={[styles.resetBtn, { backgroundColor: colors.surfaceMuted }]}>
                    <MaterialCommunityIcons name="restart" size={18} color={colors.text} />
                </Pressable>
            </View>

            <ScrollView
                contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Aktif engine uyarı kartı */}
                <View style={[styles.engineCard, { backgroundColor: googleKeyReady ? '#FFF7E5' : '#E8F5E9', borderColor: googleKeyReady ? '#FFB020' : '#34A853' }]}>
                    <MaterialCommunityIcons
                        name={googleKeyReady ? 'alert-circle' : 'check-circle'}
                        size={20}
                        color={googleKeyReady ? '#FF8C00' : '#00A36C'}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.engineTitle, { color: colors.text }]}>
                            {googleKeyReady ? 'Google Maps SDK Aktif (Kotalı)' : 'Apple Maps / Kotasız Mod'}
                        </Text>
                        <Text style={[styles.engineDesc, { color: colors.textSecondary }]}>
                            {googleKeyReady
                                ? 'Android: her MapView mount = 1 Map Load. Google $200/ay ücretsiz kredi (~28.500 yükleme/ay).'
                                : 'iOS: Apple Maps kotasız. Reverse Geocoding: OS-native (CLGeocoder / Geocoder), API key ve kota yok.'}
                        </Text>
                    </View>
                </View>

                {/* Sayaç grid'i */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Sayaçlar ({elapsedSec}s)</Text>
                <View style={styles.statsGrid}>
                    <StatCard label="Map Mount" value={counters.mapMounts} color="#0066CC" icon="map-plus" />
                    <StatCard label="Map Ready" value={counters.mapReady} color="#00A36C" icon="check-decagram" />
                    <StatCard label="Will Render" value={counters.willRenderMap} color="#FF8C00" icon="progress-clock" />
                    <StatCard label="Render Done" value={counters.didFinishRender} color="#00875A" icon="check-circle-outline" />
                    <StatCard label="Region Change" value={counters.regionChange} color="#7B61FF" icon="gesture-swipe-horizontal" />
                    <StatCard label="Region Complete" value={counters.regionChangeComplete} color="#5A4BD1" icon="gesture-tap-hold" />
                    <StatCard label="Camera Move" value={counters.cameraMove} color="#DC3545" icon="camera-control" />
                    <StatCard label="Camera Idle" value={counters.cameraIdle} color="#B22B3C" icon="camera-iris" />
                    <StatCard label="Harita Tap" value={counters.pressCount} color="#0EA5E9" icon="gesture-tap" />
                    <StatCard label="Long Press" value={counters.longPressCount} color="#F59E0B" icon="gesture-two-tap" />
                    <StatCard label="Marker Select" value={counters.markerSelect} color="#10B981" icon="map-marker" />
                    <StatCard label="Geocode Call" value={counters.geocodeCalls} color="#0066CC" icon="map-search" />
                    <StatCard label="Geocode Cache" value={counters.geocodeCacheHits} color="#00A36C" icon="cached" />
                    <StatCard label="Geocode Fail" value={counters.geocodeFailures} color="#DC3545" icon="alert" />
                    <StatCard label="Avg Geocode" value={`${counters.geocodeAvgMs}ms`} color="#7B61FF" icon="timer-outline" />
                    <StatCard label="Backend Call" value={counters.backendGeocodeCalls} color="#0066CC" icon="server-network" />
                    <StatCard label="Backend Cache" value={counters.backendGeocodeCacheHits} color="#00A36C" icon="database-check" />
                    <StatCard label="Backend Fallback" value={counters.backendGeocodeFallback} color="#FF8C00" icon="call-missed" />
                    <StatCard label="Backend 429" value={counters.backendGeocodeQuotaExceeded} color="#DC3545" icon="speedometer" />
                    <StatCard label="Backend Avg" value={`${counters.backendGeocodeAvgMs}ms`} color="#7B61FF" icon="timer-sand" />
                </View>

                {/* Harita kontrol butonları */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Harita Aksiyonları (Tile yüklemeyi tetikler)</Text>
                <View style={styles.actionGrid}>
                    {ANIMATE_TARGETS.map(t => (
                        <ActionButton
                            key={t.name}
                            icon="image-filter-center-focus"
                            label={t.name}
                            color={colors.info}
                            onPress={() => animateToTarget(t)}
                        />
                    ))}
                    <ActionButton icon="restart-alert" label="MapView Yeniden Mount" color="#FF8C00" onPress={forceRemount} />
                </View>

                {/* Geocoding aksiyonları */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Reverse Geocoding (Kotasız OS-native)</Text>
                <View style={styles.actionGrid}>
                    {STRESS_COORDS.slice(0, 5).map(c => (
                        <ActionButton
                            key={c.name}
                            icon="crosshairs-gps"
                            label={c.name}
                            color="#7B61FF"
                            onPress={() => runSingleGeocode({ latitude: c.latitude, longitude: c.longitude }, c.name)}
                        />
                    ))}
                    <ActionButton
                        icon={stressRunning ? 'timer-sand' : 'rocket-launch-outline'}
                        label={stressRunning ? 'Çalışıyor…' : `${STRESS_COORDS.length} İstek Stres Testi`}
                        color={stressRunning ? '#9CA3AF' : '#DC3545'}
                        onPress={runStressGeocode}
                        disabled={stressRunning}
                    />
                </View>

                {/* Backend Reverse Geocoding (DB kota takibi - 'geocode' api type) */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Backend Reverse Geocoding (DB 'geocode' kota sayacı)</Text>
                {lastBackendQuota ? (
                    <View style={[styles.quotaCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="chart-donut" size={16} color={colors.info} />
                        <Text style={[styles.quotaText, { color: colors.text }]}>
                            {' '}Kota: {lastBackendQuota.used ?? '?'} / {lastBackendQuota.limit ?? '?'} (kalan: {lastBackendQuota.remaining ?? '?'})
                        </Text>
                    </View>
                ) : null}
                <View style={styles.actionGrid}>
                    {STRESS_COORDS.slice(0, 5).map(c => (
                        <ActionButton
                            key={`bk-${c.name}`}
                            icon="server"
                            label={c.name}
                            color="#0066CC"
                            onPress={() => runSingleBackendGeocode({ latitude: c.latitude, longitude: c.longitude }, c.name)}
                        />
                    ))}
                    <ActionButton
                        icon={backendStressRunning ? 'timer-sand' : 'rocket-launch'}
                        label={backendStressRunning ? 'Çalışıyor…' : `${STRESS_COORDS.length} İstek Backend Stres`}
                        color={backendStressRunning ? '#9CA3AF' : '#DC3545'}
                        onPress={runStressBackendGeocode}
                        disabled={backendStressRunning}
                    />
                </View>

                {/* Canlı harita */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Canlı Harita (Lifecycle dinleniyor)</Text>
                <View style={[styles.mapBox, { borderColor: colors.border }]}>
                    <MapView
                        key={mapKey}
                        ref={mapRef}
                        style={StyleSheet.absoluteFill}
                        provider={provider}
                        initialRegion={{ latitude: 41.0082, longitude: 28.9784, latitudeDelta: 0.1, longitudeDelta: 0.1 }}
                        showsUserLocation={false}
                        showsMyLocationButton={false}
                        toolbarEnabled={false}
                        onMapReady={handleMapReady}
                        onWillStartRenderingMap={handleWillStart}
                        onDidFinishRenderingMap={handleDidFinish}
                        onRegionChange={handleRegionChange}
                        onRegionChangeComplete={handleRegionChangeComplete}
                        onPress={handlePress}
                        onLongPress={handleLongPress}
                        onMarkerSelect={handleMarkerSelect}
                        onMarkerDeselect={handleMarkerDeselect}
                        onCalloutPress={handleCalloutPress}
                        onCameraMove={handleCameraMove}
                        onCameraIdle={handleCameraIdle}
                    />
                </View>

                {/* Event log */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Event Log (son 60)</Text>
                <View style={[styles.logBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {logs.length === 0 ? (
                        <View style={styles.logEmpty}>
                            <MaterialCommunityIcons name="text-box-search-outline" size={28} color={colors.textTertiary} />
                            <Text style={[styles.logEmptyText, { color: colors.textTertiary }]}>
                                Henüz olay yok. Yukarıdaki butonları kullanın.
                            </Text>
                        </View>
                    ) : (
                        logs.map(item => <LogRow key={item.id} item={item} colors={colors} />)
                    )}
                </View>

                {/* Kota açıklama kartı */}
                <View style={[styles.tipCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="information-outline" size={18} color={colors.info} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.tipTitle, { color: colors.text }]}>Kota Özeti</Text>
                        <Text style={[styles.tipBody, { color: colors.textSecondary }]}>
                            • Map Mount = yeni MapView instance. Google faturalama: 28.500 ücretsiz/ay.{'\n'}
                            • Region Change Complete = kamera durdu. Yeni tile'lar bu anda çekilir (ücretsiz tier içinde).{'\n'}
                            • Geocode = OS-native. Kota YOK, sadece iOS yumuşak hız sınırı (kısa sürede çok istek atmayın).{'\n'}
                            • Apple Maps (iOS) tamamen kotasız, API key gerektirmez.
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const COLORS_MAP = {
    success: '#00A36C',
    warning: '#FF8C00',
    error: '#DC3545',
    info: '#0066CC',
    mapMount: '#7B61FF',
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backBtn: { padding: 4, marginRight: 10 },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    headerSub: { fontSize: 11, marginTop: 2 },
    resetBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

    engineCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
    },
    engineTitle: { fontSize: 13, fontWeight: '700' },
    engineDesc: { fontSize: 11, marginTop: 4, lineHeight: 16 },

    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginTop: 8,
        marginBottom: 10,
    },

    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    statCard: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '48.5%',
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
    statIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    statBody: { flex: 1 },
    statValue: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
    statLabel: { fontSize: 10, color: '#5C6370', marginTop: 1 },

    actionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 18,
        gap: 6,
    },
    actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    quotaCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        marginBottom: 10,
    },
    quotaText: { fontSize: 12, fontWeight: '600' },

    mapBox: {
        height: 240,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        marginBottom: 16,
    },

    logBox: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        marginBottom: 16,
        overflow: 'hidden',
    },
    logRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    logDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, marginRight: 10 },
    logBody: { flex: 1 },
    logLabel: { fontSize: 12, fontWeight: '600' },
    logDetail: { fontSize: 11, marginTop: 2 },
    logTime: { fontSize: 10, marginLeft: 8, marginTop: 4 },
    logEmpty: { alignItems: 'center', padding: 30, gap: 8 },
    logEmptyText: { fontSize: 12, textAlign: 'center' },

    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    tipTitle: { fontSize: 12, fontWeight: '700' },
    tipBody: { fontSize: 11, marginTop: 4, lineHeight: 16 },
});
