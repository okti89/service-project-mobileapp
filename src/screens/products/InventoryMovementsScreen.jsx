import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
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

const ALL_MOVEMENT_TYPES = [
    { key: 'all', label: 'Tumu', icon: 'checkbox-multiple-blank' },
    { key: 'in', label: 'Giris', icon: 'arrow-down-circle', color: serviceGreen },
    { key: 'out', label: 'Cikis', icon: 'arrow-up-circle', color: serviceRed },
    { key: 'return', label: 'Iade', icon: 'undo', color: '#F59E0B' },
    { key: 'adjustment', label: 'Duzeltme', icon: 'pencil', color: serviceBlue },
];

const MovementCard = ({ movement }) => {
    const { colors } = useTheme();

    const isPositive = movement.movement_type === 'in' || movement.movement_type === 'return';
    const config = ALL_MOVEMENT_TYPES.find(t => t.key === movement.movement_type) || ALL_MOVEMENT_TYPES[4];

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: `${config.color || serviceBlue}15` }]}>
                <MaterialCommunityIcons name={config.icon} size={22} color={config.color || serviceBlue} />
            </View>
            <View style={styles.cardInfo}>
                <View style={styles.cardHeader}>
                    <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>
                        {movement.product_detail?.name || 'Urun'}
                    </Text>
                    <Text style={[styles.qty, { color: config.color || serviceBlue }]}>
                        {isPositive ? '+' : '-'}{movement.quantity}
                    </Text>
                </View>
                <View style={styles.cardSub}>
                    <Text style={[styles.typeLabel, { color: colors.textSecondary }]}>
                        {config.label}
                    </Text>
                    {movement.technician_name && (
                        <Text style={[styles.techName, { color: colors.textTertiary }]}>
                            {movement.technician_name}
                        </Text>
                    )}
                </View>
                {movement.description && (
                    <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={2}>
                        {movement.description}
                    </Text>
                )}
                <Text style={[styles.date, { color: colors.textTertiary }]}>
                    {formatDate(movement.created_at)}
                </Text>
            </View>
        </View>
    );
};

export default function InventoryMovementsScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();

    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedType, setSelectedType] = useState('all');

    const fetchMovements = useCallback(async () => {
        try {
            const params = {};
            if (selectedType !== 'all') {
                params.movement_type = selectedType;
            }
            const response = await api.get(ENDPOINTS.PRODUCTS.STOCK_MOVEMENTS, { params });
            setMovements(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.log('Movements fetch error:', error?.response?.data || error?.message || error);
            Alert.alert('Hata', 'Hareketler yuklenemedi');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedType]);

    useEffect(() => { fetchMovements(); }, [fetchMovements]);

    const handleRefresh = () => { setRefreshing(true); fetchMovements(); };

    const filteredMovements = selectedType === 'all'
        ? movements
        : movements.filter(m => m.movement_type === selectedType);

    const stats = {
        in: movements.filter(m => m.movement_type === 'in').reduce((sum, m) => sum + m.quantity, 0),
        out: movements.filter(m => m.movement_type === 'out').reduce((sum, m) => sum + m.quantity, 0),
        return: movements.filter(m => m.movement_type === 'return').reduce((sum, m) => sum + m.quantity, 0),
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Stok Hareketleri</Text>
                <View style={styles.headerBtn} />
            </View>

            <View style={styles.filterRow}>
                {ALL_MOVEMENT_TYPES.map(type => (
                    <Pressable
                        key={type.key}
                        onPress={() => setSelectedType(type.key)}
                        style={[
                            styles.filterChip,
                            {
                                backgroundColor: selectedType === type.key
                                    ? (type.color || serviceBlue) + '20'
                                    : colors.surface,
                                borderColor: selectedType === type.key
                                    ? (type.color || serviceBlue)
                                    : colors.border,
                            }
                        ]}
                    >
                        <MaterialCommunityIcons
                            name={type.icon}
                            size={16}
                            color={selectedType === type.key ? (type.color || serviceBlue) : colors.textSecondary}
                        />
                        <Text style={[
                            styles.filterLabel,
                            { color: selectedType === type.key ? (type.color || serviceBlue) : colors.textSecondary }
                        ]}>
                            {type.label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <View style={styles.statsRow}>
                <View style={[styles.statBadge, { backgroundColor: `${serviceGreen}15` }]}>
                    <MaterialCommunityIcons name="arrow-down" size={14} color={serviceGreen} />
                    <Text style={[styles.statText, { color: serviceGreen }]}>Giris: {stats.in}</Text>
                </View>
                <View style={[styles.statBadge, { backgroundColor: `${serviceRed}15` }]}>
                    <MaterialCommunityIcons name="arrow-up" size={14} color={serviceRed} />
                    <Text style={[styles.statText, { color: serviceRed }]}>Cikis: {stats.out}</Text>
                </View>
                <View style={[styles.statBadge, { backgroundColor: `${'#F59E0B'}15` }]}>
                    <MaterialCommunityIcons name="undo" size={14} color={'#F59E0B'} />
                    <Text style={[styles.statText, { color: '#F59E0B' }]}>Iade: {stats.return}</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={serviceBlue} />
                </View>
            ) : (
                <FlatList
                    data={filteredMovements}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={serviceBlue} />}
                    ListEmptyComponent={
                        <View style={[styles.emptyWrap, { backgroundColor: colors.surface }]}>
                            <MaterialCommunityIcons name="swap-vertical" size={48} color={colors.textTertiary} />
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>Hareket yok</Text>
                            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                                Bu filtrede stok hareketi bulunamadi
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => <MovementCard movement={item} />}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent: { paddingHorizontal: 16, paddingTop: 8 },

    filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8, flexWrap: 'wrap' },
    filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
    filterLabel: { fontSize: 12, fontWeight: '600' },

    statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
    statBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    statText: { fontSize: 12, fontWeight: '700' },

    card: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
    iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardInfo: { flex: 1, marginLeft: 12 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    productName: { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
    qty: { fontSize: 18, fontWeight: '800' },
    cardSub: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    typeLabel: { fontSize: 12, fontWeight: '600' },
    techName: { fontSize: 11 },
    desc: { fontSize: 12, lineHeight: 17, marginBottom: 4 },
    date: { fontSize: 11 },

    emptyWrap: { alignItems: 'center', paddingVertical: 48, borderRadius: 16, marginTop: 8 },
    emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 12 },
    emptySub: { fontSize: 13, marginTop: 4 },
});