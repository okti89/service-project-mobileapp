import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import {
    Alert,
    BackHandler,
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const openMaps = (address) => {
    if (!address) return;
    const encoded = encodeURIComponent(address);
    const url = Platform.select({
        ios: `maps:0,0?q=${encoded}`,
        android: `geo:0,0?q=${encoded}`,
        default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    });
    Linking.openURL(url).catch(() => {
        Alert.alert('Hata', 'Harita uygulaması açılamadı.');
    });
};

const openWhatsApp = (phone) => {
    if (!phone) {
        Alert.alert('Hata', 'Telefon numarası bulunamadı.');
        return;
    }
    const cleaned = String(phone).replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${cleaned}`).catch(() => {
        Alert.alert('Hata', 'WhatsApp açılamadı.');
    });
};

const callPhone = (phone) => {
    if (!phone) {
        Alert.alert('Hata', 'Telefon numarası bulunamadı.');
        return;
    }
    const cleaned = String(phone).replace(/\D/g, '');
    Linking.openURL(`tel:${cleaned}`).catch(() => {
        Alert.alert('Hata', 'Arama başlatılamadı.');
    });
};

const sendSms = (phone) => {
    if (!phone) {
        Alert.alert('Hata', 'Telefon numarası bulunamadı.');
        return;
    }
    const cleaned = String(phone).replace(/\D/g, '');
    Linking.openURL(`sms:${cleaned}`).catch(() => {
        Alert.alert('Hata', 'SMS uygulaması açılamadı.');
    });
};

const PRIMARY_ACTIONS = [
    { key: 'detail', icon: 'arrow-right-bold-circle-outline', color: '#5C6370', label: 'Servis Detayı', description: 'Tüm bilgileri görüntüle' },
    { key: 'status', icon: 'sync', color: '#2196F3', label: 'Durumu Güncelle', description: 'Servis durumunu değiştir' },
    { key: 'pdf', icon: 'file-pdf-box', color: '#E53935', label: 'PDF Oluştur', description: 'Servis raporunu paylaş' },
    { key: 'warranty-pdf', icon: 'shield-check-outline', color: '#0EA5E9', label: 'Garanti Belgesi', description: 'Süre seç, görüntüle veya paylaş' },
];

const QUICK_ACTIONS = [
    { key: 'whatsapp', icon: 'whatsapp', color: '#25D366', label: 'WhatsApp Mesajı' },
    { key: 'sms', icon: 'message-text-outline', color: '#3B82F6', label: 'SMS Gönder' },
    { key: 'call', icon: 'phone-outline', color: '#34C759', label: 'Müşteriyi Ara' },
    { key: 'maps', icon: 'map-marker-radius-outline', color: '#FF8C00', label: 'Adresi Haritada Aç' },
];

const ServiceActionsSheet = forwardRef(({ service, onAction }, ref) => {
    const { colors, isDark } = useTheme();
    const sheetRef = useRef(null);
    const isOpen = useRef(false);

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

    const snapPoints = useMemo(() => ['89%'], []);
    const statusColor = useMemo(() => service?.status_color || colors.primary, [service?.status_color, colors.primary]);
    const statusName = useMemo(() => service?.status_name || service?.service_status || 'Bilinmiyor', [service?.status_name, service?.service_status]);
    const scheduled = useMemo(() => (service?.scheduled_date ? dayjs(service.scheduled_date) : null), [service?.scheduled_date]);
    const timeLabel = scheduled ? scheduled.format('HH:mm') : '--:--';
    const dateLabel = scheduled ? scheduled.format('DD MMMM YYYY') : '—';

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
        []
    );

    const handleAction = useCallback(
        (key) => {
            switch (key) {
                case 'whatsapp':
                    openWhatsApp(service?.customer_phone);
                    break;
                case 'sms':
                    sendSms(service?.customer_phone);
                    break;
                case 'call':
                    callPhone(service?.customer_phone);
                    break;
                case 'maps':
                    openMaps(service?.customer_address);
                    break;
                default:
                    onAction?.(key, service);
                    break;
            }
            sheetRef.current?.dismiss();
        },
        [service, onAction]
    );

    const cardBg = isDark ? colors.surface : '#FFFFFF';
    const rowBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15, 23, 42, 0.035)';
    const rowBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.05)';
    const secondaryText = isDark ? '#9BA2AF' : '#6B7280';
    const sectionLabel = isDark ? '#7A8290' : '#9CA3AF';

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
            onChange={(index) => {
                isOpen.current = index !== -1;
            }}
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
                    <View style={styles.headerInfo}>
                        <Text style={[styles.customerName, { color: colors.text }]} numberOfLines={1}>
                            {service?.customer_full_name || 'Müşteri'}
                        </Text>
                        <View style={styles.headerMeta}>
                            <MaterialCommunityIcons name="calendar-clock-outline" size={12} color={secondaryText} />
                            <Text style={[styles.headerMetaText, { color: secondaryText }]}>
                                {dateLabel} · {timeLabel}
                            </Text>
                        </View>
                    </View>

                    <View
                        style={[
                            styles.statusPill,
                            {
                                backgroundColor: `${statusColor}1F`,
                                borderColor: `${statusColor}40`,
                            },
                        ]}
                    >
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
                            {statusName}
                        </Text>
                    </View>

                    <Pressable
                        onPress={() => sheetRef.current?.dismiss()}
                        hitSlop={10}
                        android_ripple={{ color: `${colors.primary}1A`, borderless: true, radius: 18 }}
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

                {service?.customer_address ? (
                    <View style={[styles.addressPreview, { backgroundColor: rowBg, borderColor: rowBorder }]}>
                        <MaterialCommunityIcons name="map-marker-outline" size={15} color={secondaryText} />
                        <Text style={[styles.addressPreviewText, { color: secondaryText }]} numberOfLines={2}>
                            {service.customer_address}
                        </Text>
                    </View>
                ) : null}

                <Text style={[styles.sectionLabel, { color: sectionLabel }]}>SERVİS İŞLEMLERİ</Text>
                <View style={styles.list}>
                    {PRIMARY_ACTIONS.map((action) => (
                        <ActionRow
                            key={action.key}
                            icon={action.icon}
                            color={action.color}
                            label={action.label}
                            description={action.description}
                            bg={rowBg}
                            border={rowBorder}
                            textColor={colors.text}
                            descColor={secondaryText}
                            onPress={() => handleAction(action.key)}
                        />
                    ))}
                </View>

                <Text style={[styles.sectionLabel, { color: sectionLabel }]}>HIZLI İLETİŞİM</Text>
                <View style={styles.list}>
                    {QUICK_ACTIONS.map((action) => (
                        <ActionRow
                            key={action.key}
                            icon={action.icon}
                            color={action.color}
                            label={action.label}
                            bg={rowBg}
                            border={rowBorder}
                            textColor={colors.text}
                            descColor={secondaryText}
                            onPress={() => handleAction(action.key)}
                        />
                    ))}
                </View>
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
});

const ActionRow = React.memo(
    ({ icon, color, label, description, bg, border, textColor, descColor, onPress }) => (
        <Pressable
            onPress={onPress}
            android_ripple={{ color: `${color}26`, borderless: false }}
            style={({ pressed }) => [
                styles.actionRow,
                {
                    backgroundColor: bg,
                    borderColor: border,
                    opacity: pressed ? 0.75 : 1,
                },
            ]}
        >
            <View style={[styles.actionIconWrap, { backgroundColor: `${color}1F` }]}>
                <MaterialCommunityIcons name={icon} size={18} color={color} />
            </View>
            <View style={styles.actionTextCol}>
                <Text style={[styles.actionLabel, { color: textColor }]} numberOfLines={1}>
                    {label}
                </Text>
                {description ? (
                    <Text style={[styles.actionDesc, { color: descColor }]} numberOfLines={1}>
                        {description}
                    </Text>
                ) : null}
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={descColor} />
        </Pressable>
    )
);

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.s,
        paddingBottom: spacing.xl,
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        marginTop: spacing.s,
        marginBottom: spacing.l,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.m,
        marginBottom: spacing.m,
    },
    headerInfo: {
        flex: 1,
        minWidth: 0,
    },
    customerName: {
        ...typography.h3,
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    headerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 3,
    },
    headerMetaText: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        maxWidth: 130,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.3,
        textTransform: 'capitalize',
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addressPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s + 2,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: spacing.l,
    },
    addressPreviewText: {
        ...typography.bodySmall,
        flex: 1,
        lineHeight: 18,
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: spacing.s,
        marginTop: spacing.s,
    },
    list: {
        gap: spacing.s,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
        paddingVertical: spacing.s + 2,
        paddingHorizontal: spacing.m,
        borderRadius: 14,
        borderWidth: 1,
    },
    actionIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionTextCol: {
        flex: 1,
        minWidth: 0,
    },
    actionLabel: {
        ...typography.body,
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    actionDesc: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 2,
        letterSpacing: -0.1,
    },
});

export default ServiceActionsSheet;
