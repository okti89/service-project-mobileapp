const base = require('./app.json').expo;

const variant = process.env.APP_VARIANT || 'default';
const isUygar = variant === 'uygar';
const uygarLogo = './assets/brands/uygar-logo.png';

const plugins = base.plugins.map((plugin) => {
    if (!isUygar || !Array.isArray(plugin) || plugin[0] !== 'expo-splash-screen') {
        return plugin;
    }

    return [
        plugin[0],
        {
            ...plugin[1],
            image: uygarLogo,
        },
    ];
});

module.exports = {
    expo: {
        ...base,
        name: isUygar ? 'Uygar Servis Yönetimi' : base.name,
        icon: isUygar ? uygarLogo : base.icon,
        splash: {
            ...base.splash,
            image: isUygar ? uygarLogo : base.splash.image,
        },
        android: {
            ...base.android,
            adaptiveIcon: {
                ...base.android.adaptiveIcon,
                foregroundImage: isUygar
                    ? uygarLogo
                    : base.android.adaptiveIcon.foregroundImage,
            },
        },
        plugins,
        extra: {
            ...base.extra,
            appVariant: variant,
        },
    },
};
