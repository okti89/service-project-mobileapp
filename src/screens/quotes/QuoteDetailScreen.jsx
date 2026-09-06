import React, { useCallback, useMemo, useState } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import dayjs from 'dayjs';

import DateTimePickerSheet from '@/components/DateTimePickerSheet';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import quoteService from '@/services/quoteService';
import { getNativeShare } from '@/utils/nativeShare';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';

const money = (value) => `${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
const normalizePhone = (phone) => {
    let digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('0')) digits = `90${digits.slice(1)}`;
    if (!digits.startsWith('90') && digits.length === 10) digits = `90${digits}`;
    return digits;
};
const errorMessage = (error, fallback) => error?.response?.data?.detail || error?.message || fallback;

function ActionButton({ icon, label, color, onPress, disabled, loading, colors }) {
    return (
        <Pressable disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.actionButton, { borderColor: `${color}32`, backgroundColor: `${color}10`, opacity: disabled ? 0.4 : pressed ? 0.72 : 1 }]}>
            {loading ? <ActivityIndicator size="small" color={color} /> : <MaterialCommunityIcons name={icon} size={21} color={color} />}
            <Text style={[styles.actionLabel, { color }]} numberOfLines={1}>{label}</Text>
        </Pressable>
    );
}

export default function QuoteDetailScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { showToast } = useToast();
    const quoteId = route.params?.quoteId || route.params?.quote?.id;
    const [quote, setQuote] = useState(route.params?.quote || null);
    const [loading, setLoading] = useState(!route.params?.quote);
    const [busyAction, setBusyAction] = useState(null);
    const [convertVisible, setConvertVisible] = useState(false);
    const [dateVisible, setDateVisible] = useState(false);
    const [scheduledDate, setScheduledDate] = useState(dayjs().add(1, 'day').hour(10).minute(0).second(0).toDate());
    const [technicians, setTechnicians] = useState([]);
    const [technicianId, setTechnicianId] = useState(null);

    const loadQuote = useCallback(async () => {
        if (!quoteId) return;
        try {
            setQuote(await quoteService.get(quoteId));
        } catch (error) {
            showToast('error', 'Teklif yüklenemedi', errorMessage(error, 'Teklif bilgileri alınamadı.'));
        } finally {
            setLoading(false);
        }
    }, [quoteId, showToast]);

    useFocusEffect(useCallback(() => { loadQuote(); }, [loadQuote]));

    const status = useMemo(() => {
        if (quote?.converted_service) return { label: 'Servise dönüştürüldü', color: serviceGreen, icon: 'check-decagram' };
        if (quote?.sent_at) return { label: 'Gönderildi', color: serviceBlue, icon: 'send-check' };
        return { label: 'Gönderilmeye hazır', color: serviceOrange, icon: 'file-clock' };
    }, [quote]);

    const downloadAndShare = async (mode) => {
        setBusyAction(mode);
        try {
            const file = await quoteService.downloadPdf(quote);
            if (mode === 'whatsapp') {
                const phone = normalizePhone(quote?.customer_detail?.phone_number);
                if (!phone) throw new Error('Müşterinin telefon numarası bulunamadı.');
                const nativeShare = getNativeShare();
                if (nativeShare) {
                    const pdfBase64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
                    await nativeShare.shareSingle({
                        social: nativeShare.Social.WHATSAPP,
                        whatsAppNumber: phone,
                        url: `data:application/pdf;base64,${pdfBase64}`,
                        type: 'application/pdf',
                        filename: file.filename,
                        useInternalStorage: true,
                    });
                } else {
                    if (!(await Sharing.isAvailableAsync())) throw new Error('Bu cihazda paylaşım özelliği kullanılamıyor.');
                    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Teklifi WhatsApp ile paylaş', UTI: 'com.adobe.pdf' });
                }
            } else {
                if (!(await Sharing.isAvailableAsync())) throw new Error('Bu cihazda paylaşım özelliği kullanılamıyor.');
                await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Teklifi paylaş', UTI: 'com.adobe.pdf' });
            }
            await quoteService.markSent(quote.id);
            await loadQuote();
            showToast('success', 'PDF hazır', mode === 'whatsapp' ? 'Teklif WhatsApp paylaşımına aktarıldı.' : 'Teklif paylaşım menüsüne aktarıldı.');
        } catch (error) {
            if (!String(error?.message || '').toLowerCase().includes('cancel')) {
                showToast('error', 'PDF paylaşılamadı', errorMessage(error, 'Tekrar deneyin.'));
            }
        } finally {
            setBusyAction(null);
        }
    };

    const sendEmail = async () => {
        if (!quote?.customer_detail?.email) {
            showToast('warning', 'E-posta bulunamadı', 'Müşterinin kayıtlı e-posta adresi yok.');
            return;
        }
        setBusyAction('email');
        try {
            await quoteService.sendEmail(quote.id);
            await loadQuote();
            showToast('success', 'Teklif gönderildi', `${quote.customer_detail.email} adresine PDF eklendi.`);
        } catch (error) {
            showToast('error', 'E-posta gönderilemedi', errorMessage(error, 'E-posta ayarlarını kontrol edin.'));
        } finally {
            setBusyAction(null);
        }
    };

    const openConvert = async () => {
        setBusyAction('prepare-convert');
        try {
            const response = await api.get(ENDPOINTS.TECHNICIAN.LIST);
            setTechnicians(Array.isArray(response?.data) ? response.data : response?.data?.results || []);
            setConvertVisible(true);
        } catch (error) {
            showToast('error', 'Teknisyenler alınamadı', errorMessage(error, 'Servis dönüşümü hazırlanamadı.'));
        } finally {
            setBusyAction(null);
        }
    };

    const convertToService = async () => {
        setBusyAction('convert');
        try {
            const result = await quoteService.convertToService(quote.id, {
                scheduled_date: dayjs(scheduledDate).toISOString(),
                technician: technicianId || null,
            });
            setConvertVisible(false);
            await loadQuote();
            showToast('success', 'Servis oluşturuldu', result.receipt_number || 'Teklif servise dönüştürüldü.');
        } catch (error) {
            showToast('error', 'Dönüştürülemedi', errorMessage(error, 'Servis oluşturulamadı.'));
        } finally {
            setBusyAction(null);
        }
    };

    const remove = () => Alert.alert('Teklifi Sil', 'Bu teklif kalıcı olarak silinecek. Emin misiniz?', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Sil', style: 'destructive', onPress: async () => {
            try {
                await quoteService.remove(quote.id);
                showToast('success', 'Teklif silindi', 'Teklif kaydı kaldırıldı.');
                navigation.goBack();
            } catch (error) {
                showToast('error', 'Silinemedi', errorMessage(error, 'Teklif silinemedi.'));
            }
        } },
    ]);

    if (loading || !quote) return <View style={[styles.screen, styles.center, { backgroundColor: colors.backgroundSecondary }]}><ActivityIndicator size="large" color={serviceBlue} /></View>;

    const converted = Boolean(quote.converted_service);
    return (
        <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerButton}><MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} /></Pressable>
                <View style={styles.headerTitleWrap}><Text style={[styles.headerTitle, { color: colors.text }]}>{quote.quote_number}</Text><Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Teklif detayı</Text></View>
                <Pressable disabled={converted} onPress={() => navigation.navigate('AdminQuoteForm', { quoteId: quote.id, quote })} style={[styles.headerButton, { opacity: converted ? 0.35 : 1 }]}><MaterialCommunityIcons name="pencil-outline" size={22} color={serviceBlue} /></Pressable>
            </View>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
                <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.heroTop}><View style={[styles.heroIcon, { backgroundColor: `${status.color}14` }]}><MaterialCommunityIcons name={status.icon} size={26} color={status.color} /></View><View style={styles.heroTitle}><Text style={[styles.customerName, { color: colors.text }]}>{quote.customer_detail?.full_name || 'Müşteri'}</Text><Text style={[styles.customerMeta, { color: colors.textSecondary }]}>{quote.customer_detail?.phone_number || quote.customer_detail?.email || 'İletişim bilgisi yok'}</Text></View></View>
                    <View style={[styles.heroDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.heroBottom}><View style={[styles.statusBadge, { backgroundColor: `${status.color}14` }]}><Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text></View><Text style={[styles.grandTotal, { color: colors.text }]}>{money(quote.total_price)}</Text></View>
                </View>

                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PAYLAŞ VE GÖNDER</Text>
                <View style={styles.actionGrid}>
                    <ActionButton icon="whatsapp" label="WhatsApp" color={serviceGreen} onPress={() => downloadAndShare('whatsapp')} loading={busyAction === 'whatsapp'} disabled={Boolean(busyAction)} colors={colors} />
                    <ActionButton icon="share-variant-outline" label="Paylaş" color={serviceBlue} onPress={() => downloadAndShare('share')} loading={busyAction === 'share'} disabled={Boolean(busyAction)} colors={colors} />
                    <ActionButton icon="email-outline" label="E-posta" color={serviceOrange} onPress={sendEmail} loading={busyAction === 'email'} disabled={Boolean(busyAction)} colors={colors} />
                </View>

                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>TEKLİF KALEMLERİ</Text>
                <View style={[styles.itemsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {(quote.items || []).map((item, index) => (
                        <View key={item.id || index} style={[styles.itemRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                            <View style={styles.itemIndex}><Text style={styles.itemIndexText}>{index + 1}</Text></View>
                            <View style={styles.itemInfo}><Text style={[styles.itemName, { color: colors.text }]}>{item.name || 'Teklif kalemi'}</Text>{item.description ? <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>{item.description}</Text> : null}<Text style={[styles.itemCalculation, { color: colors.textTertiary }]}>{item.quantity} × {money(item.unit_price)}</Text></View>
                            <Text style={[styles.itemTotal, { color: colors.text }]}>{money(item.total_price)}</Text>
                        </View>
                    ))}
                    <View style={[styles.itemsTotal, { borderTopColor: colors.border }]}><Text style={[styles.itemsTotalLabel, { color: colors.textSecondary }]}>Genel Toplam</Text><Text style={[styles.itemsTotalValue, { color: serviceBlue }]}>{money(quote.total_price)}</Text></View>
                </View>

                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>BİLGİLER</Text>
                <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.infoRow}><Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Oluşturulma</Text><Text style={[styles.infoValue, { color: colors.text }]}>{dayjs(quote.created_at).format('DD.MM.YYYY HH:mm')}</Text></View>
                    <View style={styles.infoRow}><Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Geçerlilik</Text><Text style={[styles.infoValue, { color: colors.text }]}>{quote.valid_until ? dayjs(quote.valid_until).format('DD.MM.YYYY') : 'Belirtilmedi'}</Text></View>
                    <View style={styles.infoRow}><Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Oluşturan</Text><Text style={[styles.infoValue, { color: colors.text }]}>{quote.created_by_name || '-'}</Text></View>
                    {!!quote.note && <View style={[styles.noteBox, { backgroundColor: colors.backgroundSecondary }]}><Text style={[styles.noteLabel, { color: colors.textSecondary }]}>Not</Text><Text style={[styles.noteText, { color: colors.text }]}>{quote.note}</Text></View>}
                </View>

                {!converted ? <Pressable onPress={openConvert} disabled={Boolean(busyAction)} style={[styles.convertButton, { backgroundColor: serviceGreen }]}>{busyAction === 'prepare-convert' ? <ActivityIndicator size="small" color="#FFF" /> : <><MaterialCommunityIcons name="tools" size={21} color="#FFF" /><Text style={styles.convertText}>Servise Dönüştür</Text></>}</Pressable> : <View style={[styles.convertedBox, { borderColor: `${serviceGreen}35`, backgroundColor: `${serviceGreen}10` }]}><MaterialCommunityIcons name="check-circle-outline" size={22} color={serviceGreen} /><Text style={styles.convertedText}>Bu teklif servis kaydına dönüştürüldü.</Text></View>}
                {!converted && <Pressable onPress={remove} style={styles.deleteLink}><MaterialCommunityIcons name="trash-can-outline" size={18} color={serviceRed} /><Text style={styles.deleteText}>Teklifi Sil</Text></Pressable>}
            </ScrollView>

            <Modal visible={convertVisible} transparent animationType="slide" onRequestClose={() => setConvertVisible(false)}>
                <View style={styles.modalOverlay}><View style={[styles.convertModal, { backgroundColor: colors.surface }]}>
                    <View style={styles.modalHeader}><View><Text style={[styles.modalTitle, { color: colors.text }]}>Servise Dönüştür</Text><Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Randevu ve teknisyen seçimi</Text></View><Pressable onPress={() => setConvertVisible(false)}><MaterialCommunityIcons name="close" size={23} color={colors.text} /></Pressable></View>
                    <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Randevu Tarihi</Text>
                    <Pressable onPress={() => setDateVisible(true)} style={[styles.pickerButton, { borderColor: colors.border }]}><MaterialCommunityIcons name="calendar-clock" size={20} color={serviceBlue} /><Text style={[styles.pickerValue, { color: colors.text }]}>{dayjs(scheduledDate).format('DD.MM.YYYY HH:mm')}</Text><MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} /></Pressable>
                    <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Teknisyen (İsteğe Bağlı)</Text>
                    <ScrollView style={styles.technicianList} nestedScrollEnabled>
                        {[{ id: null, full_name: 'Atanmamış' }, ...technicians].map((technician) => { const active = String(technicianId || '') === String(technician.id || ''); return <Pressable key={technician.id || 'none'} onPress={() => setTechnicianId(technician.id || null)} style={[styles.technicianRow, { borderColor: active ? serviceBlue : colors.border, backgroundColor: active ? `${serviceBlue}10` : colors.surface }]}><MaterialCommunityIcons name={active ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={active ? serviceBlue : colors.textTertiary} /><Text style={[styles.technicianName, { color: colors.text }]}>{technician.full_name || technician.user?.full_name || technician.user?.email || 'Teknisyen'}</Text></Pressable>; })}
                    </ScrollView>
                    <Pressable onPress={convertToService} disabled={busyAction === 'convert'} style={[styles.modalConvertButton, { backgroundColor: serviceGreen }]}>{busyAction === 'convert' ? <ActivityIndicator size="small" color="#FFF" /> : <><MaterialCommunityIcons name="check" size={20} color="#FFF" /><Text style={styles.convertText}>Servisi Oluştur</Text></>}</Pressable>
                </View></View>
            </Modal>
            <DateTimePickerSheet visible={dateVisible} value={scheduledDate} onChange={setScheduledDate} onClose={() => setDateVisible(false)} />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 }, center: { alignItems: 'center', justifyContent: 'center' }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 10 }, headerButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }, headerTitleWrap: { flex: 1, alignItems: 'center' }, headerTitle: { fontSize: 18, fontWeight: '900' }, headerSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 2 }, content: { paddingHorizontal: 16, paddingTop: 6 },
    hero: { borderWidth: 1, borderRadius: 17, padding: 15, marginBottom: 20 }, heroTop: { flexDirection: 'row', alignItems: 'center', gap: 11 }, heroIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, heroTitle: { flex: 1, minWidth: 0 }, customerName: { fontSize: 17, fontWeight: '900' }, customerMeta: { fontSize: 12, fontWeight: '600', marginTop: 3 }, heroDivider: { height: StyleSheet.hairlineWidth, marginVertical: 13 }, heroBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, statusBadge: { borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 }, statusText: { fontSize: 11, fontWeight: '900' }, grandTotal: { fontSize: 21, fontWeight: '900' },
    sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }, actionGrid: { flexDirection: 'row', gap: 8, marginBottom: 20 }, actionButton: { flex: 1, height: 66, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 5 }, actionLabel: { fontSize: 11, fontWeight: '800' },
    itemsCard: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 20 }, itemRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }, itemIndex: { width: 28, height: 28, borderRadius: 8, backgroundColor: `${serviceBlue}14`, alignItems: 'center', justifyContent: 'center' }, itemIndexText: { color: serviceBlue, fontSize: 12, fontWeight: '900' }, itemInfo: { flex: 1, minWidth: 0 }, itemName: { fontSize: 14, fontWeight: '800' }, itemDescription: { fontSize: 11, marginTop: 2 }, itemCalculation: { fontSize: 10, fontWeight: '600', marginTop: 4 }, itemTotal: { fontSize: 13, fontWeight: '900' }, itemsTotal: { borderTopWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, itemsTotalLabel: { fontSize: 12, fontWeight: '800' }, itemsTotalValue: { fontSize: 18, fontWeight: '900' },
    infoCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16 }, infoRow: { minHeight: 32, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, infoLabel: { fontSize: 12, fontWeight: '600' }, infoValue: { fontSize: 12, fontWeight: '800', textAlign: 'right', flex: 1 }, noteBox: { borderRadius: 12, padding: 11, marginTop: 8 }, noteLabel: { fontSize: 10, fontWeight: '800', marginBottom: 5 }, noteText: { fontSize: 13, lineHeight: 19 },
    convertButton: { height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, convertText: { color: '#FFF', fontSize: 15, fontWeight: '900' }, convertedBox: { minHeight: 54, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 9 }, convertedText: { flex: 1, color: serviceGreen, fontSize: 13, fontWeight: '800' }, deleteLink: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, padding: 14, marginTop: 5 }, deleteText: { color: serviceRed, fontSize: 13, fontWeight: '800' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' }, convertModal: { maxHeight: '82%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 26 }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }, modalTitle: { fontSize: 18, fontWeight: '900' }, modalSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 3 }, pickerLabel: { fontSize: 11, fontWeight: '800', marginBottom: 7 }, pickerButton: { height: 50, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 15 }, pickerValue: { flex: 1, fontSize: 14, fontWeight: '700' }, technicianList: { maxHeight: 230, marginBottom: 15 }, technicianRow: { minHeight: 48, borderWidth: 1, borderRadius: 12, marginBottom: 7, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 9 }, technicianName: { flex: 1, fontSize: 13, fontWeight: '700' }, modalConvertButton: { height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
