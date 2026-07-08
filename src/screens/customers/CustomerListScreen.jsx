import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
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
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';

const getInitials = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const CustomerCard = ({ customer, onPress, onEdit, navigation }) => {
    const { colors, isDark } = useTheme();
    const fullName = customer.full_name || 'İsimsiz Müşteri';
    const initials = getInitials(fullName);
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
        <Pressable
            onPress={() => onPress(customer)}
            style={({ pressed }) => [
                styles.card,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.95 : 1
                }
            ]}
        >
            <View style={styles.cardHeader}>
                {/* Avatar */}
                <View style={[styles.avatarWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EEF2F6' }]}>
                    <Text style={[styles.avatarText, { color: colors.textSecondary }]}>{initials}</Text>
                </View>

                {/* Info */}
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
                    {address && (
                        <Text style={[styles.subText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {address}
                        </Text>
                    )}
                </View>

                {/* Edit Button on Top-Right */}
                <Pressable onPress={onEdit} style={({ pressed }) => [styles.topEditBtn, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', opacity: pressed ? 0.7 : 1 }]}>
                    <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.textSecondary} />
                </Pressable>
            </View>

            {/* Note Row (Outside cardHeader so it wraps properly on its own line) */}
            {customer.note && (
                <View style={[styles.noteRow, { backgroundColor: isDark ? 'rgba(255, 140, 0, 0.05)' : '#FF8C0008' }]}>
                    <MaterialCommunityIcons name="note-text-outline" size={14} color={colors.textTertiary} style={{ marginRight: 6 }} />
                    <Text style={[styles.noteText, { color: serviceRed }]}>Not: {customer.note}</Text>
                </View>
            )}

            {/* Bottom Actions Row */}
            <View style={[styles.bottomActionsRow, { borderTopColor: colors.border }]}>
                <Pressable onPress={handleWhatsApp} style={({ pressed }) => [styles.bottomActionBtn, { borderColor: '#25D366', backgroundColor: isDark ? 'rgba(37, 211, 102, 0.08)' : 'rgba(37, 211, 102, 0.05)', opacity: pressed ? 0.7 : 1 }]}>
                    <MaterialCommunityIcons name="whatsapp" size={14} color="#25D366" />
                    <Text style={[styles.bottomActionText, { color: isDark ? '#4ADE80' : '#15803D' }]}>WhatsApp</Text>
                </Pressable>
                <Pressable onPress={handleCall} style={({ pressed }) => [styles.bottomActionBtn, { borderColor: serviceBlue, backgroundColor: isDark ? 'rgba(37, 99, 235, 0.08)' : 'rgba(37, 99, 235, 0.05)', opacity: pressed ? 0.7 : 1 }]}>
                    <MaterialCommunityIcons name="phone" size={14} color={serviceBlue} />
                    <Text style={[styles.bottomActionText, { color: serviceBlue }]}>Ara</Text>
                </Pressable>
                <Pressable onPress={handleLocation} style={({ pressed }) => [styles.bottomActionBtn, { borderColor: serviceGreen, backgroundColor: isDark ? 'rgba(22, 163, 74, 0.08)' : 'rgba(22, 163, 74, 0.05)', opacity: pressed ? 0.7 : 1 }]}>
                    <MaterialCommunityIcons name="map-marker-outline" size={14} color={serviceGreen} />
                    <Text style={[styles.bottomActionText, { color: serviceGreen }]}>Konum</Text>
                </Pressable>
                <Pressable onPress={handleServices} style={({ pressed }) => [styles.bottomActionBtn, { borderColor: serviceOrange, backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.05)', opacity: pressed ? 0.7 : 1 }]}>
                    <MaterialCommunityIcons name="clipboard-list-outline" size={14} color={serviceOrange} />
                    <Text style={[styles.bottomActionText, { color: serviceOrange }]}>Servisler</Text>
                </Pressable>
            </View>
        </Pressable>
    );
};

export default function CustomerListScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();

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

    useFocusEffect(
        useCallback(() => {
            fetchCustomers();
        }, [fetchCustomers])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        fetchCustomers();
    };

    const handleOpenAdd = () => {
        navigation.navigate('AdminCustomerForm', { customer: null });
    };

    const handleOpenEdit = (customer) => {
        navigation.navigate('AdminCustomerForm', { customer });
    };

    const handleCustomerPress = (customer) => {
        navigation.navigate('AdminCustomerDetail', { customerId: customer.id });
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

    return (
        <View style={[styles.screen, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Müşteriler</Text>
                <Pressable onPress={handleOpenAdd} style={[styles.addBtn, { borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="plus" size={22} color={serviceBlue} />
                </Pressable>
            </View>

            {/* Search Input Bar (Mockup-style) */}
            <View style={[styles.searchBarWrapper, { backgroundColor: isDark ? colors.surface : '#FFFFFF', borderColor: colors.border }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.textTertiary} style={{ marginRight: 8 }} />
                <TextInput
                    placeholder="Müşteri adı, telefon veya adres ara..."
                    placeholderTextColor={colors.textTertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={[styles.searchInput, { color: colors.text }]}
                    clearButtonMode="while-editing"
                />
            </View>

            {/* List */}
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
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[serviceBlue]} />
                    }
                    ListEmptyComponent={
                        <View style={[styles.emptyWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>

                            <MaterialCommunityIcons
                                name={searchQuery ? 'account-search-outline' : 'account-group-outline'}
                                size={48}
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
    screen: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
    },
    addBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBarWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 8,
        paddingHorizontal: 12,
        height: 48,
        borderRadius: 16,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        padding: 0,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        marginBottom: 12,
        // Card Separation Shadow
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    topEditBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '800',
    },
    cardInfo: {
        flex: 1,
        marginLeft: 12,
        marginRight: 6,
    },
    name: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    subText: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 1,
    },
    bottomActionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderTopWidth: 1,
        marginTop: 12,
        paddingTop: 10,
        gap: 6,
    },
    bottomActionBtn: {
        height: 31,
        borderRadius: 8,
        borderWidth: 1.2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 7,
        marginBottom: 3,
    },
    bottomActionText: {
        fontSize: 11.5,
        fontWeight: '700',
        marginLeft: 4,
    },
    noteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        padding: 8,
        borderRadius: 10,
    },
    noteText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '500',
    },
    emptyWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        borderRadius: 16,
        borderWidth: 1,
        marginTop: 16,
        gap: 12,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '800',
    },
    emptySub: {
        fontSize: 14,
        fontWeight: '600',
    },
});
