import React, { useCallback, useEffect, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceRed } from '@/theme/color';

const MovementCard = ({ movement }) => {
    const { colors } = useTheme();

    const isPositive = movement.movement_type === 'in' || movement.movement_type === 'return';
    const typeConfig = {
        in: { icon: 'arrow-down-circle', color: serviceGreen, label: 'Giris' },
        out: { icon: 'arrow-up-circle', color: serviceRed, label: 'Cikis' },
        return: { icon: 'undo', color: '#F59E0B', label: 'Iade' },
        adjustment: { icon: 'pencil', color: serviceBlue, label: 'Duzeltme' },
    };
    const config = typeConfig[movement.movement_type] || typeConfig.adjustment;

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <View style={[styles.movementCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.movementIconWrap, { backgroundColor: `${config.color}15` }]}>
                <MaterialCommunityIcons name={config.icon} size={20} color={config.color} />
            </View>
            <View style={styles.movementInfo}>
                <View style={styles.movementHeader}>
                    <Text style={[styles.movementType, { color: colors.text }]}>{config.label}</Text>
                    <Text style={[styles.movementQty, { color: config.color }]}>
                        {isPositive ? '+' : '-'}{movement.quantity}
                    </Text>
                </View>
                {movement.description && (
                    <Text style={[styles.movementDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                        {movement.description}
                    </Text>
                )}
                <Text style={[styles.movementDate, { color: colors.textTertiary }]}>
                    {formatDate(movement.created_at)}
                    {movement.technician_name && ` - ${movement.technician_name}`}
                </Text>
            </View>
        </View>
    );
};

export default function ProductDetailScreen({ navigation, route }) {
    const { productId } = route.params || {};
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();

    const [product, setProduct] = useState(null);
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchProduct = useCallback(async () => {
        if (!productId) { setLoading(false); return; }
        try {
            const [productRes, movementRes] = await Promise.all([
                api.get(ENDPOINTS.PRODUCTS.DETAIL(productId)),
                api.get(ENDPOINTS.PRODUCTS.STOCK_MOVEMENTS, { params: { product: productId } }),
            ]);
            setProduct(productRes.data);
            setMovements(Array.isArray(movementRes.data) ? movementRes.data : []);
        } catch (error) {
            console.log('Product fetch error:', error?.response?.data || error?.message || error);
            Alert.alert('Hata', 'Urun bilgileri yuklenemedi');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [productId]);

    useEffect(() => { fetchProduct(); }, [fetchProduct]);

    const handleRefresh = () => { setRefreshing(true); fetchProduct(); };

    const handleEdit = () => {
        navigation.navigate('AdminProductForm', { product });
    };

    const formatPrice = (price) => {
        if (!price && price !== 0) return '-';
        return `${Number(price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
    };

    if (loading) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Urun Detayi</Text>
                    <View style={styles.headerBtn} />
                </View>
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={serviceBlue} />
                </View>
            </View>
        );
    }

    if (!product) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Urun Detayi</Text>
                    <View style={styles.headerBtn} />
                </View>
                <View style={styles.loadingWrap}>
                    <Text style={{ color: colors.textSecondary }}>Urun bulunamadi</Text>
                </View>
            </View>
        );
    }

    const isInStock = product.status === 'in_stock';

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Urun Detayi</Text>
                <Pressable onPress={handleEdit} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="pencil-outline" size={24} color={serviceBlue} />
                </Pressable>
            </View>

            <FlatList
                data={movements}
                keyExtractor={(item) => item.id.toString()}
                ListHeaderComponent={() => (
                    <View>
                        <View style={[styles.productCard, { backgroundColor: colors.surface }]}>
                            <View style={styles.productHeader}>
                                {product.image ? (
                                    <Image source={{ uri: product.image }} style={styles.productImage} />
                                ) : (
                                    <View style={[styles.imagePlaceholder, { backgroundColor: `${serviceBlue}15` }]}>
                                        <MaterialCommunityIcons name="package-variant" size={48} color={serviceBlue} />
                                    </View>
                                )}
                                <View style={styles.productInfo}>
                                    <Text style={[styles.productName, { color: colors.text }]}>{product.name}</Text>
                                    {product.code && (
                                        <Text style={[styles.productCode, { color: colors.textSecondary }]}>
                                            Kod: {product.code}
                                        </Text>
                                    )}
                                    {product.category_detail && (
                                        <View style={[styles.categoryBadge, { backgroundColor: `${serviceBlue}15` }]}>
                                            <MaterialCommunityIcons name="folder-outline" size={12} color={serviceBlue} />
                                            <Text style={[styles.categoryText, { color: serviceBlue }]}>
                                                {product.category_detail.name}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            <View style={[styles.priceSection, { borderTopColor: colors.divider }]}>
                                <View style={styles.priceItem}>
                                    <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Fiyat</Text>
                                    <Text style={[styles.priceValue, { color: serviceBlue }]}>
                                        {formatPrice(product.price)}
                                    </Text>
                                </View>
                                <View style={[styles.priceDivider, { backgroundColor: colors.divider }]} />
                                <View style={styles.priceItem}>
                                    <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Stok</Text>
                                    <View style={styles.stockRow}>
                                        <View style={[styles.stockDot, { backgroundColor: isInStock ? serviceGreen : serviceRed }]} />
                                        <Text style={[styles.priceValue, { color: isInStock ? serviceGreen : serviceRed }]}>
                                            {isInStock ? product.stock_quantity : 'Yok'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {product.description && (
                                <View style={[styles.descSection, { borderTopColor: colors.divider }]}>
                                    <Text style={[styles.descLabel, { color: colors.textSecondary }]}>Aciklama</Text>
                                    <Text style={[styles.descText, { color: colors.text }]}>{product.description}</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.movementHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>STOK HAREKETLERI</Text>
                            <Text style={[styles.movementCount, { color: colors.textTertiary }]}>
                                {movements.length} kayit
                            </Text>
                        </View>
                    </View>
                )}
                renderItem={({ item }) => <MovementCard movement={item} />}
                contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={serviceBlue} />}
                ListEmptyComponent={
                    <View style={[styles.emptyMovements, { backgroundColor: colors.surface }]}>
                        <MaterialCommunityIcons name="swap-vertical" size={40} color={colors.textTertiary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            Henuz stok hareketi yok
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent: { paddingHorizontal: 16 },

    productCard: { borderRadius: 16, padding: 16, marginBottom: 16 },
    productHeader: { flexDirection: 'row', alignItems: 'flex-start' },
    productImage: { width: 90, height: 90, borderRadius: 16 },
    imagePlaceholder: { width: 90, height: 90, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    productInfo: { flex: 1, marginLeft: 16 },
    productName: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
    productCode: { fontSize: 13, marginBottom: 8 },
    categoryBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    categoryText: { fontSize: 12, fontWeight: '600' },

    priceSection: { flexDirection: 'row', borderTopWidth: 1, marginTop: 16, paddingTop: 16 },
    priceItem: { flex: 1, alignItems: 'center' },
    priceDivider: { width: 1 },
    priceLabel: { fontSize: 12, marginBottom: 4 },
    priceValue: { fontSize: 22, fontWeight: '800' },
    stockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stockDot: { width: 8, height: 8, borderRadius: 4 },

    descSection: { borderTopWidth: 1, marginTop: 16, paddingTop: 16 },
    descLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    descText: { fontSize: 14, lineHeight: 20 },

    movementHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
    movementCount: { fontSize: 12 },

    movementCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
    movementIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    movementInfo: { flex: 1, marginLeft: 12 },
    movementHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    movementType: { fontSize: 14, fontWeight: '700' },
    movementQty: { fontSize: 16, fontWeight: '800' },
    movementDesc: { fontSize: 12, marginBottom: 4, lineHeight: 17 },
    movementDate: { fontSize: 11 },

    emptyMovements: { alignItems: 'center', paddingVertical: 32, borderRadius: 14, marginTop: 8 },
    emptyText: { fontSize: 14, marginTop: 8 },
});