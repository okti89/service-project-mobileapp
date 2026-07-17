import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    Platform,
    Modal,
    KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import CustomInput from '@/components/CustomInput';
import { serviceBlue, serviceRed, serviceGreen } from '@/theme/color';

export default function ProductFormScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();

    const product = route?.params?.product;
    const isEdit = !!product;

    const [form, setForm] = useState({
        name: '',
        category_id: '',
        price: '',
        stock_quantity: '1',
        description: '',
    });
    const [imageUri, setImageUri] = useState(null);
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [errors, setErrors] = useState({});

    // Picker states
    const [pickerVisible, setPickerVisible] = useState(false);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                setLoadingCategories(true);
                const response = await api.get(ENDPOINTS.PRODUCTS.CATEGORIES);
                setCategories(Array.isArray(response?.data) ? response.data : []);
            } catch (error) {
                console.log('Categories load error:', error);
            } finally {
                setLoadingCategories(false);
            }
        };
        fetchCategories();

        if (isEdit) {
            setForm({
                name: product.name || '',
                category_id: product.category_detail?.id || '',
                price: product.price ? String(Number(product.price).toLocaleString('tr-TR')) : '',
                stock_quantity: String(product.stock_quantity || '0'),
                description: product.description || '',
            });
            if (product.image) {
                setImageUri(product.image);
            }
        }
    }, [isEdit, product]);

    const setField = (key, val) => {
        setForm(prev => ({ ...prev, [key]: val }));
        if (errors[key]) {
            setErrors(prev => ({ ...prev, [key]: null }));
        }
    };

    const handlePriceChange = (text) => {
        let clean = text.replace(/\D/g, '');
        if (!clean) {
            setField('price', '');
            return;
        }
        const formatted = Number(clean).toLocaleString('tr-TR');
        setField('price', formatted);
    };

    const requestPermissions = async () => {
        const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
        const galleryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
        return cameraStatus.granted && galleryStatus.granted;
    };

    const handleSelectImage = async (source) => {
        const hasPermission = await requestPermissions();
        if (!hasPermission) {
            Alert.alert('Yetki Gerekli', 'Kamera ve galeri izinlerini onaylamanız gerekmektedir.');
            return;
        }

        let result;
        const options = {
            mediaTypes: ImagePicker.Images,
            allowsEditing: false,
            quality: 0.8,
        };

        try {
            if (source === 'camera') {
                result = await ImagePicker.launchCameraAsync(options);
            } else {
                result = await ImagePicker.launchImageLibraryAsync(options);
            }

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setImageUri(result.assets[0].uri);
            }
        } catch (error) {
            console.log('Image picker error:', error);
            showToast('error', 'Hata', 'Fotoğraf seçilirken bir hata oluştu.');
        }
    };

    const validate = () => {
        const errs = {};
        if (!form.name.trim()) errs.name = 'Ürün adı zorunludur.';
        const cleanPrice = form.price.replace(/\./g, '');
        if (!cleanPrice.trim() || isNaN(cleanPrice) || Number(cleanPrice) < 0) {
            errs.price = 'Geçerli bir fiyat girin.';
        }
        if (!form.stock_quantity.trim() || isNaN(form.stock_quantity) || Number(form.stock_quantity) < 0) {
            errs.stock_quantity = 'Geçerli bir stok miktarı girin.';
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;

        setSaving(true);
        const formData = new FormData();
        formData.append('name', form.name.trim());
        const cleanPrice = form.price.replace(/\./g, '');
        formData.append('price', Number(cleanPrice));
        formData.append('stock_quantity', parseInt(form.stock_quantity, 10));
        formData.append('description', form.description.trim());
        if (form.category_id) {
            formData.append('category_id', form.category_id);
        }

        if (imageUri && !imageUri.startsWith('http')) {
            const filename = imageUri.split('/').pop();
            const match = /\.(\w+)$/.exec(filename || '');
            const type = match ? `image/${match[1]}` : `image`;
            formData.append('image', {
                uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
                name: filename || 'product.jpg',
                type,
            });
        }

        try {
            if (isEdit) {
                await api.patch(ENDPOINTS.PRODUCTS.DETAIL(product.id), formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                showToast('success', 'Ürün Güncellendi', 'Ürün bilgileri başarıyla güncellendi.');
            } else {
                await api.post(ENDPOINTS.PRODUCTS.LIST, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                showToast('success', 'Ürün Eklendi', 'Yeni ürün başarıyla eklendi.');
            }
            navigation.goBack();
        } catch (error) {
            console.log('Product save error:', error?.response?.data || error?.message || error);
            const responseData = error?.response?.data;
            if (responseData && typeof responseData === 'object') {
                if (responseData.detail) {
                    showToast('error', 'Hata', responseData.detail);
                } else {
                    const fieldErrors = {};
                    Object.keys(responseData).forEach(key => {
                        const msgs = responseData[key];
                        fieldErrors[key] = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
                    });
                    setErrors(fieldErrors);
                    showToast('error', 'Hata', 'Lütfen formu kontrol edin.');
                }
            } else {
                showToast('error', 'Hata', 'Ürün kaydedilemedi.');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Ürünü Sil',
            `"${form.name}" envanterden tamamen silinecektir. Emin misiniz?`,
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setDeleting(true);
                            await api.delete(ENDPOINTS.PRODUCTS.DETAIL(product.id));
                            showToast('success', 'Ürün Silindi', 'Ürün envanterden silindi.');
                            navigation.goBack();
                        } catch (error) {
                            showToast('error', 'Hata', error?.response?.data?.detail || 'Silme işlemi başarısız.');
                        } finally {
                            setDeleting(false);
                        }
                    },
                },
            ]
        );
    };

    const selectedCategoryName = categories.find(c => c.id === form.category_id)?.name || 'Kategori Seçilmedi';

    return (
        <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 8, alignItems: 'center' }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </Pressable>
                <View style={styles.headerTitleWrap}>
                    <Text style={[styles.headerTitleText, { color: colors.text }]} numberOfLines={1}>
                        {isEdit ? 'Ürünü Düzenle' : 'Yeni Ürün'}
                    </Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textTertiary }]} numberOfLines={1}>
                        {isEdit ? 'Ürün bilgilerini güncelle' : 'Envantere yeni ürün ekle'}
                    </Text>
                </View>
                <Pressable onPress={handleSave} disabled={saving} style={styles.backBtn}>
                    {saving ? (
                        <ActivityIndicator size="small" color={serviceBlue} />
                    ) : (
                        <MaterialCommunityIcons name="check" size={24} color={serviceBlue} />
                    )}
                </Pressable>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 20}
            >
                <ScrollView
                    style={styles.body}
                    contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 140 }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Image Upload Area */}
                    <View style={[styles.imageUploadArea, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {imageUri ? (
                             <View style={styles.previewContainer}>
                                 <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                                 <Pressable
                                     onPress={() => setImageUri(null)}
                                     style={styles.deleteImageBtn}
                                 >
                                     <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FFFFFF" />
                                 </Pressable>
                             </View>
                        ) : (
                             <View style={styles.inlineSourceContainer}>
                                 <Text style={[styles.uploadTitle, { color: colors.text, marginBottom: 12 }]}>Ürün Görseli Ekle</Text>
                                 <View style={styles.inlineButtonsRow}>
                                     <Pressable
                                         onPress={() => handleSelectImage('camera')}
                                         style={[styles.inlineSourceBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: colors.border }]}
                                     >
                                         <MaterialCommunityIcons name="camera" size={18} color={serviceBlue} />
                                         <Text style={[styles.inlineSourceBtnText, { color: colors.text }]}>Kamera</Text>
                                     </Pressable>

                                     <Pressable
                                         onPress={() => handleSelectImage('gallery')}
                                         style={[styles.inlineSourceBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: colors.border }]}
                                     >
                                         <MaterialCommunityIcons name="image-multiple" size={18} color={serviceGreen} />
                                         <Text style={[styles.inlineSourceBtnText, { color: colors.text }]}>Galeri</Text>
                                     </Pressable>
                                 </View>
                             </View>
                        )}
                    </View>

                    {/* Form Cards */}
                    <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <CustomInput
                            label="Ürün Adı *"
                            icon="package-variant"
                            value={form.name}
                            onChangeText={v => setField('name', v)}
                            placeholder="Ürün veya yedek parça adı"
                            error={errors.name}
                            disableSmartFormat={true}
                        />

                        {/* Category Picker Selector */}
                        <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>Kategori</Text>
                        <Pressable
                            onPress={() => setPickerVisible(true)}
                            style={[styles.selectorBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                            <MaterialCommunityIcons name="tag-outline" size={20} color={colors.textTertiary} style={{ marginRight: 8 }} />
                            <Text style={[styles.selectorBtnText, { color: form.category_id ? colors.text : colors.textTertiary }]}>
                                {selectedCategoryName}
                            </Text>
                            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textTertiary} />
                        </Pressable>
                        {errors.category_id && <Text style={styles.errorText}>{errors.category_id}</Text>}

                        <CustomInput
                            label="Birim Fiyat (₺) *"
                            icon="cash"
                            value={form.price}
                            onChangeText={handlePriceChange}
                            placeholder="Satış fiyatı (örn: 1.200)"
                            keyboardType="numeric"
                            error={errors.price}
                            disableSmartFormat={true}
                        />

                        <CustomInput
                            label="Stok Miktarı *"
                            icon="archive-outline"
                            value={form.stock_quantity}
                            onChangeText={v => setField('stock_quantity', v)}
                            placeholder="Mevcut stok adedi"
                            keyboardType="numeric"
                            error={errors.stock_quantity}
                            disableSmartFormat={true}
                        />

                        <CustomInput
                            label="Açıklama"
                            icon="information-outline"
                            value={form.description}
                            onChangeText={v => setField('description', v)}
                            placeholder="Ürün hakkında ek detaylar..."
                            multiline
                            numberOfLines={3}
                            inputContainerStyle={{ height: 90, alignItems: 'flex-start', paddingTop: 8 }}
                            style={{ textAlignVertical: 'top', height: 80, color: colors.text }}
                            disableSmartFormat={true}
                        />
                    </View>

                    {/* Actions */}
                    <View style={styles.actionsRow}>
                        {isEdit && (
                            <Pressable
                                onPress={handleDelete}
                                disabled={deleting}
                                style={({ pressed }) => [
                                    styles.deleteBtn,
                                    { borderColor: `${serviceRed}40` },
                                    pressed && styles.btnPressed,
                                ]}
                            >
                                {deleting ? (
                                    <ActivityIndicator size="small" color={serviceRed} />
                                ) : (
                                    <>
                                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={serviceRed} />
                                        <Text style={[styles.deleteBtnText, { color: serviceRed }]}>Sil</Text>
                                    </>
                                )}
                            </Pressable>
                        )}
                        <Pressable
                            onPress={handleSave}
                            disabled={saving}
                            style={({ pressed }) => [
                                styles.saveBtn,
                                { backgroundColor: serviceBlue },
                                pressed && styles.btnPressed,
                            ]}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons
                                        name={isEdit ? 'content-save-outline' : 'plus'}
                                        size={20}
                                        color="#FFFFFF"
                                    />
                                    <Text style={styles.saveBtnText}>
                                        {isEdit ? 'Değişiklikleri Kaydet' : 'Ürünü Ekle'}
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Category Dropdown Picker Modal */}
            <Modal
                visible={pickerVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setPickerVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: '60%' }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Kategori Seçin</Text>
                            <Pressable onPress={() => setPickerVisible(false)} style={styles.closeBtn}>
                                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                            </Pressable>
                        </View>
                        {loadingCategories ? (
                            <View style={{ padding: 24, alignItems: 'center' }}>
                                <ActivityIndicator size="small" color={serviceBlue} />
                            </View>
                        ) : (
                            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
                                <Pressable
                                    onPress={() => {
                                        setField('category_id', '');
                                        setPickerVisible(false);
                                    }}
                                    style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                                >
                                    <Text style={[styles.pickerItemText, { color: !form.category_id ? serviceBlue : colors.text }]}>
                                        Kategorisiz (Boş)
                                    </Text>
                                </Pressable>
                                {categories.map(c => (
                                    <Pressable
                                        key={c.id}
                                        onPress={() => {
                                            setField('category_id', c.id);
                                            setPickerVisible(false);
                                        }}
                                        style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                                    >
                                        <Text style={[styles.pickerItemText, { color: form.category_id === c.id ? serviceBlue : colors.text }]}>
                                            {c.name}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

        </View>
    );
}



const styles = StyleSheet.create({
    screen: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitleWrap: { flex: 1, alignItems: 'center', minWidth: 0 },
    headerTitleText: { fontSize: 18, fontWeight: '900' },
    headerSubtitle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
    body: { flex: 1 },
    bodyContent: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },
    imageUploadArea: {
        height: 180,
        borderRadius: 16,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 0,
        overflow: 'hidden',
    },
    previewContainer: { width: '100%', height: '100%' },
    imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
    editImageOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    editImageText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    uploadPlaceholder: { alignItems: 'center', justifyContent: 'center', padding: 16 },
    uploadIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    uploadTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
    uploadDesc: { fontSize: 11, fontWeight: '600' },
    formCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 0 },
    selectorLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3, marginBottom: 7, marginLeft: 2 },
    selectorBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 48,
        borderWidth: 1.5,
        borderRadius: 14,
        paddingHorizontal: 12,
        marginBottom: 14,
    },
    selectorBtnText: { flex: 1, fontSize: 14, fontWeight: '700' },
    errorText: { fontSize: 12, color: serviceRed, fontWeight: '600', marginTop: -10, marginBottom: 12, marginLeft: 2 },
    actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
    saveBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 52,
        borderRadius: 14,
    },
    saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 52,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1.5,
    },
    deleteBtnText: { fontSize: 14, fontWeight: '800' },
    btnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    // Modal & Source selectors
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        paddingHorizontal: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    modalTitle: { fontSize: 16, fontWeight: '900' },
    closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    pickerItem: { paddingVertical: 16, borderBottomWidth: 1, width: '100%' },
    pickerItemText: { fontSize: 15, fontWeight: '700' },
    deleteImageBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inlineSourceContainer: {
        width: '100%',
        alignItems: 'center',
        padding: 16,
    },
    inlineButtonsRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        justifyContent: 'center',
    },
    inlineSourceBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1.5,
    },
    inlineSourceBtnText: {
        fontSize: 13,
        fontWeight: '800',
    },
});
