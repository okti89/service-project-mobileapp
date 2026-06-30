import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
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
import {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetScrollView,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';

import CustomButton from '@/components/CustomButton';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';

import customerService from '@/services/customerService';
import deviceService from '@/services/deviceService';
import serviceService from '@/services/serviceService';

import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

dayjs.locale('tr');

const renderBackdrop = (props) => (
    <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.55}
        pressBehavior="close"
    />
);

const initialFormState = () => ({
    customer: null,           // { id, full_name, phone, address } veya null
    fullName: '',
    phone: '',
    address: '',
    deviceType: null,         // { id, name }
    deviceBrand: null,        // { id, name }
    deviceModel: null,        // { id, name }
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

// ────────────────────────────────────────────────────────────────────────
// Inline Select (label + value + chevron, tıklanınca bottom liste açılır)
// ────────────────────────────────────────────────────────────────────────
const InlineSelect = React.memo(({ label, value, options, onSelect, loading }) => {
    const { colors } = useTheme();
    const [open, setOpen] = useState(false);

    const handlePick = useCallback(
        (opt) => {
            onSelect?.(opt);
            setOpen(false);
        },
        [onSelect]
    );

    return (
        <View style={styles.fieldWrap}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {label}
            </Text>
            <Pressable
                onPress={() => setOpen((v) => !v)}
                style={({ pressed }) => [
                    styles.fieldInput,
                    {
                        backgroundColor: colors.surfaceMuted || (colors.surface),
                        borderColor: open ? colors.primary : colors.border,
                        opacity: pressed ? 0.85 : 1,
                    },
                ]}
            >
                <Text
                    style={[
                        styles.fieldInputText,
                        { color: value ? colors.text : colors.textTertiary },
                    ]}
                    numberOfLines={1}
                >
                    {value || 'Seçiniz'}
                </Text>
                <MaterialCommunityIcons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textSecondary}
                />
            </Pressable>

            {open ? (
                <View
                    style={[
                        styles.optionsBox,
                        {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    {loading ? (
                        <View style={styles.optionsLoading}>
                            <ActivityIndicator size="small" color={colors.primary} />
                        </View>
                    ) : options.length === 0 ? (
                        <Text
                            style={[
                                styles.optionsEmpty,
                                { color: colors.textTertiary },
                            ]}
                        >
                            Seçenek bulunamadı
                        </Text>
                    ) : (
                        <ScrollView
                            style={styles.optionsScroll}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={false}
                        >
                            {options.map((opt) => (
                                <Pressable
                                    key={String(opt.id)}
                                    onPress={() => handlePick(opt)}
                                    style={({ pressed }) => [
                                        styles.optionRow,
                                        {
                                            borderBottomColor: colors.divider,
                                            backgroundColor: pressed
                                                ? `${colors.primary}10`
                                                : 'transparent',
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.optionText,
                                            { color: colors.text },
                                        ]}
                                    >
                                        {opt.name}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    )}
                </View>
            ) : null}
        </View>
    );
});

// ────────────────────────────────────────────────────────────────────────
// NewServiceModal
// ────────────────────────────────────────────────────────────────────────
export default function NewServiceModal({ bottomSheetRef, onCreated }) {
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();

    const [form, setForm] = useState(initialFormState);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Veri kaynakları
    const [customers, setCustomers] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(false);
    const [deviceTypes, setDeviceTypes] = useState([]);
    const [deviceTypesLoading, setDeviceTypesLoading] = useState(false);
    const [brands, setBrands] = useState([]);
    const [brandsLoading, setBrandsLoading] = useState(false);
    const [models, setModels] = useState([]);
    const [modelsLoading, setModelsLoading] = useState(false);

    const hasFetchedRef = useRef(false);

    // Form alanı güncelleyici
    const updateField = useCallback((key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    // Form reset (modal her açıldığında)
    const resetForm = useCallback(() => {
        setForm(initialFormState());
        setErrors({});
        setSubmitting(false);
    }, []);

    // ── Veri yükleme (modal ilk kez sunulduğunda) ───────────────────────
    useEffect(() => {
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;

        let cancelled = false;
        const loadAll = async () => {
            try {
                setCustomersLoading(true);
                setDeviceTypesLoading(true);
                setBrandsLoading(true);

                const [c, t, b] = await Promise.allSettled([
                    customerService.listCustomers(),
                    deviceService.listDeviceTypes(),
                    deviceService.listBrands(),
                ]);

                if (cancelled) return;

                if (c.status === 'fulfilled') setCustomers(c.value || []);
                if (t.status === 'fulfilled') setDeviceTypes(t.value || []);
                if (b.status === 'fulfilled') setBrands(b.value || []);
            } finally {
                if (!cancelled) {
                    setCustomersLoading(false);
                    setDeviceTypesLoading(false);
                    setBrandsLoading(false);
                }
            }
        };

        loadAll();
        return () => {
            cancelled = true;
        };
    }, []);

    // ── Model bağımlılığı: brand değişince modelleri çek ────────────────
    useEffect(() => {
        if (!form.deviceBrand) {
            setModels([]);
            return;
        }
        let cancelled = false;
        setModelsLoading(true);
        deviceService
            .listModels({ brand: form.deviceBrand.id })
            .then((list) => {
                if (!cancelled) setModels(list || []);
            })
            .catch(() => {
                if (!cancelled) setModels([]);
            })
            .finally(() => {
                if (!cancelled) setModelsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [form.deviceBrand]);

    // ── Snap points ─────────────────────────────────────────────────────
    const snapPoints = useMemo(() => ['90%'], []);

    // ── Submit ──────────────────────────────────────────────────────────
    const handleSubmit = useCallback(async () => {
        const v = validate(form);
        if (Object.keys(v).length > 0) {
            setErrors(v);
            showToast?.('error', 'Form', 'Lütfen zorunlu alanları doldurun');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                customer_full_name: form.fullName.trim(),
                customer_phone: form.phone.trim(),
                customer_address: form.address.trim(),
                fault_description: form.faultDescription.trim(),
                scheduled_date: dayjs(form.scheduledDate).format('YYYY-MM-DDTHH:mm:ss'),
                service_status: 'new',
            };
            if (form.customer?.id) payload.customer = form.customer.id;
            if (form.deviceType?.id) payload.device_type = form.deviceType.id;
            if (form.deviceBrand?.id) payload.device_brand = form.deviceBrand.id;
            if (form.deviceModel?.id) payload.device_model = form.deviceModel.id;

            const created = await serviceService.createService(payload);
            showToast?.('success', 'Talep', 'Yeni talep oluşturuldu');
            resetForm();
            bottomSheetRef.current?.dismiss();
            onCreated?.(created);
        } catch (err) {
            console.log('[NewServiceModal] submit error:', err?.message || err);
            // 422 alan bazlı hata gösterimi
            const data = err?.response?.data;
            if (data && typeof data === 'object') {
                const fieldErrors = {};
                Object.entries(data).forEach(([key, value]) => {
                    fieldErrors[key] = Array.isArray(value)
                        ? String(value[0])
                        : String(value);
                });
                setErrors((prev) => ({ ...prev, ...fieldErrors }));
            }
            showToast?.(
                'error',
                'Talep',
                'Oluşturulamadı. Alanları kontrol edin.'
            );
        } finally {
            setSubmitting(false);
        }
    }, [form, showToast, resetForm, bottomSheetRef, onCreated]);

    // ── Tarih/Saat picker handlers ──────────────────────────────────────
    const onDateChange = useCallback(
        (event, selected) => {
            setShowDatePicker(false);
            if (event?.type === 'dismissed' || !selected) return;
            const next = new Date(form.scheduledDate);
            next.setFullYear(selected.getFullYear());
            next.setMonth(selected.getMonth());
            next.setDate(selected.getDate());
            updateField('scheduledDate', next);
        },
        [form.scheduledDate, updateField]
    );

    const onTimeChange = useCallback(
        (event, selected) => {
            setShowTimePicker(false);
            if (event?.type === 'dismissed' || !selected) return;
            const next = new Date(form.scheduledDate);
            next.setHours(selected.getHours());
            next.setMinutes(selected.getMinutes());
            updateField('scheduledDate', next);
        },
        [form.scheduledDate, updateField]
    );

    const dateLabel = dayjs(form.scheduledDate).format('DD MMMM YYYY');
    const timeLabel = dayjs(form.scheduledDate).format('HH:mm');

    // ── Render: alanlar ─────────────────────────────────────────────────
    const renderInput = (key, label, opts = {}) => (
        <View style={styles.fieldWrap}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {label}
                {opts.required ? (
                    <Text style={{ color: colors.error }}> *</Text>
                ) : null}
            </Text>
            <TextInput
                value={form[key]}
                onChangeText={(t) => updateField(key, t)}
                placeholder={opts.placeholder || label}
                placeholderTextColor={colors.textTertiary}
                keyboardType={opts.keyboardType}
                multiline={opts.multiline}
                numberOfLines={opts.multiline ? 3 : 1}
                style={[
                    styles.fieldInput,
                    opts.multiline && styles.fieldInputMultiline,
                    {
                        backgroundColor: isDark
                            ? 'rgba(255,255,255,0.05)'
                            : '#F9FAFB',
                        borderColor: errors[key] ? colors.error : colors.border,
                        color: colors.text,
                        textAlignVertical: opts.multiline ? 'top' : 'center',
                    },
                ]}
            />
            {errors[key] ? (
                <Text style={[styles.errorText, { color: colors.error }]}>
                    {errors[key]}
                </Text>
            ) : null}
        </View>
    );

    // ── Müşteri seçildiğinde otomatik doldurma ─────────────────────────
    const handleCustomerPick = useCallback(
        (c) => {
            setForm((prev) => ({
                ...prev,
                customer: c,
                fullName: c.full_name || prev.fullName,
                phone: c.phone || prev.phone,
                address: c.address || prev.address,
            }));
        },
        []
    );

    return (
        <BottomSheetModal
            ref={bottomSheetRef}
            index={0}
            snapPoints={snapPoints}
            backdropComponent={renderBackdrop}
            handleComponent={null}
            enablePanDownToClose
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustResize"
            onDismiss={resetForm}
        >
            <BottomSheetView style={styles.container}>
                {/* Header */}
                <View style={styles.headerWrap}>
                    <View style={styles.handle} />
                    <View style={styles.titleRow}>
                        <View style={styles.titleBlock}>
                            <Text style={[styles.title, { color: colors.text }]}>
                                Yeni Talep
                            </Text>
                            <Text
                                style={[
                                    styles.subtitle,
                                    { color: colors.textSecondary },
                                ]}
                            >
                                Müşteri ve cihaz bilgilerini girin
                            </Text>
                        </View>
                        <Pressable
                            onPress={() => bottomSheetRef.current?.dismiss()}
                            style={({ pressed }) => [
                                styles.closeBtn,
                                {
                                    backgroundColor: isDark
                                        ? 'rgba(255,255,255,0.06)'
                                        : '#F3F4F6',
                                    borderColor: colors.border,
                                    opacity: pressed ? 0.85 : 1,
                                },
                            ]}
                            hitSlop={8}
                        >
                            <MaterialCommunityIcons
                                name="close"
                                size={18}
                                color={colors.text}
                            />
                        </Pressable>
                    </View>
                </View>

                <BottomSheetScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* MÜŞTERİ */}
                    <View style={styles.section}>
                        <SectionTitle title="Müşteri" colors={colors} />

                        <InlineSelect
                            label="Mevcut Müşteri (opsiyonel)"
                            value={form.customer?.full_name}
                            options={customers.map((c) => ({
                                id: c.id,
                                name: c.full_name || c.name || '—',
                            }))}
                            onSelect={(opt) => {
                                const c = customers.find((x) => x.id === opt.id);
                                handleCustomerPick(c);
                            }}
                            loading={customersLoading}
                        />

                        {renderInput('fullName', 'Ad Soyad', { required: true })}
                        {renderInput('phone', 'Telefon', {
                            required: true,
                            keyboardType: 'phone-pad',
                            placeholder: '05xx xxx xx xx',
                        })}
                    </View>

                    {/* ADRES */}
                    <View style={styles.section}>
                        <SectionTitle title="Adres" colors={colors} />
                        {renderInput('address', 'Adres', {
                            required: true,
                            multiline: true,
                            placeholder: 'Açık adres...',
                        })}
                    </View>

                    {/* CİHAZ */}
                    <View style={styles.section}>
                        <SectionTitle title="Cihaz" colors={colors} />

                        <InlineSelect
                            label="Cihaz Tipi"
                            value={form.deviceType?.name}
                            options={deviceTypes.map((d) => ({
                                id: d.id,
                                name: d.name,
                            }))}
                            onSelect={(opt) => {
                                const d = deviceTypes.find((x) => x.id === opt.id);
                                updateField('deviceType', d);
                            }}
                            loading={deviceTypesLoading}
                        />

                        <InlineSelect
                            label="Marka"
                            value={form.deviceBrand?.name}
                            options={brands.map((b) => ({
                                id: b.id,
                                name: b.name,
                            }))}
                            onSelect={(opt) => {
                                const b = brands.find((x) => x.id === opt.id);
                                updateField('deviceBrand', b);
                                updateField('deviceModel', null);
                            }}
                            loading={brandsLoading}
                        />

                        <InlineSelect
                            label="Model"
                            value={form.deviceModel?.name}
                            options={models.map((m) => ({
                                id: m.id,
                                name: m.name,
                            }))}
                            onSelect={(opt) => {
                                const m = models.find((x) => x.id === opt.id);
                                updateField('deviceModel', m);
                            }}
                            loading={modelsLoading}
                        />
                    </View>

                    {/* ARIZA */}
                    <View style={styles.section}>
                        <SectionTitle title="Arıza" colors={colors} />
                        {renderInput('faultDescription', 'Arıza Açıklaması', {
                            required: true,
                            multiline: true,
                            placeholder: 'Cihazda yaşanan sorunu kısaca açıklayın...',
                        })}
                    </View>

                    {/* PLANLAMA */}
                    <View style={styles.section}>
                        <SectionTitle title="Planlama" colors={colors} />
                        <View style={styles.dateRow}>
                            <Pressable
                                onPress={() => setShowDatePicker(true)}
                                style={({ pressed }) => [
                                    styles.dateBox,
                                    {
                                        backgroundColor: isDark
                                            ? 'rgba(255,255,255,0.05)'
                                            : '#F9FAFB',
                                        borderColor: colors.border,
                                        opacity: pressed ? 0.85 : 1,
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name="calendar-outline"
                                    size={16}
                                    color={colors.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.dateText,
                                        { color: colors.text },
                                    ]}
                                >
                                    {dateLabel}
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={() => setShowTimePicker(true)}
                                style={({ pressed }) => [
                                    styles.dateBox,
                                    {
                                        backgroundColor: isDark
                                            ? 'rgba(255,255,255,0.05)'
                                            : '#F9FAFB',
                                        borderColor: colors.border,
                                        opacity: pressed ? 0.85 : 1,
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name="clock-outline"
                                    size={16}
                                    color={colors.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.dateText,
                                        { color: colors.text },
                                    ]}
                                >
                                    {timeLabel}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </BottomSheetScrollView>

                {/* Sticky submit */}
                <View
                    style={[
                        styles.footer,
                        {
                            borderTopColor: colors.divider,
                            backgroundColor: colors.surface,
                        },
                    ]}
                >
                    <CustomButton
                        title={submitting ? 'Oluşturuluyor...' : 'Talebi Oluştur'}
                        onPress={handleSubmit}
                        loading={submitting}
                        disabled={submitting}
                        size="md"
                        variant="primary"
                    />
                </View>

                {showDatePicker ? (
                    <DateTimePicker
                        mode="date"
                        value={form.scheduledDate}
                        onChange={onDateChange}
                        minimumDate={new Date()}
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    />
                ) : null}

                {showTimePicker ? (
                    <DateTimePicker
                        mode="time"
                        value={form.scheduledDate}
                        onChange={onTimeChange}
                        minuteInterval={15}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    />
                ) : null}
            </BottomSheetView>
        </BottomSheetModal>
    );
}

const SectionTitle = React.memo(({ title, colors }) => (
    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {title}
    </Text>
));

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerWrap: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.s,
        paddingBottom: spacing.m,
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(150,150,150,0.4)',
        marginBottom: spacing.m,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.m,
    },
    titleBlock: {
        flex: 1,
    },
    title: {
        ...typography.h3,
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    scrollContent: {
        paddingHorizontal: spacing.gutter,
        paddingBottom: spacing.xl,
    },

    section: {
        marginBottom: spacing.l,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: spacing.s,
    },

    fieldWrap: {
        marginBottom: spacing.m,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
    },
    fieldInput: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
        paddingHorizontal: spacing.m,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        fontSize: 14,
        fontWeight: '500',
        minHeight: 44,
    },
    fieldInputMultiline: {
        minHeight: 78,
        paddingTop: 10,
        paddingBottom: 10,
    },
    fieldInputText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
    errorText: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
    },

    optionsBox: {
        marginTop: 6,
        borderRadius: 12,
        borderWidth: 1,
        maxHeight: 180,
        overflow: 'hidden',
    },
    optionsScroll: {
        maxHeight: 180,
    },
    optionsLoading: {
        padding: spacing.m,
        alignItems: 'center',
    },
    optionsEmpty: {
        padding: spacing.m,
        fontSize: 13,
        textAlign: 'center',
    },
    optionRow: {
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s + 2,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    optionText: {
        fontSize: 14,
        fontWeight: '500',
    },

    dateRow: {
        flexDirection: 'row',
        gap: spacing.s,
    },
    dateBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
        paddingHorizontal: spacing.m,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        minHeight: 44,
    },
    dateText: {
        fontSize: 13,
        fontWeight: '600',
    },

    footer: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.m,
        paddingBottom: spacing.m,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
});