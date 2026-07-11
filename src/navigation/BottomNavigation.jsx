import React from "react";
import { View, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from "@/context/AuthContext";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HomeScreen from "@/screens/home/HomeScreen";
import DevScreen from "@/screens/dev/DevScreen";
import AdminPanelNavigator from "./AdminPanelNavigator";
import ProfileScreen from "@/screens/profile/ProfileScreen";
import ServicesScreen from "@/screens/services/ServicesScreen";
const Tab = createBottomTabNavigator();

const ICON_MAP = {
    Home: { focused: 'home-variant', unfocused: 'home-variant-outline' },
    Services: { focused: 'view-list', unfocused: 'view-list' },
    Appointments: { focused: 'calendar', unfocused: 'calendar-outline' },
    Profile: { focused: 'account', unfocused: 'account-outline' },
    Dev: { focused: 'flask', unfocused: 'flask-outline' },
    AdminPanel: { focused: 'account-cog', unfocused: 'account-cog-outline' },
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


function TabIconRouter({ focused, color, primaryColor, surfaceColor, isAdmin }) {
    return (
        <RegularTabIcon
            focused={focused}
            color={color}
        />
    );
}

export default function BottomNavigation() {
    const { colors } = useTheme();
    const { isAdmin } = useAuth()
    const insets = useSafeAreaInsets();
    const bottomInset = Math.max(insets.bottom, 8)


    const tabBarStyle = {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        height: 65 + bottomInset,
        elevation: 12,
        overflow: 'visible'
    }

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
                    fontWeight: 600,
                    marginTop: 4
                },
                tabBarStyle,
                tabBarIcon: ({ focused, color }) => (
                    <TabIconRouter
                        focused={focused}
                        color={color}
                        primaryColor={colors.primary}
                        surfaceColor={colors.surface}
                        isAdmin={isAdmin} />
                ),

            }}>
            <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Ana Sayfa', tabBarShowLabel: true }} />
            <Tab.Screen name="Services" component={ServicesScreen} options={{ title: 'Servisler', tabBarShowLabel: true }} />
            <Tab.Screen
                name="AdminPanel"
                component={AdminPanelNavigator}
                options={{
                    title: isAdmin ? 'Admin Panel' : 'Teknisyen Paneli',
                    tabBarShowLabel: true,
                }}
            />
            <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil', tabBarShowLabel: true }} />


            {
                __DEV__ ? (

                    <Tab.Screen name="Dev"
                        component={DevScreen}
                        options={{
                            title: 'Dev',
                            tabBarShowLabel: true,
                        }}
                    />
                ) : null
            }
        </Tab.Navigator>

    )
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