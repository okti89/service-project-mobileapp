import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

import HomeScreen from '@/screens/home/HomeScreen';
import ServicesScreen from '@/screens/services/ServicesScreen';
import AppointmentsScreen from '@/screens/appointments/AppointmentsScreen';
import ProfileScreen from "@/screens/profile/ProfileScreen";
import AdminPanelNavigator from "@/navigation/AdminPanelNavigator";

const Tab = createBottomTabNavigator();

function CenterTabButton({ primaryColor, surfaceColor, focused }) {
    const route = useRoute();
    if (route?.name !== 'AdminPanel') return null;

    const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.9)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: focused ? 1 : 0.9,
            useNativeDriver: true,
            friction: 4,
            tension: 140,
        }).start();
    }, [focused]);

    return (
        <View style={styles.centerOuter}>
            <View style={styles.centerWrapper}>
                <Animated.View
                    style={[
                        styles.centerButton,
                        {
                            backgroundColor: focused ? primaryColor : surfaceColor,
                            borderColor: primaryColor,
                            borderWidth: focused ? 0 : 2,
                            shadowColor: primaryColor,
                            shadowOpacity: focused ? 0.28 : 0.10,
                            elevation: focused ? 8 : 3,
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="shield-crown"
                        size={26}
                        color={focused ? '#FFFFFF' : primaryColor}
                    />
                </Animated.View>
            </View>
        </View>
    );
}

const ICON_MAP = {
    Home: { focused: 'home-variant', unfocused: 'home-variant-outline' },
    Services: { focused: 'view-list', unfocused: 'view-list' },
    Appointments: { focused: 'calendar', unfocused: 'calendar-outline' },
    Profile: { focused: 'account', unfocused: 'account-outline' },
};

function RegularTabIcon({ focused, color }) {
    const route = useRoute();
    const entry = ICON_MAP[route?.name];
    if (!entry) return null;
    const iconName = focused ? entry.focused : entry.unfocused;

    return (
        <View style={styles.iconOuter}>
            <MaterialCommunityIcons name={iconName} size={24} color={color} />
        </View>
    );
}

function TabIconRouter({ focused, color, primaryColor, surfaceColor }) {
    const route = useRoute();
    if (route?.name === 'AdminPanel') {
        return (
            <CenterTabButton
                primaryColor={primaryColor}
                surfaceColor={surfaceColor}
                focused={focused}
            />
        );
    }
    return <RegularTabIcon focused={focused} color={color} />;
}

export default function BottomNavigation() {
    const { colors } = useTheme();
    const { isAdmin } = useAuth();
    const insets = useSafeAreaInsets();
    const bottomInset = Math.max(insets.bottom, 8);

    const tabBarStyle = {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        height: 66 + bottomInset,
        paddingTop: 10,
        paddingBottom: bottomInset,
        elevation: 12,
        overflow: 'visible',
    };

    return (
        <Tab.Navigator
            initialRouteName="Home"
            screenOptions={{
                headerShown: false,
                tabBarHideOnKeyboard: true,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textTertiary,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                    marginTop: 4,
                },
                tabBarStyle,
                tabBarIcon: ({ focused, color }) => (
                    <TabIconRouter
                        focused={focused}
                        color={color}
                        primaryColor={colors.primary}
                        surfaceColor={colors.surface}
                    />
                ),
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    title: 'Ana Sayfa',
                    tabBarShowLabel: true,
                }}
            />
            <Tab.Screen
                name="Services"
                component={ServicesScreen}
                options={{
                    title: 'Servisler',
                    tabBarShowLabel: true,
                }}
            />
            {isAdmin ? (
                <Tab.Screen
                    name="AdminPanel"
                    component={AdminPanelNavigator}
                    options={{
                        title: 'Admin Panel',
                        tabBarShowLabel: true,
                    }}
                />
            ) : null}
            <Tab.Screen
                name="Appointments"
                component={AppointmentsScreen}
                options={{
                    title: 'Randevular',
                    tabBarShowLabel: true,
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    title: 'Profil',
                    tabBarShowLabel: true,
                }}
            />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    iconOuter: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerOuter: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
    },
    centerWrapper: {
        position: 'absolute',
        top: -22,
        left: 0,
        right: 0,
        alignItems: 'center',
        pointerEvents: 'none',
    },
    centerButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 5,
    },
});
