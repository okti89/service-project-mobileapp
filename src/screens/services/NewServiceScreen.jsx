import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BottomSheetBackdrop, BottomSheetFlatList, BottomSheetModal } from '@gorhom/bottom-sheet';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import WrapperContainer from '@/components/WrapperContainer';
import Header from '@/components/Header';
import CustomButton from '@/components/CustomButton';
import CustomInput from '@/components/CustomInput';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import customerService from '@/services/customerService';
import deviceService from '@/services/deviceService';
import serviceService from '@/services/serviceService';
import { serviceBlue, serviceRed } from '@/theme/color';
import { spacing } from '@/theme/spacing';

dayjs.locale('tr');

const initialFormState = () => ({
    customer: null,
    fullName: '',
    phone: '',
    address: '',
    deviceType: null,
    deviceBrand: null,
    deviceModel: null,
    faultDescription: '',
    scheduledDate: dayjs().add(1, 'hour').startOf('hour').toDate(),
});

const validate = (form) => {
    const errors = {};
    if (!form.fullName.trim()) errors.fullName = 'Ad soyad zorunlu';
    if (!form.phone.trim()) errors.phone = 'Telefon zorunlu';
    else if (form.phone.replace(/\D/g, '').length < 10) errors.phone = 'Geçerli bir telefon girin';
    if (!form.address.trim()) errors.address = 'Adres zorunlu';
    if (!form.faultDescription.trim()) errors.faultDescription = 'Arıza açıklaması zorunlu';
    return errors;
};

const formatPhoneInput = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) {
        const d = digits.slice(0, 11);
        if (d.length <= 4) return d;
        if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
        if (d.length <= 9) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
        return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
    }
    if (digits.startsWith('5')) {
        const d = digits.slice(0, 10);
        if (d.length <= 3) return d;
        if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
        if (d.length <= 8) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
        return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
    }
    return digits;
};

const normalizePhoneForApi = (value) => {
    let digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('90')) return `+${digits}`;
    if (digits.startsWith('0')) return `+90${digits.slice(1)}`;
    if (digits.length === 10) return `+90${digits}`;
    return `+${digits}`;
};

const getInitials = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const filterCustomers = (rows, query) => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((item) => [item?.full_name, item?.phone_number, item?.address].filter(Boolean).join(' ').toLowerCase().includes(q));
};

const SectionTitle = ({ title, colors }) => (
    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
);

