import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
    Alert,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import Share from 'react-native-share';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import TechnicianPickerSheet from '@/components/home/TechnicianPickerSheet';

// ─── Sabitler & Yardımcılar ───────────────────────────────────────────────────

const MONTHS_TR = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const fmtMoney = (val) => {
    const n = Number(val || 0);
    return Number.isFinite(n)
        ? n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
        : '0';
};

const getMonthYear = (isoStr) => {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    if (isNaN(d)) return '-';
    return `${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
};

const STATUS_META = {
    draft:     { label: 'Taslak',  color: '#6B7280', bg: '#F3F4F6', borderColor: '#D1D5DB' },
    approved:  { label: 'Bekliyor', color: '#D97706', bg: '#FFFBEB', borderColor: '#FDE68A' },
    paid:      { label: 'Ödendi',  color: '#16A34A', bg: '#F0FDF4', borderColor: '#BBF7D0' },
    cancelled: { label: 'İptal',   color: '#DC2626', bg: '#FEF2F2', borderColor: '#FECACA' },
};

const TABS = [
    { key: 'all',      label: 'Tümü' },
    { key: 'paid',     label: 'Ödendi' },
    { key: 'approved', label: 'Bekliyor' },
    { key: 'draft',    label: 'Taslak' },
];

const STAT_CARDS = (counts, isDark) => [
    { key: 'total',    label: 'Toplam',   value: counts.total,    icon: 'text-box-multiple-outline', color: serviceBlue,   bg: isDark ? '#1e3a5f' : '#EFF6FF' },
    { key: 'pending',  label: 'Bekleyen', value: counts.pending,  icon: 'clock-outline',             color: serviceOrange, bg: isDark ? '#431407' : '#FFF7ED' },
    { key: 'paid',     label: 'Ödendi',   value: `₺${fmtMoney(counts.paidSum)}`,  icon: 'check-decagram-outline',    color: serviceGreen,  bg: isDark ? '#052e16' : '#F0FDF4' },
    { key: 'upcoming', label: 'Ödenecek', value: `₺${fmtMoney(counts.upcoming)}`, icon: 'cash-clock',                color: '#8B5CF6',     bg: isDark ? '#2d1b69' : '#F5F3FF' },
];

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, bg, colors }) {
    return (
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: bg }]}>
                <MaterialCommunityIcons name={icon} size={18} color={color} />
            </View>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
        </View>
    );
}

// ─── PayrollCard ──────────────────────────────────────────────────────────────

function PayrollCard({ item, colors, isDark, sharingId, isTechnician, onPdf, onWhatsApp, navigation, onRefresh }) {
    const sc = STATUS_META[item.status] || STATUS_META.draft;
    const isSharing = sharingId === item.id;
    const initials = item.technician_name
        ? item.technician_name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
        : 'TK';

    const net = Number(item.net_salary || 0);
    const base = Number(item.base_salary || 0);
    const premiums = Number(item.total_premiums || 0);
    const deductions = Number(item.total_deductions || 0);

    return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* ── Üst Satır ── */}
            <View style={styles.cardTop}>
                <View style={[styles.avatar, { backgroundColor: `${serviceBlue}14` }]}>
                    <Text style={[styles.avatarText, { color: serviceBlue }]}>{initials}</Text>
                </View>
                <View style={styles.cardInfo}>
                    <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                        {item.technician_name || 'Teknisyen'}
                    </Text>
                    <View style={styles.cardMeta}>
                        <MaterialCommunityIcons name="calendar-month-outline" size={12} color={colors.textTertiary} />
                        <Text style={[styles.cardMetaText, { color: colors.textTertiary }]}>
                            {getMonthYear(item.period_start)}
                        </Text>
                    </View>
                </View>
                <View style={styles.cardRight}>
                    <Text style={[styles.cardNet, { color: colors.text }]}>₺{fmtMoney(net)}</Text>
                    <View style={[styles.badge, { backgroundColor: sc.bg, borderColor: sc.borderColor }]}>
                        <View style={[styles.badgeDot, { backgroundColor: sc.color }]} />
                        <Text style={[styles.badgeText, { color: sc.color }]}>{sc.label}</Text>
                    </View>
                </View>
            </View>

            {/* ── Özet Satırı ── */}
            <View style={[styles.summaryRow, { borderColor: colors.border }]}>
                <View style={styles.summaryCol}>
                    <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Taban</Text>
                    <Text style={[styles.summaryVal, { color: colors.text }]}>₺{fmtMoney(base)}</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryCol}>
                    <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Prim</Text>
                    <Text style={[styles.summaryVal, { color: serviceGreen }]}>+₺{fmtMoney(premiums)}</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryCol}>
                    <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Kesinti</Text>
                    <Text style={[styles.summaryVal, { color: serviceRed }]}>-₺{fmtMoney(deductions)}</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryCol}>
                    <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Net</Text>
                    <Text style={[styles.summaryVal, { color: serviceBlue, fontWeight: '800' }]}>₺{fmtMoney(net)}</Text>
                </View>
            </View>

            {/* ── Aksiyonlar ── */}
            <View style={[styles.actionRow, { borderColor: colors.border }]}>
                <Pressable
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: isDark ? `${serviceBlue}14` : '#EFF6FF', borderColor: `${serviceBlue}30` }, pressed && { opacity: 0.7 }]}
                    onPress={() => navigation.navigate(isTechnician ? 'TechnicianPayrollDetail' : 'AdminPayrollDetail', { payrollId: item.id, onRefresh })}
                >
                    <MaterialCommunityIcons name="eye-outline" size={14} color={serviceBlue} />
                    <Text style={[styles.actionBtnText, { color: serviceBlue }]}>Detay</Text>
                </Pressable>

                <Pressable
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: isDark ? '#1a1a2e' : '#F8FAFC', borderColor: colors.border }, pressed && { opacity: 0.7 }, isSharing && { opacity: 0.5 }]}
                    onPress={() => onPdf(item)}
                    disabled={isSharing}
                >
                    {isSharing ? (
                        <ActivityIndicator size="small" color={serviceBlue} />
                    ) : (
                        <MaterialCommunityIcons name="file-pdf-box" size={14} color={serviceBlue} />
                    )}
                    <Text style={[styles.actionBtnText, { color: serviceBlue }]}>PDF</Text>
                </Pressable>

                {!isTechnician && (
                    <Pressable
                        style={({ pressed }) => [styles.actionBtn, { backgroundColor: isDark ? '#052e16' : '#F0FDF4', borderColor: '#BBF7D030' }, pressed && { opacity: 0.7 }]}
                        onPress={() => onWhatsApp(item)}
                        disabled={isSharing}
                    >
                        <MaterialCommunityIcons name="whatsapp" size={14} color="#16A34A" />
                        <Text style={[styles.actionBtnText, { color: '#16A34A' }]}>WhatsApp</Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

export default function PayrollScreen({ navigation, route }) {
    const technicianId = route?.params?.technicianId || null;
    const technicianName = route?.params?.technicianName || null;
    const isFilteredView = !!technicianId;

    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();
    const { isTechnician } = useAuth();

    const techSheetRef = useRef(null);

    const [payrolls, setPayrolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [sharingId, setSharingId] = useState(null);
    const [techniciansList, setTechniciansList] = useState([]);
    const [selectedTech, setSelectedTech] = useState(technicianId);
    const [selectedTab, setSelectedTab] = useState('all');

    // ── Ay navigasyonu ─────────────────────────────────────────────────────────

    const [currentMonth, setCurrentMonth] = useState(() => {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
    });

    const monthDisplay = useMemo(() => {
        const [y, m] = currentMonth.split('-').map(Number);
        return `${MONTHS_TR[m - 1]} ${y}`;
    }, [currentMonth]);

    const shiftMonth = useCallback((dir) => {
        setCurrentMonth(prev => {
            const [y, m] = prev.split('-').map(Number);
            const d = new Date(y, m - 1 + dir, 1);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        });
    }, []);

    // ── Veri Çekme ─────────────────────────────────────────────────────────────

    const fetchPayrolls = useCallback(async () => {
        try {
            const params = {};
            const activeTechId = isFilteredView ? technicianId : selectedTech;
            if (activeTechId) params.technician = activeTechId;

            const url = isTechnician ? ENDPOINTS.HR.MY_PAYROLLS : ENDPOINTS.HR.PAYROLLS;
            const res = await api.get(url, { params });
            let data = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);

            const [y, m] = currentMonth.split('-').map(Number);
            data = data.filter(p => {
                const d = new Date(p.period_start);
                return d.getFullYear() === y && d.getMonth() + 1 === m;
            });

            setPayrolls(data);
        } catch (err) {
            console.log('Payroll fetch error:', err?.response?.data || err?.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [technicianId, selectedTech, currentMonth, isFilteredView, isTechnician]);

    useEffect(() => {
        setLoading(true);
        fetchPayrolls();
    }, [fetchPayrolls]);

    useEffect(() => {
        if (!isFilteredView && !isTechnician) {
            api.get(ENDPOINTS.TECHNICIAN.LIST)
                .then(res => setTechniciansList(Array.isArray(res?.data) ? res.data : (res?.data?.results || [])))
                .catch(() => {});
        }
    }, [isFilteredView, isTechnician]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchPayrolls();
    }, [fetchPayrolls]);

    // ── İstatistikler ──────────────────────────────────────────────────────────

    const stats = useMemo(() => ({
        total:    payrolls.length,
        pending:  payrolls.filter(p => p.status === 'approved').length,
        paidSum:  payrolls.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.net_salary || 0), 0),
        upcoming: payrolls.filter(p => p.status === 'approved' || p.status === 'draft').reduce((s, p) => s + Number(p.net_salary || 0), 0),
    }), [payrolls]);

    // ── Filtre ─────────────────────────────────────────────────────────────────

    const filtered = useMemo(() => payrolls.filter(p => {
        if (selectedTab === 'all') return true;
        return p.status === selectedTab;
    }), [payrolls, selectedTab]);

    // ── PDF Paylaş ─────────────────────────────────────────────────────────────

    const handlePdf = useCallback(async (payroll) => {
        if (!payroll || sharingId === payroll.id) return;
        setSharingId(payroll.id);
        try {
            const endpoint = isTechnician
                ? ENDPOINTS.HR.MY_PAYROLL_PDF(payroll.id)
                : ENDPOINTS.HR.PAYROLL_PDF(payroll.id);
            const baseUrl = (api.defaults.baseURL || '').replace(/\/$/, '');
            const fullUrl = `${baseUrl}/${endpoint.replace(/^\//, '')}`;
            const token = await AsyncStorage.getItem('auth_token');
            const tenantCode = await AsyncStorage.getItem('tenant_code');
            const tmpPath = `${FileSystem.cacheDirectory}bordro_${payroll.id}.pdf`;

            const dl = await FileSystem.downloadAsync(fullUrl, tmpPath, {
                headers: {
                    Authorization: token ? `Token ${token}` : '',
                    'X-Tenant-Code': tenantCode || '',
                },
            });

            if (dl.status === 200) {
                if (Platform.OS === 'android') {
                    const cUri = await FileSystem.getContentUriAsync(dl.uri);
                    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                        data: cUri,
                        flags: 1,
                        type: 'application/pdf',
                    });
                } else {
                    await Sharing.shareAsync(dl.uri, {
                        mimeType: 'application/pdf',
                        dialogTitle: `Bordro – ${getMonthYear(payroll.period_start)}`,
                        UTI: 'com.adobe.pdf',
                    });
                }
            } else {
                showToast('error', 'Hata', 'PDF indirilemedi.');
            }
        } catch (err) {
            console.log('PDF Open Error:', err);
            showToast('error', 'Hata', 'PDF dosyası açılamadı. Cihazınızda PDF okuyucu yüklü olduğundan emin olun.');
        } finally {
            setSharingId(null);
        }
    }, [sharingId, showToast, isTechnician]);

    // ── WhatsApp ───────────────────────────────────────────────────────────────

    const handleWhatsApp = useCallback(async (payroll) => {
        if (!payroll || sharingId === payroll.id) return;
        const phone = payroll.technician_phone || '';
        if (!phone) {
            showToast('warning', 'Telefon Eksik', 'Teknisyenin telefon numarası bulunamadı.');
            return;
        }

        const temizNumara = (() => {
            let rakamlar = phone.replace(/[^0-9]/g, "");
            if (rakamlar.startsWith("00")) {
                rakamlar = rakamlar.slice(2);
            } else if (rakamlar.startsWith("0")) {
                rakamlar = "90" + rakamlar.slice(1);
            }
            if (rakamlar.length === 10 && rakamlar.startsWith("5")) {
                rakamlar = "90" + rakamlar;
            }
            return rakamlar;
        })();

        console.log("Paylasilacak WhatsApp Numarasi:", temizNumara, "Ham Telefon:", phone);

        setSharingId(payroll.id);
        try {
            if (Platform.OS === 'android') {
                const { isInstalled } = await Share.isPackageInstalled('com.whatsapp');
                if (!isInstalled) {
                    Alert.alert('WhatsApp bulunamadı', 'Cihazda WhatsApp yüklü değil.');
                    setSharingId(null);
                    return;
                }
            }
            const endpoint = isTechnician
                ? ENDPOINTS.HR.MY_PAYROLL_PDF(payroll.id)
                : ENDPOINTS.HR.PAYROLL_PDF(payroll.id);
            const baseUrl = (api.defaults.baseURL || '').replace(/\/$/, '');
            const fullUrl = `${baseUrl}/${endpoint.replace(/^\//, '')}`;
            const token = await AsyncStorage.getItem('auth_token');
            const tenantCode = await AsyncStorage.getItem('tenant_code');
            const filename = `bordro_${payroll.id.slice(0, 8)}.pdf`;
            const tmpPath = `${FileSystem.cacheDirectory}${filename}`;

            const dl = await FileSystem.downloadAsync(fullUrl, tmpPath, {
                headers: {
                    Authorization: token ? `Token ${token}` : '',
                    'X-Tenant-Code': tenantCode || '',
                },
            });

            if (dl.status !== 200) throw new Error('PDF indirilemedi.');

            const pdfBase64 = await FileSystem.readAsStringAsync(dl.uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            await Share.shareSingle({
                social: Share.Social.WHATSAPP,
                whatsAppNumber: temizNumara,
                url: `data:application/pdf;base64,${pdfBase64}`,
                type: 'application/pdf',
                filename: filename,
                useInternalStorage: true,
            });
        } catch (err) {
            if (err?.message && !err.message.toLowerCase().includes('cancel')) {
                showToast('error', 'Hata', 'WhatsApp gönderimi başarısız oldu.');
            }
        } finally {
            setSharingId(null);
        }
    }, [sharingId, showToast, isTechnician]);

    // ── Seçili teknisyen ───────────────────────────────────────────────────────

    const selectedTechObj = useMemo(() =>
        techniciansList.find(t => t.id === selectedTech) || null,
        [techniciansList, selectedTech]
    );
    const selectedTechName = selectedTechObj
        ? `${selectedTechObj.user?.first_name || ''} ${selectedTechObj.user?.last_name || ''}`.trim() || selectedTechObj.user?.email
        : null;

    // ── Render: Kart ───────────────────────────────────────────────────────────

    const renderItem = useCallback(({ item }) => (
        <PayrollCard
            item={item}
            colors={colors}
            isDark={isDark}
            sharingId={sharingId}
            isTechnician={isTechnician}
            onPdf={handlePdf}
            onWhatsApp={handleWhatsApp}
            navigation={navigation}
            onRefresh={fetchPayrolls}
        />
    ), [colors, isDark, sharingId, isTechnician, handlePdf, handleWhatsApp, navigation, fetchPayrolls]);

    // ── Render: Liste Başlığı ──────────────────────────────────────────────────

    const ListHeader = useMemo(() => (
        <View>
            {/* Stat Kartları */}
            <View style={styles.statsRow}>
                {STAT_CARDS(stats, isDark).map(({ key, ...s }) => (
                    <StatCard key={key} {...s} colors={colors} />
                ))}
            </View>

            {/* Teknisyen Seçici (admin genel mod) */}
            {!isFilteredView && !isTechnician && (
                <Pressable
                    style={[styles.techPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => techSheetRef.current?.present()}
                >
                    <View style={[styles.techPickerAvatar, { backgroundColor: `${serviceBlue}14` }]}>
                        <Text style={[styles.techPickerAvatarText, { color: serviceBlue }]}>
                            {selectedTechName ? selectedTechName.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'TK'}
                        </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.techPickerName, { color: colors.text }]}>
                            {selectedTechName || 'Tüm Teknisyenler'}
                        </Text>
                        <Text style={[styles.techPickerSub, { color: colors.textSecondary }]}>
                            {selectedTech ? 'Seçili Teknisyen' : 'Filtre için dokunun'}
                        </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textTertiary} />
                </Pressable>
            )}

            {/* Ay Navigasyonu */}
            <View style={[styles.monthNav, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable
                    style={[styles.monthArrow, { backgroundColor: isDark ? '#ffffff12' : '#F1F5F9' }]}
                    onPress={() => shiftMonth(-1)}
                    hitSlop={8}
                >
                    <MaterialCommunityIcons name="chevron-left" size={20} color={colors.text} />
                </Pressable>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={[styles.monthText, { color: colors.text }]}>{monthDisplay}</Text>
                </View>
                <Pressable
                    style={[styles.monthArrow, { backgroundColor: isDark ? '#ffffff12' : '#F1F5F9' }]}
                    onPress={() => shiftMonth(1)}
                    hitSlop={8}
                >
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text} />
                </Pressable>
            </View>

            {/* Tab Seçici */}
            <View style={[styles.tabBar, { backgroundColor: isDark ? colors.surface : '#F1F5F9', borderColor: colors.border }]}>
                {TABS.map(tab => {
                    const active = selectedTab === tab.key;
                    return (
                        <Pressable
                            key={tab.key}
                            style={[styles.tab, active && { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }]}
                            onPress={() => setSelectedTab(tab.key)}
                        >
                            <Text style={[styles.tabText, { color: active ? serviceBlue : colors.textSecondary, fontWeight: active ? '700' : '500' }]}>
                                {tab.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Sonuç sayısı */}
            <View style={styles.resultRow}>
                <MaterialCommunityIcons name="format-list-bulleted" size={13} color={colors.textTertiary} />
                <Text style={[styles.resultText, { color: colors.textTertiary }]}>
                    {filtered.length} kayıt
                </Text>
            </View>
        </View>
    ), [stats, isDark, colors, isFilteredView, isTechnician, selectedTechName, selectedTech, monthDisplay, selectedTab, filtered.length]);

    // ── Return ─────────────────────────────────────────────────────────────────

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES}>
            <Header
                title="Maaş Bordroları"
                subtitle="Aylık bordro ve ödeme yönetimi"
                showBack
                borderBottom
                rightActions={
                    !isTechnician
                        ? [{
                            icon: 'plus',
                            onPress: () => navigation.navigate('AdminPayrollForm', {
                                ...(isFilteredView ? { technicianId, technicianName } : {}),
                                onSuccess: fetchPayrolls,
                            }),
                            accessibilityLabel: 'Yeni Bordro',
                        }]
                        : undefined
                }
            />

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => String(item.id)}
                    renderItem={renderItem}
                    ListHeaderComponent={ListHeader}
                    contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
                    ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={[styles.emptyWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <MaterialCommunityIcons name="text-box-remove-outline" size={44} color={colors.textTertiary} />
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>Bordro bulunamadı</Text>
                            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                                {`${monthDisplay} dönemine ait bordro kaydı yok.`}
                            </Text>
                        </View>
                    }
                />
            )}

            <TechnicianPickerSheet
                ref={techSheetRef}
                technicians={techniciansList}
                loading={false}
                includeUnassigned
                selectedTechnicianId={selectedTech}
                onSelect={item => {
                    setSelectedTech(item?.id || null);
                    techSheetRef.current?.dismiss();
                }}
            />
        </WrapperContainer>
    );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent: { paddingHorizontal: 16, paddingTop: 16 },

    // Stat kartları
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    statCard: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        padding: 10,
        gap: 4,
    },
    statIcon: {
        width: 32, height: 32, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 4,
    },
    statLabel: { fontSize: 9, fontWeight: '600' },
    statValue: { fontSize: 13, fontWeight: '800' },

    // Teknisyen seçici
    techPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1,
        padding: 12,
        gap: 12,
        marginBottom: 12,
    },
    techPickerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    techPickerAvatarText: { fontSize: 14, fontWeight: '800' },
    techPickerName: { fontSize: 14, fontWeight: '700' },
    techPickerSub: { fontSize: 11, marginTop: 2 },

    // Ay nav
    monthNav: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 12,
    },
    monthArrow: {
        width: 34, height: 34, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center',
    },
    monthText: { fontSize: 15, fontWeight: '700' },

    // Tab bar
    tabBar: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 4,
        marginBottom: 12,
        borderWidth: 1,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabText: { fontSize: 11 },

    // Sonuç satırı
    resultRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
    resultText: { fontSize: 12, fontWeight: '600' },

    // Bordro kartı
    card: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 12,
    },
    avatar: {
        width: 44, height: 44, borderRadius: 22,
        alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 15, fontWeight: '800' },
    cardInfo: { flex: 1, gap: 4 },
    cardName: { fontSize: 15, fontWeight: '700' },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    cardMetaText: { fontSize: 11, fontWeight: '500' },
    cardRight: { alignItems: 'flex-end', gap: 6 },
    cardNet: { fontSize: 17, fontWeight: '900' },
    badge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 8, borderWidth: 1,
    },
    badgeDot: { width: 6, height: 6, borderRadius: 3 },
    badgeText: { fontSize: 10, fontWeight: '700' },

    // Özet satırı
    summaryRow: {
        flexDirection: 'row',
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    summaryCol: { flex: 1, alignItems: 'center', gap: 2 },
    summaryDivider: { width: StyleSheet.hairlineWidth },
    summaryLabel: { fontSize: 9, fontWeight: '600' },
    summaryVal: { fontSize: 11, fontWeight: '700' },

    // Aksiyon satırı
    actionRow: {
        flexDirection: 'row',
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingVertical: 8,
        paddingHorizontal: 10,
        gap: 8,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 8,
        borderRadius: 9,
        borderWidth: 1,
    },
    actionBtnText: { fontSize: 12, fontWeight: '700' },

    // Boş durum
    emptyWrap: {
        borderRadius: 16, borderWidth: 1,
        padding: 32, alignItems: 'center', gap: 10,
        marginTop: 8,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700' },
    emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
