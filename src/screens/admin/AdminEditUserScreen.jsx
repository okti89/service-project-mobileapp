import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import CustomInput from '@/components/CustomInput';
import AppBottomSheet from '@/components/AppBottomSheet';
import { serviceRed } from '@/theme/color';

const ROLES = [
    { key: 'technician', label: 'Teknisyen', icon: 'account-hard-hat-outline', color: '#FF8C00' },
    { key: 'admin', label: 'Yönetici', icon: 'shield-crown-outline', color: '#0066CC' },
];

const STATUSES = [
    { key: 'approved', label: 'Aktif', icon: 'check-circle-outline', color: '#16A34A' },
    { key: 'inactive', label: 'Pasif', icon: 'account-off-outline', color: serviceRed },
];

const normalizePhoneTR = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    let local = digits;
    if (local.startsWith('90') && local.length >= 12) local = local.slice(2);
    if (local.startsWith('0') && local.length === 11) local = local.slice(1);
    if (local.length > 10) local = local.slice(-10);
    if (local.length !== 10) return raw;
    return `0${local}`;
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

export default function AdminEditUserScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();

    const targetUser = route?.params?.user || null;
    const targetUserId = route?.params?.userId || targetUser?.id || null;

    const [role, setRole] = useState(targetUser?.user_type || 'technician');
    const [status, setStatus] = useState(targetUser?.approval_status || 'approved');
    const [firstName, setFirstName] = useState(targetUser?.first_name || '');
    const [lastName, setLastName] = useState(targetUser?.last_name || '');
    const [email, setEmail] = useState(targetUser?.email || '');
    const [phone, setPhone] = useState(targetUser?.phone_number || '');

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(!targetUser && !!targetUserId);
    const [submitting, setSubmitting] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const [resultSheet, setResultSheet] = useState({
        visible: false, type: 'success', title: '', description: '',
    });

    const cardBg = isDark ? '#1E2736' : '#FFFFFF';
    const borderClr = isDark ? 'rgba(255,255,255,0.07)' : '#E2E8F0';

    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => setKeyboardHeight(e.endCoordinates?.height || 0),
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardHeight(0),
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    useEffect(() => {
        if (!targetUser && targetUserId) {
            setLoading(true);
            api.get(ENDPOINTS.AUTH.USER_DETAIL(targetUserId))
                .then(res => {
                    const u = res.data;
                    setRole(u.user_type);
                    setStatus(u.approval_status);
                    setFirstName(u.first_name || '');
                    setLastName(u.last_name || '');
                    setEmail(u.email || '');
                    setPhone(u.phone_number || '');
                })
                .catch(() => {
                    showToast('error', 'Hata', 'Kullanıcı detayları yüklenemedi.');
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [targetUser, targetUserId, showToast]);

    const closeResultSheet = useCallback(() =>
        setResultSheet(p => ({ ...p, visible: false })), []);

    const validate = useCallback(() => {
        const e = {};
        if (!firstName.trim()) e.firstName = 'Ad zorunlu';
        if (!lastName.trim()) e.lastName = 'Soyad zorunlu';
        if (!email.trim()) e.email = 'E-posta zorunlu';
        else if (!validateEmail(email)) e.email = 'Geçerli bir e-posta girin';
        if (!phone.trim()) e.phone = 'Telefon zorunlu';
        else if (normalizePhoneTR(phone).length < 11) e.phone = 'Geçerli bir telefon girin';
        setErrors(e);
        return Object.keys(e).length === 0;
    }, [firstName, lastName, email, phone]);

    const handleSubmit = useCallback(async () => {
        if (!validate() || submitting || !targetUserId) return;
        setSubmitting(true);
        try {
            const payload = {
                email: String(email).trim().toLowerCase(),
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                phone_number: normalizePhoneTR(phone),
                user_type: role,
                approval_status: status,
            };
            const res = await api.patch(ENDPOINTS.AUTH.USER_DETAIL(targetUserId), payload);
            if (res?.data?.user_type !== role) {
                throw new Error('Kullanıcı rolü sunucuda güncellenemedi.');
            }
            // Callback ile üst listeyi yerel olarak güncelle
            const onSuccess = route?.params?.onSuccess;
            if (onSuccess) onSuccess(res.data);
            showToast('success', 'Güncellendi', 'Kullanıcı bilgileri başarıyla güncellendi.');
            if (navigation?.canGoBack?.()) navigation.goBack();
        } catch (err) {
            const data = err?.response?.data;
            let message = 'Bilinmeyen bir hata oluştu';
            if (typeof data === 'string') message = data;
            else if (data?.detail) message = data.detail;
            else if (data?.email) message = `E-posta: ${data.email[0] || data.email}`;
            else if (data?.phone_number) message = `Telefon: ${data.phone_number[0] || data.phone_number}`;
            else if (data?.non_field_errors) message = data.non_field_errors[0];
            else if (err?.message) message = err.message;
            setResultSheet({ visible: true, type: 'error', title: 'Güncellenemedi', description: message });
        } finally {
            setSubmitting(false);
        }
    }, [validate, submitting, targetUserId, email, firstName, lastName, phone, role, status, navigation, showToast, route?.params?.onSuccess]);

    const handleResultClose = useCallback(() => closeResultSheet(), [closeResultSheet]);

    if (loading) {
        return (
            <WrapperContainer edges={NO_BOTTOM_EDGES}>
                <Header title="Kullanıcı Düzenle" showBack centered borderBottom />
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </WrapperContainer>
        );
    }

    return (
        <>
            <WrapperContainer edges={NO_BOTTOM_EDGES} style={{ flex: 1 }}>
                <Header
                    title="Kullanıcı Düzenle"
                    subtitle="Bilgileri düzenleyip kaydet"
                    showBack
                    centered
                    borderBottom
                />

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    <ScrollView
                        contentContainerStyle={[
                            styles.scroll,
                            { paddingBottom: keyboardHeight + 32 },
                        ]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* ROL SEÇİMİ */}
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Kullanıcı Rolü</Text>
                        <View style={styles.chipRow}>
                            {ROLES.map(r => {
                                const active = role === r.key;
                                return (
                                    <Pressable
                                        key={r.key}
                                        onPress={() => setRole(r.key)}
                                        style={({ pressed }) => [
                                            styles.chip,
                                            {
                                                backgroundColor: active ? r.color + '15' : cardBg,
                                                borderColor: active ? r.color : borderClr,
                                                opacity: pressed ? 0.85 : 1,
                                            },
                                        ]}
                                    >
                                        <MaterialCommunityIcons
                                            name={r.icon}
                                            size={20}
                                            color={active ? r.color : colors.textSecondary}
                                        />
                                        <Text style={[styles.chipText, { color: active ? r.color : colors.text }]}>
                                            {r.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* DURUM SEÇİMİ */}
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Hesap Durumu</Text>
                        <View style={styles.chipRow}>
                            {STATUSES.map(s => {
                                const active = status === s.key;
                                return (
                                    <Pressable
                                        key={s.key}
                                        onPress={() => setStatus(s.key)}
                                        style={({ pressed }) => [
                                            styles.chip,
                                            {
                                                backgroundColor: active ? s.color + '15' : cardBg,
                                                borderColor: active ? s.color : borderClr,
                                                opacity: pressed ? 0.85 : 1,
                                            },
                                        ]}
                                    >
                                        <MaterialCommunityIcons
                                            name={s.icon}
                                            size={20}
                                            color={active ? s.color : colors.textSecondary}
                                        />
                                        <Text style={[styles.chipText, { color: active ? s.color : colors.text }]}>
                                            {s.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* FORM ALANLARI */}
                        <View style={[styles.formCard, { backgroundColor: cardBg, borderColor: borderClr }]}>
                            <CustomInput
                                label="Ad"
                                icon="account-outline"
                                value={firstName}
                                onChangeText={setFirstName}
                                error={errors.firstName}
                                autoCapitalize="words"
                                placeholder="Ad"
                            />
                            <CustomInput
                                label="Soyad"
                                icon="account-outline"
                                value={lastName}
                                onChangeText={setLastName}
                                error={errors.lastName}
                                autoCapitalize="words"
                                placeholder="Soyad"
                            />
                            <CustomInput
                                label="E-posta"
                                icon="email-outline"
                                value={email}
                                onChangeText={setEmail}
                                error={errors.email}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                placeholder="örnek@gmail.com"
                            />
                            <CustomInput
                                label="Telefon"
                                icon="phone-outline"
                                isPhone
                                value={phone}
                                onChangeText={setPhone}
                                error={errors.phone}
                                placeholder="5__ ___ __ __"
                            />
                        </View>

                        {/* GÜNCELLE BUTONU - ScrollView içinde formun hemen altında */}
                        <Pressable
                            onPress={handleSubmit}
                            disabled={submitting}
                            style={({ pressed }) => [
                                styles.submitBtn,
                                {
                                    backgroundColor: colors.primary,
                                    opacity: submitting ? 0.7 : pressed ? 0.85 : 1,
                                },
                            ]}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="content-save-outline" size={20} color="#FFFFFF" />
                                    <Text style={styles.submitBtnText}>Bilgileri Güncelle</Text>
                                </>
                            )}
                        </Pressable>
                    </ScrollView>
                </KeyboardAvoidingView>
            </WrapperContainer>

            {/* HATA BOTTOM SHEET */}
            <AppBottomSheet
                visible={resultSheet.visible}
                onClose={handleResultClose}
                snapPoints={['38%']}
            >
                <View style={styles.sheetContent}>
                    <View style={[styles.sheetIcon, { backgroundColor: '#E11D4815' }]}>
                        <MaterialCommunityIcons
                            name="alert-circle-outline"
                            size={28}
                            color="#E11D48"
                        />
                    </View>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>{resultSheet.title}</Text>
                    <Text style={[styles.sheetDesc, { color: colors.textSecondary }]}>{resultSheet.description}</Text>
                    <Pressable
                        onPress={handleResultClose}
                        style={[styles.sheetBtn, { backgroundColor: '#E11D48' }]}
                    >
                        <Text style={styles.sheetBtnText}>Kapat</Text>
                    </Pressable>
                </View>
            </AppBottomSheet>
        </>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scroll: {
        padding: 16,
        gap: 14,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    chipRow: {
        flexDirection: 'row',
        gap: 10,
    },
    chip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1.5,
    },
    chipText: {
        fontSize: 14,
        fontWeight: '700',
    },
    formCard: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 52,
        borderRadius: 14,
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    sheetContent: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    sheetIcon: {
        width: 56,
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    sheetTitle: {
        fontSize: 17,
        fontWeight: '800',
        marginBottom: 6,
        textAlign: 'center',
    },
    sheetDesc: {
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
        marginBottom: 16,
    },
    sheetBtn: {
        alignSelf: 'stretch',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
});
