import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import CustomInput from '@/components/CustomInput';
import { serviceBlue, serviceRed } from '@/theme/color';



const FormCard = ({ children, style }) => {
    const { colors } = useTheme();
    return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
            {children}
        </View>
    );
};

export default function CustomerFormScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { showToast } = useToast();

    const customer = route?.params?.customer || null;
    const isEdit = Boolean(customer);

    const [form, setForm] = useState({
        full_name: '',
        phone_number: '',
        email: '',
        address: '',
        note: '',
    });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (customer) {
            const cleanPhone = (customer.phone_number || '').replace(/^\+9/, '').trim();
            setForm({
                full_name: customer.full_name || '',
                phone_number: cleanPhone,
                email: customer.email || '',
                address: customer.address || '',
                note: customer.note || '',
            });
        }
    }, [customer]);

    const setField = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
        if (errors[key]) {
            setErrors(prev => ({ ...prev, [key]: null }));
        }
    };

    const validate = () => {
        const next = {};
        if (!form.full_name.trim()) {
            next.full_name = 'Ad soyad gerekli';
        }
        if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
            next.email = 'Geçerli bir e-posta girin';
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;

        setSaving(true);
        setErrors({});

        const payload = {
            full_name: form.full_name.trim(),
            phone_number: form.phone_number.trim(),
            email: form.email.trim(),
            address: form.address.trim(),
            note: form.note.trim(),
        };

        try {
            if (isEdit) {
                await api.put(ENDPOINTS.CUSTOMERS.DETAIL(customer.id), payload);
                showToast('success', 'Müşteri Güncellendi', 'Müşteri bilgileri başarıyla güncellendi.');
            } else {
                await api.post(ENDPOINTS.CUSTOMERS.CREATE, payload);
                showToast('success', 'Müşteri Eklendi', 'Yeni müşteri başarıyla eklendi.');
            }
            navigation.goBack();
        } catch (error) {
            const responseData = error?.response?.data;
            if (responseData && typeof responseData === 'object') {
                if (Array.isArray(responseData)) {
                    showToast('error', 'Hata', responseData[0] || responseData.message || 'Kaydetme başarısız');
                } else if (responseData.detail) {
                    showToast('error', 'Hata', responseData.detail);
                } else {
                    const fieldErrors = {};
                    Object.keys(responseData).forEach(key => {
                        const msgs = responseData[key];
                        fieldErrors[key] = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
                    });
                    if (Object.keys(fieldErrors).length > 0) {
                        setErrors(fieldErrors);
                        showToast('error', 'Hata', 'Lütfen formdaki hataları kontrol edin.');
                    } else {
                        showToast('error', 'Hata', 'Kaydetme başarısız');
                    }
                }
            } else {
                showToast('error', 'Hata', 'Sunucu hatası oluştu');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        if (!customer) return;
        Alert.alert(
            'Müşteriyi Sil',
            `"${customer.full_name}" silinecek. Bu işlem geri alınamaz.`,
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(ENDPOINTS.CUSTOMERS.DETAIL(customer.id));
                            showToast('success', 'Müşteri Silindi', 'Müşteri kaydı başarıyla silindi.');
                            navigation.goBack();
                        } catch (error) {
                            showToast('error', 'Hata', error?.response?.data?.detail || 'Silme başarısız');
                        }
                    },
                },
            ]
        );
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    {isEdit ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'}
                </Text>
                <Pressable onPress={handleSave} disabled={saving} style={styles.headerBtn}>
                    {saving ? (
                        <ActivityIndicator size="small" color={serviceBlue} />
                    ) : (
                        <MaterialCommunityIcons name="check" size={24} color={serviceBlue} />
                    )}
                </Pressable>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 20}
            >
                <ScrollView
                    style={styles.body}
                    contentContainerStyle={[
                        styles.bodyContent,
                        { paddingBottom: insets.bottom + 140 },
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <FormCard>
                        <CustomInput
                            label="Ad Soyad *"
                            icon="account-outline"
                            value={form.full_name}
                            onChangeText={v => setField('full_name', v)}
                            placeholder="Müşteri adı ve soyadı"
                            error={errors.full_name}
                        />
                        <CustomInput
                            label="Telefon"
                            icon="phone-outline"
                            value={form.phone_number}
                            onChangeText={v => setField('phone_number', v)}
                            placeholder="5xx xxx xx xx"
                            isPhone
                            error={errors.phone_number}
                        />
                        <CustomInput
                            label="E-posta"
                            icon="email-outline"
                            value={form.email}
                            onChangeText={v => setField('email', v)}
                            placeholder="ornek@mail.com"
                            error={errors.email}
                            disableSmartFormat
                        />
                        <CustomInput
                            label="Adres"
                            icon="map-marker-outline"
                            value={form.address}
                            onChangeText={v => setField('address', v)}
                            placeholder="Müşteri adresi..."
                            error={errors.address}
                            multiline
                            numberOfLines={3}
                            inputContainerStyle={{ height: 90, alignItems: 'flex-start', paddingTop: 8 }}
                            style={{ textAlignVertical: 'top', height: 80, color: '#0F172A' }}
                        />
                        <CustomInput
                            label="Not"
                            icon="note-text-outline"
                            value={form.note}
                            onChangeText={v => setField('note', v)}
                            placeholder="Müşteri ile ilgili notlar..."
                            error={errors.note}
                            multiline
                            numberOfLines={3}
                            maxLength={500}
                            inputContainerStyle={{ height: 90, alignItems: 'flex-start', paddingTop: 8 }}
                            style={{ textAlignVertical: 'top', height: 80, color: '#0F172A' }}
                        />
                    </FormCard>

                    <View style={styles.actionsRow}>
                        {isEdit && (
                            <Pressable
                                onPress={handleDelete}
                                style={({ pressed }) => [
                                    styles.deleteBtn,
                                    { borderColor: `${serviceRed}40` },
                                    pressed && styles.btnPressed,
                                ]}
                            >
                                <MaterialCommunityIcons name="trash-can-outline" size={18} color={serviceRed} />
                                <Text style={[styles.deleteBtnText, { color: serviceRed }]}>Sil</Text>
                            </Pressable>
                        )}
                        <Pressable
                            onPress={handleSave}
                            disabled={saving}
                            style={({ pressed }) => [
                                styles.saveBtn,
                                { backgroundColor: serviceBlue },
                                pressed && styles.btnPressed,
                            ]}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons
                                        name={isEdit ? 'content-save-outline' : 'plus'}
                                        size={20}
                                        color="#FFFFFF"
                                    />
                                    <Text style={styles.saveBtnText}>
                                        {isEdit ? 'Değişiklikleri Kaydet' : 'Müşteriyi Ekle'}
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800' },

    body: { flex: 1 },
    bodyContent: { paddingHorizontal: 16, paddingTop: 8 },

    // Card sections (ProductFormScreen stili)
    card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 4 },

    // Section title
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
    sectionIconWrap: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    sectionTitleText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },

    // Field
    fieldWrap: { marginBottom: 12 },
    fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 7 },
    fieldLabelText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
    fieldChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: 14,
        paddingHorizontal: 14,
        minHeight: 48,
    },
    fieldChipArea: { alignItems: 'flex-start', paddingVertical: 12 },
    fieldChipFocused: {
        shadowColor: serviceBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 2,
    },
    input: { flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: 0, padding: 0 },
    textArea: { minHeight: 72, textAlignVertical: 'top', paddingTop: 0 },
    fieldTrailing: { fontSize: 11, fontWeight: '700', marginLeft: 8 },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingHorizontal: 2 },
    errorText: { fontSize: 12, color: serviceRed, fontWeight: '600', flex: 1 },

    // Actions
    actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
    saveBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 52,
        borderRadius: 14,
    },
    saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 52,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1.5,
    },
    deleteBtnText: { fontSize: 14, fontWeight: '800' },
    btnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
