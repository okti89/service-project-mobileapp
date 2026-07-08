import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppBottomSheet from '@/components/AppBottomSheet';
import PermissionModal from '@/components/PermissionModal';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { spacing } from '@/theme/spacing';

const SECTION_TINT = {
    blue: 'rgba(59,130,246,0.10)',
    green: 'rgba(16,185,129,0.10)',
    amber: 'rgba(245,158,11,0.10)',
    rose: 'rgba(244,63,94,0.10)',
    violet: 'rgba(139,92,246,0.10)',
    cyan: 'rgba(6,182,212,0.10)',
    slate: 'rgba(100,116,139,0.10)',
};

const MODAL_CATALOG = [
    {
        key: 'system-alert',
        title: 'System Alert',
        subtitle: "React Native'in yerleşik Alert.alert'i",
        icon: 'message-alert-outline',
        color: 'blue',
    },
    {
        key: 'toast',
        title: 'Toast (özel context)',
        subtitle: 'useToast ile success / error / warning',
        icon: 'bell-ring-outline',
        color: 'green',
    },
    {
        key: 'centered-modal',
        title: 'Merkez Modal (Modal)',
        subtitle: "React Native <Modal> + backdrop + animasyon",
        icon: 'card-bulleted-outline',
        color: 'amber',
    },
    {
        key: 'bottom-sheet',
        title: 'Bottom Sheet (gorhom)',
        subtitle: 'Sürüklenebilir alt sayfa',
        icon: 'arrow-down-box',
        color: 'cyan',
    },
    {
        key: 'app-bottom-sheet',
        title: 'AppBottomSheet (proje)',
        subtitle: 'Proje genelinde kullanılan custom bottom sheet',
        icon: 'layers-triple-outline',
        color: 'violet',
    },
    {
        key: 'confirmation',
        title: 'Onay Diyaloğu',
        subtitle: 'Sil / İptal tarzı kritik işlem onayı',
        icon: 'shield-alert-outline',
        color: 'rose',
    },
    {
        key: 'form',
        title: 'Form Modal',
        subtitle: 'TextInput + validasyon + gönder',
        icon: 'form-textbox',
        color: 'blue',
    },
    {
        key: 'action-sheet',
        title: 'Action Sheet',
        subtitle: 'iOS tarzı paylaş / düzenle / sil listesi',
        icon: 'dots-vertical-circle-outline',
        color: 'amber',
    },
    {
        key: 'loading',
        title: 'Yükleniyor Modal',
        subtitle: 'Spinner + iptal edilemez arka plan',
        icon: 'progress-clock',
        color: 'cyan',
    },
    {
        key: 'success',
        title: 'Sonuç Modal',
        subtitle: 'Başarı / hata sonucu için modal',
        icon: 'check-decagram-outline',
        color: 'green',
    },
    {
        key: 'image-viewer',
        title: 'Tam Ekran Görsel',
        subtitle: 'Image viewer + kapat + paylaş',
        icon: 'image-outline',
        color: 'violet',
    },
    {
        key: 'fullscreen',
        title: 'Tam Ekran Modal',
        subtitle: 'Tam ekran kaplama (form / wizard)',
        icon: 'arrow-expand-all',
        color: 'slate',
    },
    {
        key: 'permission',
        title: 'İzin Modalı (PermissionModal)',
        subtitle: 'Konum / bildirim / kamera izin açıklaması',
        icon: 'shield-key-outline',
        color: 'amber',
    },
];

