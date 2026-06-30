import { Platform } from 'react-native';

// Shadow / Elevation Standard
export const shadow = {
    none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    sm: {
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.18,
                shadowRadius: 1.0,
            },
            android: {
                elevation: 1,
            },
        }),
    },
    md: {
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
            },
            android: {
                elevation: 3, // Material Design Card standard
            },
        }),
    },
    lg: {
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.30,
                shadowRadius: 4.65,
            },
            android: {
                elevation: 6, // Dialog / Modal standard
            },
        }),
    },
    xl: {
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 6.27,
            },
            android: {
                elevation: 12, // Floating Action Button standard
            },
        }),
    },
};
