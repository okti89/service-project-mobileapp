import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import api from '@/api/axios';
import Header from '@/components/Header';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import AppBottomSheet from '@/components/AppBottomSheet';
import CalendarPickerSheet from '@/components/home/CalendarPickerSheet';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';

const DAY_LABELS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

// Telefon Numarası Formatlama Maskesi: (5xx) xxx xx xx
const formatPhoneNumber = (value) => {
    if (!value) return '';
    const cleaned = value.replace(/\D/g, ''); // Sadece rakamları al
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/);
    if (!match) return cleaned;

    let formatted = '';
    if (match[1]) {
        formatted += `(${match[1]}`;
        if (match[1].length === 3) formatted += ') ';
    }
    if (match[2]) {
        formatted += match[2];
        if (match[2].length === 3) formatted += ' ';
    }
    if (match[3]) {
        formatted += match[3];
        if (match[3].length === 2) formatted += ' ';
    }
    if (match[4]) {
        formatted += match[4];
    }
    return formatted.trim();
};

export default function AdminCompanySettingsScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { userInfo } = useAuth();
    const { showToast } = useToast();

    // Sekmeler: 'profile', 'hours', 'holidays'
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(true);

    // ─── 1. FİRMA PROFİLİ STATE'LERİ ──────────────────────────────────────────
    const [companyId, setCompanyId] = useState(null);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [maxUsers, setMaxUsers] = useState('');
    const [activeUsersCount, setActiveUsersCount] = useState(0);
    const [tenantCode, setTenantCode] = useState('');
    const [logoUri, setLogoUri] = useState(null);
    const [selectedLogoFile, setSelectedLogoFile] = useState(null);
    const [savingProfile, setSavingProfile] = useState(false);

    // Input Refs for Easy Focus
    const nameInputRef = useRef(null);
    const phoneInputRef = useRef(null);
    const emailInputRef = useRef(null);
    const addressInputRef = useRef(null);

    // ─── 2. ÇALIŞMA SAATLERİ STATE'LERİ ──────────────────────────────────────
    const [workingHours, setWorkingHours] = useState([]);
    const [savingHours, setSavingHours] = useState(false);

    // ─── 3. RESMİ TATİL / İSTİSNA STATE'LERİ ─────────────────────────────────
    const [holidays, setHolidays] = useState([]);
    const [holidaySheetVisible, setHolidaySheetVisible] = useState(false);
    const [holidaySheetType, setHolidaySheetType] = useState('create'); // 'create' veya 'edit'
    const [selectedHolidayId, setSelectedHolidayId] = useState(null);
    const [holidayTitle, setHolidayTitle] = useState('');
    const [holidayStartDate, setHolidayStartDate] = useState(new Date());
    const [holidayEndDate, setHolidayEndDate] = useState(new Date());
    const [holidayIsHalfDay, setHolidayIsHalfDay] = useState(false);
    const [holidayNote, setHolidayNote] = useState('');
    const [savingHoliday, setSavingHoliday] = useState(false);

    // Dynamic Original Calendar Picker Refs
    const calendarPickerRef = useRef(null);
    const [calendarTarget, setCalendarTarget] = useState('start'); // 'start' veya 'end'
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    // Keyboard Listeners for Dynamic Scroll Padding
    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => setKeyboardHeight(e.endCoordinates.height)
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardHeight(0)
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // ─── VERİLERİ API'DEN ÇEKME ──────────────────────────────────────────────
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            const configRes = await api.get('/config/company-configs/');
            const cfg = Array.isArray(configRes.data) ? configRes.data[0] : null;

            if (cfg) {
                setCompanyId(cfg.id);
                setName(cfg.name || '');
                setPhone(formatPhoneNumber(cfg.phone_number || ''));
                setEmail(cfg.email || '');
                setAddress(cfg.address || '');
                setMaxUsers(String(cfg.max_users ?? 0));
                setActiveUsersCount(Number(cfg.active_users_count || 0));
                setTenantCode(String(cfg.tenant_code || cfg.tenant?.code || userInfo?.tenant_code || '').trim());
                setLogoUri(cfg.logo || null);

                const [hoursRes, holidaysRes] = await Promise.all([
                    api.get(`/config/working-hours/?company=${cfg.id}`),
                    api.get(`/config/holiday-exceptions/?company=${cfg.id}`)
                ]);

                setWorkingHours(Array.isArray(hoursRes.data) ? hoursRes.data : []);
                setHolidays(Array.isArray(holidaysRes.data) ? holidaysRes.data : []);
            }
        } catch (err) {
            console.log('Fetch company config error:', err?.message);
            showToast('error', 'Hata', 'Firma konfigürasyon verileri yüklenemedi.');
        } finally {
            setLoading(false);
        }
    }, [showToast, userInfo?.tenant_code]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // ─── FİRMA PROFİLİNİ KAYDETME ─────────────────────────────────────────────
    const handleSaveProfile = async () => {
        if (!companyId) return;
        Keyboard.dismiss();
        setSavingProfile(true);
        try {
            const rawPhone = phone.replace(/\D/g, ''); // Temizlenmiş ham rakamlar

            const formData = new FormData();
            formData.append('name', name);
            formData.append('phone_number', rawPhone);
            formData.append('email', email);
            formData.append('address', address);

            if (selectedLogoFile) {
                formData.append('logo', {
                    uri: Platform.OS === 'android' ? selectedLogoFile.uri : selectedLogoFile.uri.replace('file://', ''),
                    type: selectedLogoFile.mimeType || 'image/jpeg',
                    name: selectedLogoFile.fileName || 'logo.jpg',
                });
            }

            await api.patch(`/config/company-configs/${companyId}/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            showToast('success', 'Başarılı', 'Firma bilgileri güncellendi.');
            setSelectedLogoFile(null);
            fetchAllData();
        } catch (err) {
            console.log('Save profile error:', err);
            showToast('error', 'Hata', 'Firma bilgileri kaydedilemedi.');
        } finally {
            setSavingProfile(false);
        }
    };

    // Resim Seçici (Logo Değiştirme)
    const handlePickLogo = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            showToast('error', 'Yetki Hatası', 'Galeri erişim yetkisi verilmedi.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            setLogoUri(asset.uri);
            setSelectedLogoFile(asset);
        }
    };

    // ─── ÇALIŞMA SAATLERİNİ KAYDETME ──────────────────────────────────────────
    const handleSaveWorkingHours = async () => {
        setSavingHours(true);
        try {
            for (const hour of workingHours) {
                if (hour.id) {
                    await api.patch(`/config/working-hours/${hour.id}/`, {
                        start_time: hour.start_time,
                        end_time: hour.end_time,
                        is_holiday: hour.is_holiday
                    });
                } else {
                    await api.post('/config/working-hours/', {
                        company: companyId,
                        day_of_week: hour.day_of_week,
                        start_time: hour.start_time,
                        end_time: hour.end_time,
                        is_holiday: hour.is_holiday
                    });
                }
            }
            showToast('success', 'Başarılı', 'Çalışma saatleri güncellendi.');
            fetchAllData();
        } catch (err) {
            console.log('Save working hours error:', err);
            showToast('error', 'Hata', 'Çalışma saatleri kaydedilemedi.');
        } finally {
            setSavingHours(false);
        }
    };

    const handleLocalHourChange = (idx, field, val) => {
        setWorkingHours(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
    };

    // ─── RESMİ TATİL CRUD İŞLEMLERİ ──────────────────────────────────────────
    const handleOpenHolidaySheet = (type, item = null) => {
        setHolidaySheetType(type);
        if (type === 'edit' && item) {
            setSelectedHolidayId(item.id);
            setHolidayTitle(item.title || '');
            setHolidayStartDate(item.start_date ? new Date(item.start_date) : new Date());
            setHolidayEndDate(item.end_date ? new Date(item.end_date) : new Date());
            setHolidayIsHalfDay(item.is_half_day || false);
            setHolidayNote(item.note || '');
        } else {
            setSelectedHolidayId(null);
            setHolidayTitle('');
            setHolidayStartDate(new Date());
            setHolidayEndDate(new Date());
            setHolidayIsHalfDay(false);
            setHolidayNote('');
        }
        setHolidaySheetVisible(true);
    };

    const handleSaveHoliday = async () => {
        if (!holidayTitle.trim()) {
            showToast('error', 'Uyarı', 'Lütfen tatil başlığı girin.');
            return;
        }
        setSavingHoliday(true);
        const payload = {
            company: companyId,
            title: holidayTitle,
            start_date: dayjs(holidayStartDate).format('YYYY-MM-DD'),
            end_date: dayjs(holidayEndDate).format('YYYY-MM-DD'),
            is_half_day: holidayIsHalfDay,
            note: holidayNote
        };

        try {
            if (holidaySheetType === 'edit' && selectedHolidayId) {
                await api.patch(`/config/holiday-exceptions/${selectedHolidayId}/`, payload);
                showToast('success', 'Başarılı', 'İzin istisnası güncellendi.');
            } else {
                await api.post('/config/holiday-exceptions/', payload);
                showToast('success', 'Başarılı', 'Resmi tatil oluşturuldu.');
            }
            setHolidaySheetVisible(false);
            fetchAllData();
        } catch (err) {
            console.log('Save holiday error:', err);
            showToast('error', 'Hata', 'Tatil günü kaydedilemedi.');
        } finally {
            setSavingHoliday(false);
        }
    };

    const handleDeleteHoliday = (id) => {
        Alert.alert(
            'Tatili Sil',
            'Bu resmi tatil istisnasını silmek istediğinize emin misiniz?',
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(`/config/holiday-exceptions/${id}/`);
                            showToast('success', 'Başarılı', 'Tatil silindi.');
                            fetchAllData();
                        } catch (err) {
                            showToast('error', 'Hata', 'Tatil silinemedi.');
                        }
                    }
                }
            ]
        );
    };

    const border = colors.border;
    const cardBg = colors.surface;

    // Custom takvim seçim olayı
    const handleSelectDate = (date) => {
        if (calendarTarget === 'start') {
            setHolidayStartDate(date);
        } else {
            setHolidayEndDate(date);
        }
    };

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES} style={{ backgroundColor: colors.background }}>
            <Header title="Firma Ayarları" showBack borderBottom />

            {/* Sekme Seçiciler */}
            <View style={[styles.tabContainer, { borderColor: border, backgroundColor: cardBg }]}>
                <Pressable
                    onPress={() => setActiveTab('profile')}
                    style={[styles.tabBtn, activeTab === 'profile' && [styles.tabActiveBtn, { backgroundColor: serviceBlue }]]}
                >
                    <Text style={[styles.tabBtnText, { color: activeTab === 'profile' ? '#FFF' : colors.textSecondary }]}>
                        Profil
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => setActiveTab('hours')}
                    style={[styles.tabBtn, activeTab === 'hours' && [styles.tabActiveBtn, { backgroundColor: serviceBlue }]]}
                >
                    <Text style={[styles.tabBtnText, { color: activeTab === 'hours' ? '#FFF' : colors.textSecondary }]}>
                        Saatler
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => setActiveTab('holidays')}
                    style={[styles.tabBtn, activeTab === 'holidays' && [styles.tabActiveBtn, { backgroundColor: serviceBlue }]]}
                >
                    <Text style={[styles.tabBtnText, { color: activeTab === 'holidays' ? '#FFF' : colors.textSecondary }]}>
                        Tatiller
                    </Text>
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={serviceBlue} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Veriler yükleniyor...</Text>
                </View>
            ) : (
                <>
                    {activeTab !== 'holidays' ? (
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                            style={{ flex: 1 }}
                            keyboardVerticalOffset={0}
                        >
                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={[styles.scrollContent, { paddingBottom: keyboardHeight + insets.bottom + 30 }]}
                                keyboardShouldPersistTaps="handled"
                            >
                                {/* ── 1. PROFİL SEKMESİ ── */}
                                {activeTab === 'profile' && (
                                    <View style={styles.formContainer}>
                                        {/* Logo Alanı */}
                                        <Pressable
                                            onPress={handlePickLogo}
                                            style={[styles.logoSection, { backgroundColor: cardBg, borderColor: border }]}
                                        >
                                            <View style={[styles.logoContainer, { borderColor: border }]}>
                                                {logoUri ? (
                                                    <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                                                        <Image
                                                            source={{ uri: resolveMediaUrl(logoUri) }}
                                                            style={{ width: '100%', height: '100%' }}
                                                            resizeMode="cover"
                                                        />
                                                        <View style={[styles.logoOverlayEdit, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
                                                            <MaterialCommunityIcons name="camera-outline" size={18} color="#FFF" />
                                                        </View>
                                                    </View>
                                                ) : (
                                                    <View style={[styles.logoWrapper, { backgroundColor: colors.background }]}>
                                                        <MaterialCommunityIcons name="image-plus" size={32} color={colors.textTertiary} />
                                                        <Text style={[styles.logoBtnText, { color: colors.textSecondary }]}>Logo Ekle</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </Pressable>

                                        {/* Firma Adı */}
                                        <Pressable
                                            onPress={() => nameInputRef.current?.focus()}
                                            style={[styles.inputGroup, { backgroundColor: cardBg, borderColor: border }]}
                                        >
                                            <View style={styles.inputHeader}>
                                                <MaterialCommunityIcons name="office-building" size={16} color={serviceBlue} />
                                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Firma Adı</Text>
                                            </View>
                                            <TextInput
                                                ref={nameInputRef}
                                                value={name}
                                                onChangeText={setName}
                                                style={[styles.textInput, { color: colors.text }]}
                                                placeholder="Firma adını girin"
                                                placeholderTextColor={colors.textTertiary}
                                            />
                                        </Pressable>

                                        {/* Telefon */}
                                        <Pressable
                                            onPress={() => phoneInputRef.current?.focus()}
                                            style={[styles.inputGroup, { backgroundColor: cardBg, borderColor: border }]}
                                        >
                                            <View style={styles.inputHeader}>
                                                <MaterialCommunityIcons name="phone" size={16} color={serviceGreen} />
                                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Telefon Numarası</Text>
                                            </View>
                                            <TextInput
                                                ref={phoneInputRef}
                                                value={phone}
                                                onChangeText={(val) => setPhone(formatPhoneNumber(val))}
                                                keyboardType="phone-pad"
                                                maxLength={15}
                                                style={[styles.textInput, { color: colors.text }]}
                                                placeholder="(5xx) xxx xx xx"
                                                placeholderTextColor={colors.textTertiary}
                                            />
                                        </Pressable>

                                        {/* E-posta */}
                                        <Pressable
                                            onPress={() => emailInputRef.current?.focus()}
                                            style={[styles.inputGroup, { backgroundColor: cardBg, borderColor: border }]}
                                        >
                                            <View style={styles.inputHeader}>
                                                <MaterialCommunityIcons name="email" size={16} color={serviceOrange} />
                                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>E-Posta Adresi</Text>
                                            </View>
                                            <TextInput
                                                ref={emailInputRef}
                                                value={email}
                                                onChangeText={setEmail}
                                                keyboardType="email-address"
                                                autoCapitalize="none"
                                                style={[styles.textInput, { color: colors.text }]}
                                                placeholder="Örn: info@firma.com"
                                                placeholderTextColor={colors.textTertiary}
                                            />
                                        </Pressable>

                                        {/* Adres */}
                                        <Pressable
                                            onPress={() => addressInputRef.current?.focus()}
                                            style={[styles.inputGroup, { backgroundColor: cardBg, borderColor: border }]}
                                        >
                                            <View style={styles.inputHeader}>
                                                <MaterialCommunityIcons name="map-marker" size={16} color={serviceRed} />
                                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Adres Bilgisi</Text>
                                            </View>
                                            <TextInput
                                                ref={addressInputRef}
                                                value={address}
                                                onChangeText={setAddress}
                                                multiline
                                                numberOfLines={3}
                                                style={[styles.textInput, { color: colors.text, height: 75, textAlignVertical: 'top' }]}
                                                placeholder="Firma genel merkez adresi"
                                                placeholderTextColor={colors.textTertiary}
                                            />
                                        </Pressable>

                                        {/* Kullanıcı limiti ve firma kodu salt okunurdur. */}
                                        <View style={{ flexDirection: 'row', gap: 10 }}>
                                            <View style={[styles.inputGroup, { backgroundColor: colors.background, borderColor: border, flex: 1, opacity: 0.8 }]}>
                                                <View style={styles.inputHeader}>
                                                    <MaterialCommunityIcons name="account-group" size={16} color="#0EA5E9" />
                                                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Kullanıcı Limiti</Text>
                                                </View>
                                                <Text style={[styles.textInputVal, { color: colors.textSecondary }]}>
                                                    {Number(maxUsers) > 0 ? `${activeUsersCount} / ${maxUsers} kullanıcı` : `${activeUsersCount} kullanıcı (sınırsız)`}
                                                </Text>
                                            </View>

                                            {tenantCode ? <View style={[styles.inputGroup, { backgroundColor: colors.background, borderColor: border, flex: 1, opacity: 0.8 }]}>
                                                <View style={styles.inputHeader}>
                                                    <MaterialCommunityIcons name="key" size={16} color="#64748B" />
                                                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Firma Kodu</Text>
                                                </View>
                                                <Text style={[styles.textInputVal, { color: colors.textSecondary }]}>{tenantCode}</Text>
                                            </View> : null}
                                        </View>

                                        {/* Kaydet Butonu */}
                                        <Pressable
                                            onPress={handleSaveProfile}
                                            disabled={savingProfile}
                                            style={({ pressed }) => [
                                                styles.saveBtn,
                                                { backgroundColor: serviceBlue },
                                                (savingProfile || pressed) && { opacity: 0.8 }
                                            ]}
                                        >
                                            {savingProfile ? (
                                                <ActivityIndicator size="small" color="#FFF" />
                                            ) : (
                                                <>
                                                    <MaterialCommunityIcons name="content-save-outline" size={18} color="#FFF" />
                                                    <Text style={styles.saveBtnText}>Profili Kaydet</Text>
                                                </>
                                            )}
                                        </Pressable>
                                    </View>
                                )}

                                {/* ── 2. ÇALIŞMA SAATLERİ SEKMESİ ── */}
                                {activeTab === 'hours' && (
                                    <View style={styles.formContainer}>
                                        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                                            Teknisyenlerin randevu alabileceği ve servis planlanabilecek günlük çalışma saatlerini düzenleyin.
                                        </Text>

                                        {workingHours.map((hour, idx) => (
                                            <View key={hour.id || idx} style={[styles.hourCard, { backgroundColor: cardBg, borderColor: border }]}>
                                                <View style={styles.hourCardHeader}>
                                                    <Text style={[styles.dayLabel, { color: colors.text }]}>{DAY_LABELS[hour.day_of_week] || 'Gün'}</Text>
                                                    
                                                    <Pressable
                                                        onPress={() => handleLocalHourChange(idx, 'is_holiday', !hour.is_holiday)}
                                                        style={[
                                                            styles.holidayBtn,
                                                            { backgroundColor: hour.is_holiday ? `${serviceRed}15` : `${serviceBlue}10`, borderColor: hour.is_holiday ? serviceRed : serviceBlue }
                                                        ]}
                                                    >
                                                        <Text style={{ fontSize: 10, fontWeight: '800', color: hour.is_holiday ? serviceRed : serviceBlue }}>
                                                            {hour.is_holiday ? 'RESMİ TATİL' : 'ÇALIŞMA GÜNÜ'}
                                                        </Text>
                                                    </Pressable>
                                                </View>

                                                {!hour.is_holiday && (
                                                    <View style={styles.timeInputsRow}>
                                                        {/* Başlangıç Saati */}
                                                        <View style={[styles.timeInputBox, { borderColor: border }]}>
                                                            <Text style={[styles.timeInputLabel, { color: colors.textSecondary }]}>Giriş</Text>
                                                            <TextInput
                                                                value={hour.start_time?.slice(0, 5)}
                                                                onChangeText={(val) => handleLocalHourChange(idx, 'start_time', val)}
                                                                placeholder="08:30"
                                                                placeholderTextColor={colors.textTertiary}
                                                                maxLength={5}
                                                                style={[styles.timeTextVal, { color: colors.text }]}
                                                            />
                                                        </View>

                                                        <MaterialCommunityIcons name="arrow-right-thin" size={20} color={colors.textTertiary} style={{ marginTop: 20 }} />

                                                        {/* Bitiş Saati */}
                                                        <View style={[styles.timeInputBox, { borderColor: border }]}>
                                                            <Text style={[styles.timeInputLabel, { color: colors.textSecondary }]}>Çıkış</Text>
                                                            <TextInput
                                                                value={hour.end_time?.slice(0, 5)}
                                                                onChangeText={(val) => handleLocalHourChange(idx, 'end_time', val)}
                                                                placeholder="18:00"
                                                                placeholderTextColor={colors.textTertiary}
                                                                maxLength={5}
                                                                style={[styles.timeTextVal, { color: colors.text }]}
                                                            />
                                                        </View>
                                                    </View>
                                                )}
                                            </View>
                                        ))}

                                        {/* Kaydet Butonu */}
                                        <Pressable
                                            onPress={handleSaveWorkingHours}
                                            disabled={savingHours}
                                            style={({ pressed }) => [
                                                styles.saveBtn,
                                                { backgroundColor: serviceBlue, marginTop: 16 },
                                                (savingHours || pressed) && { opacity: 0.8 }
                                            ]}
                                        >
                                            {savingHours ? (
                                                <ActivityIndicator size="small" color="#FFF" />
                                            ) : (
                                                <>
                                                    <MaterialCommunityIcons name="clock-check-outline" size={18} color="#FFF" />
                                                    <Text style={styles.saveBtnText}>Çalışma Saatlerini Kaydet</Text>
                                                </>
                                            )}
                                        </Pressable>
                                    </View>
                                )}
                            </ScrollView>
                        </KeyboardAvoidingView>
                    ) : (
                        /* ── 3. TATİLLER SEKMESİ (KeyboardAvoidingView Olmadan Yalın ScrollView) ── */
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={[styles.scrollContent, { paddingBottom: keyboardHeight + insets.bottom + 30 }]}
                            keyboardShouldPersistTaps="handled"
                        >
                            <View style={styles.formContainer}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, flex: 1, marginBottom: 0 }]}>
                                        Belirli resmi tatilleri veya şirket izin günlerini ekleyin. Bu günlerde randevu verilmez.
                                    </Text>
                                    <Pressable
                                        onPress={() => handleOpenHolidaySheet('create')}
                                        style={({ pressed }) => [
                                            styles.addHolidayBtn,
                                            { backgroundColor: `${serviceBlue}10`, borderColor: serviceBlue },
                                            pressed && { opacity: 0.8 }
                                        ]}
                                    >
                                        <MaterialCommunityIcons name="plus" size={16} color={serviceBlue} />
                                        <Text style={[styles.addHolidayText, { color: serviceBlue }]}>Tatil Ekle</Text>
                                    </Pressable>
                                </View>

                                {holidays.length === 0 ? (
                                    <View style={styles.emptyContainer}>
                                        <MaterialCommunityIcons name="calendar-blank-outline" size={40} color={colors.textTertiary} />
                                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Kayıtlı tatil günü bulunmamaktadır.</Text>
                                    </View>
                                ) : (
                                    holidays.map((hld) => (
                                        <View key={hld.id} style={[styles.holidayCard, { backgroundColor: cardBg, borderColor: border }]}>
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={[styles.holidayTitle, { color: colors.text }]}>{hld.title}</Text>
                                                    {hld.is_half_day && (
                                                        <View style={[styles.halfDayBadge, { backgroundColor: `${serviceOrange}15`, borderColor: serviceOrange }]}>
                                                            <Text style={{ fontSize: 9, fontWeight: '800', color: serviceOrange }}>Yarım Gün</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={[styles.holidayDates, { color: colors.textSecondary }]}>
                                                    {dayjs(hld.start_date).format('DD MMM YYYY')}
                                                    {hld.start_date !== hld.end_date && ` - ${dayjs(hld.end_date).format('DD MMM YYYY')}`}
                                                </Text>
                                                {hld.note ? (
                                                    <Text style={[styles.holidayNote, { color: colors.textTertiary }]} numberOfLines={2}>{hld.note}</Text>
                                                ) : null}
                                            </View>

                                            <View style={styles.holidayActions}>
                                                <Pressable
                                                    onPress={() => handleOpenHolidaySheet('edit', hld)}
                                                    style={styles.actionBtn}
                                                >
                                                    <MaterialCommunityIcons name="pencil-outline" size={18} color={serviceBlue} />
                                                </Pressable>
                                                <Pressable
                                                    onPress={() => handleDeleteHoliday(hld.id)}
                                                    style={styles.actionBtn}
                                                >
                                                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={serviceRed} />
                                                </Pressable>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>
                        </ScrollView>
                    )}
                </>
            )}

            {/* ── 4. RESMİ TATİL EKLE / DÜZENLE PANELİ (Orijinal AppBottomSheet Entegrasyonu) ── */}
            <AppBottomSheet
                visible={holidaySheetVisible}
                onClose={() => setHolidaySheetVisible(false)}
                snapPoints={['82%']}
            >
                <View style={styles.sheetContent}>
                    <View style={styles.sheetHeader}>
                        <Text style={[styles.sheetTitle, { color: colors.text }]}>
                            {holidaySheetType === 'create' ? 'Resmi Tatil / İzin Ekle' : 'Tatil Gününü Düzenle'}
                        </Text>
                        <Pressable onPress={() => setHolidaySheetVisible(false)}>
                            <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                        </Pressable>
                    </View>

                    <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        {/* Başlık */}
                        <Pressable style={[styles.inputGroup, { backgroundColor: colors.background, borderColor: border }]}>
                            <View style={styles.inputHeader}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Tatil Başlığı</Text>
                            </View>
                            <TextInput
                                value={holidayTitle}
                                onChangeText={setHolidayTitle}
                                style={[styles.textInput, { color: colors.text }]}
                                placeholder="Örn: 29 Ekim Cumhuriyet Bayramı"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </Pressable>

                        {/* Yarım Gün Mü? */}
                        <Pressable
                            onPress={() => setHolidayIsHalfDay(!holidayIsHalfDay)}
                            style={[
                                styles.halfDaySwitchRow,
                                { backgroundColor: colors.background, borderColor: border }
                            ]}
                        >
                            <Text style={[styles.inputLabel, { color: colors.text }]}>Yarım Gün Tatil</Text>
                            <MaterialCommunityIcons
                                name={holidayIsHalfDay ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                size={22}
                                color={holidayIsHalfDay ? serviceBlue : colors.textTertiary}
                            />
                        </Pressable>

                        {/* Tarihler */}
                        <View style={{ flexDirection: 'row', gap: 10, marginVertical: 8 }}>
                            {/* Başlangıç Tarihi */}
                            <Pressable
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setCalendarTarget('start');
                                    calendarPickerRef.current?.present();
                                }}
                                style={[styles.dateSelectorBox, { backgroundColor: colors.background, borderColor: border }]}
                            >
                                <Text style={[styles.timeInputLabel, { color: colors.textSecondary }]}>Başlangıç</Text>
                                <Text style={[styles.dateValText, { color: colors.text }]}>{dayjs(holidayStartDate).format('DD.MM.YYYY')}</Text>
                            </Pressable>

                            {/* Bitiş Tarihi */}
                            <Pressable
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setCalendarTarget('end');
                                    calendarPickerRef.current?.present();
                                }}
                                style={[styles.dateSelectorBox, { backgroundColor: colors.background, borderColor: border }]}
                            >
                                <Text style={[styles.timeInputLabel, { color: colors.textSecondary }]}>Bitiş</Text>
                                <Text style={[styles.dateValText, { color: colors.text }]}>{dayjs(holidayEndDate).format('DD.MM.YYYY')}</Text>
                            </Pressable>
                        </View>

                        {/* Açıklama / Not */}
                        <Pressable style={[styles.inputGroup, { backgroundColor: colors.background, borderColor: border, marginTop: 8 }]}>
                            <View style={styles.inputHeader}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Notlar / Açıklama</Text>
                            </View>
                            <TextInput
                                value={holidayNote}
                                onChangeText={setHolidayNote}
                                multiline
                                numberOfLines={3}
                                style={[styles.textInput, { color: colors.text, height: 60, textAlignVertical: 'top' }]}
                                placeholder="İzin nedeni, açıklama ekleyin"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </Pressable>

                        {/* Kaydet / Uygula Butonu */}
                        <Pressable
                            onPress={handleSaveHoliday}
                            disabled={savingHoliday}
                            style={({ pressed }) => [
                                styles.applyBtn,
                                { backgroundColor: serviceBlue },
                                (savingHoliday || pressed) && { opacity: 0.8 }
                            ]}
                        >
                            {savingHoliday ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text style={styles.applyBtnText}>Tatili Kaydet</Text>
                            )}
                        </Pressable>
                    </ScrollView>
                </View>
            </AppBottomSheet>

            {/* ── 5. ORIGINAL CALENDAR PICKER SHEET ENTEGRASYONU ── */}
            <CalendarPickerSheet
                ref={calendarPickerRef}
                selectedDate={calendarTarget === 'start' ? holidayStartDate : holidayEndDate}
                onSelectDate={handleSelectDate}
                showDots={false}
            />

        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
    loadingText: { fontSize: 13, fontWeight: '600' },
    scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

    // Sekmeler
    tabContainer: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 3,
        borderWidth: 1,
        marginHorizontal: 16,
        marginTop: 10,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 9,
    },
    tabActiveBtn: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1.5,
    },
    tabBtnText: { fontSize: 11, fontWeight: '800' },

    formContainer: { gap: 12, marginTop: 10 },
    sectionSubtitle: { fontSize: 12, fontWeight: '600', marginBottom: 8, lineHeight: 18 },

    // Logo Alanı
    logoSection: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        alignItems: 'center',
        marginBottom: 8,
    },
    logoContainer: {
        width: 110,
        height: 110,
        borderRadius: 55,
        borderWidth: 1,
        overflow: 'hidden',
    },
    logoWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    logoBtnText: { fontSize: 10, fontWeight: '800' },
    logoOverlayEdit: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Input Grupları (Büyütülmüş Dikey Padding)
    inputGroup: {
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 6,
    },
    inputHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    inputLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    textInput: { fontSize: 14, fontWeight: '700', padding: 0, margin: 0 },
    textInputVal: { fontSize: 14, fontWeight: '700', marginTop: 2 },

    saveBtn: {
        flexDirection: 'row',
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 8,
    },
    saveBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800' },

    // Saatler
    hourCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        gap: 12,
    },
    hourCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dayLabel: { fontSize: 14, fontWeight: '800' },
    holidayBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },

    timeInputsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timeInputBox: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, gap: 2 },
    timeInputLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
    timeTextVal: { fontSize: 13, fontWeight: '700', padding: 0 },

    // Tatiller
    addHolidayBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        gap: 4,
    },
    addHolidayText: { fontSize: 11, fontWeight: '800' },

    holidayCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
    },
    holidayTitle: { fontSize: 13, fontWeight: '800' },
    halfDayBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    holidayDates: { fontSize: 11, fontWeight: '600', marginTop: 2 },
    holidayNote: { fontSize: 11, fontWeight: '600', marginTop: 2, opacity: 0.8 },

    holidayActions: { flexDirection: 'row', gap: 10, marginLeft: 'auto', paddingLeft: 10 },
    actionBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

    sheetContent: {
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 16,
    },
    sheetTitle: { fontSize: 15, fontWeight: '800' },

    halfDaySwitchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginVertical: 4,
    },

    dateSelectorBox: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
    dateValText: { fontSize: 13, fontWeight: '700' },

    applyBtn: { width: '100%', height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    applyBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800' },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
    emptyText: { fontSize: 12, fontWeight: '600' },
});
