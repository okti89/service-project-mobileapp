import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

const normalizeList = (response) => {
    const data = response?.data;
    return Array.isArray(data) ? data : data?.results || [];
};

const deviceService = {
    listDeviceTypes: async () => {
        const response = await api.get(ENDPOINTS.DEVICES.TYPES);
        return normalizeList(response);
    },

    listBrands: async (params = {}) => {
        const response = await api.get(ENDPOINTS.DEVICES.BRANDS, { params });
        return normalizeList(response);
    },

    listModels: async (params = {}) => {
        const response = await api.get(ENDPOINTS.DEVICES.MODELS, { params });
        return normalizeList(response);
    },

    createDeviceType: async (name) => {
        const response = await api.post(ENDPOINTS.DEVICES.TYPES, { name });
        return response?.data;
    },

    createBrand: async (name) => {
        const response = await api.post(ENDPOINTS.DEVICES.BRANDS, { name });
        return response?.data;
    },

    createModel: async ({ name, brandId }) => {
        const response = await api.post(ENDPOINTS.DEVICES.MODELS, { name, brand: brandId });
        return response?.data;
    },
};

export default deviceService;