import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import CustomInput from '@/components/CustomInput';
import productService from '@/services/productService';
import { serviceBlue, serviceGreen, serviceRed } from '@/theme/color';
import api from '@/api/axios';

const formatMoney = (value) => {
    const amount = Number(value || 0);
    return amount.toLocaleString('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        maximumFractionDigits: 2,
    });
};

const getImageUrl = (image) => {
    if (!image) return null;
    if (String(image).startsWith('http')) return image;
    const apiRoot = String(api.defaults.baseURL || '').replace(/\/api\/?$/, '');
    const normalized = String(image).startsWith('/') ? image : `/${image}`;
    return `${apiRoot}${normalized}`;
};

const stockMeta = (product) => {
    const quantity = Number(product?.stock_quantity || 0);
    if (quantity <= 0 || product?.status === 'out_stock') {
        return { label: 'Stok yok', color: serviceRed, bg: '#FDECEC', icon: 'archive-alert-outline' };
    }
    if (quantity <= 5) {
        return { label: 'Kritik', color: '#F59E0B', bg: '#FFF4E5', icon: 'alert-outline' };
    }
    return { label: 'Stokta', color: serviceGreen, bg: '#EAF9EF', icon: 'check-circle-outline' };
};

const ProductRow = ({ product, onPress }) => {
    const { colors } = useTheme();
    const meta = stockMeta(product);
    const imageUrl = getImageUrl(product.image);

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.productRow,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.82 : 1,
                },
            ]}
        >
            <View style={[styles.productIcon, { backgroundColor: `${meta.color}15` }]}>
                {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.productThumb} />
                ) : (
                    <MaterialCommunityIcons name="package-variant-closed" size={24} color={meta.color} />
                )}
            </View>
            <View style={styles.productInfo}>
                <View style={styles.rowTop}>
                    <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>
                        {product.name || 'Ürün'}
                    </Text>
                    <Text style={[styles.productPrice, { color: colors.text }]}>
                        {formatMoney(product.price)}
                    </Text>
                </View>
                <View style={styles.rowMeta}>
                    <Text style={[styles.productCode, { color: colors.textSecondary }]} numberOfLines={1}>
                        {product.code || 'Kod bekleniyor'}
                    </Text>
                    <View style={[styles.stockPill, { backgroundColor: meta.bg }]}>
                        <MaterialCommunityIcons name={meta.icon} size={14} color={meta.color} />
                        <Text style={[styles.stockPillText, { color: meta.color }]}>
                            {meta.label} · {product.stock_quantity || 0}
                        </Text>
                    </View>
                </View>
                {!!product.category_detail?.name && (
                    <Text style={[styles.categoryText, { color: colors.textTertiary }]} numberOfLines={1}>
                        {product.category_detail.name}
                    </Text>
                )}
            </View>
        </Pressable>
    );
};

