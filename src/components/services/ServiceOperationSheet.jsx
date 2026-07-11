import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
    KeyboardAvoidingView,
    Platform,
    Modal,
    ScrollView,
} from 'react-native';
import { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import AppBottomSheet from '@/components/AppBottomSheet';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { spacing } from '@/theme/spacing';

const parseError = (error, fallback) => {
    const detail = error?.response?.data;
    if (typeof detail === 'string') return detail;
    if (detail?.detail) return detail.detail;
    if (detail?.error) return detail.error;
    if (detail && typeof detail === 'object') {
        const firstValue = Object.values(detail)[0];
        if (Array.isArray(firstValue)) return String(firstValue[0]);
        if (typeof firstValue === 'string') return firstValue;
    }
    return fallback;
};

const formatAmountDisplay = (val) => {
    if (!val) return '';
    // Sadece rakamları al
    const clean = val.replace(/\D/g, '');
    if (!clean) return '';
    // Binlik ayırıcı ekle (nokta)
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parseAmount = (formattedVal) => {
    if (!formattedVal) return 0;
    return Number(String(formattedVal).replace(/\./g, ''));
};

const sanitizeNumber = (value) => String(value || '').replace(/[^\d.,]/g, '').replace(',', '.');

// ─── Dropdown Select Bileşeni (Açılan Alt Sheet Modal Yapısı) ──────────────────────────────────────────────────

function SelectField({ label, value, options, onSelect, placeholder, colors, isDark, loading }) {
    const [modalVisible, setModalVisible] = useState(false);
    const selected = options.find(o => o.value === value) || null;

    return (
        <View style={sfStyles.wrap}>
            <Text style={[sfStyles.label, { color: colors.textSecondary }]}>{label}</Text>
            {loading ? (
                <View style={[sfStyles.trigger, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff', justifyContent: 'flex-start', gap: 8 }]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[sfStyles.triggerText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
                </View>
            ) : (
                <Pressable
                    onPress={() => setModalVisible(true)}
                    style={({ pressed }) => [
                        sfStyles.trigger,
                        {
                            borderColor: colors.border,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                            opacity: pressed ? 0.9 : 1,
                        },
                    ]}
                >
                    <Text
                        style={[sfStyles.triggerText, { color: selected ? colors.text : colors.textSecondary }]}
                        numberOfLines={1}
                    >
                        {selected ? selected.label : placeholder}
                    </Text>
                    <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={colors.textSecondary}
                    />
                </Pressable>
            )}

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <Pressable 
                    style={sfStyles.modalOverlay} 
                    onPress={() => setModalVisible(false)}
                >
                    <View style={[sfStyles.modalContainer, { backgroundColor: isDark ? colors.surface : '#FFFFFF' }]}>
                        <View style={sfStyles.modalHeader}>
                            <Text style={[sfStyles.modalTitle, { color: colors.text }]}>{label}</Text>
                            <Pressable onPress={() => setModalVisible(false)} hitSlop={8}>
                                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                            </Pressable>
                        </View>
                        
                        <ScrollView 
                            contentContainerStyle={sfStyles.scrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {options.length > 0 ? (
                                <View style={sfStyles.optionList}>
                                    {options.map(opt => {
                                        const active = opt.value === value;
                                        return (
                                            <Pressable
                                                key={String(opt.value)}
                                                onPress={() => { onSelect(opt.value, opt); setModalVisible(false); }}
                                                style={({ pressed }) => [
                                                    sfStyles.option,
                                                    {
                                                        backgroundColor: active
                                                            ? 'rgba(37,99,235,0.10)'
                                                            : isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                                                        borderColor: active ? '#2563EB' : colors.border,
                                                        opacity: pressed ? 0.85 : 1,
                                                    },
                                                ]}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[sfStyles.optionText, { color: active ? '#2563EB' : colors.text }]} numberOfLines={1}>
                                                        {opt.label}
                                                    </Text>
                                                    {opt.meta ? (
                                                        <Text style={[sfStyles.optionMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                                                            {opt.meta}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                                {active && <MaterialCommunityIcons name="check-circle" size={20} color="#2563EB" />}
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            ) : (
                                <View style={sfStyles.emptyOption}>
                                    <Text style={[sfStyles.emptyText, { color: colors.textSecondary }]}>Seçenek bulunamadı.</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const sfStyles = StyleSheet.create({
    wrap: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1.5,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,
        gap: 8,
    },
    triggerText: { flex: 1, fontSize: 14, fontWeight: '500' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 16,
        paddingTop: 8,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.08)',
    },
    modalTitle: { fontSize: 16, fontWeight: '800' },
    scrollContent: {
        paddingVertical: 16,
        paddingBottom: 80,
    },
    optionList: { gap: 10 },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderRadius: 12,
        gap: 8,
    },
    optionText: { fontSize: 14, fontWeight: '700' },
    optionMeta: { fontSize: 11, marginTop: 2 },
    emptyOption: { padding: 16 },
    emptyText: { fontSize: 13, fontWeight: '500' },
});

// ─── Ana Bileşen ────────────────────────────────────────────────────────────────

export default function ServiceOperationSheet({
    visible,
    onClose,
    service,
    templates = [],
    templatesLoading = false,
    products = [],
    productsLoading = false,
    operation = null,
    onSubmit,
    onDelete,
    onSaveTemplate,
}) {
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [selectedProductId, setSelectedProductId] = useState(null);
    const [activeTab, setActiveTab] = useState('template'); // 'template' | 'product'
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [unitPrice, setUnitPrice] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [savingTemplate, setSavingTemplate] = useState(false);

    const isEditMode = Boolean(operation?.id);

    useEffect(() => {
        if (!visible) {
            setSelectedTemplateId(null);
            setSelectedProductId(null);
            setActiveTab('template');
            setName('');
            setDescription('');
            setQuantity('1');
            setUnitPrice('');
            setSubmitting(false);
            setSavingTemplate(false);
            return;
        }

        if (operation?.id) {
            setSelectedTemplateId(null);
            setSelectedProductId(null);
            setName(operation?.name || operation?.operation_name || '');
            setDescription(operation?.description || '');
            setQuantity(operation?.quantity ? String(operation.quantity) : '1');
            const unitVal = operation?.unit_price !== null && operation?.unit_price !== undefined ? Math.round(Number(operation.unit_price)) : 0;
            setUnitPrice(unitVal > 0 ? formatAmountDisplay(String(unitVal)) : '');
            return;
        }

        setSelectedTemplateId(null);
        setSelectedProductId(null);
        setActiveTab('template');
        setName('');
        setDescription('');
        setQuantity('1');
        setUnitPrice('');
    }, [visible, operation]);

    // Template options for the select dropdown
    const templateOptions = useMemo(
        () =>
            templates.map(t => ({
                value: t.id,
                label: t.name || 'İşlem',
                meta: t.default_unit_price != null
                    ? `${Number(t.default_unit_price).toFixed(2)} TL`
                    : null,
                _template: t,
            })),
        [templates]
    );

    // Product options for the select dropdown
    const productOptions = useMemo(
        () =>
            products.map(p => ({
                value: p.id,
                label: p.name || 'Ürün',
                meta: p.sale_price != null
                    ? `${Number(p.sale_price).toFixed(2)} TL (Stok: ${p.stock_quantity ?? 0})`
                    : `Stok: ${p.stock_quantity ?? 0}`,
                _product: p,
            })),
        [products]
    );

    const handleTemplateSelect = (id, opt) => {
        setSelectedTemplateId(id);
        setSelectedProductId(null); // template seçilirse ürün seçimini temizle
        const template = opt?._template || templates.find(t => t.id === id);
        if (template) {
            setName(template.name || '');
            setDescription(template.description || '');
            const defaultPriceVal = template.default_unit_price !== null && template.default_unit_price !== undefined
                ? Math.round(Number(template.default_unit_price))
                : 0;
            setUnitPrice(defaultPriceVal > 0 ? formatAmountDisplay(String(defaultPriceVal)) : '');
        }
    };

    const handleProductSelect = (id, opt) => {
        setSelectedProductId(id);
        setSelectedTemplateId(null); // ürün seçilirse şablon seçimini temizle
        const product = opt?._product || products.find(p => p.id === id);
        if (product) {
            setName(product.name || '');
            setDescription(product.description || '');
            const salePriceVal = product.sale_price !== null && product.sale_price !== undefined
                ? Math.round(Number(product.sale_price))
                : 0;
            setUnitPrice(salePriceVal > 0 ? formatAmountDisplay(String(salePriceVal)) : '');
        }
    };

    const buildPayload = () => {
        const resolvedName = String(name || '').trim();
        const resolvedDescription = String(description || '').trim();
        const resolvedQuantity = Math.max(parseInt(quantity, 10) || 0, 0);
        const parsedUnitPrice = parseAmount(unitPrice);

        if (!service?.id) throw new Error('Servis kaydı bulunamadı.');
        if (!resolvedName && !resolvedDescription) throw new Error('İşlem adı veya açıklama girin.');
        if (resolvedQuantity <= 0) throw new Error('Adet 1 veya daha büyük olmalı.');
        if (Number.isNaN(parsedUnitPrice) || parsedUnitPrice < 0) throw new Error('Geçerli bir birim ücret girin.');

        return {
            service: service.id,
            name: resolvedName || resolvedDescription,
            description: resolvedDescription,
            quantity: resolvedQuantity,
            unit_price: parsedUnitPrice,
        };
    };

    const handleSubmit = async () => {
        try {
            const payload = buildPayload();
            setSubmitting(true);
            await onSubmit?.(payload, operation);
            onClose?.();
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : parseError(error, 'İşlem kaydedilemedi.');
            showToast('error', 'Hata', message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveTemplate = async () => {
        try {
            const payload = buildPayload();
            setSavingTemplate(true);
            await onSaveTemplate?.({
                name: payload.name,
                description: payload.description,
                default_unit_price: payload.unit_price,
                is_active: true,
            });
            showToast('success', 'Kayıtlı İşlem', 'İşlem kayıtlı işlemlere eklendi.');
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : parseError(error, 'İşlem kaydedilemedi.');
            showToast('error', 'Hata', message);
        } finally {
            setSavingTemplate(false);
        }
    };

    const handleDelete = async () => {
        if (!operation?.id || !onDelete) return;
        try {
            setSubmitting(true);
            await onDelete(operation);
            onClose?.();
        } catch (error) {
            showToast('error', 'Hata', parseError(error, 'İşlem silinemedi.'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AppBottomSheet visible={visible} onClose={onClose} snapPoints={['92%']} wrapContent={false}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
            >
                <BottomSheetScrollView
                    contentContainerStyle={[styles.container, { paddingBottom: spacing['3xl'] }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                {/* ── Header ── */}
                <View style={styles.headerRow}>
                    <View style={[styles.headerIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                        <MaterialCommunityIcons name="wrench-cog-outline" size={20} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.title, { color: colors.text }]}>
                            {isEditMode ? 'İşlemi Düzenle' : 'İşlem Ekle'}
                        </Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            {'İşlem kaydını oluşturun veya kayıtlı işlemden seçin.'}
                        </Text>
                    </View>
                    <Pressable
                        onPress={onClose}
                        hitSlop={10}
                        style={({ pressed }) => [
                            styles.closeBtn,
                            { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                        ]}
                    >
                        <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
                    </Pressable>
                </View>

                {/* ── Kayıtlı İşlemler & Ürün Seçimi Tabları ── */}
                {!isEditMode && (
                    <View style={{ marginBottom: 12 }}>
                        <View style={[styles.tabRow, { borderColor: colors.border }]}>
                            <Pressable 
                                onPress={() => setActiveTab('template')}
                                style={[
                                    styles.tabBtn, 
                                    activeTab === 'template' && { backgroundColor: colors.surface, borderBottomWidth: 2, borderBottomColor: '#2563EB' }
                                ]}
                            >
                                <Text style={[styles.tabBtnText, { color: activeTab === 'template' ? '#2563EB' : colors.textSecondary }]}>Kayıtlı İşlem</Text>
                            </Pressable>
                            <Pressable 
                                onPress={() => setActiveTab('product')}
                                style={[
                                    styles.tabBtn, 
                                    activeTab === 'product' && { backgroundColor: colors.surface, borderBottomWidth: 2, borderBottomColor: '#2563EB' }
                                ]}
                            >
                                <Text style={[styles.tabBtnText, { color: activeTab === 'product' ? '#2563EB' : colors.textSecondary }]}>Envanter / Ürün</Text>
                            </Pressable>
                        </View>

                        <View style={{ marginTop: 8 }}>
                            {activeTab === 'template' ? (
                                <SelectField
                                    label="Kayıtlı İşlemlerden Seç"
                                    value={selectedTemplateId}
                                    options={templateOptions}
                                    onSelect={handleTemplateSelect}
                                    placeholder="Kayıtlı işlem seçin"
                                    colors={colors}
                                    isDark={isDark}
                                    loading={templatesLoading}
                                />
                            ) : (
                                <SelectField
                                    label="Envanter / Ürün Seç"
                                    value={selectedProductId}
                                    options={productOptions}
                                    onSelect={handleProductSelect}
                                    placeholder="Envanterden ürün seçin"
                                    colors={colors}
                                    isDark={isDark}
                                    loading={productsLoading}
                                />
                            )}
                        </View>
                    </View>
                )}

                {/* ── İşlem Adı ── */}
                <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>İşlem adı</Text>
                    <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }]}>
                        <MaterialCommunityIcons name="wrench-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                        <BottomSheetTextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Örn. Fan motoru değişimi"
                            placeholderTextColor={colors.textTertiary}
                            style={[styles.singleInput, { color: colors.text }]}
                        />
                    </View>
                </View>

                {/* ── Açıklama (Tek Satır Görünüm) ── */}
                <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Açıklama</Text>
                    <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }]}>
                        <MaterialCommunityIcons name="text-box-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                        <BottomSheetTextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Yapılan işlem detayları"
                            placeholderTextColor={colors.textTertiary}
                            style={[styles.singleInput, { color: colors.text }]}
                        />
                    </View>
                </View>

                {/* ── Adet & Birim Ücret ── */}
                <View style={styles.twoCol}>
                    <View style={styles.col}>
                        <View style={styles.fieldWrap}>
                            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Adet</Text>
                            <View style={[styles.qtyWrap, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }]}>
                                <Pressable
                                    onPress={() => {
                                        const current = parseInt(quantity, 10) || 1;
                                        if (current > 1) setQuantity(String(current - 1));
                                    }}
                                    style={({ pressed }) => [styles.qtyBtn, { opacity: pressed ? 0.6 : 1 }]}
                                >
                                    <MaterialCommunityIcons name="minus" size={20} color={colors.text} />
                                </Pressable>
                                
                                <BottomSheetTextInput
                                    value={quantity}
                                    onChangeText={(value) => {
                                        const clean = value.replace(/\D/g, '');
                                        setQuantity(clean);
                                    }}
                                    placeholder="1"
                                    placeholderTextColor={colors.textTertiary}
                                    keyboardType="number-pad"
                                    style={[styles.qtyInput, { color: colors.text }]}
                                    textAlign="center"
                                />

                                <Pressable
                                    onPress={() => {
                                        const current = parseInt(quantity, 10) || 0;
                                        setQuantity(String(current + 1));
                                    }}
                                    style={({ pressed }) => [styles.qtyBtn, { opacity: pressed ? 0.6 : 1 }]}
                                >
                                    <MaterialCommunityIcons name="plus" size={20} color={colors.text} />
                                </Pressable>
                            </View>
                        </View>
                    </View>
                    <View style={styles.col}>
                        <View style={styles.fieldWrap}>
                            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Birim Ücret</Text>
                            <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }]}>
                                <MaterialCommunityIcons name="cash" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                                <BottomSheetTextInput
                                    value={unitPrice}
                                    onChangeText={(t) => {
                                        const normalized = t.replace(/[^\d.,]/g, '').replace(/\./g, ',');
                                        setUnitPrice(formatAmountDisplay(normalized));
                                    }}
                                    placeholder="0"
                                    placeholderTextColor={colors.textTertiary}
                                    keyboardType="number-pad"
                                    style={[styles.singleInput, { color: colors.text }]}
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* ── Kayıtlı İşleme Ekle ── */}
                {!isEditMode && (
                    <View style={styles.inlineActions}>
                        <Pressable
                            onPress={handleSaveTemplate}
                            disabled={submitting || savingTemplate}
                            style={({ pressed }) => [
                                styles.templateSaveButton,
                                {
                                    borderColor: colors.border,
                                    backgroundColor: colors.surfaceMuted,
                                    opacity: pressed || submitting || savingTemplate ? 0.72 : 1,
                                },
                            ]}
                        >
                            {savingTemplate ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="content-save-plus-outline" size={18} color={colors.primary} />
                                    <Text style={[styles.templateSaveText, { color: colors.text }]}>
                                        Kayıtlı İşlemlere Ekle
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                )}

                {/* ── Butonlar ── */}
                <View style={styles.actions}>
                    {isEditMode ? (
                        <Pressable
                            onPress={handleDelete}
                            disabled={submitting || savingTemplate}
                            style={({ pressed }) => [
                                styles.deleteButton,
                                { opacity: pressed || submitting || savingTemplate ? 0.78 : 1 },
                            ]}
                        >
                            <MaterialCommunityIcons name="delete-outline" size={18} color="#FFFFFF" />
                            <Text style={styles.primaryText}>Sil</Text>
                        </Pressable>
                    ) : null}

                    <Pressable
                        onPress={onClose}
                        disabled={submitting || savingTemplate}
                        style={({ pressed }) => [
                            styles.secondaryButton,
                            {
                                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                                borderWidth: 1,
                                borderColor: colors.border,
                                opacity: pressed || submitting || savingTemplate ? 0.7 : 1,
                            },
                        ]}
                    >
                        <Text style={[styles.secondaryText, { color: colors.text }]}>Vazgeç</Text>
                    </Pressable>

                    <Pressable
                        onPress={handleSubmit}
                        disabled={submitting || savingTemplate}
                        style={({ pressed }) => [
                            styles.primaryButton,
                            {
                                backgroundColor: '#2563EB',
                                opacity: pressed || submitting || savingTemplate ? 0.84 : 1,
                            },
                        ]}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="check-circle-outline" size={18} color="#fff" />
                                <Text style={styles.primaryText}>
                                    {isEditMode ? 'Kaydet' : 'İşlemi Ekle'}
                                </Text>
                            </>
                        )}
                    </Pressable>
                </View>
            </BottomSheetScrollView>
            </KeyboardAvoidingView>
        </AppBottomSheet>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.s,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
        marginBottom: spacing.m,
    },
    headerIcon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
    },
    subtitle: {
        fontSize: 12,
        marginTop: 2,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fieldWrap: {
        marginBottom: 16,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 52,
        gap: 8,
    },
    inputIcon: {
        marginRight: 2,
    },
    singleInput: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        paddingVertical: 0,
    },
    tabRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        marginBottom: 8,
    },
    tabBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    tabBtnText: {
        fontSize: 13,
        fontWeight: '850',
    },
    qtyWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: 12,
        height: 52,
        overflow: 'hidden',
    },
    qtyBtn: {
        width: 44,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyInput: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
        paddingVertical: 0,
        height: '100%',
    },
    formatPreview: {
        fontSize: 11,
        fontWeight: '700',
        marginTop: 5,
        paddingLeft: 2,
    },
    twoCol: {
        flexDirection: 'row',
        gap: spacing.s,
    },
    col: {
        flex: 1,
    },
    inlineActions: {
        marginTop: spacing.s,
        marginBottom: spacing.xs,
    },
    templateSaveButton: {
        minHeight: 48,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.xs,
    },
    templateSaveText: {
        fontSize: 13,
        fontWeight: '700',
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.s,
        marginTop: spacing.l,
    },
    deleteButton: {
        minWidth: 80,
        borderRadius: 14,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.xs,
        paddingHorizontal: spacing.m,
        minHeight: 52,
    },
    secondaryButton: {
        flex: 1,
        minHeight: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryText: {
        fontSize: 14,
        fontWeight: '700',
    },
    primaryButton: {
        flex: 1.4,
        minHeight: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.xs,
    },
    primaryText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
});
