import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

/**
 * Auth header ile birlikte tam URL uretir (PDF blob/harici acar icin).
 * Axios baseURL + endpoint birlestirilir.
 */
const buildAuthUrl = (endpoint, params = {}) => {
    const baseURL = String(api.defaults.baseURL || '').replace(/\/$/, '');
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        search.append(key, value);
    });
    const query = search.toString();
    return `${baseURL}/${endpoint.replace(/^\//, '')}${query ? `?${query}` : ''}`;
};

const reportService = {
    /**
     * Dashboard ozet istatistikleri (finans, alacak, aktif servis, kritik stok vb.).
     * Backend: GET /reports/dashboard/
     */
    getDashboard: async (params = {}) => {
        const response = await api.get(ENDPOINTS.REPORTS.DASHBOARD, { params });
        return response?.data || {};
    },

    /**
     * Genel performans metrikleri (toplam servis, tamamlanan/bekleyen/iptal oranlari, musteri sayisi).
     * Backend: GET /reports/general/
     */
    getGeneralPerformance: async (params = {}) => {
        const response = await api.get(ENDPOINTS.REPORTS.GENERAL, { params });
        return response?.data || {};
    },

    /**
     * Tum teknisyenlerin donem bazli performans siralamasi.
     * Backend: GET /reports/technician/
     */
    getTechnicianPerformance: async (params = {}) => {
        const response = await api.get(ENDPOINTS.REPORTS.TECHNICIAN, { params });
        const data = response?.data;
        return Array.isArray(data) ? data : data?.results || [];
    },

    /**
     * Giris yapmis teknisyenin kendi performans ozeti.
     * Backend: GET /reports/my-performance/
     */
    getMyPerformance: async (params = {}) => {
        const response = await api.get(ENDPOINTS.REPORTS.MY_PERFORMANCE, { params });
        return response?.data || null;
    },

    /**
     * Gecikmis alacaklar listesi (tahsil edilmeyen servisler).
     * Backend: GET /reports/overdue-receivables/
     */
    getOverdueReceivables: async (params = {}) => {
        const response = await api.get(ENDPOINTS.REPORTS.OVERDUE_RECEIVABLES, { params });
        return response?.data || { results: [] };
    },

    /**
     * Belirli bir teknisyenin detay performansi.
     * Backend: GET /reports/technician/{id}/
     */
    getTechnicianDetailPerformance: async (technicianId, params = {}) => {
        if (!technicianId) return null;
        const response = await api.get(ENDPOINTS.REPORTS.TECHNICIAN_DETAIL(technicianId), { params });
        return response?.data || null;
    },

    /**
     * Genel performans PDF export (blob).
     * Backend: GET /reports/general/?export=pdf
     */
    exportGeneralPdf: async (params = {}) => {
        const response = await api.get(ENDPOINTS.REPORTS.GENERAL_PDF, {
            params: { ...params, export: 'pdf' },
            responseType: 'blob',
        });
        return response?.data;
    },

    /**
     * Teknisyen performans PDF export (blob).
     * Backend: GET /reports/technician/?export=pdf
     */
    exportTechnicianPdf: async (params = {}) => {
        const response = await api.get(ENDPOINTS.REPORTS.TECHNICIAN_PDF, {
            params: { ...params, export: 'pdf' },
            responseType: 'blob',
        });
        return response?.data;
    },

    /**
     * PDF icin auth-token eklenmis tam URL (Linking.openURL ile dis acici).
     */
    buildPdfUrl: (kind, params = {}) => {
        const endpoint = kind === 'technician' ? ENDPOINTS.REPORTS.TECHNICIAN_PDF : ENDPOINTS.REPORTS.GENERAL_PDF;
        return buildAuthUrl(endpoint, { ...params, export: 'pdf' });
    },
};

export default reportService;
