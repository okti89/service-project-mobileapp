import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import BottomNavigation from "./BottomNavigation";
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from "@/context/AuthContext";
import LandingScreen from "@/screens/auth/LandingScreen";
import AccountDeactivatedScreen from '@/screens/account-status/AccountDeactivatedScreen';
import AccountPendingScreen from '@/screens/account-status/AccountPendingScreen';
import AppErrorBoundaryPreview from '@/components/AppErrorBoundaryPreview';
import AccountStatusGate from "@/services/AccountStatusGate";
import CustomSplashScreen from "@/components/CustomSplashScreen";
import DevModals from "@/screens/dev/DevModals";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import NetworkStatus from "@/components/NetworkStatus";
import LoginScreen from "@/screens/auth/LoginScreen";
import RegisterScreen from "@/screens/auth/RegisterScreen";
import ForgotPasswordScreen from "@/screens/auth/ForgotPasswordScreen";
import ResetPasswordScreen from "@/screens/auth/ResetPasswordScreen";
import ResetCodeScreen from "@/screens/auth/ResetCodeScreen";
import AdminTechniciansScreen from "@/screens/admin/AdminTechniciansScreen";
import ApprovalPendingUsersScreen from "@/screens/admin/ApprovalPendingUsersScreen";
import TechnicianLocationsScreen from "@/screens/technician/TechnicianLocationsScreen";
import PayrollScreen from "@/screens/hr/PayrollScreen";
import PayrollDetailScreen from "@/screens/hr/PayrollDetailScreen";
import ServiceDetail from "@/screens/services/ServiceDetail";
const Stack = createStackNavigator()

const AuthStack = () => {
    const { colors } = useTheme()
    return (
        <Stack.Navigator initialRouteName="Landing"
            screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                contentStyle: { backgroundColor: colors.background }
            }}
        >
            <Stack.Screen name="Landing"
                component={LandingScreen}
                options={{
                    title: 'Başlangıç Ekranı',
                    headerShown: false
                }} />
            <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ title: 'Giriş Yap', headerShown: false }}
            />
            <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{ title: 'Kayıt Ol', headerShown: false }}
            />
            <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{ title: 'Şifremi Unuttum', headerShown: false }}
            />
            <Stack.Screen
                name="ResetPassword"
                component={ResetPasswordScreen}
                options={{ title: 'Şifre Sıfırla', headerShown: false }}
            />
            <Stack.Screen
                name="ResetCode"
                component={ResetCodeScreen}
                options={{ title: 'Şifre Sıfırlama Kodu', headerShown: false }}
            />
        </Stack.Navigator>
    )
}
const AppStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Tabs">
                {() => (
                    <AccountStatusGate>
                        <BottomNavigation />
                    </AccountStatusGate>
                )}
            </Stack.Screen>
            <Stack.Screen name="AccountDeactivated" component={AccountDeactivatedScreen} />
            <Stack.Screen name="AccountPending" component={AccountPendingScreen} />
            <Stack.Screen name="AppErrorBoundaryPreview" component={AppErrorBoundaryPreview} />
            <Stack.Screen name="CustomSplash" component={CustomSplashScreen} />
            <Stack.Screen name="DevModals" component={DevModals} />
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="AppErrorBoundary" component={AppErrorBoundary} />
            <Stack.Screen name="NetworkStatus" component={NetworkStatus} />
            <Stack.Screen name="AdminTechnicians" component={AdminTechniciansScreen} />
            <Stack.Screen name="AdminPendingUsers" component={ApprovalPendingUsersScreen} />
            <Stack.Screen name="TechnicianLocations" component={TechnicianLocationsScreen} />
            <Stack.Screen name="TechnicianPayroll" component={PayrollScreen} />
            <Stack.Screen name="TechnicianPayrollDetail" component={PayrollDetailScreen} />
            <Stack.Screen name="ServiceDetail" component={ServiceDetail} />
            <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ title: 'Giriş Yap', headerShown: false }}
            />
            <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{ title: 'Kayıt Ol', headerShown: false }}
            />
            <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{ title: 'Şifremi Unuttum', headerShown: false }}
            />
            <Stack.Screen
                name="ResetPassword"
                component={ResetPasswordScreen}
                options={{ title: 'Şifre Sıfırla', headerShown: false }}
            />
            <Stack.Screen
                name="ResetCode"
                component={ResetCodeScreen}
                options={{ title: 'Şifre Sıfırlama Kodu', headerShown: false }}
            />

        </Stack.Navigator>
    );
}

const StackNavigation = () => {
    const { isLoggedIn } = useAuth();
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {
                isLoggedIn ? (
                    <Stack.Screen name="App" component={AppStack} />

                ) :
                    (
                        <Stack.Screen name="Auth" component={AuthStack} />

                    )}
        </Stack.Navigator>
    )
}
export default StackNavigation