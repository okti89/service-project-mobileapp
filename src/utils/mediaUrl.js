import api from '@/api/axios';

const API_BASE = api?.defaults?.baseURL || '';
const MEDIA_BASE = API_BASE.replace(/\/api\/?$/, '');

export const resolveMediaUrl = (path) => {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith('//')) return `https:${path}`;

    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${MEDIA_BASE}${normalized}`;
};

export default resolveMediaUrl;
