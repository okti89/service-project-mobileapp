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
};

export default ENDPOINTS;
