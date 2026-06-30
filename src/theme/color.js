export const serviceBlue = '#0066CC';
export const serviceDark = '#1A1A2E';
export const serviceLight = '#F0F5FF';

export const serviceGreen = '#00A36C';
export const serviceOrange = '#FF8C00';
export const serviceRed = '#DC3545';

export const baseLightColors = {
    background: '#FFFFFF',
    backgroundSecondary: '#F5F7FA',
    surface: '#FFFFFF',
    surfaceMuted: '#F9FAFC',
    card: '#FFFFFF',
    text: '#1A1A2E',
    textSecondary: '#5C6370',
    textTertiary: '#9CA3AF',
    border: '#E5E7EB',
    divider: '#F0F2F5',
    overlay: 'rgba(26, 26, 46, 0.12)',
    shadow: 'rgba(26, 26, 46, 0.06)',
    success: '#00A36C',
    warning: '#FF8C00',
    error: '#DC3545',
    info: serviceBlue,
    disabled: '#C5C8D0',
    disabledSurface: '#F0F2F5',
    white: '#FFFFFF',
    black: '#1A1A2E',
};

export const baseDarkColors = {
    background: '#1A1A2E',
    backgroundSecondary: '#252538',
    surface: '#2D2D44',
    surfaceMuted: '#363652',
    card: '#2D2D44',
    text: '#FFFFFF',
    textSecondary: '#B8BDC6',
    textTertiary: '#7A8290',
    border: '#3D3D5C',
    divider: '#363652',
    overlay: 'rgba(0, 0, 0, 0.4)',
    shadow: 'rgba(0, 0, 0, 0.25)',
    success: '#00A36C',
    warning: '#FF8C00',
    error: '#DC3545',
    info: serviceBlue,
    disabled: '#5A5A75',
    disabledSurface: '#363652',
    white: '#FFFFFF',
    black: '#1A1A2E',
};

export const themePalettes = {
    blue: {
        light: {
            primary: serviceBlue,
            primaryLight: '#3399FF',
            primaryDark: '#0052A3',
        },
        dark: {
            primary: serviceBlue,
            primaryLight: '#66B3FF',
            primaryDark: '#0052A3',
        },
    },
    teal: {
        light: {
            primary: serviceGreen,
            primaryLight: '#33C494',
            primaryDark: '#008355',
        },
        dark: {
            primary: serviceGreen,
            primaryLight: '#33C494',
            primaryDark: '#008355',
        },
    },
    amber: {
        light: {
            primary: serviceOrange,
            primaryLight: '#FFB347',
            primaryDark: '#CC7000',
        },
        dark: {
            primary: serviceOrange,
            primaryLight: '#FFB347',
            primaryDark: '#CC7000',
        },
    },
    gray: {
        light: {
            primary: '#5C6370',
            primaryLight: '#7A8290',
            primaryDark: '#3D424A',
        },
        dark: {
            primary: '#B8BDC6',
            primaryLight: '#D1D5DB',
            primaryDark: '#9CA3AF',
        },
    },
};

export const appGradients = {
    primary: [serviceBlue, '#0052A3'],
    light: ['#FFFFFF', '#F5F7FA'],
    dark: ['#2D2D44', '#1A1A2E'],
    headerLight: ['#FFFFFF', '#F9FAFC'],
    headerDark: ['#2D2D44', '#252538'],
};

export const backgroundThemes = {
    steel: {
        light: {
            background: '#FFFFFF',
            backgroundSecondary: '#F5F7FA',
            surface: '#FFFFFF',
            surfaceMuted: '#F9FAFC',
            card: '#FFFFFF',
            border: '#E5E7EB',
            divider: '#F0F2F5',
            backgroundGradient: ['#FFFFFF', '#F5F7FA'],
            headerGradient: ['#FFFFFF', '#F9FAFC'],
        },
        dark: {
            background: '#1A1A2E',
            backgroundSecondary: '#252538',
            surface: '#2D2D44',
            surfaceMuted: '#363652',
            card: '#2D2D44',
            border: '#3D3D5C',
            divider: '#363652',
            backgroundGradient: ['#1A1A2E', '#252538'],
            headerGradient: ['#2D2D44', '#252538'],
        },
    },
    sand: {
        light: {
            background: '#FFF9F0',
            backgroundSecondary: '#FFF3E0',
            surface: '#FFFFFF',
            surfaceMuted: '#FFFBF5',
            card: '#FFFFFF',
            border: '#FFE0C0',
            divider: '#FFF3E0',
            backgroundGradient: ['#FFFBF5', '#FFF3E0'],
            headerGradient: ['#FFFFFF', '#FFFBF5'],
        },
        dark: {
            background: '#1A1810',
            backgroundSecondary: '#252218',
            surface: '#2D2A1B',
            surfaceMuted: '#363320',
            card: '#2D2A1B',
            border: '#4D3D25',
            divider: '#363320',
            backgroundGradient: ['#1A1810', '#252218'],
            headerGradient: ['#2D2A1B', '#201D13'],
        },
    },
    slate: {
        light: {
            background: '#F5F7FA',
            backgroundSecondary: '#EBEEF2',
            surface: '#FFFFFF',
            surfaceMuted: '#F9FAFC',
            card: '#FFFFFF',
            border: '#D1D5DB',
            divider: '#E5E7EB',
            backgroundGradient: ['#FFFFFF', '#F0F2F5'],
            headerGradient: ['#FFFFFF', '#F5F7FA'],
        },
        dark: {
            background: '#0C0F18',
            backgroundSecondary: '#141828',
            surface: '#1B1F32',
            surfaceMuted: '#232840',
            card: '#1B1F32',
            border: '#2C324C',
            divider: '#232840',
            backgroundGradient: ['#0C0F18', '#141828'],
            headerGradient: ['#1B1F32', '#13172A'],
        },
    },
};

export const statusColors = {
    done: serviceGreen,
    working: serviceOrange,
    stuck: serviceRed,
    pending: '#9CA3AF',
};

export default {
    serviceBlue,
    serviceDark,
    serviceLight,
    serviceGreen,
    serviceOrange,
    serviceRed,
    statusColors,
};