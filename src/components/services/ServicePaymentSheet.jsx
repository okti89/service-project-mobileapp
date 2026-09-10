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

const formatCurrency = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '₺0,00';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
};


// Yazarken anlık olarak sadece binlik nokta ayracı ekler (örn: 1200 -> 1.200)
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

// ─── Dropdown Select Bileşeni (Açılan Alt Modal Yapısı) ──────────────────────────────────────────────────

function SelectField({ label, value, options, onSelect, placeholder, colors, isDark }) {
    const [modalVisible, setModalVisible] = useState(false);
    const selected = options.find(o => o.value === value) || null;

    return (
        <View style={sfStyles.wrap}>
            <Text style={[sfStyles.label, { color: colors.textSecondary }]}>{label}</Text>
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
                <Text style={[sfStyles.triggerText, { color: selected ? colors.text : colors.textSecondary }]} numberOfLines={1}>
                    {selected ? selected.label : placeholder}
                </Text>
                <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={colors.textSecondary}
                />
            </Pressable>

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
                            <View style={sfStyles.optionList}>
                                {options.map(opt => {
                                    const active = opt.value === value;
                                    return (
                                        <Pressable
                                            key={String(opt.value)}
                                            onPress={() => { onSelect(opt.value); setModalVisible(false); }}
                                            style={({ pressed }) => [
                                                sfStyles.option,
                                                {
                                                    backgroundColor: active
                                                        ? 'rgba(16,185,129,0.10)'
                                                        : isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                                                    borderColor: active ? '#10B981' : colors.border,
                                                    opacity: pressed ? 0.85 : 1,
                                                },
                                            ]}
                                        >
                                            <Text style={[sfStyles.optionText, { color: active ? '#059669' : colors.text }]} numberOfLines={1}>
                                                {opt.label}
                                            </Text>
                                            {active && <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />}
                                        </Pressable>
                                    );
                                })}
                            </View>
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
        paddingVertical: 14,
        borderWidth: 1,
        borderRadius: 12,
        gap: 8,
    },
    optionText: { flex: 1, fontSize: 14, fontWeight: '700' },
});

// ─── Ana Bileşen ────────────────────────────────────────────────────────────────

