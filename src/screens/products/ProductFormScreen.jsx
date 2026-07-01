import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    TextInput
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import CustomInput from '@/components/CustomInput';
import { serviceBlue, serviceGreen, serviceRed } from '@/theme/color';

const getImageUrl = (image) => {
    if (!image) return null;
    if (String(image).startsWith('http')) return image;
    const apiRoot = String(api.defaults.baseURL || '').replace(/\/api\/?$/, '');
    const normalized = String(image).startsWith('/') ? image : `/${image}`;
    return `${apiRoot}${normalized}`;
};

const getUploadFile = (uri) => {
    const cleanUri = String(uri || '').split('?')[0];
    const rawName = cleanUri.split('/').pop() || '';
    const hasExtension = /\.[a-z0-9]+$/i.test(rawName);
    const name = hasExtension ? rawName : `product_${Date.now()}.jpg`;
    const ext = name.split('.').pop()?.toLowerCase();
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return { uri, name, type };
};

const Input = ({ label, icon, value, onChangeText, placeholder, error, multiline, number }) => {
    const { colors } = useTheme();
    return (
        <View style={styles.fieldWrap}>
            <View style={styles.fieldLabel}>
                <MaterialCommunityIcons name={icon} size={16} color={error ? serviceRed : colors.textSecondary} />
                <Text style={[styles.fieldLabelText, { color: error ? serviceRed : colors.textSecondary }]}>{label}</Text>
            </View>
            <View style={[styles.inputWrap, { borderColor: error ? serviceRed : colors.border, backgroundColor: colors.background }]}>
                <TextInput
                    style={[styles.input, { color: colors.text }, multiline && styles.textArea]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textTertiary}
                    multiline={multiline}
                    numberOfLines={number || 3}
                />
            </View>
            {error && (
                <View style={styles.errorRow}>
                    <MaterialCommunityIcons name="alert-circle" size={14} color={serviceRed} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}
        </View>
    );
};

export default function ProductFormScreen({ navigation, route }) {
    const { product } = route.params || {};
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();

    const isEdit = Boolean(product);

    const [form, setForm] = useState({
        name: '',
        category_id: null,
        price: '',
        stock_quantity: '',
        description: '',
    });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [categories, setCategories] = useState([]);
    const [loadingCats, setLoadingCats] = useState(true);
    const [selectedImage, setSelectedImage] = useState(null);

    useEffect(() => {
        if (isEdit && product) {
            setForm({
                name: product.name || '',
                category_id: product.category_detail?.id || null,
                price: product.price?.toString() || '',
                stock_quantity: product.stock_quantity?.toString() || '',
                description: product.description || '',
            });
        }
    }, [isEdit, product]);

    const fetchCategories = useCallback(async () => {
        try {
            const response = await api.get(ENDPOINTS.PRODUCTS.CATEGORIES);
            setCategories(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.log('Categories fetch error:', error?.response?.data || error?.message || error);
        } finally {
            setLoadingCats(false);
        }
    }, []);

    useEffect(() => { fetchCategories(); }, [fetchCategories]);

    const setField = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
        if (errors[key]) {
            setErrors(prev => ({ ...prev, [key]: null }));
        }
    };

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Izni yok', 'Galeri erisimi icin izin gerekli');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                setSelectedImage(result.assets[0].uri);
            }
        } catch (error) {
            Alert.alert('Hata', 'Gorsel secilemedi');
        }
    };

    const takeImage = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Izni yok', 'Kamera erisimi icin izin gerekli');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                setSelectedImage(result.assets[0].uri);
            }
        } catch (error) {
            Alert.alert('Hata', 'Kamera acilamadi');
        }
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            setErrors({ name: 'Urun adi gerekli' });
            return;
        }

        setSaving(true);
        setErrors({});

        try {
            if (selectedImage) {
                const formData = new FormData();
                formData.append('name', form.name.trim());
                if (form.category_id) formData.append('category_id', form.category_id);
                formData.append('price', String(parseFloat(form.price) || 0));
                formData.append('stock_quantity', String(parseInt(form.stock_quantity, 10) || 0));
                formData.append('description', form.description.trim());

                formData.append('image', getUploadFile(selectedImage));

                if (isEdit) {
                    await api.patch(ENDPOINTS.PRODUCTS.DETAIL(product.id), formData);
                } else {
                    await api.post(ENDPOINTS.PRODUCTS.LIST, formData);
                }
            } else {
                const payload = {
                    name: form.name.trim(),
                    category_id: form.category_id || null,
                    price: parseFloat(form.price) || 0,
                    stock_quantity: parseInt(form.stock_quantity, 10) || 0,
                    description: form.description.trim(),
                };
                if (isEdit) {
                    await api.patch(ENDPOINTS.PRODUCTS.DETAIL(product.id), payload);
                } else {
                    await api.post(ENDPOINTS.PRODUCTS.LIST, payload);
                }
            }
            Alert.alert('Basarili', isEdit ? 'Urun guncellendi' : 'Urun olusturuldu');
            navigation.goBack();
        } catch (error) {
            const data = error?.response?.data;
            if (data && typeof data === 'object') {
                if (data.detail) {
                    Alert.alert('Hata', data.detail);
                } else {
                    const fieldErrors = {};
                    Object.keys(data).forEach(key => {
                        fieldErrors[key] = Array.isArray(data[key]) ? data[key].join(', ') : data[key];
                    });
                    if (Object.keys(fieldErrors).length > 0) {
                        setErrors(fieldErrors);
                    } else {
                        Alert.alert('Hata', 'Kaydetme basarisiz');
                    }
                }
            } else {
                Alert.alert('Hata', 'Sunucu hatasi olustu');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    {isEdit ? 'Urun Düzenle' : 'Yeni Urun'}
                </Text>
                <Pressable onPress={handleSave} disabled={saving} style={styles.headerBtn}>
                    {saving ? (
                        <ActivityIndicator size="small" color={serviceBlue} />
                    ) : (
                        <MaterialCommunityIcons name="check" size={24} color={serviceBlue} />
                    )}
                </Pressable>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView
                    style={styles.body}
                    contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 20 }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[styles.imageSection, { backgroundColor: colors.surface }]}>
                        <View style={styles.imagePicker}>
                            {selectedImage || product?.image ? (
                                <Image
                                    source={{ uri: selectedImage || getImageUrl(product.image) }}
                                    style={styles.productImage}
                                />
                            ) : (
                                <View style={[styles.imagePlaceholder, { backgroundColor: `${serviceBlue}15` }]}>
                                    <MaterialCommunityIcons name="camera-plus" size={36} color={serviceBlue} />
                                    <Text style={[styles.imageHint, { color: serviceBlue }]}>Urun Fotografi Ekle</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.imageActions}>
                            <Pressable onPress={pickImage} style={[styles.imageActionBtn, { backgroundColor: `${serviceBlue}15` }]}>
                                <MaterialCommunityIcons name="image-multiple-outline" size={18} color={serviceBlue} />
                                <Text style={[styles.imageActionText, { color: serviceBlue }]}>Galeri</Text>
                            </Pressable>
                            <Pressable onPress={takeImage} style={[styles.imageActionBtn, { backgroundColor: `${serviceGreen}15` }]}>
                                <MaterialCommunityIcons name="camera-outline" size={18} color={serviceGreen} />
                                <Text style={[styles.imageActionText, { color: serviceGreen }]}>Kamera</Text>
                            </Pressable>
                        </View>
                    </View>

                    <CustomInput
                        label="Urun Adi *"
                        icon="package-variant"
                        value={form.name}
                        onChangeText={v => setField('name', v)}
                        placeholder="Urunun adi"
                        error={errors.name}
                    />

                    <View style={styles.fieldWrap}>
                        <View style={styles.fieldLabel}>
                            <MaterialCommunityIcons name="folder-outline" size={16} color={colors.textSecondary} />
                            <Text style={[styles.fieldLabelText, { color: colors.textSecondary }]}>Kategori</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                            <View style={styles.categoryRow}>
                                <Pressable
                                    onPress={() => setField('category_id', null)}
                                    style={[
                                        styles.categoryChip,
                                        {
                                            backgroundColor: !form.category_id ? `${serviceBlue}20` : colors.surface,
                                            borderColor: !form.category_id ? serviceBlue : colors.border,
                                        }
                                    ]}
                                >
                                    <Text style={[styles.categoryChipText, { color: !form.category_id ? serviceBlue : colors.textSecondary }]}>
                                        Kategorisiz
                                    </Text>
                                </Pressable>
                                {categories.map(cat => (
                                    <Pressable
                                        key={cat.id}
                                        onPress={() => setField('category_id', cat.id)}
                                        style={[
                                            styles.categoryChip,
                                            {
                                                backgroundColor: form.category_id === cat.id ? `${serviceBlue}20` : colors.surface,
                                                borderColor: form.category_id === cat.id ? serviceBlue : colors.border,
                                            }
                                        ]}
                                    >
                                        <Text style={[styles.categoryChipText, { color: form.category_id === cat.id ? serviceBlue : colors.textSecondary }]}>
                                            {cat.name}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </ScrollView>
                    </View>

                    <View style={styles.priceStockRow}>
                        <View style={{ flex: 1 }}>
                            <CustomInput
                                label="Fiyat (₺)"
                                icon="currency-try"
                                value={form.price}
                                onChangeText={v => setField('price', v)}
                                placeholder="0.00"
                                error={errors.price}
                            />
                        </View>
                        <View style={{ width: 16 }} />
                        <View style={{ flex: 1 }}>
                            <CustomInput
                                label="Stok Adedi"
                                icon="numeric"
                                value={form.stock_quantity}
                                onChangeText={v => setField('stock_quantity', v)}
                                placeholder="0"
                                error={errors.stock_quantity}
                            />
                        </View>
                    </View>

                    <Input
                        label="Aciklama"
                        icon="text"
                        value={form.description}
                        onChangeText={v => setField('description', v)}
                        placeholder="Urun ile ilgili notlar..."
                        multiline
                    />

                    <Pressable
                        onPress={handleSave}
                        disabled={saving}
                        style={[styles.saveBtn, { backgroundColor: serviceBlue }]}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <MaterialCommunityIcons name={isEdit ? 'content-save-outline' : 'plus'} size={20} color="#fff" />
                                <Text style={styles.saveBtnText}>
                                    {isEdit ? 'Kaydet' : 'Olustur'}
                                </Text>
                            </>
                        )}
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    body: { flex: 1 },
    bodyContent: { padding: 16 },
    imageSection: { borderRadius: 16, padding: 16, marginBottom: 16, alignItems: 'center' },
    imagePicker: { width: 160, height: 160, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    imagePlaceholder: { width: 120, height: 120, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed' },
    imagePreview: { width: 120, height: 120, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    productImage: { width: '100%', height: '100%', borderRadius: 18 },
    imageHint: { fontSize: 12, fontWeight: '600', marginTop: 8 },
    imageActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    imageActionBtn: { minWidth: 108, minHeight: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 12 },
    imageActionText: { fontSize: 12, fontWeight: '800' },
    imageNote: { fontSize: 11, marginTop: 8 },
    fieldWrap: { marginBottom: 16 },
    fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    fieldLabelText: { fontSize: 13, fontWeight: '600' },
    inputWrap: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4 },
    input: { fontSize: 15, minHeight: 44, paddingVertical: 10 },
    textArea: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    errorText: { fontSize: 12, color: serviceRed, flex: 1 },
    categoryRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
    categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
    categoryChipText: { fontSize: 13, fontWeight: '600' },
    priceStockRow: { flexDirection: 'row' },
    saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14, marginTop: 8 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
