import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceRed } from '@/theme/color';
import TechnicianPickerSheet from '@/components/home/TechnicianPickerSheet';
import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';

// ─── Sabitler ──────────────────────────────────────────────────────────────────

const MONTHS = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const toDateStr = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getPeriod = (year, monthIndex) => {
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);
    return { period_start: toDateStr(start), period_end: toDateStr(end) };
};

// ─── PayrollFormScreen ─────────────────────────────────────────────────────────

export default function PayrollFormScreen({ navigation, route }) {
    const routeParams = route?.params || {};
    const payrollId = routeParams.payrollId || null;
    const isEditMode = !!payrollId;

    const [technicianId, setTechnicianId] = useState(routeParams.technicianId || null);
    const [technicianName, setTechnicianName] = useState(routeParams.technicianName || null);
    const needsTechnicianPick = !routeParams.technicianId && !isEditMode;
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();

    // Field Hataları
    const [formErrors, setFormErrors] = useState({});

    // Dönem State
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [showMonthPicker, setShowMonthPicker] = useState(false);

    // Taban Maaş ve Özlük
    const [compensation, setCompensation] = useState(null);
    const [baseSalaryOverride, setBaseSalaryOverride] = useState('');

    // Teknisyen Seçimi
    const technicianSheetRef = useRef(null);
    const [technicians, setTechnicians] = useState([]);
    const [techLoading, setTechLoading] = useState(false);

    // Şablon Seçimi
    const templateSheetRef = useRef(null);
    const [templates, setTemplates] = useState([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [activeTemplateType, setActiveTemplateType] = useState('addition'); // 'addition' veya 'deduction'

    // Bileşenler
    const [additions, setAdditions] = useState([]); // Primler
    const [deductions, setDeductions] = useState([]); // Kesintiler
    const [nextKey, setNextKey] = useState(0);

    const [loading, setLoading] = useState(isEditMode);
    const [saving, setSaving] = useState(false);
    const [compLoading, setCompLoading] = useState(false);

    const yearOptions = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 2 + i);

    // BottomSheet Açık/Kapalı Durum Referansları
    const techSheetIndexRef = useRef(-1);
    const templateSheetIndexRef = useRef(-1);

    useEffect(() => {
        const backAction = () => {
            if (templateSheetIndexRef.current >= 0) {
                templateSheetRef.current?.close();
                return true;
            }
            if (techSheetIndexRef.current >= 0) {
                technicianSheetRef.current?.dismiss();
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );

        return () => backHandler.remove();
    }, []);

    // Düzenleme Modunda Bordro Detayını Çek
    useEffect(() => {
        if (isEditMode) {
            const loadPayrollData = async () => {
                try {
                    const res = await api.get(`${ENDPOINTS.HR.PAYROLLS}${payrollId}/`);
                    const data = res.data;
                    setTechnicianId(data.technician);
                    setTechnicianName(data.technician_name);

                    const periodDate = new Date(data.period_start);
                    setSelectedYear(periodDate.getFullYear());
                    setSelectedMonth(periodDate.getMonth());

                    setBaseSalaryOverride(Number(data.base_salary).toLocaleString('tr-TR'));

                    // Bileşenleri ayır
                    const rawComponents = data.components || [];
                    const rawAdditions = [];
                    const rawDeductions = [];
                    let maxKey = 0;

                    rawComponents.forEach((c, idx) => {
                        const item = {
                            key: idx,
                            id: c.id,
                            name: c.name,
                            amount: String(parseInt(c.amount)),
                            saveAsTemplate: false,
                        };
                        if (c.type === 'addition') {
                            rawAdditions.push(item);
                        } else {
                            rawDeductions.push(item);
                        }
                        maxKey = idx;
                    });

                    setAdditions(rawAdditions);
                    setDeductions(rawDeductions);
                    setNextKey(maxKey + 1);
                } catch (err) {
                    console.log('Load payroll error:', err?.message);
                    showToast('error', 'Hata', 'Bordro verileri yüklenemedi.');
                } finally {
                    setLoading(false);
                }
            };
            loadPayrollData();
        }
    }, [isEditMode, payrollId, showToast]);

    // Teknisyen Listesini Çek
    useEffect(() => {
        if (needsTechnicianPick) {
            setTechLoading(true);
            api.get(ENDPOINTS.TECHNICIAN.LIST)
                .then(res => {
                    const data = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
                    setTechnicians(data);
                })
                .catch(err => console.log('Tech list error:', err?.message))
                .finally(() => setTechLoading(false));
        }
    }, [needsTechnicianPick]);

    // Şablonları Çek
    const fetchTemplates = useCallback(async () => {
        setTemplatesLoading(true);
        try {
            const res = await api.get(ENDPOINTS.HR.PAYROLL_TEMPLATES, { params: { is_active: true } });
            const data = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
            setTemplates(data);
        } catch (err) {
            console.log('Templates fetch error:', err?.message);
        } finally {
            setTemplatesLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    // Seçili teknisyenin özlük bilgisini al
    const loadComp = useCallback(async (id) => {
        if (!id || isEditMode) return; // Düzenleme modunda ezmeyelim
        setCompLoading(true);
        setFormErrors(prev => ({ ...prev, technician: null }));
        try {
            const res = await api.get(ENDPOINTS.HR.COMPENSATIONS, {
                params: { technician: id },
            });
            const data = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
            const comp = data[0] || null;
            setCompensation(comp);
            if (comp?.base_salary) {
                setBaseSalaryOverride(Number(comp.base_salary).toLocaleString('tr-TR'));
            } else {
                setBaseSalaryOverride('');
            }
        } catch (err) {
            console.log('Compensation fetch error:', err?.message);
        } finally {
            setCompLoading(false);
        }
    }, [isEditMode]);

    useEffect(() => {
        if (technicianId && !isEditMode) {
            loadComp(technicianId);
        }
    }, [technicianId, loadComp, isEditMode]);

    const periodLabel = `${MONTHS[selectedMonth]} ${selectedYear}`;

    // Bileşen Ekleme/Çıkarma
    const addComponent = (type) => {
        if (type === 'addition') {
            setAdditions(prev => [...prev, { key: nextKey, name: '', amount: '', saveAsTemplate: false }]);
        } else {
            setDeductions(prev => [...prev, { key: nextKey, name: '', amount: '', saveAsTemplate: false }]);
        }
        setNextKey(k => k + 1);
    };

    const addComponentFromTemplate = (template) => {
        if (template.type === 'addition') {
            setAdditions(prev => [...prev, {
                key: nextKey,
                name: template.name,
                amount: String(parseInt(template.default_amount)),
                saveAsTemplate: false
            }]);
        } else {
            setDeductions(prev => [...prev, {
                key: nextKey,
                name: template.name,
                amount: String(parseInt(template.default_amount)),
                saveAsTemplate: false
            }]);
        }
        setNextKey(k => k + 1);
        templateSheetRef.current?.close();
        showToast('success', 'Şablon Eklendi', `"${template.name}" başarıyla listeye eklendi.`);
    };

    const removeComponent = (key, type) => {
        if (type === 'addition') {
            setAdditions(prev => prev.filter(c => c.key !== key));
        } else {
            setDeductions(prev => prev.filter(c => c.key !== key));
        }
        setFormErrors(prev => {
            const copy = { ...prev };
            delete copy[`${type}_${key}`];
            return copy;
        });
    };

    const updateComponent = (key, type, field, value) => {
        if (type === 'addition') {
            setAdditions(prev => prev.map(c => c.key === key ? { ...c, [field]: value } : c));
        } else {
            setDeductions(prev => prev.map(c => c.key === key ? { ...c, [field]: value } : c));
        }
        setFormErrors(prev => ({ ...prev, [`${type}_${key}`]: null }));
    };

    // Hesaplanan Tutarlar
    const base = parseFloat(String(baseSalaryOverride).replace(/\./g, '').replace(',', '.') || compensation?.base_salary || 0) || 0;
    const totalPremiums = additions
        .filter(c => c.amount)
        .reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
    const totalDeductions = deductions
        .filter(c => c.amount)
        .reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
    const netEstimate = base + totalPremiums - totalDeductions;

    // Kaydet
    const handleSave = useCallback(async () => {
        const errors = {};

        if (!technicianId) {
            errors.technician = 'Lütfen bir teknisyen seçiniz.';
        }

        const validAdditions = additions.filter(c => c.name.trim() || c.amount);
        const validDeductions = deductions.filter(c => c.name.trim() || c.amount);

        validAdditions.forEach(c => {
            if (!c.name.trim()) errors[`addition_${c.key}`] = 'Açıklama boş olamaz.';
            else if (!c.amount || parseFloat(c.amount) <= 0) errors[`addition_${c.key}`] = 'Tutar 0\'dan büyük olmalıdır.';
        });

        validDeductions.forEach(c => {
            if (!c.name.trim()) errors[`deduction_${c.key}`] = 'Açıklama boş olamaz.';
            else if (!c.amount || parseFloat(c.amount) <= 0) errors[`deduction_${c.key}`] = 'Tutar 0\'dan büyük olmalıdır.';
        });

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            showToast('error', 'Hata', 'Lütfen formdaki eksik veya hatalı alanları düzeltin.');
            return;
        }

        const { period_start, period_end } = getPeriod(selectedYear, selectedMonth);

        setSaving(true);
        try {
            const payrollPayload = {
                technician: technicianId,
                period_start,
                period_end,
                status: 'draft',
                base_salary: parseFloat(String(baseSalaryOverride).replace(/\./g, '')),
            };

            let activePayrollId = payrollId;

            if (isEditMode) {
                // 1. Bordroyu Güncelle
                await api.patch(`${ENDPOINTS.HR.PAYROLLS}${payrollId}/`, payrollPayload);

                // 2. Eski bileşenleri temizle (is_manual olanlar)
                const currentCompsRes = await api.get(ENDPOINTS.HR.PAYROLL_COMPONENTS, { params: { payroll: payrollId } });
                const currentComps = Array.isArray(currentCompsRes.data) ? currentCompsRes.data : (currentCompsRes.data?.results || []);
                for (const comp of currentComps) {
                    await api.delete(`${ENDPOINTS.HR.PAYROLL_COMPONENTS}${comp.id}/`);
                }
            } else {
                // Yeni Bordro Oluştur
                const payrollRes = await api.post(ENDPOINTS.HR.PAYROLLS, payrollPayload);
                activePayrollId = payrollRes?.data?.id;
            }

            if (!activePayrollId) throw new Error('Bordro ID alınamadı.');

            // Yeni Primleri Kaydet
            for (const comp of validAdditions) {
                await api.post(ENDPOINTS.HR.PAYROLL_COMPONENTS, {
                    payroll: activePayrollId,
                    name: comp.name.trim(),
                    amount: parseFloat(comp.amount),
                    type: 'addition',
                    is_manual: true,
                });

                if (comp.saveAsTemplate) {
                    try {
                        await api.post(ENDPOINTS.HR.PAYROLL_TEMPLATES, {
                            name: comp.name.trim(),
                            type: 'addition',
                            default_amount: parseFloat(comp.amount),
                            is_active: true,
                        });
                    } catch (e) {
                        console.log('Template auto-save failed:', e?.message);
                    }
                }
            }

            // Yeni Kesintileri Kaydet
            for (const comp of validDeductions) {
                await api.post(ENDPOINTS.HR.PAYROLL_COMPONENTS, {
                    payroll: activePayrollId,
                    name: comp.name.trim(),
                    amount: parseFloat(comp.amount),
                    type: 'deduction',
                    is_manual: true,
                });

                if (comp.saveAsTemplate) {
                    try {
                        await api.post(ENDPOINTS.HR.PAYROLL_TEMPLATES, {
                            name: comp.name.trim(),
                            type: 'deduction',
                            default_amount: parseFloat(comp.amount),
                            is_active: true,
                        });
                    } catch (e) {
                        console.log('Template auto-save failed:', e?.message);
                    }
                }
            }

            showToast('success', 'Başarılı', isEditMode ? 'Bordro başarıyla güncellendi.' : 'Bordro başarıyla oluşturuldu.');
            if (route?.params?.onSuccess) {
                route.params.onSuccess();
            }
            navigation.goBack();
        } catch (err) {
            console.error(err);
            const data = err?.response?.data;
            const backendErrors = {};
            if (data && typeof data === 'object') {
                for (const [key, val] of Object.entries(data)) {
                    if (key === 'technician') backendErrors.technician = Array.isArray(val) ? val[0] : val;
                    else if (key === 'period_start') backendErrors.period = `Dönem Başlangıcı: ${Array.isArray(val) ? val[0] : val}`;
                    else if (key === 'period_end') backendErrors.period = `Dönem Bitişi: ${Array.isArray(val) ? val[0] : val}`;
                    else backendErrors.general = Array.isArray(val) ? val[0] : val;
                }
            } else {
                backendErrors.general = isEditMode ? 'Bordro güncellenemedi.' : 'Bordro oluşturulamadı.';
            }
            setFormErrors(backendErrors);
            showToast('error', 'Hata', backendErrors.general || 'Formda hata oluştu.');
        } finally {
            setSaving(false);
        }
    }, [technicianId, selectedYear, selectedMonth, baseSalaryOverride, additions, deductions, showToast, navigation, route, isEditMode, payrollId]);

    const bg = isDark ? '#0D1117' : '#F4F7FB';
    const cardBg = colors.surface;
    const border = colors.border;

    const filteredTemplates = useMemo(() => {
        return templates.filter(t => t.type === activeTemplateType);
    }, [templates, activeTemplateType]);

    const openTemplateSelector = (type) => {
        setActiveTemplateType(type);
        templateSheetRef.current?.expand();
    };

    const renderBackdrop = useCallback(
        (props) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                opacity={0.5}
                pressBehavior="close"
            />
        ),
        []
    );

    if (loading) {
        return (
            <WrapperContainer>
                <Header title={isEditMode ? "Bordro Düzenle" : "Yeni Bordro"} showBack borderBottom />
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={serviceBlue} />
                </View>
            </WrapperContainer>
        );
    }

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES}>
            <KeyboardAvoidingView
                style={[styles.screen, { backgroundColor: bg }]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
            >
                <Header
                    title={isEditMode ? "Bordro Düzenle" : "Yeni Bordro"}
                    subtitle={technicianName || 'Bordro Detayları'}
                    showBack
                    borderBottom
                />

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 160 }]}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    {formErrors.general && (
                        <View style={styles.errorBanner}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#FFF" />
                            <Text style={styles.errorBannerText}>{formErrors.general}</Text>
                        </View>
                    )}

                    {/* ── Teknisyen Seçimi ── */}
                    <View style={[styles.card, { backgroundColor: cardBg, borderColor: formErrors.technician ? serviceRed : border }]}>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Teknisyen *</Text>
                        {needsTechnicianPick ? (
                            <Pressable
                                onPress={() => {
                                    setFormErrors(prev => ({ ...prev, technician: null }));
                                    technicianSheetRef.current?.present();
                                }}
                                style={({ pressed }) => [
                                    styles.pickerButton,
                                    { borderColor: formErrors.technician ? serviceRed : border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFF' },
                                    pressed && { opacity: 0.8 }
                                ]}
                            >
                                <View style={[styles.pickerAvatar, { backgroundColor: `${serviceBlue}12` }]}>
                                    <Text style={[styles.pickerAvatarText, { color: serviceBlue }]}>
                                        {technicianId ? technicianName?.slice(0, 2).toUpperCase() : 'TK'}
                                    </Text>
                                </View>
                                <Text style={[styles.pickerName, { color: technicianId ? colors.text : colors.textTertiary }]}>
                                    {technicianName || 'Teknisyen Seçiniz...'}
                                </Text>
                                <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
                            </Pressable>
                        ) : (
                            <View style={styles.staticTech}>
                                <View style={[styles.pickerAvatar, { backgroundColor: `${serviceBlue}12` }]}>
                                    <Text style={[styles.pickerAvatarText, { color: serviceBlue }]}>
                                        {technicianName?.slice(0, 2).toUpperCase() || 'TK'}
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.staticTechName, { color: colors.text }]}>{technicianName}</Text>
                                    <Text style={[styles.staticTechSub, { color: colors.textSecondary }]}>
                                        {isEditMode ? 'Bordrosu Düzenlenen Teknisyen' : 'Seçili Teknisyen'}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {formErrors.technician && (
                            <Text style={styles.errorText}>{formErrors.technician}</Text>
                        )}
                    </View>

                    {/* ── Dönem Seçimi ── */}
                    <View style={[styles.card, { backgroundColor: cardBg, borderColor: formErrors.period ? serviceRed : border }]}>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Dönem Seçimi</Text>
                        <Pressable
                            onPress={() => setShowMonthPicker(!showMonthPicker)}
                            style={[styles.pickerButton, { borderColor: formErrors.period ? serviceRed : border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFF' }]}
                        >
                            <MaterialCommunityIcons name="calendar-month-outline" size={18} color={serviceBlue} />
                            <Text style={[styles.pickerName, { color: colors.text, flex: 1, marginLeft: 8 }]}>
                                {periodLabel}
                            </Text>
                            <MaterialCommunityIcons name={showMonthPicker ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
                        </Pressable>

                        {formErrors.period && (
                            <Text style={styles.errorText}>{formErrors.period}</Text>
                        )}

                        {showMonthPicker && (
                            <View style={[styles.pickerGridContainer, { borderColor: border }]}>
                                <View style={styles.yearSelector}>
                                    {yearOptions.map(y => (
                                        <Pressable
                                            key={y}
                                            onPress={() => setSelectedYear(y)}
                                            style={[
                                                styles.yearChip,
                                                { borderColor: selectedYear === y ? serviceBlue : border, backgroundColor: selectedYear === y ? `${serviceBlue}12` : 'transparent' }
                                            ]}
                                        >
                                            <Text style={{ color: selectedYear === y ? serviceBlue : colors.text, fontWeight: '700', fontSize: 13 }}>{y}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                                <View style={styles.monthGrid}>
                                    {MONTHS.map((m, idx) => (
                                        <Pressable
                                            key={m}
                                            onPress={() => { setSelectedMonth(idx); setShowMonthPicker(false); }}
                                            style={[
                                                styles.monthCell,
                                                { borderColor: selectedMonth === idx ? serviceBlue : border, backgroundColor: selectedMonth === idx ? `${serviceBlue}12` : 'transparent' }
                                            ]}
                                        >
                                            <Text style={{ color: selectedMonth === idx ? serviceBlue : colors.text, fontSize: 12, fontWeight: '600' }}>
                                                {m.slice(0, 3)}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>

                    {/* ── Taban Maaş ── */}
                    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Taban Maaş (₺)</Text>
                        <View style={[styles.inputContainer, { borderColor: border }]}>
                            <MaterialCommunityIcons name="currency-try" size={18} color={colors.textSecondary} />
                            <TextInput
                                style={[styles.input, { color: colors.text }]}
                                value={baseSalaryOverride}
                                onChangeText={(val) => {
                                    const cleaned = val.replace(/[^0-9]/g, '');
                                    setBaseSalaryOverride(cleaned ? Number(cleaned).toLocaleString('tr-TR') : '');
                                }}
                                placeholder="Maaş giriniz"
                                placeholderTextColor={colors.textTertiary}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    {/* ── 1. Primler (Additions) ── */}
                    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[styles.cardTitle, { color: serviceGreen }]}>Primler (+)</Text>
                            <Pressable
                                onPress={() => openTemplateSelector('addition')}
                                style={({ pressed }) => [
                                    styles.templateSelectBtn,
                                    { borderColor: `${serviceGreen}60` },
                                    pressed && { opacity: 0.8 }
                                ]}
                            >
                                <MaterialCommunityIcons name="folder-text-outline" size={14} color={serviceGreen} />
                                <Text style={{ color: serviceGreen, fontSize: 11, fontWeight: '700' }}>Şablondan Seç</Text>
                            </Pressable>
                        </View>

                        {additions.length === 0 ? (
                            <Text style={[styles.emptyLabel, { color: colors.textTertiary }]}>Henüz prim eklenmedi.</Text>
                        ) : (
                            additions.map(comp => {
                                const error = formErrors[`addition_${comp.key}`];
                                return (
                                    <View key={comp.key} style={[styles.compBox, { borderColor: error ? serviceRed : border, backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : '#FAFBFD' }]}>
                                        <View style={styles.compTypeRow}>
                                            <Text style={{ color: serviceGreen, fontWeight: '800', fontSize: 12 }}>Prim Kalemi</Text>
                                            <Pressable onPress={() => removeComponent(comp.key, 'addition')} style={styles.removeBtn}>
                                                <MaterialCommunityIcons name="delete-outline" size={18} color={serviceRed} />
                                            </Pressable>
                                        </View>
                                        <View style={styles.compInputRow}>
                                            <TextInput
                                                style={[styles.compInputText, { borderColor: border, color: colors.text }]}
                                                placeholder="Açıklama (örn: Yemek Yardımı)"
                                                placeholderTextColor={colors.textTertiary}
                                                value={comp.name}
                                                onChangeText={v => updateComponent(comp.key, 'addition', 'name', v)}
                                            />
                                            <View style={[styles.compAmountInput, { borderColor: border }]}>
                                                <Text style={{ color: colors.textSecondary, fontSize: 13, marginRight: 2 }}>₺</Text>
                                                <TextInput
                                                    style={[styles.compAmountText, { color: colors.text }]}
                                                    placeholder="Tutar"
                                                    placeholderTextColor={colors.textTertiary}
                                                    keyboardType="numeric"
                                                    value={comp.amount}
                                                    onChangeText={v => updateComponent(comp.key, 'addition', 'amount', v)}
                                                />
                                            </View>
                                        </View>

                                        {error && <Text style={styles.errorText}>{error}</Text>}

                                        <View style={styles.saveTemplateSwitchRow}>
                                            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                                                Bu kalemi kalıcı şablon olarak kaydet
                                            </Text>
                                            <Switch
                                                value={comp.saveAsTemplate || false}
                                                onValueChange={v => updateComponent(comp.key, 'addition', 'saveAsTemplate', v)}
                                                trackColor={{ false: '#767577', true: serviceGreen }}
                                                thumbColor={comp.saveAsTemplate ? '#fff' : '#f4f3f4'}
                                                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                            />
                                        </View>
                                    </View>
                                );
                            })
                        )}

                        <Pressable
                            onPress={() => addComponent('addition')}
                            style={[styles.addBtnSolo, { borderColor: `${serviceGreen}40`, backgroundColor: `${serviceGreen}08` }]}
                        >
                            <MaterialCommunityIcons name="plus" size={15} color={serviceGreen} />
                            <Text style={[styles.addBtnText, { color: serviceGreen }]}>Prim Kalemi Ekle</Text>
                        </Pressable>
                    </View>

                    {/* ── 2. Kesintiler (Deductions) ── */}
                    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[styles.cardTitle, { color: serviceRed }]}>Kesintiler (-)</Text>
                            <Pressable
                                onPress={() => openTemplateSelector('deduction')}
                                style={({ pressed }) => [
                                    styles.templateSelectBtn,
                                    { borderColor: `${serviceRed}60` },
                                    pressed && { opacity: 0.8 }
                                ]}
                            >
                                <MaterialCommunityIcons name="folder-text-outline" size={14} color={serviceRed} />
                                <Text style={{ color: serviceRed, fontSize: 11, fontWeight: '700' }}>Şablondan Seç</Text>
                            </Pressable>
                        </View>

                        {deductions.length === 0 ? (
                            <Text style={[styles.emptyLabel, { color: colors.textTertiary }]}>Henüz kesinti eklenmedi.</Text>
                        ) : (
                            deductions.map(comp => {
                                const error = formErrors[`deduction_${comp.key}`];
                                return (
                                    <View key={comp.key} style={[styles.compBox, { borderColor: error ? serviceRed : border, backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : '#FAFBFD' }]}>
                                        <View style={styles.compTypeRow}>
                                            <Text style={{ color: serviceRed, fontWeight: '800', fontSize: 12 }}>Kesinti Kalemi</Text>
                                            <Pressable onPress={() => removeComponent(comp.key, 'deduction')} style={styles.removeBtn}>
                                                <MaterialCommunityIcons name="delete-outline" size={18} color={serviceRed} />
                                            </Pressable>
                                        </View>
                                        <View style={styles.compInputRow}>
                                            <TextInput
                                                style={[styles.compInputText, { borderColor: border, color: colors.text }]}
                                                placeholder="Açıklama (örn: Avans)"
                                                placeholderTextColor={colors.textTertiary}
                                                value={comp.name}
                                                onChangeText={v => updateComponent(comp.key, 'deduction', 'name', v)}
                                            />
                                            <View style={[styles.compAmountInput, { borderColor: border }]}>
                                                <Text style={{ color: colors.textSecondary, fontSize: 13, marginRight: 2 }}>₺</Text>
                                                <TextInput
                                                    style={[styles.compAmountText, { color: colors.text }]}
                                                    placeholder="Tutar"
                                                    placeholderTextColor={colors.textTertiary}
                                                    keyboardType="numeric"
                                                    value={comp.amount}
                                                    onChangeText={v => updateComponent(comp.key, 'deduction', 'amount', v)}
                                                />
                                            </View>
                                        </View>

                                        {error && <Text style={styles.errorText}>{error}</Text>}

                                        <View style={styles.saveTemplateSwitchRow}>
                                            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                                                Bu kalemi kalıcı şablon olarak kaydet
                                            </Text>
                                            <Switch
                                                value={comp.saveAsTemplate || false}
                                                onValueChange={v => updateComponent(comp.key, 'deduction', 'saveAsTemplate', v)}
                                                trackColor={{ false: '#767577', true: serviceRed }}
                                                thumbColor={comp.saveAsTemplate ? '#fff' : '#f4f3f4'}
                                                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                            />
                                        </View>
                                    </View>
                                );
                            })
                        )}

                        <Pressable
                            onPress={() => addComponent('deduction')}
                            style={[styles.addBtnSolo, { borderColor: `${serviceRed}40`, backgroundColor: `${serviceRed}08` }]}
                        >
                            <MaterialCommunityIcons name="minus" size={15} color={serviceRed} />
                            <Text style={[styles.addBtnText, { color: serviceRed }]}>Kesinti Kalemi Ekle</Text>
                        </Pressable>
                    </View>

                    {/* ── Özet Kartı ── */}
                    <View style={[styles.summaryCard, { backgroundColor: isDark ? `${serviceBlue}14` : '#EFF6FF', borderColor: `${serviceBlue}30` }]}>
                        <Text style={[styles.summaryTitle, { color: colors.textSecondary }]}>Tahmini Net Maaş</Text>
                        <Text style={[styles.summaryValue, { color: colors.text }]}>
                            ₺{netEstimate.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </Text>

                        <View style={[styles.divider, { backgroundColor: border }]} />

                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Taban Maaş</Text>
                            <Text style={[styles.detailValue, { color: colors.text }]}>₺{base.toLocaleString('tr-TR')}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Ek Primler</Text>
                            <Text style={[styles.detailValue, { color: serviceGreen }]}>+₺{totalPremiums.toLocaleString('tr-TR')}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Kesintiler</Text>
                            <Text style={[styles.detailValue, { color: serviceRed }]}>-₺{totalDeductions.toLocaleString('tr-TR')}</Text>
                        </View>
                    </View>

                    {/* ── Kaydet / Güncelle Butonu ── */}
                    <Pressable
                        onPress={handleSave}
                        disabled={saving || compLoading}
                        style={({ pressed }) => [
                            styles.saveBtn,
                            { backgroundColor: serviceBlue },
                            (saving || pressed || compLoading) && { opacity: 0.8 }
                        ]}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="check" size={18} color="#FFF" style={{ marginRight: 6 }} />
                                <Text style={styles.saveBtnText}>{isEditMode ? 'Bordroyu Güncelle' : 'Bordro Kaydet'}</Text>
                            </>
                        )}
                    </Pressable>
                </ScrollView>

                <TechnicianPickerSheet
                    ref={technicianSheetRef}
                    technicians={technicians}
                    loading={techLoading}
                    includeUnassigned={false}
                    selectedTechnicianId={technicianId}
                    onSelect={(item) => {
                        const fullName = `${item.user?.first_name || ''} ${item.user?.last_name || ''}`.trim() || item.user?.email || 'Teknisyen';
                        setTechnicianId(item?.id || null);
                        setTechnicianName(fullName);
                        technicianSheetRef.current?.dismiss();
                    }}
                />

                <BottomSheet
                    ref={templateSheetRef}
                    index={-1}
                    snapPoints={['55%']}
                    enablePanDownToClose
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ backgroundColor: colors.surface }}
                    handleIndicatorStyle={{ backgroundColor: colors.textTertiary }}
                    onChange={(index) => { templateSheetIndexRef.current = index; }}
                >
                    <BottomSheetView style={[styles.sheetContent, { flex: 1, paddingBottom: insets.bottom + 10 }]}>
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetTitle, { color: colors.text }]}>
                                {activeTemplateType === 'addition' ? 'Prim Şablonları' : 'Kesinti Şablonları'}
                            </Text>
                            <Pressable onPress={() => templateSheetRef.current?.close()}>
                                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                            </Pressable>
                        </View>

                        {templatesLoading ? (
                            <ActivityIndicator size="small" color={serviceBlue} style={{ marginTop: 20 }} />
                        ) : filteredTemplates.length === 0 ? (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={[styles.emptyLabel, { color: colors.textTertiary }]}>Kayıtlı aktif şablon bulunamadı.</Text>
                            </View>
                        ) : (
                            <BottomSheetScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                                {filteredTemplates.map(tmpl => (
                                    <Pressable
                                        key={tmpl.id}
                                        onPress={() => addComponentFromTemplate(tmpl)}
                                        style={({ pressed }) => [
                                            styles.templateItem,
                                            { borderColor: border },
                                            pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }
                                        ]}
                                    >
                                        <View style={[
                                            styles.tmplBadge,
                                            { backgroundColor: tmpl.type === 'addition' ? `${serviceGreen}12` : `${serviceRed}12` }
                                        ]}>
                                            <MaterialCommunityIcons
                                                name={tmpl.type === 'addition' ? 'plus' : 'minus'}
                                                size={12}
                                                color={tmpl.type === 'addition' ? serviceGreen : serviceRed}
                                            />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.tmplName, { color: colors.text }]}>{tmpl.name}</Text>
                                            <Text style={[styles.tmplType, { color: colors.textSecondary }]}>
                                                {tmpl.type === 'addition' ? 'Prim Şablonu' : 'Kesinti Şablonu'}
                                            </Text>
                                        </View>
                                        <Text style={[styles.tmplAmount, { color: colors.text }]}>
                                            ₺{Number(tmpl.default_amount).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                                        </Text>
                                    </Pressable>
                                ))}
                            </BottomSheetScrollView>
                        )}
                    </BottomSheetView>
                </BottomSheet>
            </KeyboardAvoidingView>
        </WrapperContainer>
    );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    screen: { flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        gap: 12,
    },
    cardTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
    emptyLabel: { fontSize: 12, textAlign: 'center', paddingVertical: 8 },

    // Teknisyen Seçici düğmesi
    pickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        height: 48,
    },
    pickerAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    pickerAvatarText: { fontSize: 12, fontWeight: '700' },
    pickerName: { flex: 1, fontSize: 14, fontWeight: '600', marginLeft: 10 },

    staticTech: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    staticTechName: { fontSize: 14, fontWeight: '700' },
    staticTechSub: { fontSize: 11, marginTop: 1 },

    compInfoBox: {
        borderRadius: 10,
        borderWidth: 1,
        padding: 8,
        marginTop: 4,
    },
    compInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    compInfoText: { fontSize: 11 },

    // Dönem Grid
    pickerGridContainer: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        gap: 10,
        marginTop: 4,
    },
    yearSelector: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
    yearChip: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
    monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    monthCell: { width: '23%', borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },

    // Girdi alanları
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 44,
    },
    input: { flex: 1, fontSize: 14, fontWeight: '600', marginLeft: 8 },

    // Şablondan Seç Butonu
    templateSelectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
    },

    // Bileşen kartları
    compBox: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
        gap: 8,
        marginBottom: 4,
    },
    compTypeRow: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'space-between' },
    removeBtn: { padding: 4 },
    compInputRow: { flexDirection: 'row', gap: 8 },
    compInputText: {
        flex: 2,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 8,
        fontSize: 12,
        height: 38,
    },
    compAmountInput: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 6,
        height: 38,
    },
    compAmountText: { flex: 1, fontSize: 13, fontWeight: '600' },

    // Switch row
    saveTemplateSwitchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 2,
        paddingTop: 4,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },

    addBtnSolo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        marginTop: 6,
    },
    addBtnText: { fontSize: 12, fontWeight: '800' },

    // Özet kartı
    summaryCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        alignItems: 'center',
        gap: 4,
    },
    summaryTitle: { fontSize: 11, fontWeight: '600' },
    summaryValue: { fontSize: 24, fontWeight: '800', marginVertical: 4 },
    divider: { height: StyleSheet.hairlineWidth, width: '100%', marginVertical: 8 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 2 },
    detailLabel: { fontSize: 11 },
    detailValue: { fontSize: 11, fontWeight: '700' },

    // Kaydet Düğmesi
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        height: 48,
        marginTop: 10,
    },
    saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

    // BottomSheet Content
    sheetContent: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 14,
    },
    sheetTitle: { fontSize: 15, fontWeight: '800' },
    templateItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderWidth: 1,
        borderRadius: 10,
        marginBottom: 8,
        width: '100%',
    },
    tmplBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tmplName: { fontSize: 13, fontWeight: '700' },
    tmplType: { fontSize: 11, marginTop: 1 },
    tmplAmount: { fontSize: 14, fontWeight: '800' },

    // Hata Tasarımları
    errorText: {
        color: serviceRed,
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: serviceRed,
        borderRadius: 12,
        padding: 12,
        marginBottom: 6,
    },
    errorBannerText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
        flex: 1,
    },
});
