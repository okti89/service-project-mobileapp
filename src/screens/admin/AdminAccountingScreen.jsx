import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
    ScrollView,
    Dimensions,
    BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/tr'; // Türkçe dil desteği
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';

// Gün isimleri
const WEEKDAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

const MONTHS_TR = [
    { value: '01', label: 'Ocak' },
    { value: '02', label: 'Şubat' },
    { value: '03', label: 'Mart' },
    { value: '04', label: 'Nisan' },
    { value: '05', label: 'Mayıs' },
    { value: '06', label: 'Haziran' },
    { value: '07', label: 'Temmuz' },
    { value: '08', label: 'Ağustos' },
    { value: '09', label: 'Eylül' },
    { value: '10', label: 'Ekim' },
    { value: '11', label: 'Kasım' },
    { value: '12', label: 'Aralık' },
];

const ACCOUNT_TYPE_ICONS = {
    cash: 'credit-card-wireless-outline',
    bank: 'bank-outline',
    credit_card: 'credit-card-outline',
};

const fmtMoney = (val) => {
    const n = Number(val || 0);
    return Number.isFinite(n)
        ? n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0,00';
};

function isReversalTransaction(tx) {
    const receipt = String(tx?.receipt_number || '').toUpperCase();
    const description = String(tx?.description || '').toLowerCase();
    return (
        tx?.is_retrieved === true ||
        receipt.includes(':REV:') ||
        description.includes('ters kayıt') ||
        description.includes('iptal') ||
        description.includes('geri alındı')
    );
}

// ─── StatCard Bileşeni ───────────────────────────────────────────────────────

function StatCard({ title, value, icon, color, bg, border, isDark, subText }) {
    return (
        <View style={[styles.statCard, { backgroundColor: bg, borderColor: border }]}>
            <View style={styles.watermarkIcon}>
                <MaterialCommunityIcons name={icon} size={64} color={`${color}08`} />
            </View>
            <View style={styles.statCardHeader}>
                <Text style={[styles.statTitle, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]} numberOfLines={1}>
                    {title}
                </Text>
                <View style={[styles.statIconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : `${color}15` }]}>
                    <MaterialCommunityIcons name={icon} size={14} color={isDark ? '#FFF' : color} />
                </View>
            </View>
            <Text style={[styles.statValue, { color: isDark ? '#FFF' : '#0F172A' }]} numberOfLines={1}>
                ₺{fmtMoney(value)}
            </Text>
            {subText ? (
                <Text style={[styles.statSubText, { color: isDark ? 'rgba(255,255,255,0.45)' : '#64748B' }]} numberOfLines={1}>
                    {subText}
                </Text>
            ) : null}
        </View>
    );
}

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

