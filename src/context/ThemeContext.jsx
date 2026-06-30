import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appGradients, backgroundThemes, baseDarkColors, baseLightColors, themePalettes } from '@/theme/color';

const ThemeContext = createContext(null);
const THEME_MODE_KEY = 'theme_mode';
const THEME_PALETTE_KEY = 'theme_palette';
const THEME_BACKGROUND_KEY = 'theme_background';

export const ThemeProvider = ({ children }) => {
    const [themeMode, setThemeMode] = useState('light');
    const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme());
    const [paletteName, setPaletteName] = useState('blue');
    const [backgroundTheme, setBackgroundTheme] = useState('steel');
    const isDark = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';

    useEffect(() => {
        const loadThemePreferences = async () => {
            try {
                const [storedMode, storedPalette, storedBackground] = await Promise.all([
                    AsyncStorage.getItem(THEME_MODE_KEY),
                    AsyncStorage.getItem(THEME_PALETTE_KEY),
                    AsyncStorage.getItem(THEME_BACKGROUND_KEY),
                ]);

                if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
                    setThemeMode(storedMode);
                }
                const resolvedPalette =
                    storedPalette === 'purple' || storedPalette === 'red'
                        ? 'gray'
                        : storedPalette;
                if (resolvedPalette && themePalettes[resolvedPalette]) {
                    setPaletteName(resolvedPalette);
                    if (resolvedPalette !== storedPalette) {
                        AsyncStorage.setItem(THEME_PALETTE_KEY, resolvedPalette);
                    }
                }
                if (storedBackground && backgroundThemes[storedBackground]) {
                    setBackgroundTheme(storedBackground);
                }
            } catch (error) {
                console.log('Theme preferences could not be loaded:', error?.message || error);
            }
        };

        loadThemePreferences();
    }, []);

    useEffect(() => {
        const subscription = Appearance.addChangeListener(({ colorScheme }) => {
            setSystemScheme(colorScheme);
        });
        return () => subscription.remove();
    }, []);

    const colors = useMemo(() => {
        const base = isDark ? baseDarkColors : baseLightColors;
        const palette = themePalettes[paletteName]?.[isDark ? 'dark' : 'light'] || themePalettes.blue.light;
        const selectedBackground =
            backgroundThemes[backgroundTheme]?.[isDark ? 'dark' : 'light'] ||
            backgroundThemes.steel[isDark ? 'dark' : 'light'];
        const mergedBase = {
            ...base,
            ...selectedBackground,
        };
        return {
            ...mergedBase,
            primary: palette.primary,
            primaryLight: palette.primaryLight,
            primaryDark: palette.primaryDark,
            borderFocus: palette.primary,
            gradients: {
                primary: appGradients.primary,
                background: selectedBackground.backgroundGradient || (isDark ? appGradients.dark : appGradients.light),
                header: selectedBackground.headerGradient || (isDark ? appGradients.headerDark : appGradients.headerLight),
            },
        };
    }, [backgroundTheme, isDark, paletteName]);

    const setThemeModePersist = async (mode) => {
        setThemeMode(mode);
        try {
            await AsyncStorage.setItem(THEME_MODE_KEY, mode);
        } catch (error) {
            console.log('Theme mode could not be saved:', error?.message || error);
        }
    };

    const setPalettePersist = async (palette) => {
        setPaletteName(palette);
        try {
            await AsyncStorage.setItem(THEME_PALETTE_KEY, palette);
        } catch (error) {
            console.log('Theme palette could not be saved:', error?.message || error);
        }
    };

    const setBackgroundPersist = async (backgroundKey) => {
        setBackgroundTheme(backgroundKey);
        try {
            await AsyncStorage.setItem(THEME_BACKGROUND_KEY, backgroundKey);
        } catch (error) {
            console.log('Theme background could not be saved:', error?.message || error);
        }
    };

    const value = useMemo(() => {
        const toggleTheme = () => {
            const nextMode = isDark ? 'light' : 'dark';
            setThemeModePersist(nextMode);
        };

        return {
            isDark,
            colors,
            paletteName,
            backgroundTheme,
            themeMode,
            toggleTheme,
            setThemeMode: setThemeModePersist,
            setPaletteName: setPalettePersist,
            setBackgroundTheme: setBackgroundPersist,
        };
    }, [backgroundTheme, isDark, colors, paletteName, themeMode]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};
