import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

const productService = {
    /**
     * Tum urunleri listeler. Backend: GET /products/products/
     * IsAdmin filtresi backend'de uygulaniyor, burada tenant filtresi yok.
     */
    getProducts: async (params = {}) => {
        const response = await api.get(ENDPOINTS.PRODUCTS.LIST, { params });
        const data = response?.data;
        return Array.isArray(data) ? data : data?.results || [];
    },

    /**
     * Urun kategorilerini listeler. Backend: GET /products/categories/
     */
    getCategories: async () => {
        const response = await api.get(ENDPOINTS.PRODUCTS.CATEGORIES);
        const data = response?.data;
        return Array.isArray(data) ? data : data?.results || [];
    },
};

export default productService;
