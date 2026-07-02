import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
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
import PagerView from 'react-native-pager-view';
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

// Kategori sekmesi: aktif tab için gradient indicator bar
const CategoryTab = ({ label, isActive, onPress, isFirst, isLast }) => {
    const { colors } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.categoryTab,
                {
                    marginLeft: isFirst ? 18 : 0,
                    marginRight: isLast ? 18 : 0,
                    opacity: pressed ? 0.85 : 1,
                },
            ]}
            hitSlop={6}
        >
            <View style={styles.categoryTabContent}>
                <Text
                    style={[
                        styles.categoryTabText,
                        {
                            color: isActive ? serviceBlue : colors.textSecondary,
                            fontWeight: isActive ? '900' : '700',
                        },
                    ]}
                    numberOfLines={1}
                >
                    {label}
                </Text>
            </View>
            {isActive ? (
                <LinearGradient
                    colors={['#0066CC', '#0EA5E9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.categoryTabIndicator}
                />
            ) : (
                <View style={styles.categoryTabIndicatorSpacer} />
            )}
        </Pressable>
    );
};

export default function ProductListScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);

    const pagerRef = useRef(null);
    const tabScrollRef = useRef(null);
    const tabLayouts = useRef({}); // { index: { x, width } }

    // Sayfa listesi: "Tümü" + kategoriler
    const pages = useMemo(() => {
        const list = [{ id: 'all', name: 'Tümü' }];
        categories.forEach((cat) => list.push({ id: cat.id, name: cat.name }));
        return list;
    }, [categories]);

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

    // Sayfa bazlı filtreleme (arama + kategori)
    const filterProductsByPage = useCallback((pageId) => {
        const query = search.trim().toLowerCase();
        return products.filter((item) => {
            const categoryId = item.category_detail?.id || item.category;
            const matchesCategory = pageId === 'all' || String(categoryId) === String(pageId);
            const matchesSearch = !query
                || String(item.name || '').toLowerCase().includes(query)
                || String(item.code || '').toLowerCase().includes(query)
                || String(item.description || '').toLowerCase().includes(query);
            return matchesCategory && matchesSearch;
        });
    }, [products, search]);

    const goToPage = useCallback((index) => {
        if (index === currentPage) return;
        pagerRef.current?.setPage(index);
        setCurrentPage(index);
    }, [currentPage]);

    const handlePageSelected = useCallback((e) => {
        const position = e.nativeEvent.position;
        setCurrentPage(position);
        // Aktif sekmeyi görünür alana kaydır
        const layout = tabLayouts.current[position];
        if (layout && tabScrollRef.current) {
            tabScrollRef.current.scrollTo({
                x: Math.max(0, layout.x - 60),
                y: 0,
                animated: true,
            });
        }
    }, []);

    const handleTabLayout = useCallback((index, event) => {
        const { x, width } = event.nativeEvent.layout;
        tabLayouts.current[index] = { x, width };
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadData(true);
    };

    const renderEmpty = (pageName) => (
        <View style={[styles.emptyPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="package-variant" size={42} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {search.trim() ? 'Aramayla eşleşen ürün yok' : 'Ürün bulunamadı'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {search.trim()
                    ? 'Farklı bir arama terimi veya kategori deneyin.'
                    : `${pageName} kategorisinde henüz ürün yok.`}
            </Text>
        </View>
    );

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View
                style={[
                    styles.topSection,
                    { paddingTop: insets.top + 14 },
                ]}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.topContent}
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
                </ScrollView>

                {/* Kategori TabBar - PagerView ile senkronize */}
                <View style={[styles.tabBarWrapper, { borderBottomColor: colors.border }]}>
                    <ScrollView
                        ref={tabScrollRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.tabBarContent}
                    >
                        {pages.map((page, index) => (
                            <View
                                key={`tab-${page.id}`}
                                onLayout={(event) => handleTabLayout(index, event)}
                            >
                                <CategoryTab
                                    label={page.name}
                                    isActive={currentPage === index}
                                    onPress={() => goToPage(index)}
                                    isFirst={index === 0}
                                    isLast={index === pages.length - 1}
                                />
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </View>

            {/* PageView - kategoriler arası swipe */}
            <View style={styles.pagerWrapper}>
                {isLoading ? (
                    <View style={styles.emptyState}>
                        <ActivityIndicator color={serviceBlue} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Ürünler yükleniyor...</Text>
                    </View>
                ) : (
                    <PagerView
                        ref={pagerRef}
                        style={styles.pager}
                        initialPage={0}
                        onPageSelected={handlePageSelected}
                        offscreenPageLimit={1}
                    >
                        {pages.map((page) => {
                            const pageProducts = filterProductsByPage(page.id);
                            return (
                                <View key={`page-${page.id}`} style={styles.page}>
                                    <FlatList
                                        data={pageProducts}
                                        keyExtractor={(item) => String(item.id)}
                                        renderItem={({ item }) => (
                                            <ProductRow
                                                product={item}
                                                onPress={() => navigation.navigate('AdminProductForm', { mode: 'update', product: item })}
                                            />
                                        )}
                                        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                                        contentContainerStyle={styles.listContent}
                                        showsVerticalScrollIndicator={false}
                                        refreshControl={
                                            <RefreshControl
                                                refreshing={refreshing}
                                                onRefresh={onRefresh}
                                                tintColor={serviceBlue}
                                                colors={[serviceBlue]}
                                            />
                                        }
                                        ListEmptyComponent={renderEmpty(page.name)}
                                    />
                                </View>
                            );
                        })}
                    </PagerView>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    topSection: { paddingBottom: 0 },
    topContent: { paddingHorizontal: 18, paddingBottom: 14 },
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
    tabBarWrapper: {
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tabBarContent: {
        alignItems: 'flex-end',
        paddingVertical: 6,
    },
    categoryTab: {
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 0,
        minWidth: 60,
    },
    categoryTabContent: {
        paddingBottom: 10,
        alignItems: 'center',
    },
    categoryTabText: {
        fontSize: 14,
        textAlign: 'center',
    },
    categoryTabIndicator: {
        height: 3,
        width: '70%',
        alignSelf: 'center',
        borderRadius: 2,
    },
    categoryTabIndicatorSpacer: {
        height: 3,
    },
    pagerWrapper: { flex: 1 },
    pager: { flex: 1 },
    page: { flex: 1 },
    listContent: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24 },
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
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 10 },
    emptyPanel: { borderWidth: 1, borderRadius: 24, padding: 26, alignItems: 'center', marginHorizontal: 18, marginTop: 24 },
    emptyTitle: { fontSize: 17, fontWeight: '900', marginTop: 10 },
    emptyText: { fontSize: 13, fontWeight: '600', marginTop: 4, textAlign: 'center' },
});
