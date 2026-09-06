import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dayjs from 'dayjs';

import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import quoteService from '@/services/quoteService';
import { serviceBlue, serviceGreen, serviceOrange } from '@/theme/color';

const money = (value) => `${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

const quoteStatus = (quote) => {
    if (quote?.converted_service) return { label: 'Servise dönüştürüldü', color: serviceGreen, icon: 'check-decagram-outline' };
    if (quote?.sent_at) return { label: 'Gönderildi', color: serviceBlue, icon: 'send-check-outline' };
    return { label: 'Hazır', color: serviceOrange, icon: 'file-clock-outline' };
};

export default function QuoteListScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { showToast } = useToast();
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');

    const loadQuotes = useCallback(async (refresh = false) => {
        if (refresh) setRefreshing(true);
        try {
            setQuotes(await quoteService.list());
        } catch (error) {
            showToast('error', 'Teklifler yüklenemedi', error?.response?.data?.detail || 'Bağlantınızı kontrol edip tekrar deneyin.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showToast]);

    useFocusEffect(useCallback(() => { loadQuotes(); }, [loadQuotes]));

    const filteredQuotes = useMemo(() => {
        const query = search.trim().toLocaleLowerCase('tr-TR');
        if (!query) return quotes;
        return quotes.filter((quote) => [
            quote.quote_number,
            quote.customer_detail?.full_name,
            quote.customer_detail?.phone_number,
        ].some((value) => String(value || '').toLocaleLowerCase('tr-TR').includes(query)));
    }, [quotes, search]);

    const summary = useMemo(() => ({
        total: quotes.length,
        sent: quotes.filter((quote) => quote.sent_at).length,
        converted: quotes.filter((quote) => quote.converted_service).length,
    }), [quotes]);

    const renderQuote = ({ item }) => {
        const status = quoteStatus(item);
        return (
            <Pressable
                onPress={() => navigation.navigate('AdminQuoteDetail', { quoteId: item.id, quote: item })}
                style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
            >
                <View style={styles.cardTop}>
                    <View style={[styles.iconWrap, { backgroundColor: `${status.color}16` }]}>
                        <MaterialCommunityIcons name="file-document-outline" size={22} color={status.color} />
                    </View>
                    <View style={styles.cardTitleWrap}>
                        <Text style={[styles.quoteNumber, { color: colors.text }]}>{item.quote_number || 'Teklif'}</Text>
                        <Text style={[styles.customerName, { color: colors.textSecondary }]} numberOfLines={1}>
                            {item.customer_detail?.full_name || 'Müşteri'}
                        </Text>
                    </View>
                    <Text style={[styles.total, { color: colors.text }]}>{money(item.total_price)}</Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.cardBottom}>
                    <View style={[styles.statusBadge, { backgroundColor: `${status.color}14` }]}>
                        <MaterialCommunityIcons name={status.icon} size={14} color={status.color} />
                        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                    <View style={styles.dateWrap}>
                        <MaterialCommunityIcons name="calendar-outline" size={14} color={colors.textTertiary} />
                        <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                            {item.valid_until ? `Son: ${dayjs(item.valid_until).format('DD.MM.YYYY')}` : dayjs(item.created_at).format('DD.MM.YYYY')}
                        </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
                </View>
            </Pressable>
        );
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                </Pressable>
                <View style={styles.headerTitleWrap}>
                    <Text style={[styles.headerKicker, { color: colors.textSecondary }]}>Müşteri teklifleri</Text>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Teklifler</Text>
                </View>
                <Pressable onPress={() => navigation.navigate('AdminQuoteForm')} style={[styles.headerButton, { backgroundColor: `${serviceBlue}12`, borderColor: `${serviceBlue}28` }]}>
                    <MaterialCommunityIcons name="plus" size={24} color={serviceBlue} />
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={serviceBlue} /></View>
            ) : (
                <FlatList
                    data={filteredQuotes}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderQuote}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadQuotes(true)} colors={[serviceBlue]} tintColor={serviceBlue} />}
                    contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={(
                        <>
                            <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <View style={styles.summaryItem}><Text style={[styles.summaryValue, { color: colors.text }]}>{summary.total}</Text><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Toplam</Text></View>
                                <View style={[styles.summaryLine, { backgroundColor: colors.border }]} />
                                <View style={styles.summaryItem}><Text style={[styles.summaryValue, { color: serviceBlue }]}>{summary.sent}</Text><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Gönderilen</Text></View>
                                <View style={[styles.summaryLine, { backgroundColor: colors.border }]} />
                                <View style={styles.summaryItem}><Text style={[styles.summaryValue, { color: serviceGreen }]}>{summary.converted}</Text><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Servisleşen</Text></View>
                            </View>
                            <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <MaterialCommunityIcons name="magnify" size={20} color={colors.textTertiary} />
                                <TextInput
                                    value={search}
                                    onChangeText={setSearch}
                                    placeholder="Teklif no veya müşteri ara"
                                    placeholderTextColor={colors.textTertiary}
                                    style={[styles.searchInput, { color: colors.text }]}
                                    returnKeyType="search"
                                />
                                {!!search && <Pressable onPress={() => setSearch('')}><MaterialCommunityIcons name="close-circle" size={18} color={colors.textTertiary} /></Pressable>}
                            </View>
                        </>
                    )}
                    ListEmptyComponent={(
                        <View style={styles.empty}>
                            <MaterialCommunityIcons name="file-document-plus-outline" size={48} color={colors.textTertiary} />
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>Teklif bulunamadı</Text>
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>İlk müşteri teklifini sağ üstteki artı düğmesinden oluşturabilirsin.</Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
    headerButton: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    headerTitleWrap: { flex: 1, minWidth: 0 },
    headerKicker: { fontSize: 12, fontWeight: '700' },
    headerTitle: { fontSize: 24, fontWeight: '900', marginTop: 1 },
    content: { paddingHorizontal: 16, paddingTop: 4 },
    summary: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, paddingVertical: 14, marginBottom: 12 },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryValue: { fontSize: 20, fontWeight: '900' },
    summaryLabel: { fontSize: 11, fontWeight: '700', marginTop: 3 },
    summaryLine: { width: 1 },
    search: { height: 50, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '600', paddingVertical: 0 },
    card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    iconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardTitleWrap: { flex: 1, minWidth: 0 },
    quoteNumber: { fontSize: 15, fontWeight: '900' },
    customerName: { fontSize: 12, fontWeight: '600', marginTop: 3 },
    total: { fontSize: 15, fontWeight: '900' },
    divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
    cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
    statusText: { fontSize: 10, fontWeight: '800' },
    dateWrap: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
    dateText: { fontSize: 11, fontWeight: '600' },
    empty: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 54 },
    emptyTitle: { fontSize: 17, fontWeight: '900', marginTop: 12 },
    emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 6 },
});
