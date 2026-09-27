const base = require('./app.json').expo;

const variant = process.env.APP_VARIANT || 'default';
const isUygar = variant === 'uygar';
const isErkmen = variant === 'erkmen';
const uygarLogo = './assets/brands/uygar-logo.png';
const erkmenIcon = './assets/brands/erkmen-icon.png';
const erkmenAdaptiveIcon = './assets/brands/erkmen-adaptive-icon.png';
const erkmenNotificationIcon = './assets/brands/erkmen-notification-icon.png';
const erkmenSplash = './assets/brands/erkmen-splash.png';
const brandIcon = isErkmen ? erkmenIcon : isUygar ? uygarLogo : base.icon;
const splashImage = isErkmen ? erkmenSplash : isUygar ? uygarLogo : base.splash.image;
const erkmenProjectId = '95391447-7539-4143-91de-305152737aa9';

const plugins = base.plugins.map((plugin) => {
    if (isErkmen && Array.isArray(plugin) && plugin[0] === 'expo-notifications') {
        return [plugin[0], { ...plugin[1], icon: erkmenNotificationIcon, color: '#2C5F9C' }];
    }
    if ((!isUygar && !isErkmen) || !Array.isArray(plugin) || plugin[0] !== 'expo-splash-screen') {
        return plugin;
    }

    return [
        plugin[0],
        {
            ...plugin[1],
            image: splashImage,
            backgroundColor: isErkmen ? '#FFFFFF' : plugin[1].backgroundColor,
        },
    ];
});

module.exports = {
    expo: {
        ...base,
        name: isErkmen ? 'Erkmen Teknik' : isUygar ? 'Uygar Servis Yönetimi' : base.name,
        slug: isErkmen ? 'servisapp' : base.slug,
        scheme: isErkmen ? 'servisapp' : base.scheme,
        icon: brandIcon,
        splash: {
            ...base.splash,
            image: splashImage,
            backgroundColor: isErkmen ? '#FFFFFF' : base.splash.backgroundColor,
        },
        updates: {
            ...base.updates,
            url: isErkmen ? `https://u.expo.dev/${erkmenProjectId}` : base.updates.url,
        },
        ios: {
            ...base.ios,
            bundleIdentifier: isErkmen ? 'com.omer.servisapp' : base.ios.bundleIdentifier,
            googleServicesFile: isErkmen ? undefined : base.ios.googleServicesFile,
        },
        android: {
            ...base.android,
            package: isErkmen ? 'com.omer.servisapp' : base.android.package,
            googleServicesFile: isErkmen ? './assets/brands/erkmen-google-services.json' : base.android.googleServicesFile,
            adaptiveIcon: {
                ...base.android.adaptiveIcon,
                foregroundImage: isErkmen ? erkmenAdaptiveIcon : isUygar
                    ? uygarLogo : base.android.adaptiveIcon.foregroundImage,
                backgroundColor: isErkmen ? '#FFFFFF' : base.android.adaptiveIcon.backgroundColor,
            },
        },
        web: {
            ...base.web,
            favicon: isErkmen ? erkmenIcon : base.web.favicon,
        },
        plugins,
        extra: {
            ...base.extra,
            appVariant: variant,
            eas: {
                ...base.extra.eas,
                projectId: isErkmen ? erkmenProjectId : base.extra.eas.projectId,
            },
        },
    },
};
