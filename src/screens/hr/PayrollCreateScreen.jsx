import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import AppBottomSheet from '@/components/AppBottomSheet';
import CustomInput from '@/components/CustomInput';
import hrService from '@/services/hrService';
import technicianService from '@/services/technicianService';
import { serviceBlue, serviceGreen } from '@/theme/color';

const {
    extractPayrollFormErrors,
    getSelectedTechnicianLabel,
    getTechnicianInitials,
    technicianName,
} = require('./payrollUi');

const STATUS_OPTIONS = [
    { label: 'Taslak', value: 'draft' },
    { label: 'Onayli', value: 'approved' },
    { label: 'Odendi', value: 'paid' },
];

const firstError = (value) => {
    if (Array.isArray(value)) return value[0];
    return value || null;
};

const formatSalaryInput = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    return Number(digits).toLocaleString('tr-TR');
};

const parseSalaryValue = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    return digits ? Number(digits) : null;
};

const monthBounds = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const key = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    return { start: key(start), end: key(end) };
};

const isoDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseIsoDate = (value) => {
    if (!value) return new Date();
    const [year, month, day] = String(value).split('-').map(Number);
    const parsed = new Date(year, (month || 1) - 1, day || 1);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const monthTitle = (date) => date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

const dateLabel = (value) => {
    const parsed = parseIsoDate(value);
    return parsed.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const buildCalendarDays = (cursorDate) => {
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = (firstDay.getDay() + 6) % 7;
    const days = [];

    for (let i = 0; i < startWeekday; i += 1) {
        days.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
        days.push(new Date(year, month, day));
    }

    while (days.length % 7 !== 0) {
        days.push(null);
    }

    return days;
};

const TechnicianPickerModal = ({
    visible,
    technicians,
    selectedTechnician,
    onSelect,
    onClose,
    colors,
}) => {
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!visible) setSearch('');
    }, [visible]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return technicians;
        return technicians.filter((item) => technicianName(item).toLowerCase().includes(query));
    }, [search, technicians]);

    return (
        <AppBottomSheet
            visible={visible}
            onClose={onClose}
            snapPoints={['70%']}
            contentContainerStyle={styles.sheetModal}
            keyboardBehavior="extend"
        >
                    <View style={styles.sheetHeader}>
                        <Text style={[styles.sheetTitle, { color: colors.text }]}>Teknisyen Sec</Text>
                        <Pressable onPress={onClose} style={styles.sheetClose}>
                            <MaterialCommunityIcons name="close" size={22} color={colors.text} />
                        </Pressable>
                    </View>

                    <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="magnify" size={18} color={colors.textTertiary} />
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Teknisyen ara"
                            placeholderTextColor={colors.textTertiary}
                            style={[styles.searchInput, { color: colors.text }]}
                        />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetList}>
                        {filtered.map((technician) => {
                            const selected = selectedTechnician?.id === technician.id;
                            return (
                                <Pressable
                                    key={technician.id}
                                    onPress={() => {
                                        onSelect(technician);
                                        onClose();
                                    }}
                                    style={[
                                        styles.techRow,
                                        {
                                            backgroundColor: selected ? `${serviceBlue}10` : colors.background,
                                            borderColor: selected ? serviceBlue : colors.border,
                                        },
                                    ]}
                                >
                                    <View style={[styles.techRowAvatar, { backgroundColor: `${serviceBlue}16` }]}>
                                        <Text style={styles.techRowAvatarText}>{getTechnicianInitials(technicianName(technician))}</Text>
                                    </View>
                                    <Text style={[styles.techRowText, { color: colors.text }]} numberOfLines={1}>
                                        {technicianName(technician)}
                                    </Text>
                                    {selected && <MaterialCommunityIcons name="check-circle" size={20} color={serviceBlue} />}
                                </Pressable>
                            );
                        })}

                        {!filtered.length && (
                            <View style={[styles.emptyState, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Teknisyen bulunamadi</Text>
                                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>Farkli bir arama kelimesi deneyin.</Text>
                            </View>
                        )}
                    </ScrollView>
        </AppBottomSheet>
    );
};

