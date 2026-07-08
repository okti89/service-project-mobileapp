import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    Modal,
    RefreshControl,
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

export default function ProductListScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    // Stock Movements Modal
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
                params: productId ? { product: productId } : undefined
            });
            setMovements(Array.isArray(response?.data) ? response.data : []);
        } catch (error) {
            console.log('Stock movements fetch error:', error?.response?.data || error?.message || error);
            Alert.alert('Hata', 'Stok hareketleri yüklenemedi');
        } finally {
            setMovementsLoading(false);
        }
    };

    // Calculations
    const totalProducts = products.length;
    const lowStockCount = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 5).length;
    const outOfStockCount = products.filter(p => p.stock_quantity === 0).length;
    const totalValue = products.reduce((sum, p) => sum + (Number(p.price || 0) * Number(p.stock_quantity || 0)), 0);

    // Filtering
    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.code.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = !selectedCategory || p.category_detail?.id === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const getStatusConfig = (quantity) => {
        if (quantity === 0) return { label: 'Tükendi', color: serviceRed, bg: 'rgba(220, 38, 38, 0.08)' };
        if (quantity <= 5) return { label: 'Düşük', color: serviceOrange, bg: 'rgba(245, 158, 11, 0.08)' };
        return { label: 'Yeterli', color: serviceGreen, bg: 'rgba(34, 197, 94, 0.08)' };
    };

    return (
        <View style={[styles.screen, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 8, alignItems: 'center' }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </Pressable>
                <View style={styles.headerTitleWrap}>
                    <Text style={[styles.headerTitleText, { color: colors.text }]}>Ürün & Envanter</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textTertiary }]}>Stok ve ürün yönetimi</Text>
                </View>
                <Pressable
                    onPress={() => navigation.navigate('AdminProductForm')}
                    style={({ pressed }) => [
                        styles.headerAddBtn,
                        { backgroundColor: `${serviceBlue}12`, borderColor: `${serviceBlue}40` },
                        pressed && styles.btnPressed
                    ]}
                >
                    <MaterialCommunityIcons name="plus" size={16} color={serviceBlue} />
                    <Text style={[styles.headerAddBtnText, { color: serviceBlue }]}>Ürün Ekle</Text>
                </Pressable>
            </View>

            {loading && !refreshing ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={serviceBlue} />
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <FlatList
                        data={filtered}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 30 }]}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[serviceBlue]} />
                        }
                        ListHeaderComponent={
                            <>
                                {/* Stats Cards Grid */}
                                <View style={styles.statsGrid}>
                                    {/* Stat Card: Total Products */}
                                    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                        <View style={[styles.statIconWrap, { backgroundColor: `${serviceBlue}10` }]}>
                                            <MaterialCommunityIcons name="package-variant" size={18} color={serviceBlue} />
                                        </View>
                                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Toplam Ürün</Text>
                                        <Text style={[styles.statValue, { color: colors.text }]}>{totalProducts}</Text>
                                    </View>

                                    {/* Stat Card: Low Stock */}
                                    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                        <View style={[styles.statIconWrap, { backgroundColor: `${serviceOrange}10` }]}>
                                            <MaterialCommunityIcons name="alert-outline" size={18} color={serviceOrange} />
                                        </View>
                                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Düşük Stok</Text>
                                        <Text style={[styles.statValue, { color: colors.text }]}>{lowStockCount}</Text>
                                    </View>

                                    {/* Stat Card: Out of Stock */}
                                    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                        <View style={[styles.statIconWrap, { backgroundColor: `${serviceRed}10` }]}>
                                            <MaterialCommunityIcons name="close-circle-outline" size={18} color={serviceRed} />
                                        </View>
                                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tükendi</Text>
                                        <Text style={[styles.statValue, { color: colors.text }]}>{outOfStockCount}</Text>
                                    </View>

                                    {/* Stat Card: Total Value */}
                                    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                        <View style={[styles.statIconWrap, { backgroundColor: `${serviceGreen}10` }]}>
                                            <MaterialCommunityIcons name="currency-try" size={18} color={serviceGreen} />
                                        </View>
                                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Toplam Değer</Text>
                                        <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
                                            ₺{totalValue.toLocaleString('tr-TR')}
                                        </Text>
                                    </View>
                                </View>

                                 {/* Category Selection Chips */}
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
                                            { backgroundColor: !selectedCategory ? serviceBlue : colors.surface, borderColor: !selectedCategory ? serviceBlue : colors.border }
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
                                                    { backgroundColor: active ? serviceBlue : colors.surface, borderColor: active ? serviceBlue : colors.border }
                                                ]}
                                            >
                                                <Text style={[styles.categoryChipText, { color: active ? '#FFFFFF' : colors.text }]}>{c.name}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </ScrollView>

                                {/* Search Input Container */}
                                <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                    <MaterialCommunityIcons name="magnify" size={20} color={colors.textTertiary} style={{ marginRight: 8 }} />
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
                        }
                        renderItem={({ item }) => {
                            const statusConfig = getStatusConfig(item.stock_quantity);
                            return (
                                <Pressable
                                    onPress={() => navigation.navigate('AdminProductForm', { product: item })}
                                    style={[styles.productCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                >
                                    {/* Product Image */}
                                    <View style={[styles.imageWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EEF2F6' }]}>
                                        {item.image ? (
                                            <Image source={{ uri: item.image }} style={styles.productImage} />
                                        ) : (
                                            <MaterialCommunityIcons name="image-outline" size={24} color={colors.textTertiary} />
                                        )}
                                    </View>

                                    {/* Details */}
                                    <View style={styles.productDetails}>
                                        <Text style={[styles.productNameText, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                                        <View style={styles.badgeRow}>
                                            <Text style={[styles.catText, { color: colors.textSecondary }]} numberOfLines={1}>
                                                {item.category_detail?.name || 'Kategorisiz'}
                                            </Text>
                                            <Text style={[styles.dotSeparator, { color: colors.textTertiary }]}>•</Text>
                                            <Text style={[styles.skuText, { color: colors.textTertiary }]}>SKU: {item.code}</Text>
                                        </View>

                                        {/* Stats Row */}
                                        <View style={styles.productStatsRow}>
                                            <View style={styles.productStatCol}>
                                                <MaterialCommunityIcons name="cube-outline" size={13} color={colors.textTertiary} style={{ marginRight: 4 }} />
                                                <Text style={[styles.productStatVal, { color: item.stock_quantity === 0 ? serviceRed : colors.text }]}>
                                                    {item.stock_quantity} adet
                                                </Text>
                                            </View>
                                            <View style={[styles.productStatCol, { marginLeft: 16 }]}>
                                                <MaterialCommunityIcons name="tag-outline" size={13} color={colors.textTertiary} style={{ marginRight: 4 }} />
                                                <Text style={[styles.productStatVal, { color: serviceBlue, fontWeight: '800' }]}>
                                                    ₺{Number(item.price).toLocaleString('tr-TR')}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Right Action */}
                                    <View style={styles.productCardRight}>
                                        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                                            <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                                        </View>
                                        <Pressable
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                fetchStockMovements(item.id, item.name);
                                            }}
                                            style={({ pressed }) => [
                                                styles.historyBtn,
                                                pressed && styles.btnPressed
                                            ]}
                                        >
                                            <MaterialCommunityIcons name="history" size={12} color={serviceBlue} />
                                            <Text style={[styles.historyBtnText, { color: serviceBlue }]}>Geçmiş</Text>
                                        </Pressable>
                                    </View>
                                </Pressable>
                            );
                        }}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <MaterialCommunityIcons name="package-variant-closed" size={48} color={colors.textTertiary} />
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Ürün bulunamadı</Text>
                            </View>
                        }
                    />
                </View>
            )}

            {/* Stock Movements Modal */}
            <Modal
                visible={movementsModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setMovementsModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
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
                                keyExtractor={(item) => item.id.toString()}
                                contentContainerStyle={{ padding: 16 }}
                                renderItem={({ item }) => {
                                    const isAddition = item.movement_type === 'in' || item.movement_type === 'return';
                                    return (
                                        <View style={[styles.movementItem, { borderBottomColor: colors.border }]}>
                                            <View style={[styles.movementIconWrap, { backgroundColor: isAddition ? `${serviceGreen}10` : `${serviceRed}10` }]}>
                                                <MaterialCommunityIcons
                                                    name={isAddition ? "plus-box-outline" : "minus-box-outline"}
                                                    size={22}
                                                    color={isAddition ? serviceGreen : serviceRed}
                                                />
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                <Text style={[styles.movementProdName, { color: colors.text }]}>
                                                    {item.product_detail?.name || 'Ürün'}
                                                </Text>
                                                <Text style={[styles.movementDetailsText, { color: colors.textSecondary }]}>
                                                    Tür: {item.movement_type_display} • İşlem: {item.technician_name || 'Bilinmiyor'}
                                                </Text>
                                                {item.description && (
                                                    <Text style={[styles.movementDescText, { color: colors.textTertiary }]}>
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
        paddingBottom: 16,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
        borderWidth: 1,
    },
    headerAddBtnText: {
        fontSize: 12,
        fontWeight: '800',
    },
    headerTitleWrap: {
        flex: 1,
        marginLeft: 12,
    },
    headerTitleText: {
        fontSize: 20,
        fontWeight: '900',
    },
    headerSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    listContent: { paddingHorizontal: 16, paddingTop: 8 },
    statsScroll: {
        marginBottom: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    statCard: {
        width: '48%',
        flexGrow: 1,
        minWidth: '45%',
        borderRadius: 16,
        borderWidth: 1,
        padding: 12,
    },
    statIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '700',
    },
    statValue: {
        fontSize: 15,
        fontWeight: '900',
        marginTop: 3,
    },
    categoryScroll: {
        marginBottom: 12,
        marginHorizontal: -16,
    },
    categoryScrollContent: {
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 16,
    },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 0,
        borderWidth: 1.5,
    },
    categoryChipText: {
        fontSize: 12,
        fontWeight: '800',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1.5,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 14,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
    },
    productCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        marginBottom: 10,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    imageWrap: {
        width: 64,
        height: 64,
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
    productDetails: {
        flex: 1,
        marginLeft: 12,
    },
    productNameText: {
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 2,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    catText: {
        fontSize: 11,
        fontWeight: '700',
    },
    dotSeparator: {
        fontSize: 10,
        marginHorizontal: 2,
    },
    skuText: {
        fontSize: 10,
        fontWeight: '600',
    },
    productStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    productStatCol: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    productStatLabel: {
        fontSize: 10,
        fontWeight: '700',
        marginRight: 6,
    },
    productStatVal: {
        fontSize: 12,
        fontWeight: '800',
    },
    productCardRight: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: 60,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusBadgeText: {
        fontSize: 9,
        fontWeight: '900',
    },
    historyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1.2,
        borderColor: 'rgba(37, 99, 235, 0.15)',
        marginTop: 6,
    },
    historyBtnText: {
        fontSize: 9.5,
        fontWeight: '800',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 12,
    },
    actionBtnSecondary: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 48,
        borderRadius: 14,
        borderWidth: 1.5,
        gap: 6,
    },
    actionBtnSecondaryText: {
        fontSize: 13,
        fontWeight: '800',
    },
    btnPressed: {
        opacity: 0.85,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        height: '75%',
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
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '900',
    },
    closeBtn: {
        width: 32,
        height: 32,
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
