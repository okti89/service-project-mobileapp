import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Linking,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
    LayoutAnimation,
    Platform,
    UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import AppBottomSheet from '@/components/AppBottomSheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

const PURPLE = '#8B5CF6';

const PERMS = [
    { key: 'can_manage_services', label: 'Servis Yönetimi', icon: 'clipboard-text-outline', color: serviceBlue },
    { key: 'can_manage_customers', label: 'Müşteri Yönetimi', icon: 'account-group-outline', color: '#06B6D4' },
    { key: 'can_manage_inventory', label: 'Ürün Yönetimi', icon: 'package-variant-closed', color: PURPLE },
    { key: 'can_manage_users', label: 'Kullanıcı Yönetimi', icon: 'account-cog-outline', color: '#EC4899' },
    { key: 'can_manage_accounting', label: 'Muhasebe', icon: 'calculator-variant-outline', color: serviceOrange },
    { key: 'can_manage_notifications', label: 'Bildirimler', icon: 'bell-outline', color: '#0EA5E9' },
    { key: 'can_manage_hr', label: 'Maaş/Bordro İşlemleri', icon: 'briefcase-account-outline', color: '#14B8A6' },
    { key: 'can_manage_reports', label: 'Raporlama', icon: 'chart-box-outline', color: '#7C3AED' },
    { key: 'can_manage_settings', label: 'Ayarlar', icon: 'cog-outline', color: '#64748B' },
    { key: 'can_manage_technicians', label: 'Teknisyen Yönetimi', icon: 'shield-account-outline', color: '#F43F5E' },
];

function PER({ item, value, onToggle, colors }) {
    return (
        <Pressable onPress={() => onToggle(item.key)} style={[styles.permRow, { backgroundColor: value ? item.color + '12' : colors.surface, borderColor: value ? item.color + '30' : colors.border }]}>
            <View style={[styles.permIcon, { backgroundColor: value ? item.color : colors.textTertiary }]}><MaterialCommunityIcons name={item.icon} size={13} color='#fff' /></View>
            <Text style={[styles.permLabel, { color: value ? colors.text : colors.textSecondary, flex: 1 }]}>{item.label}</Text>
            <View style={[styles.switchTrack, { backgroundColor: value ? item.color : colors.border }]}><View style={[styles.switchKnob, value && styles.switchKnobOn]} /></View>
        </Pressable>
    );
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
    { key: 'all', label: 'Tümü' },
    { key: 'online', label: 'Çevrimiçi' },
    { key: 'offline', label: 'Çevrimdışı' },
    { key: 'passive', label: 'Pasif' },
];

const STAT_DEFS = [
    { key: 'total', icon: 'account-hard-hat-outline', iconColor: serviceBlue, label: 'Toplam', statusKey: null },
    { key: 'online', icon: 'circle', iconColor: serviceGreen, label: 'Çevrimiçi', statusKey: 'online' },
    { key: 'offline', icon: 'circle-outline', iconColor: '#94A3B8', label: 'Çevrimdışı', statusKey: 'offline' },
    { key: 'passive', icon: 'account-off-outline', iconColor: serviceRed, label: 'Pasif', statusKey: 'passive' },
];

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

const getFullName = (t) =>
    t?.full_name ||
    [t?.user?.first_name, t?.user?.last_name].filter(Boolean).join(' ') ||
    t?.user?.email || '-';

const getInitials = (t) => {
    const f = (t?.user?.first_name || '').trim();
    const l = (t?.user?.last_name || '').trim();
    if (f || l) return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();
    return String(t?.user?.email || '?').slice(0, 2).toUpperCase();
};

const formatDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatLastSeen = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'Şimdi';
    if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const getTechStatusKey = (t) => {
    if (!t?.user?.is_active) return 'passive';
    if (t?.is_online) return 'online';
    return 'offline';
};

// Hex rengi (örn. "#7C3AED") { r, g, b } nesnesine çevirir.
function hexToRgb(hex) {
    const h = String(hex || '').replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    if (full.length !== 6) return { r: 0, g: 0, b: 0 };
    return {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16),
    };
}

