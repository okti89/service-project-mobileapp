import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
    ActivityIndicator,
    BackHandler,
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
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';

// Haftanın Günleri
const WEEKDAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

const toDateStr = (date) => {
    return dayjs(date).format('YYYY-MM-DD');
};

const fmtMoney = (val) => {
    const n = Number(val || 0);
    return Number.isFinite(n)
        ? n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0,00';
};

const maskMoney = (value) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) return '';
    const num = parseInt(clean, 10);
    return num.toLocaleString('tr-TR');
};

export default function AdminAccountingFormScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();

    // Input Referansları
    const amountInputRef = useRef(null);
    const descInputRef = useRef(null);
    const inlineInputRef = useRef(null);

    // Form Elemanları
    const [transactionType, setTransactionType] = useState('expense'); // 'income' veya 'expense'
    const [amount, setAmount] = useState('');
    const [accountId, setAccountId] = useState(null);
    const [accountName, setAccountName] = useState(null);
    const [categoryId, setCategoryId] = useState(null);
    const [categoryName, setCategoryName] = useState(null);
    const [description, setDescription] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Yeni Kategori Ekleme State'leri
    const [newCategoryName, setNewCategoryName] = useState('');
    const [addingCategory, setAddingCategory] = useState(false);

    // BottomSheet Görünürlük State'leri
    const [accountSheetVisible, setAccountSheetVisible] = useState(false);
    const [categorySheetVisible, setCategorySheetVisible] = useState(false);
    const [dateSheetVisible, setDateSheetVisible] = useState(false);

    // Takvim Görüntüleme Ayı
    const [viewedMonth, setViewedMonth] = useState(new Date());

    const [formErrors, setFormErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [loadingData, setLoadingData] = useState(true);

    // Listeler
    const [accounts, setAccounts] = useState([]);
    const [categories, setCategories] = useState([]);

    // BottomSheet Referansları
    const accountSheetRef = useRef(null);
    const categorySheetRef = useRef(null);
    const dateSheetRef = useRef(null);

    // Android Geri Tuşu Yönetimi
    useEffect(() => {
        const backAction = () => {
            if (accountSheetVisible) {
                setAccountSheetVisible(false);
                return true;
            }
            if (categorySheetVisible) {
                setCategorySheetVisible(false);
                return true;
            }
            if (dateSheetVisible) {
                setDateSheetVisible(false);
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );

        return () => backHandler.remove();
    }, [accountSheetVisible, categorySheetVisible, dateSheetVisible]);

    // Gerekli Tanımları Yükle
    const loadInitialData = useCallback(async () => {
        try {
            const [accRes, catRes] = await Promise.all([
                api.get(ENDPOINTS.ACCOUNTING.ACCOUNTS),
                api.get(ENDPOINTS.ACCOUNTING.CATEGORIES)
            ]);

            const accountsData = Array.isArray(accRes.data) ? accRes.data : (accRes.data?.results || []);
            setAccounts(accountsData);

            const categoriesData = Array.isArray(catRes.data) ? catRes.data : (catRes.data?.results || []);
            setCategories(categoriesData);

            // Varsayılan hesap seç
            if (accountsData.length > 0) {
                setAccountId(accountsData[0].id);
                setAccountName(accountsData[0].name);
            }
        } catch (err) {
            console.log('Load categories/accounts error:', err?.message);
            showToast('error', 'Hata', 'Kasa/Hesap listesi yüklenemedi.');
        } finally {
            setLoadingData(false);
        }
    }, [showToast]);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    // Seçilen işlem türüne göre filtrele
    const filteredCategories = useMemo(() => {
        return categories.filter(c => c.type === transactionType);
    }, [categories, transactionType]);

    const handleTypeChange = (type) => {
        setTransactionType(type);
        setCategoryId(null);
        setCategoryName(null);
    };

    // Takvim Hesaplamaları (Custom Grid Calendar)
    const startOfMonth = dayjs(viewedMonth).startOf('month');
    const daysInMonth = startOfMonth.daysInMonth();
    const startDayOfWeek = startOfMonth.day();
    const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const daysArray = useMemo(() => {
        const arr = [];
        for (let i = 0; i < offset; i++) {
            arr.push(null);
        }
        for (let d = 1; d <= daysInMonth; d++) {
            arr.push(d);
        }
        return arr;
    }, [offset, daysInMonth]);

    const viewedMonthLabel = dayjs(viewedMonth).locale('tr').format('MMMM YYYY');

    const handlePrevMonth = () => {
        setViewedMonth(prev => dayjs(prev).subtract(1, 'month').toDate());
    };

    const handleNextMonth = () => {
        setViewedMonth(prev => dayjs(prev).add(1, 'month').toDate());
    };

    const handleSelectDay = (day) => {
        if (!day) return;
        const chosen = dayjs(viewedMonth).date(day).toDate();
        setSelectedDate(chosen);
        setDateSheetVisible(false);
    };

    // Inline Kategori Ekleme
    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) {
            showToast('error', 'Hata', 'Lütfen geçerli bir kategori adı yazın.');
            return;
        }
        setAddingCategory(true);
        try {
            const payload = {
                name: newCategoryName.trim(),
                type: transactionType,
            };
            const res = await api.post(ENDPOINTS.ACCOUNTING.CATEGORIES, payload);
            showToast('success', 'Başarılı', 'Yeni kategori oluşturuldu.');

            setCategories(prev => [...prev, res.data]);
            setCategoryId(res.data.id);
            setCategoryName(res.data.name);
            setNewCategoryName('');
            setCategorySheetVisible(false);
        } catch (err) {
            console.log('Add category error:', err?.response?.data || err?.message);
            showToast('error', 'Hata', 'Kategori eklenirken hata oluştu.');
        } finally {
            setAddingCategory(false);
        }
    };

    // Kaydetme İşlemi
    const handleSave = async () => {
        Keyboard.dismiss();
        const errors = {};

        const parsedAmount = parseFloat(String(amount).replace(/\./g, '').replace(',', '.'));
        if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
            errors.amount = 'Lütfen geçerli bir tutar giriniz.';
        }

        if (!accountId) {
            errors.account = 'Lütfen işlem yapılacak hesabı seçiniz.';
        }

        if (!categoryId) {
            errors.category = 'Lütfen işlem kategorisini seçiniz.';
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            showToast('error', 'Hata', 'Lütfen formdaki eksik alanları doldurunuz.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                transaction_type: transactionType,
                amount: parsedAmount,
                account: accountId,
                category: categoryId,
                description: description.trim(),
                date: toDateStr(selectedDate),
            };

            await api.post(ENDPOINTS.ACCOUNTING.TRANSACTIONS, payload);
            showToast('success', 'Başarılı', 'İşlem kaydı başarıyla oluşturuldu.');

            if (route?.params?.onSuccess) {
                route.params.onSuccess();
            }
            navigation.goBack();
        } catch (err) {
            console.log('Save transaction error:', err?.response?.data || err?.message);
            const backendErrors = {};
            const data = err?.response?.data;
            if (data && typeof data === 'object') {
                for (const [key, val] of Object.entries(data)) {
                    backendErrors[key] = Array.isArray(val) ? val[0] : val;
                }
            } else {
                backendErrors.general = 'İşlem kaydı oluşturulamadı.';
            }
            setFormErrors(backendErrors);
            showToast('error', 'Hata', backendErrors.general || 'Form kaydedilirken hata oluştu.');
        } finally {
            setSaving(false);
        }
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

    const cardBg = colors.surface;
    const border = colors.border;

    if (loadingData) {
        return (
            <WrapperContainer>
                <Header title="Yeni Finansal İşlem" showBack borderBottom />
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={serviceBlue} />
                </View>
            </WrapperContainer>
        );
    }

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES} style={{ backgroundColor: colors.background }}>
            <Header title="Yeni Finansal İşlem" showBack borderBottom />
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
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

                        {/* ── İşlem Türü Toggle ── */}
                        <View style={[styles.typeToggleContainer, { borderColor: border, backgroundColor: cardBg }]}>
                            <Pressable
                                onPress={() => handleTypeChange('expense')}
                                style={[
                                    styles.toggleBtn,
                                    transactionType === 'expense' && [styles.toggleActiveBtn, { backgroundColor: serviceRed }]
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name="arrow-up-bold-circle-outline"
                                    size={18}
                                    color={transactionType === 'expense' ? '#FFF' : colors.textSecondary}
                                />
                                <Text style={[styles.toggleText, { color: transactionType === 'expense' ? '#FFF' : colors.textSecondary }]}>
                                    Gider (-)
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() => handleTypeChange('income')}
                                style={[
                                    styles.toggleBtn,
                                    transactionType === 'income' && [styles.toggleActiveBtn, { backgroundColor: serviceGreen }]
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name="arrow-down-bold-circle-outline"
                                    size={18}
                                    color={transactionType === 'income' ? '#FFF' : colors.textSecondary}
                                />
                                <Text style={[styles.toggleText, { color: transactionType === 'income' ? '#FFF' : colors.textSecondary }]}>
                                    Gelir (+)
                                </Text>
                            </Pressable>
                        </View>

                        {/* ── Tutar (₺) ── */}
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: formErrors.amount ? serviceRed : border }]}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>Miktar / Tutar *</Text>
                            <Pressable
                                onPress={() => amountInputRef.current?.focus()}
                                style={[styles.inputContainer, { borderColor: formErrors.amount ? serviceRed : border }]}
                            >
                                <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '700' }}>₺</Text>
                                <TextInput
                                    ref={amountInputRef}
                                    style={[styles.input, { color: colors.text, fontSize: 16, fontWeight: '800' }]}
                                    value={amount}
                                    onChangeText={(val) => {
                                        setAmount(maskMoney(val));
                                        setFormErrors(prev => ({ ...prev, amount: null }));
                                    }}
                                    placeholder="0,00"
                                    placeholderTextColor={colors.textTertiary}
                                    keyboardType="numeric"
                                />
                            </Pressable>
                            {formErrors.amount && <Text style={styles.errorText}>{formErrors.amount}</Text>}
                        </View>

                        {/* ── Kasa & Hesap Seçimi ── */}
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: formErrors.account ? serviceRed : border }]}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>Kasa & Hesap Cüzdanı *</Text>
                            <Pressable
                                onPress={() => {
                                    setFormErrors(prev => ({ ...prev, account: null }));
                                    setAccountSheetVisible(true);
                                }}
                                style={({ pressed }) => [
                                    styles.pickerButton,
                                    { borderColor: formErrors.account ? serviceRed : border },
                                    pressed && { opacity: 0.8 }
                                ]}
                            >
                                <MaterialCommunityIcons name="wallet-outline" size={18} color={serviceBlue} />
                                <Text style={[styles.pickerName, { color: accountId ? colors.text : colors.textTertiary }]}>
                                    {accountName || 'Ödeme yapılacak kasayı seçin'}
                                </Text>
                                <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
                            </Pressable>
                            {formErrors.account && <Text style={styles.errorText}>{formErrors.account}</Text>}
                        </View>

                        {/* ── Kategori Seçimi ── */}
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: formErrors.category ? serviceRed : border }]}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>İşlem Kategorisi *</Text>
                            <Pressable
                                onPress={() => {
                                    setFormErrors(prev => ({ ...prev, category: null }));
                                    setCategorySheetVisible(true);
                                }}
                                style={({ pressed }) => [
                                    styles.pickerButton,
                                    { borderColor: formErrors.category ? serviceRed : border },
                                    pressed && { opacity: 0.8 }
                                ]}
                            >
                                <MaterialCommunityIcons name="tag-outline" size={18} color={transactionType === 'income' ? serviceGreen : serviceRed} />
                                <Text style={[styles.pickerName, { color: categoryId ? colors.text : colors.textTertiary }]}>
                                    {categoryName || 'Kategori seçin'}
                                </Text>
                                <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
                            </Pressable>
                            {formErrors.category && <Text style={styles.errorText}>{formErrors.category}</Text>}
                        </View>

                        {/* ── Tarih ── */}
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>İşlem Tarihi *</Text>
                            <Pressable
                                onPress={() => {
                                    setViewedMonth(dayjs(selectedDate).toDate());
                                    setDateSheetVisible(true);
                                }}
                                style={({ pressed }) => [
                                    styles.pickerButton,
                                    { borderColor: border },
                                    pressed && { opacity: 0.8 }
                                ]}
                            >
                                <MaterialCommunityIcons name="calendar-month-outline" size={18} color={serviceBlue} />
                                <Text style={[styles.pickerName, { color: colors.text }]}>
                                    {dayjs(selectedDate).locale('tr').format('DD MMMM YYYY')}
                                </Text>
                                <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
                            </Pressable>
                        </View>

                        {/* ── Açıklama ── */}
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>Açıklama / Not</Text>
                            <Pressable
                                onPress={() => descInputRef.current?.focus()}
                                style={[styles.inputContainer, { borderColor: border, height: 80, paddingVertical: 8, alignItems: 'flex-start' }]}
                            >
                                <TextInput
                                    ref={descInputRef}
                                    style={[styles.input, { color: colors.text, height: '100%', textAlignVertical: 'top', marginLeft: 0 }]}
                                    value={description}
                                    onChangeText={setDescription}
                                    placeholder="Örn: Telefon faturası, Nakliye ücreti"
                                    placeholderTextColor={colors.textTertiary}
                                    multiline
                                    numberOfLines={3}
                                />
                            </Pressable>
                        </View>
                    </View>

                    {/* ── Kaydet Butonu (Doğal Akışta, MarginTop: 24 ile) ── */}
                    <Pressable
                        onPress={handleSave}
                        disabled={saving}
                        style={({ pressed }) => [
                            styles.saveBtn,
                            { backgroundColor: transactionType === 'income' ? serviceGreen : serviceRed },
                            (saving || pressed) && { opacity: 0.85 }
                        ]}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="check" size={18} color="#FFF" style={{ marginRight: 6 }} />
                                <Text style={styles.saveBtnText}>İşlemi Kaydet</Text>
                            </>
                        )}
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── Kasa / Hesap Seçim BottomSheet ── */}
            {accountSheetVisible && (
                <BottomSheet
                    ref={accountSheetRef}
                    index={0}
                    snapPoints={['50%']}
                    enablePanDownToClose
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ backgroundColor: colors.surface }}
                    handleIndicatorStyle={{ backgroundColor: colors.textTertiary }}
                    onClose={() => setAccountSheetVisible(false)}
                >
                    <BottomSheetView style={[styles.sheetContent, { flex: 1, paddingBottom: insets.bottom + 10 }]}>
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetTitle, { color: colors.text }]}>Hesap Cüzdanı Seçin</Text>
                            <Pressable onPress={() => setAccountSheetVisible(false)}>
                                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                            </Pressable>
                        </View>
                        <BottomSheetScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                            {accounts.map(acc => (
                                <Pressable
                                    key={acc.id}
                                    onPress={() => {
                                        setAccountId(acc.id);
                                        setAccountName(acc.name);
                                        setAccountSheetVisible(false);
                                    }}
                                    style={({ pressed }) => [
                                        styles.tmplItem,
                                        { borderColor: border },
                                        pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }
                                    ]}
                                >
                                    <View style={[styles.tmplBadge, { backgroundColor: `${serviceBlue}12` }]}>
                                        <MaterialCommunityIcons name="wallet-outline" size={14} color={serviceBlue} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={[styles.tmplName, { color: colors.text }]}>{acc.name}</Text>
                                        <Text style={[styles.tmplType, { color: colors.textSecondary }]}>
                                            Bakiye: ₺{fmtMoney(acc.balance)}
                                        </Text>
                                    </View>
                                </Pressable>
                            ))}
                        </BottomSheetScrollView>
                    </BottomSheetView>
                </BottomSheet>
            )}

            {/* ── Kategori Seçim BottomSheet ── */}
            {categorySheetVisible && (
                <BottomSheet
                    ref={categorySheetRef}
                    index={0}
                    snapPoints={['55%']}
                    enablePanDownToClose
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ backgroundColor: colors.surface }}
                    handleIndicatorStyle={{ backgroundColor: colors.textTertiary }}
                    onClose={() => setCategorySheetVisible(false)}
                >
                    <BottomSheetView style={[styles.sheetContent, { flex: 1, paddingBottom: insets.bottom + 10 }]}>
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetTitle, { color: colors.text }]}>Kategori Seçimi</Text>
                            <Pressable onPress={() => setCategorySheetVisible(false)}>
                                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                            </Pressable>
                        </View>

                        <Pressable
                            onPress={() => inlineInputRef.current?.focus()}
                            style={styles.inlineAddContainer}
                        >
                            <View style={[styles.inlineInputContainer, { borderColor: border }]}>
                                <TextInput
                                    ref={inlineInputRef}
                                    style={[styles.inlineInput, { color: colors.text }]}
                                    value={newCategoryName}
                                    onChangeText={setNewCategoryName}
                                    placeholder="Yeni kategori adı yazın..."
                                    placeholderTextColor={colors.textTertiary}
                                />
                            </View>
                            <Pressable
                                onPress={handleAddCategory}
                                disabled={addingCategory}
                                style={({ pressed }) => [
                                    styles.inlineAddBtn,
                                    { backgroundColor: serviceBlue },
                                    (addingCategory || pressed) && { opacity: 0.8 }
                                ]}
                            >
                                {addingCategory ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
                                )}
                            </Pressable>
                        </Pressable>

                        <View style={styles.sheetSubHeaderContainer}>
                            <Text style={[styles.sheetSubTitle, { color: colors.textSecondary }]}>Mevcut Şablonlar</Text>
                        </View>

                        {filteredCategories.length === 0 ? (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Kategori tanımlı değil.</Text>
                            </View>
                        ) : (
                            <BottomSheetScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                                {filteredCategories.map(cat => (
                                    <Pressable
                                        key={cat.id}
                                        onPress={() => {
                                            setCategoryId(cat.id);
                                            setCategoryName(cat.name);
                                            setCategorySheetVisible(false);
                                        }}
                                        style={({ pressed }) => [
                                            styles.tmplItem,
                                            { borderColor: border },
                                            pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }
                                        ]}
                                    >
                                        <View style={[styles.tmplBadge, { backgroundColor: transactionType === 'income' ? `${serviceGreen}12` : `${serviceRed}12` }]}>
                                            <MaterialCommunityIcons name="tag-outline" size={14} color={transactionType === 'income' ? serviceGreen : serviceRed} />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.tmplName, { color: colors.text }]}>{cat.name}</Text>
                                        </View>
                                    </Pressable>
                                ))}
                            </BottomSheetScrollView>
                        )}
                    </BottomSheetView>
                </BottomSheet>
            )}

            {/* ── Custom Date Picker BottomSheet ── */}
            {dateSheetVisible && (
                <BottomSheet
                    ref={dateSheetRef}
                    index={0}
                    snapPoints={['52%']}
                    enablePanDownToClose
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ backgroundColor: colors.surface }}
                    handleIndicatorStyle={{ backgroundColor: colors.textTertiary }}
                    onClose={() => setDateSheetVisible(false)}
                >
                    <BottomSheetView style={[styles.sheetContent, { flex: 1, paddingBottom: insets.bottom + 10 }]}>
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetTitle, { color: colors.text }]}>Tarih Seçin</Text>
                            <Pressable onPress={() => setDateSheetVisible(false)}>
                                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                            </Pressable>
                        </View>

                        <View style={styles.calendarContainer}>
                            <View style={styles.calendarHeader}>
                                <Pressable onPress={handlePrevMonth} style={styles.calNavBtn}>
                                    <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
                                </Pressable>
                                <Text style={[styles.calendarMonthTitle, { color: colors.text }]}>{viewedMonthLabel}</Text>
                                <Pressable onPress={handleNextMonth} style={styles.calNavBtn}>
                                    <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
                                </Pressable>
                            </View>

                            <View style={styles.weekdaysRow}>
                                {WEEKDAYS.map((w, i) => (
                                    <Text key={i} style={[styles.weekdayCell, { color: colors.textSecondary }]}>{w}</Text>
                                ))}
                            </View>

                            <View style={styles.daysGrid}>
                                {daysArray.map((day, idx) => {
                                    if (day === null) {
                                        return <View key={`empty-${idx}`} style={styles.dayCellEmpty} />;
                                    }

                                    const dateObj = dayjs(viewedMonth).date(day);
                                    const isSelected = dateObj.isSame(dayjs(selectedDate), 'day');
                                    const isToday = dateObj.isSame(dayjs(), 'day');

                                    return (
                                        <Pressable
                                            key={`day-${day}`}
                                            onPress={() => handleSelectDay(day)}
                                            style={[
                                                styles.dayCell,
                                                isSelected && { backgroundColor: serviceBlue, borderRadius: 10 },
                                                !isSelected && isToday && { borderColor: serviceBlue, borderWidth: 1, borderRadius: 10 }
                                            ]}
                                        >
                                            <Text style={[
                                                styles.dayCellText,
                                                { color: isSelected ? '#FFF' : colors.text },
                                                !isSelected && isToday && { color: serviceBlue, fontWeight: '800' }
                                            ]}>
                                                {day}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    </BottomSheetView>
                </BottomSheet>
            )}

        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    keyboardView: { flex: 1 },
    // ScrollContent justifyContent space-between kaldırıldı, yerine doğal akış bırakıldı
    scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16 },
    formContainer: { gap: 12 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        gap: 6,
    },
    cardTitle: { fontSize: 12, fontWeight: '700' },

    typeToggleContainer: {
        flexDirection: 'row',
        borderRadius: 14,
        borderWidth: 1,
        padding: 4,
        gap: 6,
    },
    toggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 10,
    },
    toggleActiveBtn: {
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    toggleText: { fontSize: 13, fontWeight: '800' },

    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 48,
    },
    input: { flex: 1, fontSize: 14, fontWeight: '600', marginLeft: 8 },

    pickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 48,
        backgroundColor: 'rgba(0,0,0,0.01)',
    },
    pickerName: { flex: 1, fontSize: 14, fontWeight: '600', marginLeft: 10 },

    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        height: 50,
        marginTop: 24,
        marginBottom: 16, // Klavyeyi kapatınca altta kalan anlamsız boşluğu sıfırlamak için tatlı marj
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },

    sheetContent: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 6 },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 16,
    },
    sheetTitle: { fontSize: 15, fontWeight: '800' },
    tmplItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderWidth: 1,
        borderRadius: 12,
        marginBottom: 8,
        width: '100%',
    },
    tmplBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tmplName: { fontSize: 13, fontWeight: '700' },
    tmplType: { fontSize: 11, marginTop: 1 },

    inlineAddContainer: {
        flexDirection: 'row',
        width: '100%',
        gap: 8,
        marginBottom: 16,
        alignItems: 'center',
    },
    inlineInputContainer: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 42,
        justifyContent: 'center',
    },
    inlineInput: { fontSize: 13, fontWeight: '600' },
    inlineAddBtn: {
        width: 42,
        height: 42,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetSubHeaderContainer: {
        width: '100%',
        marginBottom: 8,
    },
    sheetSubTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

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

    calendarContainer: { width: '100%', marginTop: 8, gap: 12 },
    calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginBottom: 4 },
    calNavBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' },
    calendarMonthTitle: { fontSize: 14, fontWeight: '800' },

    weekdaysRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.05)', paddingBottom: 6 },
    weekdayCell: { width: '14.2%', textAlign: 'center', fontSize: 11, fontWeight: '700', opacity: 0.5 },

    daysGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
    dayCell: { width: '14.2%', height: 42, alignItems: 'center', justifyContent: 'center', marginVertical: 2 },
    dayCellEmpty: { width: '14.2%', height: 42 },
    dayCellText: { fontSize: 13, fontWeight: '600' },
});
