import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { getNativeShare } from '@/utils/nativeShare';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';

// ─── Sabitler & Yardımcılar ───────────────────────────────────────────────────

const MONTHS_TR = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const fmtMoney = (val) => {
    const n = Number(val || 0);
    return Number.isFinite(n)
        ? n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0,00';
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

// ─── PayrollDetailScreen ──────────────────────────────────────────────────────

export default function PayrollDetailScreen({ route, navigation }) {
    const { payrollId } = route?.params || {};
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();
    const { isAdmin, isTechnician } = useAuth();

    const [payroll, setPayroll] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [pdfSharing, setPdfSharing] = useState(false);

    // Detayları Yükle
    const fetchPayrollDetail = useCallback(async () => {
        if (!payrollId) return;
        try {
            const url = isTechnician
                ? `${ENDPOINTS.HR.MY_PAYROLLS}${payrollId}/`
                : `${ENDPOINTS.HR.PAYROLLS}${payrollId}/`;
            const res = await api.get(url);
            setPayroll(res.data);
        } catch (err) {
            console.log('Payroll detail fetch error:', err?.message);
            showToast('error', 'Hata', 'Bordro detayları yüklenemedi.');
        } finally {
            setLoading(false);
        }
    }, [payrollId, isTechnician, showToast]);

    useEffect(() => {
        setLoading(true);
        fetchPayrollDetail();
    }, [fetchPayrollDetail]);

    // Durum Değiştirme
    const updatePayrollStatus = async (newStatus) => {
        if (!payrollId || actionLoading) return;
        setActionLoading(true);
        try {
            const url = `${ENDPOINTS.HR.PAYROLLS}${payrollId}/`;
            await api.patch(url, { status: newStatus });
            showToast('success', 'Güncellendi', `Bordro durumu "${STATUS_META[newStatus].label}" olarak güncellendi.`);
            fetchPayrollDetail();
            if (route.params?.onRefresh) {
                route.params.onRefresh();
            }
        } catch (err) {
            console.log('Status update error:', err?.response?.data || err?.message);
            showToast('error', 'Hata', 'Durum güncellenemedi.');
        } finally {
            setActionLoading(false);
        }
    };

    // Silme İşlemi
    const handleDelete = () => {
        Alert.alert(
            'Bordroyu Sil',
            'Bu bordro kaydını kalıcı olarak silmek istediğinize emin misiniz?',
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            await api.delete(`${ENDPOINTS.HR.PAYROLLS}${payrollId}/`);
                            showToast('success', 'Başarılı', 'Bordro başarıyla silindi.');
                            if (route.params?.onRefresh) {
                                route.params.onRefresh();
                            }
                            navigation.goBack();
                        } catch (err) {
                            console.log('Delete error:', err?.message);
                            showToast('error', 'Hata', 'Bordro silinemedi.');
                        } finally {
                            setActionLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // PDF Paylaş
    const handlePdfShare = async () => {
        if (!payroll || pdfSharing) return;
        setPdfSharing(true);
        try {
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
                showToast('error', 'Hata', 'PDF dosyası hazırlanamadı.');
            }
        } catch (err) {
            console.log('PDF Open Error:', err);
            showToast('error', 'Hata', 'PDF dosyası açılamadı. Cihazınızda PDF okuyucu yüklü olduğundan emin olun.');
        } finally {
            setPdfSharing(false);
        }
    };

    // WhatsApp Paylaş
    const handleWhatsAppShare = async () => {
        if (!payroll || pdfSharing) return;
        const phone = payroll.technician_phone || '';
        if (!phone) {
            showToast('warning', 'Telefon Eksik', 'Teknisyenin telefon numarası bulunamadı.');
            return;
        }
        let numara = phone.replace(/[^0-9]/g, '');
        if (numara.startsWith('0')) numara = '90' + numara.slice(1);
        if (!numara.startsWith('90') && numara.length === 10) numara = '90' + numara;

        setPdfSharing(true);
        try {
            const nativeShare = getNativeShare();
            if (!nativeShare) {
                showToast('warning', 'Dev Modu', 'WhatsApp PDF gonderimi bu development build icinde kapali.');
                return;
            }
            if (Platform.OS === 'android') {
                const { isInstalled } = await nativeShare.isPackageInstalled('com.whatsapp');
                if (!isInstalled) {
                    Alert.alert('WhatsApp bulunamadı', 'Cihazda WhatsApp yüklü değil.');
                    setPdfSharing(false);
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

            await nativeShare.shareSingle({
                social: nativeShare.Social.WHATSAPP,
                whatsAppNumber: numara,
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
            setPdfSharing(false);
        }
    };

    const bg = isDark ? '#0D1117' : '#F4F7FB';
    const cardBg = colors.surface;
    const border = colors.border;

    if (loading) {
        return (
            <WrapperContainer>
                <Header title="Bordro Detayı" showBack borderBottom />
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={serviceBlue} />
                </View>
            </WrapperContainer>
        );
    }

    if (!payroll) {
        return (
            <WrapperContainer>
                <Header title="Bordro Detayı" showBack borderBottom />
                <View style={styles.loadingWrap}>
                    <Text style={{ color: colors.textSecondary }}>Bordro kaydı bulunamadı.</Text>
                </View>
            </WrapperContainer>
        );
    }

    const sc = STATUS_META[payroll.status] || STATUS_META.draft;
    const additions = payroll.components?.filter(c => c.type === 'addition') || [];
    const deductions = payroll.components?.filter(c => c.type === 'deduction') || [];

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES}>
            <Header
                title="Bordro Detayı"
                subtitle={getMonthYear(payroll.period_start)}
                showBack
                borderBottom
                rightActions={
                    isAdmin
                        ? [{
                            icon: 'pencil-outline',
                            color: serviceBlue,
                            onPress: () => navigation.navigate('AdminPayrollForm', {
                                payrollId: payroll.id,
                                onSuccess: () => {
                                    fetchPayrollDetail();
                                    if (route.params?.onRefresh) route.params.onRefresh();
                                }
                            }),
                            accessibilityLabel: 'Düzenle',
                        }]
                        : undefined
                }
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
            >
                {/* ── Üst Kart (Genel Özet & Durum) ── */}
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                    <View style={styles.cardHeader}>
                        <View style={[styles.avatar, { backgroundColor: `${serviceBlue}12` }]}>
                            <Text style={[styles.avatarText, { color: serviceBlue }]}>
                                {payroll.technician_name ? payroll.technician_name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'TK'}
                            </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.techName, { color: colors.text }]}>{payroll.technician_name}</Text>
                            <Text style={[styles.techSub, { color: colors.textSecondary }]}>{payroll.technician_email}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: sc.bg, borderColor: sc.borderColor }]}>
                            <View style={[styles.badgeDot, { backgroundColor: sc.color }]} />
                            <Text style={[styles.badgeText, { color: sc.color }]}>{sc.label}</Text>
                        </View>
                    </View>

                    <View style={[styles.divider, { backgroundColor: border }]} />

                    {/* Net Maaş Gösterimi */}
                    <View style={styles.netSalaryContainer}>
                        <Text style={[styles.netTitle, { color: colors.textSecondary }]}>Net Ödenecek Maaş</Text>
                        <Text style={[styles.netAmount, { color: serviceBlue }]}>₺{fmtMoney(payroll.net_salary)}</Text>
                    </View>

                    {/* Temel Bilgiler */}
                    <View style={[styles.infoGrid, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC', borderColor: border }]}>
                        <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Dönem:</Text>
                            <Text style={[styles.infoValue, { color: colors.text }]}>{getMonthYear(payroll.period_start)}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Taban Maaş:</Text>
                            <Text style={[styles.infoValue, { color: colors.text }]}>₺{fmtMoney(payroll.base_salary)}</Text>
                        </View>
                        {payroll.paid_date && (
                            <View style={styles.infoRow}>
                                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Ödeme Tarihi:</Text>
                                <Text style={[styles.infoValue, { color: serviceGreen }]}>
                                    {new Date(payroll.paid_date).toLocaleDateString('tr-TR')}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* ── Eklentiler (Primler) ── */}
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                    <Text style={[styles.sectionTitle, { color: serviceGreen }]}>Primler ve Eklentiler (+)</Text>
                    {additions.length === 0 ? (
                        <Text style={[styles.emptyLabel, { color: colors.textTertiary }]}>Ek prim veya ödeme bulunmuyor.</Text>
                    ) : (
                        additions.map((item, idx) => (
                            <View key={item.id || idx} style={[styles.compItem, { borderBottomColor: border }]}>
                                <Text style={[styles.compName, { color: colors.text }]}>{item.name}</Text>
                                <Text style={[styles.compVal, { color: serviceGreen }]}>+₺{fmtMoney(item.amount)}</Text>
                            </View>
                        ))
                    )}
                    <View style={[styles.totalSumRow, { borderTopColor: border }]}>
                        <Text style={[styles.totalSumLabel, { color: colors.textSecondary }]}>Toplam Prim</Text>
                        <Text style={[styles.totalSumVal, { color: serviceGreen }]}>+₺{fmtMoney(payroll.total_premiums)}</Text>
                    </View>
                </View>

                {/* ── Kesintiler ── */}
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                    <Text style={[styles.sectionTitle, { color: serviceRed }]}>Kesintiler (-)</Text>
                    {deductions.length === 0 ? (
                        <Text style={[styles.emptyLabel, { color: colors.textTertiary }]}>Herhangi bir kesinti bulunmuyor.</Text>
                    ) : (
                        deductions.map((item, idx) => (
                            <View key={item.id || idx} style={[styles.compItem, { borderBottomColor: border }]}>
                                <Text style={[styles.compName, { color: colors.text }]}>{item.name}</Text>
                                <Text style={[styles.compVal, { color: serviceRed }]}>-₺{fmtMoney(item.amount)}</Text>
                            </View>
                        ))
                    )}
                    <View style={[styles.totalSumRow, { borderTopColor: border }]}>
                        <Text style={[styles.totalSumLabel, { color: colors.textSecondary }]}>Toplam Kesinti</Text>
                        <Text style={[styles.totalSumVal, { color: serviceRed }]}>-₺{fmtMoney(payroll.total_deductions)}</Text>
                    </View>
                </View>

                {/* ── Aksiyon Butonları (Paylaşım ve Yönlendirmeler) ── */}
                <View style={styles.buttonRow}>
                    <Pressable
                        onPress={handlePdfShare}
                        disabled={pdfSharing}
                        style={({ pressed }) => [
                            styles.actionBtn,
                            { backgroundColor: colors.surface, borderColor: serviceBlue },
                            pressed && { opacity: 0.8 }
                        ]}
                    >
                        {pdfSharing ? (
                            <ActivityIndicator size="small" color={serviceBlue} />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="file-pdf-box" size={20} color={serviceBlue} style={{ marginRight: 6 }} />
                                <Text style={[styles.actionBtnText, { color: serviceBlue }]}>PDF Görüntüle</Text>
                            </>
                        )}
                    </Pressable>

                    {isAdmin && (
                        <Pressable
                            onPress={handleWhatsAppShare}
                            disabled={pdfSharing}
                            style={({ pressed }) => [
                                styles.actionBtn,
                                { backgroundColor: colors.surface, borderColor: '#16A34A' },
                                pressed && { opacity: 0.8 }
                            ]}
                        >
                            <MaterialCommunityIcons name="whatsapp" size={20} color="#16A34A" style={{ marginRight: 6 }} />
                            <Text style={[styles.actionBtnText, { color: '#16A34A' }]}>WhatsApp</Text>
                        </Pressable>
                    )}
                </View>

                {/* Admin Durum Yönetimi */}
                {isAdmin && (
                    <View style={[styles.statusManageBox, { backgroundColor: colors.surface, borderColor: border }]}>
                        <Text style={[styles.statusManageTitle, { color: colors.text }]}>Bordro Durumunu Yönet</Text>
                        <View style={styles.statusButtons}>
                            {payroll.status !== 'approved' && payroll.status !== 'paid' && (
                                <Pressable
                                    onPress={() => updatePayrollStatus('approved')}
                                    disabled={actionLoading}
                                    style={[styles.statusBtn, { backgroundColor: serviceOrange }]}
                                >
                                    <Text style={styles.statusBtnText}>Onayla (Bekleyen)</Text>
                                </Pressable>
                            )}

                            {payroll.status !== 'paid' && (
                                <Pressable
                                    onPress={() => updatePayrollStatus('paid')}
                                    disabled={actionLoading}
                                    style={[styles.statusBtn, { backgroundColor: serviceGreen }]}
                                >
                                    <Text style={styles.statusBtnText}>Ödendi İşaretle</Text>
                                </Pressable>
                            )}

                            {payroll.status !== 'cancelled' && (
                                <Pressable
                                    onPress={() => updatePayrollStatus('cancelled')}
                                    disabled={actionLoading}
                                    style={[styles.statusBtn, { backgroundColor: serviceRed }]}
                                >
                                    <Text style={styles.statusBtnText}>İptal Et</Text>
                                </Pressable>
                            )}

                            {payroll.status !== 'draft' && (
                                <Pressable
                                    onPress={() => updatePayrollStatus('draft')}
                                    disabled={actionLoading}
                                    style={[styles.statusBtn, { backgroundColor: '#6B7280' }]}
                                >
                                    <Text style={styles.statusBtnText}>Taslağa Al</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                )}

                {/* Admin Kayıt Silme Butonu */}
                {isAdmin && (
                    <Pressable
                        onPress={handleDelete}
                        disabled={actionLoading}
                        style={({ pressed }) => [
                            styles.deleteBtnFull,
                            { borderColor: serviceRed },
                            pressed && { opacity: 0.8 }
                        ]}
                    >
                        {actionLoading ? (
                            <ActivityIndicator size="small" color={serviceRed} />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="delete-outline" size={18} color={serviceRed} style={{ marginRight: 6 }} />
                                <Text style={styles.deleteBtnFullText}>Bordro Kaydını Kalıcı Olarak Sil</Text>
                            </>
                        )}
                    </Pressable>
                )}
            </ScrollView>
        </WrapperContainer>
    );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },

    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        gap: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 16, fontWeight: '800' },
    techName: { fontSize: 15, fontWeight: '700' },
    techSub: { fontSize: 11, marginTop: 2 },

    badge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 8, borderWidth: 1,
    },
    badgeDot: { width: 6, height: 6, borderRadius: 3 },
    badgeText: { fontSize: 10, fontWeight: '700' },

    divider: { height: StyleSheet.hairlineWidth },

    // Net maaş
    netSalaryContainer: { alignItems: 'center', paddingVertical: 10 },
    netTitle: { fontSize: 11, fontWeight: '600' },
    netAmount: { fontSize: 26, fontWeight: '900', marginTop: 4 },

    // Grid
    infoGrid: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
    infoLabel: { fontSize: 12, fontWeight: '600' },
    infoValue: { fontSize: 12, fontWeight: '700' },

    // Bölümler
    sectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
    emptyLabel: { fontSize: 11, textAlign: 'center', paddingVertical: 12 },
    compItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    compName: { fontSize: 12, fontWeight: '500' },
    compVal: { fontSize: 12, fontWeight: '700' },

    totalSumRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTopWidth: 1.5,
        marginTop: 4,
    },
    totalSumLabel: { fontSize: 12, fontWeight: '700' },
    totalSumVal: { fontSize: 12, fontWeight: '800' },

    // Butonlar
    buttonRow: { flexDirection: 'row', gap: 10 },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderRadius: 12,
        height: 46,
    },
    actionBtnText: { fontSize: 13, fontWeight: '700' },

    // Durum Yönetimi
    statusManageBox: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        gap: 12,
    },
    statusManageTitle: { fontSize: 13, fontWeight: '700' },
    statusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statusBtn: {
        flex: 1,
        minWidth: '45%',
        height: 38,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

    // Silme Butonu (Alt)
    deleteBtnFull: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderRadius: 12,
        height: 46,
        marginTop: 6,
    },
    deleteBtnFullText: {
        color: serviceRed,
        fontSize: 13,
        fontWeight: '700',
    },
});