function rgbToHex(r, g, b) {
    const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return '#' + (toHex(r) + toHex(g) + toHex(b)).toUpperCase();
}

function lightenColor(hex, amount = 0.3) {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

function darkenColor(hex, amount = 0.2) {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

// ─── TechnicianCard ───────────────────────────────────────────────────────────

function TechnicianCard({ tech, colors, isDark, busyId, onDeactivate, onRestore, onNavigate, onWhatsApp, onCall }) {
    const name = getFullName(tech);
    const initials = getInitials(tech);
    const avatarUri = resolveMediaUrl(tech?.user?.profile_picture || tech?.user?.avatar);
    const statusKey = getTechStatusKey(tech);
    const isBusy = busyId === tech.id;
    const isPassive = statusKey === 'passive';
    const isOnline = statusKey === 'online';

    const statusBadge = isPassive
        ? { label: 'Pasif', bg: '#FEE2E2', color: serviceRed }
        : isOnline
            ? { label: 'Çevrimiçi', bg: '#DCFCE7', color: serviceGreen }
            : { label: 'Çevrimdışı', bg: '#F1F5F9', color: '#64748B' };

    const cardBg = isDark ? '#1E2736' : '#FFFFFF';
    const borderClr = isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9';
    const divClr = isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9';

    const ACTIONS = [
        { icon: 'pencil-outline', label: 'Düzenle', color: serviceBlue, key: 'edit' },
        { icon: 'shield-account-outline', label: 'Yetkiler', color: '#7C3AED', key: 'permissions' },
        { icon: 'clipboard-list-outline', label: 'Servisler', color: serviceGreen, key: 'services' },
        { icon: 'clock-outline', label: 'Mesai Geçmişi', color: serviceOrange, key: 'shifts' },
        { icon: 'calendar-account-outline', label: 'Mesai / İzin', color: '#14B8A6', key: 'leave' },
        { icon: 'map-marker-radius-outline', label: 'Konum Geçmişi', color: '#6366F1', key: 'locations' },
        {
            icon: isPassive ? 'account-reactivate-outline' : 'account-off-outline',
            label: isPassive ? 'Aktif Et' : 'Pasife Al',
            color: isPassive ? serviceGreen : serviceRed,
            key: 'toggle',
        },
    ];

    const renderAction = (a, isToggle = false) => {
        const showSpinner = a.key === 'toggle' && isBusy;
        const tintBg = isDark ? `${a.color}26` : `${a.color}15`;
        const tintFg = isDark ? lightenColor(a.color, 0.35) : darkenColor(a.color, 0.15);
        return (
            <Pressable
                key={a.key}
                disabled={isBusy}
                onPress={() => {
                    if (a.key === 'toggle') {
                        isPassive ? onRestore(tech) : onDeactivate(tech);
                    } else {
                        onNavigate(a.key, tech);
                    }
                }}
                style={({ pressed }) => [
                    styles.actionLink,
                    { backgroundColor: tintBg, opacity: pressed || isBusy ? 0.5 : 1 },
                    isToggle ? { width: '100%' } : { width: '48.5%' }
                ]}
            >
                {showSpinner ? (
                    <ActivityIndicator size="small" color={a.color} />
                ) : (
                    <>
                        <MaterialCommunityIcons name={a.icon} size={15} color={a.color} />
                        <Text style={[styles.actionLinkText, { color: tintFg }]} numberOfLines={1}>
                            {a.label}
                        </Text>
                    </>
                )}
            </Pressable>
        );
    };

    return (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
            {/* Üst satır */}
            <View style={styles.cardHeader}>
                <View style={styles.avatarWrap}>
                    {avatarUri
                        ? <Image source={{ uri: avatarUri }} style={styles.avatar} />
                        : (
                            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: serviceBlue + '22' }]}>
                                <Text style={[styles.avatarText, { color: serviceBlue }]}>{initials}</Text>
                            </View>
                        )}
                    <View style={[
                        styles.onlineDot,
                        { backgroundColor: isOnline ? serviceGreen : '#94A3B8', borderColor: cardBg },
                    ]} />
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
                    <Text style={[styles.role, { color: colors.textSecondary }]} numberOfLines={1}>
                        {tech?.user?.user_type_display || 'Teknisyen'}
                    </Text>
                </View>

                <View style={[styles.badge, { backgroundColor: statusBadge.bg }]}>
                    <Text style={[styles.badgeText, { color: statusBadge.color }]}>{statusBadge.label}</Text>
                </View>
            </View>

            {/* Bilgi satırı */}
            <View style={[styles.infoRow, { borderTopColor: divClr }]}>
                <View style={styles.infoItem}>
                    <MaterialCommunityIcons name="briefcase-clock-outline" size={13} color={colors.textSecondary} />
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>İşe başlama</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>{formatDate(tech.hire_date)}</Text>
                </View>
                <View style={[styles.infoItem, { borderLeftWidth: 1, borderLeftColor: divClr, paddingLeft: 12 }]}>
                    <MaterialCommunityIcons
                        name="eye-outline"
                        size={13}
                        color={isOnline ? serviceGreen : colors.textSecondary}
                    />
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Son görülme</Text>
                    <Text style={[styles.infoValue, { color: isOnline ? serviceGreen : colors.text }]}>
                        {isOnline ? 'Şimdi' : formatLastSeen(tech.last_online)}
                    </Text>
                </View>
            </View>

            {/* Hızlı aksiyonlar */}
            <View style={[styles.quickActions, { borderTopColor: divClr }]}>
                <Pressable
                    onPress={() => onWhatsApp?.(tech)}
                    disabled={isBusy}
                    style={({ pressed }) => [
                        styles.quickAction,
                        { backgroundColor: isDark ? 'rgba(37,211,102,0.18)' : '#DCFCE7', opacity: pressed || isBusy ? 0.5 : 1 },
                    ]}
                >
                    <MaterialCommunityIcons name="whatsapp" size={18} color="#25D366" />
                    <Text style={[styles.quickActionText, { color: isDark ? '#86EFAC' : '#15803D' }]}>WhatsApp</Text>
                </Pressable>
                <Pressable
                    onPress={() => onCall?.(tech)}
                    disabled={isBusy}
                    style={({ pressed }) => [
                        styles.quickAction,
                        { backgroundColor: isDark ? 'rgba(0,102,204,0.18)' : '#DBEAFE', opacity: pressed || isBusy ? 0.5 : 1 },
                    ]}
                >
                    <MaterialCommunityIcons name="phone-outline" size={18} color={serviceBlue} />
                    <Text style={[styles.quickActionText, { color: isDark ? '#93C5FD' : '#1D4ED8' }]}>Ara</Text>
                </Pressable>
                <Pressable
                    onPress={() => onNavigate?.('view', tech)}
                    disabled={isBusy}
                    style={({ pressed }) => [
                        styles.quickAction,
                        { backgroundColor: isDark ? 'rgba(124,58,237,0.18)' : '#EDE9FE', opacity: pressed || isBusy ? 0.5 : 1 },
                    ]}
                >
                    <MaterialCommunityIcons name="eye-outline" size={18} color="#7C3AED" />
                    <Text style={[styles.quickActionText, { color: isDark ? '#C4B5FD' : '#6D28D9' }]}>Detay</Text>
                </Pressable>
            </View>

            {/* Diğer Aksiyonlar */}
            <View style={[styles.actionsGrid, { borderTopColor: divClr }]}>
                {ACTIONS.map((a) => renderAction(a, a.key === 'toggle'))}
            </View>
        </View>
    );
}

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

