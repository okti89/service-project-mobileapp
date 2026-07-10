import { Platform } from 'react-native';
import { fs, lh } from '@/theme/scale';

const fontFamily = {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
};

export const typography = {
    fontFamily,

    // Font Weights
    weights: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
    },

    // Hierarchy (Dynamic Scaled)
    h1: {
        fontFamily: fontFamily.bold,
        fontSize: fs(32),
        lineHeight: lh(32, 1.25),
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    h2: {
        fontFamily: fontFamily.bold,
        fontSize: fs(24),
        lineHeight: lh(24, 1.3),
        fontWeight: '700',
        letterSpacing: -0.25,
    },
    h3: {
        fontFamily: fontFamily.semiBold,
        fontSize: fs(20),
        lineHeight: lh(20, 1.4),
        fontWeight: '600',
    },
    body: {
        fontFamily: fontFamily.regular,
        fontSize: fs(16),
        lineHeight: lh(16, 1.5),
        fontWeight: '400',
    },
    bodySmall: {
        fontFamily: fontFamily.regular,
        fontSize: fs(14),
        lineHeight: lh(14, 1.4),
        fontWeight: '400',
    },
    caption: {
        fontFamily: fontFamily.regular,
        fontSize: fs(12),
        lineHeight: lh(12, 1.33),
        fontWeight: '400',
        color: '#6B7280', // Default caption color
    },
    button: {
        fontFamily: fontFamily.semiBold,
        fontSize: fs(16),
        lineHeight: lh(16, 1.5),
        fontWeight: '600',
        textTransform: 'none',
    }
};
