import React, { useCallback, useMemo, useState } from 'react';
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

const getStatusConfig = (quantity) => {
    const stock = toNumber(quantity);
    if (stock === 0) return { label: 'Tükendi', color: serviceRed, bg: 'rgba(220, 53, 69, 0.10)', icon: 'close-circle-outline' };
    if (stock <= 5) return { label: 'Düşük stok', color: serviceOrange, bg: 'rgba(255, 140, 0, 0.12)', icon: 'alert-outline' };
    return { label: 'Yeterli stok', color: serviceGreen, bg: 'rgba(0, 163, 108, 0.12)', icon: 'check-circle-outline' };
};

export default function ProductDetailScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const initialProduct = route?.params?.product || null;
    const productId = route?.params?.productId || initialProduct?.id;

    const [product, setProduct] = useState(initialProduct);
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(!initialProduct);
    const [movementsLoading, setMovementsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const fetchProduct = useCallback(async () => {
        if (!productId) return;
        try {
            const response = await api.get(ENDPOINTS.PRODUCTS.DETAIL(productId));
            if (response?.data) {
                setProduct(response.data);
            }
        } catch (error) {
            console.log('Product detail fetch error:', error?.response?.data || error?.message || error);
            Alert.alert('Hata', 'Ürün detayı yüklenemedi');
        }
    }, [productId]);

    const fetchMovements = useCallback(async () => {
        if (!productId) return;
        try {
            setMovementsLoading(true);
            const response = await api.get(ENDPOINTS.PRODUCTS.STOCK_MOVEMENTS, {
                params: { product: productId },
            });
            setMovements(Array.isArray(response?.data) ? response.data : []);
        } catch (error) {
            console.log('Product movements fetch error:', error?.response?.data || error?.message || error);
            Alert.alert('Hata', 'Stok hareketleri yüklenemedi');
        } finally {
            setMovementsLoading(false);
        }
    }, [productId]);

    const fetchData = useCallback(async () => {
        try {
            await Promise.all([fetchProduct(), fetchMovements()]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [fetchMovements, fetchProduct]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const status = useMemo(() => getStatusConfig(product?.stock_quantity), [product?.stock_quantity]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleEdit = () => {
        if (!product) return;
        navigation.navigate('AdminProductForm', { product });
    };

    if (loading && !product) {
        return (
            <View style={[styles.screen, styles.centerContainer, { backgroundColor: colors.backgroundSecondary }]}>
                <ActivityIndicator size="large" color={serviceBlue} />
            </View>
        );
    }

    return (
        <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                </Pressable>
                <View style={styles.headerTitleWrap}>
                    <Text style={[styles.headerKicker, { color: colors.textSecondary }]}>Ürün detayı</Text>
                    <Text style={[styles.headerTitleText, { color: colors.text }]} numberOfLines={1}>{product?.name || 'Ürün'}</Text>
                </View>
                <Pressable
                    onPress={handleEdit}
                    style={({ pressed }) => [styles.iconButton, { borderColor: `${serviceBlue}24`, backgroundColor: `${serviceBlue}10` }, pressed && styles.btnPressed]}
                >
                    <MaterialCommunityIcons name="pencil-outline" size={22} color={serviceBlue} />
                </Pressable>
            </View>

            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[serviceBlue]} />}
            >
                <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.imageWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F6FA' }]}>
                        {product?.image ? (
                            <Image source={{ uri: product.image }} style={styles.productImage} />
                        ) : (
                            <MaterialCommunityIcons name="package-variant" size={44} color={colors.textTertiary} />
                        )}
                    </View>
                    <View style={styles.heroInfo}>
                        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                            <MaterialCommunityIcons name={status.icon} size={15} color={status.color} />
                            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                        </View>
                        <Text style={[styles.productName, { color: colors.text }]}>{product?.name || 'Ürün'}</Text>
                        <Text style={[styles.productMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                            {product?.category_detail?.name || 'Kategorisiz'} • SKU: {product?.code || '-'}
                        </Text>
                    </View>
                </View>

                <View style={styles.metricGrid}>
                    <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Stok</Text>
                        <Text style={[styles.metricValue, { color: toNumber(product?.stock_quantity) === 0 ? serviceRed : colors.text }]}>
                            {formatCount(product?.stock_quantity)} adet
                        </Text>
                    </View>
                    <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Birim Fiyat</Text>
                        <Text style={[styles.metricValue, { color: colors.text }]}>{formatCurrency(product?.price)}</Text>
                    </View>
                    <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Stok Değeri</Text>
                        <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>
                            {formatCurrency(toNumber(product?.price) * toNumber(product?.stock_quantity))}
                        </Text>
                    </View>
                </View>

                {!!product?.description && (
                    <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Açıklama</Text>
                        <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{product.description}</Text>
                    </View>
                )}

                <View style={styles.actionRow}>
                    <Pressable
                        onPress={handleEdit}
                        style={({ pressed }) => [styles.primaryAction, { backgroundColor: serviceBlue }, pressed && styles.btnPressed]}
                    >
                        <MaterialCommunityIcons name="pencil-outline" size={19} color="#FFFFFF" />
                        <Text style={styles.primaryActionText}>Detayı Düzenle</Text>
                    </Pressable>
                    <Pressable
                        onPress={fetchMovements}
                        style={({ pressed }) => [styles.secondaryAction, { borderColor: `${serviceBlue}55`, backgroundColor: colors.surface }, pressed && styles.btnPressed]}
                    >
                        <MaterialCommunityIcons name="swap-vertical" size={19} color={serviceBlue} />
                        <Text style={[styles.secondaryActionText, { color: serviceBlue }]}>Stok Hareketleri</Text>
                    </Pressable>
                </View>

                <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Stok Hareketleri</Text>
                        {movementsLoading && <ActivityIndicator size="small" color={serviceBlue} />}
                    </View>

                    {!movementsLoading && movements.length === 0 ? (
                        <View style={styles.emptyMovements}>
                            <MaterialCommunityIcons name="swap-vertical" size={34} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Bu ürün için stok hareketi bulunamadı</Text>
                        </View>
                    ) : (
                        movements.map((item) => {
                            const isAddition = item.movement_type === 'in' || item.movement_type === 'return';
                            return (
                                <View key={item.id} style={[styles.movementItem, { borderBottomColor: colors.border }]}>
                                    <View style={[styles.movementIconWrap, { backgroundColor: isAddition ? `${serviceGreen}10` : `${serviceRed}10` }]}>
                                        <MaterialCommunityIcons
                                            name={isAddition ? 'plus-box-outline' : 'minus-box-outline'}
                                            size={21}
                                            color={isAddition ? serviceGreen : serviceRed}
                                        />
                                    </View>
                                    <View style={styles.movementInfo}>
                                        <Text style={[styles.movementTitle, { color: colors.text }]} numberOfLines={1}>
                                            {item.movement_type_display || (isAddition ? 'Stok girişi' : 'Stok çıkışı')}
                                        </Text>
                                        <Text style={[styles.movementMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                                            {item.technician_name || 'Bilinmiyor'} • {dayjs(item.created_at).format('DD MMM YYYY HH:mm')}
                                        </Text>
                                        {!!item.description && (
                                            <Text style={[styles.movementDesc, { color: colors.textTertiary }]} numberOfLines={2}>{item.description}</Text>
                                        )}
                                    </View>
                                    <Text style={[styles.movementQuantity, { color: isAddition ? serviceGreen : serviceRed }]}>
                                        {isAddition ? '+' : '-'}{formatCount(item.quantity)}
                                    </Text>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    centerContainer: { alignItems: 'center', justifyContent: 'center' },
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
    headerTitleWrap: { flex: 1, minWidth: 0 },
    headerKicker: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
    headerTitleText: { fontSize: 21, fontWeight: '900', letterSpacing: 0 },
    content: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
    heroCard: {
        flexDirection: 'row',
        borderRadius: 18,
        borderWidth: 1,
        padding: 14,
        gap: 14,
    },
    imageWrap: {
        width: 96,
        height: 96,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    heroInfo: { flex: 1, minWidth: 0, justifyContent: 'center' },
    statusBadge: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        marginBottom: 10,
    },
    statusText: { fontSize: 11, fontWeight: '900' },
    productName: { fontSize: 19, fontWeight: '900', marginBottom: 5 },
    productMeta: { fontSize: 12, fontWeight: '700' },
    metricGrid: { flexDirection: 'row', gap: 8 },
    metricCard: {
        flex: 1,
        minWidth: 0,
        borderRadius: 14,
        borderWidth: 1,
        padding: 12,
    },
    metricLabel: { fontSize: 10, fontWeight: '700', marginBottom: 5 },
    metricValue: { fontSize: 14, fontWeight: '900' },
    sectionCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    sectionTitle: { fontSize: 15, fontWeight: '900' },
    descriptionText: { fontSize: 13, fontWeight: '600', lineHeight: 19, marginTop: 8 },
    actionRow: { flexDirection: 'row', gap: 10 },
    primaryAction: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
    },
    primaryActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
    secondaryAction: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
    },
    secondaryActionText: { fontSize: 14, fontWeight: '900' },
    btnPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
    emptyMovements: { alignItems: 'center', paddingVertical: 22, gap: 8 },
    emptyText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
    movementItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    movementIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    movementInfo: { flex: 1, minWidth: 0, marginLeft: 12 },
    movementTitle: { fontSize: 13, fontWeight: '900', marginBottom: 2 },
    movementMeta: { fontSize: 11, fontWeight: '700' },
    movementDesc: { fontSize: 10, fontWeight: '600', marginTop: 3 },
    movementQuantity: { fontSize: 14, fontWeight: '900', marginLeft: 10 },
});