const InlineSelect = ({ label, value, options, onSelect, loading, colors, error }) => {
    const [open, setOpen] = useState(false);

    return (
        <View style={styles.fieldWrap}>
            <Text style={[styles.fieldLabel, { color: error ? serviceRed : colors.textSecondary }]}>{label}</Text>
            <Pressable
                onPress={() => setOpen((prev) => !prev)}
                style={({ pressed }) => [
                    styles.fieldInput,
                    {
                        backgroundColor: colors.surface,
                        borderColor: error ? serviceRed : open ? serviceBlue : colors.border,
                        opacity: pressed ? 0.9 : 1,
                    },
                ]}
            >
                <Text style={[styles.fieldInputText, { color: value ? colors.text : colors.textTertiary }]} numberOfLines={1}>
                    {value || 'Seçiniz'}
                </Text>
                <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
            </Pressable>
            {open ? (
                <View style={[styles.optionsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {loading ? (
                        <View style={styles.optionsLoading}><ActivityIndicator size="small" color={serviceBlue} /></View>
                    ) : options.length === 0 ? (
                        <Text style={[styles.optionsEmpty, { color: colors.textTertiary }]}>Seçenek bulunamadı</Text>
                    ) : (
                        <ScrollView style={styles.optionsScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                            {options.map((option) => (
                                <Pressable
                                    key={String(option.id)}
                                    onPress={() => {
                                        onSelect(option);
                                        setOpen(false);
                                    }}
                                    style={({ pressed }) => [
                                        styles.optionRow,
                                        {
                                            borderBottomColor: colors.divider,
                                            backgroundColor: pressed ? `${serviceBlue}10` : 'transparent',
                                        },
                                    ]}
                                >
                                    <Text style={[styles.optionText, { color: colors.text }]}>{option.name}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    )}
                </View>
            ) : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
    );
};

const CreateOptionRow = ({ value, onChangeText, onCreate, placeholder, disabled, loading, colors }) => (
    <View style={[styles.createRow, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
        <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            style={[styles.createInput, { color: colors.text }]}
        />
        <Pressable
            onPress={onCreate}
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.createButton,
                {
                    backgroundColor: disabled || loading ? colors.border : serviceBlue,
                    opacity: pressed ? 0.92 : 1,
                },
            ]}
        >
            {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />}
        </Pressable>
    </View>
);

export default function NewServiceScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { showToast } = useToast();
    const customerSheetRef = useRef(null);

    const [form, setForm] = useState(initialFormState);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    const [customers, setCustomers] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(false);
    const [customerQuery, setCustomerQuery] = useState('');
    const [deviceTypes, setDeviceTypes] = useState([]);
    const [deviceTypesLoading, setDeviceTypesLoading] = useState(false);
    const [brands, setBrands] = useState([]);
    const [brandsLoading, setBrandsLoading] = useState(false);
    const [models, setModels] = useState([]);
    const [modelsLoading, setModelsLoading] = useState(false);

    const [newTypeName, setNewTypeName] = useState('');
    const [newBrandName, setNewBrandName] = useState('');
    const [newModelName, setNewModelName] = useState('');
    const [creatingType, setCreatingType] = useState(false);
    const [creatingBrand, setCreatingBrand] = useState(false);
    const [creatingModel, setCreatingModel] = useState(false);
    const renderBackdrop = useCallback((props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} pressBehavior="close" />
    ), []);

    const updateField = useCallback((key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const loadCustomers = useCallback(async () => {
        try {
            setCustomersLoading(true);
            const rows = await customerService.listCustomers();
            setCustomers(Array.isArray(rows) ? rows : []);
        } finally {
            setCustomersLoading(false);
        }
    }, []);

    const loadDeviceTypes = useCallback(async () => {
        try {
            setDeviceTypesLoading(true);
            const rows = await deviceService.listDeviceTypes();
            setDeviceTypes(Array.isArray(rows) ? rows : []);
        } finally {
            setDeviceTypesLoading(false);
        }
    }, []);

    const loadBrands = useCallback(async () => {
        try {
            setBrandsLoading(true);
            const rows = await deviceService.listBrands();
            setBrands(Array.isArray(rows) ? rows : []);
        } finally {
            setBrandsLoading(false);
        }
    }, []);

    const loadModels = useCallback(async () => {
        try {
            setModelsLoading(true);
            const rows = await deviceService.listModels();
            setModels(Array.isArray(rows) ? rows : []);
        } finally {
            setModelsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCustomers();
        loadDeviceTypes();
        loadBrands();
        loadModels();
    }, [loadBrands, loadCustomers, loadDeviceTypes, loadModels]);

    const filteredCustomers = useMemo(() => filterCustomers(customers, customerQuery), [customers, customerQuery]);
    const filteredModels = useMemo(() => {
        if (!form.deviceBrand?.id) return [];
        return models.filter((item) => String(item?.brand) === String(form.deviceBrand.id));
    }, [form.deviceBrand?.id, models]);

    const handlePickCustomer = useCallback((customer) => {
        setForm((prev) => ({
            ...prev,
            customer,
            fullName: customer?.full_name || prev.fullName,
            phone: formatPhoneInput(customer?.phone_number || customer?.phone || prev.phone),
            address: customer?.address || prev.address,
        }));
        setCustomerQuery('');
        customerSheetRef.current?.dismiss();
    }, []);

    const createType = useCallback(async () => {
        const name = newTypeName.trim();
        if (!name) return;
        try {
            setCreatingType(true);
            const created = await deviceService.createDeviceType(name);
            setDeviceTypes((prev) => [...prev.filter((item) => String(item.id) !== String(created.id)), created].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'tr')));
            updateField('deviceType', created);
            setNewTypeName('');
        } catch {
            showToast?.('error', 'Cihaz türü', 'Yeni cihaz türü eklenemedi');
        } finally {
            setCreatingType(false);
        }
    }, [newTypeName, showToast, updateField]);

    const createBrand = useCallback(async () => {
        const name = newBrandName.trim();
        if (!name) return;
        try {
            setCreatingBrand(true);
            const created = await deviceService.createBrand(name);
            setBrands((prev) => [...prev.filter((item) => String(item.id) !== String(created.id)), created].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'tr')));
            updateField('deviceBrand', created);
            updateField('deviceModel', null);
            setNewBrandName('');
        } catch {
            showToast?.('error', 'Marka', 'Yeni marka eklenemedi');
        } finally {
            setCreatingBrand(false);
        }
    }, [newBrandName, showToast, updateField]);

    const createModel = useCallback(async () => {
        const name = newModelName.trim();
        if (!name || !form.deviceBrand?.id) return;
        try {
            setCreatingModel(true);
            const created = await deviceService.createModel({ name, brandId: form.deviceBrand.id });
            const normalized = { ...created, brand: created?.brand || form.deviceBrand.id };
            setModels((prev) => [...prev.filter((item) => String(item.id) !== String(normalized.id)), normalized].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'tr')));
            updateField('deviceModel', normalized);
            setNewModelName('');
        } catch {
            showToast?.('error', 'Model', 'Yeni model eklenemedi');
        } finally {
            setCreatingModel(false);
        }
    }, [form.deviceBrand?.id, newModelName, showToast, updateField]);

    const handleSubmit = useCallback(async () => {
        const validation = validate(form);
        if (Object.keys(validation).length > 0) {
            setErrors(validation);
            showToast?.('error', 'Form', 'Lütfen zorunlu alanları doldurun');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                customer: form.customer?.id || null,
                customer_full_name: form.fullName.trim(),
                customer_phone: normalizePhoneForApi(form.phone),
                customer_address: form.address.trim(),
                fault_description: form.faultDescription.trim(),
                scheduled_date: dayjs(form.scheduledDate).format('YYYY-MM-DDTHH:mm:ss'),
                service_status: 'new',
                device_type: form.deviceType?.id || null,
                device_brand: form.deviceBrand?.id || null,
                device_model: form.deviceModel?.id || null,
            };
            await serviceService.createService(payload);
            showToast?.('success', 'Servis', 'Yeni servis oluşturuldu');
            navigation.goBack();
        } catch (err) {
            const data = err?.response?.data;
            if (data && typeof data === 'object') {
                const fieldErrors = {};
                Object.entries(data).forEach(([key, value]) => {
                    fieldErrors[key] = Array.isArray(value) ? String(value[0]) : String(value);
                });
                setErrors((prev) => ({ ...prev, ...fieldErrors }));
            }
            showToast?.('error', 'Servis', 'Oluşturulamadı. Alanları kontrol edin.');
        } finally {
            setSubmitting(false);
        }
    }, [form, navigation, showToast]);

    const onDateChange = useCallback((event, selected) => {
        setShowDatePicker(false);
        if (event?.type === 'dismissed' || !selected) return;
        const next = new Date(form.scheduledDate);
        next.setFullYear(selected.getFullYear());
        next.setMonth(selected.getMonth());
        next.setDate(selected.getDate());
        updateField('scheduledDate', next);
    }, [form.scheduledDate, updateField]);

    const onTimeChange = useCallback((event, selected) => {
        setShowTimePicker(false);
        if (event?.type === 'dismissed' || !selected) return;
        const next = new Date(form.scheduledDate);
        next.setHours(selected.getHours());
        next.setMinutes(selected.getMinutes());
        updateField('scheduledDate', next);
    }, [form.scheduledDate, updateField]);

    const dateLabel = useMemo(() => dayjs(form.scheduledDate).format('DD MMMM YYYY'), [form.scheduledDate]);
    const timeLabel = useMemo(() => dayjs(form.scheduledDate).format('HH:mm'), [form.scheduledDate]);

    const renderInput = (key, label, options = {}) => (
        <CustomInput
            label={`${label}${options.required ? ' *' : ''}`}
            value={form[key]}
            onChangeText={(text) => updateField(key, text)}
            error={errors[key]}
            isPhone={options.phone}
            keyboardType={options.keyboardType}
            multiline={options.multiline}
            numberOfLines={options.multiline ? 4 : 1}
            placeholder={options.placeholder || label}
            inputContainerStyle={[
                styles.textInput,
                options.multiline && styles.textArea,
                {
                    backgroundColor: colors.surface,
                    height: options.multiline ? undefined : 55,
                    alignItems: options.multiline ? 'flex-start' : 'center',
                    paddingTop: options.multiline ? 12 : undefined,
                },
            ]}
            style={[
                styles.customInputText,
                {
                    color: colors.text,
                    textAlignVertical: options.multiline ? 'top' : 'center',
                },
            ]}
        />
    );
    return (
        <WrapperContainer keyboardAvoiding>
            <Header title="Yeni Servis" subtitle="Müşteri ve cihaz bilgilerini girin" showBack borderBottom />

            <ScrollView style={styles.screen} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <SectionTitle title="MÜŞTERİ" colors={colors} />
                    <View style={styles.fieldWrap}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Kayıtlı müşteri</Text>
                        <Pressable onPress={() => customerSheetRef.current?.present()} style={({ pressed }) => [styles.customerPicker, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 }]}>
                            <View style={styles.customerPickerLeft}>
                                <View style={styles.customerAvatar}><Text style={styles.customerAvatarText}>{getInitials(form.customer?.full_name)}</Text></View>
                                <View style={styles.customerPickerTextWrap}>
                                    <Text style={[styles.customerPickerLabel, { color: colors.textSecondary }]}>Kayıtlı müşteri seç</Text>
                                    <Text style={[styles.customerPickerValue, { color: form.customer?.full_name ? colors.text : colors.textTertiary }]} numberOfLines={1}>{form.customer?.full_name || 'Listeden müşteri seçin'}</Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                        </Pressable>
                    </View>

                    {renderInput('fullName', 'Ad soyad', { required: true })}
                    {renderInput('phone', 'Telefon', { required: true, keyboardType: 'phone-pad', phone: true })}
                    {renderInput('address', 'Adres', { required: true, multiline: true })}
                </View>

                <View style={styles.section}>
                    <SectionTitle title="CİHAZ" colors={colors} />
                    <InlineSelect label="Cihaz türü" value={form.deviceType?.name} options={deviceTypes.map((item) => ({ id: item.id, name: item.name }))} onSelect={(option) => updateField('deviceType', deviceTypes.find((item) => String(item.id) === String(option.id)) || null)} loading={deviceTypesLoading} colors={colors} error={errors.device_type} />
                    <CreateOptionRow value={newTypeName} onChangeText={setNewTypeName} onCreate={createType} placeholder="Yeni cihaz türü ekle" disabled={!newTypeName.trim()} loading={creatingType} colors={colors} />

                    <InlineSelect label="Marka" value={form.deviceBrand?.name} options={brands.map((item) => ({ id: item.id, name: item.name }))} onSelect={(option) => { const brand = brands.find((item) => String(item.id) === String(option.id)) || null; updateField('deviceBrand', brand); updateField('deviceModel', null); }} loading={brandsLoading} colors={colors} error={errors.device_brand} />
                    <CreateOptionRow value={newBrandName} onChangeText={setNewBrandName} onCreate={createBrand} placeholder="Yeni marka ekle" disabled={!newBrandName.trim()} loading={creatingBrand} colors={colors} />

                    <InlineSelect label="Model" value={form.deviceModel?.name} options={filteredModels.map((item) => ({ id: item.id, name: item.name }))} onSelect={(option) => updateField('deviceModel', filteredModels.find((item) => String(item.id) === String(option.id)) || null)} loading={modelsLoading} colors={colors} error={errors.device_model} />
                    {!form.deviceBrand?.id ? <Text style={styles.errorText}>Model eklemek için önce marka seçmelisiniz.</Text> : null}
                    <CreateOptionRow value={newModelName} onChangeText={setNewModelName} onCreate={createModel} placeholder="Yeni model ekle" disabled={!newModelName.trim() || !form.deviceBrand?.id} loading={creatingModel} colors={colors} />
                </View>

                <View style={styles.section}>
                    <SectionTitle title="ARIZA" colors={colors} />
                    {renderInput('faultDescription', 'Arıza açıklaması', { required: true, multiline: true, placeholder: 'Cihazdaki sorunu kısaca açıklayın' })}
                </View>

                <View style={styles.section}>
                    <SectionTitle title="PLANLAMA" colors={colors} />
                    <View style={styles.dateRow}>
                        <Pressable onPress={() => setShowDatePicker(true)} style={({ pressed }) => [styles.dateBox, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}>
                            <MaterialCommunityIcons name="calendar-outline" size={16} color={colors.textSecondary} />
                            <Text style={[styles.dateText, { color: colors.text }]}>{dateLabel}</Text>
                        </Pressable>
                        <Pressable onPress={() => setShowTimePicker(true)} style={({ pressed }) => [styles.dateBox, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}>
                            <MaterialCommunityIcons name="clock-outline" size={16} color={colors.textSecondary} />
                            <Text style={[styles.dateText, { color: colors.text }]}>{timeLabel}</Text>
                        </Pressable>
                    </View>
                </View>
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: colors.divider, backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, spacing.m) }]}>
                <CustomButton title={submitting ? 'Oluşturuluyor...' : 'Servisi Oluştur'} onPress={handleSubmit} loading={submitting} disabled={submitting} size="md" variant="primary" gradient={[serviceBlue, serviceBlue]} block />
            </View>

            <BottomSheetModal ref={customerSheetRef} index={0} snapPoints={['78%']} backdropComponent={renderBackdrop} handleComponent={null} enablePanDownToClose backgroundStyle={{ backgroundColor: colors.surface }}>
                <View style={styles.sheetContainer}>
                    <View style={styles.sheetHeader}>
                        <Text style={[styles.sheetTitle, { color: colors.text }]}>Müşteri seç</Text>
                        <Pressable onPress={() => customerSheetRef.current?.dismiss()} style={styles.sheetCloseBtn}><MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} /></Pressable>
                    </View>
                    <View style={[styles.searchBox, { backgroundColor: colors.surfaceMuted || colors.surface, borderColor: colors.border }]}> 
                        <MaterialCommunityIcons name="magnify" size={18} color={colors.textTertiary} />
                        <TextInput value={customerQuery} onChangeText={setCustomerQuery} placeholder="Müşteri ara" placeholderTextColor={colors.textTertiary} style={[styles.searchInput, { color: colors.text }]} />
                    </View>
                    <BottomSheetFlatList
                        data={customersLoading ? [] : filteredCustomers}
                        keyExtractor={(item) => String(item.id)}
                        contentContainerStyle={filteredCustomers.length ? styles.customerListContent : styles.emptyListContent}
                        renderItem={({ item }) => (
                            <Pressable onPress={() => handlePickCustomer(item)} style={({ pressed }) => [styles.customerOption, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 }]}>
                                <View style={styles.customerOptionHeader}>
                                    <View style={styles.customerOptionAvatar}><Text style={styles.customerAvatarText}>{getInitials(item?.full_name)}</Text></View>
                                    <View style={styles.customerOptionInfo}>
                                        <Text style={[styles.customerOptionName, { color: colors.text }]} numberOfLines={1}>{item?.full_name || 'Müşteri'}</Text>
                                        {!!item?.phone_number && <Text style={[styles.customerOptionMeta, { color: colors.textSecondary }]}>{item.phone_number}</Text>}
                                        {!!item?.address && <Text style={[styles.customerOptionMeta, { color: colors.textSecondary }]} numberOfLines={2}>{item.address}</Text>}
                                    </View>
                                </View>
                            </Pressable>
                        )}
                        ListEmptyComponent={<View style={styles.emptyState}>{customersLoading ? <ActivityIndicator size="small" color={serviceBlue} /> : <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Müşteri bulunamadı</Text>}</View>}
                    />
                </View>
            </BottomSheetModal>

            {showDatePicker ? <DateTimePicker mode="date" value={form.scheduledDate} onChange={onDateChange} minimumDate={new Date()} display={Platform.OS === 'ios' ? 'inline' : 'default'} /> : null}
            {showTimePicker ? <DateTimePicker mode="time" value={form.scheduledDate} onChange={onTimeChange} minuteInterval={15} display={Platform.OS === 'ios' ? 'spinner' : 'default'} /> : null}
        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.gutter, paddingTop: spacing.m },
    section: { marginBottom: spacing.l },
    sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.s },
    fieldWrap: { marginBottom: spacing.m },
    fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    fieldInput: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: spacing.m, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s },
    fieldInputText: { flex: 1, fontSize: 14, fontWeight: '500' },
    optionsBox: { marginTop: 6, borderRadius: 12, borderWidth: 1, maxHeight: 180, overflow: 'hidden' },
    optionsScroll: { maxHeight: 180 },
    optionsLoading: { padding: spacing.m, alignItems: 'center' },
    optionsEmpty: { padding: spacing.m, fontSize: 13, textAlign: 'center' },
    optionRow: { paddingHorizontal: spacing.m, paddingVertical: spacing.s + 2, borderBottomWidth: StyleSheet.hairlineWidth },
    optionText: { fontSize: 14, fontWeight: '500' },
    createRow: { borderWidth: 1, borderRadius: 14, padding: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: -4, marginBottom: spacing.m },
    createInput: { flex: 1, minHeight: 40, fontSize: 14, fontWeight: '500', paddingHorizontal: spacing.s },
    createButton: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    textInput: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: spacing.m, paddingVertical: 12 },
    customInputText: { fontSize: 14, fontWeight: '500' },
    textArea: { minHeight: 92 },
    errorText: { color: serviceRed, fontSize: 11, fontWeight: '600', marginTop: 5 },
    customerPicker: { minHeight: 58, borderWidth: 1, borderRadius: 14, paddingHorizontal: spacing.m, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s },
    customerPickerLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.s },
    customerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${serviceBlue}16`, alignItems: 'center', justifyContent: 'center' },
    customerAvatarText: { color: serviceBlue, fontSize: 13, fontWeight: '800' },
    customerPickerTextWrap: { flex: 1, minWidth: 0 },
    customerPickerLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
    customerPickerValue: { fontSize: 14, fontWeight: '600' },
    dateRow: { flexDirection: 'row', gap: spacing.s },
    dateBox: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: spacing.m, flexDirection: 'row', alignItems: 'center', gap: spacing.s },
    dateText: { fontSize: 13, fontWeight: '600' },
    footer: { paddingHorizontal: spacing.gutter, paddingTop: spacing.m, borderTopWidth: StyleSheet.hairlineWidth },
    sheetContainer: { flex: 1, paddingHorizontal: spacing.gutter, paddingTop: spacing.s },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.m },
    sheetTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
    sheetCloseBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    searchBox: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: spacing.m, marginBottom: spacing.m, flexDirection: 'row', alignItems: 'center', gap: spacing.s },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },
    customerListContent: { paddingBottom: spacing['3xl'] },
    emptyListContent: { flexGrow: 1, justifyContent: 'center', paddingBottom: spacing['3xl'] },
    customerOption: { borderWidth: 1, borderRadius: 16, padding: spacing.m, marginBottom: spacing.s },
    customerOptionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s },
    customerOptionAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${serviceBlue}16`, alignItems: 'center', justifyContent: 'center' },
    customerOptionInfo: { flex: 1, minWidth: 0 },
    customerOptionName: { fontSize: 14, fontWeight: '700' },
    customerOptionMeta: { fontSize: 12, marginTop: 3 },
    emptyState: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});