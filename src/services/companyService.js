import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

const companyService = {
    getPublicConfig: async () => {
        const response = await api.get(ENDPOINTS.CONFIG.PUBLIC_COMPANY);
        return response?.data || null;
    },
};

export default companyService;
