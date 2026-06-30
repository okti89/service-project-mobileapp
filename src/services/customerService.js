import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

const customerService = {
    /**
     * Tüm aktif müşterileri listeler.
     * Backend: GET /customers/customer-list/
     */
    listCustomers: async (params = {}) => {
        const response = await api.get(ENDPOINTS.CUSTOMERS.LIST, { params });
        const data = response?.data;
        return Array.isArray(data) ? data : data?.results || [];
    },
};

export default customerService;