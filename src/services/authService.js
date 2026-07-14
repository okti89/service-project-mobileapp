import AsyncStorage from '@react-native-async-storage/async-storage';

import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';

const normalizePhoneTR = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';

    let local = digits;
    if (local.startsWith('90') && local.length >= 12) {
        local = local.slice(2);
    }
    if (local.startsWith('0') && local.length === 11) {
        local = local.slice(1);
    }
    if (local.length > 10) {
        local = local.slice(-10);
    }
    if (local.length !== 10) {
        return raw;
    }
    return `0${local}`;
};


const authService = {
    login: async (email, password) => {
        try {
            const response = await api.post(
                ENDPOINTS.AUTH.LOGIN,
                {
                    email: String(email || '').trim().toLowerCase(),
                    password,
                },
                {
                    headers: { 'X-Tenant-Code': '' },
                }
            );
            return response.data;
        } catch (error) {
            console.log("login error", error);
            throw error;
        }
    },

    register: async (userData) => {
        try {
            const payload = {
                ...userData,
                phone_number: normalizePhoneTR(userData?.phone_number),
                email: String(userData?.email || '').trim().toLowerCase(),
                tenant_code: String(userData?.tenant_code || '').trim(),
            };
            const tenantCode = String(userData?.tenant_code || '').trim().toLowerCase();
            const response = await api.post(ENDPOINTS.AUTH.REGISTER, payload, {
                headers: tenantCode ? { 'X-Tenant-Code': tenantCode } : {},
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    logout: async () => {
        try {
            await api.post(ENDPOINTS.AUTH.LOGOUT);

        } catch (error) {
            // 401 (token zaten süresi dolmuş/geçersiz) ve 403 durumları
            // beklenen senaryolardır; konsola error düşürmüyoruz.
            // Beklenmeyen hatalar için hafif bir uyarı loglanır.
            const status = error?.response?.status;
            if (status !== 401 && status !== 403) {
                console.warn('Logout sırasında beklenmeyen hata:', status, error?.message);
            }
        }
        finally {
            await AsyncStorage.removeItem('auth_token');
        }
    },

    deleteAccount: async (password) => {
        const response = await api.delete(ENDPOINTS.AUTH.DELETE_ACCOUNT, { data: { password, confirmation: 'SİL' } });
        return response.data;
    },

    checkAuth: async () => {
        try {
            const response = await api.get(ENDPOINTS.AUTH.CHECK_AUTH);
            return response.data;
        } catch (error) {
            return error;
        }
    },

    updateProfile: async ({ first_name, last_name, email, phone_number, avatarUri }) => {
        try {
            const formData = new FormData();
            if (first_name !== undefined) formData.append('first_name', first_name);
            if (last_name !== undefined) formData.append('last_name', last_name);
            if (email !== undefined) formData.append('email', String(email || '').trim().toLowerCase());
            if (phone_number !== undefined) formData.append('phone_number', normalizePhoneTR(phone_number));
            if (avatarUri) {
                const fileName = avatarUri.split('/').pop() || `avatar_${Date.now()}.jpg`;
                const ext = fileName.split('.').pop()?.toLowerCase();
                const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
                formData.append('avatar', {
                    uri: avatarUri,
                    name: fileName,
                    type: mimeType,
                });
            }

            const response = await api.patch(
                ENDPOINTS.AUTH.ME,
                formData
            );
            return response.data;
        } catch (error) {
            return error;
        }
    },

    changePassword: async (old_password, new_password) => {
        try {
            const response = await api.post(ENDPOINTS.AUTH.CHANGE_PASSWORD, {
                old_password,
                new_password,
            });
            return response.data;
        } catch (error) {
            return error;
        }
    },

    passwordResetRequest: async (email) => {
        try {
            const response = await api.post(ENDPOINTS.AUTH.PASSWORD_RESET_REQUEST, { email });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    passwordResetVerify: async (email, code) => {
        try {
            const response = await api.post(ENDPOINTS.AUTH.PASSWORD_RESET_VERIFY, { email, code });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    passwordResetConfirm: async (email, code, new_password) => {
        try {
            const response = await api.post(ENDPOINTS.AUTH.PASSWORD_RESET_CONFIRM, { email, code, new_password });
            return response.data;
        } catch (error) {
            throw error;
        }
    },
};

export default authService;

