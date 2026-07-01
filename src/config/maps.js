/**
 * Google Maps API Key runtime erisim helper.
 *
 * app.json icindeki `extra.googleMapsApiKey` degerini okur.
 * Expo prebuild sirasinda iOS Info.plist ve Android AndroidManifest.xml
 * otomatik olarak bu key ile guncellenir.
 *
 * NOT: API key public oldugu icin dogrudan koda yazilmasi normal kabul edilir
 * (Google Maps Platform Mobile SDK'lari icin zaten public). Ancak key'in
 * Google Cloud Console'da kisitlanmasi (sadece bizim bundle ID'miz + SHA-1)
 * zorunludur.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

const RAW_KEY =
    Constants.expoConfig?.extra?.googleMapsApiKey ??
    Constants.manifest?.extra?.googleMapsApiKey ??
    '';

export const GOOGLE_MAPS_API_KEY = RAW_KEY;

export const isGoogleMapsKeyConfigured = () => {
    return (
        typeof GOOGLE_MAPS_API_KEY === 'string' &&
        GOOGLE_MAPS_API_KEY.length > 20 &&
        GOOGLE_MAPS_API_KEY.startsWith('AIza')
    );
};

/**
 * Platform ve API key durumuna gore en uygun react-native-maps provider'ini
 * doner. iOS icin Apple Maps (key'siz) her zaman tercih edilir; Android'de
 * key yapilandirilmissa Google Maps, aksi halde PROVIDER_DEFAULT (bos harita)
 * kullanilir.
 */
export const getMapProvider = () => {
    if (Platform.OS === 'ios') return PROVIDER_DEFAULT;
    return isGoogleMapsKeyConfigured() ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;
};

/**
 * Google Places Autocomplete icin session token uretir.
 * Maps JS API veya Places API kullaniminda autocomplete session baslatir.
 */
export const newGoogleMapsSessionToken = () => {
    return (
        Math.random().toString(36).slice(2) +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2)
    );
};
