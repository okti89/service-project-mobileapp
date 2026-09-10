import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

const embeddedVariant = Constants.expoConfig?.extra?.appVariant || 'default';
const variant = Updates.channel === 'uygar-production' ? 'uygar' : embeddedVariant;
const isUygar = variant === 'uygar';

const buildBrand = isUygar
    ? {
        variant,
        isWhiteLabel: true,
        name: 'Uygar Servis Yönetimi',
        logo: require('../../assets/brands/uygar-logo.png'),
    }
    : {
        variant,
        isWhiteLabel: false,
        name: 'Servis Yönetim Sistemi',
        logo: require('../../assets/logo.png'),
    };

export default buildBrand;
