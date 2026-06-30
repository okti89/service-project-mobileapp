import { Dimensions, PixelRatio } from 'react-native';

const { width, height } = Dimensions.get('window');
const SCALE = Math.min(width, height);
const BASE_WIDTH = 375; // iPhone 11/12/13/14 Standard

export const getDeviceType = () => {
    return width >= 600 || height >= 1000 ? 'tablet' : 'phone';
};

const getScreenCategory = () => {
    if (SCALE < 350) return 'small';
    if (SCALE > 500) return 'large';
    return 'medium';
};

const fontConfig = {
    phone: {
        small: { min: 0.85, max: 1 },
        medium: { min: 0.9, max: 1.05 },
        large: { min: 1, max: 1.15 },
    },
    tablet: {
        small: { min: 1.1, max: 1.2 },
        medium: { min: 1.2, max: 1.3 },
        large: { min: 1.3, max: 1.4 },
    },
};

const getScaleFactor = () => {
    const device = getDeviceType();
    const screen = getScreenCategory();
    const { min, max } = fontConfig[device][screen];

    const rawScale = SCALE / BASE_WIDTH;
    return Math.min(Math.max(rawScale, min), max);
};

// Font Scale
export const fs = (size) => {
    const scaled = size * getScaleFactor();
    return Math.round(PixelRatio.roundToNearestPixel(scaled));
};

// Spacing Scale
export const sp = (value) => {
    const scaled = value * getScaleFactor();
    return Math.round(PixelRatio.roundToNearestPixel(scaled));
};

// Line Height Scale
export const lh = (fontSize, ratio = 1.4) => {
    return Math.round(fs(fontSize) * ratio);
};
