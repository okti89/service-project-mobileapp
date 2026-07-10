import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

const technicianService = {
    getMyProfile: async () => {
        const response = await api.get(ENDPOINTS.TECHNICIAN.ME);
        return response?.data || null;
    },

    getTechnicians: async (params = {}) => {
        const response = await api.get(ENDPOINTS.TECHNICIAN.LIST, { params });
        return Array.isArray(response?.data) ? response.data : [];
    },

    getShifts: async (params = {}) => {
        const response = await api.get(ENDPOINTS.TECHNICIAN.SHIFTS, { params });
        return Array.isArray(response?.data) ? response.data : [];
    },

    startShift: async (payload = {}) => {
        const response = await api.post(ENDPOINTS.TECHNICIAN.SHIFT_START, payload);
        return response?.data || null;
    },

    stopShift: async (payload = {}) => {
        const response = await api.post(ENDPOINTS.TECHNICIAN.SHIFT_STOP, payload);
        return response?.data || null;
    },
};

export default technicianService;
