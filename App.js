import React, { useState, useEffect, useCallback, useRef } from "react";
import { AppState, Platform, View, StyleSheet } from "react-native";
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

// Keep the native splash visible while fonts and the initial auth state load.
SplashScreen.preventAutoHideAsync().catch(() => {});

const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

const AutoUpdate = () => {
  const { isUpdatePending, isChecking, isDownloading, lastCheckForUpdateTimeSinceRestart } = Updates.useUpdates();
  const appState = useRef(AppState.currentState);
  const lastCheckAt = useRef(0);
  const checking = useRef(false);
  const nativeBusy = useRef(false);
  const updatePending = useRef(false);

  useEffect(() => {
    nativeBusy.current = isChecking || isDownloading;
    updatePending.current = isUpdatePending;
    if (lastCheckForUpdateTimeSinceRestart) {
      lastCheckAt.current = Math.max(lastCheckAt.current, lastCheckForUpdateTimeSinceRestart.getTime());
    }
  }, [isChecking, isDownloading, isUpdatePending, lastCheckForUpdateTimeSinceRestart]);

  useEffect(() => {
    if (!__DEV__ && Updates.isEnabled && isUpdatePending) {
      Updates.reloadAsync().catch((error) => console.warn('OTA reload failed:', error));
    }
  }, [isUpdatePending]);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return undefined;

    const checkForUpdates = async () => {
      const now = Date.now();
      if (checking.current || nativeBusy.current || updatePending.current ||
          appState.current !== 'active' ||
          now - lastCheckAt.current < UPDATE_CHECK_INTERVAL_MS) return;

      checking.current = true;
      lastCheckAt.current = now;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) await Updates.fetchUpdateAsync();
      } catch (error) {
        console.warn('OTA update check failed:', error);
      } finally {
        checking.current = false;
      }
    };

    const startupCheck = setTimeout(checkForUpdates, 3000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      const returningToForeground = appState.current !== 'active' && nextState === 'active';
      appState.current = nextState;
      if (returningToForeground) checkForUpdates();
    });

    return () => {
      clearTimeout(startupCheck);
      subscription.remove();
    };
  }, []);

  return null;
};




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
        {Platform.OS !== 'web' && <AutoUpdate />}
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
