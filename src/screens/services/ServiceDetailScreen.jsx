import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import serviceService from '@/services/serviceService';
import WrapperContainer from '@/components/WrapperContainer';
import Header from '@/components/Header';
import WarrantySheet from '@/components/services/WarrantySheet';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

dayjs.locale('tr');

const formatCurrency = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '₺0,00';
    try {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
    } catch {
        return `₺${n.toFixed(2)}`;
    }
};

const openMaps = (address) => {
    if (!address) return;
    const encoded = encodeURIComponent(address);
    const url = Platform.select({
        ios: `maps:0,0?q=${encoded}`,
        android: `geo:0,0?q=${encoded}`,
        default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    });
    Linking.openURL(url).catch(() => Alert.alert('Hata', 'Harita uygulaması açılamadı.'));
};

const openWhatsApp = (phone) => {
    if (!phone) return Alert.alert('Hata', 'Telefon numarası bulunamadı.');
    const cleaned = String(phone).replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${cleaned}`).catch(() => Alert.alert('Hata', 'WhatsApp açılamadı.'));
};

const sendSms = (phone) => {
    if (!phone) return Alert.alert('Hata', 'Telefon numarası bulunamadı.');
    const cleaned = String(phone).replace(/\D/g, '');
    Linking.openURL(`sms:${cleaned}`).catch(() => Alert.alert('Hata', 'SMS uygulaması açılamadı.'));
};

const callPhone = (phone) => {
    if (!phone) return Alert.alert('Hata', 'Telefon numarası bulunamadı.');
    const cleaned = String(phone).replace(/\D/g, '');
    Linking.openURL(`tel:${cleaned}`).catch(() => Alert.alert('Hata', 'Arama başlatılamadı.'));
};

// ── Reusable atoms ──────────────────────────────────────────────
const Section = ({ title, icon, children, rightAction }) => {
    const { colors } = useTheme();
    return (
        <View
            style={[
                styles.section,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                },
            ]}
        >
            <View style={styles.sectionHeader}>
                {icon ? (
                    <MaterialCommunityIcons
                        name={icon}
                        size={16}
                        color={colors.textSecondary}
                    />
                ) : null}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {title}
                </Text>
                {rightAction}
            </View>
            <View style={styles.sectionBody}>{children}</View>
        </View>
    );
};

const InfoRow = ({ icon, label, value, valueColor, onPress, multiline }) => {
    const { colors } = useTheme();
    const isInteractive = typeof onPress === 'function';
    const content = (
        <View style={styles.infoRow}>
            {icon ? (
                <View style={styles.infoIconWrap}>
                    <MaterialCommunityIcons name={icon} size={15} color={colors.textTertiary} />
                </View>
            ) : (
                <View style={styles.infoIconWrap} />
            )}
            <View style={styles.infoTextCol}>
                {label ? (
                    <Text style={[styles.infoLabel, { color: colors.textTertiary }]} numberOfLines={1}>
                        {label}
                    </Text>
                ) : null}
                <Text
                    style={[
                        styles.infoValue,
                        {
                            color: valueColor || colors.text,
                            fontWeight: valueColor ? '700' : '500',
                        },
                    ]}
                    numberOfLines={multiline ? 4 : 1}
                >
                    {value ?? '—'}
                </Text>
            </View>
            {isInteractive ? (
                <MaterialCommunityIcons
                    name="chevron-right"
                    size={18}
                    color={colors.textTertiary}
                />
            ) : null}
        </View>
    );
    if (isInteractive) {
        return (
            <Pressable
                onPress={onPress}
                android_ripple={{ color: `${colors.primary}14`, borderless: false }}
            >
                {content}
            </Pressable>
        );
    }
    return content;
};

// ── Main screen ─────────────────────────────────────────────────
const ServiceDetailScreen = ({ route, navigation }) => {
    const { colors, isDark } = useTheme();
    const serviceId = route?.params?.serviceId ?? route?.params?.id ?? null;
    const seedService = route?.params?.service ?? null;

    const [service, setService] = useState(seedService);
    const [loading, setLoading] = useState(!seedService && Boolean(serviceId));
    const [error, setError] = useState(null);

    const warrantySheetRef = useRef(null);

    const statusColor = useMemo(
        () => service?.status_color || colors.primary,
        [service?.status_color, colors.primary]
    );
    const statusName = useMemo(
        () => service?.status_name || service?.service_status || 'Bilinmiyor',
        [service?.status_name, service?.service_status]
    );
    const scheduled = useMemo(
        () => (service?.scheduled_date ? dayjs(service.scheduled_date) : null),
        [service?.scheduled_date]
    );
    const created = useMemo(
        () => (service?.created_at ? dayjs(service.created_at) : null),
        [service?.created_at]
    );
    const updated = useMemo(
        () => (service?.updated_at ? dayjs(service.updated_at) : null),
        [service?.updated_at]
    );

    const deviceLabel = useMemo(() => {
        const parts = [
            service?.device_type_name,
            service?.device_brand_name,
            service?.device_model_name,
        ].filter(Boolean);
        return parts.length ? parts.join(' · ') : null;
    }, [service?.device_type_name, service?.device_brand_name, service?.device_model_name]);

    const fetchService = useCallback(async () => {
        if (!serviceId) return;
        try {
            setLoading(true);
            setError(null);
            const data = await serviceService.getTechnicianService(serviceId);
            if (data) setService(data);
        } catch (err) {
            console.warn('ServiceDetail fetch error:', err?.response?.data || err?.message);
            setError(err?.message || 'Servis detayı yüklenemedi');
        } finally {
            setLoading(false);
        }
    }, [serviceId]);

    useEffect(() => {
        fetchService();
    }, [fetchService]);

    // ── Loading / error state ───────────────────────────────────
    if (loading) {
        return (
            <WrapperContainer>
                <Header title="Servis Detayı" showBack onBack={() => navigation.goBack()} />
                <View style={[styles.center, { backgroundColor: colors.background }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                        Servis detayı yükleniyor…
                    </Text>
                </View>
            </WrapperContainer>
        );
    }

    if (error && !service) {
        return (
            <WrapperContainer>
                <Header title="Servis Detayı" showBack onBack={() => navigation.goBack()} />
                <View style={[styles.center, { backgroundColor: colors.background }]}>
                    <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={36}
                        color={colors.error}
                    />
                    <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
                    <Pressable
                        onPress={fetchService}
                        style={[
                            styles.retryButton,
                            { backgroundColor: colors.primary },
                        ]}
                    >
                        <Text style={styles.retryText}>Tekrar Dene</Text>
                    </Pressable>
                </View>
            </WrapperContainer>
        );
    }

    if (!service) {
        return (
            <WrapperContainer>
                <Header title="Servis Detayı" showBack onBack={() => navigation.goBack()} />
                <View style={[styles.center, { backgroundColor: colors.background }]}>
                    <MaterialCommunityIcons
                        name="clipboard-text-search-outline"
                        size={36}
                        color={colors.textTertiary}
                    />
                    <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                        Servis kaydı bulunamadı.
                    </Text>
                </View>
            </WrapperContainer>
        );
    }

    // ── Main content ────────────────────────────────────────────
    const payments = Array.isArray(service.payments) ? service.payments : [];
    const items = Array.isArray(service.items) ? service.items : [];
    const timeline = Array.isArray(service.timeline) ? service.timeline : [];
    const photos = Array.isArray(service.photos) ? service.photos : [];
    const warranty = service.warranty_certificate;
    const totalPrice = service.total_price ?? 0;
    const totalPaid = service.total_paid ?? 0;
    const remaining = service.remaining_balance ?? Math.max(totalPrice - totalPaid, 0);

    return (
        <WrapperContainer>
            <Header
                title="Servis Detayı"
                showBack
                onBack={() => navigation.goBack()}
                rightIcon="lightning-bolt-outline"
                onRightPress={() => {
                    // İleride sheet tetiklemek için kullanılabilir.
                    Alert.alert('Servis Detayı', 'Hızlı işlemler için kart menüsünü kullanın.');
                }}
            />

            <ScrollView
                style={[styles.container, { backgroundColor: colors.background }]}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero card: müşteri + durum */}
                <View
                    style={[
                        styles.hero,
                        {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <View style={[styles.heroAccent, { backgroundColor: statusColor }]} />

                    <View style={styles.heroTopRow}>
                        <View style={styles.heroCustomerCol}>
                            <Text
                                style={[styles.heroCustomerName, { color: colors.text }]}
                                numberOfLines={1}
                            >
                                {service.customer_full_name || 'Müşteri'}
                            </Text>
                            {service.receipt_number ? (
                                <Text
                                    style={[styles.heroReceipt, { color: colors.textTertiary }]}
                                    numberOfLines={1}
                                >
                                    Fiş No: #{service.receipt_number}
                                </Text>
                            ) : null}
                        </View>

                        <View
                            style={[
                                styles.heroStatusPill,
                                {
                                    backgroundColor: `${statusColor}1F`,
                                    borderColor: `${statusColor}40`,
                                },
                            ]}
                        >
                            <View
                                style={[
                                    styles.heroStatusDot,
                                    { backgroundColor: statusColor },
                                ]}
                            />
                            <Text
                                style={[styles.heroStatusText, { color: statusColor }]}
                                numberOfLines={1}
                            >
                                {statusName}
                            </Text>
                        </View>
                    </View>

                    {scheduled ? (
                        <View style={styles.heroMetaRow}>
                            <MaterialCommunityIcons
                                name="calendar-clock"
                                size={13}
                                color={colors.textSecondary}
                            />
                            <Text style={[styles.heroMetaText, { color: colors.textSecondary }]}>
                                {scheduled.format('DD MMMM YYYY · HH:mm')}
                            </Text>
                        </View>
                    ) : null}
                </View>

                {/* Hızlı iletişim */}
                <View style={styles.quickRow}>
                    <QuickAction
                        icon="whatsapp"
                        color="#25D366"
                        label="WhatsApp"
                        onPress={() => openWhatsApp(service.customer_phone)}
                    />
                    <QuickAction
                        icon="message-text-outline"
                        color="#3B82F6"
                        label="SMS"
                        onPress={() => sendSms(service.customer_phone)}
                    />
                    <QuickAction
                        icon="phone-outline"
                        color="#34C759"
                        label="Ara"
                        onPress={() => callPhone(service.customer_phone)}
                    />
                    <QuickAction
                        icon="map-marker-radius-outline"
                        color="#FF8C00"
                        label="Harita"
                        onPress={() => openMaps(service.customer_address)}
                    />
                </View>

                {/* Müşteri */}
                <Section title="MÜŞTERİ" icon="account-circle-outline">
                    <InfoRow
                        icon="account"
                        label="Ad Soyad"
                        value={service.customer_full_name}
                    />
                    <Divider />
                    <InfoRow
                        icon="phone-outline"
                        label="Telefon"
                        value={service.customer_phone}
                        onPress={() => callPhone(service.customer_phone)}
                    />
                    <Divider />
                    <InfoRow
                        icon="map-marker-outline"
                        label="Adres"
                        value={service.customer_address}
                        onPress={() => openMaps(service.customer_address)}
                        multiline
                    />
                </Section>

                {/* Cihaz */}
                <Section title="CİHAZ" icon="cellphone-cog">
                    <InfoRow icon="shape-outline" label="Tür" value={service.device_type_name} />
                    <Divider />
                    <InfoRow icon="tag-outline" label="Marka" value={service.device_brand_name} />
                    <Divider />
                    <InfoRow icon="cube-outline" label="Model" value={service.device_model_name} />
                </Section>

                {/* Arıza */}
                {service.fault_description ? (
                    <Section title="ARIZA AÇIKLAMASI" icon="text-box-outline">
                        <Text
                            style={[
                                styles.faultText,
                                { color: colors.text, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15, 23, 42, 0.03)' },
                            ]}
                        >
                            {service.fault_description}
                        </Text>
                    </Section>
                ) : null}

                {/* İşlemler (items) */}
                {items.length > 0 ? (
                    <Section title={`YAPILAN İŞLEMLER (${items.length})`} icon="wrench-outline">
                        {items.map((it, idx) => (
                            <View key={it?.id || idx}>
                                {idx > 0 ? <Divider /> : null}
                                <View style={styles.itemRow}>
                                    <MaterialCommunityIcons
                                        name="check-circle-outline"
                                        size={16}
                                        color={colors.primary}
                                    />
                                    <View style={styles.itemTextCol}>
                                        <Text
                                            style={[styles.itemName, { color: colors.text }]}
                                            numberOfLines={2}
                                        >
                                            {it?.name || it?.description || 'İşlem'}
                                        </Text>
                                        {it?.quantity ? (
                                            <Text
                                                style={[
                                                    styles.itemMeta,
                                                    { color: colors.textTertiary },
                                                ]}
                                            >
                                                {it.quantity} adet
                                            </Text>
                                        ) : null}
                                    </View>
                                    {it?.price ? (
                                        <Text
                                            style={[
                                                styles.itemPrice,
                                                { color: colors.text },
                                            ]}
                                        >
                                            {formatCurrency(it.price * (it.quantity || 1))}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </Section>
                ) : null}

                {/* Ödemeler */}
                {payments.length > 0 || totalPrice > 0 ? (
                    <Section title="ÖDEME" icon="cash-multiple">
                        <View style={styles.paymentSummary}>
                            <PaymentRow
                                label="Toplam"
                                value={formatCurrency(totalPrice)}
                                textColor={colors.text}
                            />
                            <Divider />
                            <PaymentRow
                                label="Ödenen"
                                value={formatCurrency(totalPaid)}
                                textColor={colors.success}
                            />
                            <Divider />
                            <PaymentRow
                                label="Kalan"
                                value={formatCurrency(remaining)}
                                textColor={remaining > 0 ? colors.error : colors.success}
                            />
                        </View>

                        {payments.length > 0 ? (
                            <View style={[styles.paymentList, { borderTopColor: colors.border }]}>
                                {payments.map((p, idx) => (
                                    <View
                                        key={p?.id || idx}
                                        style={[
                                            styles.paymentItem,
                                            idx > 0 && {
                                                borderTopColor: colors.border,
                                                borderTopWidth: 1,
                                            },
                                        ]}
                                    >
                                        <View style={styles.paymentItemLeft}>
                                            <MaterialCommunityIcons
                                                name={
                                                    p?.payment_method === 'cash'
                                                        ? 'cash'
                                                        : p?.payment_method === 'card'
                                                            ? 'credit-card-outline'
                                                            : 'wallet-outline'
                                                }
                                                size={14}
                                                color={colors.textSecondary}
                                            />
                                            <Text
                                                style={[
                                                    styles.paymentItemText,
                                                    { color: colors.text },
                                                ]}
                                            >
                                                {p?.method_label ||
                                                    p?.payment_method_label ||
                                                    'Ödeme'}
                                                {p?.paid_at
                                                    ? ` · ${dayjs(p.paid_at).format('DD MMM')}`
                                                    : ''}
                                            </Text>
                                        </View>
                                        <Text
                                            style={[
                                                styles.paymentItemAmount,
                                                { color: colors.success },
                                            ]}
                                        >
                                            {formatCurrency(p?.amount)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}
                    </Section>
                ) : null}

                {/* Garanti */}
                <Section
                    title="GARANTİ BELGESİ"
                    icon="shield-check-outline"
                    rightAction={
                        <Pressable
                            onPress={() => warrantySheetRef.current?.present()}
                            style={({ pressed }) => [
                                styles.warrantyCreateBtn,
                                {
                                    backgroundColor: pressed ? '#0EA5E925' : '#0EA5E915',
                                    borderColor: '#0EA5E940',
                                    opacity: pressed ? 0.85 : 1,
                                },
                            ]}
                        >
                            <MaterialCommunityIcons name="file-pdf-box" size={14} color="#0EA5E9" />
                            <Text style={styles.warrantyCreateText}>
                                {warranty ? 'Oluştur / Paylaş' : 'Oluştur'}
                            </Text>
                        </Pressable>
                    }
                >
                    {warranty ? (
                        <>
                            <InfoRow
                                icon="shield-star-outline"
                                label="Belge No"
                                value={warranty.certificate_number}
                            />
                            {warranty.warranty_months ? (
                                <>
                                    <Divider />
                                    <InfoRow
                                        icon="calendar-range"
                                        label="Süre"
                                        value={`${warranty.warranty_months} Ay`}
                                    />
                                </>
                            ) : null}
                            {warranty.expiry_date ? (
                                <>
                                    <Divider />
                                    <InfoRow
                                        icon="calendar-end"
                                        label="Bitiş Tarihi"
                                        value={dayjs(warranty.expiry_date).format('DD MMMM YYYY')}
                                    />
                                </>
                            ) : null}
                        </>
                    ) : (
                        <Pressable
                            onPress={() => warrantySheetRef.current?.present()}
                            style={({ pressed }) => [
                                styles.warrantyEmpty,
                                {
                                    backgroundColor: pressed
                                        ? '#0EA5E918'
                                        : isDark
                                            ? 'rgba(14, 165, 233, 0.08)'
                                            : 'rgba(14, 165, 233, 0.06)',
                                    borderColor: '#0EA5E940',
                                },
                            ]}
                        >
                            <MaterialCommunityIcons name="shield-plus-outline" size={20} color="#0EA5E9" />
                            <Text style={[styles.warrantyEmptyText, { color: colors.text }]}>
                                Garanti belgesi henüz oluşturulmadı
                            </Text>
                            <Text style={[styles.warrantyEmptyHint, { color: colors.textSecondary }]}>
                                Garanti süresini seçmek için buraya dokun
                            </Text>
                        </Pressable>
                    )}
                </Section>

                {/* Fotoğraflar */}
                {photos.length > 0 ? (
                    <Section title={`FOTOĞRAFLAR (${photos.length})`} icon="image-multiple-outline">
                        <Text style={[styles.muted, { color: colors.textSecondary }]}>
                            {photos.length} adet fotoğraf yüklendi.
                        </Text>
                    </Section>
                ) : null}

                {/* Zaman çizelgesi */}
                {timeline.length > 0 ? (
                    <Section title="ZAMAN ÇİZELGESİ" icon="timeline-clock-outline">
                        {timeline.slice(0, 6).map((t, idx) => (
                            <View key={t?.id || idx}>
                                {idx > 0 ? <Divider /> : null}
                                <View style={styles.timelineRow}>
                                    <View
                                        style={[
                                            styles.timelineDot,
                                            { backgroundColor: statusColor },
                                        ]}
                                    />
                                    <View style={styles.timelineTextCol}>
                                        <Text
                                            style={[
                                                styles.timelineTitle,
                                                { color: colors.text },
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {t?.title || t?.event || 'Güncelleme'}
                                        </Text>
                                        {t?.description ? (
                                            <Text
                                                style={[
                                                    styles.timelineDesc,
                                                    { color: colors.textSecondary },
                                                ]}
                                                numberOfLines={2}
                                            >
                                                {t.description}
                                            </Text>
                                        ) : null}
                                    </View>
                                    {t?.created_at ? (
                                        <Text
                                            style={[
                                                styles.timelineTime,
                                                { color: colors.textTertiary },
                                            ]}
                                        >
                                            {dayjs(t.created_at).format('DD MMM')}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </Section>
                ) : null}

                {/* Sistem tarihleri */}
                <Section title="SİSTEM" icon="clock-outline">
                    {created ? (
                        <InfoRow
                            icon="plus-circle-outline"
                            label="Oluşturulma"
                            value={created.format('DD MMMM YYYY · HH:mm')}
                        />
                    ) : null}
                    {updated ? (
                        <>
                            <Divider />
                            <InfoRow
                                icon="refresh"
                                label="Son Güncelleme"
                                value={updated.format('DD MMMM YYYY · HH:mm')}
                            />
                        </>
                    ) : null}
                </Section>

                <View style={{ height: spacing['4xl'] }} />
            </ScrollView>

            <WarrantySheet ref={warrantySheetRef} service={service} />
        </WrapperContainer>
    );
};

// ── Sub-components ──────────────────────────────────────────────
const QuickAction = ({ icon, color, label, onPress }) => {
    const { colors } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            android_ripple={{ color: `${color}26`, borderless: true, radius: 24 }}
            style={({ pressed }) => [
                styles.quickAction,
                {
                    backgroundColor: `${color}1A`,
                    opacity: pressed ? 0.7 : 1,
                },
            ]}
        >
            <MaterialCommunityIcons name={icon} size={18} color={color} />
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>{label}</Text>
        </Pressable>
    );
};

const Divider = () => {
    const { colors, isDark } = useTheme();
    return (
        <View
            style={[
                styles.divider,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.05)' },
            ]}
        />
    );
};

const PaymentRow = ({ label, value, textColor }) => {
    const { colors } = useTheme();
    return (
        <View style={styles.paymentRow}>
            <Text style={[styles.paymentLabel, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[styles.paymentValue, { color: textColor }]}>{value}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.m,
        paddingBottom: spacing.l,
    },

    // Center / empty / error
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.l,
        gap: spacing.m,
    },
    loadingText: {
        ...typography.bodySmall,
        marginTop: spacing.s,
    },
    errorText: {
        ...typography.body,
        textAlign: 'center',
    },
    retryButton: {
        paddingHorizontal: spacing.l,
        paddingVertical: spacing.s + 2,
        borderRadius: 12,
    },
    retryText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    warrantyCreateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1,
    },
    warrantyCreateText: {
        color: '#0EA5E9',
        fontSize: 11,
        fontWeight: '800',
    },
    warrantyEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
        gap: 6,
    },
    warrantyEmptyText: {
        fontSize: 14,
        fontWeight: '800',
        textAlign: 'center',
    },
    warrantyEmptyHint: {
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
    },

    // Hero
    hero: {
        borderRadius: 18,
        borderWidth: 1,
        paddingVertical: spacing.l,
        paddingHorizontal: spacing.l,
        marginBottom: spacing.m,
        overflow: 'hidden',
        gap: spacing.s,
    },
    heroAccent: {
        position: 'absolute',
        left: 0,
        top: 12,
        bottom: 12,
        width: 4,
        borderTopRightRadius: 4,
        borderBottomRightRadius: 4,
    },
    heroTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
        paddingLeft: 6,
    },
    heroCustomerCol: {
        flex: 1,
        minWidth: 0,
    },
    heroCustomerName: {
        ...typography.h2,
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    heroReceipt: {
        ...typography.caption,
        marginTop: 2,
    },
    heroStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        maxWidth: 140,
    },
    heroStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    heroStatusText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.3,
        textTransform: 'capitalize',
    },
    heroMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 6,
    },
    heroMetaText: {
        ...typography.bodySmall,
        fontWeight: '600',
    },

    // Quick actions
    quickRow: {
        flexDirection: 'row',
        gap: spacing.s,
        marginBottom: spacing.m,
    },
    quickAction: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.s + 4,
        borderRadius: 14,
        gap: 4,
    },
    quickActionLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: -0.1,
    },

    // Section
    section: {
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: spacing.m,
        overflow: 'hidden',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.l,
        paddingTop: spacing.m,
        paddingBottom: spacing.s,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
        flex: 1,
    },
    sectionBody: {
        paddingHorizontal: spacing.l,
        paddingBottom: spacing.m,
    },

    // Info row
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
        paddingVertical: spacing.s + 2,
    },
    infoIconWrap: {
        width: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoTextCol: {
        flex: 1,
        minWidth: 0,
    },
    infoLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    infoValue: {
        ...typography.body,
        fontSize: 14,
        marginTop: 2,
        letterSpacing: -0.1,
    },

    // Divider
    divider: {
        height: 1,
        width: '100%',
    },

    // Fault
    faultText: {
        ...typography.body,
        fontSize: 13,
        lineHeight: 19,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s + 2,
        borderRadius: 10,
    },

    // Items
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
        paddingVertical: spacing.s + 2,
    },
    itemTextCol: {
        flex: 1,
        minWidth: 0,
    },
    itemName: {
        ...typography.body,
        fontSize: 14,
        fontWeight: '600',
    },
    itemMeta: {
        ...typography.caption,
        marginTop: 2,
    },
    itemPrice: {
        fontSize: 13,
        fontWeight: '700',
    },

    // Payment
    paymentSummary: {
        marginBottom: spacing.s,
    },
    paymentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.s,
    },
    paymentLabel: {
        ...typography.body,
        fontSize: 13,
        fontWeight: '500',
    },
    paymentValue: {
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    paymentList: {
        marginTop: spacing.s,
    },
    paymentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.s + 2,
    },
    paymentItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        minWidth: 0,
    },
    paymentItemText: {
        ...typography.body,
        fontSize: 13,
        flexShrink: 1,
    },
    paymentItemAmount: {
        fontSize: 13,
        fontWeight: '700',
    },

    // Timeline
    timelineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
        paddingVertical: spacing.s + 2,
    },
    timelineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    timelineTextCol: {
        flex: 1,
        minWidth: 0,
    },
    timelineTitle: {
        ...typography.body,
        fontSize: 13,
        fontWeight: '600',
    },
    timelineDesc: {
        fontSize: 11,
        marginTop: 2,
    },
    timelineTime: {
        fontSize: 11,
        fontWeight: '500',
    },

    muted: {
        ...typography.bodySmall,
    },
});

export default ServiceDetailScreen;