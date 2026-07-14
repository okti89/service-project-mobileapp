// src/api/api.js
import axios from 'axios';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const devMode = false
const devUrl = 'http://10.147.95.195:8000/api'
export const proUrl = 'https://imrpx8h1iihplrf4rs1ssbqo.5.75.152.139.sslip.io/api';
export const PRIVACY_POLICY_URL = proUrl.replace(/\/api$/, '/privacy-policy/');


const api = axios.create({
    baseURL: devMode ? devUrl : proUrl,
    timeout: 10000,
});

// İstek (Request) Araya Giricisi
api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
    const tenantCode = await AsyncStorage.getItem('tenant_code');

    if (token) config.headers.Authorization = `Token ${token}`;
    if (tenantCode) config.headers['X-Tenant-Code'] = tenantCode;

    return config;
}, (error) => Promise.reject(error));

// Yanıt (Response) Araya Giricisi
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const requestUrl = error.config?.url || '';
        const isLogoutRequest = requestUrl.includes('/auth/logout/');

        if (status === 401 && !isLogoutRequest) {
            AsyncStorage.removeItem('auth_token');
            DeviceEventEmitter.emit('generic_401_error');
        }
        return Promise.reject(error);
    }
);

export default api;
