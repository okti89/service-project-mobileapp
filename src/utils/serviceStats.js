/**
 * Servis durumlarını backend'den gelen `status_name` / `service_status`
 * string'lerine göre eşleştiren yardımcılar.
 *
 * Statü karşılaştırması case-insensitive ve Türkçe/İngilizce
 * anahtar kelimelere dayanır — backend değişikliklerinde
 * buradaki listeleri güncellemek yeterlidir.
 */

const COMPLETED_KEYWORDS = ['tamam', 'complete', 'done', 'closed', 'bitir', 'teslim', 'finished'];
const ACTIVE_KEYWORDS = ['devam', 'progress', 'active', 'yolda', 'basla', 'working', 'in_progress'];
const PENDING_KEYWORDS = ['bekle', 'pending', 'new', 'yeni', 'plan', 'scheduled'];

export const STATUS_GROUPS = {
    completed: COMPLETED_KEYWORDS,
    active: ACTIVE_KEYWORDS,
    pending: PENDING_KEYWORDS,
};

export const matchStatus = (service, keywords) => {
    const label = `${service?.status_name || ''} ${service?.service_status || ''}`.toLowerCase();
    return keywords.some((k) => label.includes(k));
};

/**
 * Servis listesinden istatistik türetir.
 * Backend'den gelen services dizisinden tamamlanan/aktif/bekleyen
 * sayılarını hesaplar — tüketici taraf mock değer üretmez.
 */
export const computeServiceStats = (services = []) => {
    const list = Array.isArray(services) ? services : [];
    return {
        total: list.length,
        completed: list.filter((s) => matchStatus(s, COMPLETED_KEYWORDS)).length,
        active: list.filter((s) => matchStatus(s, ACTIVE_KEYWORDS)).length,
        pending: list.filter((s) => matchStatus(s, PENDING_KEYWORDS)).length,
    };
};