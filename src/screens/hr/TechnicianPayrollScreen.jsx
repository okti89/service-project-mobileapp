import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import { serviceBlue, serviceGreen, serviceRed } from '@/theme/color';

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const fmtMoney = (value) => {
    const amount = Number(value || 0);
    return Number.isFinite(amount)
        ? amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0,00';
};

const getMonthKey = (dateLike) => {
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthLabel = (dateLike) => {
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return '-';
    return `${MONTHS_TR[date.getMonth()]} ${date.getFullYear()}`;
};

const getPeriodLabel = (start, end) => {
    const formatShort = (value) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return `${String(date.getDate()).padStart(2, '0')} ${MONTHS_TR[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
    };

    return `${formatShort(start)} - ${formatShort(end || start)}`;
};

const getInitials = (fullName) => {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'MB';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};



export default function TechnicianPayrollScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { showToast } = useToast();
    const { userInfo, isAdmin } = useAuth();
    const { unreadCount = 0 } = useNotifications() || {};

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [sharingId, setSharingId] = useState(null);
    const [payrolls, setPayrolls] = useState([]);
    const selfTechnicianId = userInfo?.technician_profile_id || null;
    const useAdminSelfPayroll = Boolean(isAdmin && selfTechnicianId);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    const fetchPayrolls = useCallback(async () => {
        try {
            const response = useAdminSelfPayroll
                ? await api.get(ENDPOINTS.HR.PAYROLLS, { params: { technician: selfTechnicianId } })
                : await api.get(ENDPOINTS.HR.MY_PAYROLLS);
            const rows = Array.isArray(response?.data) ? response.data : (response?.data?.results || []);
            rows.sort((a, b) => new Date(b?.period_start || 0) - new Date(a?.period_start || 0));
            setPayrolls(rows);
        } catch (error) {
            console.log('Technician payroll fetch error:', error?.response?.data || error?.message || error);
            showToast('error', 'Hata', 'Bordro listesi yüklenemedi.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selfTechnicianId, showToast, useAdminSelfPayroll]);

    useEffect(() => {
        setLoading(true);
        fetchPayrolls();
    }, [fetchPayrolls]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchPayrolls();
    }, [fetchPayrolls]);

    const handlePdf = useCallback(async (payroll) => {
        if (!payroll || sharingId === payroll.id) return;
        setSharingId(payroll.id);
        try {
            const endpoint = useAdminSelfPayroll
                ? ENDPOINTS.HR.PAYROLL_PDF(payroll.id)
                : ENDPOINTS.HR.MY_PAYROLL_PDF(payroll.id);
            const baseUrl = (api.defaults.baseURL || '').replace(/\/$/, '');
            const fullUrl = `${baseUrl}/${endpoint.replace(/^\//, '')}`;
            const token = await AsyncStorage.getItem('auth_token');
            const tenantCode = await AsyncStorage.getItem('tenant_code');
            const tmpPath = `${FileSystem.cacheDirectory}bordro_${payroll.id}.pdf`;

            const download = await FileSystem.downloadAsync(fullUrl, tmpPath, {
                headers: {
                    Authorization: token ? `Token ${token}` : '',
                    'X-Tenant-Code': tenantCode || '',
                },
            });

            if (download.status !== 200) {
                throw new Error('PDF indirilemedi.');
            }

            if (Platform.OS === 'android') {
                const contentUri = await FileSystem.getContentUriAsync(download.uri);
                await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                    data: contentUri,
                    flags: 1,
                    type: 'application/pdf',
                });
            } else {
                await Sharing.shareAsync(download.uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `Bordro - ${getMonthLabel(payroll.period_start)}`,
                    UTI: 'com.adobe.pdf',
                });
            }
        } catch (error) {
            console.log('Technician payroll pdf error:', error?.message || error);
            showToast('error', 'Hata', 'PDF dosyası açılamadı.');
        } finally {
            setSharingId(null);
        }
    }, [sharingId, showToast, useAdminSelfPayroll]);

    const monthDisplay = useMemo(() => {
        const [year, month] = currentMonth.split('-').map(Number);
        return `${MONTHS_TR[month - 1]} ${year}`;
    }, [currentMonth]);

    const activePayroll = useMemo(
        () => payrolls.find((item) => getMonthKey(item.period_start) === currentMonth) || null,
        [currentMonth, payrolls],
    );

    const metrics = useMemo(() => {
        if (!activePayroll) {
            return { base: 0, bonus: 0, deductions: 0, net: 0 };
        }

        return {
            base: Number(activePayroll.base_salary || 0),
            bonus: Number(activePayroll.total_premiums || 0),
            deductions: Number(activePayroll.total_deductions || 0),
            net: Number(activePayroll.net_salary || 0),
        };
    }, [activePayroll]);


    const shiftMonth = (direction) => {
        setCurrentMonth((prev) => {
            const [year, month] = prev.split('-').map(Number);
            const next = new Date(year, month - 1 + direction, 1);
            return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
        });
    };

    const fullName = userInfo?.full_name
        || [userInfo?.first_name, userInfo?.last_name].filter(Boolean).join(' ')
        || userInfo?.email
        || 'Teknisyen';
    const roleLabel = userInfo?.user_type_display || 'Teknik Servis Uzmanı';
    const avatarUri = resolveMediaUrl(userInfo?.avatar);
    const statusLabel = userInfo?.is_active === false ? 'Pasif Çalışan' : 'Aktif Çalışan';
    const statusColor = userInfo?.is_active === false ? serviceRed : serviceGreen;

    return (
        <WrapperContainer bg={colors.background} edges={NO_BOTTOM_EDGES}>
            <Header
                title="Maaş Bordro"
                subtitle="Aylık bordro ve ödeme detaylarınız"
                showBack
                borderBottom
                rightActions={[
                    {
                        icon: 'bell-outline',
                        onPress: () => navigation.navigate('Notifications'),
                        badge: unreadCount,
                        accessibilityLabel: 'Bildirimler',
                    },
                ]}
            />

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                        <View style={styles.heroTop}> 
                            <View style={styles.identityRow}> 
                                {avatarUri ? (
                                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                                ) : (
                                    <View style={[styles.avatarFallback, { backgroundColor: `${serviceBlue}12` }]}>
                                        <Text style={[styles.avatarFallbackText, { color: serviceBlue }]}>{getInitials(fullName)}</Text>
                                    </View>
                                )}
                                <View style={styles.identityCopy}> 
                                    <Text style={[styles.name, { color: colors.text }]}>{fullName}</Text>
                                    <Text style={[styles.role, { color: colors.textSecondary }]}>{roleLabel}</Text>
                                    <View style={styles.statusRow}> 
                                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                                        <Text style={[styles.statusText, { color: colors.textSecondary }]}>{statusLabel}</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={[styles.monthPill, { backgroundColor: colors.backgroundSecondary }]}> 
                                <MaterialCommunityIcons name="calendar-month-outline" size={18} color={serviceBlue} />
                                <Text style={[styles.monthPillText, { color: serviceBlue }]}>{monthDisplay}</Text>
                            </View>
                        </View>

                        <View style={styles.monthNav}> 
                            <Pressable onPress={() => shiftMonth(-1)} style={[styles.monthArrow, { backgroundColor: colors.backgroundSecondary }]}>
                                <MaterialCommunityIcons name="chevron-left" size={18} color={colors.text} />
                            </Pressable>
                            <Pressable onPress={() => shiftMonth(1)} style={[styles.monthArrow, { backgroundColor: colors.backgroundSecondary }]}>
                                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.text} />
                            </Pressable>
                        </View>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        {activePayroll ? (
                            <>
                                <View style={styles.netRow}> 
                                    <View>
                                        <Text style={[styles.netLabel, { color: colors.textSecondary }]}>Net Ödeme</Text>
                                        <Text style={[styles.netValue, { color: colors.text }]}>₺{fmtMoney(metrics.net)}</Text>
                                    </View>
                                    <Pressable
                                        onPress={() => handlePdf(activePayroll)}
                                        disabled={sharingId === activePayroll.id}
                                        style={({ pressed }) => [styles.downloadButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary, opacity: pressed || sharingId === activePayroll.id ? 0.75 : 1 }]}
                                    >
                                        {sharingId === activePayroll.id ? (
                                            <ActivityIndicator size="small" color={serviceBlue} />
                                        ) : (
                                            <>
                                                <MaterialCommunityIcons name="eye-outline" size={18} color={serviceBlue} />
                                                <Text style={[styles.downloadText, { color: serviceBlue }]}>PDF Görüntüle</Text>
                                            </>
                                        )}
                                    </Pressable>
                                </View>

                                <View style={styles.inlineStats}>
                                    <View style={styles.inlineStat}><Text style={[styles.inlineLabel, { color: colors.textSecondary }]}>Prim / Bonus</Text><Text style={[styles.inlineGreen, { color: serviceGreen }]}>₺{fmtMoney(metrics.bonus)}</Text></View>
                                    <View style={[styles.inlineDivider, { backgroundColor: colors.border }]} />
                                    <View style={styles.inlineStat}><Text style={[styles.inlineLabel, { color: colors.textSecondary }]}>Kesintiler</Text><Text style={[styles.inlineRed, { color: serviceRed }]}>₺{fmtMoney(metrics.deductions)}</Text></View>
                                </View>
                                <Pressable
                                    onPress={() => navigation.navigate('TechnicianPayrollDetail', { payrollId: activePayroll.id, onRefresh: fetchPayrolls })}
                                    style={({ pressed }) => [styles.detailButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.76 : 1 }]}
                                >
                                    <MaterialCommunityIcons name="file-document-outline" size={18} color={serviceBlue} />
                                    <Text style={[styles.detailButtonText, { color: serviceBlue }]}>Bordro Detayını Görüntüle</Text>
                                    <MaterialCommunityIcons name="chevron-right" size={18} color={serviceBlue} />
                                </Pressable>
                            </>
                        ) : (
                            <View style={styles.emptyCurrent}> 
                                <Text style={[styles.emptyCurrentTitle, { color: colors.text }]}>Bu ay için bordro kaydı bulunamadı</Text>
                                <Text style={[styles.emptyCurrentText, { color: colors.textSecondary }]}>Ay filtresi açık. Önceki veya sonraki aylara geçerek kayıtları inceleyebilirsiniz.</Text>
                            </View>
                        )}
                    </View>

                    {activePayroll ? (
                        <View style={styles.metricGrid}> 
                            {[
                                { key: 'Temel Maaş', icon: 'wallet-outline', color: serviceBlue, bg: '#EFF6FF', value: metrics.base },
                                { key: 'Prim / Bonus', icon: 'star-outline', color: '#F59E0B', bg: '#FFF7ED', value: metrics.bonus },
                                { key: 'Kesinti', icon: 'arrow-down-circle-outline', color: serviceRed, bg: '#FEF2F2', value: metrics.deductions },
                                { key: 'Net Ödeme', icon: 'file-document-outline', color: '#8B5CF6', bg: '#F5F3FF', value: metrics.net },
                            ].map((item) => (
                                <View key={item.key} style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                    <View style={[styles.metricIcon, { backgroundColor: item.bg }]}><MaterialCommunityIcons name={item.icon} size={16} color={item.color} /></View>
                                    <View style={styles.metricCopy}>
                                        <Text style={[styles.metricLabel, { color: colors.textSecondary }]} numberOfLines={1}>{item.key}</Text>
                                        <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>₺{fmtMoney(item.value)}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : null}
                </ScrollView>
            )}
        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
    heroCard: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 12, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    identityRow: { flexDirection: 'row', flex: 1, gap: 12 },
    avatar: { width: 52, height: 52, borderRadius: 26 },
    avatarFallback: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    avatarFallbackText: { fontSize: 22, fontWeight: '800' },
    identityCopy: { flex: 1, gap: 4, justifyContent: 'center' },
    name: { fontSize: 17, fontWeight: '800' },
    role: { fontSize: 12, fontWeight: '500' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusText: { fontSize: 12, fontWeight: '600' },
    monthPill: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
    monthPillText: { fontSize: 12, fontWeight: '700' },
    monthNav: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    monthArrow: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    divider: { height: StyleSheet.hairlineWidth },
    netRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    netLabel: { fontSize: 13, fontWeight: '500' },
    netValue: { fontSize: 24, fontWeight: '900' },
    downloadButton: { minWidth: 112, height: 42, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
    downloadText: { fontSize: 14, fontWeight: '700' },
    inlineStats: { flexDirection: 'row', alignItems: 'stretch', marginTop: 2 },
    inlineStat: { flex: 1, alignItems: 'center', gap: 6 },
    inlineLabel: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
    inlineGreen: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
    inlineRed: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
    inlineDivider: { width: 1, marginHorizontal: 8 },
    detailButton: { height: 46, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2 },
    detailButtonText: { fontSize: 13, fontWeight: '700' },
    emptyCurrent: { gap: 6, paddingVertical: 4 },
    emptyCurrentTitle: { fontSize: 15, fontWeight: '700' },
    emptyCurrentText: { fontSize: 13, lineHeight: 18 },
    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    metricCard: { width: '48.5%', minHeight: 78, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, gap: 9 },
    metricIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    metricCopy: { flex: 1, gap: 2 },
    metricLabel: { fontSize: 11, fontWeight: '600' },
    metricValue: { fontSize: 13, fontWeight: '800' },
});