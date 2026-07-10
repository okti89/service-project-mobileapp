import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import * as Font from 'expo-font';
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ConfigProvider } from '@/context/ConfigContext';
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ToastProvider } from "@/context/ToastContext";
import { TrackingProvider } from "@/context/TrackingContext";
import { PermissionReminderProvider } from "@/context/PermissionReminderContext";
import StackNavigation from "@/navigation/StackNavigation";
import { navigationRef } from "@/navigation/navigationRef";
import CustomSplashScreen from "@/components/CustomSplashScreen";
import FloatingTracker from "@/components/FloatingTracker";
import NetworkStatus from "@/components/NetworkStatus";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { NetworkProvider } from "@/context/NetworkContext";




const AppContent = ({ onLayoutRootView, isAppReady }) => {
  const { isDark } = useTheme();
  const { isLoading } = useAuth();
  const splashVisible = !isAppReady || isLoading;

  return (
    <View
      style={styles.appShell}
      onLayout={onLayoutRootView}
    >
      <NavigationContainer ref={navigationRef}>
        <StackNavigation />
        <FloatingTracker />
        <StatusBar
          style={isDark ? 'light' : 'dark'}
          translucent={true}
        />
      </NavigationContainer>

      <NetworkStatus />

      {splashVisible && <CustomSplashScreen />}
    </View>
  );
};



export default function App() {
  const [isAppReady, setIsAppReady] = useState(false);
  useEffect(() => {
    let mounted = true;

    async function prepareApp() {
      try {
        // Fonts
        await Font.loadAsync({
          'Inter-Regular': require('./assets/fonts/Inter_18pt-Regular.ttf'),
          'Inter-Medium': require('./assets/fonts/Inter_18pt-Medium.ttf'),
          'Inter-SemiBold': require('./assets/fonts/Inter_18pt-SemiBold.ttf'),
          'Inter-Bold': require('./assets/fonts/Inter_18pt-Bold.ttf'),
        });

        // OTA Update Control
        if (!__DEV__) {
          setTimeout(async () => {
            try {
              const update =
                await Updates.checkForUpdateAsync();

              if (update.isAvailable) {
                await Updates.fetchUpdateAsync();

              }
            } catch (error) {
              if (__DEV__) {
                console.log(
                  'OTA Update Error:',
                  error
                );
              }
            }
          }, 3000);
        }
      } catch (error) {
        if (__DEV__) {
          console.log(
            'App Prepare Error:',
            error
          );
        }
      } finally {
        if (mounted) {
          setIsAppReady(true);
        }
      }
    }

    prepareApp();

    return () => {
      mounted = false;
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (isAppReady) {
      await SplashScreen.hideAsync();
    }
  }, [isAppReady]);

  if (!isAppReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ThemeProvider>
          <BottomSheetModalProvider>
            <AppErrorBoundary>
              <NetworkProvider>
                <AuthProvider>
                  <ConfigProvider>
                    <ToastProvider>
                      <NotificationProvider>
                        <TrackingProvider>
                          <PermissionReminderProvider>
                            <AppContent onLayoutRootView={onLayoutRootView} isAppReady={isAppReady} />
                          </PermissionReminderProvider>
                        </TrackingProvider>
                      </NotificationProvider>
                    </ToastProvider>
                  </ConfigProvider>
                </AuthProvider>
              </NetworkProvider>
            </AppErrorBoundary>
          </BottomSheetModalProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  appShell: {
    flex: 1,
  },
});
