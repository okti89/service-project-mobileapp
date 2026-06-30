import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

const deviceService = {
    listDeviceTypes: async () => {
        const response = await api.get(ENDPOINTS.DEVICES.TYPES);
        const data = response?.data;
        return Array.isArray(data) ? data : data?.results || [];
    },

    listBrands: async (params = {}) => {
        const response = await api.get(ENDPOINTS.DEVICES.BRANDS, { params });
        const data = response?.data;
        return Array.isArray(data) ? data : data?.results || [];
    },

    listModels: async (params = {}) => {
        const response = await api.get(ENDPOINTS.DEVICES.MODELS, { params });
        const data = response?.data;
        return Array.isArray(data) ? data : data?.results || [];
    },
};

export default deviceService;