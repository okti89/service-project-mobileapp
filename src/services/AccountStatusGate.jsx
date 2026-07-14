import React, { useCallback, useMemo } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import AccountDeactivatedScreen from '@/screens/account-status/AccountDeactivatedScreen';
import AccountPendingScreen from '@/screens/account-status/AccountPendingScreen';

/**
 * Hesap durumunu (aktif/pasif/onay) kontrol eder ve duruma göre uygun
 * bilgilendirme ekranını gösterir. Hesap normal durumdaysa children'ı render eder.
 *
 * Bu bileşen AppStack içinde en üstte kullanılmalı; "Back" tuşu bloke edilir
 * çünkü pasif/onaysız kullanıcılar uygulamanın geri kalanına erişememelidir.
 */
export default function AccountStatusGate({ children }) {
    const { userInfo, isLoggedIn } = useAuth();

    const status = useMemo(() => {
        if (!isLoggedIn || !userInfo) {
            return { kind: 'auth-missing', allow: false };
        }
        const approval = String(userInfo?.approval_status || '').toLowerCase();
        if (approval === 'pending' || userInfo?.is_approved === false) {
            return { kind: 'pending' };
        }
        if (approval === 'rejected' || userInfo?.is_active === false) {
            return { kind: 'deactivated' };
        }
        return { kind: 'ok', allow: true };
    }, [isLoggedIn, userInfo]);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (status.kind === 'deactivated' || status.kind === 'pending') {
                    BackHandler.exitApp();
                    return true;
                }
                return false;
            };
            const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => sub.remove();
        }, [status.kind])
    );

    if (status.kind === 'deactivated') {
        return <AccountDeactivatedScreen />;
    }
    if (status.kind === 'pending') {
        return <AccountPendingScreen />;
    }
    if (status.kind === 'auth-missing') {
        return null;
    }
    return children;
}
