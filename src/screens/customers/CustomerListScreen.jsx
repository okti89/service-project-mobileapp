import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Platform,
    Pressable,
    RefreshControl,
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
import { serviceBlue, serviceGreen } from '@/theme/color';

const CustomerCard = ({ customer, onPress, onEdit, navigation }) => {
    const { colors } = useTheme();
    const fullName = customer.full_name || 'İsimsiz Müşteri';
    const initials = fullName.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();
    const phone = customer.phone_number;
    const address = customer.address;

    const handleWhatsApp = (e) => {
        e.stopPropagation();
        if (!phone) { Alert.alert('Hata', 'Telefon numarası bulunamadı'); return; }
        Linking.openURL(`https://wa.me/${phone.replace(/\D/g, '')}`);
    };

    const handleCall = (e) => {
        e.stopPropagation();
        if (!phone) { Alert.alert('Hata', 'Telefon numarası bulunamadı'); return; }
        Linking.openURL(`tel:${phone.replace(/\D/g, '')}`);
    };

    const handleLocation = (e) => {
        e.stopPropagation();
        if (!address) { Alert.alert('Hata', 'Müşteri adresi bulunamadı'); return; }
        if (__DEV__) console.log('[LocationMap] navigate with address:', JSON.stringify(address));
        navigation.navigate('LocationMap', {
            address,
            title: fullName,
            subtitle: phone || '',
            showDirections: true,
        });
    };

    const handleServices = (e) => {
        e.stopPropagation();
        navigation.navigate('ServiceList', { customerId: customer.id });
    };

    return (
        <Pressable onPress={() => onPress(customer)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
                <View style={[styles.avatarWrap, { backgroundColor: `${serviceBlue}15` }]}>
                    <Text style={[styles.avatarText, { color: serviceBlue }]}>{initials}</Text>
                </View>
                <View style={styles.cardInfo}>
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{fullName}</Text>
                    {customer.email && (
                        <Text style={[styles.subText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {customer.email}
                        </Text>
                    )}
                    {phone && (
                        <Text style={[styles.subText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {phone}
                        </Text>
                    )}
                </View>
                <View style={styles.cardActions}>
                    <Pressable onPress={handleWhatsApp} hitSlop={8}>
                        <MaterialCommunityIcons name="whatsapp" size={20} color="#25D366" />
                    </Pressable>
                    <Pressable onPress={handleCall} hitSlop={8} style={{ marginHorizontal: 12 }}>
                        <MaterialCommunityIcons name="phone" size={20} color={serviceBlue} />
                    </Pressable>
                    <Pressable onPress={handleServices} hitSlop={8} style={{ marginRight: 12 }}>
                        <MaterialCommunityIcons name="clipboard-list-outline" size={20} color="#F59E0B" />
                    </Pressable>
                    <Pressable onPress={onEdit} hitSlop={8}>
                        <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.textSecondary} />
                    </Pressable>
                </View>
            </View>

            {address && (
                <Pressable onPress={handleLocation} style={[styles.addressRow, { borderTopColor: colors.divider }]}>
                    <MaterialCommunityIcons name="map-marker-outline" size={16} color={serviceGreen} style={{ marginRight: 6 }} />
                    <Text style={[styles.addressText, { color: colors.textSecondary }]} numberOfLines={2}>{address}</Text>
                    <MaterialCommunityIcons name="directions" size={16} color={serviceGreen} style={{ marginLeft: 4 }} />
                </Pressable>
            )}

            {customer.note && (
                <View style={[styles.noteRow, { backgroundColor: '#FF8C0008' }]}>
                    <MaterialCommunityIcons name="note-text-outline" size={14} color={colors.textTertiary} style={{ marginRight: 6 }} />
                    <Text style={[styles.noteText, { color: colors.textTertiary }]} numberOfLines={1}>{customer.note}</Text>
                </View>
            )}
        </Pressable>
    );
};

export default function CustomerListScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();

    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchCustomers = useCallback(async () => {
        try {
            const response = await api.get(ENDPOINTS.CUSTOMERS.LIST);
            setCustomers(Array.isArray(response?.data) ? response.data : []);
        } catch (error) {
            console.log('Customers fetch error:', error?.response?.data || error?.message || error);
            Alert.alert('Hata', 'Müşteriler yüklenemedi');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // İlk yükleme + CustomerForm'dan dönünce listeyi tazele
    useFocusEffect(
        useCallback(() => {
            fetchCustomers();
        }, [fetchCustomers])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        fetchCustomers();
    };

    const filtered = customers.filter(c => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (c.full_name || '').toLowerCase().includes(q) ||
            (c.phone_number || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            (c.address || '').toLowerCase().includes(q) ||
            (c.note || '').toLowerCase().includes(q)
        );
    });

    const handleOpenAdd = () => {
        navigation.navigate('AdminCustomerForm', { customer: null });
    };

    const handleOpenEdit = (customer) => {
        navigation.navigate('AdminCustomerForm', { customer });
    };

    const handleCustomerPress = (customer) => {
        navigation.navigate('AdminCustomerDetail', { customerId: customer.id });
    };

    const handleDelete = (customer) => {
        Alert.alert(
            'Müşteri Sil',
            `"${customer.full_name}" silinecek. Emin misiniz?`,
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(ENDPOINTS.CUSTOMERS.DETAIL(customer.id));
                            fetchCustomers();
                        } catch (error) {
                            Alert.alert('Hata', error?.response?.data?.detail || 'Silme başarısız');
                        }
                    },
                },
            ]
        );
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Müşteriler</Text>
                <Pressable onPress={handleOpenAdd} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="plus" size={26} color={serviceBlue} />
                </Pressable>
            </View>

            <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                    placeholder="Ara (ad, telefon, e-posta, adres)..."
                    placeholderTextColor={colors.textTertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={[styles.searchInput, { color: colors.text }]}
                    clearButtonMode="while-editing"
                />
                {searchQuery ? (
                    <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                        <MaterialCommunityIcons name="close-circle" size={18} color={colors.textTertiary} />
                    </Pressable>
                ) : null}
            </View>

            <View style={styles.statsRow}>
                <Text style={[styles.statsText, { color: colors.textSecondary }]}>
                    <Text style={{ color: serviceBlue, fontWeight: '700' }}>{filtered.length}</Text> müşteri
                </Text>
                {searchQuery && filtered.length !== customers.length && (
                    <Text style={[styles.statsText, { color: colors.textTertiary }]}>
                        / {customers.length} toplam
                    </Text>
                )}
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={serviceBlue} />
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={serviceBlue} />
                    }
                    ListEmptyComponent={
                        <View style={[styles.emptyWrap, { backgroundColor: colors.surface }]}>
                            <MaterialCommunityIcons
                                name={searchQuery ? 'account-search-outline' : 'account-group-outline'}
                                size={56}
                                color={colors.textTertiary}
                            />
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>
                                {searchQuery ? 'Sonuç bulunamadı' : 'Müşteri yok'}
                            </Text>
                            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                                {searchQuery ? 'Farklı anahtar kelime deneyin' : 'Yeni müşteri ekleyerek başlayın'}
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <CustomerCard
                            customer={item}
                            onPress={handleCustomerPress}
                            onEdit={() => handleOpenEdit(item)}
                            navigation={navigation}
                        />
                    )}
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
    searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
    searchInput: { flex: 1, fontSize: 15, height: '100%', padding: 0 },
    statsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 4 },
    statsText: { fontSize: 13, fontWeight: '500' },
    listContent: { paddingHorizontal: 16, paddingTop: 4 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    card: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    avatarWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 16, fontWeight: '800' },
    cardInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
    name: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    subText: { fontSize: 12, marginTop: 1 },
    cardActions: { flexDirection: 'row', alignItems: 'center' },
    addressRow: { flexDirection: 'row', alignItems: 'flex-start', borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
    addressText: { flex: 1, fontSize: 12, lineHeight: 17 },
    noteRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, padding: 8, borderRadius: 8 },
    noteText: { flex: 1, fontSize: 11 },

    emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, borderRadius: 16, marginTop: 16 },
    emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 12 },
    emptySub: { fontSize: 13, marginTop: 4 },
});
