import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AppErrorBoundary from '@/components/AppErrorBoundary';

const BuggyComponent = () => {
    const [shouldCrash, setShouldCrash] = useState(false);

    useEffect(() => {
        // Kısa bir süre sonra kasıtlı olarak hata fırlat (Loading efekti için)
        const timer = setTimeout(() => {
            setShouldCrash(true);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    if (shouldCrash) {
        throw new Error("Geliştirici önizleme hatası. Bu hata tasarımı görmek için kasıtlı olarak fırlatılmıştır.");
    }

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#081F5C" />
        </View>
    );
};

export default function AppErrorBoundaryPreview() {
    return (
        <AppErrorBoundary>
            <BuggyComponent />
        </AppErrorBoundary>
    );
}
