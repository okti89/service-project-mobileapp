import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

const serviceService = {
    getTechnicianServices: async (params = {}) => {
        const response = await api.get(ENDPOINTS.SERVICES.TECHNICIAN_LIST, { params });
        return Array.isArray(response?.data) ? response.data : [];
    },

    getTechnicianService: async (id) => {
        const response = await api.get(ENDPOINTS.SERVICES.TECHNICIAN_DETAIL(id));
        return response?.data;
    },

    getAllServices: async (params = {}) => {
        const response = await api.get(ENDPOINTS.SERVICES.ADMIN_LIST, { params });
        return Array.isArray(response?.data) ? response.data : [];
    },

    getServiceStatuses: async () => {
        const response = await api.get(ENDPOINTS.SERVICES.STATUS_LIST);
        return Array.isArray(response?.data) ? response.data : [];
    },

    updateAdminService: async (id, payload) => {
        const response = await api.patch(ENDPOINTS.SERVICES.ADMIN_DETAIL(id), payload);
        return response?.data;
    },

    createService: async (payload) => {
        const response = await api.post(ENDPOINTS.SERVICES.TECHNICIAN_LIST, payload);
        return response?.data;
    },
};

export default serviceService;