export default function ProductListScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const [productData, categoryData] = await Promise.all([
                productService.getProducts(),
                productService.getCategories(),
            ]);
            setProducts(Array.isArray(productData) ? productData : []);
            setCategories(Array.isArray(categoryData) ? categoryData : []);
        } catch (error) {
            Alert.alert('Ürünler alınamadı', 'Bağlantınızı kontrol edip tekrar deneyin.');
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useFocusEffect(
        useCallback(() => {
            loadData(true);
        }, [loadData])
    );

    const stats = useMemo(() => {
        const total = products.length;
        const low = products.filter((item) => Number(item.stock_quantity || 0) > 0 && Number(item.stock_quantity || 0) <= 5).length;
        const out = products.filter((item) => Number(item.stock_quantity || 0) <= 0 || item.status === 'out_stock').length;
        const value = products.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.stock_quantity || 0), 0);
        return { total, low, out, value };
    }, [products]);

    const filteredProducts = useMemo(() => {
        const query = search.trim().toLowerCase();
        return products.filter((item) => {
            const categoryId = item.category_detail?.id || item.category;
            const matchesCategory = selectedCategory === 'all' || String(categoryId) === String(selectedCategory);
            const matchesSearch = !query
                || String(item.name || '').toLowerCase().includes(query)
                || String(item.code || '').toLowerCase().includes(query)
                || String(item.description || '').toLowerCase().includes(query);
            return matchesCategory && matchesSearch;
        });
    }, [products, search, selectedCategory]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData(true);
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={serviceBlue} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.container,
                    {
                        paddingTop: insets.top + 14,
                        paddingBottom: Math.max(insets.bottom, 20) + 24,
                    },
                ]}
            >
                <View style={styles.header}>
                    <Pressable onPress={() => navigation.goBack()} style={[styles.iconButton, { borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
                    </Pressable>
                    <View style={styles.headerText}>
                        <Text style={[styles.title, { color: colors.text }]}>Ürünler</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Stok ve envanter yönetimi</Text>
                    </View>
                    <Pressable onPress={() => navigation.navigate('AdminInventoryMovements')} style={[styles.iconButton, { borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="swap-horizontal" size={22} color={serviceBlue} />
                    </Pressable>
                </View>

                <LinearGradient
                    colors={isDark ? ['#27324D', '#20263B'] : ['#0066CC', '#0EA5E9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.hero}
                >
                    <View>
                        <Text style={styles.heroLabel}>Toplam envanter değeri</Text>
                        <Text style={styles.heroValue}>{formatMoney(stats.value)}</Text>
                    </View>
                    <View style={styles.heroStats}>
                        <View style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{stats.total}</Text>
                            <Text style={styles.heroStatLabel}>Ürün</Text>
                        </View>
                        <View style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{stats.low}</Text>
                            <Text style={styles.heroStatLabel}>Kritik</Text>
                        </View>
                        <View style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{stats.out}</Text>
                            <Text style={styles.heroStatLabel}>Tükendi</Text>
                        </View>
                    </View>
                </LinearGradient>

                <View style={styles.actions}>
                    <Pressable
                        onPress={() => navigation.navigate('AdminProductForm', { mode: 'create' })}
                        style={[styles.primaryAction, { backgroundColor: serviceBlue }]}
                    >
                        <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
                        <Text style={styles.primaryActionText}>Yeni Ürün</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => navigation.navigate('AdminInventoryMovements')}
                        style={[styles.secondaryAction, { borderColor: colors.border, backgroundColor: colors.surface }]}
                    >
                        <MaterialCommunityIcons name="history" size={20} color={colors.text} />
                        <Text style={[styles.secondaryActionText, { color: colors.text }]}>Hareketler</Text>
                    </Pressable>
                </View>

                <CustomInput
                    value={search}
                    onChangeText={setSearch}
                    icon="magnify"
                    placeholder="Ürün adı, kod veya açıklama ara"
                    disableSmartFormat
                />

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                    <Pressable
                        onPress={() => setSelectedCategory('all')}
                        style={[
                            styles.categoryChip,
                            {
                                backgroundColor: selectedCategory === 'all' ? serviceBlue : colors.surface,
                                borderColor: selectedCategory === 'all' ? serviceBlue : colors.border,
                            },
                        ]}
                    >
                        <Text style={[styles.categoryChipText, { color: selectedCategory === 'all' ? '#FFFFFF' : colors.text }]}>Tümü</Text>
                    </Pressable>
                    {categories.map((category) => (
                        <Pressable
                            key={category.id}
                            onPress={() => setSelectedCategory(category.id)}
                            style={[
                                styles.categoryChip,
                                {
                                    backgroundColor: selectedCategory === category.id ? serviceBlue : colors.surface,
                                    borderColor: selectedCategory === category.id ? serviceBlue : colors.border,
                                },
                            ]}
                        >
                            <Text style={[styles.categoryChipText, { color: selectedCategory === category.id ? '#FFFFFF' : colors.text }]}>
                                {category.name}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>

                {isLoading ? (
                    <View style={styles.emptyState}>
                        <ActivityIndicator color={serviceBlue} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Ürünler yükleniyor...</Text>
                    </View>
                ) : filteredProducts.length === 0 ? (
                    <View style={[styles.emptyPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="package-variant" size={42} color={colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>Ürün bulunamadı</Text>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Arama veya kategori filtresini değiştirin.</Text>
                    </View>
                ) : (
                    <View style={styles.list}>
                        {filteredProducts.map((product) => (
                            <ProductRow
                                key={product.id}
                                product={product}
                                onPress={() => navigation.navigate('AdminProductForm', { mode: 'update', product })}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    container: { paddingHorizontal: 18 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    iconButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    headerText: { flex: 1, marginHorizontal: 14 },
    title: { fontSize: 28, fontWeight: '900' },
    subtitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
    hero: { borderRadius: 18, padding: 14, marginBottom: 12 },
    heroLabel: { color: 'rgba(255,255,255,0.76)', fontSize: 11, fontWeight: '700', marginBottom: 4 },
    heroValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
    heroStats: { flexDirection: 'row', marginTop: 12, gap: 8 },
    heroStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
    heroStatValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
    heroStatLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '700', marginTop: 1 },
    actions: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    primaryAction: { flex: 1, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    primaryActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
    secondaryAction: { flex: 1, height: 52, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    secondaryActionText: { fontSize: 15, fontWeight: '800' },
    categoryScroll: { marginTop: -2, marginBottom: 14 },
    categoryChip: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8 },
    categoryChipText: { fontSize: 13, fontWeight: '800' },
    list: { gap: 10 },
    productRow: { borderWidth: 1, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center' },
    productIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    productThumb: { width: '100%', height: '100%', borderRadius: 17 },
    productInfo: { flex: 1 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
    productName: { flex: 1, fontSize: 16, fontWeight: '900' },
    productPrice: { fontSize: 14, fontWeight: '900' },
    rowMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
    productCode: { flex: 1, fontSize: 12, fontWeight: '700' },
    stockPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, gap: 4 },
    stockPillText: { fontSize: 11, fontWeight: '900' },
    categoryText: { marginTop: 6, fontSize: 12, fontWeight: '700' },
    emptyState: { alignItems: 'center', paddingVertical: 32, gap: 10 },
    emptyPanel: { borderWidth: 1, borderRadius: 24, padding: 26, alignItems: 'center' },
    emptyTitle: { fontSize: 17, fontWeight: '900', marginTop: 10 },
    emptyText: { fontSize: 13, fontWeight: '600', marginTop: 4, textAlign: 'center' },
});
