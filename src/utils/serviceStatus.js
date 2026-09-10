const SERVICE_STATUS_LABELS = Object.freeze({
    new: 'Yeni',
    assigned: 'Atandı',
    in_progress: 'İşlemde',
    postponed: 'Ertelendi',
    completed: 'Tamamlandı',
    cancelled: 'İptal Edildi',
});

const DISPLAY_FIELDS = [
    'status_name',
    'service_status_display',
    'service_status_name',
    'status_display',
];

export const getServiceStatusLabel = (serviceOrCode, fallback = 'Durum belirtilmedi') => {
    if (serviceOrCode && typeof serviceOrCode === 'object') {
        for (const field of DISPLAY_FIELDS) {
            const value = String(serviceOrCode[field] || '').trim();
            if (value) return value;
        }

        const relationalStatus = serviceOrCode.status;
        if (relationalStatus && typeof relationalStatus === 'object') {
            const value = String(relationalStatus.name || relationalStatus.label || '').trim();
            if (value) return value;
        }

        return SERVICE_STATUS_LABELS[serviceOrCode.service_status] || fallback;
    }

    return SERVICE_STATUS_LABELS[String(serviceOrCode || '').trim().toLowerCase()] || fallback;
};
