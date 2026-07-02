import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Header from '@/components/Header';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import AppBottomSheet from '@/components/AppBottomSheet';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceRed } from '@/theme/color';

const DEFAULT_PUBLIC_CONFIG = {
    name: 'Servis Yonetim Sistemi',
    panel_url: null,
    logo: null,
    phone_number: null,
    email: null,
    address: null,
    max_users: 0,
    active_users_count: 0,
    remaining_users: 0,
    working_hours: [],
    holiday_exceptions: [],
    tenant_code: null,
};

const normalizeConfig = (data) => ({
    ...DEFAULT_PUBLIC_CONFIG,
    ...(data || {}),
    working_hours: Array.isArray(data?.working_hours) ? data.working_hours : [],
    holiday_exceptions: Array.isArray(data?.holiday_exceptions) ? data.holiday_exceptions : [],
});

const InfoItem = ({ icon, label, value }) => {
    const { colors } = useTheme();
    return (
        <View style={[styles.infoItem, { borderBottomColor: colors.divider }]}>
            <MaterialCommunityIcons name={icon} size={20} color={serviceBlue} style={styles.infoIcon} />
            <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{value || '-'}</Text>
            </View>
        </View>
    );
};

const WorkingHourRow = ({ hour, onUpdate, editing }) => {
    const { colors } = useTheme();
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const parseTime = (timeStr, fallback) => {
        if (!timeStr) return fallback;
        const [h, m] = timeStr.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d;
    };

    const formatTime = (date) => {
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    };

    const startDate = parseTime(hour.start_time, new Date(2024, 0, 1, 8, 30));
    const endDate = parseTime(hour.end_time, new Date(2024, 0, 1, 18, 0));

    const handleStartChange = (event, date) => {
        setShowStartPicker(false);
        if (date) {
            onUpdate({ ...hour, start_time: formatTime(date) });
        }
    };

    const handleEndChange = (event, date) => {
        setShowEndPicker(false);
        if (date) {
            onUpdate({ ...hour, end_time: formatTime(date) });
        }
    };

    const toggleHoliday = () => {
        onUpdate({ ...hour, is_holiday: !hour.is_holiday });
    };

    return (
        <View style={[styles.whRow, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <View style={styles.whDayWrap}>
                <Text style={[styles.whDay, { color: colors.text }]}>{hour.day_label}</Text>
            </View>
            {editing ? (
                <View style={styles.whControls}>
                    <Pressable onPress={() => setShowStartPicker(true)} style={[styles.whTimeBtn, { borderColor: colors.border }]}>
                        <Text style={[styles.whTimeText, { color: hour.is_holiday ? colors.textTertiary : colors.text }]}>
                            {hour.start_time?.slice(0, 5) || '--:--'}
                        </Text>
                    </Pressable>
                    <Text style={[styles.whSep, { color: colors.textSecondary }]}>-</Text>
                    <Pressable onPress={() => setShowEndPicker(true)} style={[styles.whTimeBtn, { borderColor: colors.border }]}>
                        <Text style={[styles.whTimeText, { color: hour.is_holiday ? colors.textTertiary : colors.text }]}>
                            {hour.end_time?.slice(0, 5) || '--:--'}
                        </Text>
                    </Pressable>
                    <Pressable onPress={toggleHoliday} style={[styles.whHolidayBtn, { backgroundColor: hour.is_holiday ? serviceRed + '20' : colors.surface }]}>
                        <MaterialCommunityIcons name="close" size={14} color={hour.is_holiday ? serviceRed : colors.textTertiary} />
                    </Pressable>
                </View>
            ) : (
                <View style={styles.whDisplay}>
                    {hour.is_holiday ? (
                        <Text style={[styles.whHoliday, { color: serviceRed }]}>Tatil</Text>
                    ) : (
                        <Text style={[styles.whTime, { color: colors.text }]}>
                            {hour.start_time?.slice(0, 5)} - {hour.end_time?.slice(0, 5)}
                        </Text>
                    )}
                </View>
            )}
            {showStartPicker && (
                <DateTimePicker
                    value={startDate}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleStartChange}
                />
            )}
            {showEndPicker && (
                <DateTimePicker
                    value={endDate}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleEndChange}
                />
            )}
        </View>
    );
};