const PERMISSION_VARIANTS = {
    location: {
        icon: 'map-marker-radius-outline',
        iconColor: '#0EA5E9',
        title: 'Konum İzni Gerekli',
        description:
            "Canlı servis takibi ve adres yönlendirme için konumuna erişmemiz gerekiyor. İzni sadece servis aktifken kullanacağız.",
        bullets: [
            { icon: 'navigation-variant-outline', title: 'Adım adım yönlendirme', description: 'Servis adresine en hızlı rota' },
            { icon: 'radar', title: 'Canlı konum paylaşımı', description: 'Müşteriye anlık varış süresi' },
            { icon: 'map-search-outline', title: 'Yakındaki servisler', description: 'Sıradaki iş atamaları için' },
        ],
        primaryLabel: 'Konum İznini Aç',
        secondaryLabel: 'Şimdi Değil',
    },
    notification: {
        icon: 'bell-ring-outline',
        iconColor: '#F59E0B',
        title: 'Bildirimleri Aç',
        description:
            'Yeni servis atamaları, müşteri mesajları ve ödeme hatırlatıcıları için bildirim göndermemiz gerekiyor.',
        bullets: [
            { icon: 'account-plus-outline', title: 'Yeni servis bildirimleri', description: 'Atandığında anında haberin olsun' },
            { icon: 'message-text-outline', title: 'Müşteri mesajları', description: 'WhatsApp tarzı anlık bildirim' },
            { icon: 'cash-clock', title: 'Tahsilat hatırlatıcıları', description: 'Vadesi yaklaşan ödemeler için' },
        ],
        primaryLabel: 'Bildirim İznini Aç',
        secondaryLabel: 'Daha Sonra',
    },
    camera: {
        icon: 'camera-outline',
        iconColor: '#8B5CF6',
        title: 'Kamera ve Galeri Erişimi',
        description:
            'Servis öncesi/sonrası fotoğraf çekmek ve cihaz seri numarasını okumak için kamera izni gerekli.',
        bullets: [
            { icon: 'camera-plus-outline', title: 'Servis fotoğrafları', description: 'Cihazın önceki/sonraki hali' },
            { icon: 'barcode-scan', title: 'Barkod & seri no okuma', description: 'Stok ve garanti kaydı için' },
            { icon: 'image-multiple-outline', title: 'Galeriden yükleme', description: 'Mevcut görselleri ekle' },
        ],
        primaryLabel: 'Kamerayı Aç',
        secondaryLabel: 'İptal',
    },
};

