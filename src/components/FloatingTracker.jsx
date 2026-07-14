import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Linking,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTracking } from '@/context/TrackingContext';
import { useTheme } from '@/context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';

const FloatingTracker = () => {
    const { isTracking, trackedTechnician, lastKnownLocation, stopTracking } = useTracking();
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const slideAnim = useRef(new Animated.Value(120)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isTracking) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                friction: 7,
                tension: 60,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: 120,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [isTracking, slideAnim]);

    useEffect(() => {
        if (!isTracking) return undefined;

        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.6,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );

        loop.start();
        return () => loop.stop();
    }, [isTracking, pulseAnim]);

    if (!isTracking || !trackedTechnician) {
        return null;
    }

    const handleOpenMap = () => {
        if (!lastKnownLocation) return;

        const { latitude, longitude } = lastKnownLocation;
        const dest = `${latitude},${longitude}`;
        const url = Platform.select({
            ios: `http://maps.apple.com/?ll=${dest}&z=15`,
            android: `geo:${latitude},${longitude}?z=15`,
            default: `https://www.google.com/maps/@${latitude},${longitude},15z`,
        });

        Linking.openURL(url).catch(() => {
            Linking.openURL(`https://www.google.com/maps/@${latitude},${longitude},15z`);
        });
    };

    const handleOpenTracking = () => {
        navigation.navigate('TechnicianLocations', {
            technicianId: trackedTechnician.technicianId,
            technicianName: trackedTechnician.fullName,
        });
    };

    const timeAgo = lastKnownLocation?.createdAt
        ? dayjs(lastKnownLocation.createdAt).format('HH:mm:ss')
        : null;

    const initials = (() => {
        const name = trackedTechnician?.fullName || '';
        return (
            name
                .split(' ')
                .filter(Boolean)
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || '??'
        );
    })();

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    bottom: insets.bottom + 80,
                    transform: [{ translateY: slideAnim }],
                },
            ]}
        >
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: isDark ? '#1A1F2E' : '#FFFFFF',
                        borderColor: isDark ? '#2D3548' : '#E2E8F0',
                    },
                ]}
            >
                <View style={styles.liveDotWrap}>
                    <Animated.View
                        style={[
                            styles.liveDotPulse,
                            { transform: [{ scale: pulseAnim }] },
                        ]}
                    />
                    <View style={styles.liveDot} />
                </View>

                <View
                    style={[
                        styles.avatar,
                        {
                            backgroundColor: `${trackedTechnician?.markerColor || '#4F46E5'}20`,
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.avatarText,
                            { color: trackedTechnician?.markerColor || '#4F46E5' },
                        ]}
                    >
                        {initials}
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.info}
                    onPress={handleOpenTracking}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                        {trackedTechnician?.fullName || 'Teknisyen'}
                    </Text>
                    {lastKnownLocation ? (
                        <View style={styles.locationRow}>
                            <MaterialCommunityIcons
                                name="map-marker"
                                size={11}
                                color={colors.textSecondary}
                            />
                            <Text
                                style={[styles.locationText, { color: colors.textSecondary }]}
                                numberOfLines={1}
                            >
                                {lastKnownLocation.locationText}
                            </Text>
                            <Text style={[styles.timeText, { color: colors.primary }]}>
                                {timeAgo}
                            </Text>
                        </View>
                    ) : (
                        <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                            Konum bekleniyor...
                        </Text>
                    )}
                </TouchableOpacity>

                {lastKnownLocation ? (
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#3B82F618' }]}
                        onPress={handleOpenMap}
                    >
                        <MaterialCommunityIcons
                            name="navigation-variant-outline"
                            size={18}
                            color="#3B82F6"
                        />
                    </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                    style={[styles.closeBtn, { backgroundColor: '#EF444418' }]}
                    onPress={stopTracking}
                >
                    <MaterialCommunityIcons name="close" size={16} color="#EF4444" />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 12,
        right: 12,
        zIndex: 9999,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 18,
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
        elevation: 10,
    },
    liveDotWrap: {
        position: 'absolute',
        top: -4,
        left: 12,
        width: 12,
        height: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    liveDotPulse: {
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#10B981',
        opacity: 0.35,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 13,
        fontWeight: '800',
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 1,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    locationText: {
        fontSize: 11,
        flex: 1,
    },
    timeText: {
        fontSize: 10,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    actionBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default FloatingTracker;