export default function AdminTechniciansScreen() {
    const navigation = useNavigation();
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();

    const [technicians, setTechnicians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [statFilter, setStatFilter] = useState('total');
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [isFiltering, setIsFiltering] = useState(false);

    const [confirmModal, setConfirmModal] = useState({
        visible: false, icon: '', iconColor: serviceRed,
        title: '', description: '', primaryLabel: '', onConfirm: null,
    });

    // Yetki modal state'leri
    const [pSheet, setPSheet] = useState(false);
    const [draft, setDraft] = useState({});
    const [selectedTech, setSelectedTech] = useState(null);
    const [saving, setSaving] = useState(false);
    const closeModal = useCallback(() => setConfirmModal(p => ({ ...p, visible: false })), []);
    const pendingConfirmActionRef = useRef(null);

    const handleConfirmSheetDismiss = useCallback(() => {
        const pendingAction = pendingConfirmActionRef.current;
        pendingConfirmActionRef.current = null;

        if (typeof pendingAction === 'function') {
            pendingAction();
        }
    }, []);

    const [resultModal, setResultModal] = useState({ visible: false, type: 'success', title: '', description: '' });
    const openResultModal = useCallback((type, title, description) =>
        setResultModal({ visible: true, type, title, description }), []);
    const closeResultModal = useCallback(() => setResultModal(p => ({ ...p, visible: false })), []);

    const fetchTechnicians = useCallback(async () => {
        if (technicians.length === 0) {
            setLoading(true);
        }
        try {
            const res = await api.get(ENDPOINTS.TECHNICIAN.LIST);
            const rows = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
            setTechnicians(rows);
        } catch (err) {
            console.log('Technician list error:', err?.response?.data || err?.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchTechnicians(); }, [fetchTechnicians]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchTechnicians();
    }, [fetchTechnicians]);

    const stats = useMemo(() => ({
        total: technicians.length,
        online: technicians.filter(t => getTechStatusKey(t) === 'online').length,
        offline: technicians.filter(t => getTechStatusKey(t) === 'offline').length,
        passive: technicians.filter(t => getTechStatusKey(t) === 'passive').length,
    }), [technicians]);

    const filtered = useMemo(() => {
        let list = [...technicians];
        const statDef = STAT_DEFS.find(s => s.key === statFilter);
        if (statDef?.statusKey) list = list.filter(t => getTechStatusKey(t) === statDef.statusKey);
        if (statusFilter !== 'all') list = list.filter(t => getTechStatusKey(t) === statusFilter);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(t =>
                getFullName(t).toLowerCase().includes(q) ||
                (t?.user?.email || '').toLowerCase().includes(q) ||
                (t?.user?.phone_number || '').includes(q)
            );
        }
        return list;
    }, [technicians, statFilter, statusFilter, search]);

    const deactivateUser = useCallback(async (tech) => {
        if (!tech?.user?.id) return;
        setBusyId(tech.id);
        try {
            await api.delete(ENDPOINTS.AUTH.USER_DETAIL(tech.user.id));
            showToast('success', 'İşlem Başarılı', `${getFullName(tech)} başarıyla pasife alındı.`);
            fetchTechnicians();
        } catch (err) {
            openResultModal('error', 'Hata', err?.response?.data?.detail || err?.response?.data?.error || err?.message);
        } finally {
            setBusyId(null);
        }
    }, [fetchTechnicians, showToast, openResultModal]);

    const restoreUser = useCallback(async (tech) => {
        if (!tech?.user?.id) return;
        setBusyId(tech.id);
        try {
            await api.put(ENDPOINTS.AUTH.USER_DETAIL(tech.user.id));
            showToast('success', 'İşlem Başarılı', `${getFullName(tech)} başarıyla aktif edildi.`);
            fetchTechnicians();
        } catch (err) {
            openResultModal('error', 'Hata', err?.response?.data?.detail || err?.response?.data?.error || err?.message);
        } finally {
            setBusyId(null);
        }
    }, [fetchTechnicians, showToast, openResultModal]);

    const confirmDeactivate = useCallback((tech) => setConfirmModal({
        visible: true,
        icon: 'account-off-outline',
        iconColor: serviceRed,
        title: 'Teknisyeni Pasife Al',
        description: `${getFullName(tech)} hesabı pasife alınacak. İstediğinizde tekrar aktif edebilirsiniz.`,
        primaryLabel: 'Pasife Al',
        onConfirm: () => deactivateUser(tech),
    }), [deactivateUser]);

    const confirmRestore = useCallback((tech) => setConfirmModal({
        visible: true,
        icon: 'account-reactivate-outline',
        iconColor: serviceGreen,
        title: 'Hesabı Aktif Et',
        description: `${getFullName(tech)} hesabı yeniden aktif edilecek.`,
        primaryLabel: 'Aktif Et',
        onConfirm: () => restoreUser(tech),
    }), [restoreUser]);

    const handleNavigate = useCallback((action, tech) => {
        if (action === 'view' || action === 'detail') {
            navigation.navigate('TechnicianDetail', { technicianId: tech.id, technician: tech });
        } else if (action === 'permissions') {
            setSelectedTech(tech);
            setDraft({ ...(tech?.permissions || {}) });
            setPSheet(true);
        } else if (action === 'edit') {
            navigation.navigate('AdminEditTechnician', {
                technicianId: tech.id,
                technician: tech,
                onSuccess: (updatedTech) => {
                    setTechnicians(prev => prev.map(t =>
                        t.id === updatedTech.id ? { ...t, ...updatedTech } : t
                    ));
                },
            });
        } else if (action === 'locations') {
            navigation.navigate('TechnicianLocations', { technicianId: tech.id });
        } else if (action === 'shifts') {
            navigation.navigate('TechnicianShifts', { technicianId: tech.id });
        } else if (action === 'leave') {
            navigation.navigate('AdminTechnicianLeaves', { technicianId: tech.id });
        } else {
            console.log('navigate:', action, tech?.id);
        }
    }, [navigation]);

    const saveP = async () => {
        if (!selectedTech?.id) return;
        setSaving(true);
        try {
            const r = await api.patch(ENDPOINTS.TECHNICIAN.PERMISSIONS(selectedTech.id), draft);
            const updated = r?.data?.permissions || r?.data || draft;
            setTechnicians(prev => prev.map(t =>
                t.id === selectedTech.id
                    ? { ...t, permissions: { ...(t.permissions || {}), ...updated } }
                    : t
            ));
            setPSheet(false);
            showToast('success', 'Başarılı', 'Yetkiler güncellendi.');
        } catch (e) {
            showToast('error', 'Hata', e?.response?.data?.detail || 'Hata.');
        } finally {
            setSaving(false);
        }
    };

    const togP = (k) => setDraft((d) => ({ ...d, [k]: !d[k] }));

    const handleWhatsApp = useCallback((tech) => {
        const phone = String(tech?.user?.phone_number || '').replace(/[^\d+]/g, '');
        if (!phone) {
            openResultModal('error', 'Telefon Yok', 'Bu teknisyen için telefon numarası tanımlı değil.');
            return;
        }
        const normalized = phone.replace(/^\+/, '');
        Linking.openURL(`https://wa.me/${normalized}`).catch(() => {
            openResultModal('error', 'Açılamadı', 'WhatsApp başlatılamadı.');
        });
    }, [openResultModal]);

    const handleCall = useCallback((tech) => {
        const phone = String(tech?.user?.phone_number || '').replace(/[^\d+]/g, '');
        if (!phone) {
            openResultModal('error', 'Telefon Yok', 'Bu teknisyen için telefon numarası tanımlı değil.');
            return;
        }
        Linking.openURL(`tel:${phone}`).catch(() => {
            openResultModal('error', 'Açılamadı', 'Telefon uygulaması açılamadı.');
        });
    }, [openResultModal]);

    const cardBg = isDark ? '#1E2736' : '#FFFFFF';
    const surfaceBg = isDark ? '#111827' : '#F8FAFC';

    const renderItem = useCallback(({ item }) => (
        <TechnicianCard
            tech={item}
            colors={colors}
            isDark={isDark}
            busyId={busyId}
            onDeactivate={confirmDeactivate}
            onRestore={confirmRestore}
            onNavigate={handleNavigate}
            onWhatsApp={handleWhatsApp}
            onCall={handleCall}
        />
    ), [colors, isDark, busyId, confirmDeactivate, confirmRestore, handleNavigate, handleWhatsApp, handleCall]);

    const ListHeader = useMemo(() => (
        <View>
            {/* Stat kartları */}
            <View style={styles.statsRow}>
                {loading
                    ? STAT_DEFS.map(s => (
                        <View
                            key={s.key}
                            style={[
                                styles.statCard,
                                {
                                    backgroundColor: cardBg,
                                    borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9',
                                },
                                { alignItems: 'center', justifyContent: 'center', minHeight: 70 },
                            ]}
                        >
                            <ActivityIndicator size="small" color={serviceBlue} />
                        </View>
                    ))
                    : STAT_DEFS.map(s => {
                        const count = s.key === 'total' ? stats.total : stats[s.key] ?? 0;
                        const active = statFilter === s.key;
                        return (
                            <Pressable
                                key={s.key}
                                onPress={() => {
                                    if (isFiltering) return;
                                    setIsFiltering(true);
                                    setTimeout(() => {
                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                        setStatFilter(p => p === s.key ? 'total' : s.key);
                                        setIsFiltering(false);
                                    }, 100);
                                }}
                                style={[
                                    styles.statCard,
                                    {
                                        backgroundColor: active ? s.iconColor + '18' : cardBg,
                                        borderColor: active ? s.iconColor : (isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9'),
                                        borderWidth: active ? 1.5 : 1,
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons name={s.icon} size={20} color={s.iconColor} />
                                <Text style={[styles.statCount, { color: colors.text }]}>{count}</Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{s.label}</Text>
                            </Pressable>
                        );
                    })
                }
            </View>

            {/* Durum tab filtreleri */}
            <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
                {STATUS_FILTERS.map(f => {
                    const active = f.key === statusFilter;
                    return (
                        <Pressable
                            key={f.key}
                            onPress={() => {
                                if (isFiltering) return;
                                setIsFiltering(true);
                                setTimeout(() => {
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setStatusFilter(f.key);
                                    setIsFiltering(false);
                                }, 100);
                            }}
                            style={[styles.filterTab, { borderBottomColor: active ? colors.primary : 'transparent' }]}
                        >
                            <Text style={[styles.filterTabText, { color: active ? colors.primary : colors.textSecondary }]}>
                                {f.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Arama */}
            <View style={[styles.searchWrap, { backgroundColor: cardBg, borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]}>
                <MaterialCommunityIcons name="magnify" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Teknisyen ara..."
                    placeholderTextColor={colors.textSecondary}
                    value={search}
                    onChangeText={setSearch}
                    returnKeyType="search"
                />
                {search.length > 0 && (
                    <Pressable onPress={() => setSearch('')} hitSlop={8}>
                        <MaterialCommunityIcons name="close-circle" size={16} color={colors.textSecondary} />
                    </Pressable>
                )}
            </View>
        </View>
    ), [stats, statFilter, statusFilter, search, cardBg, colors, isDark, loading]);

    return (
        <>
            <WrapperContainer edges={NO_BOTTOM_EDGES} style={{ flex: 1, backgroundColor: surfaceBg }}>
                <Header
                    title="Teknisyenler"
                    subtitle="Teknisyen yönetimi"
                    showBack
                    borderBottom
                    rightActions={[{ icon: 'account-plus-outline', onPress: () => navigation.navigate('AdminCreateUser'), accessibilityLabel: 'Teknisyen Ekle' }]}
                />

                <FlatList
                    data={filtered}
                    keyExtractor={item => String(item.id)}
                    renderItem={renderItem}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={ListHeader}
                    ListEmptyComponent={
                        loading ? (
                            <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                                <ActivityIndicator size="large" color={serviceBlue} />
                                <Text style={{ marginTop: 16, fontSize: 14, fontWeight: '500', color: colors.textSecondary }}>Teknisyenler Yükleniyor...</Text>
                            </View>
                        ) : (
                            <View style={styles.emptyWrap}>
                                <MaterialCommunityIcons name="account-hard-hat-outline" size={48} color={colors.textSecondary} />
                                <Text style={[styles.emptyTitle, { color: colors.text }]}>Teknisyen bulunamadı</Text>
                                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                                    Filtre veya arama kriterlerini değiştirin.
                                </Text>
                            </View>
                        )
                    }
                />

                {/* Filtreleme Yükleniyor Overlay */}
                {isFiltering && (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }]}>
                        <View style={{ backgroundColor: isDark ? '#1E293B' : '#FFFFFF', padding: 24, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={serviceBlue} />
                            <Text style={{ marginTop: 12, fontWeight: '600', color: colors.text }}>Filtreleniyor...</Text>
                        </View>
                    </View>
                )}
            </WrapperContainer>

            {/* Onay Sheet */}
            <AppBottomSheet
                visible={confirmModal.visible}
                onClose={closeModal}
                onDismissComplete={handleConfirmSheetDismiss}
                snapPoints={['40%']}
            >
                <View style={styles.sheetContent}>
                    <View style={[styles.confirmIcon, { backgroundColor: confirmModal.iconColor + '15' }]}>
                        <MaterialCommunityIcons name={confirmModal.icon} size={26} color={confirmModal.iconColor} />
                    </View>
                    <Text style={[styles.confirmTitle, { color: colors.text }]}>{confirmModal.title}</Text>
                    <Text style={[styles.confirmDesc, { color: colors.textSecondary }]}>{confirmModal.description}</Text>
                    <View style={styles.confirmRow}>
                        <Pressable
                            onPress={closeModal}
                            style={[styles.confirmBtn, styles.confirmBtnOutline, { borderColor: colors.border }]}
                        >
                            <Text style={[styles.confirmBtnText, { color: colors.text }]}>Vazgeç</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => {
                                pendingConfirmActionRef.current = confirmModal.onConfirm;
                                closeModal();
                            }}
                            style={[styles.confirmBtn, { backgroundColor: confirmModal.iconColor }]}
                        >
                            <Text style={styles.confirmBtnText}>{confirmModal.primaryLabel}</Text>
                        </Pressable>
                    </View>
                </View>
            </AppBottomSheet>

            {/* Sonuç Sheet */}
            <AppBottomSheet
                visible={resultModal.visible}
                onClose={closeResultModal}
                snapPoints={['35%']}
            >
                <View style={styles.sheetContent}>
                    <View style={[styles.centeredIcon, { backgroundColor: resultModal.type === 'success' ? '#10B98115' : '#E11D4815' }]}>
                        <MaterialCommunityIcons
                            name={resultModal.type === 'success' ? 'check-decagram-outline' : 'alert-circle-outline'}
                            size={28}
                            color={resultModal.type === 'success' ? '#10B981' : '#E11D48'}
                        />
                    </View>
                    <Text style={[styles.centeredTitle, { color: colors.text }]}>{resultModal.title}</Text>
                    <Text style={[styles.centeredDesc, { color: colors.textSecondary }]}>{resultModal.description}</Text>
                    <Pressable
                        onPress={closeResultModal}
                        style={[styles.centeredBtn, { backgroundColor: resultModal.type === 'success' ? '#10B981' : '#E11D48' }]}
                    >
                        <Text style={styles.centeredBtnText}>Tamam</Text>
                    </Pressable>
                </View>
            </AppBottomSheet>
            {/* Yetki Düzenleme Modal (Doğrudan bu sayfa üzerinde) */}
            <AppBottomSheet visible={pSheet} onClose={() => setPSheet(false)} snapPoints={['90%']} wrapContent={false}>
                <View style={[styles.shc, { flex: 1, paddingHorizontal: 20, paddingTop: 8 }]}>
                    <View style={styles.shtr}><Text style={[styles.shtt, { color: colors.text }]}>Yetki Düzenle</Text><Pressable onPress={() => setPSheet(false)}><MaterialCommunityIcons name='close' size={20} color={colors.textSecondary} /></Pressable></View>
                    <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.plist, { paddingBottom: 16 }]}>
                        {PERMS.map((o) => <PER key={o.key} item={o} value={Boolean(draft[o.key])} onToggle={togP} colors={colors} />)}
                        <View style={[styles.shbs, { marginTop: 8, paddingBottom: 22 }]}><Pressable onPress={() => setPSheet(false)} style={[styles.cbtn, { borderColor: colors.border }]}><Text style={[styles.cbtnT, { color: colors.textSecondary }]}>Vazgeç</Text></Pressable><Pressable onPress={saveP} disabled={saving} style={[styles.savbtn, { backgroundColor: serviceBlue, opacity: saving ? 0.7 : 1 }]}>{saving ? <ActivityIndicator size='small' color='#fff' /> : <Text style={styles.savbtnT}>Kaydet</Text>}</Pressable></View>
                    </BottomSheetScrollView>
                </View>
            </AppBottomSheet>
        </>
    );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    listContent: { padding: 16, paddingBottom: 100, gap: 12 },

    // Stat
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    statCard: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, gap: 4 },
    statCount: { fontSize: 18, fontWeight: '800' },
    statLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

    // Tab filtre
    filterRow: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 14 },
    filterTab: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2 },
    filterTabText: { fontSize: 13, fontWeight: '700' },

    // Arama
    searchWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, height: 44, marginBottom: 14 },
    searchInput: { flex: 1, fontSize: 14, height: 44 },

    // Kart
    card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
    avatarWrap: { position: 'relative' },
    avatar: { width: 50, height: 50, borderRadius: 25 },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 16, fontWeight: '800' },
    onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, borderWidth: 2 },
    name: { fontSize: 15, fontWeight: '800' },
    role: { fontSize: 12, marginTop: 2 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
    badgeText: { fontSize: 11, fontWeight: '700' },

    // Bilgi satırı
    infoRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, gap: 12 },
    infoItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
    infoLabel: { fontSize: 11 },
    infoValue: { fontSize: 12, fontWeight: '700', marginLeft: 2 },

    // Hızlı aksiyonlar (WhatsApp / Ara / Detay)
    quickActions: { flexDirection: 'row', borderTopWidth: 1, padding: 10, gap: 8 },
    quickAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10 },
    quickActionText: { fontSize: 13, fontWeight: '700' },

    // Alt aksiyonlar (Grid)
    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, padding: 10, gap: 8, justifyContent: 'space-between' },
    actionLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6, paddingVertical: 10, borderRadius: 10 },
    actionLinkText: { fontSize: 12, fontWeight: '700' },

    // Empty
    emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 8 },
    emptyTitle: { fontSize: 16, fontWeight: '700' },
    emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 32 },

    // Confirm sheet
    sheetContent: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
    confirmIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    confirmTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
    confirmDesc: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 16 },
    confirmRow: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
    confirmBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    confirmBtnOutline: { backgroundColor: 'transparent', borderWidth: 1 },
    confirmBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

    // Result sheet
    centeredIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    centeredTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
    centeredDesc: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 16 },
    centeredBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, alignSelf: 'stretch', alignItems: 'center' },
    centeredBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

    // Yetki modal ek stilleri
    permRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
    permIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    permLabel: { fontSize: 13, fontWeight: '700' },
    switchTrack: { width: 42, height: 26, borderRadius: 999, paddingHorizontal: 3, justifyContent: 'center' },
    switchKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
    switchKnobOn: { alignSelf: 'flex-end' },
    shc: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 14 },
    shtr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    shtt: { fontSize: 20, fontWeight: '800' },
    shbs: { flexDirection: 'row', gap: 12 },
    cbtn: { flex: 1, height: 50, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    cbtnT: { fontSize: 15, fontWeight: '700' },
    savbtn: { flex: 1.1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    savbtnT: { color: '#fff', fontSize: 15, fontWeight: '800' },
    plist: { gap: 8 },
});