const DatePickerModal = ({
    visible,
    title,
    value,
    minDate,
    onSelect,
    onClose,
    colors,
}) => {
    const [cursorDate, setCursorDate] = useState(parseIsoDate(value));

    useEffect(() => {
        if (visible) {
            setCursorDate(parseIsoDate(value));
        }
    }, [value, visible]);

    const minIso = minDate ? isoDate(parseIsoDate(minDate)) : null;
    const selectedIso = value || null;
    const days = useMemo(() => buildCalendarDays(cursorDate), [cursorDate]);

    return (
        <AppBottomSheet
            visible={visible}
            onClose={onClose}
            snapPoints={['68%']}
            contentContainerStyle={styles.sheetModal}
        >
                    <View style={styles.sheetHeader}>
                        <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
                        <Pressable onPress={onClose} style={styles.sheetClose}>
                            <MaterialCommunityIcons name="close" size={22} color={colors.text} />
                        </Pressable>
                    </View>

                    <View style={styles.calendarNav}>
                        <Pressable
                            onPress={() => setCursorDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                            style={[styles.calendarNavBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                        >
                            <MaterialCommunityIcons name="chevron-left" size={20} color={colors.text} />
                        </Pressable>
                        <Text style={[styles.calendarTitle, { color: colors.text }]}>{monthTitle(cursorDate)}</Text>
                        <Pressable
                            onPress={() => setCursorDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                            style={[styles.calendarNavBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                        >
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text} />
                        </Pressable>
                    </View>

                    <View style={styles.weekRow}>
                        {['Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt', 'Paz'].map((label) => (
                            <Text key={label} style={[styles.weekLabel, { color: colors.textSecondary }]}>{label}</Text>
                        ))}
                    </View>

                    <View style={styles.calendarGrid}>
                        {days.map((day, index) => {
                            if (!day) {
                                return <View key={`blank-${index}`} style={styles.dayCell} />;
                            }

                            const dayIso = isoDate(day);
                            const disabled = Boolean(minIso && dayIso < minIso);
                            const selected = selectedIso === dayIso;

                            return (
                                <Pressable
                                    key={dayIso}
                                    disabled={disabled}
                                    onPress={() => {
                                        onSelect(dayIso);
                                        onClose();
                                    }}
                                    style={[
                                        styles.dayCell,
                                        styles.dayButton,
                                        selected && { backgroundColor: serviceBlue },
                                        !selected && { borderColor: colors.border, borderWidth: 1 },
                                        disabled && { opacity: 0.35 },
                                    ]}
                                >
                                    <Text style={[styles.dayText, { color: selected ? '#FFFFFF' : colors.text }]}>
                                        {day.getDate()}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
        </AppBottomSheet>
    );
};

export default function PayrollCreateScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { showToast } = useToast();
    const defaults = monthBounds();
    const [technicians, setTechnicians] = useState([]);
    const [selectedTechnician, setSelectedTechnician] = useState(null);
    const [periodStart, setPeriodStart] = useState(defaults.start);
    const [periodEnd, setPeriodEnd] = useState(defaults.end);
    const [baseSalary, setBaseSalary] = useState('');
    const [status, setStatus] = useState('draft');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [showTechnicianModal, setShowTechnicianModal] = useState(false);
    const [activeDateField, setActiveDateField] = useState(null);

    const loadTechnicians = useCallback(async () => {
        setLoading(true);
        try {
            const data = await technicianService.getTechniciansList();
            const rows = Array.isArray(data) ? data : [];
            setTechnicians(rows);
            setSelectedTechnician((current) => current || rows[0] || null);
        } catch (error) {
            Alert.alert('Teknisyenler alinamadi', 'Baglantinizi kontrol edip tekrar deneyin.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTechnicians();
    }, [loadTechnicians]);

    const salaryValue = useMemo(() => parseSalaryValue(baseSalary), [baseSalary]);

    const validate = () => {
        const nextErrors = {};
        if (!selectedTechnician?.id) nextErrors.technician = 'Teknisyen secmelisin.';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart)) nextErrors.periodStart = 'Donem baslangici secilmeli.';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) nextErrors.periodEnd = 'Donem bitisi secilmeli.';
        if (periodStart && periodEnd && periodEnd < periodStart) nextErrors.periodEnd = 'Bitis baslangictan once olamaz.';
        if (baseSalary && (!Number.isFinite(salaryValue) || salaryValue < 0)) nextErrors.baseSalary = 'Gecerli bir tutar gir.';
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleDateSelect = (nextValue) => {
        setErrors((prev) => ({ ...prev, periodStart: undefined, period_start: undefined, periodEnd: undefined, period_end: undefined, general: undefined }));
        if (activeDateField === 'periodStart') {
            setPeriodStart(nextValue);
            if (periodEnd < nextValue) setPeriodEnd(nextValue);
        }
        if (activeDateField === 'periodEnd') {
            setPeriodEnd(nextValue);
        }
    };

    const handleSalaryChange = (text) => {
        setErrors((prev) => ({ ...prev, baseSalary: undefined, base_salary: undefined, general: undefined }));
        setBaseSalary(formatSalaryInput(text));
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            const payload = {
                technician: selectedTechnician.id,
                period_start: periodStart,
                period_end: periodEnd,
                status,
            };
            if (baseSalary.trim()) {
                payload.base_salary = String(salaryValue.toFixed(2));
            }
            const created = await hrService.createPayroll(payload);
            showToast('success', 'Bordro olusturuldu', 'Yeni bordro kaydi hazirlandi.');
            navigation.replace('PayrollDetail', { payrollId: created.id });
        } catch (error) {
            const parsed = extractPayrollFormErrors(error);
            setErrors({
                ...parsed.fieldErrors,
                general: parsed.generalError,
            });
            showToast('error', 'Bordro olusturulamadi', parsed.generalError);
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoider}
            >
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 }]}
                >
                <View style={styles.header}>
                    <Pressable onPress={() => navigation.goBack()} style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
                    </Pressable>
                    <View style={styles.headerText}>
                        <Text style={[styles.title, { color: colors.text }]}>Yeni Bordro</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Klasik secim akisi ile bordro hazirla</Text>
                    </View>
                    <View style={styles.headerSpacer} />
                </View>

                {loading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator color={serviceBlue} size="large" />
                    </View>
                ) : (
                    <>
                        <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            {!!errors.general && (
                                <View style={[styles.generalErrorBox, { backgroundColor: `${colors.error}12`, borderColor: `${colors.error}35` }]}>
                                    <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.error} />
                                    <Text style={[styles.generalErrorText, { color: colors.error }]}>{errors.general}</Text>
                                </View>
                            )}

                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Teknisyen</Text>
                            <Pressable
                                onPress={() => {
                                    setErrors((prev) => ({ ...prev, technician: undefined, general: undefined }));
                                    setShowTechnicianModal(true);
                                }}
                                style={[styles.selectorField, { backgroundColor: colors.background, borderColor: errors.technician ? colors.error : colors.border }]}
                            >
                                <View style={[styles.selectorAvatar, { backgroundColor: `${serviceBlue}16` }]}>
                                    <Text style={styles.selectorAvatarText}>{getTechnicianInitials(getSelectedTechnicianLabel(selectedTechnician))}</Text>
                                </View>
                                <View style={styles.selectorTextWrap}>
                                    <Text style={[styles.selectorValue, { color: colors.text }]}>
                                        {getSelectedTechnicianLabel(selectedTechnician)}
                                    </Text>
                                    <Text style={[styles.selectorHint, { color: colors.textSecondary }]}>Liste icinden sec</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-down" size={22} color={colors.textSecondary} />
                            </Pressable>
                            {!!errors.technician && <Text style={[styles.errorText, { color: colors.error }]}>{String(errors.technician)}</Text>}

                            <Text style={[styles.sectionTitle, styles.sectionSpacing, { color: colors.text }]}>Donem</Text>
                            <View style={styles.dateRow}>
                                <Pressable
                                    onPress={() => setActiveDateField('periodStart')}
                                    style={[styles.dateField, { backgroundColor: colors.background, borderColor: errors.periodStart || errors.period_start ? colors.error : colors.border }]}
                                >
                                    <MaterialCommunityIcons name="calendar-start" size={20} color={serviceBlue} />
                                    <View style={styles.dateTextWrap}>
                                        <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Baslangic</Text>
                                        <Text style={[styles.dateValue, { color: colors.text }]}>{dateLabel(periodStart)}</Text>
                                    </View>
                                </Pressable>

                                <Pressable
                                    onPress={() => setActiveDateField('periodEnd')}
                                    style={[styles.dateField, { backgroundColor: colors.background, borderColor: errors.periodEnd || errors.period_end ? colors.error : colors.border }]}
                                >
                                    <MaterialCommunityIcons name="calendar-end" size={20} color={serviceBlue} />
                                    <View style={styles.dateTextWrap}>
                                        <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Bitis</Text>
                                        <Text style={[styles.dateValue, { color: colors.text }]}>{dateLabel(periodEnd)}</Text>
                                    </View>
                                </Pressable>
                            </View>
                            {!!(errors.periodStart || errors.period_start) && <Text style={[styles.errorText, { color: colors.error }]}>{String(errors.periodStart || errors.period_start)}</Text>}
                            {!!(errors.periodEnd || errors.period_end) && <Text style={[styles.errorText, { color: colors.error }]}>{String(errors.periodEnd || errors.period_end)}</Text>}

                            <Text style={[styles.sectionTitle, styles.sectionSpacing, { color: colors.text }]}>Maas Bilgisi</Text>
                            <View style={styles.salaryFieldWrap}>
                                <Text style={[styles.salaryFieldLabel, { color: colors.textSecondary }]}>Taban maas</Text>
                                <View
                                    style={[
                                        styles.salaryField,
                                        {
                                            backgroundColor: colors.background,
                                            borderColor: errors.baseSalary || firstError(errors.base_salary) ? colors.error : colors.border,
                                        },
                                    ]}
                                >
                                    <MaterialCommunityIcons name="cash" size={20} color={serviceBlue} />
                                    <TextInput
                                        value={baseSalary}
                                        onChangeText={handleSalaryChange}
                                        placeholder=""
                                        placeholderTextColor={colors.textTertiary}
                                        keyboardType="number-pad"
                                        style={[styles.salaryInput, { color: colors.text }]}
                                    />
                                    <View style={[styles.salaryBadge, { backgroundColor: `${serviceBlue}12` }]}>
                                        <Text style={styles.salaryBadgeText}>TL</Text>
                                    </View>
                                </View>
                                {(errors.baseSalary || firstError(errors.base_salary)) ? (
                                    <Text style={[styles.errorText, { color: colors.error }]}>
                                        {errors.baseSalary || firstError(errors.base_salary)}
                                    </Text>
                                ) : null}
                            </View>

                            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Durum</Text>
                            <View style={styles.statusRow}>
                                {STATUS_OPTIONS.map((item) => {
                                    const selected = status === item.value;
                                    return (
                                        <Pressable
                                            key={item.value}
                                            onPress={() => setStatus(item.value)}
                                            style={[
                                                styles.statusChip,
                                                {
                                                    backgroundColor: selected ? serviceBlue : colors.background,
                                                    borderColor: selected ? serviceBlue : colors.border,
                                                },
                                            ]}
                                        >
                                            <Text style={[styles.statusText, { color: selected ? '#FFFFFF' : colors.text }]}>
                                                {item.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>

                        <Pressable
                            onPress={handleSubmit}
                            disabled={saving}
                            style={[styles.submitButton, { backgroundColor: serviceBlue, opacity: saving ? 0.7 : 1 }]}
                        >
                            {saving ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="file-plus-outline" size={20} color="#FFFFFF" />
                                    <Text style={styles.submitText}>Bordro Olustur</Text>
                                </>
                            )}
                        </Pressable>
                    </>
                )}
                </ScrollView>
            </KeyboardAvoidingView>

            <TechnicianPickerModal
                visible={showTechnicianModal}
                technicians={technicians}
                selectedTechnician={selectedTechnician}
                onSelect={setSelectedTechnician}
                onClose={() => setShowTechnicianModal(false)}
                colors={colors}
            />

            <DatePickerModal
                visible={Boolean(activeDateField)}
                title={activeDateField === 'periodEnd' ? 'Donem Bitisi Sec' : 'Donem Baslangici Sec'}
                value={activeDateField === 'periodEnd' ? periodEnd : periodStart}
                minDate={activeDateField === 'periodEnd' ? periodStart : null}
                onSelect={handleDateSelect}
                onClose={() => setActiveDateField(null)}
                colors={colors}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    keyboardAvoider: { flex: 1 },
    container: { paddingHorizontal: 16 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    headerText: { flex: 1, marginHorizontal: 12 },
    headerSpacer: { width: 42 },
    title: { fontSize: 24, fontWeight: '900' },
    subtitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
    loadingWrap: { paddingVertical: 80, alignItems: 'center' },
    formCard: { borderWidth: 1, borderRadius: 20, padding: 14, marginTop: 4 },
    generalErrorBox: { borderWidth: 1, borderRadius: 14, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
    generalErrorText: { flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 17 },
    sectionTitle: { fontSize: 16, fontWeight: '900', marginBottom: 10 },
    sectionSpacing: { marginTop: 2 },
    selectorField: { borderWidth: 1, borderRadius: 16, minHeight: 62, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
    selectorAvatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    selectorAvatarText: { color: serviceBlue, fontSize: 14, fontWeight: '900' },
    selectorTextWrap: { flex: 1 },
    selectorValue: { fontSize: 15, fontWeight: '800' },
    selectorHint: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    dateRow: { gap: 10 },
    dateField: { borderWidth: 1, borderRadius: 16, minHeight: 62, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    dateTextWrap: { marginLeft: 12, flex: 1 },
    dateLabel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
    dateValue: { fontSize: 15, fontWeight: '800' },
    salaryFieldWrap: { marginBottom: 16 },
    salaryFieldLabel: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
    salaryField: { minHeight: 55, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
    salaryInput: { flex: 1, fontSize: 16, fontWeight: '700', textAlign: 'right', marginLeft: 10, marginRight: 10 },
    salaryBadge: { minWidth: 42, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    salaryBadgeText: { color: serviceBlue, fontSize: 12, fontWeight: '900' },
    fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
    statusRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    statusChip: { flex: 1, borderWidth: 1, borderRadius: 13, alignItems: 'center', paddingVertical: 11 },
    statusText: { fontSize: 13, fontWeight: '800' },
    submitButton: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 16 },
    submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
    errorText: { fontSize: 12, fontWeight: '700', marginBottom: 10, marginTop: -2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.48)', justifyContent: 'flex-end' },
    sheetModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 30, maxHeight: '78%' },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
    sheetTitle: { fontSize: 18, fontWeight: '800' },
    sheetClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, minHeight: 46, marginBottom: 12 },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '600', marginLeft: 8, paddingVertical: 0 },
    sheetList: { paddingHorizontal: 16, paddingBottom: 16 },
    techRow: { borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    techRowAvatar: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    techRowAvatarText: { color: serviceBlue, fontSize: 13, fontWeight: '900' },
    techRowText: { flex: 1, fontSize: 14, fontWeight: '700' },
    emptyState: { borderWidth: 1, borderRadius: 16, padding: 18, alignItems: 'center' },
    emptyStateTitle: { fontSize: 15, fontWeight: '800' },
    emptyStateText: { fontSize: 12, fontWeight: '600', marginTop: 4 },
    calendarNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 14 },
    calendarNavBtn: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    calendarTitle: { fontSize: 17, fontWeight: '800' },
    weekRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8 },
    weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700' },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 12 },
    dayCell: { width: '14.2857%', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    dayButton: { height: 42, borderRadius: 14 },
    dayText: { fontSize: 14, fontWeight: '800' },
});
