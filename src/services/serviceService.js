import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

const sanitizeFileName = (value, fallback) => {
    const name = String(value || fallback || 'garanti_belgesi.pdf')
        .replace(/[\\/:*?"<>|]+/g, '_')
        .trim();
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

const getApiFileUrl = (endpoint, params = {}) => {
    const baseUrl = String(api.defaults.baseURL || '').replace(/\/$/, '');
    const cleanEndpoint = String(endpoint || '').replace(/^\//, '');
    const query = new URLSearchParams(params).toString();
    return `${baseUrl}/${cleanEndpoint}${query ? `?${query}` : ''}`;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const serviceService = {
    getTechnicianServices: async (params = {}) => {
        const response = await api.get(ENDPOINTS.SERVICES.TECHNICIAN_LIST, { params });
        return asArray(response?.data);
    },

    getTechnicianService: async (id) => {
        const response = await api.get(ENDPOINTS.SERVICES.TECHNICIAN_DETAIL(id));
        return response?.data;
    },

    getAllServices: async (params = {}) => {
        const response = await api.get(ENDPOINTS.SERVICES.ADMIN_LIST, { params });
        return asArray(response?.data);
    },

    getServiceStatuses: async () => {
        const response = await api.get(ENDPOINTS.SERVICES.STATUS_LIST);
        return asArray(response?.data);
    },

    getPaymentMethods: async () => {
        const response = await api.get(ENDPOINTS.SERVICES.PAYMENT_METHODS);
        return asArray(response?.data);
    },

    getServiceOperationTemplates: async () => {
        const response = await api.get(ENDPOINTS.SERVICES.SERVICE_OPERATION_TEMPLATES);
        return asArray(response?.data);
    },

    updateAdminService: async (id, payload) => {
        const response = await api.patch(ENDPOINTS.SERVICES.ADMIN_DETAIL(id), payload);
        return response?.data;
    },

    createService: async (payload) => {
        const response = await api.post(ENDPOINTS.SERVICES.TECHNICIAN_LIST, payload);
        return response?.data;
    },

    createServiceOperation: async (payload) => {
        const response = await api.post(ENDPOINTS.SERVICES.SERVICE_OPERATIONS, payload);
        return response?.data;
    },

    updateServiceOperation: async (pk, payload) => {
        const response = await api.patch(ENDPOINTS.SERVICES.SERVICE_OPERATIONS, { pk, ...payload });
        return response?.data;
    },

    deleteServiceOperation: async (pk) => {
        const response = await api.delete(ENDPOINTS.SERVICES.SERVICE_OPERATIONS, { data: { pk } });
        return response?.data;
    },

    createServiceOperationTemplate: async (payload) => {
        const response = await api.post(ENDPOINTS.SERVICES.SERVICE_OPERATION_TEMPLATES, payload);
        return response?.data;
    },

    createServicePayment: async (payload) => {
        const response = await api.post(ENDPOINTS.SERVICES.SERVICE_PAYMENTS, payload);
        return response?.data;
    },

    updateServicePayment: async (pk, payload) => {
        const response = await api.patch(ENDPOINTS.SERVICES.SERVICE_PAYMENTS, { pk, ...payload });
        return response?.data;
    },

    deleteServicePayment: async (pk) => {
        const response = await api.delete(ENDPOINTS.SERVICES.SERVICE_PAYMENTS, { data: { pk } });
        return response?.data;
    },

    saveServiceSignature: async (payload) => {
        const response = await api.post(ENDPOINTS.SERVICES.SERVICE_SIGNATURES, payload);
        return response?.data;
    },

    createServicePhoto: async (payload) => {
        const response = await api.post(ENDPOINTS.SERVICES.SERVICE_PHOTOS, payload);
        return response?.data;
    },

    getServiceWhatsAppStatusUrl: async (serviceId, status) => {
        const response = await api.post(ENDPOINTS.SERVICES.ADMIN_WHATSAPP_STATUS_LINK(serviceId), {
            ...(status ? { status } : {}),
        });
        return response?.data?.whatsapp_url || null;
    },

    downloadServiceFormPdf: async (service, options = {}) => {
        const serviceId = typeof service === 'object' ? service?.id : service;
        if (!serviceId) throw new Error('Servis bulunamadi.');

        const params = {};
        if (options.disposition) params.disposition = options.disposition;

        const endpoint = ENDPOINTS.SERVICES.ADMIN_FORM_PDF(serviceId);
        const url = getApiFileUrl(endpoint, params);
        const receiptNumber = typeof service === 'object' ? service?.receipt_number : null;
        const filename = sanitizeFileName(`Servis_Formu_${receiptNumber || String(serviceId).slice(0, 8)}.pdf`, 'servis_formu.pdf');
        const fileUri = `${FileSystem.cacheDirectory}${filename}`;

        const result = await FileSystem.downloadAsync(url, fileUri, {
            headers: await getPdfAuthHeaders(),
        });

        return { uri: result.uri, filename };
    },

    downloadWarrantyCertificatePdf: async (service, months = 24, options = {}) => {
        const serviceId = typeof service === 'object' ? service?.id : service;
        if (!serviceId) throw new Error('Servis bulunamadi.');

        const params = { months };
        if (options.disposition) params.disposition = options.disposition;

        const endpoint = ENDPOINTS.SERVICES.ADMIN_WARRANTY_PDF(serviceId);
        const url = getApiFileUrl(endpoint, params);
        const receiptNumber = typeof service === 'object' ? service?.receipt_number : null;
        const filename = sanitizeFileName(`Garanti_Belgesi_${receiptNumber || String(serviceId).slice(0, 8)}.pdf`);
        const fileUri = `${FileSystem.cacheDirectory}${filename}`;

        const result = await FileSystem.downloadAsync(url, fileUri, {
            headers: await getPdfAuthHeaders(),
        });

        return { uri: result.uri, filename };
    },
};

export default serviceService;
