const ENDPOINTS = {
    AUTH: {
        LOGIN: 'accounts/auth/login/',
        LOGOUT: 'accounts/auth/logout/',
        REGISTER: 'accounts/auth/register/',
        CHECK_AUTH: 'accounts/auth/check/',
        ME: 'accounts/auth/check/',
        CHANGE_PASSWORD: 'accounts/auth/change-password/',
        PASSWORD_RESET_REQUEST: 'accounts/auth/password/reset/request/',
        PASSWORD_RESET_VERIFY: 'accounts/auth/password/reset/verify/',
        PASSWORD_RESET_CONFIRM: 'accounts/auth/password/reset/confirm/',
        REGISTER_DEVICE: 'accounts/devices/register/',
        ADMIN_USER_DEVICES: 'accounts/admin/devices/',
        ADMIN_USER_DEVICE_DETAIL: (id) => `accounts/admin/devices/${id}/`,
        ADMIN_USER_DEVICE_STATS: 'accounts/admin/devices/stats/',
        USER_APPROVAL: 'accounts/admin/users/approval/',
        USER_LIST: 'accounts/admin/users/',
        USER_DETAIL: (id) => `accounts/admin/users/${id}/`,
    },
    CONFIG: {
        PUBLIC_COMPANY: 'config/public/company/',
        COMPANY_CONFIGS: 'config/company-configs/',
        COMPANY_CONFIG_DETAIL: (id) => `config/company-configs/${id}/`,
    },
    WORKING_HOURS: {
        LIST: 'config/working-hours/',
        DETAIL: (id) => `config/working-hours/${id}/`,
    },
    HOLIDAYS: {
        LIST: 'config/holiday-exceptions/',
        DETAIL: (id) => `config/holiday-exceptions/${id}/`,
    },
    TECHNICIAN: {
        ME: 'technicians/me/',
        LIST: 'technicians/technician-list/',
        SHIFTS: 'technicians/shifts/',
        SHIFT_START: 'technicians/shifts/start/',
        SHIFT_STOP: 'technicians/shifts/stop/',
        STATUS: 'technicians/me/status/',
        LOCATION_PING: 'technicians/me/location-ping/',
        LOCATION_LOGS: 'technicians/location-logs/',
    },
    SERVICES: {
        TECHNICIAN_LIST: 'services/technician-services/',
        TECHNICIAN_DETAIL: (id) => `services/technician-services/${id}/`,
        ADMIN_LIST: 'services/admin-services/',
        ADMIN_DETAIL: (id) => `services/admin-services/${id}/`,
        ADMIN_WARRANTY_PDF: (id) => `services/admin-services/${id}/warranty-pdf/`,
        STATUS_LIST: 'services/service-statuses/',
    },
    CUSTOMERS: {
        LIST: 'customers/customer-list/',
        DETAIL: (id) => `customers/customers/${id}/`,
    },
    DEVICES: {
        TYPES: 'services/device-types/',
        BRANDS: 'services/brands/',
        MODELS: 'services/models/',
    },
    NOTIFICATIONS: {
        LIST: 'notifications/notifications/',
        DETAIL: (id) => `notifications/notifications/${id}/`,
    },
    MAPS: {
        // /maps/geocode/ iki yonludur:
        //   Forward  - POST { address }       (adres -> lat/lon)
        //   Reverse  - GET ?lat=&lon=         (lat/lon -> adres)
        // Her iki yon ayni 'geocode' api type kotasini harcar.
        GEOCODE: 'maps/geocode/',
    },
    PRODUCTS: {
        LIST: 'products/products/',
        DETAIL: (id) => `products/products/${id}/`,
        CATEGORIES: 'products/categories/',
        STOCK_MOVEMENTS: 'products/stock-movements/',
    },
    REPORTS: {
        DASHBOARD: 'reports/dashboard/',
        GENERAL: 'reports/general/',
        TECHNICIAN: 'reports/technician/',
        MY_PERFORMANCE: 'reports/my-performance/',
        OVERDUE_RECEIVABLES: 'reports/overdue-receivables/',
        TECHNICIAN_DETAIL: (id) => `reports/technician/${id}/`,
        GENERAL_PDF: 'reports/general/',
        TECHNICIAN_PDF: 'reports/technician/',
    },
};

export default ENDPOINTS;