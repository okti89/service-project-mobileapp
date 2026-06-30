import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import BottomNavigation from "./BottomNavigation";
import NotificationsScreen from "@/screens/notifications/NotificationsScreen";
import ServiceDetailScreen from "@/screens/services/ServiceDetailScreen";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import LandingScreen from "@/screens/auth/LandingScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import RegisterScreen from "@/screens/auth/RegisterScreen";
import ForgotPasswordScreen from "@/screens/auth/ForgotPasswordScreen";
import ResetCodeScreen from "@/screens/auth/ResetCodeScreen";
import ResetPasswordScreen from "@/screens/auth/ResetPasswordScreen";

const Stack = createNativeStackNavigator();

const AuthStack = () => {
    const { colors } = useTheme();

    return (
        <Stack.Navigator
            initialRouteName="Landing"
            screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                contentStyle: { backgroundColor: colors.background },
            }}
        >
            <Stack.Screen
                name="Landing"
                component={LandingScreen}
                options={{ title: "Baslangic", headerShown: false }}
            />
            <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ title: "Giris", headerShown: false }}
            />
            <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{ title: "Kayit", headerShown: false }}
            />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Şifre Sıfırlama', headerShown: false }} />
            <Stack.Screen name="ResetCode" component={ResetCodeScreen} options={{ title: 'Kod Doğrulama', headerShown: false }} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Yeni Şifre', headerShown: false }} />

        </Stack.Navigator>
    );
};

const AppStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={BottomNavigation} />
        <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
            name="ServiceDetail"
            component={ServiceDetailScreen}
            options={{ animation: 'slide_from_right' }}
        />
    </Stack.Navigator>
);

const StackNavigation = () => {
    const { isLoggedIn } = useAuth();

    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {isLoggedIn ? (
                <Stack.Screen name="App" component={AppStack} />
            ) : (
                <Stack.Screen name="Auth" component={AuthStack} />
            )}
        </Stack.Navigator>
    );
};

export default StackNavigation;
