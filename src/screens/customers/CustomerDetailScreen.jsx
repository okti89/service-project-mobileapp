import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    Pressable,
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
import { serviceBlue, serviceGreen, serviceRed } from '@/theme/color';

export default function CustomerDetailScreen({ navigation, route }) {
    const customerId = route?.params?.customerId ?? route?.params?.id;
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();

    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchCustomer = useCallback(async () => {
        if (!customerId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await api.get(ENDPOINTS.CUSTOMERS.DETAIL(customerId));
            setCustomer(response.data);
        } catch (error) {
            console.log('Customer fetch error:', error?.response?.data || error?.message || error);
            Alert.alert('Hata', 'Müşteri bilgileri yüklenemedi');
        } finally {
            setLoading(false);
        }
    }, [customerId]);

    useFocusEffect(
        useCallback(() => {
            fetchCustomer();
        }, [fetchCustomer])
    );

    const handleEdit = () => {
        navigation.navigate('AdminCustomerForm', { customer });
    };

    const handleLocation = () => {
        if (!customer?.address) {
            Alert.alert('Hata', 'Müşteri adresi bulunamadı');
            return;
        }
        navigation.navigate('LocationMap', {
            address: customer.address,
            title: customer.full_name,
            subtitle: customer.phone_number,
            showDirections: true,
        });
    };

    const handleCall = () => {
        if (!customer?.phone_number) {
            Alert.alert('Hata', 'Telefon numarası bulunamadı');
            return;
        }
        Linking.openURL(`tel:${customer.phone_number}`).catch(() => {
            Alert.alert('Hata', 'Arama başlatılamadı');
        });
    };

    const handleWhatsApp = () => {
        if (!customer?.phone_number) {
            Alert.alert('Hata', 'Telefon numarası bulunamadı');
            return;
        }
        Linking.openURL(`https://wa.me/${customer.phone_number.replace(/\D/g, '')}`).catch(() => {
            Alert.alert('Hata', 'WhatsApp açılamadı');
        });
    };

    const handleEmail = () => {
        if (!customer?.email) {
            Alert.alert('Hata', 'E-posta adresi bulunamadı');
            return;
        }
        Linking.openURL(`mailto:${customer.email}`).catch(() => {
            Alert.alert('Hata', 'E-posta uygulaması açılamadı');
        });
    };

    const handleDelete = () => {
        Alert.alert(
            'Müşteri Sil',
            `${customer?.full_name || 'Bu müşteri'} silinecek. Emin misiniz?`,
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(ENDPOINTS.CUSTOMERS.DETAIL(customerId));
                            navigation.goBack();
                        } catch (error) {
                            Alert.alert('Hata', error?.response?.data?.detail || 'Silme başarısız');
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Müşteri Detayı</Text>
                    <View style={styles.headerBtn} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={serviceBlue} />
                </View>
            </View>
        );
    }

    if (!customer) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Müşteri Detayı</Text>
                    <View style={styles.headerBtn} />
                </View>
                <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="account-off" size={64} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.text }]}>Müşteri bulunamadı</Text>
                </View>
            </View>
        );
    }

    const initials = customer.full_name
        .split(' ')
        .filter(Boolean)
        .map(p => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Müşteri Detayı</Text>
                <Pressable onPress={handleEdit} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="pencil" size={24} color={serviceBlue} />
                </Pressable>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Header Card */}
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.customerHeader}>
                        <View style={[styles.avatar, { backgroundColor: `${serviceBlue}15` }]}>
                            <Text style={[styles.avatarText, { color: serviceBlue }]}>{initials}</Text>
                        </View>
                        <View style={styles.customerInfo}>
                            <Text style={[styles.customerName, { color: colors.text }]}>{customer.full_name}</Text>
                            {customer.phone_number && (
                                <Text style={[styles.customerPhone, { color: colors.textSecondary }]}>
                                    {customer.phone_number}
                                </Text>
                            )}
                            {customer.email && (
                                <Text style={[styles.customerEmail, { color: colors.textSecondary }]}>
                                    {customer.email}
                                </Text>
                            )}
                        </View>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Hızlı İşlemler</Text>
                    <View style={styles.actionsGrid}>
                        {customer.phone_number && (
                            <>
                                <Pressable onPress={handleCall} style={styles.actionButton}>
                                    <View style={[styles.actionIconContainer, { backgroundColor: `${serviceGreen}15` }]}>
                                        <MaterialCommunityIcons name="phone" size={24} color={serviceGreen} />
                                    </View>
                                    <Text style={[styles.actionText, { color: colors.text }]}>Ara</Text>
                                </Pressable>
                                <Pressable onPress={handleWhatsApp} style={styles.actionButton}>
                                    <View style={[styles.actionIconContainer, { backgroundColor: '#25D36615' }]}>
                                        <MaterialCommunityIcons name="whatsapp" size={24} color="#25D366" />
                                    </View>
                                    <Text style={[styles.actionText, { color: colors.text }]}>WhatsApp</Text>
                                </Pressable>
                            </>
                        )}
                        {customer.email && (
                            <Pressable onPress={handleEmail} style={styles.actionButton}>
                                <View style={[styles.actionIconContainer, { backgroundColor: `${serviceBlue}15` }]}>
                                    <MaterialCommunityIcons name="email" size={24} color={serviceBlue} />
                                </View>
                                <Text style={[styles.actionText, { color: colors.text }]}>E-posta</Text>
                            </Pressable>
                        )}
                        {customer.address && (
                            <Pressable onPress={handleLocation} style={styles.actionButton}>
                                <View style={[styles.actionIconContainer, { backgroundColor: `${serviceBlue}15` }]}>
                                    <MaterialCommunityIcons name="map-marker" size={24} color={serviceBlue} />
                                </View>
                                <Text style={[styles.actionText, { color: colors.text }]}>Konum</Text>
                            </Pressable>
                        )}
                    </View>
                </View>

                {/* Address */}
                {customer.address && (
                    <Pressable
                        onPress={handleLocation}
                        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                        <View style={styles.sectionHeader}>
                            <MaterialCommunityIcons name="home" size={20} color={serviceBlue} />
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Adres</Text>
                        </View>
                        <Text style={[styles.addressText, { color: colors.text }]}>{customer.address}</Text>
                        <View style={styles.viewOnMapButton}>
                            <MaterialCommunityIcons name="directions" size={16} color={serviceBlue} />
                            <Text style={[styles.viewOnMapText, { color: serviceBlue }]}>Haritada Gör</Text>
                        </View>
                    </Pressable>
                )}

                {/* Note */}
                {customer.note && (
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.sectionHeader}>
                            <MaterialCommunityIcons name="note-text" size={20} color={colors.textSecondary} />
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Not</Text>
                        </View>
                        <Text style={[styles.noteText, { color: colors.textSecondary }]}>{customer.note}</Text>
                    </View>
                )}

                {/* Delete Button */}
                <Pressable onPress={handleDelete} style={[styles.deleteButton, { backgroundColor: `${serviceRed}15` }]}>
                    <MaterialCommunityIcons name="delete" size={20} color={serviceRed} />
                    <Text style={[styles.deleteButtonText, { color: serviceRed }]}>Müşteriyi Sil</Text>
                </Pressable>

                <View style={{ height: insets.bottom + 20 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
    content: { flex: 1, paddingHorizontal: 16 },
    card: {
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    customerHeader: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { fontSize: 24, fontWeight: '800' },
    customerInfo: { flex: 1, marginLeft: 12 },
    customerName: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
    customerPhone: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
    customerEmail: { fontSize: 14, fontWeight: '500' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginLeft: 8 },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    actionButton: {
        alignItems: 'center',
        width: '45%',
        paddingVertical: 16,
    },
    actionIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    actionText: { fontSize: 14, fontWeight: '600' },
    addressText: { fontSize: 15, fontWeight: '500', lineHeight: 22 },
    viewOnMapButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 4,
    },
    viewOnMapText: { fontSize: 14, fontWeight: '700' },
    noteText: { fontSize: 15, fontWeight: '500', lineHeight: 22 },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 16,
        marginTop: 12,
        marginBottom: 20,
    },
    deleteButtonText: { fontSize: 16, fontWeight: '700' },
});
