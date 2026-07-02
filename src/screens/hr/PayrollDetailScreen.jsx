import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import CustomInput from '@/components/CustomInput';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import hrService from '@/services/hrService';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';

const {
    buildPayrollPdfFileName,
    buildPayrollPdfHtml,
    getTechnicianInitials,
    isExpoGoRuntime,
    technicianName,
} = require('./payrollUi');

const statusMeta = {
    draft: { label: 'Taslak', color: serviceOrange, bg: '#FFF4E5' },
    approved: { label: 'Onayli', color: serviceBlue, bg: '#EDF3FF' },
    paid: { label: 'Odendi', color: serviceGreen, bg: '#EAF9EF' },
    cancelled: { label: 'Iptal', color: serviceRed, bg: '#FDECEC' },
};

const money = (value) => Number(value || 0).toLocaleString('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
});

const formatDate = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const AmountCard = ({ label, value, accent, colors, icon }) => (
    <View style={[styles.amountCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={[styles.amountIcon, { backgroundColor: `${accent}14` }]}>
            <MaterialCommunityIcons name={icon} size={16} color={accent} />
        </View>
        <Text style={[styles.amountCardLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.amountCardValue, { color: colors.text }]}>{money(value)}</Text>
    </View>
);

const ComponentRow = ({ item, onDelete, canModify }) => {
    const { colors } = useTheme();
    const isAddition = item.type === 'addition';
    const accent = isAddition ? serviceGreen : serviceRed;

    return (
        <View style={[styles.componentRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.componentAccent, { backgroundColor: `${accent}15` }]}>
                <MaterialCommunityIcons name={isAddition ? 'plus' : 'minus'} size={18} color={accent} />
            </View>

            <View style={styles.componentText}>
                <Text style={[styles.componentName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.componentMeta, { color: colors.textSecondary }]}>
                    {isAddition ? 'Eklenti' : 'Kesinti'}{item.is_manual ? ' · Manuel' : ''}
                </Text>
            </View>

            <View style={styles.componentRight}>
                <Text style={[styles.componentAmount, { color: accent }]}>{isAddition ? '+' : '-'}{money(item.amount)}</Text>
                {canModify && (
                    <Pressable onPress={() => onDelete(item)} style={styles.deleteIconButton}>
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={serviceRed} />
                    </Pressable>
                )}
            </View>
        </View>
    );
};

const ActionButton = ({ label, icon, color, onPress, disabled }) => (
    <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[styles.actionButton, { backgroundColor: color, opacity: disabled ? 0.55 : 1 }]}
    >
        <MaterialCommunityIcons name={icon} size={18} color="#FFFFFF" />
        <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
);

export default function PayrollDetailScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { isAdmin } = useAuth();
    const payrollId = route?.params?.payrollId;

    const [payroll, setPayroll] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState('addition');
    const [compName, setCompName] = useState('');
    const [compAmount, setCompAmount] = useState('');
    const [addingComp, setAddingComp] = useState(false);
    const [sharingPdf, setSharingPdf] = useState(false);
    const [printingPdf, setPrintingPdf] = useState(false);
    const [companyConfig, setCompanyConfig] = useState(null);

    const loadPayroll = useCallback(async () => {
        if (!payrollId) return;
        setLoading(true);
        try {
            const data = await hrService.getPayroll(payrollId);
            setPayroll(data);
        } catch (error) {
            Alert.alert('Bordro alinamadi', error?.response?.data?.detail || 'Baglantinizi kontrol edip tekrar deneyin.');
        } finally {
            setLoading(false);
        }
    }, [payrollId]);

    useEffect(() => {
        loadPayroll();
    }, [loadPayroll]);

    useEffect(() => {
        let mounted = true;
        const loadCompanyConfig = async () => {
            try {
                const response = await api.get(ENDPOINTS.CONFIG.PUBLIC_COMPANY);
                if (mounted) setCompanyConfig(response?.data || null);
            } catch (error) {
                if (mounted) setCompanyConfig(null);
            }
        };

        loadCompanyConfig();
        return () => {
            mounted = false;
        };
    }, []);

    const components = Array.isArray(payroll?.components) ? payroll.components : [];
    const additions = useMemo(() => components.filter((item) => item.type === 'addition'), [components]);
    const deductions = useMemo(() => components.filter((item) => item.type === 'deduction'), [components]);
    const meta = statusMeta[payroll?.status] || statusMeta.draft;

    const runAction = async (action, successMessage) => {
        setSaving(true);
        try {
            const next = await action();
            if (next?.id) setPayroll(next);
            Alert.alert('Tamam', successMessage);
            await loadPayroll();
        } catch (error) {
            Alert.alert('Islem yapilamadi', error?.response?.data?.detail || 'Baglantinizi kontrol edip tekrar deneyin.');
        } finally {
            setSaving(false);
        }
    };

    const markPaid = () => runAction(() => hrService.markPayrollPaid(payrollId), 'Bordro odendi olarak isaretlendi.');
    const cancelPayment = () => runAction(() => hrService.cancelPayrollPayment(payrollId), 'Odeme iptal edildi.');
    const sendNotification = () => runAction(() => hrService.sendPayrollNotification(payrollId), 'Teknisyene bordro bildirimi gonderildi.');

    const createPayrollPdfFile = async () => {
        const html = buildPayrollPdfHtml(payroll, companyConfig);
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        const fileName = buildPayrollPdfFileName(payroll);
        const targetUri = `${FileSystem.cacheDirectory}${fileName}`;
        const existing = await FileSystem.getInfoAsync(targetUri);
        if (existing.exists) {
            await FileSystem.deleteAsync(targetUri, { idempotent: true });
        }
        await FileSystem.copyAsync({ from: uri, to: targetUri });
        return { fileName, uri: targetUri };
    };

    const handlePrintPayroll = async () => {
        if (!payroll) return;
        setPrintingPdf(true);
        try {
            await Print.printAsync({ html: buildPayrollPdfHtml(payroll, companyConfig) });
        } catch (error) {
            Alert.alert('Yazdirma basarisiz', error?.message || 'Bordro yazdirma ekrani acilamadi.');
        } finally {
            setPrintingPdf(false);
        }
    };

    const handleSharePayrollWhatsApp = async () => {
        if (!payroll) return;
        setSharingPdf(true);
        try {
            const { fileName, uri } = await createPayrollPdfFile();
            if (isExpoGoRuntime(Constants?.appOwnership)) {
                const available = await Sharing.isAvailableAsync();
                if (!available) {
                    Alert.alert('Paylasim kullanilamiyor', 'Bu cihazda dosya paylasimi desteklenmiyor.');
                    return;
                }

                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    UTI: 'com.adobe.pdf',
                    dialogTitle: 'Bordro PDF paylas',
                });
                return;
            }

            const ShareModule = require('react-native-share');
            const Share = ShareModule.default || ShareModule;
            await Share.shareSingle({
                social: Share.Social.WHATSAPP,
                type: 'application/pdf',
                url: uri,
                filename: fileName.replace(/\.pdf$/i, ''),
                message: `${technicianName(payroll)} bordro dokumu`,
                failOnCancel: false,
            });
        } catch (error) {
            const message = String(error?.message || '').toLowerCase();
            if (message.includes('cancel')) return;
            Alert.alert('WhatsApp paylasimi basarisiz', error?.message || 'WhatsApp yuklu olmayabilir veya dosya paylasilamadi.');
        } finally {
            setSharingPdf(false);
        }
    };

    const handleOpenAddModal = (type) => {
        setModalType(type);
        setCompName('');
        setCompAmount('');
        setModalVisible(true);
    };

    const handleCreateComponent = async () => {
        if (!compName.trim() || !compAmount.trim()) {
            Alert.alert('Hata', 'Lutfen tum alanlari doldurun.');
            return;
        }

        const parsedAmount = Number(compAmount.replace(',', '.'));
        if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
            Alert.alert('Hata', 'Lutfen gecerli bir tutar girin.');
            return;
        }

        setAddingComp(true);
        try {
            await hrService.createPayrollComponent({
                payroll: payrollId,
                name: compName.trim(),
                amount: parsedAmount.toFixed(2),
                type: modalType,
                is_manual: true,
            });
            setModalVisible(false);
            Alert.alert('Basarili', 'Bilesen basariyla eklendi.');
            await loadPayroll();
        } catch (error) {
            Alert.alert('Hata', error?.response?.data?.detail || 'Bilesen eklenirken bir hata olustu.');
        } finally {
            setAddingComp(false);
        }
    };

    const handleDeleteComponent = (item) => {
        Alert.alert(
            'Kalemi Sil',
            `"${item.name}" kalemini silmek istediginize emin misiniz?`,
            [
                { text: 'Vazgec', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await hrService.deletePayrollComponent(item.id);
                            Alert.alert('Basarili', 'Bilesen silindi.');
                            await loadPayroll();
                        } catch (error) {
                            Alert.alert('Hata', error?.response?.data?.detail || 'Bilesen silinirken bir hata olustu.');
                        }
                    },
                },
            ],
        );
    };

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 104 }]}>
                <View style={styles.header}>
                    <Pressable onPress={() => navigation.goBack()} style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
                    </Pressable>

                    <View style={styles.headerText}>
                        <Text style={[styles.title, { color: colors.text }]}>Bordro Detayi</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{payroll ? technicianName(payroll) : 'Yukleniyor'}</Text>
                    </View>

                    <Pressable onPress={loadPayroll} style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <MaterialCommunityIcons name="refresh" size={20} color={serviceBlue} />
                    </Pressable>
                </View>

                {loading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator color={serviceBlue} size="large" />
                    </View>
                ) : payroll ? (
                    <>
                        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={styles.summaryTop}>
                                <View style={[styles.avatarBadge, { backgroundColor: `${serviceBlue}14` }]}>
                                    <Text style={styles.avatarBadgeText}>{getTechnicianInitials(technicianName(payroll))}</Text>
                                </View>
                                <View style={styles.summaryTopText}>
                                    <Text style={[styles.summaryName, { color: colors.text }]}>{technicianName(payroll)}</Text>
                                    <Text style={[styles.summaryPeriod, { color: colors.textSecondary }]}>
                                        {formatDate(payroll.period_start)} - {formatDate(payroll.period_end)}
                                    </Text>
                                </View>
                                <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                                    <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                                </View>
                            </View>

                            <Text style={[styles.netLabel, { color: colors.textSecondary }]}>Net odeme</Text>
                            <Text style={[styles.netValue, { color: colors.text }]}>{money(payroll.net_salary)}</Text>
                        </View>

                        <View style={styles.amountGrid}>
                            <AmountCard label="Taban" value={payroll.base_salary} accent={serviceBlue} colors={colors} icon="wallet-outline" />
                            <AmountCard label="Prim" value={payroll.total_premiums} accent={serviceGreen} colors={colors} icon="trending-up" />
                            <AmountCard label="Kesinti" value={payroll.total_deductions} accent={serviceRed} colors={colors} icon="trending-down" />
                        </View>

                        {isAdmin && (
                            <View style={styles.actionsRow}>
                                <ActionButton
                                    label="Odendi"
                                    icon="cash-check"
                                    color={serviceGreen}
                                    onPress={markPaid}
                                    disabled={saving || payroll.status === 'paid'}
                                />
                                <ActionButton
                                    label="Iptal"
                                    icon="cash-remove"
                                    color={serviceRed}
                                    onPress={cancelPayment}
                                    disabled={saving || payroll.status !== 'paid'}
                                />
                                <ActionButton
                                    label="Bildir"
                                    icon="bell-ring-outline"
                                    color={serviceBlue}
                                    onPress={sendNotification}
                                    disabled={saving}
                                />
                            </View>
                        )}

                        <View style={styles.documentActionsRow}>
                            <Pressable
                                onPress={handleSharePayrollWhatsApp}
                                disabled={sharingPdf || printingPdf}
                                style={[styles.documentButton, { backgroundColor: '#25D366', opacity: sharingPdf || printingPdf ? 0.65 : 1 }]}
                            >
                                {sharingPdf ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <MaterialCommunityIcons name="whatsapp" size={18} color="#FFFFFF" />
                                )}
                                <Text style={styles.documentButtonText}>WhatsApp PDF</Text>
                            </Pressable>

                            <Pressable
                                onPress={handlePrintPayroll}
                                disabled={sharingPdf || printingPdf}
                                style={[styles.documentButton, { backgroundColor: serviceBlue, opacity: sharingPdf || printingPdf ? 0.65 : 1 }]}
                            >
                                {printingPdf ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <MaterialCommunityIcons name="printer-outline" size={18} color="#FFFFFF" />
                                )}
                                <Text style={styles.documentButtonText}>Yazdir</Text>
                            </Pressable>
                        </View>

                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Eklentiler</Text>
                            <View style={styles.sectionHeaderRight}>
                                <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>{additions.length} kayit</Text>
                                {isAdmin && payroll.status === 'draft' && (
                                    <Pressable onPress={() => handleOpenAddModal('addition')} style={styles.addIconButton}>
                                        <MaterialCommunityIcons name="plus-circle" size={20} color={serviceGreen} />
                                    </Pressable>
                                )}
                            </View>
                        </View>
                        {additions.length ? additions.map((item) => (
                            <ComponentRow
                                key={item.id}
                                item={item}
                                canModify={isAdmin && payroll.status === 'draft'}
                                onDelete={handleDeleteComponent}
                            />
                        )) : (
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Prim veya eklenti yok.</Text>
                        )}

                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Kesintiler</Text>
                            <View style={styles.sectionHeaderRight}>
                                <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>{deductions.length} kayit</Text>
                                {isAdmin && payroll.status === 'draft' && (
                                    <Pressable onPress={() => handleOpenAddModal('deduction')} style={styles.addIconButton}>
                                        <MaterialCommunityIcons name="plus-circle" size={20} color={serviceRed} />
                                    </Pressable>
                                )}
                            </View>
                        </View>
                        {deductions.length ? deductions.map((item) => (
                            <ComponentRow
                                key={item.id}
                                item={item}
                                canModify={isAdmin && payroll.status === 'draft'}
                                onDelete={handleDeleteComponent}
                            />
                        )) : (
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Kesinti yok.</Text>
                        )}
                    </>
                ) : null}
            </ScrollView>

            <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                            {modalType === 'addition' ? 'Yeni eklenti ekle' : 'Yeni kesinti ekle'}
                        </Text>

                        <CustomInput
                            label="Kalem adi"
                            placeholder={modalType === 'addition' ? 'Orn: Prim, Bonus' : 'Orn: Avans, Ceza'}
                            value={compName}
                            onChangeText={setCompName}
                            icon="format-title"
                        />

                        <CustomInput
                            label="Tutar (TL)"
                            placeholder="Orn: 1500"
                            value={compAmount}
                            onChangeText={setCompAmount}
                            keyboardType="decimal-pad"
                            icon="cash"
                            disableSmartFormat
                        />

                        <View style={styles.modalActions}>
                            <Pressable onPress={() => setModalVisible(false)} style={[styles.modalButton, { borderColor: colors.border }]}>
                                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Iptal</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleCreateComponent}
                                disabled={addingComp || !compName.trim() || !compAmount.trim()}
                                style={[
                                    styles.modalButton,
                                    {
                                        backgroundColor: modalType === 'addition' ? serviceGreen : serviceRed,
                                        borderColor: 'transparent',
                                        opacity: addingComp || !compName.trim() || !compAmount.trim() ? 0.6 : 1,
                                    },
                                ]}
                            >
                                {addingComp ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.modalSaveText}>Ekle</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    container: { paddingHorizontal: 16 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    headerText: { flex: 1, marginHorizontal: 12 },
    title: { fontSize: 24, fontWeight: '900' },
    subtitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
    loadingWrap: { paddingVertical: 80, alignItems: 'center' },
    summaryCard: { borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 12 },
    summaryTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    avatarBadge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    avatarBadgeText: { color: serviceBlue, fontSize: 16, fontWeight: '900' },
    summaryTopText: { flex: 1 },
    summaryName: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
    summaryPeriod: { fontSize: 12, fontWeight: '600' },
    statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    statusPillText: { fontSize: 11, fontWeight: '800' },
    netLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
    netValue: { fontSize: 30, fontWeight: '900' },
    amountGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    amountCard: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 12 },
    amountIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    amountCardLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
    amountCardValue: { fontSize: 14, fontWeight: '800' },
    actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    actionButton: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
    actionButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
    documentActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    documentButton: { flex: 1, minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
    documentButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 6 },
    sectionTitle: { fontSize: 16, fontWeight: '900' },
    sectionHeaderRight: { flexDirection: 'row', alignItems: 'center' },
    sectionCount: { fontSize: 12, fontWeight: '700' },
    addIconButton: { padding: 4, marginLeft: 6 },
    componentRow: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
    componentAccent: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    componentText: { flex: 1 },
    componentName: { fontSize: 14, fontWeight: '800' },
    componentMeta: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    componentRight: { flexDirection: 'row', alignItems: 'center' },
    componentAmount: { fontSize: 13, fontWeight: '900' },
    deleteIconButton: { padding: 4, marginLeft: 6 },
    emptyText: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.58)', justifyContent: 'center', padding: 20 },
    modalCard: { borderWidth: 1, borderRadius: 22, padding: 18 },
    modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 14 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    modalButton: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    modalCancelText: { fontSize: 14, fontWeight: '800' },
    modalSaveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
