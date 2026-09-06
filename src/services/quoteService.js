import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

const asArray = (value) => (Array.isArray(value) ? value : value?.results || []);

const sanitizeFileName = (value) => {
    const name = String(value || 'Teklif.pdf').replace(/[\\/:*?"<>|]+/g, '_').trim();
    return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
};

const getPdfAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    const tenantCode = await AsyncStorage.getItem('tenant_code');
    const headers = {};
    if (token) headers.Authorization = `Token ${token}`;
    if (tenantCode) headers['X-Tenant-Code'] = tenantCode;
    return headers;
};

const quoteService = {
    list: async (params = {}) => {
        const response = await api.get(ENDPOINTS.QUOTES.LIST, { params });
        return asArray(response?.data);
    },

    get: async (id) => {
        const response = await api.get(ENDPOINTS.QUOTES.DETAIL(id));
        return response?.data;
    },

    create: async (payload) => {
        const response = await api.post(ENDPOINTS.QUOTES.LIST, payload);
        return response?.data;
    },

    update: async (id, payload) => {
        const response = await api.patch(ENDPOINTS.QUOTES.DETAIL(id), payload);
        return response?.data;
    },

    remove: async (id) => api.delete(ENDPOINTS.QUOTES.DETAIL(id)),

    sendEmail: async (id, payload = {}) => {
        const response = await api.post(ENDPOINTS.QUOTES.SEND_EMAIL(id), payload);
        return response?.data;
    },

    markSent: async (id) => {
        const response = await api.post(ENDPOINTS.QUOTES.MARK_SENT(id));
        return response?.data;
    },

    convertToService: async (id, payload) => {
        const response = await api.post(ENDPOINTS.QUOTES.CONVERT_TO_SERVICE(id), payload);
        return response?.data;
    },

    downloadPdf: async (quote) => {
        const quoteId = typeof quote === 'object' ? quote?.id : quote;
        if (!quoteId) throw new Error('Teklif bulunamadı.');

        const quoteNumber = typeof quote === 'object' ? quote?.quote_number : null;
        const filename = sanitizeFileName(`Teklif_${quoteNumber || String(quoteId).slice(0, 8)}.pdf`);
        const fileUri = `${FileSystem.cacheDirectory}${filename}`;
        const baseUrl = String(api.defaults.baseURL || '').replace(/\/$/, '');
        const endpoint = ENDPOINTS.QUOTES.PDF(quoteId).replace(/^\//, '');
        const result = await FileSystem.downloadAsync(`${baseUrl}/${endpoint}`, fileUri, {
            headers: await getPdfAuthHeaders(),
        });

        if (result.status < 200 || result.status >= 300) {
            throw new Error('Teklif PDF dosyası indirilemedi.');
        }
        return { uri: result.uri, filename };
    },
};

export default quoteService;
