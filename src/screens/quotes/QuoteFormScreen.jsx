import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dayjs from 'dayjs';

import DateTimePickerSheet from '@/components/DateTimePickerSheet';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import customerService from '@/services/customerService';
import productService from '@/services/productService';
import quoteService from '@/services/quoteService';
import { serviceBlue, serviceRed } from '@/theme/color';

const newItem = () => ({ key: `${Date.now()}-${Math.random()}`, product: null, name: '', description: '', quantity: '1', unit_price: '' });
const numberValue = (value) => Number(String(value || '0').replace(',', '.')) || 0;
const money = (value) => `${numberValue(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

const errorMessage = (error, fallback) => {
    const data = error?.response?.data;
    if (typeof data?.detail === 'string') return data.detail;
    if (typeof data === 'object' && data) {
        const first = Object.values(data)[0];
        if (Array.isArray(first)) return String(first[0]);
        if (typeof first === 'string') return first;
    }
    return fallback;
};

function PickerModal({ visible, title, items, search, onSearch, renderLabel, renderMeta, onSelect, onClose, colors }) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
                        <Pressable onPress={onClose} style={styles.modalClose}><MaterialCommunityIcons name="close" size={22} color={colors.text} /></Pressable>
                    </View>
                    <View style={[styles.modalSearch, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                        <MaterialCommunityIcons name="magnify" size={19} color={colors.textTertiary} />
                        <TextInput value={search} onChangeText={onSearch} placeholder="Ara..." placeholderTextColor={colors.textTertiary} style={[styles.modalSearchInput, { color: colors.text }]} />
                    </View>
                    <FlatList
                        data={items}
                        keyExtractor={(item) => String(item.id)}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <Pressable onPress={() => onSelect(item)} style={({ pressed }) => [styles.modalOption, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
                                <View style={styles.modalOptionText}>
                                    <Text style={[styles.modalOptionTitle, { color: colors.text }]}>{renderLabel(item)}</Text>
                                    {!!renderMeta(item) && <Text style={[styles.modalOptionMeta, { color: colors.textSecondary }]} numberOfLines={1}>{renderMeta(item)}</Text>}
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
                            </Pressable>
                        )}
                        ListEmptyComponent={<Text style={[styles.modalEmpty, { color: colors.textSecondary }]}>Kayıt bulunamadı.</Text>}
                    />
                </View>
            </View>
        </Modal>
    );
}

export default function QuoteFormScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { showToast } = useToast();
    const quoteId = route.params?.quoteId || route.params?.quote?.id;
    const isEdit = Boolean(quoteId);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [customer, setCustomer] = useState(null);
    const [validUntil, setValidUntil] = useState(null);
    const [note, setNote] = useState('');
    const [items, setItems] = useState([newItem()]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [customerModal, setCustomerModal] = useState(false);
    const [productItemIndex, setProductItemIndex] = useState(null);
    const [dateModal, setDateModal] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const [customerData, productData, quoteData] = await Promise.all([
                    customerService.listCustomers(),
                    productService.getProducts(),
                    isEdit ? quoteService.get(quoteId) : Promise.resolve(null),
                ]);
                if (!active) return;
                setCustomers(customerData);
                setProducts(productData);
                if (quoteData) {
                    setCustomer(quoteData.customer_detail || customerData.find((entry) => String(entry.id) === String(quoteData.customer)) || null);
                    setValidUntil(quoteData.valid_until ? dayjs(quoteData.valid_until).toDate() : null);
                    setNote(quoteData.note || '');
                    const loadedItems = (quoteData.items || []).map((item) => ({ ...item, key: String(item.id), product: item.product || null, quantity: String(item.quantity || 1), unit_price: String(item.unit_price ?? '') }));
                    setItems(loadedItems.length ? loadedItems : [newItem()]);
                }
            } catch (error) {
                showToast('error', 'Form yüklenemedi', errorMessage(error, 'Gerekli bilgiler alınamadı.'));
                navigation.goBack();
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => { active = false; };
    }, [isEdit, navigation, quoteId, showToast]);

    const updateItem = (index, field, value) => {
        setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
    };

    const removeItem = (index) => {
        if (items.length === 1) {
            showToast('warning', 'Kalem gerekli', 'Teklifte en az bir kalem bulunmalıdır.');
            return;
        }
        setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    };

    const total = useMemo(() => items.reduce((sum, item) => sum + numberValue(item.quantity) * numberValue(item.unit_price), 0), [items]);

    const customerOptions = useMemo(() => {
        const query = pickerSearch.trim().toLocaleLowerCase('tr-TR');
        return customers.filter((item) => !query || [item.full_name, item.phone_number].some((value) => String(value || '').toLocaleLowerCase('tr-TR').includes(query)));
    }, [customers, pickerSearch]);

    const productOptions = useMemo(() => {
        const query = pickerSearch.trim().toLocaleLowerCase('tr-TR');
        return products.filter((item) => !query || [item.name, item.code].some((value) => String(value || '').toLocaleLowerCase('tr-TR').includes(query)));
    }, [products, pickerSearch]);

    const selectProduct = (product) => {
        setItems((current) => current.map((item, index) => index === productItemIndex ? {
            ...item,
            product: product.id,
            name: product.name || '',
            unit_price: String(product.price ?? ''),
        } : item));
        setProductItemIndex(null);
        setPickerSearch('');
    };

    const validate = () => {
        if (!customer?.id) return 'Müşteri seçmelisiniz.';
        if (!items.length) return 'En az bir teklif kalemi eklemelisiniz.';
        for (let index = 0; index < items.length; index += 1) {
            const item = items[index];
            if (!String(item.name || '').trim()) return `${index + 1}. kalemin adı zorunludur.`;
            if (numberValue(item.quantity) < 1) return `${index + 1}. kalemin adedi en az 1 olmalıdır.`;
            if (String(item.unit_price ?? '').trim() === '' || numberValue(item.unit_price) < 0) return `${index + 1}. kalemin birim fiyatını girin.`;
        }
        return null;
    };

    const save = async () => {
        const validationError = validate();
        if (validationError) {
            showToast('warning', 'Formu kontrol edin', validationError);
            return;
        }
        setSaving(true);
        const payload = {
            customer: customer.id,
            valid_until: validUntil ? dayjs(validUntil).format('YYYY-MM-DD') : null,
            note: note.trim(),
            items: items.map((item) => ({
                product: item.product || null,
                name: String(item.name || '').trim(),
                description: String(item.description || '').trim(),
                quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
                unit_price: numberValue(item.unit_price).toFixed(2),
            })),
        };
        try {
            const saved = isEdit ? await quoteService.update(quoteId, payload) : await quoteService.create(payload);
            showToast('success', isEdit ? 'Teklif güncellendi' : 'Teklif oluşturuldu', saved.quote_number || 'Teklif başarıyla kaydedildi.');
            if (isEdit) {
                navigation.goBack();
            } else {
                navigation.replace('AdminQuoteDetail', { quoteId: saved.id, quote: saved });
            }
        } catch (error) {
            showToast('error', 'Teklif kaydedilemedi', errorMessage(error, 'Form bilgilerini kontrol edin.'));
        } finally {
            setSaving(false);
        }
    };

    const deleteQuote = () => Alert.alert('Teklifi Sil', 'Bu teklif kalıcı olarak silinecek. Emin misiniz?', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Sil', style: 'destructive', onPress: async () => {
            try {
                await quoteService.remove(quoteId);
                showToast('success', 'Teklif silindi', 'Teklif kaydı kaldırıldı.');
                navigation.popTo('AdminQuotes');
            } catch (error) {
                showToast('error', 'Silinemedi', errorMessage(error, 'Teklif silinemedi.'));
            }
        } },
    ]);

    if (loading) return <View style={[styles.screen, styles.center, { backgroundColor: colors.backgroundSecondary }]}><ActivityIndicator size="large" color={serviceBlue} /></View>;

    return (
        <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerButton}><MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} /></Pressable>
                <View style={styles.headerTitleWrap}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{isEdit ? 'Teklifi Düzenle' : 'Yeni Teklif'}</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Müşteri ve teklif kalemleri</Text>
                </View>
                <Pressable onPress={save} disabled={saving} style={styles.headerButton}>{saving ? <ActivityIndicator size="small" color={serviceBlue} /> : <MaterialCommunityIcons name="check" size={24} color={serviceBlue} />}</Pressable>
            </View>

            <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 16}>
                <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>TEKLİF BİLGİLERİ</Text>
                    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Müşteri *</Text>
                        <Pressable onPress={() => { setPickerSearch(''); setCustomerModal(true); }} style={[styles.selector, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                            <MaterialCommunityIcons name="account-outline" size={20} color={serviceBlue} />
                            <View style={styles.selectorText}><Text style={[styles.selectorTitle, { color: customer ? colors.text : colors.textTertiary }]}>{customer?.full_name || 'Müşteri seçin'}</Text>{customer?.phone_number ? <Text style={[styles.selectorMeta, { color: colors.textSecondary }]}>{customer.phone_number}</Text> : null}</View>
                            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textTertiary} />
                        </Pressable>

                        <Text style={[styles.label, { color: colors.textSecondary }]}>Geçerlilik Tarihi</Text>
                        <View style={styles.dateRow}>
                            <Pressable onPress={() => setDateModal(true)} style={[styles.selector, styles.dateSelector, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                                <MaterialCommunityIcons name="calendar-outline" size={20} color={serviceBlue} />
                                <Text style={[styles.selectorTitle, { color: validUntil ? colors.text : colors.textTertiary }]}>{validUntil ? dayjs(validUntil).format('DD.MM.YYYY') : 'Tarih seçilmedi'}</Text>
                            </Pressable>
                            {!!validUntil && <Pressable onPress={() => setValidUntil(null)} style={[styles.clearDate, { borderColor: colors.border }]}><MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} /></Pressable>}
                        </View>

                        <Text style={[styles.label, { color: colors.textSecondary }]}>Not</Text>
                        <TextInput value={note} onChangeText={setNote} placeholder="Teklifle ilgili kısa not" placeholderTextColor={colors.textTertiary} multiline style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]} />
                    </View>

                    <View style={styles.itemsHeader}>
                        <View><Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 2 }]}>TEKLİF KALEMLERİ</Text><Text style={[styles.itemsHint, { color: colors.textTertiary }]}>{items.length} kalem</Text></View>
                        <Pressable onPress={() => setItems((current) => [...current, newItem()])} style={[styles.addItemButton, { backgroundColor: `${serviceBlue}14` }]}><MaterialCommunityIcons name="plus" size={18} color={serviceBlue} /><Text style={styles.addItemText}>Kalem Ekle</Text></Pressable>
                    </View>

                    {items.map((item, index) => (
                        <View key={item.key} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={styles.itemCardHeader}><Text style={[styles.itemNumber, { color: colors.text }]}>Kalem {index + 1}</Text><Pressable onPress={() => removeItem(index)} hitSlop={10}><MaterialCommunityIcons name="trash-can-outline" size={20} color={serviceRed} /></Pressable></View>
                            <View style={styles.productSelectorRow}>
                                <Pressable onPress={() => { setPickerSearch(''); setProductItemIndex(index); }} style={[styles.productSelector, { borderColor: colors.border }]}><MaterialCommunityIcons name="package-variant" size={18} color={serviceBlue} /><Text style={[styles.productSelectorText, { color: item.product ? colors.text : colors.textSecondary }]} numberOfLines={1}>{item.product ? products.find((product) => String(product.id) === String(item.product))?.name || item.name : 'Ürün seç (isteğe bağlı)'}</Text><MaterialCommunityIcons name="chevron-down" size={18} color={colors.textTertiary} /></Pressable>
                                {!!item.product && <Pressable accessibilityLabel="Ürün bağlantısını kaldır" onPress={() => updateItem(index, 'product', null)} style={[styles.clearProduct, { borderColor: colors.border }]}><MaterialCommunityIcons name="link-off" size={18} color={colors.textSecondary} /></Pressable>}
                            </View>
                            <TextInput value={item.name} onChangeText={(value) => updateItem(index, 'name', value)} placeholder="Kalem adı *" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
                            <TextInput value={item.description} onChangeText={(value) => updateItem(index, 'description', value)} placeholder="Açıklama" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
                            <View style={styles.itemFieldsRow}>
                                <View style={styles.smallField}><Text style={[styles.label, { color: colors.textSecondary }]}>Adet</Text><TextInput value={item.quantity} onChangeText={(value) => updateItem(index, 'quantity', value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={[styles.input, { color: colors.text, borderColor: colors.border }]} /></View>
                                <View style={styles.priceField}><Text style={[styles.label, { color: colors.textSecondary }]}>Birim Fiyat</Text><TextInput value={item.unit_price} onChangeText={(value) => updateItem(index, 'unit_price', value.replace(/[^0-9,.]/g, ''))} keyboardType="decimal-pad" style={[styles.input, { color: colors.text, borderColor: colors.border }]} /></View>
                                <View style={styles.lineTotal}><Text style={[styles.label, { color: colors.textSecondary }]}>Toplam</Text><Text style={[styles.lineTotalText, { color: colors.text }]}>{money(numberValue(item.quantity) * numberValue(item.unit_price))}</Text></View>
                            </View>
                        </View>
                    ))}

                    <View style={[styles.totalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Teklif Toplamı</Text><Text style={[styles.totalValue, { color: serviceBlue }]}>{money(total)}</Text></View>

                    <View style={styles.actions}>{isEdit && <Pressable onPress={deleteQuote} style={[styles.deleteButton, { borderColor: `${serviceRed}40` }]}><MaterialCommunityIcons name="trash-can-outline" size={19} color={serviceRed} /><Text style={styles.deleteText}>Sil</Text></Pressable>}<Pressable onPress={save} disabled={saving} style={[styles.saveButton, { backgroundColor: serviceBlue }]}>{saving ? <ActivityIndicator size="small" color="#FFF" /> : <><MaterialCommunityIcons name="content-save-outline" size={20} color="#FFF" /><Text style={styles.saveText}>{isEdit ? 'Kaydet' : 'Teklifi Oluştur'}</Text></>}</Pressable></View>
                </ScrollView>
            </KeyboardAvoidingView>

            <PickerModal visible={customerModal} title="Müşteri Seç" items={customerOptions} search={pickerSearch} onSearch={setPickerSearch} renderLabel={(item) => item.full_name || 'Müşteri'} renderMeta={(item) => item.phone_number || item.email || ''} onSelect={(item) => { setCustomer(item); setCustomerModal(false); setPickerSearch(''); }} onClose={() => setCustomerModal(false)} colors={colors} />
            <PickerModal visible={productItemIndex !== null} title="Ürün Seç" items={productOptions} search={pickerSearch} onSearch={setPickerSearch} renderLabel={(item) => item.name || 'Ürün'} renderMeta={(item) => `${item.code || 'Kodsuz'} · ${money(item.price)}`} onSelect={selectProduct} onClose={() => setProductItemIndex(null)} colors={colors} />
            <DateTimePickerSheet dateOnly visible={dateModal} value={validUntil || dayjs().add(7, 'day').toDate()} onChange={(date) => setValidUntil(date)} onClose={() => setDateModal(false)} />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 }, center: { alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 10 },
    headerButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
    headerTitleWrap: { flex: 1, alignItems: 'center', minWidth: 0 }, headerTitle: { fontSize: 18, fontWeight: '900' }, headerSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
    content: { paddingHorizontal: 16, paddingTop: 6 }, sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
    section: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 18 }, label: { fontSize: 11, fontWeight: '800', marginBottom: 6 },
    selector: { minHeight: 52, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 },
    selectorText: { flex: 1, minWidth: 0 }, selectorTitle: { fontSize: 14, fontWeight: '700' }, selectorMeta: { fontSize: 11, fontWeight: '600', marginTop: 2 },
    dateRow: { flexDirection: 'row', gap: 8 }, dateSelector: { flex: 1 }, clearDate: { width: 52, height: 52, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    textArea: { minHeight: 88, borderWidth: 1, borderRadius: 13, padding: 12, fontSize: 14, textAlignVertical: 'top' },
    itemsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }, itemsHint: { fontSize: 11, fontWeight: '600' },
    addItemButton: { height: 38, borderRadius: 11, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5 }, addItemText: { color: serviceBlue, fontSize: 12, fontWeight: '800' },
    itemCard: { borderWidth: 1, borderRadius: 16, padding: 13, marginBottom: 10 }, itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, itemNumber: { fontSize: 14, fontWeight: '900' },
    productSelectorRow: { flexDirection: 'row', gap: 8 }, productSelector: { flex: 1, height: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 }, productSelectorText: { flex: 1, fontSize: 13, fontWeight: '700' }, clearProduct: { width: 46, height: 46, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    input: { height: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, fontSize: 14, fontWeight: '600', marginBottom: 9 }, itemFieldsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 }, smallField: { width: 62 }, priceField: { flex: 1 }, lineTotal: { flex: 1, minWidth: 0, paddingBottom: 19, alignItems: 'flex-end' }, lineTotalText: { fontSize: 13, fontWeight: '900' },
    totalCard: { borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }, totalLabel: { fontSize: 13, fontWeight: '800' }, totalValue: { fontSize: 21, fontWeight: '900' },
    actions: { flexDirection: 'row', gap: 10, marginTop: 14 }, saveButton: { flex: 1, height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, saveText: { color: '#FFF', fontSize: 15, fontWeight: '900' }, deleteButton: { height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 6 }, deleteText: { color: serviceRed, fontSize: 14, fontWeight: '800' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' }, modalCard: { maxHeight: '78%', minHeight: '48%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 24 },
    modalHeader: { height: 58, borderBottomWidth: 1, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, modalTitle: { fontSize: 17, fontWeight: '900' }, modalClose: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    modalSearch: { height: 46, margin: 14, marginBottom: 4, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, modalSearchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
    modalOption: { minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }, modalOptionText: { flex: 1, minWidth: 0 }, modalOptionTitle: { fontSize: 14, fontWeight: '800' }, modalOptionMeta: { fontSize: 11, fontWeight: '600', marginTop: 3 }, modalEmpty: { padding: 30, textAlign: 'center', fontSize: 13 },
});
