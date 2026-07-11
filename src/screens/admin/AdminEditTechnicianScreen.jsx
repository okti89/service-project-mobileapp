import React, { useCallback, useEffect, useState } from 'react';
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

const STATUS_OPTIONS = [
    { key: 'available', label: 'Müsait', icon: 'check-circle-outline', color: '#16A34A' },
    { key: 'offduty', label: 'Mesai Dışı', icon: 'clock-alert-outline', color: '#FF8C00' },
];

const MONTHS_TR = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const normalizePhone = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    let local = digits;
    if (local.startsWith('90') && local.length >= 12) local = local.slice(2);
    if (local.startsWith('0') && local.length === 11) local = local.slice(1);
    if (local.length > 10) local = local.slice(-10);
    if (local.length !== 10) return raw;
    return `0${local}`;
};

const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
};

export default function AdminEditTechnicianScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();

    const tech = route?.params?.technician || null;
    const techId = route?.params?.technicianId || tech?.id || null;

    const [firstName, setFirstName] = useState(tech?.user?.first_name || '');
    const [lastName, setLastName] = useState(tech?.user?.last_name || '');
    const [email, setEmail] = useState(tech?.user?.email || '');
    const [phone, setPhone] = useState(tech?.user?.phone_number || '');
    
    // Custom Date Picker State
    const [formDay, setFormDay] = useState(1);
    const [formMonth, setFormMonth] = useState(0);
    const [formYear, setFormYear] = useState(new Date().getFullYear());
    const [pickerOpen, setPickerOpen] = useState(false);

    const [status, setStatus] = useState(tech?.status || 'available');

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(!tech && !!techId);
    const [submitting, setSubmitting] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

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

    const parseAndSetDate = (dateStr) => {
        if (!dateStr) return;
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                setFormYear(y);
                setFormMonth(m);
                setFormDay(d);
            }
        }
    };

    useEffect(() => {
        if (tech) {
            parseAndSetDate(tech.hire_date);
        }
    }, [tech]);

    useEffect(() => {
        if (!tech && techId) {
            setLoading(true);
            api.get(ENDPOINTS.TECHNICIAN.DETAIL(techId))
                .then(res => {
                    const t = res.data;
                    setFirstName(t?.user?.first_name || '');
                    setLastName(t?.user?.last_name || '');
                    setEmail(t?.user?.email || '');
                    setPhone(t?.user?.phone_number || '');
                    setStatus(t?.status || 'available');
                    parseAndSetDate(t?.hire_date);
                })
                .catch(() => {
                    showToast('error', 'Hata', 'Teknisyen detayları yüklenemedi.');
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [tech, techId, showToast]);

    const validate = () => {
        const e = {};
        if (!firstName.trim()) e.firstName = 'Ad zorunlu';
        if (!lastName.trim()) e.lastName = 'Soyad zorunlu';
        if (!email.trim()) e.email = 'E-posta zorunlu';
        if (!phone.trim()) e.phone = 'Telefon zorunlu';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate() || submitting || !techId) return;
        setSubmitting(true);
        
        // YYYY-MM-DD formatında tarihi birleştir
        const formattedMonth = String(formMonth + 1).padStart(2, '0');
        const formattedDay = String(formDay).padStart(2, '0');
        const hireDateStr = `${formYear}-${formattedMonth}-${formattedDay}`;

        try {
            const payload = {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                email: email.trim().toLowerCase(),
                phone_number: normalizePhone(phone),
                hire_date: hireDateStr,
                status: status,
            };
            const res = await api.patch(ENDPOINTS.TECHNICIAN.DETAIL(techId), payload);
            const onSuccess = route?.params?.onSuccess;
            if (onSuccess) onSuccess(res.data);
            showToast('success', 'Güncellendi', 'Teknisyen bilgileri başarıyla güncellendi.');
            if (navigation?.canGoBack?.()) navigation.goBack();
        } catch (err) {
            const msg = err?.response?.data?.detail || err?.message || 'Bilinmeyen bir hata oluştu';
            showToast('error', 'Güncellenemedi', msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <WrapperContainer edges={NO_BOTTOM_EDGES}>
                <Header title="Teknisyen Düzenle" showBack centered borderBottom />
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </WrapperContainer>
        );
    }

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES} style={{ flex: 1 }}>
            <Header
                title="Teknisyen Düzenle"
                subtitle="Teknisyen kartı bilgilerini güncelle"
                showBack
                centered
                borderBottom
            />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.scroll,
                        { paddingBottom: 40 },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* DURUM SEÇİMİ */}
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Durum</Text>
                    <View style={styles.chipRow}>
                        {STATUS_OPTIONS.map(opt => {
                            const active = status === opt.key;
                            return (
                                <Pressable
                                    key={opt.key}
                                    onPress={() => setStatus(opt.key)}
                                    style={({ pressed }) => [
                                        styles.chip,
                                        {
                                            backgroundColor: active ? opt.color + '15' : cardBg,
                                            borderColor: active ? opt.color : borderClr,
                                            opacity: pressed ? 0.85 : 1,
                                        },
                                    ]}
                                >
                                    <MaterialCommunityIcons
                                        name={opt.icon}
                                        size={20}
                                        color={active ? opt.color : colors.textSecondary}
                                    />
                                    <Text style={[styles.chipText, { color: active ? opt.color : colors.text }]}>
                                        {opt.label}
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
                            placeholder="Ad"
                        />
                        <CustomInput
                            label="Soyad"
                            icon="account-outline"
                            value={lastName}
                            onChangeText={setLastName}
                            error={errors.lastName}
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

                        {/* TARİH SEÇİCİ TETİKLEYİCİ */}
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>İşe Başlama Tarihi</Text>
                        <Pressable
                            onPress={() => {
                                Keyboard.dismiss();
                                setPickerOpen(!pickerOpen);
                            }}
                            style={[styles.formInputBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: borderClr }]}
                        >
                            <MaterialCommunityIcons name="calendar" size={18} color={colors.primary} style={{ marginRight: 8 }} />
                            <Text style={[styles.formInputText, { color: colors.text }]}>
                                {`${formDay} ${MONTHS_TR[formMonth]} ${formYear}`}
                            </Text>
                            <MaterialCommunityIcons name={pickerOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
                        </Pressable>

                        {/* CUSTOM DATE SPINNER WHEELS */}
                        {pickerOpen && (
                            <View style={[styles.spinnerContainer, { borderColor: borderClr, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }]}>
                                <View style={styles.spinnerColumn}>
                                    <Pressable onPress={() => {
                                        const max = getDaysInMonth(formMonth, formYear);
                                        setFormDay(prev => prev >= max ? 1 : prev + 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-up" size={24} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerValue, { color: colors.text }]}>
                                        {String(formDay).padStart(2, '0')}
                                    </Text>
                                    <Pressable onPress={() => {
                                        const max = getDaysInMonth(formMonth, formYear);
                                        setFormDay(prev => prev <= 1 ? max : prev - 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-down" size={24} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerLabel, { color: colors.textSecondary }]}>Gün</Text>
                                </View>

                                <View style={{ width: 1, height: '50%', backgroundColor: borderClr }} />

                                <View style={[styles.spinnerColumn, { flex: 1.6 }]}>
                                    <Pressable onPress={() => {
                                        setFormMonth(prev => prev >= 11 ? 0 : prev + 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-up" size={24} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerValue, { color: colors.text }]} numberOfLines={1}>
                                        {MONTHS_TR[formMonth]}
                                    </Text>
                                    <Pressable onPress={() => {
                                        setFormMonth(prev => prev <= 0 ? 11 : prev - 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-down" size={24} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerLabel, { color: colors.textSecondary }]}>Ay</Text>
                                </View>

                                <View style={{ width: 1, height: '50%', backgroundColor: borderClr }} />

                                <View style={styles.spinnerColumn}>
                                    <Pressable onPress={() => {
                                        setFormYear(prev => prev + 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-up" size={24} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerValue, { color: colors.text }]}>
                                        {formYear}
                                    </Text>
                                    <Pressable onPress={() => {
                                        setFormYear(prev => prev - 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-down" size={24} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerLabel, { color: colors.textSecondary }]}>Yıl</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* DÜZENLE BUTONU (Dışarıda, ScrollView içinde formun hemen altında) */}
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
                                <Text style={styles.submitBtnText}>Teknisyeni Güncelle</Text>
                            </>
                        )}
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: 16, gap: 14 },
    sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    chipRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
    chip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5 },
    chipText: { fontSize: 14, fontWeight: '700' },
    formCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 4 },
    fieldLabel: { fontSize: 14, fontWeight: '500', marginBottom: 6, marginTop: 10 },
    formInputBtn: { height: 52, borderRadius: 10, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
    formInputText: { fontSize: 14, fontWeight: '700' },
    spinnerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 12, height: 140, marginTop: 12, paddingHorizontal: 16, gap: 12 },
    spinnerColumn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    spinnerArrow: { padding: 4 },
    spinnerValue: { fontSize: 16, fontWeight: '900', marginVertical: 2, textAlign: 'center' },
    spinnerLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', marginTop: 1 },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14, marginTop: 14 },
    submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
