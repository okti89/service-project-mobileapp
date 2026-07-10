import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import api from '@/api/axios';
import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';

const MONTHS = [
    { value: '', label: 'Tüm Aylar' },
    { value: '1', label: 'Ocak' },
    { value: '2', label: 'Şubat' },
    { value: '3', label: 'Mart' },
    { value: '4', label: 'Nisan' },
    { value: '5', label: 'Mayıs' },
    { value: '6', label: 'Haziran' },
    { value: '7', label: 'Temmuz' },
    { value: '8', label: 'Ağustos' },
    { value: '9', label: 'Eylül' },
    { value: '10', label: 'Ekim' },
    { value: '11', label: 'Kasım' },
    { value: '12', label: 'Aralık' },
];

const fmtMoney = (val) => {
    const n = Number(val || 0);
    return Number.isFinite(n)
        ? n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0,00';
};

const fmtCount = (val) => {
    return Number(val || 0).toLocaleString('tr-TR');
};

export default function AdminReportsScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();

    // Rapor Filtreleri
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
    const [selectedMonth, setSelectedMonth] = useState('');
    const [loading, setLoading] = useState(true);
    const [exportingPdf, setExportingPdf] = useState(false);

    // Rapor Verileri
    const [generalData, setGeneralData] = useState(null);
    const [technicianRows, setTechnicianRows] = useState([]);
    const [dashboardData, setDashboardData] = useState(null);

    // Sekme State'i ('general', 'technicians', 'insights')
    const [activeTab, setActiveTab] = useState('general');

    // Teknisyen Detay Modalı State'i
    const [selectedTech, setSelectedTech] = useState(null);
    const [techDetailData, setTechDetailData] = useState(null);
    const [techDetailLoading, setTechDetailLoading] = useState(false);

    // BottomSheet Ref
    const filterSheetRef = useRef(null);
    const techSheetRef = useRef(null);

    const filterSheetIndexRef = useRef(-1);
    const techSheetIndexRef = useRef(-1);

    const yearOptions = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, index) => String(currentYear + index));
    }, []);

    // API'den Veri Çekme
    const fetchReports = useCallback(async () => {
        setLoading(true);
        const params = {
            year: selectedYear,
            ...(selectedMonth ? { month: selectedMonth } : {})
        };
        try {
            const [genRes, techRes, dashRes] = await Promise.all([
                api.get('/reports/general/', { params }),
                api.get('/reports/technician/', { params }),
                api.get('/reports/dashboard/', { params })
            ]);

            setGeneralData(genRes.data || null);
            setTechnicianRows(Array.isArray(techRes.data) ? techRes.data : []);
            setDashboardData(dashRes.data || null);
        } catch (err) {
            console.log('Fetch reports error:', err?.message);
            showToast('error', 'Hata', 'Rapor verileri yüklenemedi.');
        } finally {
            setLoading(false);
        }
    }, [selectedYear, selectedMonth, showToast]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    // Teknisyen Detayı Getirme
    const loadTechnicianDetail = async (tech) => {
        setSelectedTech(tech);
        setTechDetailLoading(true);
        setTechDetailData(null);
        techSheetRef.current?.expand();
        try {
            const params = {
                year: selectedYear,
                ...(selectedMonth ? { month: selectedMonth } : {})
            };
            const techPath = tech.technician_id || 'unassigned';
            const res = await api.get(`/reports/technician/${techPath}/`, { params });
            setTechDetailData(res.data || null);
        } catch (err) {
            console.log('Load tech detail error:', err?.message);
            showToast('error', 'Hata', 'Teknisyen detay raporu yüklenemedi.');
        } finally {
            setTechDetailLoading(false);
        }
    };

    // PDF Raporlarını İndirip Cihazın PDF Okuyucusunda Veya Paylaşım Ekranında Açma
    const handleExportPdf = async (type) => {
        if (exportingPdf) return;
        setExportingPdf(true);
        
        const endpoint = type === 'general' ? '/reports/general/' : '/reports/technician/';
        const monthQuery = selectedMonth ? `&month=${selectedMonth}` : '';
        const pdfUrl = `${api.defaults.baseURL}${endpoint}?year=${selectedYear}${monthQuery}&export=pdf`;
        
        const timestamp = new Date().getTime();
        const fileName = `${type}_report_${selectedYear}_${selectedMonth || 'all'}_${timestamp}.pdf`;
        const localUri = `${FileSystem.cacheDirectory}${fileName}`;

        try {
            // AsyncStorage'dan auth_token ve tenant_code çekerek header doğrulaması ekleyelim
            const token = await AsyncStorage.getItem('auth_token');
            const tenantCode = await AsyncStorage.getItem('tenant_code');
            const headers = {
                ...(token ? { 'Authorization': `Token ${token}` } : {}),
                ...(tenantCode ? { 'X-Tenant-Code': tenantCode } : {})
            };

            showToast('info', 'Bilgi', 'PDF Raporu hazırlanıyor, lütfen bekleyin...');

            const downloadResult = await FileSystem.downloadAsync(pdfUrl, localUri, { headers });

            if (downloadResult.status !== 200) {
                throw new Error('Dosya indirme başarısız oldu.');
            }

            // Android için cihazın yerleşik PDF okuyucusunu (Adobe, Drive PDF vb.) tetikle
            if (Platform.OS === 'android') {
                try {
                    const contentUri = await FileSystem.getContentUriAsync(downloadResult.uri);
                    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                        data: contentUri,
                        type: 'application/pdf',
                        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
                    });
                } catch (intentErr) {
                    console.log('Intent launcher failed, falling back to Share:', intentErr);
                    await Sharing.shareAsync(downloadResult.uri, {
                        mimeType: 'application/pdf',
                        dialogTitle: `${type === 'general' ? 'Genel' : 'Teknisyen'} Performans Raporu`,
                        UTI: 'com.adobe.pdf'
                    });
                }
            } else {
                await Sharing.shareAsync(downloadResult.uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `${type === 'general' ? 'Genel' : 'Teknisyen'} Performans Raporu`,
                    UTI: 'com.adobe.pdf'
                });
            }
        } catch (err) {
            console.log('PDF download & share error:', err);
            showToast('error', 'Hata', 'PDF raporu oluşturulamadı.');
        } finally {
            setExportingPdf(false);
        }
    };

    // Android Geri Tuşu Yönetimi
    useEffect(() => {
        const backAction = () => {
            if (filterSheetIndexRef.current >= 0) {
                filterSheetRef.current?.close();
                return true;
            }
            if (techSheetIndexRef.current >= 0) {
                techSheetRef.current?.close();
                return true;
            }
            return false;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, []);

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

    const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label || 'Tüm Aylar';
    const filterText = `${monthLabel} ${selectedYear}`;

    // Web Metriklerine Göre Özet Kartları
    const statCards = useMemo(() => {
        if (!generalData) return [];
        return [
            {
                title: 'Toplam Ciro',
                value: `₺${fmtMoney(generalData.total_revenue)}`,
                icon: 'cash-register',
                color: serviceGreen,
                subText: `Toplam Servis: ${fmtCount(generalData.total_services)}`
            },
            {
                title: 'Tahsil Edilmemiş',
                value: `₺${fmtMoney(generalData.outstanding_receivables)}`,
                icon: 'alert-circle-outline',
                color: serviceOrange,
                subText: `Fatura Sayısı: ${fmtCount(generalData.total_overdue_receivables)}`
            },
            {
                title: 'Toplam Gider',
                value: `₺${fmtMoney(generalData.total_expenses)}`,
                icon: 'trending-down',
                color: serviceRed,
                subText: `Toplam Müşteri: ${fmtCount(generalData.total_customers)}`
            },
            {
                title: 'İptal Edilen',
                value: `₺${fmtMoney(generalData.total_reversal)}`,
                icon: 'cancel',
                color: '#718096',
                subText: `İptal Servis: ${fmtCount(generalData.total_cancelled_services)}`
            }
        ];
    }, [generalData]);

    const sortedByRevenue = useMemo(() => {
        return [...technicianRows].sort((a, b) => Number(b.total_revenue_generated || 0) - Number(a.total_revenue_generated || 0));
    }, [technicianRows]);

    const topTechnician = sortedByRevenue[0] || null;

    const totalTechnicianRevenue = useMemo(() => {
        return sortedByRevenue.reduce((sum, row) => sum + Number(row.total_revenue_generated || 0), 0);
    }, [sortedByRevenue]);

    const sortedByServiceCount = useMemo(() => {
        return [...technicianRows].sort((a, b) => Number(b.completed_services_count || 0) - Number(a.completed_services_count || 0));
    }, [technicianRows]);

    const border = colors.border;
    const cardBg = colors.surface;

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES} style={{ backgroundColor: colors.background }}>
            <Header
                title="Raporlar & Analiz"
                showBack
                borderBottom
                rightActions={[
                    {
                        icon: 'filter-variant',
                        color: serviceBlue,
                        onPress: () => filterSheetRef.current?.expand()
                    }
                ]}
            />

            {/* Filtre Gösterim Çubuğu */}
            <Pressable
                onPress={() => filterSheetRef.current?.expand()}
                style={[styles.filterBar, { borderColor: border, backgroundColor: cardBg }]}
            >
                <MaterialCommunityIcons name="calendar-range" size={16} color={serviceBlue} />
                <Text style={[styles.filterBarText, { color: colors.text }]}>{filterText} Verileri</Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
            </Pressable>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={serviceBlue} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Rapor verileri hesaplanıyor...</Text>
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
                >
                    {/* PDF Raporu Çıktı Butonları */}
                    <View style={styles.pdfButtonRow}>
                        <Pressable
                            onPress={() => handleExportPdf('general')}
                            disabled={exportingPdf}
                            style={({ pressed }) => [
                                styles.pdfBtn,
                                { backgroundColor: `${serviceRed}10`, borderColor: serviceRed },
                                (exportingPdf || pressed) && { opacity: 0.7 }
                            ]}
                        >
                            {exportingPdf ? (
                                <ActivityIndicator size="small" color={serviceRed} />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="file-pdf-box" size={16} color={serviceRed} />
                                    <Text style={[styles.pdfBtnText, { color: serviceRed }]}>Genel PDF</Text>
                                </>
                            )}
                        </Pressable>
                        <Pressable
                            onPress={() => handleExportPdf('technician')}
                            disabled={exportingPdf}
                            style={({ pressed }) => [
                                styles.pdfBtn,
                                { backgroundColor: `${serviceRed}10`, borderColor: serviceRed },
                                (exportingPdf || pressed) && { opacity: 0.7 }
                            ]}
                        >
                            {exportingPdf ? (
                                <ActivityIndicator size="small" color={serviceRed} />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="file-pdf-box" size={16} color={serviceRed} />
                                    <Text style={[styles.pdfBtnText, { color: serviceRed }]}>Teknisyen PDF</Text>
                                </>
                            )}
                        </Pressable>
                    </View>

                    {/* Net Kâr Kartı (Webdeki Lüks Mor Kart) */}
                    {generalData && (
                        <View style={[styles.profitCard, { backgroundColor: isDark ? '#312E81' : '#5A67D8' }]}>
                            <View style={styles.profitHeader}>
                                <Text style={styles.profitTitle}>NET KÂR DURUMU</Text>
                                <MaterialCommunityIcons name="chart-line" size={22} color="#FFF" />
                            </View>
                            <Text style={styles.profitVal}>₺{fmtMoney(generalData.total_profit)}</Text>
                            <View style={styles.profitFooter}>
                                <Text style={styles.profitSubText}>Tamamlanan Servisler</Text>
                                <Text style={styles.profitCompletedCount}>{generalData.total_completed_services} Adet</Text>
                            </View>
                        </View>
                    )}

                    {/* Kartlar (Özet İstatistikler - Yatay Scroll) */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.statsScroll}
                    >
                        {statCards.map((card, idx) => (
                            <View key={idx} style={[styles.statCard, { backgroundColor: cardBg, borderColor: border }]}>
                                <View style={styles.statHeader}>
                                    <View style={[styles.statIconWrap, { backgroundColor: `${card.color}15` }]}>
                                        <MaterialCommunityIcons name={card.icon} size={20} color={card.color} />
                                    </View>
                                    <Text style={[styles.statTitle, { color: colors.textSecondary }]}>{card.title}</Text>
                                </View>
                                <Text style={[styles.statValue, { color: colors.text }]}>{card.value}</Text>
                                <Text style={[styles.statSubText, { color: colors.textSecondary }]}>{card.subText}</Text>
                            </View>
                        ))}
                    </ScrollView>

                    {/* Sekme Seçimi (Genel Analiz / Teknisyen Analizi / Sıralamalar) */}
                    <View style={[styles.tabContainer, { borderColor: border, backgroundColor: cardBg }]}>
                        <Pressable
                            onPress={() => setActiveTab('general')}
                            style={[styles.tabBtn, activeTab === 'general' && [styles.tabActiveBtn, { backgroundColor: serviceBlue }]]}
                        >
                            <Text style={[styles.tabBtnText, { color: activeTab === 'general' ? '#FFF' : colors.textSecondary }]}>
                                Dağılım Oranları
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setActiveTab('technicians')}
                            style={[styles.tabBtn, activeTab === 'technicians' && [styles.tabActiveBtn, { backgroundColor: serviceBlue }]]}
                        >
                            <Text style={[styles.tabBtnText, { color: activeTab === 'technicians' ? '#FFF' : colors.textSecondary }]}>
                                Ciro Sıralaması
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setActiveTab('insights')}
                            style={[styles.tabBtn, activeTab === 'insights' && [styles.tabActiveBtn, { backgroundColor: serviceBlue }]]}
                        >
                            <Text style={[styles.tabBtnText, { color: activeTab === 'insights' ? '#FFF' : colors.textSecondary }]}>
                                Liderler & Özet
                            </Text>
                        </Pressable>
                    </View>

                    {/* Sekme İçerikleri */}
                    {activeTab === 'general' ? (
                        <View style={styles.tabContent}>
                            {/* Servis Durum Dağılümleri */}
                            {generalData && (
                                <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                                    <Text style={[styles.cardTitle, { color: colors.text }]}>Servis Durum Dağılım Oranları</Text>
                                    
                                    {/* Tamamlanan */}
                                    <View style={styles.progressContainer}>
                                        <View style={styles.progressTextRow}>
                                            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>Tamamlanan İşler</Text>
                                            <Text style={[styles.progressVal, { color: serviceGreen }]}>
                                                {Number(generalData.total_completed_services_percentage || 0).toFixed(1)}%
                                            </Text>
                                        </View>
                                        <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#2D3748' : '#E2E8F0' }]}>
                                            <View style={[styles.progressBarFill, { backgroundColor: serviceGreen, width: `${Number(generalData.total_completed_services_percentage || 0)}%` }]} />
                                        </View>
                                    </View>

                                    {/* Süreçte Bekleyenler */}
                                    <View style={styles.progressContainer}>
                                        <View style={styles.progressTextRow}>
                                            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>Süreçte Bekleyenler</Text>
                                            <Text style={[styles.progressVal, { color: serviceOrange }]}>
                                                {Number(generalData.total_pending_services_percentage || 0).toFixed(1)}%
                                            </Text>
                                        </View>
                                        <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#2D3748' : '#E2E8F0' }]}>
                                            <View style={[styles.progressBarFill, { backgroundColor: serviceOrange, width: `${Number(generalData.total_pending_services_percentage || 0)}%` }]} />
                                        </View>
                                    </View>

                                    {/* İptal Edilenler */}
                                    <View style={styles.progressContainer}>
                                        <View style={styles.progressTextRow}>
                                            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>İptal Edilenler</Text>
                                            <Text style={[styles.progressVal, { color: serviceRed }]}>
                                                {Number(generalData.total_cancelled_services_percentage || 0).toFixed(1)}%
                                            </Text>
                                        </View>
                                        <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#2D3748' : '#E2E8F0' }]}>
                                            <View style={[styles.progressBarFill, { backgroundColor: serviceRed, width: `${Number(generalData.total_cancelled_services_percentage || 0)}%` }]} />
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Aylık Ciro Dağılımı */}
                            {dashboardData && (
                                <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                                    <Text style={[styles.cardTitle, { color: colors.text }]}>Aylık Ciro Dağılımı</Text>
                                    {(dashboardData.monthly_revenue || []).length === 0 ? (
                                        <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center', marginVertical: 12 }}>Aylık ciro verisi bulunamadı.</Text>
                                    ) : (
                                        (dashboardData.monthly_revenue || []).map((row) => {
                                            const maxTotal = Math.max(...((dashboardData.monthly_revenue || []).map((entry) => Number(entry.total || 0))), 1);
                                            const percent = (Number(row.total || 0) / maxTotal) * 100;
                                            return (
                                                <View key={row.name} style={styles.progressContainer}>
                                                    <View style={styles.progressTextRow}>
                                                        <Text style={[styles.progressLabel, { color: colors.text }]}>{row.name}</Text>
                                                        <Text style={[styles.progressVal, { color: colors.textSecondary }]}>₺{fmtMoney(row.total)}</Text>
                                                    </View>
                                                    <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#2D3748' : '#E2E8F0' }]}>
                                                        <View style={[styles.progressBarFill, { backgroundColor: serviceBlue, width: `${percent}%` }]} />
                                                    </View>
                                                </View>
                                            );
                                        })
                                    )}
                                </View>
                            )}
                        </View>
                    ) : activeTab === 'technicians' ? (
                        <View style={styles.tabContent}>
                            {/* Teknik Servis Ciro Sıralaması */}
                            {sortedByRevenue.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <MaterialCommunityIcons name="account-search-outline" size={40} color={colors.textTertiary} />
                                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Teknisyen verisi bulunamadı.</Text>
                                </View>
                            ) : (
                                sortedByRevenue.map((tech, idx) => (
                                    <Pressable
                                        key={tech.technician_id || 'unassigned'}
                                        onPress={() => loadTechnicianDetail(tech)}
                                        style={({ pressed }) => [
                                            styles.techCard,
                                            { backgroundColor: cardBg, borderColor: border },
                                            pressed && { opacity: 0.85 }
                                        ]}
                                    >
                                        <View style={styles.techHeader}>
                                            <View style={[
                                                styles.rankBadge,
                                                {
                                                    backgroundColor: idx === 0 ? '#D1FAE5' : idx === 1 ? '#FFEDD5' : idx === 2 ? '#FEF3C7' : '#F1F5F9'
                                                }
                                            ]}>
                                                <Text style={[
                                                    styles.rankText,
                                                    {
                                                        color: idx === 0 ? '#059669' : idx === 1 ? '#EA580C' : idx === 2 ? '#D97706' : '#64748B'
                                                    }
                                                ]}>
                                                    {idx + 1}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                <Text style={[styles.techName, { color: colors.text }]}>{tech.technician_name || 'Atanmamış'}</Text>
                                                <Text style={[styles.techJob, { color: colors.textSecondary }]}>
                                                    {fmtCount(tech.completed_services_count)} İş Tamamladı
                                                </Text>
                                            </View>
                                            <Text style={[styles.techRevenue, { color: serviceGreen }]}>
                                                ₺{fmtMoney(tech.total_revenue_generated)}
                                            </Text>
                                        </View>
                                    </Pressable>
                                ))
                            )}
                        </View>
                    ) : (
                        <View style={styles.tabContent}>
                            {/* Liderler & Rapor Özetleri */}
                            {topTechnician && (
                                <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                        <MaterialCommunityIcons name="trophy-outline" size={20} color={serviceOrange} />
                                        <Text style={[styles.cardTitle, { color: colors.text }]}>Lider Teknisyen (Ciro)</Text>
                                    </View>
                                    <Text style={[styles.insightsVal, { color: colors.text }]}>{topTechnician.technician_name}</Text>
                                    <Text style={[styles.insightsSub, { color: serviceGreen }]}>
                                        Toplam Ciro: ₺{fmtMoney(topTechnician.total_revenue_generated)}
                                    </Text>
                                </View>
                            )}

                            <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                                <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 6 }]}>Özet Rapor İçgörüleri</Text>
                                
                                <View style={styles.detailRow}>
                                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Teknisyen Toplam Hasılatı</Text>
                                    <Text style={[styles.detailVal, { color: colors.text }]}>₺{fmtMoney(totalTechnicianRevenue)}</Text>
                                </View>
                                <View style={[styles.divider, { backgroundColor: border }]} />
                                <View style={styles.detailRow}>
                                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Ortalama Personel Hasılatı</Text>
                                    <Text style={[styles.detailVal, { color: serviceBlue }]}>
                                        ₺{fmtMoney(sortedByRevenue.length > 0 ? (totalTechnicianRevenue / sortedByRevenue.length) : 0)}
                                    </Text>
                                </View>
                            </View>

                            {/* Servis Adet Liderliği */}
                            <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                                <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 8 }]}>En Çok Servis Kapatanlar</Text>
                                {sortedByServiceCount.slice(0, 3).map((tech, idx) => (
                                    <View key={tech.technician_id || idx} style={styles.rankRow}>
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
                                            {idx + 1}. {tech.technician_name}
                                        </Text>
                                        <View style={[styles.badge, { backgroundColor: `${serviceBlue}15` }]}>
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: serviceBlue }}>
                                                {fmtCount(tech.completed_services_count)} Servis
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* ── Yıl / Ay Rapor Filtresi BottomSheet ── */}
            <BottomSheet
                ref={filterSheetRef}
                index={-1}
                snapPoints={['50%', '75%']}
                enablePanDownToClose
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: colors.surface }}
                handleIndicatorStyle={{ backgroundColor: colors.textTertiary }}
                onChange={(index) => { filterSheetIndexRef.current = index; }}
            >
                <BottomSheetView style={[styles.sheetContent, { flex: 1, paddingBottom: insets.bottom + 10 }]}>
                    <View style={styles.sheetHeader}>
                        <Text style={[styles.sheetTitle, { color: colors.text }]}>Tarih Filtresi Seçin</Text>
                        <Pressable onPress={() => filterSheetRef.current?.close()}>
                            <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                        </Pressable>
                    </View>

                    <BottomSheetScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                        {/* Yıl Seçimi */}
                        <Text style={[styles.sheetSectionTitle, { color: colors.textSecondary }]}>Yıl</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 8, paddingVertical: 4, paddingHorizontal: 2 }}
                        >
                            {yearOptions.map(year => {
                                const isSelected = selectedYear === year;
                                return (
                                    <Pressable
                                        key={year}
                                        onPress={() => setSelectedYear(year)}
                                        style={[
                                            styles.filterChip,
                                            { borderColor: border, paddingHorizontal: 16, paddingVertical: 8, minWidth: 65 },
                                            isSelected && { borderColor: serviceBlue, backgroundColor: `${serviceBlue}12` }
                                        ]}
                                    >
                                        <Text style={[styles.filterChipText, { color: isSelected ? serviceBlue : colors.text, fontSize: 12 }]}>{year}</Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>

                        {/* Ay Seçimi */}
                        <Text style={[styles.sheetSectionTitle, { color: colors.textSecondary, marginTop: 16 }]}>Ay</Text>
                        <View style={styles.filterChipGroup}>
                            {MONTHS.map(m => {
                                const isSelected = selectedMonth === m.value;
                                return (
                                    <Pressable
                                        key={m.value}
                                        onPress={() => setSelectedMonth(m.value)}
                                        style={[
                                            styles.filterChip,
                                            { borderColor: border, width: '30%', marginVertical: 3 },
                                            isSelected && { borderColor: serviceBlue, backgroundColor: `${serviceBlue}12` }
                                        ]}
                                    >
                                        <Text style={[styles.filterChipText, { color: isSelected ? serviceBlue : colors.text }]} numberOfLines={1}>
                                            {m.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Pressable
                            onPress={() => {
                                filterSheetRef.current?.close();
                                fetchReports();
                            }}
                            style={({ pressed }) => [
                                styles.applyBtn,
                                { backgroundColor: serviceBlue, marginBottom: 20 },
                                pressed && { opacity: 0.8 }
                            ]}
                        >
                            <Text style={styles.applyBtnText}>Filtreyi Uygula</Text>
                        </Pressable>
                    </BottomSheetScrollView>
                </BottomSheetView>
            </BottomSheet>

            {/* ── Teknisyen Performans Detay BottomSheet ── */}
            <BottomSheet
                ref={techSheetRef}
                index={-1}
                snapPoints={['50%', '85%']}
                enablePanDownToClose
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: colors.surface }}
                handleIndicatorStyle={{ backgroundColor: colors.textTertiary }}
                onChange={(index) => { techSheetIndexRef.current = index; }}
            >
                <BottomSheetView style={[styles.sheetContent, { flex: 1, paddingBottom: insets.bottom + 10 }]}>
                    <View style={styles.sheetHeader}>
                        <Text style={[styles.sheetTitle, { color: colors.text }]}>Teknisyen Performans Detayı</Text>
                        <Pressable onPress={() => techSheetRef.current?.close()}>
                            <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                        </Pressable>
                    </View>

                    {techDetailLoading ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                            <ActivityIndicator size="small" color={serviceBlue} />
                            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>Detaylar yükleniyor...</Text>
                        </View>
                    ) : techDetailData ? (
                        <BottomSheetScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                            <View style={styles.detailCard}>
                                <Text style={[styles.detailCardTitle, { color: colors.text }]}>{selectedTech?.technician_name || 'Atanmamış'}</Text>
                                <Text style={[styles.detailCardSub, { color: colors.textSecondary }]}>{filterText} Performansı</Text>

                                <View style={[styles.divider, { backgroundColor: border }]} />

                                <View style={styles.detailRow}>
                                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Oluşturulan Ciro</Text>
                                    <Text style={[styles.detailVal, { color: serviceGreen }]}>₺{fmtMoney(techDetailData.total_revenue_generated)}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Toplanan / Ödenen</Text>
                                    <Text style={[styles.detailVal, { color: serviceBlue }]}>₺{fmtMoney(techDetailData.total_collected)}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Kalan Müşteri Borcu</Text>
                                    <Text style={[styles.detailVal, { color: serviceRed }]}>₺{fmtMoney(techDetailData.total_remaining)}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Tamamlanan Servis Adedi</Text>
                                    <Text style={[styles.detailVal, { color: colors.text }]}>{fmtCount(techDetailData.completed_services_count)}</Text>
                                </View>
                            </View>

                            {/* Ek Rapor Notu */}
                            <View style={[styles.infoBox, { backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF', borderColor: `${serviceBlue}30` }]}>
                                <MaterialCommunityIcons name="information-outline" size={16} color={serviceBlue} />
                                <Text style={[styles.infoBoxText, { color: colors.textSecondary }]}>
                                    Bu teknisyen, seçili zaman diliminde tamamlanan servislerin ciro payının %
                                    {generalData?.total_revenue > 0
                                        ? ((Number(techDetailData.total_revenue_generated) / Number(generalData.total_revenue)) * 100).toFixed(1)
                                        : '0'}
                                    'lik kısmını oluşturmuştur.
                                </Text>
                            </View>

                            {/* TEKNİSYENİN YAPTIĞI SERVİSLERİN LİSTESİ */}
                            <Text style={[styles.sheetSectionTitle, { color: colors.textSecondary, marginTop: 20 }]}>Gerçekleştirilen Servisler ({techDetailData.services?.length || 0})</Text>
                            
                            {(!techDetailData.services || techDetailData.services.length === 0) ? (
                                <Text style={{ color: colors.textTertiary, fontSize: 12, fontStyle: 'italic', marginVertical: 12 }}>
                                    Bu dönemde yapılmış servis kaydı bulunmamaktadır.
                                </Text>
                            ) : (
                                <View style={{ gap: 8, marginTop: 6, marginBottom: 20 }}>
                                    {techDetailData.services.map((srv, index) => {
                                        const isCompleted = srv.status_code === 'completed';
                                        const isCancelled = srv.status_code === 'cancelled';
                                        const statusColor = isCompleted ? serviceGreen : isCancelled ? serviceRed : serviceOrange;

                                        return (
                                            <View key={srv.id || index} style={[styles.serviceRowItem, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB', borderColor: border }]}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.serviceCustName, { color: colors.text }]} numberOfLines={1}>
                                                        {srv.customer_name || 'Müşteri Belirtilmemiş'}
                                                    </Text>
                                                    <Text style={[styles.serviceCategory, { color: colors.textSecondary }]}>
                                                        {srv.category_name || 'Genel Servis'}
                                                    </Text>
                                                    <Text style={[styles.serviceDate, { color: colors.textTertiary }]}>
                                                        {srv.scheduled_date ? dayjs(srv.scheduled_date).format('DD MMMM YYYY') : '-'}
                                                    </Text>
                                                </View>
                                                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                                    <Text style={[styles.servicePrice, { color: isCompleted ? serviceGreen : colors.text }]}>
                                                        ₺{fmtMoney(srv.price)}
                                                    </Text>
                                                    <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15`, borderColor: statusColor }]}>
                                                        <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                                                            {srv.status_name || 'Bekliyor'}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </BottomSheetScrollView>
                    ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: colors.textTertiary }}>Detay verisi bulunamadı.</Text>
                        </View>
                    )}
                </BottomSheetView>
            </BottomSheet>

        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
    loadingText: { fontSize: 13, fontWeight: '600' },
    scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

    // Filtre Çubuğu
    filterBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
        marginHorizontal: 16,
        marginTop: 10,
    },
    filterBarText: { fontSize: 13, fontWeight: '700', marginLeft: 8 },

    // PDF Raporlama Row
    pdfButtonRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12 },
    pdfBtn: { flex: 1, flexDirection: 'row', height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
    pdfBtnText: { fontSize: 12, fontWeight: '700' },

    // Lüks Mor Net Kâr Kartı
    profitCard: {
        borderRadius: 18,
        padding: 16,
        marginVertical: 14,
        elevation: 6,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 5,
        shadowOpacity: 0.15,
    },
    profitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    profitTitle: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    profitVal: { color: '#FFF', fontSize: 24, fontWeight: '900', marginVertical: 8 },
    profitFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 10, marginTop: 2 },
    profitSubText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },
    profitCompletedCount: { color: '#FFF', fontSize: 12, fontWeight: '800' },

    // Stat Kartları (Yatay Scroll)
    statsScroll: { gap: 10, paddingRight: 16, marginBottom: 16 },
    statCard: {
        width: 155,
        borderRadius: 16,
        borderWidth: 1,
        padding: 12,
        justifyContent: 'space-between',
        height: 110,
    },
    statHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statIconWrap: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    statTitle: { fontSize: 9, fontWeight: '800', letterSpacing: 0.2 },
    statValue: { fontSize: 14, fontWeight: '900', marginVertical: 4 },
    statSubText: { fontSize: 9, fontWeight: '600', opacity: 0.8 },

    // Segment Sekmeleri
    tabContainer: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 3,
        borderWidth: 1,
        marginBottom: 16,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 9,
    },
    tabActiveBtn: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1.5,
    },
    tabBtnText: { fontSize: 10, fontWeight: '800' },

    tabContent: { gap: 12 },

    // Genel Kartlar
    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        gap: 12,
    },
    cardTitle: { fontSize: 13, fontWeight: '800' },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailLabel: { fontSize: 12, fontWeight: '600' },
    detailVal: { fontSize: 13, fontWeight: '800' },

    // Sıralama ve Liderlik Değerleri
    insightsVal: { fontSize: 18, fontWeight: '900' },
    insightsSub: { fontSize: 13, fontWeight: '700', marginTop: 2 },
    rankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },

    // Teknisyen Kartları
    techCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        gap: 12,
    },
    techHeader: { flexDirection: 'row', alignItems: 'center' },
    rankBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    rankText: { fontSize: 11, fontWeight: '800' },
    techName: { fontSize: 13, fontWeight: '800' },
    techJob: { fontSize: 11, fontWeight: '600', marginTop: 1 },
    techRevenue: { fontSize: 13, fontWeight: '900', marginLeft: 'auto' },

    progressContainer: { gap: 6, marginVertical: 4 },
    progressTextRow: { flexDirection: 'row', justifyContent: 'space-between' },
    progressLabel: { fontSize: 11, fontWeight: '600' },
    progressVal: { fontSize: 12, fontWeight: '800' },
    progressBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 3 },

    // BottomSheet
    sheetContent: { paddingHorizontal: 20, paddingTop: 6 },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 16,
    },
    sheetTitle: { fontSize: 15, fontWeight: '800' },
    sheetSectionTitle: { fontSize: 11, fontWeight: '700', width: '100%', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 10 },

    filterChipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: '100%', paddingVertical: 4 },
    filterChip: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
    filterChipText: { fontSize: 12, fontWeight: '600' },

    applyBtn: { width: '100%', height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    applyBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800' },

    // Detay Kartı
    detailCard: { width: '100%', gap: 10 },
    detailCardTitle: { fontSize: 16, fontWeight: '800' },
    detailCardSub: { fontSize: 11, fontWeight: '600' },
    divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },

    infoBox: {
        flexDirection: 'row',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
        marginTop: 16,
        width: '100%',
    },
    infoBoxText: { fontSize: 11, fontWeight: '600', flex: 1 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
    emptyText: { fontSize: 12, fontWeight: '600' },

    // Servis Row Item
    serviceRowItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    serviceCustName: { fontSize: 12, fontWeight: '800' },
    serviceCategory: { fontSize: 11, fontWeight: '600', marginTop: 2 },
    serviceDate: { fontSize: 10, fontWeight: '600', marginTop: 2 },
    servicePrice: { fontSize: 12, fontWeight: '800' },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
    },
    statusBadgeText: { fontSize: 9, fontWeight: '800' }
});
