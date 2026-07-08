import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';

dayjs.locale('tr');

const toNumber = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value) => `₺${toNumber(value).toLocaleString('tr-TR')}`;
const formatCount = (value) => toNumber(value).toLocaleString('tr-TR');

export default function ProductListScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [movementsModalVisible, setMovementsModalVisible] = useState(false);
    const [movements, setMovements] = useState([]);
    const [movementsLoading, setMovementsLoading] = useState(false);
    const [selectedProductForMovements, setSelectedProductForMovements] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const [prodRes, catRes] = await Promise.all([
                api.get(ENDPOINTS.PRODUCTS.LIST),
                api.get(ENDPOINTS.PRODUCTS.CATEGORIES),
            ]);
            setProducts(Array.isArray(prodRes?.data) ? prodRes.data : []);
            setCategories(Array.isArray(catRes?.data) ? catRes.data : []);
        } catch (error) {
            console.log('Products list fetch error:', error?.response?.data || error?.message || error);
            Alert.alert('Hata', 'Ürün listesi yüklenemedi');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const fetchStockMovements = async (productId = null, productName = '') => {
        try {
            setMovementsLoading(true);
            setSelectedProductForMovements(productName);
            setMovementsModalVisible(true);
            const response = await api.get(ENDPOINTS.PRODUCTS.STOCK_MOVEMENTS, {
                params: productId ? { product: productId } : undefined,
            });
            setMovements(Array.isArray(response?.data) ? response.data : []);
        } catch (error) {
            console.log('Stock movements fetch error:', error?.response?.data || error?.message || error);
            Alert.alert('Hata', 'Stok hareketleri yüklenemedi');
        } finally {
            setMovementsLoading(false);
        }
    };

    const inventorySummary = useMemo(() => {
        const totalStock = products.reduce((sum, p) => sum + toNumber(p.stock_quantity), 0);
        const lowStockCount = products.filter(p => {
            const quantity = toNumber(p.stock_quantity);
            return quantity > 0 && quantity <= 5;
        }).length;
        const outOfStockCount = products.filter(p => toNumber(p.stock_quantity) === 0).length;
        const totalValue = products.reduce((sum, p) => sum + (toNumber(p.price) * toNumber(p.stock_quantity)), 0);

        return {
            totalProducts: products.length,
            totalStock,
            lowStockCount,
            outOfStockCount,
            totalValue,
        };
    }, [products]);

    const filtered = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        return products.filter(p => {
            const name = String(p.name || '').toLowerCase();
            const code = String(p.code || '').toLowerCase();
            const matchesSearch = !normalizedQuery || name.includes(normalizedQuery) || code.includes(normalizedQuery);
            const matchesCategory = !selectedCategory || p.category_detail?.id === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [products, searchQuery, selectedCategory]);

    const getStatusConfig = (quantity) => {
        const stock = toNumber(quantity);
        if (stock === 0) return { label: 'Tükendi', color: serviceRed, bg: 'rgba(220, 53, 69, 0.10)' };
        if (stock <= 5) return { label: 'Düşük', color: serviceOrange, bg: 'rgba(255, 140, 0, 0.12)' };
        return { label: 'Yeterli', color: serviceGreen, bg: 'rgba(0, 163, 108, 0.12)' };
    };

    const renderProduct = ({ item }) => {
        const stockQuantity = toNumber(item.stock_quantity);
        const statusConfig = getStatusConfig(stockQuantity);

        return (
            <Pressable
                onPress={() => navigation.navigate('AdminProductForm', { product: item })}
                style={({ pressed }) => [
                    styles.productCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && styles.btnPressed,
                ]}
            >
                <View style={[styles.imageWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F6FA' }]}>
                    {item.image ? (
                        <Image source={{ uri: item.image }} style={styles.productImage} />
                    ) : (
                        <MaterialCommunityIcons name="package-variant" size={26} color={colors.textTertiary} />
                    )}
                </View>

                <View style={styles.productInfo}>
                    <View style={styles.productTopRow}>
                        <View style={styles.productTitleArea}>
                            <Text style={[styles.productNameText, { color: colors.text }]} numberOfLines={1}>
                                {item.name || 'Ürün'}
                            </Text>
                            <View style={styles.metaRow}>
                                <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {item.category_detail?.name || 'Kategorisiz'}
                                </Text>
                                <Text style={[styles.metaDot, { color: colors.textTertiary }]}>•</Text>
                                <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                                    SKU: {item.code || '-'}
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                            <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                        </View>
                    </View>

                    <View style={styles.productBottomRow}>
                        <View style={styles.productMetric}>
                            <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Stok</Text>
                            <Text style={[styles.metricValue, { color: stockQuantity === 0 ? serviceRed : colors.text }]}>
                                {formatCount(stockQuantity)}
                            </Text>
                        </View>
                        <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.productMetric}>
                            <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Fiyat</Text>
                            <Text style={[styles.metricValue, { color: colors.text }]}>{formatCurrency(item.price)}</Text>
                        </View>
                        <Pressable
                            onPress={(e) => {
                                e.stopPropagation();
                                fetchStockMovements(item.id, item.name);
                            }}
                            hitSlop={10}
                            style={styles.historyIconBtn}
                        >
                            <MaterialCommunityIcons name="dots-vertical" size={22} color={colors.textSecondary} />
                        </Pressable>
                    </View>
                </View>
            </Pressable>
        );
    };

    const ListHeader = (
        <>
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.summaryTopRow}>
                    <View style={styles.summaryMainMetric}>
                        <View style={[styles.summaryIcon, { backgroundColor: `${serviceBlue}12` }]}>
                            <MaterialCommunityIcons name="package-variant-closed" size={22} color={serviceBlue} />
                        </View>
                        <View>
                            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Toplam Ürün</Text>
                            <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCount(inventorySummary.totalProducts)}</Text>
                        </View>
                    </View>

                    <View style={styles.summaryMainMetricRight}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Toplam Değer</Text>
                        <Text style={[styles.summaryValueSmall, { color: colors.text }]} numberOfLines={1}>
                            {formatCurrency(inventorySummary.totalValue)}
                        </Text>
                    </View>
                </View>

                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />

                <View style={styles.summaryMiniRow}>
                    <View style={styles.summaryMiniItem}>
                        <Text style={[styles.summaryMiniLabel, { color: colors.textTertiary }]}>Toplam Stok</Text>
                        <Text style={[styles.summaryMiniValue, { color: colors.text }]}>{formatCount(inventorySummary.totalStock)} adet</Text>
                    </View>
                    <View style={styles.summaryMiniItem}>
                        <Text style={[styles.summaryMiniLabel, { color: colors.textTertiary }]}>Düşük</Text>
                        <Text style={[styles.summaryMiniValue, { color: serviceOrange }]}>{formatCount(inventorySummary.lowStockCount)}</Text>
                    </View>
                    <View style={styles.summaryMiniItem}>
                        <Text style={[styles.summaryMiniLabel, { color: colors.textTertiary }]}>Tükendi</Text>
                        <Text style={[styles.summaryMiniValue, { color: serviceRed }]}>{formatCount(inventorySummary.outOfStockCount)}</Text>
                    </View>
                </View>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
                contentContainerStyle={styles.categoryScrollContent}
            >
                <Pressable
                    onPress={() => setSelectedCategory(null)}
                    style={[
                        styles.categoryChip,
                        { backgroundColor: !selectedCategory ? serviceBlue : colors.surface, borderColor: !selectedCategory ? serviceBlue : colors.border },
                    ]}
                >
                    <Text style={[styles.categoryChipText, { color: !selectedCategory ? '#FFFFFF' : colors.text }]}>Tümü</Text>
                </Pressable>
                {categories.map((c) => {
                    const active = selectedCategory === c.id;
                    return (
                        <Pressable
                            key={c.id}
                            onPress={() => setSelectedCategory(c.id)}
                            style={[
                                styles.categoryChip,
                                { backgroundColor: active ? serviceBlue : colors.surface, borderColor: active ? serviceBlue : colors.border },
                            ]}
                        >
                            <Text style={[styles.categoryChipText, { color: active ? '#FFFFFF' : colors.text }]} numberOfLines={1}>{c.name}</Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="magnify" size={21} color={colors.textTertiary} style={{ marginRight: 10 }} />
                <TextInput
                    placeholder="Ürün veya SKU ara..."
                    placeholderTextColor={colors.textTertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={[styles.searchInput, { color: colors.text }]}
                    clearButtonMode="while-editing"
                />
            </View>
        </>
    );

    return (
        <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                </Pressable>
                <View style={styles.headerTitleWrap}>
                    <Text style={[styles.headerKicker, { color: colors.textSecondary }]}>Stok ve ürün yönetimi</Text>
                    <Text style={[styles.headerTitleText, { color: colors.text }]}>Ürün & Envanter</Text>
                </View>
                <Pressable
                    onPress={() => navigation.navigate('AdminProductForm')}
                    style={({ pressed }) => [styles.iconButton, { borderColor: `${serviceBlue}24`, backgroundColor: `${serviceBlue}10` }, pressed && styles.btnPressed]}
                >
                    <MaterialCommunityIcons name="plus" size={23} color={serviceBlue} />
                </Pressable>
            </View>

            {loading && !refreshing ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={serviceBlue} />
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderProduct}
                    ListHeaderComponent={ListHeader}
                    contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[serviceBlue]} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="package-variant-closed" size={48} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Ürün bulunamadı</Text>
                        </View>
                    }
                />
            )}

            <Modal
                visible={movementsModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setMovementsModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={2}>
                                {selectedProductForMovements ? `${selectedProductForMovements} - Stok Geçmişi` : 'Stok Hareketleri'}
                            </Text>
                            <Pressable onPress={() => setMovementsModalVisible(false)} style={styles.closeBtn}>
                                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                            </Pressable>
                        </View>

                        {movementsLoading ? (
                            <View style={styles.modalLoading}>
                                <ActivityIndicator size="large" color={serviceBlue} />
                            </View>
                        ) : (
                            <FlatList
                                data={movements}
                                keyExtractor={(item) => String(item.id)}
                                contentContainerStyle={{ padding: 16 }}
                                renderItem={({ item }) => {
                                    const isAddition = item.movement_type === 'in' || item.movement_type === 'return';
                                    return (
                                        <View style={[styles.movementItem, { borderBottomColor: colors.border }]}>
                                            <View style={[styles.movementIconWrap, { backgroundColor: isAddition ? `${serviceGreen}10` : `${serviceRed}10` }]}>
                                                <MaterialCommunityIcons
                                                    name={isAddition ? 'plus-box-outline' : 'minus-box-outline'}
                                                    size={22}
                                                    color={isAddition ? serviceGreen : serviceRed}
                                                />
                                            </View>
                                            <View style={styles.movementInfo}>
                                                <Text style={[styles.movementProdName, { color: colors.text }]} numberOfLines={1}>
                                                    {item.product_detail?.name || 'Ürün'}
                                                </Text>
                                                <Text style={[styles.movementDetailsText, { color: colors.textSecondary }]} numberOfLines={1}>
                                                    Tür: {item.movement_type_display} • İşlem: {item.technician_name || 'Bilinmiyor'}
                                                </Text>
                                                {item.description && (
                                                    <Text style={[styles.movementDescText, { color: colors.textTertiary }]} numberOfLines={2}>
                                                        Açıklama: {item.description}
                                                    </Text>
                                                )}
                                                <Text style={[styles.movementDateText, { color: colors.textTertiary }]}>
                                                    {dayjs(item.created_at).format('DD MMM YYYY HH:mm')}
                                                </Text>
                                            </View>
                                            <Text style={[styles.movementQuantityText, { color: isAddition ? serviceGreen : serviceRed }]}>
                                                {isAddition ? '+' : '-'}{item.quantity}
                                            </Text>
                                        </View>
                                    );
                                }}
                                ListEmptyComponent={
                                    <View style={styles.emptyContainer}>
                                        <MaterialCommunityIcons name="swap-vertical" size={48} color={colors.textTertiary} />
                                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Stok hareketi bulunamadı</Text>
                                    </View>
                                }
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 12,
    },
    iconButton: {
        width: 46,
        height: 46,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleWrap: {
        flex: 1,
        minWidth: 0,
    },
    headerKicker: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 2,
    },
    headerTitleText: {
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: 0,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 4,
    },
    summaryCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        marginBottom: 14,
    },
    summaryTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    summaryMainMetric: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 0,
        gap: 10,
    },
    summaryMainMetricRight: {
        flex: 1,
        alignItems: 'flex-end',
        minWidth: 0,
    },
    summaryIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryLabel: {
        fontSize: 11,
        fontWeight: '700',
    },
    summaryValue: {
        fontSize: 22,
        fontWeight: '900',
        marginTop: 2,
    },
    summaryValueSmall: {
        fontSize: 18,
        fontWeight: '900',
        marginTop: 2,
        maxWidth: '100%',
    },
    summaryDivider: {
        height: 1,
        marginVertical: 12,
        opacity: 0.85,
    },
    summaryMiniRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    summaryMiniItem: {
        flex: 1,
        minWidth: 0,
    },
    summaryMiniLabel: {
        fontSize: 10,
        fontWeight: '700',
        marginBottom: 3,
    },
    summaryMiniValue: {
        fontSize: 13,
        fontWeight: '900',
    },
    categoryScroll: {
        marginBottom: 12,
        marginHorizontal: -16,
    },
    categoryScrollContent: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
    },
    categoryChip: {
        minHeight: 40,
        paddingHorizontal: 18,
        borderRadius: 13,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryChipText: {
        fontSize: 13,
        fontWeight: '800',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 15,
        borderWidth: 1,
        paddingHorizontal: 14,
        height: 50,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
    },
    productCard: {
        flexDirection: 'row',
        borderRadius: 16,
        borderWidth: 1,
        padding: 12,
        marginBottom: 10,
        gap: 12,
    },
    imageWrap: {
        width: 76,
        height: 76,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    productImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    productInfo: {
        flex: 1,
        minWidth: 0,
    },
    productTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    productTitleArea: {
        flex: 1,
        minWidth: 0,
    },
    productNameText: {
        fontSize: 15,
        fontWeight: '900',
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 0,
        gap: 5,
    },
    metaText: {
        flexShrink: 1,
        fontSize: 11,
        fontWeight: '700',
    },
    metaDot: {
        fontSize: 10,
        fontWeight: '900',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '900',
    },
    productBottomRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginTop: 12,
    },
    productMetric: {
        minWidth: 72,
    },
    metricLabel: {
        fontSize: 10,
        fontWeight: '700',
        marginBottom: 2,
    },
    metricValue: {
        fontSize: 13,
        fontWeight: '900',
    },
    metricDivider: {
        width: 1,
        height: 26,
        marginHorizontal: 12,
    },
    historyIconBtn: {
        marginLeft: 'auto',
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '700',
        marginTop: 12,
    },
    btnPressed: {
        opacity: 0.82,
        transform: [{ scale: 0.99 }],
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        maxHeight: '78%',
        minHeight: '48%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        gap: 12,
    },
    modalTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '900',
    },
    closeBtn: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalLoading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    movementItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    movementIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    movementInfo: {
        flex: 1,
        minWidth: 0,
        marginLeft: 12,
    },
    movementProdName: {
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 2,
    },
    movementDetailsText: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 2,
    },
    movementDescText: {
        fontSize: 10,
        fontWeight: '600',
        marginBottom: 2,
    },
    movementDateText: {
        fontSize: 10,
        fontWeight: '600',
    },
    movementQuantityText: {
        fontSize: 14,
        fontWeight: '900',
    },
});