const HolidayCard = ({ holiday, onDelete }) => {
    const { colors } = useTheme();

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return (
        <View style={[styles.holidayCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <View style={styles.holidayInfo}>
                <Text style={[styles.holidayTitle, { color: colors.text }]}>{holiday.title}</Text>
                <Text style={[styles.holidayDates, { color: colors.textSecondary }]}>
                    {formatDate(holiday.start_date)}
                    {holiday.end_date && holiday.end_date !== holiday.start_date ? ` - ${formatDate(holiday.end_date)}` : ''}
                </Text>
                {holiday.is_half_day && (
                    <View style={[styles.halfDayBadge, { backgroundColor: serviceGreen + '20' }]}>
                        <Text style={[styles.halfDayText, { color: serviceGreen }]}>Yarim Gun</Text>
                    </View>
                )}
            </View>
            <Pressable onPress={() => onDelete(holiday)} style={styles.holidayDelete}>
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={serviceRed} />
            </Pressable>
        </View>
    );
};

const AddHolidayModal = ({ visible, onClose, onAdd, companyId }) => {
    const { colors } = useTheme();
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(null);
    const [isHalfDay, setIsHalfDay] = useState(false);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [saving, setSaving] = useState(false);

    const reset = () => {
        setTitle('');
        setStartDate(new Date());
        setEndDate(null);
        setIsHalfDay(false);
    };

    const handleAdd = async () => {
        if (!companyId) {
            Alert.alert('Hata', 'Once firma kaydi olusturulmali');
            return;
        }
        if (!title.trim()) {
            Alert.alert('Hata', 'Aciklama gerekli');
            return;
        }
        setSaving(true);
        try {
            await onAdd({
                company: companyId,
                title: title.trim(),
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate ? endDate.toISOString().split('T')[0] : startDate.toISOString().split('T')[0],
                is_half_day: isHalfDay,
            });
            reset();
            onClose();
        } catch (error) {
            Alert.alert('Hata', 'Tatil eklenemedi');
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (date) => date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
        <AppBottomSheet
            visible={visible}
            onClose={onClose}
            snapPoints={['72%']}
            contentContainerStyle={styles.modalContent}
        >
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Tatil Ekle</Text>
                        <Pressable onPress={onClose}>
                            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                        </Pressable>
                    </View>

                    <View style={styles.modalBody}>
                        <View style={styles.field}>
                            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Aciklama *</Text>
                            <TextInput
                                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                                value={title}
                                onChangeText={setTitle}
                                placeholder="ornek: Ramazan Bayrami"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </View>

                        <Pressable onPress={() => setShowStartPicker(true)} style={[styles.field, { borderColor: colors.border, borderWidth: 1.5, borderRadius: 12, padding: 14 }]}>
                            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Baslangic</Text>
                            <Text style={[styles.dateText, { color: colors.text }]}>{formatDate(startDate)}</Text>
                        </Pressable>

                        <Pressable onPress={() => setShowEndPicker(true)} style={[styles.field, { borderColor: colors.border, borderWidth: 1.5, borderRadius: 12, padding: 14 }]}>
                            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bitis (Ayni gun = bos birak)</Text>
                            <Text style={[styles.dateText, { color: endDate ? colors.text : colors.textTertiary }]}>
                                {endDate ? formatDate(endDate) : 'Ayni gun'}
                            </Text>
                        </Pressable>

                        <Pressable onPress={() => setIsHalfDay(!isHalfDay)} style={[styles.checkRow, { borderColor: colors.divider }]}>
                            <MaterialCommunityIcons
                                name={isHalfDay ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                size={22}
                                color={isHalfDay ? serviceBlue : colors.textSecondary}
                            />
                            <Text style={[styles.checkLabel, { color: colors.text }]}>Yarim gun tatil</Text>
                        </Pressable>
                    </View>

                    <View style={styles.modalFooter}>
                        <Pressable onPress={onClose} style={[styles.modalBtn, { borderColor: colors.divider }]}>
                            <Text style={[styles.modalBtnText, { color: colors.text }]}>Iptal</Text>
                        </Pressable>
                        <Pressable onPress={handleAdd} disabled={saving} style={[styles.modalBtn, { backgroundColor: serviceBlue }]}>
                            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.modalBtnText, { color: '#fff' }]}>Ekle</Text>}
                        </Pressable>
                    </View>
            {showStartPicker && (
                <DateTimePicker
                    value={startDate}
                    mode="date"
                    display="default"
                    onChange={(e, d) => { setShowStartPicker(false); if (d) setStartDate(d); }}
                />
            )}
            {showEndPicker && (
                <DateTimePicker
                    value={endDate || startDate}
                    mode="date"
                    display="default"
                    onChange={(e, d) => { setShowEndPicker(false); if (d) setEndDate(d); }}
                />
            )}
        </AppBottomSheet>
    );
};

export default function CompanySettingsScreen() {
    const { colors } = useTheme();

    const [config, setConfig] = useState(DEFAULT_PUBLIC_CONFIG);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({});
    const [workingHours, setWorkingHours] = useState([]);
    const [holidays, setHolidays] = useState([]);
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [savingHours, setSavingHours] = useState(false);
    const [selectedLogo, setSelectedLogo] = useState(null);

    const fetchConfig = useCallback(async ({ silent = false } = {}) => {
        if (!silent) {
            setLoading(true);
        }
        setError('');
        try {
            const response = await api.get(ENDPOINTS.CONFIG.COMPANY_CONFIGS);
            const data = Array.isArray(response?.data) ? response.data[0] : response?.data;
            const normalized = data
                ? normalizeConfig(data)
                : normalizeConfig((await api.get(ENDPOINTS.CONFIG.PUBLIC_COMPANY))?.data);

            setConfig(normalized);
            setForm({
                name: normalized?.name || '',
                phone_number: normalized?.phone_number || '',
                email: normalized?.email || '',
                address: normalized?.address || '',
            });
            setWorkingHours(normalized.working_hours);
            setHolidays(normalized.holiday_exceptions);
        } catch (error) {
            console.log('Company config fetch error:', error?.response?.data || error?.message || error);
            setError('Firma bilgileri yuklenemedi');
            setConfig(DEFAULT_PUBLIC_CONFIG);
            setForm({
                name: DEFAULT_PUBLIC_CONFIG.name,
                phone_number: '',
                email: '',
                address: '',
            });
            setWorkingHours([]);
            setHolidays([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    const handleSave = async () => {
        setSaving(true);
        try {
            if (selectedLogo) {
                const formData = new FormData();
                Object.keys(form).forEach(key => {
                    if (form[key] !== undefined && form[key] !== null && form[key] !== '') {
                        formData.append(key, String(form[key]));
                    }
                });
                const filename = selectedLogo.split('/').pop() || 'logo.jpg';
                const match = /\.(\w+)$/.exec(filename);
                const ext = match ? match[1].toLowerCase() : 'jpg';
                const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
                formData.append('logo', {
                    uri: selectedLogo,
                    name: filename,
                    type: mimeType,
                });

                const storage = require('@react-native-async-storage/async-storage').default;
                const token = await storage.getItem('auth_token');
                const tenantCode = await storage.getItem('tenant_code');

                const headers = {};
                if (token) headers['Authorization'] = `Token ${token}`;
                if (tenantCode) headers['X-Tenant-Code'] = tenantCode;

                const baseURL = api.defaults.baseURL;
                const endpointPath = config?.id
                    ? ENDPOINTS.CONFIG.COMPANY_CONFIG_DETAIL(config.id)
                    : ENDPOINTS.CONFIG.COMPANY_CONFIGS;
                const fullURL = `${baseURL}/${endpointPath}`;
                const response = await fetch(fullURL, {
                    method: config?.id ? 'PATCH' : 'POST',
                    headers,
                    body: formData,
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.detail || `HTTP ${response.status}`);
                }
            } else if (config?.id) {
                await api.patch(ENDPOINTS.CONFIG.COMPANY_CONFIG_DETAIL(config.id), form);
            } else {
                await api.post(ENDPOINTS.CONFIG.COMPANY_CONFIGS, form);
            }
            Alert.alert('Basarili', 'Firma ayarlari guncellendi');
            setEditing(false);
            setSelectedLogo(null);
            fetchConfig({ silent: true });
        } catch (error) {
            console.log('Save error:', error?.response?.data || error?.message || error);
            const errorMsg = error?.response?.data?.detail
                || error?.response?.data?.message
                || Object.values(error?.response?.data || {}).flat().join(', ')
                || error?.message
                || 'Guncellenemedi';
            Alert.alert('Hata', errorMsg);
        } finally {
            setSaving(false);
        }
    };

    const pickLogo = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Izni yok', 'Galeri erisimi icin izin gerekli');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const uri = result.assets[0].uri;
                console.log('Logo selected:', uri);
                setSelectedLogo(uri);
            }
        } catch (error) {
            console.log('Pick logo error:', error);
            Alert.alert('Hata', 'Resim secilemedi');
        }
    };

    const handleWorkingHourUpdate = (updatedHour) => {
        setWorkingHours(prev => prev.map(h => h.id === updatedHour.id ? updatedHour : h));
    };

    const handleSaveWorkingHours = async () => {
        if (!config?.id || workingHours.length === 0) {
            Alert.alert('Bilgi', 'Kaydedilecek calisma saati bulunamadi');
            return;
        }
        setSavingHours(true);
        try {
            await Promise.all(
                workingHours.map(hour =>
                    api.patch(ENDPOINTS.WORKING_HOURS.DETAIL(hour.id), {
                        start_time: hour.start_time,
                        end_time: hour.end_time,
                        is_holiday: hour.is_holiday,
                    })
                )
            );
            Alert.alert('Basarili', 'Calisma saatleri guncellendi');
            fetchConfig({ silent: true });
        } catch (error) {
            Alert.alert('Hata', 'Calisma saatleri guncellemedi');
        } finally {
            setSavingHours(false);
        }
    };

    const handleAddHoliday = async (holidayData) => {
        try {
            await api.post(ENDPOINTS.HOLIDAYS.LIST, holidayData);
            fetchConfig({ silent: true });
        } catch (error) {
            throw error;
        }
    };

    const handleDeleteHoliday = async (holiday) => {
        Alert.alert(
            'Tatil Sil',
            `"${holiday.title}" silinecek. Emin misiniz?`,
            [
                { text: 'Iptal', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(ENDPOINTS.HOLIDAYS.DETAIL(holiday.id));
                            fetchConfig({ silent: true });
                        } catch (error) {
                            Alert.alert('Hata', 'Tatil silinemedi');
                        }
                    },
                },
            ]
        );
    };

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const handleRefresh = () => {
        setRefreshing(true);
        fetchConfig({ silent: true });
    };

    if (loading) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <Header title="Firma Ayarlari" showBack borderBottom />
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={serviceBlue} />
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <Header
                title="Firma Ayarlari"
                subtitle="Sirket bilgileri ve calisma ayarlari"
                showBack
                borderBottom
                right={saving ? <ActivityIndicator size="small" color={serviceBlue} /> : null}
                rightActions={saving ? undefined : [
                    {
                        icon: editing ? 'check' : 'pencil-outline',
                        onPress: () => editing ? handleSave() : setEditing(true),
                        color: serviceBlue,
                    },
                ]}
            />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
                <ScrollView
                    contentContainerStyle={styles.container}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={serviceBlue} />}
                >
                    <View style={[styles.logoCard, { backgroundColor: colors.surface }]}>
                        <Pressable onPress={editing ? pickLogo : undefined} disabled={!editing} style={styles.logoPressable}>
                            {(config?.logo || selectedLogo) ? (
                                <Image source={{ uri: selectedLogo || config.logo }} style={styles.logo} />
                            ) : (
                                <View style={[styles.logoPlaceholder, { backgroundColor: `${serviceBlue}15` }]}>
                                    <MaterialCommunityIcons name="image-outline" size={48} color={serviceBlue} />
                                </View>
                            )}
                            {editing && (
                                <View style={[styles.logoEditBadge, { backgroundColor: serviceBlue }]}>
                                    <MaterialCommunityIcons name="camera" size={14} color="#fff" />
                                </View>
                            )}
                        </Pressable>
                        <Text style={[styles.companyName, { color: colors.text }]}>{config?.name || 'Firma Adi'}</Text>
                        <Text style={[styles.tenantCode, { color: colors.textSecondary }]}>
                            Tenant: {config?.tenant_code || '-'}
                        </Text>
                    </View>

                    {error ? (
                        <View style={[styles.errorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={styles.errorTextWrap}>
                                <Text style={[styles.errorTitle, { color: colors.text }]}>Firma bilgileri gorunmuyor</Text>
                                <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                                    Bu ekran admin config endpointi eksik oldugu icin bos kalabiliyordu. Yenileyip tekrar deneyebilirsiniz.
                                </Text>
                            </View>
                            <Pressable onPress={handleRefresh} style={[styles.retryBtn, { backgroundColor: serviceBlue }]}>
                                <Text style={styles.retryBtnText}>Yenile</Text>
                            </Pressable>
                        </View>
                    ) : null}

                    <View style={[styles.section, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>FIRMA BILGILERI</Text>
                        {editing ? (
                            <>
                                <View style={styles.editField}>
                                    <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Firma Adi</Text>
                                    <TextInput
                                        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                                        value={form.name}
                                        onChangeText={v => setField('name', v)}
                                        placeholder="Firma adi"
                                        placeholderTextColor={colors.textTertiary}
                                    />
                                </View>
                                <View style={styles.editField}>
                                    <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Telefon</Text>
                                    <TextInput
                                        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                                        value={form.phone_number}
                                        onChangeText={v => setField('phone_number', v)}
                                        placeholder="Telefon numarasi"
                                        placeholderTextColor={colors.textTertiary}
                                        keyboardType="phone-pad"
                                    />
                                </View>
                                <View style={styles.editField}>
                                    <Text style={[styles.editLabel, { color: colors.textSecondary }]}>E-posta</Text>
                                    <TextInput
                                        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                                        value={form.email}
                                        onChangeText={v => setField('email', v)}
                                        placeholder="E-posta adresi"
                                        placeholderTextColor={colors.textTertiary}
                                        keyboardType="email-address"
                                    />
                                </View>
                                <View style={styles.editField}>
                                    <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Adres</Text>
                                    <TextInput
                                        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background, height: 80, textAlignVertical: 'top' }]}
                                        value={form.address}
                                        onChangeText={v => setField('address', v)}
                                        placeholder="Adres"
                                        placeholderTextColor={colors.textTertiary}
                                        multiline
                                    />
                                </View>
                            </>
                        ) : (
                            <>
                                <InfoItem icon="phone-outline" label="Telefon" value={config?.phone_number} />
                                <InfoItem icon="email-outline" label="E-posta" value={config?.email} />
                                <InfoItem icon="map-marker-outline" label="Adres" value={config?.address} />
                            </>
                        )}
                    </View>

                    <View style={[styles.section, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>KULLANICI BILGILERI</Text>
                        <InfoItem icon="account-group-outline" label="Aktif Kullanicilar" value={`${config?.active_users_count || 0} / ${config?.max_users || 0}`} />
                    </View>

                    <View style={[styles.section, { backgroundColor: colors.surface }]}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 0 }]}>CALISMA SAATLERI</Text>
                            {editing && (
                                <Pressable onPress={handleSaveWorkingHours} disabled={savingHours} style={styles.saveHoursBtn}>
                                    {savingHours ? (
                                        <ActivityIndicator size="small" color={serviceBlue} />
                                    ) : (
                                        <MaterialCommunityIcons name="content-save-outline" size={20} color={serviceBlue} />
                                    )}
                                </Pressable>
                            )}
                        </View>
                        <View style={styles.whList}>
                            {workingHours.map(hour => (
                                <WorkingHourRow
                                    key={hour.id}
                                    hour={hour}
                                    onUpdate={handleWorkingHourUpdate}
                                    editing={editing}
                                />
                            ))}
                        </View>
                    </View>

                    <View style={[styles.section, { backgroundColor: colors.surface }]}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 0 }]}>TATIL GUNLERI</Text>
                            {editing && (
                                <Pressable onPress={() => setShowHolidayModal(true)} style={styles.addHolidayBtn}>
                                    <MaterialCommunityIcons name="plus" size={20} color={serviceBlue} />
                                </Pressable>
                            )}
                        </View>
                        {holidays.length === 0 ? (
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Henuz tatil eklenmedi</Text>
                        ) : (
                            <View style={styles.holidaysList}>
                                {holidays.map(holiday => (
                                    <HolidayCard
                                        key={holiday.id}
                                        holiday={holiday}
                                        onDelete={handleDeleteHoliday}
                                    />
                                ))}
                            </View>
                        )}
                    </View>

                    <View style={[styles.section, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>VERSIYON BILGISI</Text>
                        <InfoItem icon="android" label="Android Versiyon" value={config?.store_android_version || '-'} />
                        <InfoItem icon="apple" label="iOS Versiyon" value={config?.store_ios_version || '-'} />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <AddHolidayModal
                visible={showHolidayModal}
                onClose={() => setShowHolidayModal(false)}
                onAdd={handleAddHoliday}
                companyId={config?.id}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    content: { flex: 1 },
    container: { paddingHorizontal: 16, paddingBottom: 24 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
    errorTextWrap: { flex: 1 },
    errorTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
    errorText: { fontSize: 13, lineHeight: 18 },
    retryBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
    retryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    logoCard: { alignItems: 'center', paddingVertical: 24, borderRadius: 16, marginBottom: 16 },
    logoPressable: { position: 'relative', marginBottom: 12 },
    logo: { width: 80, height: 80, borderRadius: 16 },
    logoPlaceholder: { width: 80, height: 80, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    logoEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
    companyName: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
    tenantCode: { fontSize: 13 },
    section: { borderRadius: 16, padding: 16, marginBottom: 16 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
    infoItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1 },
    infoIcon: { marginRight: 12, marginTop: 2 },
    infoContent: { flex: 1 },
    infoLabel: { fontSize: 12, marginBottom: 2 },
    infoValue: { fontSize: 15, fontWeight: '600' },
    editField: { marginBottom: 14 },
    editLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    saveHoursBtn: { padding: 4 },
    addHolidayBtn: { padding: 4 },
    whList: { gap: 8 },
    whRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1 },
    whDayWrap: { width: 90 },
    whDay: { fontSize: 14, fontWeight: '600' },
    whControls: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
    whTimeBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
    whTimeText: { fontSize: 13, fontWeight: '600' },
    whSep: { fontSize: 13 },
    whHolidayBtn: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
    whDisplay: { flex: 1 },
    whTime: { fontSize: 13, fontWeight: '600' },
    whHoliday: { fontSize: 13, fontWeight: '700' },
    holidaysList: { gap: 8 },
    holidayCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1 },
    holidayInfo: { flex: 1 },
    holidayTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
    holidayDates: { fontSize: 12 },
    holidayDelete: { padding: 8 },
    halfDayBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
    halfDayText: { fontSize: 11, fontWeight: '700' },
    emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 34 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
    modalTitle: { fontSize: 18, fontWeight: '800' },
    modalBody: { padding: 20, gap: 14 },
    modalFooter: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
    modalBtnText: { fontSize: 15, fontWeight: '700' },
    field: { marginBottom: 4 },
    fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
    dateText: { fontSize: 15, fontWeight: '600' },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, marginTop: 4 },
    checkLabel: { fontSize: 15, fontWeight: '600' },
});
