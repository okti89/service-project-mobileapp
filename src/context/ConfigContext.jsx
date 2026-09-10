import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import companyService from '@/services/companyService';
import { useAuth } from '@/context/AuthContext';
import buildBrand from '@/config/buildBrand';

const ConfigContext = createContext(null);

const defaultConfig = {
    name: buildBrand.name,
    logo: null,
    phone_number: '',
    email: '',
    address: '',
};

const normalizeConfig = (data) => ({
    ...defaultConfig,
    ...(data || {}),
    name: buildBrand.isWhiteLabel ? buildBrand.name : (data?.name || defaultConfig.name),
});

export const ConfigProvider = ({ children }) => {
    const { isLoggedIn } = useAuth();
    const [config, setConfig] = useState(defaultConfig);
    const [loading, setLoading] = useState(false);

    const refreshConfig = useCallback(async () => {
        setLoading(true);
        try {
            const data = await companyService.getPublicConfig();
            setConfig(normalizeConfig(data));
        } catch (error) {
            console.log('Firma ayarlari yuklenemedi:', error?.response?.data || error?.message);
            setConfig(defaultConfig);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isLoggedIn) {
            refreshConfig();
        } else {
            setConfig(defaultConfig);
        }
    }, [isLoggedIn, refreshConfig]);

    const value = useMemo(
        () => ({ config, loading, refreshConfig }),
        [config, loading, refreshConfig]
    );

    return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};

export const useConfig = () => {
    const context = useContext(ConfigContext);
    if (!context) {
        throw new Error('useConfig must be used within ConfigProvider');
    }
    return context;
};