export default function AdminAccountingScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();

    // Veri State
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [receivables, setReceivables] = useState([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Sekme State
    const [mainTab, setMainTab] = useState('transactions'); // 'transactions' veya 'receivables'
    const [activeTab, setActiveTab] = useState('income');
    const [selectedAccount, setSelectedAccount] = useState(null);

    // Tarih/Dönem Filtreleri
    const [periodType, setPeriodType] = useState('monthly'); // 'daily', 'monthly', 'yearly', 'all'
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Takvim Görüntüleme Ayı
    const [viewedMonth, setViewedMonth] = useState(new Date());

    const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i);

    // BottomSheet Refs
    const periodSheetRef = useRef(null);
    const periodSheetIndexRef = useRef(-1);

    // BackHandler
    useEffect(() => {
        const backAction = () => {
            if (periodSheetIndexRef.current >= 0) {
                periodSheetRef.current?.close();
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );

        return () => backHandler.remove();
    }, []);

    // Veri Çekme
    const fetchData = useCallback(async () => {
        try {
            const [accountsRes, transRes, recRes] = await Promise.all([
                api.get(ENDPOINTS.ACCOUNTING.ACCOUNTS),
                api.get(ENDPOINTS.ACCOUNTING.TRANSACTIONS),
                api.get(ENDPOINTS.REPORTS.OVERDUE_RECEIVABLES, { params: { limit: 200 } })
            ]);

            setAccounts(Array.isArray(accountsRes.data) ? accountsRes.data : (accountsRes.data?.results || []));
            setTransactions(Array.isArray(transRes.data) ? transRes.data : (transRes.data?.results || []));
            setReceivables(Array.isArray(recRes.data) ? recRes.data : (recRes.data?.results || []));
        } catch (err) {
            console.log('Accounting fetch error:', err?.message);
            showToast('error', 'Hata', 'Finansal veriler yüklenemedi.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // Filtrelenmiş İşlemler
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const tDate = new Date(t.date);
            if (isNaN(tDate)) return true;

            if (periodType === 'daily') {
                return dayjs(tDate).isSame(dayjs(selectedDate), 'day');
            } else if (periodType === 'monthly') {
                const monthStr = String(tDate.getMonth() + 1).padStart(2, '0');
                if (tDate.getFullYear() !== Number(filterYear) || monthStr !== filterMonth) {
                    return false;
                }
            } else if (periodType === 'yearly') {
                if (tDate.getFullYear() !== Number(filterYear)) {
                    return false;
                }
            }

            if (selectedAccount && t.account !== selectedAccount.id) {
                return false;
            }

            if (activeTab === 'income' && t.transaction_type !== 'income') return false;
            if (activeTab === 'expense' && t.transaction_type !== 'expense') return false;

            return true;
        });
    }, [transactions, periodType, filterYear, filterMonth, selectedDate, selectedAccount, activeTab]);

    // Finansal Özetler
    const stats = useMemo(() => {
        let income = 0;
        let expense = 0;
        let reversal = 0;

        filteredTransactions.forEach(t => {
            const amt = Number(t.amount || 0);
            if (isReversalTransaction(t)) {
                reversal += amt;
            } else {
                if (t.transaction_type === 'income') income += amt;
                else if (t.transaction_type === 'expense') expense += amt;
            }
        });

        const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
        const uncollected = receivables.reduce((sum, r) => sum + Number(r.remaining_amount || 0), 0);
        const net = income - expense;

        return { totalBalance, income, expense, reversal, uncollected, net };
    }, [filteredTransactions, accounts, receivables]);

    // Seçili Dönem Etiketi
    const selectedPeriodLabel = useMemo(() => {
        if (periodType === 'daily') {
            return dayjs(selectedDate).locale('tr').format('DD MMMM YYYY');
        }
        if (periodType === 'monthly') {
            return dayjs().month(Number(filterMonth) - 1).year(filterYear).locale('tr').format('MMMM YYYY');
        }
        if (periodType === 'yearly') {
            return `${filterYear} Yılı`;
        }
        return 'Tüm Zamanlar';
    }, [periodType, selectedDate, filterMonth, filterYear]);

    // Takvim Grid Hesaplamaları (Custom Date Picker Tarzında)
    const startOfMonth = dayjs(viewedMonth).startOf('month');
    const daysInMonth = startOfMonth.daysInMonth();
    const startDayOfWeek = startOfMonth.day();
    const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Pt başlangıçlı offset

    const daysArray = useMemo(() => {
        const arr = [];
        for (let i = 0; i < offset; i++) {
            arr.push(null);
        }
        for (let d = 1; d <= daysInMonth; d++) {
            arr.push(d);
        }
        return arr;
    }, [offset, daysInMonth]);

    const viewedMonthLabel = dayjs(viewedMonth).locale('tr').format('MMMM YYYY');

    const handlePrevMonth = () => {
        setViewedMonth(prev => dayjs(prev).subtract(1, 'month').toDate());
    };

    const handleNextMonth = () => {
        setViewedMonth(prev => dayjs(prev).add(1, 'month').toDate());
    };

    const handleSelectDay = (day) => {
        if (!day) return;
        const chosen = dayjs(viewedMonth).date(day).toDate();
        setSelectedDate(chosen);
        periodSheetRef.current?.close();
    };

    // Kasa / Hesap Kartı
    const renderAccountItem = ({ item }) => {
        const iconName = ACCOUNT_TYPE_ICONS[item.account_type] || 'wallet';
        const isSelected = selectedAccount?.id === item.id;
        
        const cardColors = item.account_type === 'cash' 
            ? ['#10B981', '#065F46'] 
            : (item.account_type === 'bank' ? ['#3B82F6', '#1E40AF'] : ['#EC4899', '#9D174D']);

        return (
            <Pressable
                onPress={() => setSelectedAccount(isSelected ? null : item)}
                style={[
                    styles.walletCard,
                    { 
                        backgroundColor: cardColors[0],
                        borderColor: isSelected ? '#FFF' : 'rgba(255,255,255,0.1)',
                        borderWidth: isSelected ? 2.5 : 1,
                        shadowColor: cardColors[1],
                        shadowOpacity: isSelected ? 0.4 : 0.15,
                    }
                ]}
            >
                <View style={[styles.cardCircleDecorator, { backgroundColor: 'rgba(255,255,255,0.06)', width: 100, height: 100, top: -20, right: -20 }]} />
                <View style={[styles.cardCircleDecorator, { backgroundColor: 'rgba(255,255,255,0.03)', width: 140, height: 140, bottom: -40, left: -20 }]} />

                <View style={styles.walletHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={styles.walletIconWrap}>
                            <MaterialCommunityIcons name={iconName} size={18} color="#FFF" />
                        </View>
                        <Text style={styles.walletTypeLabel}>
                            {item.account_type === 'cash' ? 'Nakit Kasa' : item.account_type === 'bank' ? 'Banka Hesabı' : 'Kredi Kartı'}
                        </Text>
                    </View>
                    <Pressable
                        onPress={(e) => {
                            e.stopPropagation(); // Kartın seçilme durumunu tetiklemesin
                            navigation.navigate('AdminAccountForm', { account: item, onSuccess: fetchData });
                        }}
                        style={({ pressed }) => [
                            styles.walletEditBtn,
                            pressed && { opacity: 0.7 }
                        ]}
                    >
                        <MaterialCommunityIcons name="pencil-outline" size={14} color="rgba(255,255,255,0.85)" />
                    </Pressable>
                </View>
                <View style={{ marginTop: 'auto', gap: 2 }}>
                    <Text style={styles.walletCardDummyNumber}>••••  ••••  ••••  {item.name.slice(0, 4).toUpperCase()}</Text>
                    <Text style={styles.walletName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.walletBalance}>₺{fmtMoney(item.balance)}</Text>
                </View>
                {isSelected && (
                    <View style={styles.walletSelectedBadge}>
                        <MaterialCommunityIcons name="check-bold" size={10} color={cardColors[0]} />
                    </View>
                )}
            </Pressable>
        );
    };

    // İşlem / Hareket Satırı
    const renderTransactionItem = ({ item }) => {
        const isIncome = item.transaction_type === 'income';
        const isRev = isReversalTransaction(item);
        const color = isRev ? '#6B7280' : (isIncome ? serviceGreen : serviceRed);
        const iconName = isRev ? 'alert-circle-outline' : (isIncome ? 'plus' : 'minus');

        return (
            <View style={[styles.transRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <View style={[styles.transIconWrap, { backgroundColor: `${color}10` }]}>
                    <MaterialCommunityIcons name={iconName} size={18} color={color} />
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.transDesc, { color: colors.text }]} numberOfLines={1}>
                            {item.description || item.category_name || 'Finansal İşlem'}
                        </Text>
                        {isRev && (
                            <View style={styles.revBadge}>
                                <Text style={styles.revBadgeText}>İptal</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.transMeta}>
                        <Text style={[styles.transSub, { color: colors.textSecondary }]}>
                            {item.account_name || 'Hesap'}
                        </Text>
                        <Text style={[styles.transDot, { color: colors.textTertiary }]}>•</Text>
                        <Text style={[styles.transSub, { color: colors.textSecondary }]}>
                            {item.category_name || 'Genel'}
                        </Text>
                        <Text style={[styles.transDot, { color: colors.textTertiary }]}>•</Text>
                        <Text style={[styles.transSub, { color: colors.textSecondary }]}>
                            {new Date(item.date).toLocaleDateString('tr-TR')}
                        </Text>
                    </View>
                </View>
                <Text style={[styles.transAmount, { color, textDecorationLine: isRev ? 'line-through' : 'none' }]}>
                    {isIncome ? '+' : '-'}₺{fmtMoney(item.amount)}
                </Text>
            </View>
        );
    };

    // Alacaklar Satırı
    const renderReceivableItem = ({ item }) => {
        return (
            <Pressable 
                onPress={() => item.service_id && navigation.navigate('ServiceDetail', { serviceId: item.service_id })}
                style={[styles.receivableCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
                <View style={styles.recTopRow}>
                    <Text style={[styles.recReceipt, { color: serviceBlue }]}>#{item.receipt_number || 'YOK'}</Text>
                    <View style={styles.recStatusBadge}>
                        <Text style={styles.recStatusText}>{item.service_status_label || 'Bekliyor'}</Text>
                    </View>
                </View>
                
                <Text style={[styles.recCustomer, { color: colors.text }]}>{item.customer_full_name || 'Bilinmeyen Müşteri'}</Text>
                <Text style={[styles.recPhone, { color: colors.textSecondary }]}>{item.customer_phone || '-'}</Text>
                
                <View style={[styles.recDivider, { backgroundColor: colors.border }]} />
                
                <View style={styles.recDetailGrid}>
                    <View style={styles.recDetailCol}>
                        <Text style={[styles.recDetailLabel, { color: colors.textSecondary }]}>Toplam</Text>
                        <Text style={[styles.recDetailVal, { color: colors.text }]}>₺{fmtMoney(item.total_amount)}</Text>
                    </View>
                    <View style={styles.recDetailCol}>
                        <Text style={[styles.recDetailLabel, { color: colors.textSecondary }]}>Ödenen</Text>
                        <Text style={[styles.recDetailVal, { color: serviceGreen }]}>₺{fmtMoney(item.paid_amount)}</Text>
                    </View>
                    <View style={styles.recDetailCol}>
                        <Text style={[styles.recDetailLabel, { color: colors.textSecondary }]}>Kalan Borç</Text>
                        <Text style={[styles.recDetailVal, { color: serviceRed, fontWeight: '800' }]}>₺{fmtMoney(item.remaining_amount)}</Text>
                    </View>
                </View>
            </Pressable>
        );
    };

    const renderBackdrop = useCallback(
        (props) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                opacity={0.5}
                pressBehavior="close"
            />
        ),
        []
    );

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES} style={{ backgroundColor: colors.background }}>
            <Header
                title="Finans & Muhasebe"
                showBack
                borderBottom
                rightActions={[
                    {
                        icon: 'plus',
                        color: serviceBlue,
                        onPress: () => navigation.navigate('AdminAccountingForm', { onSuccess: fetchData }),
                        accessibilityLabel: 'Ekle',
                    }
                ]}
            />

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={serviceBlue} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Finansal veriler yükleniyor...</Text>
                </View>
            ) : (
                <FlatList
                    data={mainTab === 'transactions' ? filteredTransactions : receivables}
                    keyExtractor={item => item.id || item.service_id}
                    renderItem={mainTab === 'transactions' ? renderTransactionItem : renderReceivableItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[serviceBlue]} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="finance" size={48} color={colors.textTertiary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            {mainTab === 'transactions' ? 'Bu filtreye uygun işlem bulunamadı.' : 'Vadesi geçmiş alacak bulunamadı.'}
                        </Text>
                    </View>
                }
                ListHeaderComponent={
                    <View style={styles.headerContainer}>
                        
                        {/* ── Zaman Filtresi Seçici Buton ── */}
                        <Pressable
                            onPress={() => {
                                setViewedMonth(dayjs(selectedDate).toDate());
                                periodSheetRef.current?.expand();
                            }}
                            style={({ pressed }) => [
                                styles.periodSelectorBtn,
                                { backgroundColor: colors.surface, borderColor: colors.border },
                                pressed && { opacity: 0.85 }
                            ]}
                        >
                            <View style={[styles.calendarIconContainer, { backgroundColor: `${serviceBlue}10` }]}>
                                <MaterialCommunityIcons name="calendar-month" size={20} color={serviceBlue} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={[styles.periodLabelTitle, { color: colors.textSecondary }]}>Aktif Zaman Dilimi</Text>
                                <Text style={[styles.periodLabelValue, { color: colors.text }]}>{selectedPeriodLabel}</Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-down" size={22} color={colors.textSecondary} style={{ marginRight: 4 }} />
                        </Pressable>

                        {/* ── Finansal Özet Stat Kartları ── */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 6 }}>
                            <StatCard
                                title="Net Bakiye"
                                value={stats.totalBalance}
                                icon="wallet"
                                color={serviceBlue}
                                bg={isDark ? 'rgba(30, 41, 59, 0.9)' : '#EFF6FF'}
                                border={isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(59, 130, 246, 0.12)'}
                                isDark={isDark}
                                subText="Kasadaki Nakit"
                            />
                            <StatCard
                                title="Dönem Gelir"
                                value={stats.income}
                                icon="arrow-down-bold"
                                color={serviceGreen}
                                bg={isDark ? 'rgba(6, 78, 59, 0.9)' : '#F0FDF4'}
                                border={isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(16, 185, 129, 0.12)'}
                                isDark={isDark}
                                subText="Tahsil edilen"
                            />
                            <StatCard
                                title="Dönem Gider"
                                value={stats.expense}
                                icon="arrow-up-bold"
                                color={serviceRed}
                                bg={isDark ? 'rgba(127, 29, 29, 0.9)' : '#FEF2F2'}
                                border={isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(239, 68, 68, 0.12)'}
                                isDark={isDark}
                                subText="Ödemeler & Gider"
                            />
                            <StatCard
                                title="Alacaklar"
                                value={stats.uncollected}
                                icon="clock-outline"
                                color={serviceOrange}
                                bg={isDark ? 'rgba(124, 45, 18, 0.9)' : '#FFFBEB'}
                                border={isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(245, 158, 11, 0.12)'}
                                isDark={isDark}
                                subText="Bekleyen Borçlar"
                            />
                            <StatCard
                                title="İade / İptal"
                                value={stats.reversal}
                                icon="alert-circle-outline"
                                color="#4B5563"
                                bg={isDark ? 'rgba(55, 65, 81, 0.9)' : '#F9FAFB'}
                                border={colors.border}
                                isDark={false}
                                subText="Ters Kayıtlar"
                            />
                        </ScrollView>

                        {/* ── Hesap Cüzdanları ── */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Hesap Cüzdanları</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                {selectedAccount && (
                                    <Pressable onPress={() => setSelectedAccount(null)}>
                                        <Text style={{ fontSize: 11, color: serviceRed, fontWeight: '700' }}>Filtreyi Kaldır</Text>
                                    </Pressable>
                                )}
                                <Pressable
                                    onPress={() => navigation.navigate('AdminAccountForm', { onSuccess: fetchData })}
                                    style={({ pressed }) => [
                                        { flexDirection: 'row', alignItems: 'center', gap: 3 },
                                        pressed && { opacity: 0.7 }
                                    ]}
                                >
                                    <MaterialCommunityIcons name="plus-circle-outline" size={16} color={serviceBlue} />
                                    <Text style={{ fontSize: 11, color: serviceBlue, fontWeight: '700' }}>Ekle</Text>
                                </Pressable>
                            </View>
                        </View>

                        <FlatList
                            data={accounts}
                            keyExtractor={item => item.id}
                            renderItem={renderAccountItem}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 14, paddingVertical: 8 }}
                            ListEmptyComponent={
                                <Text style={[styles.emptySmall, { color: colors.textTertiary }]}>Hesap tanımlı değil.</Text>
                            }
                        />

                        {/* ── Ana Segment Sekmeleri (iOS Style) ── */}
                        <View style={[styles.mainTabContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                            <Pressable
                                onPress={() => setMainTab('transactions')}
                                style={[styles.mainTabBtn, mainTab === 'transactions' && [styles.mainTabActiveBtn, { backgroundColor: colors.surface }]]}
                            >
                                <MaterialCommunityIcons name="swap-horizontal" size={16} color={mainTab === 'transactions' ? serviceBlue : colors.textSecondary} />
                                <Text style={[styles.mainTabBtnText, { color: mainTab === 'transactions' ? colors.text : colors.textSecondary }]}>İşlemler</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => setMainTab('receivables')}
                                style={[styles.mainTabBtn, mainTab === 'receivables' && [styles.mainTabActiveBtn, { backgroundColor: colors.surface }]]}
                            >
                                <MaterialCommunityIcons name="clock-outline" size={16} color={mainTab === 'receivables' ? serviceOrange : colors.textSecondary} />
                                <Text style={[styles.mainTabBtnText, { color: mainTab === 'receivables' ? colors.text : colors.textSecondary }]}>
                                    Alacaklar ({receivables.length})
                                </Text>
                            </Pressable>
                        </View>

                        {/* ── İşlemler Alt Tabları ── */}
                        {mainTab === 'transactions' ? (
                            <View style={[styles.tabContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                                <Pressable
                                    onPress={() => navigation.navigate('AdminAccountingForm', { onSuccess: fetchData })}
                                    style={[styles.tabBtn, styles.newTransactionTab, { borderColor: serviceBlue }]}
                                >
                                    <MaterialCommunityIcons name="plus-circle-outline" size={15} color={serviceBlue} />
                                    <Text style={[styles.tabBtnText, { color: serviceBlue }]}>Yeni İşlem</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => setActiveTab('income')}
                                    style={[styles.tabBtn, activeTab === 'income' && [styles.tabActiveBtn, { backgroundColor: serviceGreen }]]}
                                >
                                    <Text style={[styles.tabBtnText, { color: activeTab === 'income' ? '#FFF' : colors.textSecondary }]}>Gelirler</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => setActiveTab('expense')}
                                    style={[styles.tabBtn, activeTab === 'expense' && [styles.tabActiveBtn, { backgroundColor: serviceRed }]]}
                                >
                                    <Text style={[styles.tabBtnText, { color: activeTab === 'expense' ? '#FFF' : colors.textSecondary }]}>Giderler</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 14 }]}>
                                Vadesi Geçmiş Müşteri Alacakları
                            </Text>
                        )}
                    </View>
                }
            />
            )}

            {/* ── Zaman/Dönem Seçici BottomSheet ── */}
            <BottomSheet
                ref={periodSheetRef}
                index={-1}
                snapPoints={['62%']}
                enablePanDownToClose
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: colors.surface }}
                handleIndicatorStyle={{ backgroundColor: colors.textTertiary }}
                onChange={(index) => { periodSheetIndexRef.current = index; }}
            >
                <BottomSheetView style={[styles.sheetContent, { flex: 1, paddingBottom: insets.bottom + 10 }]}>
                    <View style={styles.sheetHeader}>
                        <Text style={[styles.sheetTitle, { color: colors.text }]}>Zaman Dilimi Seçin</Text>
                        <Pressable onPress={() => periodSheetRef.current?.close()}>
                            <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                        </Pressable>
                    </View>

                    {/* Dilim Sekmeleri */}
                    <View style={[styles.sheetTabContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
                        {['daily', 'monthly', 'yearly', 'all'].map(type => (
                            <Pressable
                                key={type}
                                onPress={() => setPeriodType(type)}
                                style={[styles.sheetTabBtn, periodType === type && { backgroundColor: serviceBlue }]}
                            >
                                <Text style={[styles.sheetTabBtnText, { color: periodType === type ? '#FFF' : colors.textSecondary }]}>
                                    {type === 'daily' ? 'Günlük' : type === 'monthly' ? 'Aylık' : type === 'yearly' ? 'Yıllık' : 'Tümü'}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* Günlük Seçim (Custom CalendarPickerSheet Grid Görünümü) */}
                    {periodType === 'daily' && (
                        <View style={styles.calendarContainer}>
                            <View style={styles.calendarHeader}>
                                <Pressable onPress={handlePrevMonth} style={styles.calNavBtn}>
                                    <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
                                </Pressable>
                                <Text style={[styles.calendarMonthTitle, { color: colors.text }]}>{viewedMonthLabel}</Text>
                                <Pressable onPress={handleNextMonth} style={styles.calNavBtn}>
                                    <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
                                </Pressable>
                            </View>

                            {/* Gün İsimleri Satırı */}
                            <View style={styles.weekdaysRow}>
                                {WEEKDAYS.map((w, i) => (
                                    <Text key={i} style={[styles.weekdayCell, { color: colors.textSecondary }]}>{w}</Text>
                                ))}
                            </View>

                            {/* Günler Grid */}
                            <View style={styles.daysGrid}>
                                {daysArray.map((day, idx) => {
                                    if (day === null) {
                                        return <View key={`empty-${idx}`} style={styles.dayCellEmpty} />;
                                    }
                                    
                                    const dateObj = dayjs(viewedMonth).date(day);
                                    const isSelected = dateObj.isSame(dayjs(selectedDate), 'day');
                                    const isToday = dateObj.isSame(dayjs(), 'day');

                                    return (
                                        <Pressable
                                            key={`day-${day}`}
                                            onPress={() => handleSelectDay(day)}
                                            style={[
                                                styles.dayCell,
                                                isSelected && { backgroundColor: serviceBlue, borderRadius: 10 },
                                                !isSelected && isToday && { borderColor: serviceBlue, borderWidth: 1, borderRadius: 10 }
                                            ]}
                                        >
                                            <Text style={[
                                                styles.dayCellText,
                                                { color: isSelected ? '#FFF' : colors.text },
                                                !isSelected && isToday && { color: serviceBlue, fontWeight: '800' }
                                            ]}>
                                                {day}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* Aylık Seçim Gridleri */}
                    {periodType === 'monthly' && (
                        <View style={{ width: '100%', marginTop: 12, flex: 1 }}>
                            <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>Yıl ve Ay Seçimi</Text>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={{ gap: 12 }}>
                                    {/* Yıllar */}
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                                    >
                                        {yearOptions.map(yr => (
                                            <Pressable
                                                key={yr}
                                                onPress={() => setFilterYear(yr)}
                                                style={[styles.sheetChip, filterYear === yr && { borderColor: serviceBlue, backgroundColor: `${serviceBlue}10` }, { borderColor: colors.border, minWidth: 65, paddingHorizontal: 16 }]}
                                            >
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: filterYear === yr ? serviceBlue : colors.textSecondary }}>{yr}</Text>
                                            </Pressable>
                                        ))}
                                    </ScrollView>

                                    {/* Aylar */}
                                    <View style={styles.sheetGrid}>
                                        {MONTHS_TR.map(m => (
                                            <Pressable
                                                key={m.value}
                                                onPress={() => { setFilterMonth(m.value); periodSheetRef.current?.close(); }}
                                                style={[styles.sheetGridCell, filterMonth === m.value && { borderColor: serviceBlue, backgroundColor: `${serviceBlue}10` }, { borderColor: colors.border }]}
                                            >
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: filterMonth === m.value ? serviceBlue : colors.textSecondary }}>{m.label}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>
                            </ScrollView>
                        </View>
                    )}

                    {/* Yıllık Seçim */}
                    {periodType === 'yearly' && (
                        <View style={{ width: '100%', marginTop: 12 }}>
                            <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>Yıl Seçin</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                            >
                                {yearOptions.map(yr => (
                                    <Pressable
                                        key={yr}
                                        onPress={() => { setFilterYear(yr); periodSheetRef.current?.close(); }}
                                        style={[styles.sheetChip, filterYear === yr && { borderColor: serviceBlue, backgroundColor: `${serviceBlue}10` }, { borderColor: colors.border, minWidth: 65, paddingHorizontal: 16 }]}
                                    >
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: filterYear === yr ? serviceBlue : colors.textSecondary }}>{yr}</Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Tüm Zamanlar */}
                    {periodType === 'all' && (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                            <MaterialCommunityIcons name="infinity" size={32} color={serviceBlue} />
                            <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>Tüm zamanlardaki finansal hareketler listeleniyor.</Text>
                            <Pressable
                                onPress={() => periodSheetRef.current?.close()}
                                style={[styles.sheetApplyBtn, { backgroundColor: serviceBlue }]}
                            >
                                <Text style={styles.sheetApplyText}>Uygula</Text>
                            </Pressable>
                        </View>
                    )}

                </BottomSheetView>
            </BottomSheet>

        </WrapperContainer>
    );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
    headerContainer: { gap: 10, marginBottom: 12 },

    // Zaman Seçici Buton (Modern Glassmorphism)
    periodSelectorBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
    },
    calendarIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    periodLabelTitle: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    periodLabelValue: { fontSize: 13, fontWeight: '800', marginTop: 1 },

    // Stat kartları
    statCard: {
        width: 135,
        borderRadius: 16,
        borderWidth: 1,
        padding: 12,
        gap: 2,
        position: 'relative',
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
    },
    watermarkIcon: { position: 'absolute', right: -12, bottom: -12, opacity: 0.6 },
    statCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 },
    statTitle: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
    statIconContainer: { width: 22, height: 22, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    statValue: { fontSize: 15, fontWeight: '800', marginTop: 4, zIndex: 1 },
    statSubText: { fontSize: 9, marginTop: 1, zIndex: 1 },

    sectionTitle: { fontSize: 12, fontWeight: '800', marginTop: 10, marginBottom: 4 },
    emptySmall: { fontSize: 11, textAlign: 'center', paddingVertical: 12 },

    // Premium Wallet Kartları
    walletCard: {
        width: 165,
        height: 105,
        borderRadius: 18,
        padding: 12,
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        elevation: 6,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 5,
    },
    cardCircleDecorator: { position: 'absolute', borderRadius: 999 },
    walletHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', zIndex: 1 },
    walletIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 0.22)', alignItems: 'center', justifyContent: 'center' },
    walletTypeLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 9, fontWeight: '800' },
    walletEditBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.15)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
    walletCardDummyNumber: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '600', letterSpacing: 1 },
    walletName: { color: '#FFF', fontSize: 12, fontWeight: '700', zIndex: 1 },
    walletBalance: { color: '#FFF', fontSize: 16, fontWeight: '900', marginTop: 1, zIndex: 1 },
    walletSelectedBadge: {
        position: 'absolute', top: 12, right: 12,
        width: 18, height: 18, borderRadius: 9,
        backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
        elevation: 3,
    },

    // Segment Tabları
    mainTabContainer: {
        flexDirection: 'row',
        borderRadius: 14,
        borderWidth: 1,
        padding: 3,
        marginTop: 10,
        gap: 4,
    },
    mainTabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 11,
    },
    mainTabActiveBtn: {
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
    },
    mainTabBtnText: { fontSize: 12, fontWeight: '800' },

    // Alt Tablar
    tabContainer: {
        flexDirection: 'row',
        borderRadius: 10,
        borderWidth: 1,
        padding: 3,
        marginTop: 12,
    },
    tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    newTransactionTab: { flexDirection: 'row', justifyContent: 'center', gap: 3, borderWidth: 1 },
    tabActiveBtn: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1 },
    tabBtnText: { fontSize: 12, fontWeight: '700' },

    // Hareket satırı
    transRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        gap: 12,
        marginBottom: 8,
    },
    transIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    transDesc: { fontSize: 13, fontWeight: '700' },
    transMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    transSub: { fontSize: 10 },
    transDot: { fontSize: 8 },
    transAmount: { fontSize: 13, fontWeight: '800' },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
    emptyText: { fontSize: 12, textAlign: 'center' },

    revBadge: {
        backgroundColor: '#F3F4F6',
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },
    revBadgeText: { fontSize: 8, fontWeight: '700', color: '#4B5563' },

    // Alacaklar kartı
    receivableCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        gap: 6,
        marginBottom: 10,
    },
    recTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    recReceipt: { fontSize: 13, fontWeight: '800' },
    recStatusBadge: {
        backgroundColor: '#FFF8E6',
        borderColor: '#FFE6A3',
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    recStatusText: { color: serviceOrange, fontSize: 9, fontWeight: '700' },
    recCustomer: { fontSize: 13, fontWeight: '700', marginTop: 2 },
    recPhone: { fontSize: 11, marginTop: 1 },
    recDivider: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
    recDetailGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    recDetailCol: { flex: 1 },
    recDetailLabel: { fontSize: 10 },
    recDetailVal: { fontSize: 12, fontWeight: '700', marginTop: 2 },

    // BottomSheet İçeriği (Yeniden tasarlandı)
    sheetContent: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 6 },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 16,
    },
    sheetTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
    sheetSubtitle: { fontSize: 11, fontWeight: '800', width: '100%', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 6 },
    
    // Segment Bar
    sheetTabContainer: { flexDirection: 'row', borderRadius: 12, padding: 3, width: '100%', backgroundColor: 'rgba(0,0,0,0.03)' },
    sheetTabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    sheetTabBtnText: { fontSize: 11, fontWeight: '800' },

    // Gridler ve Çipler
    sheetSelectorGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', paddingVertical: 6 },
    sheetChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, minWidth: 64, alignItems: 'center' },

    sheetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', paddingVertical: 8 },
    sheetGridCell: { width: '31.5%', borderRadius: 10, borderWidth: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },

    sheetApplyBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12, marginTop: 16, elevation: 2 },
    sheetApplyText: { color: '#FFF', fontSize: 13, fontWeight: '800' },

    // Custom Takvim Tasarımı (Luxury)
    calendarContainer: { width: '100%', marginTop: 12, gap: 12 },
    calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginBottom: 4 },
    calNavBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' },
    calendarMonthTitle: { fontSize: 14, fontWeight: '800' },
    
    weekdaysRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.05)', paddingBottom: 6 },
    weekdayCell: { width: '14.2%', textAlign: 'center', fontSize: 11, fontWeight: '700', opacity: 0.5 },
    
    daysGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
    dayCell: { width: '14.2%', height: 42, alignItems: 'center', justifyContent: 'center', marginVertical: 2 },
    dayCellEmpty: { width: '14.2%', height: 42 },
    dayCellText: { fontSize: 13, fontWeight: '600' },

    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
    loadingText: { fontSize: 13, fontWeight: '600' },
});
