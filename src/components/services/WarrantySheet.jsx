import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';

import serviceService from '@/services/serviceService';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';

const executionEnvironment = String(Constants?.executionEnvironment || '').toLowerCase();
const appOwnership = String(Constants?.appOwnership || '').toLowerCase();
const useNativeShare = !(executionEnvironment === 'storeclient' || appOwnership === 'expo');

let nativeShareLib = null;
if (useNativeShare) {
    try {
        // eslint-disable-next-line global-require, import/no-unresolved
        nativeShareLib = require('react-native-share').default || require('react-native-share');
    } catch (e) {
        nativeShareLib = null;
    }
}

const PERIOD_PRESETS = [
    { value: 3, label: '3 Ay' },
    { value: 6, label: '6 Ay' },
    { value: 12, label: '12 Ay' },
    { value: 24, label: '24 Ay' },
    { value: 36, label: '36 Ay' },
    { value: 48, label: '48 Ay' },
];

const STEP_PERIOD = 'period';
const STEP_ACTIONS = 'actions';

const WarrantySheet = forwardRef(({ service, onClose }, ref) => {
    const { colors, isDark } = useTheme();
    const sheetRef = useRef(null);
    const isOpen = useRef(false);

    const [step, setStep] = useState(STEP_PERIOD);
    const [selectedPeriod, setSelectedPeriod] = useState(service?.warranty_certificate?.warranty_months || 24);
    const [customPeriod, setCustomPeriod] = useState('');
    const [useCustom, setUseCustom] = useState(false);
    const [pdfUri, setPdfUri] = useState(null);
    const [pdfFilename, setPdfFilename] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [busyAction, setBusyAction] = useState(null);

    const cardBg = isDark ? colors.surface : '#FFFFFF';
    const rowBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15, 23, 42, 0.035)';
    const rowBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.05)';
    const secondaryText = isDark ? '#9BA2AF' : '#6B7280';
    const sectionLabel = isDark ? '#7A8290' : '#9CA3AF';

    useImperativeHandle(ref, () => ({
        present: () => sheetRef.current?.present(),
        dismiss: () => sheetRef.current?.dismiss(),
    }));

    useEffect(() => {
        const backAction = () => {
            if (isOpen.current) {
                sheetRef.current?.dismiss();
                return true;
            }
            return false;
        };
        const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => subscription.remove();
    }, []);

    const resetState = useCallback(() => {
        setStep(STEP_PERIOD);
        setSelectedPeriod(service?.warranty_certificate?.warranty_months || 24);
        setCustomPeriod('');
        setUseCustom(false);
        setPdfUri(null);
        setPdfFilename(null);
        setIsGenerating(false);
        setBusyAction(null);
    }, [service?.warranty_certificate?.warranty_months]);

    const handleClose = useCallback(() => {
        sheetRef.current?.dismiss();
    }, []);

    const onSheetChange = useCallback(
        (index) => {
            isOpen.current = index !== -1;
            if (index === -1) {
                resetState();
                onClose?.();
            }
        },
        [onClose, resetState],
    );

    const renderBackdrop = useCallback(
        (props) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                opacity={0.55}
                pressBehavior="close"
            />
        ),
        [],
    );

    const resolvedPeriod = useMemo(() => {
        if (useCustom) {
            const n = parseInt(customPeriod, 10);
            return Number.isFinite(n) && n > 0 ? n : 0;
        }
        return selectedPeriod;
    }, [useCustom, customPeriod, selectedPeriod]);

    const isPeriodValid = resolvedPeriod > 0;

    const customerPhone = useMemo(() => {
        const raw = service?.customer_phone || service?.customer?.phone_number || '';
        const digits = String(raw).replace(/\D/g, '');
        // TR: 5XXXXXXXXX -> 90XXXXXXXXXX
        if (digits.startsWith('90') && digits.length >= 12) return digits;
        if (digits.startsWith('0')) return `90${digits.slice(1)}`;
        if (digits.length === 10) return `90${digits}`;
        return digits;
    }, [service?.customer_phone, service?.customer?.phone_number]);

    const customerName = service?.customer_full_name || service?.customer?.full_name || 'Müşteri';
    const receiptNumber = service?.receipt_number || service?.id?.slice(0, 8) || '-';

    const generatePdf = useCallback(async () => {
        if (!service?.id || !isPeriodValid) return null;
        try {
            setIsGenerating(true);
            const { uri, filename } = await serviceService.downloadWarrantyCertificatePdf(service, resolvedPeriod);
            setPdfUri(uri);
            setPdfFilename(filename);
            return { uri, filename };
        } catch (err) {
            console.warn('Warranty generate error:', err?.response?.data || err?.message);
            Alert.alert('Hata', 'Garanti belgesi oluşturulamadı.');
            return null;
        } finally {
            setIsGenerating(false);
        }
    }, [service, resolvedPeriod, isPeriodValid]);

    const handleConfirmPeriod = useCallback(async () => {
        if (!isPeriodValid) {
            Alert.alert('Uyarı', 'Lütfen geçerli bir garanti süresi girin.');
            return;
        }
        const result = await generatePdf();
        if (result) {
            setStep(STEP_ACTIONS);
        }
    }, [generatePdf, isPeriodValid]);

    const handleViewPdf = useCallback(async () => {
        if (!pdfUri) return;
        try {
            setBusyAction('view');
            const supported = await Linking.canOpenURL(pdfUri);
            if (supported) {
                await Linking.openURL(pdfUri);
            } else {
                Alert.alert('Hata', 'Cihazınızda PDF görüntüleyici açılamadı.');
            }
        } catch (err) {
            console.warn('Open PDF error:', err);
            Alert.alert('Hata', 'PDF açılamadı.');
        } finally {
            setBusyAction(null);
        }
    }, [pdfUri]);

    const handleDownloadPdf = useCallback(async () => {
        if (!pdfUri || !pdfFilename) return;
        try {
            setBusyAction('download');
            const fileInfo = await FileSystem.getInfoAsync(pdfUri);
            if (!fileInfo.exists) {
                Alert.alert('Hata', 'Dosya bulunamadı.');
                return;
            }
            const documentDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
            const targetUri = `${documentDir}${pdfFilename}`;
            await FileSystem.copyAsync({ from: pdfUri, to: targetUri });
            Alert.alert(
                'İndirildi',
                `Garanti belgesi cihazınıza kaydedildi:\n${targetUri}`,
            );
        } catch (err) {
            console.warn('Download error:', err);
            Alert.alert('Hata', 'Dosya kaydedilemedi.');
        } finally {
            setBusyAction(null);
        }
    }, [pdfUri, pdfFilename]);

    const handleShareWhatsApp = useCallback(async () => {
        if (!pdfUri) {
            Alert.alert('Hata', 'Önce garanti belgesi oluşturulmalı.');
            return;
        }
        if (!customerPhone) {
            Alert.alert('Uyarı', 'Müşterinin telefon numarası bulunamadı.');
            return;
        }
        try {
            setBusyAction('whatsapp');
            const message = `Sayın ${customerName},\n\nServis #${receiptNumber} için garanti belgeniz hazır. Belgeyi ekte bilgilerinize sunar, iyi günler dileriz.`;
            const filename = pdfFilename || `Garanti_Belgesi_${receiptNumber}.pdf`;
            const fileUrl = Platform.OS === 'android' ? `file://${pdfUri}` : pdfUri;

            // Standalone build'de react-native-share ile WhatsApp'a doğrudan dosya ekli gönderim.
            // Expo Go (dev mod) ortamında native modül bulunmadığından expo-sharing fallback'i kullanılır.
            if (useNativeShare && nativeShareLib) {
                await nativeShareLib.open({
                    url: fileUrl,
                    type: 'application/pdf',
                    filename,
                    title: 'Garanti Belgesi Paylaş',
                    subject: 'Garanti Belgesi',
                    message,
                    social: nativeShareLib.Social?.WHATSAPP,
                    whatsappNumber: customerPhone,
                    failOnCancel: false,
                });
            } else {
                const available = await Sharing.isAvailableAsync();
                if (!available) {
                    Alert.alert(
                        'Expo Go Modu',
                        'Paylaşım bu cihazda kullanılamıyor. Standalone build sonrası dosya WhatsApp ile doğrudan gönderilebilir.',
                    );
                    return;
                }
                // WhatsApp'ı telefon numarası ile birlikte aç, kullanıcı PDF'i paylaşım menüsünden seçer.
                const waUrl = `https://wa.me/${customerPhone}?text=${encodeURIComponent(message)}`;
                await Linking.openURL(waUrl).catch(() => {});
                // Paylaşım sheet'ini aç ki kullanıcı PDF'i WhatsApp'a ekleyebilsin.
                try {
                    await Sharing.shareAsync(pdfUri, {
                        mimeType: 'application/pdf',
                        dialogTitle: 'Garanti Belgesi',
                        UTI: 'com.adobe.pdf',
                    });
                } catch (shareErr) {
                    if (
                        !shareErr?.message ||
                        !/cancel|user did not share|dismissed/i.test(shareErr.message)
                    ) {
                        console.warn('Expo sharing fallback error:', shareErr);
                    }
                }
            }
        } catch (err) {
            if (err?.message && !/cancel|user did not share/i.test(err.message)) {
                console.warn('WhatsApp share error:', err);
                Alert.alert('Hata', err?.message || 'WhatsApp ile paylaşılamadı.');
            }
        } finally {
            setBusyAction(null);
        }
    }, [pdfUri, pdfFilename, customerName, customerPhone, receiptNumber, useNativeShare, nativeShareLib]);

    const handleRegenerate = useCallback(async () => {
        setStep(STEP_PERIOD);
        setPdfUri(null);
        setPdfFilename(null);
    }, []);

    const snapPoints = useMemo(() => (step === STEP_PERIOD ? ['78%'] : ['82%']), [step]);

    return (
        <BottomSheetModal
            ref={sheetRef}
            index={0}
            snapPoints={snapPoints}
            backdropComponent={renderBackdrop}
            handleComponent={null}
            enablePanDownToClose
            backgroundStyle={{
                backgroundColor: cardBg,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
            }}
            onChange={onSheetChange}
        >
            <BottomSheetScrollView
                style={{ backgroundColor: cardBg }}
                contentContainerStyle={[
                    styles.container,
                    {
                        backgroundColor: cardBg,
                        borderTopLeftRadius: 28,
                        borderTopRightRadius: 28,
                    },
                ]}
                showsVerticalScrollIndicator={false}
            >
                <View
                    style={[
                        styles.handle,
                        {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.18)',
                        },
                    ]}
                />

                <View style={styles.headerRow}>
                    <View style={styles.headerIconWrap}>
                        <MaterialCommunityIcons name="shield-check-outline" size={22} color="#0EA5E9" />
                    </View>
                    <View style={styles.headerInfo}>
                        <Text style={[styles.title, { color: colors.text }]}>Garanti Belgesi</Text>
                        <Text style={[styles.subtitle, { color: secondaryText }]} numberOfLines={1}>
                            {`#${receiptNumber} · ${customerName}`}
                        </Text>
                    </View>
                    <Pressable
                        onPress={handleClose}
                        hitSlop={10}
                        style={({ pressed }) => [
                            styles.closeBtn,
                            {
                                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F4F9',
                                opacity: pressed ? 0.7 : 1,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
                    </Pressable>
                </View>

                {step === STEP_PERIOD ? (
                    <PeriodStep
                        colors={colors}
                        isDark={isDark}
                        sectionLabel={sectionLabel}
                        rowBg={rowBg}
                        rowBorder={rowBorder}
                        secondaryText={secondaryText}
                        presets={PERIOD_PRESETS}
                        selected={selectedPeriod}
                        useCustom={useCustom}
                        customPeriod={customPeriod}
                        onSelect={setSelectedPeriod}
                        onToggleCustom={setUseCustom}
                        onChangeCustom={setCustomPeriod}
                        isValid={isPeriodValid}
                        isLoading={isGenerating}
                        onCancel={handleClose}
                        onConfirm={handleConfirmPeriod}
                    />
                ) : (
                    <ActionsStep
                        colors={colors}
                        isDark={isDark}
                        sectionLabel={sectionLabel}
                        rowBg={rowBg}
                        rowBorder={rowBorder}
                        secondaryText={secondaryText}
                        customerName={customerName}
                        customerPhone={customerPhone}
                        receiptNumber={receiptNumber}
                        period={resolvedPeriod}
                        busyAction={busyAction}
                        onView={handleViewPdf}
                        onDownload={handleDownloadPdf}
                        onWhatsApp={handleShareWhatsApp}
                        onRegenerate={handleRegenerate}
                        onClose={handleClose}
                        useNativeShare={useNativeShare}
                    />
                )}

                <View style={{ height: spacing.l }} />
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
});

const PeriodStep = ({
    colors,
    isDark,
    sectionLabel,
    rowBg,
    rowBorder,
    secondaryText,
    presets,
    selected,
    useCustom,
    customPeriod,
    onSelect,
    onToggleCustom,
    onChangeCustom,
    isValid,
    isLoading,
    onCancel,
    onConfirm,
}) => {
    return (
        <>
            <Text style={[styles.sectionLabel, { color: sectionLabel }]}>GARANTİ SÜRESİ SEÇİMİ</Text>
            <View style={styles.periodGrid}>
                {presets.map((preset) => {
                    const isActive = !useCustom && selected === preset.value;
                    return (
                        <Pressable
                            key={preset.value}
                            onPress={() => {
                                onSelect(preset.value);
                                onToggleCustom(false);
                            }}
                            style={({ pressed }) => [
                                styles.periodChip,
                                {
                                    backgroundColor: isActive ? '#0EA5E915' : rowBg,
                                    borderColor: isActive ? '#0EA5E960' : rowBorder,
                                    opacity: pressed ? 0.85 : 1,
                                },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name={isActive ? 'shield-check' : 'shield-outline'}
                                size={18}
                                color={isActive ? '#0EA5E9' : secondaryText}
                            />
                            <Text
                                style={[
                                    styles.periodLabel,
                                    { color: isActive ? '#0EA5E9' : colors.text },
                                ]}
                            >
                                {preset.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            <Pressable
                onPress={() => onToggleCustom(!useCustom)}
                style={({ pressed }) => [
                    styles.customToggle,
                    {
                        backgroundColor: useCustom ? '#0EA5E915' : rowBg,
                        borderColor: useCustom ? '#0EA5E960' : rowBorder,
                        opacity: pressed ? 0.85 : 1,
                    },
                ]}
            >
                <MaterialCommunityIcons
                    name={useCustom ? 'pencil-box' : 'pencil-box-outline'}
                    size={18}
                    color={useCustom ? '#0EA5E9' : secondaryText}
                />
                <Text
                    style={[
                        styles.customToggleText,
                        { color: useCustom ? '#0EA5E9' : colors.text },
                    ]}
                >
                    Özel Süre Gir
                </Text>
            </Pressable>

            {useCustom ? (
                <View
                    style={[
                        styles.customInputWrap,
                        {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F5F7FA',
                            borderColor: useCustom ? '#0EA5E960' : rowBorder,
                        },
                    ]}
                >
                    <MaterialCommunityIcons name="calendar-range" size={18} color={secondaryText} />
                    <Text style={[styles.customInputPrefix, { color: secondaryText }]}>Ay</Text>
                    <View style={{ flex: 1 }} />
                    <View style={styles.customInputActions}>
                        <Pressable
                            onPress={() => {
                                const current = parseInt(customPeriod, 10) || 0;
                                const next = Math.max(1, current - 1);
                                onChangeCustom(String(next));
                            }}
                            style={({ pressed }) => [styles.stepBtn, { opacity: pressed ? 0.6 : 1 }]}
                        >
                            <MaterialCommunityIcons name="minus" size={16} color={colors.text} />
                        </Pressable>
                        <TextInput
                            value={customPeriod}
                            onChangeText={(v) => onChangeCustom(v.replace(/\D/g, '').slice(0, 3))}
                            keyboardType="number-pad"
                            placeholder="0"
                            placeholderTextColor={secondaryText}
                            style={[styles.customInput, { color: colors.text }]}
                            maxLength={3}
                        />
                        <Pressable
                            onPress={() => {
                                const current = parseInt(customPeriod, 10) || 0;
                                onChangeCustom(String(current + 1));
                            }}
                            style={({ pressed }) => [styles.stepBtn, { opacity: pressed ? 0.6 : 1 }]}
                        >
                            <MaterialCommunityIcons name="plus" size={16} color={colors.text} />
                        </Pressable>
                    </View>
                </View>
            ) : null}

            <View style={styles.actionRow}>
                <Pressable
                    onPress={onCancel}
                    disabled={isLoading}
                    style={({ pressed }) => [
                        styles.actionBtnSecondary,
                        {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F4F9',
                            opacity: pressed || isLoading ? 0.6 : 1,
                        },
                    ]}
                >
                    <Text style={[styles.actionBtnText, { color: colors.text }]}>Vazgeç</Text>
                </Pressable>
                <Pressable
                    onPress={onConfirm}
                    disabled={!isValid || isLoading}
                    style={({ pressed }) => [
                        styles.actionBtnPrimary,
                        {
                            backgroundColor: isValid ? '#0EA5E9' : secondaryText,
                            opacity: pressed ? 0.85 : 1,
                        },
                    ]}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <MaterialCommunityIcons name="file-pdf-box" size={18} color="#FFFFFF" />
                            <Text style={styles.actionBtnPrimaryText}>Belgeyi Oluştur</Text>
                        </>
                    )}
                </Pressable>
            </View>
        </>
    );
};

const ActionsStep = ({
    colors,
    isDark,
    sectionLabel,
    rowBg,
    rowBorder,
    secondaryText,
    customerName,
    customerPhone,
    receiptNumber,
    period,
    busyAction,
    onView,
    onDownload,
    onWhatsApp,
    onRegenerate,
    onClose,
    useNativeShare,
}) => {
    const hasPhone = Boolean(customerPhone);
    return (
        <>
            <View
                style={[
                    styles.summaryCard,
                    {
                        backgroundColor: isDark ? 'rgba(14, 165, 233, 0.12)' : '#E0F2FE',
                        borderColor: isDark ? 'rgba(14, 165, 233, 0.30)' : '#BAE6FD',
                    },
                ]}
            >
                <MaterialCommunityIcons name="information-outline" size={18} color="#0EA5E9" />
                <View style={{ flex: 1 }}>
                    <Text style={[styles.summaryTitle, { color: colors.text }]}>
                        {`Garanti süresi: ${period} ay`}
                    </Text>
                    <Text style={[styles.summarySub, { color: secondaryText }]} numberOfLines={1}>
                        {`#${receiptNumber} · ${customerName}`}
                    </Text>
                </View>
            </View>

            {!useNativeShare ? (
                <View
                    style={[
                        styles.devBanner,
                        {
                            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7',
                            borderColor: isDark ? 'rgba(245, 158, 11, 0.30)' : '#FDE68A',
                        },
                    ]}
                >
                    <MaterialCommunityIcons name="cellphone-link-off" size={16} color="#D97706" />
                    <Text style={[styles.devBannerText, { color: colors.text }]}>
                        Expo Go (dev mod): WhatsApp'a dosya otomatik eklenmez, paylaşım menüsünden
                        ekleyerek gönderirsiniz. Standalone build'de otomatik eklidir.
                    </Text>
                </View>
            ) : null}

            <Text style={[styles.sectionLabel, { color: sectionLabel, marginTop: spacing.m }]}>
                BELGE İŞLEMLERİ
            </Text>

            <View style={styles.list}>
                <ActionButton
                    icon="eye-outline"
                    color="#0EA5E9"
                    label="Görüntüle"
                    description="PDF'i cihazda aç, indirmeden bak"
                    rowBg={rowBg}
                    rowBorder={rowBorder}
                    colors={colors}
                    secondaryText={secondaryText}
                    onPress={onView}
                    isLoading={busyAction === 'view'}
                />
                <ActionButton
                    icon="download-outline"
                    color="#10B981"
                    label="İndir"
                    description="Cihazın dosya alanına kaydet"
                    rowBg={rowBg}
                    rowBorder={rowBorder}
                    colors={colors}
                    secondaryText={secondaryText}
                    onPress={onDownload}
                    isLoading={busyAction === 'download'}
                />
                <ActionButton
                    icon="whatsapp"
                    color="#25D366"
                    label="WhatsApp ile Gönder"
                    description={
                        hasPhone
                            ? `Müşteriye (${customerPhone}) dosya ekli gönder`
                            : 'Müşteri telefonu bulunamadı'
                    }
                    rowBg={rowBg}
                    rowBorder={rowBorder}
                    colors={colors}
                    secondaryText={secondaryText}
                    onPress={onWhatsApp}
                    isLoading={busyAction === 'whatsapp'}
                    disabled={!hasPhone}
                />
            </View>

            <View style={styles.actionRow}>
                <Pressable
                    onPress={onRegenerate}
                    style={({ pressed }) => [
                        styles.actionBtnSecondary,
                        {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F4F9',
                            opacity: pressed ? 0.7 : 1,
                        },
                    ]}
                >
                    <MaterialCommunityIcons name="refresh" size={16} color={colors.text} />
                    <Text style={[styles.actionBtnText, { color: colors.text }]}>Süreyi Değiştir</Text>
                </Pressable>
                <Pressable
                    onPress={onClose}
                    style={({ pressed }) => [
                        styles.actionBtnSecondary,
                        {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F4F9',
                            opacity: pressed ? 0.7 : 1,
                        },
                    ]}
                >
                    <Text style={[styles.actionBtnText, { color: colors.text }]}>Kapat</Text>
                </Pressable>
            </View>
        </>
    );
};

const ActionButton = ({
    icon,
    color,
    label,
    description,
    rowBg,
    rowBorder,
    colors,
    secondaryText,
    onPress,
    isLoading,
    disabled,
}) => (
    <Pressable
        onPress={onPress}
        disabled={disabled || isLoading}
        style={({ pressed }) => [
            styles.actionRowItem,
            {
                backgroundColor: rowBg,
                borderColor: rowBorder,
                opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
            },
        ]}
    >
        <View style={[styles.actionIconWrap, { backgroundColor: `${color}1F` }]}>
            {isLoading ? (
                <ActivityIndicator size="small" color={color} />
            ) : (
                <MaterialCommunityIcons name={icon} size={20} color={color} />
            )}
        </View>
        <View style={styles.actionTextCol}>
            <Text style={[styles.actionLabel, { color: colors.text }]} numberOfLines={1}>
                {label}
            </Text>
            {description ? (
                <Text style={[styles.actionDesc, { color: secondaryText }]} numberOfLines={2}>
                    {description}
                </Text>
            ) : null}
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={secondaryText} />
    </Pressable>
);

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.s,
        paddingBottom: spacing.l,
    },
    handle: {
        width: 44,
        height: 5,
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: spacing.m,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: spacing.m,
    },
    headerIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0EA5E915',
    },
    headerInfo: { flex: 1 },
    title: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
    subtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginBottom: spacing.s,
        marginTop: spacing.xs,
    },
    periodGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    periodChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        flexBasis: '31%',
        flexGrow: 1,
    },
    periodLabel: { fontSize: 13, fontWeight: '800' },
    customToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: spacing.s,
    },
    customToggleText: { fontSize: 13, fontWeight: '800' },
    customInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: spacing.s,
    },
    customInputPrefix: { fontSize: 12, fontWeight: '700' },
    customInputActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    stepBtn: {
        width: 30,
        height: 30,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.06)',
    },
    customInput: {
        minWidth: 40,
        fontSize: 18,
        fontWeight: '900',
        textAlign: 'center',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: spacing.l,
    },
    actionBtnSecondary: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        borderRadius: 14,
    },
    actionBtnText: { fontSize: 14, fontWeight: '800' },
    actionBtnPrimary: {
        flex: 1.4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 14,
    },
    actionBtnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    summaryTitle: { fontSize: 14, fontWeight: '800' },
    summarySub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
    devBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: spacing.s,
    },
    devBannerText: { fontSize: 11, fontWeight: '600', lineHeight: 16, flex: 1 },
    list: { gap: 8 },
    actionRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
    },
    actionIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionTextCol: { flex: 1, minWidth: 0 },
    actionLabel: { fontSize: 14, fontWeight: '800' },
    actionDesc: { fontSize: 12, fontWeight: '500', marginTop: 2 },
});

export default WarrantySheet;