export default function ServicePaymentSheet({
    visible,
    onClose,
    service,
    paymentMethods = [],
    paymentMethodsLoading = false,
    payment = null,
    onSubmit,
    onDelete,
}) {
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();
    const [selectedMethodId, setSelectedMethodId] = useState(null);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const isEditMode = Boolean(payment?.id);
    const remainingBalance = Math.max(0, Number(service?.remaining_balance ?? 0));

    useEffect(() => {
        if (!visible) {
            setSelectedMethodId(null);
            setAmount('');
            setNote('');
            setSubmitting(false);
            return;
        }

        if (payment?.id) {
            setSelectedMethodId(payment?.payment_method || null);
            const amtVal = payment?.amount !== null && payment?.amount !== undefined ? Math.round(Number(payment.amount)) : 0;
            setAmount(amtVal > 0 ? formatAmountDisplay(String(amtVal)) : '');
            setNote(payment?.note || '');
            return;
        }

        // Nakit ödeme yöntemini varsayılan olarak seç, yoksa default olanı, o da yoksa ilkini seç
        const nakitMethod = paymentMethods.find((item) => String(item?.name || '').toLowerCase().includes('nakit'));
        const defaultMethod = nakitMethod || paymentMethods.find((item) => item?.is_default) || paymentMethods[0];
        setSelectedMethodId(defaultMethod?.id || null);
        setAmount('');
        setNote('');
    }, [visible, payment, paymentMethods]);

    const methodOptions = useMemo(
        () => paymentMethods.map(m => ({ value: m.id, label: m.name || 'Ödeme yöntemi' })),
        [paymentMethods]
    );

    const handleFillRemaining = () => {
        if (remainingBalance <= 0) {
            showToast('info', 'Ödeme', 'Kalan bakiye bulunmuyor.');
            return;
        }
        setAmount(formatAmountDisplay(String(Math.round(remainingBalance))));
    };

    const handleSubmit = async () => {
        const parsedAmount = parseAmount(amount);

        if (!service?.id) {
            showToast('error', 'Hata', 'Servis kaydı bulunamadı.');
            return;
        }

        if (!selectedMethodId) {
            showToast('warning', 'Eksik bilgi', 'Bir ödeme yöntemi seçin.');
            return;
        }

        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            showToast('warning', 'Eksik bilgi', 'Geçerli bir ödeme tutarı girin.');
            return;
        }

        try {
            setSubmitting(true);
            await onSubmit?.(
                {
                    service: service.id,
                    amount: parsedAmount,
                    payment_method: selectedMethodId,
                    note: String(note || '').trim(),
                },
                payment
            );
            onClose?.();
        } catch (error) {
            showToast('error', 'Hata', parseError(error, 'Ödeme kaydedilemedi.'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!payment?.id || !onDelete) return;
        try {
            setSubmitting(true);
            await onDelete(payment);
            onClose?.();
        } catch (error) {
            showToast('error', 'Hata', parseError(error, 'Ödeme silinemedi.'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AppBottomSheet visible={visible} onClose={onClose} snapPoints={['90%']} wrapContent={false}>
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
                    <View style={[styles.headerIcon, { backgroundColor: 'rgba(16,185,129,0.14)' }]}>
                        <MaterialCommunityIcons name="cash-plus" size={20} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.title, { color: colors.text }]}>
                            {isEditMode ? 'Ödemeyi Düzenle' : 'Ödeme Ekle'}
                        </Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            {'Tahsil edilen ödemeyi servis kaydına işle.'}
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

                {/* ── Özet Kart ── */}
                <View style={[styles.summaryCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                    <View style={styles.summaryCol}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                            {remainingBalance > 0 ? 'Kalan bakiye' : 'Durum'}
                        </Text>
                        <Text style={[styles.summaryValue, { color: remainingBalance > 0 ? colors.error : colors.success }]}>
                            {remainingBalance > 0 ? formatCurrency(remainingBalance) : 'Ödeme Tamamlandı'}
                        </Text>
                    </View>
                    <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.summaryCol}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Toplam ödeme</Text>
                        <Text style={[styles.summaryValue, { color: colors.text }]}>
                            {formatCurrency(service?.total_paid)}
                        </Text>
                    </View>
                </View>

                {/* ── Kalan Tutarı Doldur ── */}
                {remainingBalance > 0 ? (
                    <Pressable
                        onPress={handleFillRemaining}
                        disabled={submitting}
                        style={({ pressed }) => [
                            styles.fullPaymentButton,
                            {
                                backgroundColor: 'rgba(16,185,129,0.10)',
                                borderColor: 'rgba(16,185,129,0.32)',
                                opacity: pressed || submitting ? 0.75 : 1,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons name="lightning-bolt-circle" size={18} color="#059669" />
                        <Text style={styles.fullPaymentText}>Kalanın Tamamını Doldur</Text>
                    </Pressable>
                ) : null}

                {/* ── Ödeme Yöntemi Seçimi ── */}
                {paymentMethodsLoading ? (
                    <View style={[styles.loadingCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                            Ödeme yöntemleri yükleniyor...
                        </Text>
                    </View>
                ) : (
                    <SelectField
                        label="Ödeme Yöntemi"
                        value={selectedMethodId}
                        options={methodOptions}
                        onSelect={setSelectedMethodId}
                        placeholder="Bir yöntem seçin"
                        colors={colors}
                        isDark={isDark}
                    />
                )}

                {/* ── Tutar ── */}
                <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Ödeme Tutarı</Text>
                    <View style={[
                        styles.amountWrap,
                        { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff' },
                    ]}>
                        <Text style={[styles.amountSymbol, { color: colors.textSecondary }]}>₺</Text>
                        <BottomSheetTextInput
                            value={amount}
                            onChangeText={(t) => {
                                setAmount(formatAmountDisplay(t));
                            }}
                            placeholder="0"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="number-pad"
                            style={[styles.amountInput, { color: colors.text }]}
                            returnKeyType="done"
                        />
                        {amount ? (
                            <Pressable onPress={() => setAmount('')} hitSlop={8}>
                                <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
                            </Pressable>
                        ) : null}
                    </View>
                </View>

                {/* ── Not ── */}
                <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Not</Text>
                    <View style={[styles.textAreaWrap, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }]}>
                        <BottomSheetTextInput
                            value={note}
                            onChangeText={setNote}
                            placeholder="Opsiyonel açıklama"
                            placeholderTextColor={colors.textTertiary}
                            multiline
                            textAlignVertical="top"
                            style={[styles.textArea, { color: colors.text }]}
                        />
                    </View>
                </View>

                {/* ── Butonlar ── */}
                <View style={styles.actions}>
                    {isEditMode ? (
                        <Pressable
                            onPress={handleDelete}
                            disabled={submitting}
                            style={({ pressed }) => [
                                styles.deleteButton,
                                { opacity: pressed || submitting ? 0.78 : 1 },
                            ]}
                        >
                            <MaterialCommunityIcons name="delete-outline" size={18} color="#FFFFFF" />
                            <Text style={styles.primaryText}>Sil</Text>
                        </Pressable>
                    ) : null}

                    <Pressable
                        onPress={onClose}
                        disabled={submitting}
                        style={({ pressed }) => [
                            styles.secondaryButton,
                            {
                                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                                borderWidth: 1,
                                borderColor: colors.border,
                                opacity: pressed || submitting ? 0.7 : 1,
                            },
                        ]}
                    >
                        <Text style={[styles.secondaryText, { color: colors.text }]}>Vazgeç</Text>
                    </Pressable>

                    <Pressable
                        onPress={handleSubmit}
                        disabled={submitting}
                        style={({ pressed }) => [
                            styles.primaryButton,
                            {
                                backgroundColor: '#10B981',
                                opacity: pressed || submitting ? 0.84 : 1,
                            },
                        ]}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="credit-card-check-outline" size={18} color="#fff" />
                                <Text style={styles.primaryText}>
                                    {isEditMode ? 'Ödemeyi Kaydet' : 'Ödemeyi Ekle'}
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
    summaryCard: {
        borderWidth: 1,
        borderRadius: 16,
        padding: spacing.m,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.m,
    },
    summaryCol: {
        flex: 1,
    },
    summaryDivider: {
        width: 1,
        alignSelf: 'stretch',
        marginHorizontal: spacing.m,
    },
    summaryLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    summaryValue: {
        fontSize: 17,
        fontWeight: '800',
        marginTop: 4,
    },
    fullPaymentButton: {
        minHeight: 48,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.xs,
        marginBottom: spacing.m,
    },
    fullPaymentText: {
        color: '#047857',
        fontSize: 13,
        fontWeight: '800',
    },
    amountWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 52,
    },
    amountSymbol: {
        fontSize: 20,
        fontWeight: '700',
    },
    amountInput: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        paddingVertical: 0,
    },
    formatPreview: {
        fontSize: 12,
        fontWeight: '700',
        marginTop: 6,
        paddingLeft: 4,
    },
    loadingCard: {
        borderWidth: 1,
        borderRadius: 14,
        padding: spacing.m,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
        marginBottom: 16,
    },
    loadingText: {
        fontSize: 12,
        fontWeight: '600',
    },
    fieldWrap: {
        marginBottom: 16,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
    },
    textAreaWrap: {
        borderWidth: 1.5,
        borderRadius: 12,
        minHeight: 90,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    textArea: {
        minHeight: 64,
        fontSize: 14,
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
        flex: 1.35,
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