const DevModals = () => {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();

    const [centeredOpen, setCenteredOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [actionOpen, setActionOpen] = useState(false);
    const [loadingOpen, setLoadingOpen] = useState(false);
    const [successOpen, setSuccessOpen] = useState(false);
    const [imageOpen, setImageOpen] = useState(false);
    const [fullscreenOpen, setFullscreenOpen] = useState(false);
    const [appSheetOpen, setAppSheetOpen] = useState(false);
    const [permissionOpen, setPermissionOpen] = useState(false);
    const [permissionVariant, setPermissionVariant] = useState('location');
    const [permissionPickerOpen, setPermissionPickerOpen] = useState(false);
    const [formValue, setFormValue] = useState('');
    const [formError, setFormError] = useState('');
    const [notifEnabled, setNotifEnabled] = useState(true);

    const bottomSheetRef = useRef(null);
    const loadingTimeoutRef = useRef(null);

    const openSystemAlert = useCallback(() => {
        // eslint-disable-next-line no-alert
        if (Platform.OS === 'web') {
            // eslint-disable-next-line no-alert
            window.alert('Sistem Alert\n\nBu basit bir Alert.alert örneğidir.');
            return;
        }
        // eslint-disable-next-line no-alert
        const { Alert } = require('react-native');
        Alert.alert(
            'Servisi silmek istiyor musun?',
            'Bu işlem geri alınamaz. Servis detayları ve tüm bağlı kayıtlar silinecek.',
            [
                { text: 'Vazgeç', style: 'cancel' },
                { text: 'Yine de sil', style: 'destructive', onPress: () => showToast('warning', 'Silindi', 'Servis silme işlemi tetiklendi (demo).') },
            ],
        );
    }, [showToast]);

    const openToast = useCallback((variant) => {
        const map = {
            success: { message: 'İşlem başarıyla tamamlandı.' },
            error: { message: 'Bir hata oluştu, lütfen tekrar deneyin.' },
            warning: { message: 'Eksik alan var, kontrol edin.' },
            info: { message: 'Yeni bildiriminiz var.' },
        };
        showToast(variant, variant.charAt(0).toUpperCase() + variant.slice(1), map[variant].message);
    }, [showToast]);

    const openBottomSheet = useCallback(() => {
        bottomSheetRef.current?.present();
    }, []);

    const openLoading = useCallback(() => {
        setLoadingOpen(true);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = setTimeout(() => setLoadingOpen(false), 2400);
    }, []);

    const handleConfirmDelete = useCallback(() => {
        setConfirmOpen(false);
        showToast('success', 'Onaylandı', 'Silme işlemi onaylandı (demo).');
    }, [showToast]);

    const handleFormSubmit = useCallback(() => {
        if (!formValue.trim()) {
            setFormError('Bu alan zorunludur');
            return;
        }
        if (formValue.trim().length < 3) {
            setFormError('En az 3 karakter girin');
            return;
        }
        setFormError('');
        setFormOpen(false);
        showToast('success', 'Gönderildi', `Form değeri: ${formValue}`);
        setFormValue('');
    }, [formValue, showToast]);

    const handleActionItem = useCallback((label) => {
        setActionOpen(false);
        showToast('info', 'Aksiyon', `${label} seçildi`);
    }, [showToast]);

    const renderTriggerCard = (item) => {
        const tint = SECTION_TINT[item.color] || SECTION_TINT.blue;
        return (
            <Pressable
                key={item.key}
                onPress={() => {
                    switch (item.key) {
                        case 'system-alert': return openSystemAlert();
                        case 'toast': return openToast('success');
                        case 'centered-modal': return setCenteredOpen(true);
                        case 'bottom-sheet': return openBottomSheet();
                        case 'app-bottom-sheet': return setAppSheetOpen(true);
                        case 'confirmation': return setConfirmOpen(true);
                        case 'form': return setFormOpen(true);
                        case 'action-sheet': return setActionOpen(true);
                        case 'loading': return openLoading();
                        case 'success': return setSuccessOpen(true);
                        case 'image-viewer': return setImageOpen(true);
                        case 'fullscreen': return setFullscreenOpen(true);
                        case 'permission': return setPermissionPickerOpen(true);
                        default: return null;
                    }
                }}
                style={({ pressed }) => [
                    styles.card,
                    {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                        opacity: pressed ? 0.85 : 1,
                    },
                ]}
            >
                <View style={[styles.cardIcon, { backgroundColor: tint }]}>
                    <MaterialCommunityIcons name={item.icon} size={20} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                        {item.subtitle}
                    </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
            </Pressable>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 60 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.heroCard, { backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : '#EFF6FF', borderColor: isDark ? 'rgba(59,130,246,0.30)' : '#BFDBFE' }]}>
                    <View style={styles.heroIcon}>
                        <MaterialCommunityIcons name="view-grid-plus-outline" size={22} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.heroTitle, { color: colors.text }]}>Modal Galerisi</Text>
                        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
                            Uygulamada sıkça kullanılan {MODAL_CATALOG.length} farklı modal örneği. Bir karta tıkla, canlı önizleme açılsın.
                        </Text>
                    </View>
                </View>

                {MODAL_CATALOG.map(renderTriggerCard)}
            </ScrollView>

            {/* === 3. Merkez Modal === */}
            <Modal
                visible={centeredOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setCenteredOpen(false)}
            >
                <Pressable
                    style={styles.modalBackdrop}
                    onPress={() => setCenteredOpen(false)}
                >
                    <Pressable
                        onPress={(e) => e.stopPropagation?.()}
                        style={[
                            styles.centeredCard,
                            { backgroundColor: isDark ? '#111827' : '#FFFFFF' },
                        ]}
                    >
                        <View style={[styles.centeredIcon, { backgroundColor: SECTION_TINT.amber }]}>
                            <MaterialCommunityIcons name="card-bulleted-outline" size={22} color="#D97706" />
                        </View>
                        <Text style={[styles.centeredTitle, { color: colors.text }]}>Merkez Modal</Text>
                        <Text style={[styles.centeredDesc, { color: colors.textSecondary }]}>
                            React Native'in <Text style={styles.codeInline}>{'<Modal />'}</Text> bileşeniyle oluşturulmuş basit bir diyalog. Backdrop'a tıklayınca kapanır.
                        </Text>
                        <Pressable
                            onPress={() => setCenteredOpen(false)}
                            style={({ pressed }) => [styles.centeredBtn, { opacity: pressed ? 0.85 : 1 }]}
                        >
                            <Text style={styles.centeredBtnText}>Kapat</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* === 4. Bottom Sheet (gorhom) === */}
            <BottomSheetModal
                ref={bottomSheetRef}
                snapPoints={['45%', '80%']}
                index={0}
                enablePanDownToClose
                backdropComponent={(props) => (
                    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} pressBehavior="close" />
                )}
                backgroundStyle={{ backgroundColor: isDark ? '#111827' : '#FFFFFF' }}
            >
                <BottomSheetView style={styles.gorhomSheetContent}>
                    <View style={styles.handle} />
                    <Text style={[styles.sheetHeading, { color: colors.text }]}>Sürüklenebilir Bottom Sheet</Text>
                    <Text style={[styles.sheetBody, { color: colors.textSecondary }]}>
                        @gorhom/bottom-sheet kullanılarak oluşturuldu. Snap noktaları: %45 ve %80. Aşağı sürükleyerek kapatılabilir.
                    </Text>
                    <View style={styles.snapRow}>
                        <Pressable onPress={() => bottomSheetRef.current?.snapToIndex(0)} style={styles.snapBtn}>
                            <Text style={styles.snapBtnText}>%45</Text>
                        </Pressable>
                        <Pressable onPress={() => bottomSheetRef.current?.snapToIndex(1)} style={styles.snapBtn}>
                            <Text style={styles.snapBtnText}>%80</Text>
                        </Pressable>
                        <Pressable onPress={() => bottomSheetRef.current?.close()} style={[styles.snapBtn, { backgroundColor: '#EF4444' }]}>
                            <Text style={styles.snapBtnText}>Kapat</Text>
                        </Pressable>
                    </View>
                </BottomSheetView>
            </BottomSheetModal>

            {/* === 5. AppBottomSheet === */}
            <AppBottomSheet
                visible={appSheetOpen}
                onClose={() => setAppSheetOpen(false)}
                snapPoints={['60%']}
                wrapContent={false}
            >
                <View style={{ padding: spacing.gutter }}>
                    <Text style={[styles.sheetHeading, { color: colors.text }]}>AppBottomSheet</Text>
                    <Text style={[styles.sheetBody, { color: colors.textSecondary }]}>
                        Proje genelinde kullanılan, snapPoints + wrapContent destekli özelleştirilmiş bottom sheet. Genelde liste / form / seçici içerikler için tercih edilir.
                    </Text>
                    <View style={styles.snapRow}>
                        {['Liste', 'Form', 'Filtre'].map((label) => (
                            <View key={label} style={[styles.tag, { backgroundColor: SECTION_TINT.violet }]}>
                                <Text style={[styles.tagText, { color: colors.text }]}>{label}</Text>
                            </View>
                        ))}
                    </View>
                    <Pressable onPress={() => setAppSheetOpen(false)} style={[styles.centeredBtn, { marginTop: spacing.l }]}>
                        <Text style={styles.centeredBtnText}>Kapat</Text>
                    </Pressable>
                </View>
            </AppBottomSheet>

            {/* === 6. Onay Diyaloğu === */}
            <Modal
                visible={confirmOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setConfirmOpen(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.confirmCard, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]}>
                        <View style={[styles.confirmIcon, { backgroundColor: SECTION_TINT.rose }]}>
                            <MaterialCommunityIcons name="trash-can-outline" size={26} color="#E11D48" />
                        </View>
                        <Text style={[styles.confirmTitle, { color: colors.text }]}>Servisi sil</Text>
                        <Text style={[styles.confirmDesc, { color: colors.textSecondary }]}>
                            "Kombi Bakımı - 14 Mart" servisini silmek istediğine emin misin? Bu işlem geri alınamaz.
                        </Text>
                        <View style={styles.confirmRow}>
                            <Pressable
                                onPress={() => setConfirmOpen(false)}
                                style={[styles.confirmBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}
                            >
                                <Text style={[styles.confirmBtnText, { color: colors.text }]}>Vazgeç</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleConfirmDelete}
                                style={[styles.confirmBtn, { backgroundColor: '#E11D48' }]}
                            >
                                <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>Evet, sil</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* === 7. Form Modal === */}
            <Modal
                visible={formOpen}
                transparent
                animationType="slide"
                onRequestClose={() => setFormOpen(false)}
            >
                <View style={styles.modalBackdrop}>
                    <Pressable style={{ flex: 1 }} onPress={() => setFormOpen(false)} />
                    <View style={[styles.formSheet, { backgroundColor: isDark ? '#111827' : '#FFFFFF', paddingBottom: insets.bottom + spacing.m }]}>
                        <View style={styles.handle} />
                        <Text style={[styles.sheetHeading, { color: colors.text }]}>Hızlı not ekle</Text>
                        <Text style={[styles.sheetBody, { color: colors.textSecondary }]}>
                            Alttan kayan modal içinde TextInput + validasyon örneği.
                        </Text>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Başlık *</Text>
                        <TextInput
                            value={formValue}
                            onChangeText={(text) => {
                                setFormValue(text);
                                if (formError) setFormError('');
                            }}
                            placeholder="Örn. Müşteri geri aranacak"
                            placeholderTextColor={colors.textTertiary}
                            style={[
                                styles.textInput,
                                {
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                                    borderColor: formError ? '#E11D48' : colors.border,
                                    color: colors.text,
                                },
                            ]}
                        />
                        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

                        <View style={styles.confirmRow}>
                            <Pressable
                                onPress={() => {
                                    setFormOpen(false);
                                    setFormValue('');
                                    setFormError('');
                                }}
                                style={[styles.confirmBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}
                            >
                                <Text style={[styles.confirmBtnText, { color: colors.text }]}>İptal</Text>
                            </Pressable>
                            <Pressable onPress={handleFormSubmit} style={[styles.confirmBtn, { backgroundColor: '#2563EB' }]}>
                                <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>Kaydet</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* === 8. Action Sheet === */}
            <Modal
                visible={actionOpen}
                transparent
                animationType="slide"
                onRequestClose={() => setActionOpen(false)}
            >
                <View style={styles.modalBackdrop}>
                    <Pressable style={{ flex: 1 }} onPress={() => setActionOpen(false)} />
                    <View style={[styles.actionSheet, { backgroundColor: isDark ? '#111827' : '#FFFFFF', paddingBottom: insets.bottom + spacing.s }]}>
                        <View style={styles.handle} />
                        <Text style={[styles.sheetHeading, { color: colors.text, paddingHorizontal: spacing.m }]}>
                            Servis #1024
                        </Text>
                        {[
                            { icon: 'share-variant-outline', label: 'WhatsApp ile paylaş', color: '#10B981' },
                            { icon: 'pencil-outline', label: 'Düzenle', color: '#2563EB' },
                            { icon: 'content-copy-outline', label: 'Kopyala', color: '#6B7280' },
                            { icon: 'trash-can-outline', label: 'Sil', color: '#E11D48' },
                        ].map((item) => (
                            <Pressable
                                key={item.label}
                                onPress={() => handleActionItem(item.label)}
                                style={({ pressed }) => [
                                    styles.actionRow,
                                    { backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9') : 'transparent' },
                                ]}
                            >
                                <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                                <Text style={[styles.actionLabel, { color: colors.text }]}>{item.label}</Text>
                            </Pressable>
                        ))}
                        <Pressable
                            onPress={() => setActionOpen(false)}
                            style={[styles.centeredBtn, { marginTop: spacing.s, marginHorizontal: spacing.m }]}
                        >
                            <Text style={styles.centeredBtnText}>Vazgeç</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* === 9. Loading Modal === */}
            <Modal visible={loadingOpen} transparent animationType="fade" onRequestClose={() => {}}>
                <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
                    <View style={[styles.loadingCard, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={[styles.loadingTitle, { color: colors.text }]}>Lütfen bekleyin</Text>
                        <Text style={[styles.loadingDesc, { color: colors.textSecondary }]}>
                            Sunucuyla senkronize ediliyor...
                        </Text>
                    </View>
                </View>
            </Modal>

            {/* === 10. Sonuç Modal === */}
            <Modal visible={successOpen} transparent animationType="fade" onRequestClose={() => setSuccessOpen(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={[styles.centeredCard, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]}>
                        <View style={[styles.centeredIcon, { backgroundColor: SECTION_TINT.green }]}>
                            <MaterialCommunityIcons name="check-decagram-outline" size={28} color="#10B981" />
                        </View>
                        <Text style={[styles.centeredTitle, { color: colors.text }]}>İşlem tamam</Text>
                        <Text style={[styles.centeredDesc, { color: colors.textSecondary }]}>
                            Servis başarıyla kaydedildi. Müşteriye WhatsApp üzerinden bilgilendirme gönderildi.
                        </Text>
                        <Pressable
                            onPress={() => {
                                setSuccessOpen(false);
                                openToast('success');
                            }}
                            style={[styles.centeredBtn, { backgroundColor: '#10B981' }]}
                        >
                            <Text style={styles.centeredBtnText}>Tamam</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* === 11. Image Viewer === */}
            <Modal visible={imageOpen} transparent animationType="fade" onRequestClose={() => setImageOpen(false)}>
                <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,0.92)' }]}>
                    <Pressable onPress={() => setImageOpen(false)} style={styles.imageCloseBtn} hitSlop={20}>
                        <MaterialCommunityIcons name="close" size={26} color="#fff" />
                    </Pressable>
                    <Image
                        source={{ uri: 'https://picsum.photos/800/1200' }}
                        style={styles.imageViewer}
                        resizeMode="contain"
                    />
                    <View style={styles.imageFooter}>
                        <Text style={styles.imageFooterTitle}>Cihaz görseli</Text>
                        <Text style={styles.imageFooterMeta}>Kapatmak için boşluğa dokunun</Text>
                    </View>
                </View>
            </Modal>

            {/* === 12. Fullscreen Modal === */}
            <Modal
                visible={fullscreenOpen}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setFullscreenOpen(false)}
            >
                <View style={[styles.fullscreen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
                    <View style={styles.fullscreenHeader}>
                        <Pressable onPress={() => setFullscreenOpen(false)} hitSlop={10}>
                            <MaterialCommunityIcons name="close" size={26} color={colors.text} />
                        </Pressable>
                        <Text style={[styles.fullscreenTitle, { color: colors.text }]}>Tam Ekran Modal</Text>
                        <View style={{ width: 26 }} />
                    </View>
                    <ScrollView contentContainerStyle={styles.fullscreenBody}>
                        <Text style={[styles.sheetHeading, { color: colors.text, textAlign: 'center' }]}>
                            Wizard / Çok adımlı form
                        </Text>
                        <Text style={[styles.sheetBody, { color: colors.textSecondary, textAlign: 'center' }]}>
                            Sunum stili <Text style={styles.codeInline}>fullScreen</Text> olan modal, tüm ekranı kaplar ve kendi navigation bar'ı ile gelir. Çok adımlı formlar, onay akışları veya kamera ekranları için uygundur.
                        </Text>
                        <View style={[styles.snapRow, { justifyContent: 'center' }]}>
                            {['Adım 1', 'Adım 2', 'Adım 3'].map((label) => (
                                <View key={label} style={[styles.tag, { backgroundColor: SECTION_TINT.slate }]}>
                                    <Text style={[styles.tagText, { color: colors.text }]}>{label}</Text>
                                </View>
                            ))}
                        </View>
                        <View style={[styles.notifCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: colors.border }]}>
                            <MaterialCommunityIcons name="bell-outline" size={20} color={colors.text} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.notifTitle, { color: colors.text }]}>Bildirim tercihi</Text>
                                <Text style={[styles.notifDesc, { color: colors.textSecondary }]}>
                                    İçeride Switch kullanımı örneği
                                </Text>
                            </View>
                            <Switch
                                value={notifEnabled}
                                onValueChange={setNotifEnabled}
                                trackColor={{ false: colors.border, true: '#2563EB' }}
                                thumbColor={notifEnabled ? '#FFFFFF' : '#F4F4F5'}
                            />
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* === 13. İzin Modalı - Picker === */}
            <Modal
                visible={permissionPickerOpen}
                transparent
                animationType="slide"
                onRequestClose={() => setPermissionPickerOpen(false)}
            >
                <View style={styles.modalBackdrop}>
                    <Pressable style={{ flex: 1 }} onPress={() => setPermissionPickerOpen(false)} />
                    <View style={[styles.actionSheet, { backgroundColor: isDark ? '#111827' : '#FFFFFF', paddingBottom: insets.bottom + spacing.s }]}>
                        <View style={styles.handle} />
                        <Text style={[styles.sheetHeading, { color: colors.text, paddingHorizontal: spacing.m }]}>
                            İzin Varyantı Seç
                        </Text>
                        <Text style={[styles.sheetBody, { color: colors.textSecondary, paddingHorizontal: spacing.m, marginBottom: spacing.s }]}>
                            Hangi izin modalını önizlemek istiyorsun? Seçim sonrası modal açılır.
                        </Text>
                        {Object.entries(PERMISSION_VARIANTS).map(([key, variant]) => (
                            <Pressable
                                key={key}
                                onPress={() => {
                                    setPermissionVariant(key);
                                    setPermissionPickerOpen(false);
                                    setPermissionOpen(true);
                                }}
                                style={({ pressed }) => [
                                    styles.actionRow,
                                    { backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9') : 'transparent' },
                                ]}
                            >
                                <View style={[styles.bulletDot, { backgroundColor: `${variant.iconColor}25` }]}>
                                    <MaterialCommunityIcons name={variant.icon} size={16} color={variant.iconColor} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.actionLabel, { color: colors.text }]}>{variant.title}</Text>
                                    <Text style={[styles.cardSubtitle, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={2}>
                                        {variant.bullets.length} maddelik önizleme
                                    </Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
                            </Pressable>
                        ))}
                        <Pressable
                            onPress={() => setPermissionPickerOpen(false)}
                            style={[styles.centeredBtn, { marginTop: spacing.s, marginHorizontal: spacing.m }]}
                        >
                            <Text style={styles.centeredBtnText}>Vazgeç</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* === 13. İzin Modalı - PermissionModal === */}
            <PermissionModal
                visible={permissionOpen}
                {...PERMISSION_VARIANTS[permissionVariant]}
                onPrimary={() => {
                    setPermissionOpen(false);
                    showToast('success', 'İzin verildi', `${PERMISSION_VARIANTS[permissionVariant].title} demosu tetiklendi.`);
                }}
                onSecondary={() => setPermissionOpen(false)}
                onDismissForever={() => {
                    setPermissionOpen(false);
                    showToast('info', 'Bir daha gösterilmesin', 'Kalıcı olarak kapatıldı (demo).');
                }}
            />

            {/* === 13. İzin Modalı - İçerik Önizleme === */}
            {permissionOpen ? (
                <View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        top: insets.top + 8,
                        right: 8,
                        backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(15,23,42,0.85)',
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        maxWidth: 220,
                    }}
                >
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginBottom: 2 }}>
                        {PERMISSION_VARIANTS[permissionVariant].title}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 9, lineHeight: 12 }}>
                        {PERMISSION_VARIANTS[permissionVariant].description}
                    </Text>
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.l,
        gap: spacing.s,
    },
    heroCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
        borderWidth: 1,
        borderRadius: 18,
        padding: spacing.m,
        marginBottom: spacing.s,
    },
    heroIcon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: 'rgba(59,130,246,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroTitle: { fontSize: 16, fontWeight: '800' },
    heroSubtitle: { fontSize: 12, marginTop: 4, lineHeight: 17 },

    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
        borderWidth: 1,
        borderRadius: 16,
        padding: spacing.m,
    },
    cardIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: { fontSize: 14, fontWeight: '700' },
    cardSubtitle: { fontSize: 11, marginTop: 2, lineHeight: 16 },

    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.gutter,
    },

    // 3. Merkez Modal
    centeredCard: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 20,
        padding: spacing.l,
        alignItems: 'center',
    },
    centeredIcon: {
        width: 56,
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.m,
    },
    centeredTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
    centeredDesc: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: spacing.m },
    centeredBtn: {
        backgroundColor: '#2563EB',
        paddingHorizontal: spacing.l,
        paddingVertical: 12,
        borderRadius: 12,
        alignSelf: 'stretch',
        alignItems: 'center',
    },
    centeredBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    codeInline: {
        fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
        fontSize: 12,
    },

    // 4. Bottom Sheet
    gorhomSheetContent: {
        flex: 1,
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.s,
    },
    handle: {
        alignSelf: 'center',
        width: 44,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(15,23,42,0.18)',
        marginBottom: spacing.m,
    },
    sheetHeading: { fontSize: 16, fontWeight: '800' },
    sheetBody: { fontSize: 13, marginTop: 6, lineHeight: 19 },
    snapRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.s,
        marginTop: spacing.m,
    },
    snapBtn: {
        backgroundColor: '#2563EB',
        paddingHorizontal: spacing.m,
        paddingVertical: 10,
        borderRadius: 10,
        minWidth: 70,
        alignItems: 'center',
    },
    snapBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    tag: { paddingHorizontal: spacing.s, paddingVertical: 6, borderRadius: 8 },
    tagText: { fontSize: 12, fontWeight: '700' },

    // 6. Onay
    confirmCard: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 20,
        padding: spacing.l,
        alignItems: 'center',
    },
    confirmIcon: {
        width: 56,
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.m,
    },
    confirmTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
    confirmDesc: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: spacing.m },
    confirmRow: {
        flexDirection: 'row',
        gap: spacing.s,
        alignSelf: 'stretch',
    },
    confirmBtn: {
        flex: 1,
        height: 46,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmBtnText: { fontSize: 14, fontWeight: '800' },

    // 7. Form
    formSheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: spacing.gutter,
    },
    fieldLabel: { fontSize: 12, fontWeight: '700', marginTop: spacing.m, marginBottom: 6 },
    textInput: {
        minHeight: 48,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: spacing.m,
        fontSize: 14,
        fontWeight: '500',
    },
    errorText: { color: '#E11D48', fontSize: 11, fontWeight: '600', marginTop: 6 },

    // 8. Action Sheet
    actionSheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: spacing.s,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.m,
    },
    actionLabel: { fontSize: 14, fontWeight: '600' },
    bulletDot: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // 9. Loading
    loadingCard: {
        minWidth: 220,
        borderRadius: 16,
        padding: spacing.l,
        alignItems: 'center',
        gap: spacing.s,
    },
    loadingTitle: { fontSize: 15, fontWeight: '800' },
    loadingDesc: { fontSize: 12, textAlign: 'center' },

    // 11. Image Viewer
    imageCloseBtn: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    imageViewer: { width: '100%', height: '75%' },
    imageFooter: { paddingTop: spacing.m, alignItems: 'center' },
    imageFooterTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
    imageFooterMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },

    // 12. Fullscreen
    fullscreen: { flex: 1 },
    fullscreenHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.gutter,
        paddingVertical: spacing.s,
    },
    fullscreenTitle: { fontSize: 16, fontWeight: '800' },
    fullscreenBody: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing['2xl'],
        paddingBottom: spacing['3xl'],
        gap: spacing.m,
    },
    notifCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
        borderWidth: 1,
        borderRadius: 16,
        padding: spacing.m,
    },
    notifTitle: { fontSize: 13, fontWeight: '800' },
    notifDesc: { fontSize: 11, marginTop: 2 },
});

export default DevModals;
