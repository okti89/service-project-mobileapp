import Constants from 'expo-constants';

const executionEnvironment = String(Constants?.executionEnvironment || '').toLowerCase();
const appOwnership = String(Constants?.appOwnership || '').toLowerCase();

export const isNativeShareRuntime = !(
    executionEnvironment === 'storeclient' || appOwnership === 'expo'
);

let nativeShareLib = null;

if (isNativeShareRuntime) {
    try {
        // eslint-disable-next-line global-require, import/no-unresolved
        const requiredModule = require('react-native-share');
        nativeShareLib = requiredModule.default || requiredModule;
    } catch (error) {
        nativeShareLib = null;
    }
}

export const getNativeShare = () => nativeShareLib;
