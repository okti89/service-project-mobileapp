import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceRed } from '@/theme/color';
import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';

// Yazarken anlık binlik ayraç maskelemesi
const maskMoney = (value) => {
    const clean = String(value).replace(/\D/g, '');
    if (!clean) return '';
    const num = parseInt(clean, 10);
    return num.toLocaleString('tr-TR');
};

const fmtInitialMoney = (val) => {
    const n = Number(val || 0);
    return Number.isFinite(n) && n > 0
        ? Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
        : '';
};

export default function AdminAccountFormScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();

    // Edit Modu Kontrolü
    const editingAccount = route?.params?.account || null;
    const isEditMode = !!editingAccount;

    // Input Referansları
    const nameInputRef = useRef(null);
    const balanceInputRef = useRef(null);

    // Form State
    const [name, setName] = useState('');
    const [accountType, setAccountType] = useState('cash'); // 'cash', 'bank', 'credit_card'
    const [balance, setBalance] = useState('');

    const [formErrors, setFormErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Edit modunda ilk değerleri doldur
    useEffect(() => {
        if (isEditMode && editingAccount) {
            setName(editingAccount.name || '');
            setAccountType(editingAccount.account_type || 'cash');
            setBalance(fmtInitialMoney(editingAccount.balance));
        }
    }, [isEditMode, editingAccount]);

    // Kaydetme / Güncelleme İşlemi
    const handleSave = async () => {
        Keyboard.dismiss();
        const errors = {};

        if (!name.trim()) {
            errors.name = 'Lütfen hesap adı giriniz.';
        }

        const parsedBalance = parseFloat(String(balance).replace(/\./g, '').replace(',', '.'));
        if (balance && (isNaN(parsedBalance) || parsedBalance < 0)) {
            errors.balance = 'Lütfen geçerli bir bakiye giriniz.';
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            showToast('error', 'Hata', 'Lütfen formdaki eksik alanları doldurunuz.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: name.trim(),
                account_type: accountType,
                balance: parsedBalance || 0,
            };

            if (isEditMode) {
                // PUT İstek
                await api.put(`${ENDPOINTS.ACCOUNTING.ACCOUNTS}${editingAccount.id}/`, payload);
                showToast('success', 'Başarılı', 'Hesap başarıyla güncellendi.');
            } else {
                // POST İstek
                await api.post(ENDPOINTS.ACCOUNTING.ACCOUNTS, payload);
                showToast('success', 'Başarılı', 'Yeni kasa/hesap başarıyla oluşturuldu.');
            }

            if (route?.params?.onSuccess) {
                route.params.onSuccess();
            }
            navigation.goBack();
        } catch (err) {
            console.log('Save account error:', err?.response?.data || err?.message);
            const backendErrors = {};
            const data = err?.response?.data;
            if (data && typeof data === 'object') {
                for (const [key, val] of Object.entries(data)) {
                    backendErrors[key] = Array.isArray(val) ? val[0] : val;
                }
            } else {
                backendErrors.general = isEditMode ? 'Hesap güncellenemedi.' : 'Hesap oluşturulamadı.';
            }
            setFormErrors(backendErrors);
            showToast('error', 'Hata', backendErrors.general || 'Form kaydedilirken hata oluştu.');
        } finally {
            setSaving(false);
        }
    };

    // Hesap Silme İşlemi
    const handleDelete = () => {
        Alert.alert(
            'Hesabı Sil',
            'Bu hesap cüzdanını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        setDeleting(true);
                        try {
                            await api.delete(`${ENDPOINTS.ACCOUNTING.ACCOUNTS}${editingAccount.id}/`);
                            showToast('success', 'Başarılı', 'Hesap başarıyla silindi.');
                            if (route?.params?.onSuccess) {
                                route.params.onSuccess();
                            }
                            navigation.goBack();
                        } catch (err) {
                            console.log('Delete account error:', err?.response?.data || err?.message);
                            showToast('error', 'Hata', 'Hesap silinirken hata oluştu.');
                        } finally {
                            setDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    const cardBg = colors.surface;
    const border = colors.border;

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES} style={{ backgroundColor: colors.background }}>
            <Header title={isEditMode ? "Hesabı Düzenle" : "Yeni Hesap Ekle"} showBack borderBottom />
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 100}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: insets.bottom + 40 }
                    ]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.formContainer}>
                        {formErrors.general && (
                            <View style={styles.errorBanner}>
                                <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#FFF" />
                                <Text style={styles.errorBannerText}>{formErrors.general}</Text>
                            </View>
                        )}

                        {/* ── Hesap Adı ── */}
                        <Pressable
                            onPress={() => nameInputRef.current?.focus()}
                            style={[styles.card, { backgroundColor: cardBg, borderColor: formErrors.name ? serviceRed : border }]}
                        >
                            <Text style={[styles.cardTitle, { color: colors.text }]}>Hesap / Kasa Adı *</Text>
                            <View style={[styles.inputContainer, { borderColor: formErrors.name ? serviceRed : border }]}>
                                <MaterialCommunityIcons name="wallet-outline" size={18} color={colors.textSecondary} />
                                <TextInput
                                    ref={nameInputRef}
                                    style={[styles.input, { color: colors.text }]}
                                    value={name}
                                    onChangeText={(val) => {
                                        setName(val);
                                        setFormErrors(prev => ({ ...prev, name: null }));
                                    }}
                                    placeholder="Örn: Garanti Ticari, Merkez Kasa"
                                    placeholderTextColor={colors.textTertiary}
                                />
                            </View>
                            {formErrors.name && <Text style={styles.errorText}>{formErrors.name}</Text>}
                        </Pressable>

                        {/* ── Hesap Türü Seçimi ── */}
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>Hesap Türü *</Text>
                            <View style={styles.typeSelectorRow}>
                                {[
                                    { type: 'cash', label: 'Nakit Kasa', icon: 'cash' },
                                    { type: 'bank', label: 'Banka Hesabı', icon: 'bank' },
                                    { type: 'credit_card', label: 'Kredi Kartı', icon: 'credit-card' }
                                ].map(item => {
                                    const isSelected = accountType === item.type;
                                    return (
                                        <Pressable
                                            key={item.type}
                                            onPress={() => setAccountType(item.type)}
                                            style={[
                                                styles.typeChip,
                                                { borderColor: border },
                                                isSelected && { borderColor: serviceBlue, backgroundColor: `${serviceBlue}10` }
                                            ]}
                                        >
                                            <MaterialCommunityIcons name={item.icon} size={20} color={isSelected ? serviceBlue : colors.textSecondary} />
                                            <Text style={[styles.typeChipText, { color: isSelected ? serviceBlue : colors.textSecondary }]}>{item.label}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>

                        {/* ── Bakiye ── */}
                        <Pressable
                            onPress={() => balanceInputRef.current?.focus()}
                            style={[styles.card, { backgroundColor: cardBg, borderColor: formErrors.balance ? serviceRed : border }]}
                        >
                            <Text style={[styles.cardTitle, { color: colors.text }]}>
                                {isEditMode ? 'Güncel Bakiye (₺)' : 'Başlangıç Bakiyesi (₺)'}
                            </Text>
                            <View style={[styles.inputContainer, { borderColor: formErrors.balance ? serviceRed : border }]}>
                                <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '700' }}>₺</Text>
                                <TextInput
                                    ref={balanceInputRef}
                                    style={[styles.input, { color: colors.text, fontWeight: '700' }]}
                                    value={balance}
                                    onChangeText={(val) => {
                                        setBalance(maskMoney(val));
                                        setFormErrors(prev => ({ ...prev, balance: null }));
                                    }}
                                    placeholder="0,00"
                                    placeholderTextColor={colors.textTertiary}
                                    keyboardType="numeric"
                                />
                            </View>
                            {formErrors.balance && <Text style={styles.errorText}>{formErrors.balance}</Text>}
                        </Pressable>
                    </View>

                    {/* ── Kaydet / Güncelle Butonu ── */}
                    <Pressable
                        onPress={handleSave}
                        disabled={saving}
                        style={({ pressed }) => [
                            styles.saveBtn,
                            { backgroundColor: serviceBlue },
                            (saving || pressed) && { opacity: 0.8 }
                        ]}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="check" size={18} color="#FFF" style={{ marginRight: 6 }} />
                                <Text style={styles.saveBtnText}>{isEditMode ? 'Hesabı Güncelle' : 'Hesabı Kaydet'}</Text>
                            </>
                        )}
                    </Pressable>

                    {/* ── Düzenleme Modundaysa Sil Butonu Göster ── */}
                    {isEditMode && (
                        <Pressable
                            onPress={handleDelete}
                            disabled={deleting}
                            style={({ pressed }) => [
                                styles.deleteBtn,
                                { borderColor: serviceRed },
                                (deleting || pressed) && { backgroundColor: `${serviceRed}10` }
                            ]}
                        >
                            {deleting ? (
                                <ActivityIndicator size="small" color={serviceRed} />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={serviceRed} style={{ marginRight: 6 }} />
                                    <Text style={styles.deleteBtnText}>Hesabı Sil</Text>
                                </>
                            )}
                        </Pressable>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    keyboardView: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16 },
    formContainer: { gap: 12 },
    
    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        gap: 8,
    },
    cardTitle: { fontSize: 12, fontWeight: '700' },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 48,
    },
    input: { flex: 1, fontSize: 14, fontWeight: '600', marginLeft: 8 },

    // Chip
    typeSelectorRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between', marginTop: 4 },
    typeChip: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    typeChipText: { fontSize: 10, fontWeight: '700' },

    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        height: 48,
        marginTop: 24,
        marginBottom: 10,
    },
    saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        height: 48,
        borderWidth: 1.5,
        marginBottom: 16,
    },
    deleteBtnText: { color: serviceRed, fontSize: 14, fontWeight: '700' },

    errorText: { color: serviceRed, fontSize: 11, fontWeight: '600', marginTop: 2 },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: serviceRed,
        borderRadius: 12,
        padding: 12,
        marginBottom: 6,
    },
    errorBannerText: { color: '#FFF', fontSize: 12, fontWeight: '700', flex: 1 },
});
