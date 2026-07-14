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
import AdminEditTechnicianScreen from "@/screens/admin/AdminEditTechnicianScreen";
import TechnicianDetailScreen from "@/screens/technician/TechnicianDetailScreen";
import ApprovalPendingUsersScreen from "@/screens/admin/ApprovalPendingUsersScreen";
import TechnicianLocationsScreen from "@/screens/technician/TechnicianLocationsScreen";
import PayrollScreen from "@/screens/hr/PayrollScreen";
import TechnicianPayrollScreen from "@/screens/hr/TechnicianPayrollScreen";
import PayrollDetailScreen from "@/screens/hr/PayrollDetailScreen";
import ServiceDetail from "@/screens/services/ServiceDetail";
import NotificationsScreen from "@/screens/notifications/NotificationsScreen";
import ProfileEditScreen from "@/screens/profile/ProfileEditScreen";
import ProfileChangePasswordScreen from "@/screens/profile/ProfileChangePasswordScreen";
import ProfilePersonalInfoScreen from "@/screens/profile/ProfilePersonalInfoScreen";
import ProfilePerformanceScreen from "@/screens/profile/ProfilePerformanceScreen";
import ProfileMyShiftsScreen from "@/screens/profile/ProfileMyShiftsScreen";
import ProfileShiftDetailScreen from "@/screens/profile/ProfileShiftDetailScreen";
import ProfileDeleteAccountScreen from "@/screens/profile/ProfileDeleteAccountScreen";
import PrivacyPolicyScreen from "@/screens/settings/PrivacyPolicyScreen";
import CreateServiceScreen from "@/screens/services/CreateServiceScreen";
import LocationMapScreen from "@/screens/maps/LocationMapScreen";
import ServicesScreen from "@/screens/services/ServicesScreen";


const Stack = createStackNavigator();

const AuthStack = ({ initialRouteName }) => {
    const { colors } = useTheme();
    return (
        <Stack.Navigator
            initialRouteName={initialRouteName}
            screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                contentStyle: { backgroundColor: colors.background },
            }}
        >
            <Stack.Screen name="Landing" component={LandingScreen} options={{ title: 'Başlangıç Ekranı', headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Giriş Yap', headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Kayıt Ol', headerShown: false }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Şifremi Unuttum', headerShown: false }} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Şifre Sıfırla', headerShown: false }} />
            <Stack.Screen name="ResetCode" component={ResetCodeScreen} options={{ title: 'Şifre Sıfırlama Kodu', headerShown: false }} />
        </Stack.Navigator>
    );
};

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
            <Stack.Screen name="AppErrorBoundary" component={AppErrorBoundary} />
            <Stack.Screen name="NetworkStatus" component={NetworkStatus} />
            <Stack.Screen name="AdminTechnicians" component={AdminTechniciansScreen} />
            <Stack.Screen name="AdminEditTechnician" component={AdminEditTechnicianScreen} />
            <Stack.Screen name="TechnicianDetail" component={TechnicianDetailScreen} />
            <Stack.Screen name="AdminPendingUsers" component={ApprovalPendingUsersScreen} />
            <Stack.Screen name="TechnicianLocations" component={TechnicianLocationsScreen} />
            <Stack.Screen name="AdminPayroll" component={PayrollScreen} />
            <Stack.Screen name="TechnicianPayroll" component={TechnicianPayrollScreen} />
            <Stack.Screen name="TechnicianPayrollDetail" component={PayrollDetailScreen} />
            <Stack.Screen name="ServiceDetail" component={ServiceDetail} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
            <Stack.Screen name="ProfileChangePassword" component={ProfileChangePasswordScreen} />
            <Stack.Screen name="ProfilePersonalInfo" component={ProfilePersonalInfoScreen} />
            <Stack.Screen name="ProfilePerformance" component={ProfilePerformanceScreen} />
            <Stack.Screen name="ProfileMyShifts" component={ProfileMyShiftsScreen} />
            <Stack.Screen name="ProfileShiftDetail" component={ProfileShiftDetailScreen} />
            <Stack.Screen name="ProfileDeleteAccount" component={ProfileDeleteAccountScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="CreateService" component={CreateServiceScreen} />
            <Stack.Screen name="LocationMap" component={LocationMapScreen} options={{ presentation: 'transparentModal', cardStyle: { backgroundColor: 'transparent' }, cardOverlayEnabled: false }} />
            <Stack.Screen name="ServiceList" component={ServicesScreen} />
        </Stack.Navigator>
    );
};

const StackNavigation = () => {
    const { isLoggedIn, shouldShowOnboarding } = useAuth();
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {isLoggedIn ? (
                <Stack.Screen name="App" component={AppStack} />
            ) : (
                <Stack.Screen name="Auth">
                    {() => <AuthStack initialRouteName={shouldShowOnboarding ? 'Landing' : 'Login'} />}
                </Stack.Screen>
            )}
        </Stack.Navigator>
    );
};

export default StackNavigation;