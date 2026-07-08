import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import CustomInput from '@/components/CustomInput';
import AppBottomSheet from '@/components/AppBottomSheet';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const ROLES = [
    { key: 'technician', label: 'Teknisyen', icon: 'account-hard-hat-outline', color: '#FF8C00' },
    { key: 'admin', label: 'Yönetici', icon: 'shield-crown-outline', color: '#0066CC' },
];

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

const normalizePhoneTR = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    let local = digits;
    if (local.startsWith('90') && local.length >= 12) local = local.slice(2);
    if (local.startsWith('0') && local.length === 11) local = local.slice(1);
    if (local.length > 10) local = local.slice(-10);
    if (local.length !== 10) return raw;
    return `+90${local}`;
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminCreateUserScreen({ navigation }) {
    const { colors, isDark } = useTheme();

    const [role, setRole] = useState('technician');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');

    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

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

    const [resultSheet, setResultSheet] = useState({
        visible: false, type: 'success', title: '', description: '',
    });

    const [shareSheet, setShareSheet] = useState({
        visible: false, phone: '', email: '', password: '',
    });

    const cardBg = isDark ? '#1E2736' : '#FFFFFF';
    const borderClr = isDark ? 'rgba(255,255,255,0.07)' : '#E2E8F0';

    const closeResultSheet = useCallback(() =>
        setResultSheet(p => ({ ...p, visible: false })), []);

    const validate = useCallback(() => {
        const e = {};
        if (!firstName.trim()) e.firstName = 'Ad zorunlu';
        if (!lastName.trim()) e.lastName = 'Soyad zorunlu';
        if (!email.trim()) e.email = 'E-posta zorunlu';
        else if (!validateEmail(email)) e.email = 'Geçerli bir e-posta girin';
        if (!phone.trim()) e.phone = 'Telefon zorunlu';
        else if (normalizePhoneTR(phone).length < 13) e.phone = 'Geçerli bir telefon girin';
        if (!password) e.password = 'Şifre zorunlu';
        else if (password.length < 8) e.password = 'En az 8 karakter';
        setErrors(e);
        return Object.keys(e).length === 0;
    }, [firstName, lastName, email, phone, password]);

    const handleSubmit = useCallback(async () => {
        if (!validate() || submitting) return;
        setSubmitting(true);
        try {
            const payload = {
                email: String(email).trim().toLowerCase(),
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                phone_number: normalizePhoneTR(phone),
                password,
                role,
                is_active: true,
                approval_status: 'approved',
            };
            await api.post(ENDPOINTS.AUTH.USER_LIST, payload);
            setShareSheet({
                visible: true,
                phone: payload.phone_number,
                email: payload.email,
                password,
            });
        } catch (err) {
            const data = err?.response?.data;
            let message = 'Bilinmeyen bir hata oluştu';
            if (typeof data === 'string') message = data;
            else if (data?.detail) message = data.detail;
            else if (data?.email) message = `E-posta: ${data.email[0] || data.email}`;
            else if (data?.phone_number) message = `Telefon: ${data.phone_number[0] || data.phone_number}`;
            else if (data?.password) message = `Şifre: ${data.password[0] || data.password}`;
            else if (data?.non_field_errors) message = data.non_field_errors[0];
            else if (err?.message) message = err.message;
            setResultSheet({
                visible: true,
                type: 'error',
                title: 'Oluşturulamadı',
                description: message,
            });
        } finally {
            setSubmitting(false);
        }
    }, [validate, submitting, email, firstName, lastName, phone, password, role]);

    const handleResultConfirm = useCallback(() => {
        const wasSuccess = resultSheet.type === 'success';
        closeResultSheet();
        if (wasSuccess && navigation?.canGoBack?.()) {
            navigation.goBack();
        }
    }, [resultSheet.type, closeResultSheet, navigation]);

    const goBack = useCallback(() => {
        if (navigation?.canGoBack?.()) navigation.goBack();
    }, [navigation]);

    const handleShareSkip = useCallback(() => {
        setShareSheet(p => ({ ...p, visible: false }));
        goBack();
    }, [goBack]);

    const handleShareSend = useCallback(() => {
        const phoneDigits = String(shareSheet.phone || '').replace(/\D/g, '');
        const message =
            `Servis Yönetim Sistemi'ne hoş geldiniz!\n\n` +
            `Giriş bilgileriniz:\n` +
            `📧 E-posta: ${shareSheet.email}\n` +
            `🔑 Şifre: ${shareSheet.password}\n\n` +
            `Uygulamaya giriş yaptıktan sonra şifrenizi değiştirmeyi unutmayın.`;
        if (phoneDigits) {
            Linking.openURL(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`).catch(() => { });
        }
        setShareSheet(p => ({ ...p, visible: false }));
        goBack();
    }, [shareSheet, goBack]);

    const roleChips = useMemo(() => ROLES, []);

    return (
        <>
            <WrapperContainer edges={NO_BOTTOM_EDGES} style={{ flex: 1 }}>
                <Header
                    title="Yeni Kullanıcı"
                    subtitle="Admin veya teknisyen oluştur"
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
                            { paddingBottom: keyboardHeight + 82 },
                        ]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Rol seçimi */}
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Rol</Text>
                        <View style={styles.roleRow}>
                            {roleChips.map(r => {
                                const active = role === r.key;
                                return (
                                    <Pressable
                                        key={r.key}
                                        onPress={() => setRole(r.key)}
                                        style={({ pressed }) => [
                                            styles.roleChip,
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
                                        <Text style={[
                                            styles.roleChipText,
                                            { color: active ? r.color : colors.text },
                                        ]}>
                                            {r.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* Form */}
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
                                placeholder="ornek@firma.com"
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
                            <CustomInput
                                label="Şifre"
                                icon="lock-outline"
                                password
                                value={password}
                                onChangeText={setPassword}
                                error={errors.password}
                                placeholder="En az 8 karakter"
                            />
                        </View>

                        {/* Submit */}
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
                                    <MaterialCommunityIcons name="account-plus-outline" size={20} color="#FFFFFF" />
                                    <Text style={styles.submitBtnText}>Kullanıcı Oluştur</Text>
                                </>
                            )}
                        </Pressable>
                    </ScrollView>
                </KeyboardAvoidingView>
            </WrapperContainer>

            {/* Sonuç Sheet */}
            <AppBottomSheet
                visible={resultSheet.visible}
                onClose={handleResultConfirm}
                snapPoints={['38%']}
            >
                <View style={styles.sheetContent}>
                    <View style={[
                        styles.sheetIcon,
                        { backgroundColor: resultSheet.type === 'success' ? '#10B98115' : '#E11D4815' },
                    ]}>
                        <MaterialCommunityIcons
                            name={resultSheet.type === 'success' ? 'check-decagram-outline' : 'alert-circle-outline'}
                            size={28}
                            color={resultSheet.type === 'success' ? '#10B981' : '#E11D48'}
                        />
                    </View>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>{resultSheet.title}</Text>
                    <Text style={[styles.sheetDesc, { color: colors.textSecondary }]}>{resultSheet.description}</Text>
                    <Pressable
                        onPress={handleResultConfirm}
                        style={[styles.sheetBtn, {
                            backgroundColor: resultSheet.type === 'success' ? '#10B981' : '#E11D48',
                        }]}
                    >
                        <Text style={styles.sheetBtnText}>
                            {resultSheet.type === 'success' ? 'Tamam' : 'Tekrar Dene'}
                        </Text>
                    </Pressable>
                </View>
            </AppBottomSheet>

            {/* WhatsApp Gönderim Onayı */}
            <AppBottomSheet
                visible={shareSheet.visible}
                onClose={handleShareSkip}
                snapPoints={['50%']}
            >
                <View style={styles.sheetContent}>
                    <View style={[styles.sheetIcon, { backgroundColor: '#25D36622' }]}>
                        <MaterialCommunityIcons name="whatsapp" size={32} color="#25D366" />
                    </View>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>Bilgileri Gönder</Text>
                    <Text style={[styles.sheetDesc, { color: colors.textSecondary }]}>
                        Yeni oluşturulan kullanıcının e-posta ve şifresi WhatsApp üzerinden gönderilsin mi?
                    </Text>

                    {shareSheet.email ? (
                        <View style={[styles.previewBox, {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                            borderColor: borderClr,
                        }]}>
                            <View style={styles.previewRow}>
                                <MaterialCommunityIcons name="email-outline" size={14} color={colors.textSecondary} />
                                <Text style={[styles.previewText, { color: colors.text }]} numberOfLines={1}>
                                    {shareSheet.email}
                                </Text>
                            </View>
                            <View style={styles.previewRow}>
                                <MaterialCommunityIcons name="phone-outline" size={14} color={colors.textSecondary} />
                                <Text style={[styles.previewText, { color: colors.text }]} numberOfLines={1}>
                                    {shareSheet.phone}
                                </Text>
                            </View>
                        </View>
                    ) : null}

                    <View style={styles.shareRow}>
                        <Pressable
                            onPress={handleShareSkip}
                            style={[styles.shareBtn, styles.shareBtnOutline, { borderColor: colors.border }]}
                        >
                            <Text style={[styles.shareBtnText, { color: colors.text }]}>Atla</Text>
                        </Pressable>
                        <Pressable
                            onPress={handleShareSend}
                            style={[styles.shareBtn, { backgroundColor: '#25D366' }]}
                        >
                            <MaterialCommunityIcons name="whatsapp" size={16} color="#FFFFFF" />
                            <Text style={[styles.shareBtnText, { color: '#FFFFFF' }]}>Gönder</Text>
                        </Pressable>
                    </View>
                </View>
            </AppBottomSheet>
        </>
    );
}

const styles = StyleSheet.create({
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
    roleRow: {
        flexDirection: 'row',
        gap: 10,
    },
    roleChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1.5,
    },
    roleChipText: {
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

    // WhatsApp paylaşım sheet
    previewBox: {
        alignSelf: 'stretch',
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
        gap: 6,
    },
    previewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    previewText: {
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    shareRow: {
        flexDirection: 'row',
        alignSelf: 'stretch',
        gap: 10,
    },
    shareBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 48,
        borderRadius: 12,
    },
    shareBtnOutline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
    },
    shareBtnText: {
        fontSize: 14,
        fontWeight: '800',
    },
});
