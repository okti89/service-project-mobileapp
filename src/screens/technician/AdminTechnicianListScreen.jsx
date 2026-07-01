import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    Keyboard,
    Linking,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

import { useTheme } from '@/context/ThemeContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import AppBottomSheet from '@/components/AppBottomSheet';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';

const STATUS_META = {
    available: { label: 'Müsait', color: '#22C55E', icon: 'check-circle' },
    offduty: { label: 'İzinli', color: '#F59E0B', icon: 'moon-waning-crescent' },
    busy: { label: 'Meşgul', color: '#EF4444', icon: 'progress-clock' },
    active: { label: 'Aktif', color: serviceBlue, icon: 'account-check' },
};

const FILTER_TABS = [
    { key: 'all', label: 'Tümü', icon: 'account-group-outline', color: serviceBlue },
    { key: 'active', label: 'Aktif', icon: 'shield-check-outline', color: '#22C55E' },
    { key: 'online', label: 'Çevrimiçi', icon: 'access-point', color: serviceBlue },
    { key: 'offduty', label: 'İzinli', icon: 'moon-waning-crescent', color: '#F59E0B' },
    { key: 'inactive', label: 'Pasif', icon: 'account-cancel-outline', color: '#64748B' },
];

const PERMISSION_FIELDS = [
    { key: 'can_manage_customers', label: 'Müşterileri Yönetebilir', icon: 'account-box-multiple-outline' },
    { key: 'can_manage_inventory', label: 'Envanteri Yönetebilir', icon: 'package-variant-closed' },
    { key: 'can_manage_users', label: 'Kullanıcıları Yönetebilir', icon: 'account-cog-outline' },
    { key: 'can_manage_accounting', label: 'Muhasebeyi Yönetebilir', icon: 'finance' },
    { key: 'can_manage_notifications', label: 'Bildirimleri Yönetebilir', icon: 'bell-outline' },
    { key: 'can_manage_hr', label: 'İK Yönetebilir', icon: 'account-tie-outline' },
    { key: 'can_manage_reports', label: 'Raporları Yönetebilir', icon: 'chart-box-outline' },
    { key: 'can_manage_settings', label: 'Ayarları Yönetebilir', icon: 'cog-outline' },
    { key: 'can_manage_services', label: 'Servisleri Yönetebilir', icon: 'wrench-outline' },
    { key: 'can_manage_technicians', label: 'Teknisyenleri Yönetebilir', icon: 'account-hard-hat-outline' },
];

const DEFAULT_PERMISSIONS = PERMISSION_FIELDS.reduce((acc, field) => {
    acc[field.key] = false;
    return acc;
}, {});

const DEFAULT_FORM = {
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    password: '',
    hire_date: new Date().toISOString().slice(0, 10),
    status: 'available',
    permissions: { ...DEFAULT_PERMISSIONS },
};

const normalizeStatusValue = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'available';
    if (['offduty', 'izinli', 'on_leave', 'leave'].includes(raw)) return 'offduty';
    if (['busy', 'mesgul', 'meşgul'].includes(raw)) return 'busy';
    if (['available', 'musait', 'müsait'].includes(raw)) return 'available';
    return raw;
};

const resolveStatusColor = (tech, statusOptions) => {
    const code = normalizeStatusValue(tech?.status);
    const fromOptions = statusOptions.find(
        (item) => normalizeStatusValue(item.value || item.name) === code,
    )?.color;
    if (fromOptions) return fromOptions;
    if (tech?.status_info?.color) return tech.status_info.color;
    return STATUS_META[code]?.color || serviceBlue;
};

const resolveStatusLabel = (tech) => {
    if (tech?.status_display) return tech.status_display;
    const code = normalizeStatusValue(tech?.status);
    return STATUS_META[code]?.label || tech?.status || '-';
};

const getFullName = (tech) =>
    tech?.user?.full_name ||
    `${tech?.user?.first_name || ''} ${tech?.user?.last_name || ''}`.trim() ||
    'Teknisyen';

const getInitials = (name) =>
    String(name || '')
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('tr-TR');
};

const TechnicianCard = ({ technician, statusOptions, onPress, onEdit, onDeactivate, onRestore, onPermissions, onLocation, onServices, onShifts, onPerformance, onCall, onWhatsapp, onEmail, index = 0 }) => {
    const { colors, isDark } = useTheme();
    const fullName = getFullName(technician);
    const initials = getInitials(fullName);
    const avatar = technician.user?.avatar_url || technician.user?.avatar;
    const isActive = technician.user?.is_active !== false;
    const isOnline = Boolean(technician.is_online);
    const statusColor = resolveStatusColor(technician, statusOptions);
    const statusLabel = resolveStatusLabel(technician);
    const phone = technician.user?.phone_number;
    const email = technician.user?.email;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(8)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 320,
                delay: Math.min(index, 8) * 30,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 320,
                delay: Math.min(index, 8) * 30,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, slideAnim, index]);

    const quickActions = [
        { key: 'location', label: 'Konum', icon: 'map-marker-radius', color: serviceBlue, onPress: onLocation },
        { key: 'services', label: 'Servisler', icon: 'clipboard-list-outline', color: '#F59E0B', onPress: onServices },
        { key: 'shifts', label: 'Mesailer', icon: 'calendar-clock', color: '#EC4899', onPress: onShifts },
        { key: 'performance', label: 'Performans', icon: 'chart-line-variant', color: '#22C55E', onPress: onPerformance },
        { key: 'permissions', label: 'Yetkiler', icon: 'shield-account-outline', color: '#8B5CF6', onPress: onPermissions },
        { key: 'edit', label: 'Düzenle', icon: 'pencil-outline', color: serviceGreen, onPress: onEdit },
    ];

    return (
        <Animated.View
            style={[
                styles.card,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                },
            ]}
        >
            <Pressable onPress={onPress} style={styles.cardPressable}>
                <View style={styles.cardTopRow}>
                    <View style={[styles.avatarRing, { borderColor: statusColor }]}>
                        {avatar ? (
                            <Image source={{ uri: avatar }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatarFallback, { backgroundColor: `${statusColor}20` }]}>
                                <Text style={[styles.avatarText, { color: statusColor }]}>{initials}</Text>
                            </View>
                        )}
                        {isOnline ? (
                            <View
                                style={[
                                    styles.onlineDot,
                                    {
                                        backgroundColor: '#22C55E',
                                        borderColor: colors.surface,
                                    },
                                ]}
                            />
                        ) : null}
                    </View>

                    <View style={styles.cardInfo}>
                        <View style={styles.nameRow}>
                            <Text
                                style={[styles.name, { color: colors.text, opacity: isActive ? 1 : 0.5 }]}
                                numberOfLines={1}
                            >
                                {fullName}
                            </Text>
                            <View
                                style={[
                                    styles.statusBadge,
                                    {
                                        backgroundColor: `${statusColor}15`,
                                        borderColor: `${statusColor}30`,
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons name="circle" size={7} color={statusColor} />
                                <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                            </View>
                        </View>
                        {email ? (
                            <View style={styles.metaLine}>
                                <MaterialCommunityIcons
                                    name="email-outline"
                                    size={12}
                                    color={colors.textTertiary}
                                />
                                <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {email}
                                </Text>
                            </View>
                        ) : null}
                        {phone ? (
                            <View style={styles.metaLine}>
                                <MaterialCommunityIcons
                                    name="phone-outline"
                                    size={12}
                                    color={colors.textTertiary}
                                />
                                <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {phone}
                                </Text>
                            </View>
                        ) : null}
                        <View style={styles.metaLine}>
                            <MaterialCommunityIcons
                                name="briefcase-outline"
                                size={12}
                                color={colors.textTertiary}
                            />
                            <Text style={[styles.metaText, { color: colors.textTertiary }]} numberOfLines={1}>
                                {`İşe başlama: ${formatDate(technician.hire_date)}`}
                            </Text>
                        </View>
                    </View>
                </View>

                <View
                    style={[
                        styles.quickRow,
                        { backgroundColor: isDark ? colors.surfaceMuted : colors.backgroundSecondary },
                    ]}
                >
                    <Pressable
                        onPress={onCall}
                        disabled={!phone}
                        style={({ pressed }) => [styles.quickBtn, { opacity: !phone ? 0.4 : pressed ? 0.7 : 1 }]}
                    >
                        <View style={[styles.quickIcon, { backgroundColor: `${serviceBlue}15` }]}>
                            <MaterialCommunityIcons name="phone" size={14} color={serviceBlue} />
                        </View>
                        <Text style={[styles.quickText, { color: colors.text }]}>Ara</Text>
                    </Pressable>
                    <View style={[styles.quickDivider, { backgroundColor: colors.divider }]} />
                    <Pressable
                        onPress={onWhatsapp}
                        disabled={!phone}
                        style={({ pressed }) => [styles.quickBtn, { opacity: !phone ? 0.4 : pressed ? 0.7 : 1 }]}
                    >
                        <View style={[styles.quickIcon, { backgroundColor: '#25D36615' }]}>
                            <MaterialCommunityIcons name="whatsapp" size={14} color="#25D366" />
                        </View>
                        <Text style={[styles.quickText, { color: colors.text }]}>WhatsApp</Text>
                    </Pressable>
                    <View style={[styles.quickDivider, { backgroundColor: colors.divider }]} />
                    <Pressable
                        onPress={onEmail}
                        disabled={!email}
                        style={({ pressed }) => [styles.quickBtn, { opacity: !email ? 0.4 : pressed ? 0.7 : 1 }]}
                    >
                        <View style={[styles.quickIcon, { backgroundColor: `${serviceRed}15` }]}>
                            <MaterialCommunityIcons name="email" size={14} color={serviceRed} />
                        </View>
                        <Text style={[styles.quickText, { color: colors.text }]}>E-posta</Text>
                    </Pressable>
                </View>
            </Pressable>

            <View style={styles.actionsGrid}>
                {quickActions.map((action) => (
                    <Pressable
                        key={action.key}
                        onPress={action.onPress}
                        style={({ pressed }) => [
                            styles.actionChip,
                            {
                                backgroundColor: pressed ? `${action.color}25` : `${action.color}10`,
                                borderColor: `${action.color}30`,
                            },
                        ]}
                    >
                        <View style={[styles.actionIconWrap, { backgroundColor: `${action.color}20` }]}>
                            <MaterialCommunityIcons name={action.icon} size={14} color={action.color} />
                        </View>
                        <Text style={[styles.actionLabel, { color: action.color }]} numberOfLines={1}>
                            {action.label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <View style={styles.cardFooter}>
                {isActive ? (
                    <Pressable
                        onPress={onDeactivate}
                        style={({ pressed }) => [styles.dangerBtn, { opacity: pressed ? 0.7 : 1 }]}
                    >
                        <MaterialCommunityIcons name="account-cancel-outline" size={14} color={serviceRed} />
                        <Text style={[styles.dangerText, { color: serviceRed }]}>Pasife Al</Text>
                    </Pressable>
                ) : (
                    <Pressable
                        onPress={onRestore}
                        style={({ pressed }) => [
                            styles.restoreBtn,
                            { backgroundColor: pressed ? '#22C55E25' : '#22C55E15', borderColor: '#22C55E30', opacity: pressed ? 0.85 : 1 },
                        ]}
                    >
                        <MaterialCommunityIcons name="restore" size={14} color="#22C55E" />
                        <Text style={[styles.dangerText, { color: '#22C55E' }]}>Geri Getir</Text>
                    </Pressable>
                )}
            </View>
        </Animated.View>
    );
};

const StatCard = ({ icon, label, value, color, isDark, onPress, active }) => {
    const { colors } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.statCard,
                {
                    backgroundColor: active ? `${color}18` : isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                    borderColor: active ? `${color}60` : `${color}30`,
                    opacity: pressed ? 0.85 : 1,
                },
            ]}
        >
            <View style={[styles.statIconWrap, { backgroundColor: `${color}18` }]}>
                <MaterialCommunityIcons name={icon} size={16} color={color} />
            </View>
            <Text style={[styles.statValue, { color: active ? color : colors.text }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: active ? color : '#5C6370' }]}>{label}</Text>
        </Pressable>
    );
};

export default function AdminTechnicianListScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();

    const [technicians, setTechnicians] = useState([]);
    const [statusOptions, setStatusOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [savingStatusById, setSavingStatusById] = useState({});

    const [showFormSheet, setShowFormSheet] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState(DEFAULT_FORM);
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [showPermissionSheet, setShowPermissionSheet] = useState(false);
    const [permissionForm, setPermissionForm] = useState({ ...DEFAULT_PERMISSIONS });
    const [isSavingPermissions, setIsSavingPermissions] = useState(false);
    const [permissionTech, setPermissionTech] = useState(null);

    const formSheetRef = useRef(null);
    const permissionSheetRef = useRef(null);

    const fetchTechnicians = useCallback(async () => {
        try {
            const response = await api.get(ENDPOINTS.TECHNICIAN.LIST);
            setTechnicians(Array.isArray(response?.data) ? response.data : []);
        } catch (error) {
            console.log(
                'Admin Technicians fetch error:',
                error?.response?.data || error?.message || error,
            );
            Alert.alert('Hata', 'Teknisyenler yüklenemedi.');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchStatuses = useCallback(async () => {
        try {
            const response = await api.get('/technicians/statuses/');
            const list = Array.isArray(response?.data) ? response.data : [];
            if (list.length > 0) {
                setStatusOptions(
                    list.map((item) => ({
                        value: item.name,
                        label: item.name,
                        color: item.color || '',
                    })),
                );
            } else {
                setStatusOptions([
                    { value: 'available', label: 'Müsait', color: '#28a745' },
                    { value: 'offduty', label: 'İzinli', color: '#f59e0b' },
                ]);
            }
        } catch (e) {
            setStatusOptions([
                { value: 'available', label: 'Müsait', color: '#28a745' },
                { value: 'offduty', label: 'İzinli', color: '#f59e0b' },
            ]);
        }
    }, []);

    useEffect(() => {
        fetchTechnicians();
        fetchStatuses();
    }, [fetchTechnicians, fetchStatuses]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchTechnicians(), fetchStatuses()]);
        setRefreshing(false);
    };

    const counts = useMemo(() => {
        const list = Array.isArray(technicians) ? technicians : [];
        const active = list.filter((t) => t.user?.is_active !== false);
        return {
            total: list.length,
            active: active.length,
            online: active.filter((t) => t.is_online).length,
            offduty: active.filter((t) => normalizeStatusValue(t.status) === 'offduty').length,
            inactive: list.filter((t) => t.user?.is_active === false).length,
        };
    }, [technicians]);

    const filtered = useMemo(() => {
        let list = Array.isArray(technicians) ? technicians : [];
        if (activeFilter === 'active') {
            list = list.filter((t) => t.user?.is_active !== false);
        } else if (activeFilter === 'online') {
            list = list.filter((t) => t.user?.is_active !== false && t.is_online);
        } else if (activeFilter === 'offduty') {
            list = list.filter((t) => t.user?.is_active !== false && normalizeStatusValue(t.status) === 'offduty');
        } else if (activeFilter === 'inactive') {
            list = list.filter((t) => t.user?.is_active === false);
        }

        const term = String(search || '').trim().toLocaleLowerCase('tr-TR');
        if (term) {
            list = list.filter((t) => {
                const fullName = getFullName(t);
                const email = t.user?.email || '';
                const phone = t.user?.phone_number || '';
                return (
                    fullName.toLocaleLowerCase('tr-TR').includes(term) ||
                    email.toLocaleLowerCase('tr-TR').includes(term) ||
                    phone.toLocaleLowerCase('tr-TR').includes(term)
                );
            });
        }
        return list;
    }, [technicians, activeFilter, search]);

    const openCreateForm = () => {
        setEditingId(null);
        setFormData({ ...DEFAULT_FORM, permissions: { ...DEFAULT_PERMISSIONS } });
        setShowPassword(false);
        setShowFormSheet(true);
    };

    const openEditForm = (tech) => {
        setEditingId(tech.id);
        setFormData({
            first_name: tech.user?.first_name || '',
            last_name: tech.user?.last_name || '',
            email: tech.user?.email || '',
            phone_number: tech.user?.phone_number || '',
            password: '',
            hire_date: tech.hire_date || new Date().toISOString().slice(0, 10),
            status: normalizeStatusValue(tech.status),
            permissions: tech.permissions ? { ...DEFAULT_PERMISSIONS, ...tech.permissions } : { ...DEFAULT_PERMISSIONS },
        });
        setShowPassword(false);
        setShowFormSheet(true);
    };

    const closeFormSheet = () => {
        setShowFormSheet(false);
        setEditingId(null);
        setFormData(DEFAULT_FORM);
        setIsSubmitting(false);
    };

    const handleFieldChange = (key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const handlePermissionToggleInForm = (key, value) => {
        setFormData((prev) => ({
            ...prev,
            permissions: { ...prev.permissions, [key]: value },
        }));
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;
        Keyboard.dismiss();

        if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.email.trim()) {
            Alert.alert('Uyarı', 'Ad, soyad ve e-posta zorunludur.');
            return;
        }
        if (!editingId && !formData.password.trim()) {
            Alert.alert('Uyarı', 'Yeni teknisyen için şifre zorunludur.');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingId) {
                await api.patch(`/technicians/technician/${editingId}/`, {
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    email: formData.email,
                    phone_number: formData.phone_number || null,
                    hire_date: formData.hire_date,
                    status: formData.status,
                });
                await api.patch(`/technicians/technician/${editingId}/permissions/`, {
                    ...formData.permissions,
                });
                Alert.alert('Başarılı', 'Teknisyen güncellendi.');
            } else {
                await api.post('/technicians/technician-list/', {
                    hire_date: formData.hire_date,
                    status: formData.status,
                    user_data: {
                        first_name: formData.first_name,
                        last_name: formData.last_name,
                        email: formData.email,
                        phone_number: formData.phone_number || null,
                        user_type: 'technician',
                        password: formData.password,
                    },
                    permissions: { ...formData.permissions },
                });
                Alert.alert('Başarılı', 'Yeni teknisyen eklendi.');
            }
            closeFormSheet();
            await fetchTechnicians();
        } catch (error) {
            const message =
                error?.response?.data?.detail ||
                error?.response?.data?.error ||
                error?.message ||
                'İşlem başarısız.';
            Alert.alert('Hata', typeof message === 'string' ? message : 'İşlem başarısız.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openPermissionsSheet = async (tech) => {
        setPermissionTech(tech);
        setPermissionForm({ ...DEFAULT_PERMISSIONS, ...(tech?.permissions || {}) });
        setShowPermissionSheet(true);
        try {
            const response = await api.get(`/technicians/technician/${tech.id}/permissions/`);
            setPermissionForm({ ...DEFAULT_PERMISSIONS, ...(response?.data || {}) });
        } catch (e) {
            // sessiz yut, modal zaten açıldı
        }
    };

    const closePermissionsSheet = () => {
        setShowPermissionSheet(false);
        setPermissionTech(null);
        setIsSavingPermissions(false);
    };

    const handleSavePermissions = async () => {
        if (!permissionTech) return;
        setIsSavingPermissions(true);
        try {
            await api.patch(`/technicians/technician/${permissionTech.id}/permissions/`, permissionForm);
            Alert.alert('Başarılı', 'Yetkiler güncellendi.');
            closePermissionsSheet();
            await fetchTechnicians();
        } catch (error) {
            Alert.alert('Hata', 'Yetkiler kaydedilemedi.');
        } finally {
            setIsSavingPermissions(false);
        }
    };

    const handleStatusChange = async (tech, nextRaw) => {
        const next = normalizeStatusValue(nextRaw);
        const current = normalizeStatusValue(tech.status);
        if (!tech?.id || next === current) return;
        setSavingStatusById((prev) => ({ ...prev, [tech.id]: true }));
        try {
            await api.patch(`/technicians/technician/${tech.id}/`, { status: next });
            await fetchTechnicians();
        } catch (e) {
            Alert.alert('Hata', 'Durum güncellenemedi.');
        } finally {
            setSavingStatusById((prev) => ({ ...prev, [tech.id]: false }));
        }
    };

    const handleDeactivate = (tech) => {
        Alert.alert('Onay', `${getFullName(tech)} adlı teknisyeni pasife almak istiyor musunuz?`, [
            { text: 'Vazgeç', style: 'cancel' },
            {
                text: 'Pasife Al',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await api.delete(`/technicians/technician/${tech.id}/`);
                        await fetchTechnicians();
                    } catch (e) {
                        Alert.alert('Hata', 'İşlem başarısız.');
                    }
                },
            },
        ]);
    };

    const handleRestore = async (tech) => {
        try {
            await api.post(`/technicians/technician/${tech.id}/restore/`);
            await fetchTechnicians();
        } catch (e) {
            Alert.alert('Hata', 'Teknisyen geri getirilemedi.');
        }
    };

    const openLink = (url) => Linking.openURL(url).catch(() => {});

    const handleCall = (tech) => {
        const phone = (tech.user?.phone_number || '').replace(/\D/g, '');
        if (!phone) return;
        openLink(`tel:${phone}`);
    };
    const handleWhatsapp = (tech) => {
        const phone = (tech.user?.phone_number || '').replace(/\D/g, '');
        if (!phone) return;
        openLink(`https://wa.me/${phone}`);
    };
    const handleEmail = (tech) => {
        const email = tech.user?.email;
        if (!email) return;
        openLink(`mailto:${email}`);
    };

    const handleLocation = (tech) => {
        navigation.navigate('AdminTechnicianLocations', { technicianId: tech.id, technicianName: getFullName(tech) });
    };
    const handleServices = (tech) => {
        navigation.navigate('AdminServices', { technicianId: tech.id, technicianName: getFullName(tech) });
    };
    const handleShifts = (tech) => {
        navigation.navigate('AdminTechnicianShifts', { technicianId: tech.id, technicianName: getFullName(tech) });
    };
    const handlePerformance = (tech) => {
        navigation.navigate('AdminTechnicianPerformance', { technicianId: tech.id, technicianName: getFullName(tech) });
    };

    const handleCardPress = (tech) => {
        if (navigation?.navigate) {
            navigation.navigate('TechnicianDetail', { technicianId: tech.id });
        }
    };

    const isFormValid =
        formData.first_name.trim() && formData.last_name.trim() && formData.email.trim() && (editingId || formData.password.trim());

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <LinearGradient
                colors={isDark ? [`${serviceBlue}30`, `${serviceBlue}00`] : [`${serviceBlue}14`, `${serviceBlue}00`]}
                style={[styles.headerGradient, { paddingTop: insets.top + 8 }]}
            >
                <View style={styles.headerRow}>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        style={({ pressed }) => [
                            styles.headerBtn,
                            {
                                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                                borderColor: colors.border,
                                opacity: pressed ? 0.7 : 1,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                    </Pressable>
                    <View style={styles.headerTitleWrap}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Teknisyenler</Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                            Saha ekibini yönet
                        </Text>
                    </View>
                    <Pressable
                        onPress={handleRefresh}
                        style={({ pressed }) => [
                            styles.headerBtn,
                            {
                                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                                borderColor: colors.border,
                                opacity: pressed ? 0.7 : 1,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons name="refresh" size={20} color={colors.primary} />
                    </Pressable>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 100 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                        progressBackgroundColor={isDark ? colors.surface : '#FFFFFF'}
                    />
                }
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.statsGrid}>
                    <StatCard
                        icon="account-group"
                        label="Toplam"
                        value={counts.total}
                        color={serviceBlue}
                        isDark={isDark}
                        active={activeFilter === 'all'}
                        onPress={() => setActiveFilter('all')}
                    />
                    <StatCard
                        icon="shield-check-outline"
                        label="Aktif"
                        value={counts.active}
                        color="#22C55E"
                        isDark={isDark}
                        active={activeFilter === 'active'}
                        onPress={() => setActiveFilter('active')}
                    />
                    <StatCard
                        icon="access-point"
                        label="Çevrimiçi"
                        value={counts.online}
                        color="#0EA5E9"
                        isDark={isDark}
                        active={activeFilter === 'online'}
                        onPress={() => setActiveFilter('online')}
                    />
                    <StatCard
                        icon="moon-waning-crescent"
                        label="İzinli"
                        value={counts.offduty}
                        color="#F59E0B"
                        isDark={isDark}
                        active={activeFilter === 'offduty'}
                        onPress={() => setActiveFilter('offduty')}
                    />
                </View>

                <View
                    style={[
                        styles.searchWrap,
                        { backgroundColor: isDark ? colors.surface : '#FFFFFF', borderColor: colors.border },
                    ]}
                >
                    <MaterialCommunityIcons name="magnify" size={18} color={colors.textTertiary} />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="İsim, e-posta veya telefon ile ara"
                        placeholderTextColor={colors.textTertiary}
                        style={[styles.searchInput, { color: colors.text }]}
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    {search ? (
                        <Pressable onPress={() => setSearch('')} hitSlop={8}>
                            <MaterialCommunityIcons name="close-circle" size={16} color={colors.textTertiary} />
                        </Pressable>
                    ) : null}
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                >
                    {FILTER_TABS.map((tab) => {
                        const isActive = activeFilter === tab.key;
                        const color = tab.color || serviceBlue;
                        const tabCount = counts[tab.key] ?? 0;
                        return (
                            <Pressable
                                key={tab.key}
                                onPress={() => setActiveFilter(tab.key)}
                                style={({ pressed }) => [
                                    styles.filterChip,
                                    {
                                        backgroundColor: isActive ? `${color}15` : isDark ? colors.surface : '#FFFFFF',
                                        borderColor: isActive ? `${color}50` : colors.border,
                                        opacity: pressed ? 0.85 : 1,
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name={tab.icon}
                                    size={14}
                                    color={isActive ? color : colors.textSecondary}
                                />
                                <Text
                                    style={[styles.filterLabel, { color: isActive ? color : colors.textSecondary }]}
                                >
                                    {tab.label}
                                </Text>
                                <View
                                    style={[
                                        styles.filterCount,
                                        { backgroundColor: isActive ? `${color}25` : colors.divider },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.filterCountText,
                                            { color: isActive ? color : colors.textTertiary },
                                        ]}
                                    >
                                        {tabCount}
                                    </Text>
                                </View>
                            </Pressable>
                        );
                    })}
                </ScrollView>

                {loading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                            Teknisyenler yükleniyor...
                        </Text>
                    </View>
                ) : filtered.length > 0 ? (
                    <>
                        <View style={styles.resultsHeader}>
                            <Text style={[styles.resultsText, { color: colors.textSecondary }]}>
                                {filtered.length} teknisyen
                            </Text>
                            {(search || activeFilter !== 'all') && (
                                <Pressable
                                    onPress={() => {
                                        setSearch('');
                                        setActiveFilter('all');
                                    }}
                                    hitSlop={8}
                                >
                                    <Text style={[styles.resetText, { color: colors.primary }]}>Temizle</Text>
                                </Pressable>
                            )}
                        </View>
                        {filtered.map((tech, index) => (
                            <TechnicianCard
                                key={tech.id}
                                technician={tech}
                                statusOptions={statusOptions}
                                index={index}
                                onPress={() => handleCardPress(tech)}
                                onEdit={() => openEditForm(tech)}
                                onPermissions={() => openPermissionsSheet(tech)}
                                onLocation={() => handleLocation(tech)}
                                onServices={() => handleServices(tech)}
                                onShifts={() => handleShifts(tech)}
                                onPerformance={() => handlePerformance(tech)}
                                onCall={() => handleCall(tech)}
                                onWhatsapp={() => handleWhatsapp(tech)}
                                onEmail={() => handleEmail(tech)}
                                onDeactivate={() => handleDeactivate(tech)}
                                onRestore={() => handleRestore(tech)}
                            />
                        ))}
                    </>
                ) : (
                    <View
                        style={[
                            styles.emptyCard,
                            { backgroundColor: isDark ? colors.surface : '#FFFFFF', borderColor: colors.border },
                        ]}
                    >
                        <View style={[styles.emptyIconWrap, { backgroundColor: `${colors.primary}12` }]}>
                            <MaterialCommunityIcons
                                name={search || activeFilter !== 'all' ? 'account-search-outline' : 'account-group-outline'}
                                size={36}
                                color={colors.primary}
                            />
                        </View>
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>
                            {search || activeFilter !== 'all' ? 'Sonuç bulunamadı' : 'Henüz teknisyen yok'}
                        </Text>
                        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                            {search || activeFilter !== 'all'
                                ? 'Arama veya filtre kriterlerinize uygun teknisyen bulunamadı.'
                                : 'Yeni teknisyen eklendiğinde burada görünecek.'}
                        </Text>
                    </View>
                )}
            </ScrollView>

            <Pressable
                onPress={openCreateForm}
                style={({ pressed }) => [
                    styles.fab,
                    {
                        backgroundColor: serviceBlue,
                        bottom: insets.bottom + 20,
                        opacity: pressed ? 0.85 : 1,
                    },
                ]}
            >
                <MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" />
            </Pressable>

            <AppBottomSheet
                ref={formSheetRef}
                visible={showFormSheet}
                onClose={closeFormSheet}
                snapPoints={['88%']}
                keyboardBehavior="interactive"
                keyboardBlurBehavior="restore"
            >
                <BottomSheetScrollView
                    contentContainerStyle={styles.sheetContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.sheetHeader}>
                        <View
                            style={[
                                styles.sheetHeaderIcon,
                                { backgroundColor: `${serviceBlue}15` },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name={editingId ? 'account-edit-outline' : 'account-plus-outline'}
                                size={22}
                                color={serviceBlue}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.sheetTitle, { color: colors.text }]}>
                                {editingId ? 'Teknisyen Düzenle' : 'Yeni Teknisyen'}
                            </Text>
                            <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                                {editingId ? 'Bilgileri güncelleyin' : 'Saha ekibine yeni bir üye ekleyin'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.formSection}>
                        <Text style={[styles.formSectionTitle, { color: colors.textSecondary }]}>Kişisel Bilgiler</Text>
                        <View style={styles.formRow}>
                            <View style={styles.formField}>
                                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Ad *</Text>
                                <TextInput
                                    value={formData.first_name}
                                    onChangeText={(v) => handleFieldChange('first_name', v)}
                                    placeholder="Ad"
                                    placeholderTextColor={colors.textTertiary}
                                    style={[
                                        styles.formInput,
                                        {
                                            color: colors.text,
                                            backgroundColor: isDark ? colors.surfaceMuted : '#FFFFFF',
                                            borderColor: colors.border,
                                        },
                                    ]}
                                />
                            </View>
                            <View style={styles.formField}>
                                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Soyad *</Text>
                                <TextInput
                                    value={formData.last_name}
                                    onChangeText={(v) => handleFieldChange('last_name', v)}
                                    placeholder="Soyad"
                                    placeholderTextColor={colors.textTertiary}
                                    style={[
                                        styles.formInput,
                                        {
                                            color: colors.text,
                                            backgroundColor: isDark ? colors.surfaceMuted : '#FFFFFF',
                                            borderColor: colors.border,
                                        },
                                    ]}
                                />
                            </View>
                        </View>

                        <View style={styles.formField}>
                            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>E-posta *</Text>
                            <TextInput
                                value={formData.email}
                                onChangeText={(v) => handleFieldChange('email', v)}
                                placeholder="ornek@firma.com"
                                placeholderTextColor={colors.textTertiary}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                style={[
                                    styles.formInput,
                                    {
                                        color: colors.text,
                                        backgroundColor: isDark ? colors.surfaceMuted : '#FFFFFF',
                                        borderColor: colors.border,
                                    },
                                ]}
                            />
                        </View>

                        <View style={styles.formRow}>
                            <View style={styles.formField}>
                                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Telefon</Text>
                                <TextInput
                                    value={formData.phone_number}
                                    onChangeText={(v) => handleFieldChange('phone_number', v)}
                                    placeholder="0___ ___ __ __"
                                    placeholderTextColor={colors.textTertiary}
                                    keyboardType="phone-pad"
                                    isPhone
                                    style={[
                                        styles.formInput,
                                        {
                                            color: colors.text,
                                            backgroundColor: isDark ? colors.surfaceMuted : '#FFFFFF',
                                            borderColor: colors.border,
                                        },
                                    ]}
                                />
                            </View>
                            <View style={styles.formField}>
                                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>İşe Başlama</Text>
                                <TextInput
                                    value={formData.hire_date}
                                    onChangeText={(v) => handleFieldChange('hire_date', v)}
                                    placeholder="YYYY-AA-GG"
                                    placeholderTextColor={colors.textTertiary}
                                    style={[
                                        styles.formInput,
                                        {
                                            color: colors.text,
                                            backgroundColor: isDark ? colors.surfaceMuted : '#FFFFFF',
                                            borderColor: colors.border,
                                        },
                                    ]}
                                />
                            </View>
                        </View>

                        {!editingId ? (
                            <View style={styles.formField}>
                                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Şifre *</Text>
                                <View
                                    style={[
                                        styles.passwordWrap,
                                        {
                                            backgroundColor: isDark ? colors.surfaceMuted : '#FFFFFF',
                                            borderColor: colors.border,
                                        },
                                    ]}
                                >
                                    <TextInput
                                        value={formData.password}
                                        onChangeText={(v) => handleFieldChange('password', v)}
                                        placeholder="••••••••"
                                        placeholderTextColor={colors.textTertiary}
                                        secureTextEntry={!showPassword}
                                        autoCapitalize="none"
                                        style={[styles.formInput, { color: colors.text, flex: 1, borderWidth: 0, backgroundColor: 'transparent' }]}
                                    />
                                    <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                                        <MaterialCommunityIcons
                                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                            size={18}
                                            color={colors.textTertiary}
                                        />
                                    </Pressable>
                                </View>
                            </View>
                        ) : null}

                        <View style={styles.formField}>
                            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Durum</Text>
                            <View style={styles.statusSelector}>
                                {statusOptions.map((opt) => {
                                    const isSelected = formData.status === normalizeStatusValue(opt.value);
                                    const code = normalizeStatusValue(opt.value);
                                    const meta = STATUS_META[code] || { color: opt.color || serviceBlue, label: opt.label };
                                    return (
                                        <Pressable
                                            key={opt.value}
                                            onPress={() => handleFieldChange('status', code)}
                                            style={({ pressed }) => [
                                                styles.statusOption,
                                                {
                                                    backgroundColor: isSelected ? `${meta.color}15` : 'transparent',
                                                    borderColor: isSelected ? meta.color : colors.border,
                                                    opacity: pressed ? 0.85 : 1,
                                                },
                                            ]}
                                        >
                                            <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                                            <Text
                                                style={[
                                                    styles.statusOptionText,
                                                    { color: isSelected ? meta.color : colors.text },
                                                ]}
                                            >
                                                {opt.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    </View>

                    <View style={styles.formSection}>
                        <Text style={[styles.formSectionTitle, { color: colors.textSecondary }]}>Yetkiler</Text>
                        <View style={styles.permissionsGrid}>
                            {PERMISSION_FIELDS.map((perm) => {
                                const isOn = Boolean(formData.permissions[perm.key]);
                                return (
                                    <View
                                        key={perm.key}
                                        style={[
                                            styles.permRow,
                                            {
                                                backgroundColor: isDark ? colors.surfaceMuted : colors.backgroundSecondary,
                                                borderColor: colors.border,
                                            },
                                        ]}
                                    >
                                        <View style={styles.permInfo}>
                                            <MaterialCommunityIcons
                                                name={perm.icon}
                                                size={16}
                                                color={isOn ? serviceBlue : colors.textTertiary}
                                            />
                                            <Text
                                                style={[
                                                    styles.permText,
                                                    { color: isOn ? colors.text : colors.textSecondary },
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {perm.label}
                                            </Text>
                                        </View>
                                        <Switch
                                            value={isOn}
                                            onValueChange={(v) => handlePermissionToggleInForm(perm.key, v)}
                                            trackColor={{ false: colors.divider, true: `${serviceBlue}80` }}
                                            thumbColor={isOn ? serviceBlue : '#FFFFFF'}
                                        />
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.sheetActions}>
                        <Pressable
                            onPress={closeFormSheet}
                            disabled={isSubmitting}
                            style={({ pressed }) => [
                                styles.sheetBtnSecondary,
                                {
                                    backgroundColor: isDark ? colors.surfaceMuted : colors.backgroundSecondary,
                                    opacity: pressed ? 0.7 : 1,
                                },
                            ]}
                        >
                            <Text style={[styles.sheetBtnText, { color: colors.text }]}>Vazgeç</Text>
                        </Pressable>
                        <Pressable
                            onPress={handleSubmit}
                            disabled={!isFormValid || isSubmitting}
                            style={({ pressed }) => [
                                styles.sheetBtnPrimary,
                                {
                                    backgroundColor: isFormValid ? serviceBlue : colors.disabled,
                                    opacity: pressed ? 0.85 : 1,
                                },
                            ]}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons
                                        name={editingId ? 'content-save-outline' : 'check'}
                                        size={18}
                                        color="#FFFFFF"
                                    />
                                    <Text style={styles.sheetBtnPrimaryText}>
                                        {editingId ? 'Güncelle' : 'Kaydet'}
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                </BottomSheetScrollView>
            </AppBottomSheet>

            <AppBottomSheet
                ref={permissionSheetRef}
                visible={showPermissionSheet}
                onClose={closePermissionsSheet}
                snapPoints={['78%']}
            >
                <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
                    <View style={styles.sheetHeader}>
                        <View style={[styles.sheetHeaderIcon, { backgroundColor: '#8B5CF615' }]}>
                            <MaterialCommunityIcons name="shield-account-outline" size={22} color="#8B5CF6" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.sheetTitle, { color: colors.text }]}>Yetkileri Yönet</Text>
                            <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                                {permissionTech ? getFullName(permissionTech) : ''}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.permissionsGrid}>
                        {PERMISSION_FIELDS.map((perm) => {
                            const isOn = Boolean(permissionForm[perm.key]);
                            return (
                                <View
                                    key={perm.key}
                                    style={[
                                        styles.permRow,
                                        {
                                            backgroundColor: isDark ? colors.surfaceMuted : colors.backgroundSecondary,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                >
                                    <View style={styles.permInfo}>
                                        <MaterialCommunityIcons
                                            name={perm.icon}
                                            size={16}
                                            color={isOn ? '#8B5CF6' : colors.textTertiary}
                                        />
                                        <Text
                                            style={[
                                                styles.permText,
                                                { color: isOn ? colors.text : colors.textSecondary },
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {perm.label}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={isOn}
                                        onValueChange={(v) => setPermissionForm((prev) => ({ ...prev, [perm.key]: v }))}
                                        trackColor={{ false: colors.divider, true: '#8B5CF680' }}
                                        thumbColor={isOn ? '#8B5CF6' : '#FFFFFF'}
                                    />
                                </View>
                            );
                        })}
                    </View>

                    <View style={styles.sheetActions}>
                        <Pressable
                            onPress={closePermissionsSheet}
                            disabled={isSavingPermissions}
                            style={({ pressed }) => [
                                styles.sheetBtnSecondary,
                                {
                                    backgroundColor: isDark ? colors.surfaceMuted : colors.backgroundSecondary,
                                    opacity: pressed ? 0.7 : 1,
                                },
                            ]}
                        >
                            <Text style={[styles.sheetBtnText, { color: colors.text }]}>Vazgeç</Text>
                        </Pressable>
                        <Pressable
                            onPress={handleSavePermissions}
                            disabled={isSavingPermissions}
                            style={({ pressed }) => [
                                styles.sheetBtnPrimary,
                                {
                                    backgroundColor: '#8B5CF6',
                                    opacity: pressed ? 0.85 : 1,
                                },
                            ]}
                        >
                            {isSavingPermissions ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="content-save-outline" size={18} color="#FFFFFF" />
                                    <Text style={styles.sheetBtnPrimaryText}>Kaydet</Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                </BottomSheetScrollView>
            </AppBottomSheet>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    headerGradient: { paddingHorizontal: 16, paddingBottom: 14 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerBtn: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    headerTitleWrap: { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.2 },
    headerSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
    scrollView: { flex: 1 },
    container: { paddingHorizontal: 16, paddingTop: 6 },
    statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    statCard: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    statIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    statValue: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
    statLabel: { fontSize: 10, fontWeight: '600', color: '#5C6370', marginTop: 2, letterSpacing: 0.2 },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 12,
    },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '500', paddingVertical: 0 },
    filterRow: { gap: 8, paddingBottom: 4, paddingRight: 4 },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
    },
    filterLabel: { fontSize: 12, fontWeight: '700' },
    filterCount: {
        minWidth: 22,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterCountText: { fontSize: 10, fontWeight: '800' },
    resultsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    resultsText: { fontSize: 12, fontWeight: '700' },
    resetText: { fontSize: 12, fontWeight: '800' },
    loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
    loadingText: { fontSize: 13, fontWeight: '500' },
    card: {
        borderRadius: 18,
        borderWidth: 1,
        padding: 14,
        marginBottom: 12,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    cardPressable: {},
    cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
    avatarRing: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatar: { width: 52, height: 52, borderRadius: 26 },
    avatarFallback: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 18, fontWeight: '800' },
    onlineDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2.5,
    },
    cardInfo: { flex: 1, minWidth: 0 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    name: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
    },
    statusText: { fontSize: 10, fontWeight: '800' },
    metaLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    metaText: { fontSize: 12, fontWeight: '500', flexShrink: 1 },
    quickRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingVertical: 8,
        marginBottom: 10,
    },
    quickBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 4,
    },
    quickIcon: {
        width: 26,
        height: 26,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickText: { fontSize: 12, fontWeight: '700' },
    quickDivider: { width: 1, height: 22 },
    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    actionChip: {
        flexBasis: '31%',
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        minHeight: 36,
    },
    actionIconWrap: {
        width: 22,
        height: 22,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionLabel: { fontSize: 11, fontWeight: '800', flexShrink: 1 },
    cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 4 },
    dangerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    restoreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
    },
    dangerText: { fontSize: 11, fontWeight: '800' },
    emptyCard: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 24,
        borderRadius: 18,
        borderWidth: 1,
        marginTop: 20,
    },
    emptyIconWrap: {
        width: 72,
        height: 72,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
    emptySubtitle: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
    fab: {
        position: 'absolute',
        right: 18,
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    sheetContent: { padding: 20, paddingBottom: 40 },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
    sheetHeaderIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetTitle: { fontSize: 18, fontWeight: '900' },
    sheetSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
    formSection: { marginBottom: 18 },
    formSectionTitle: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    formRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    formField: { flex: 1, marginBottom: 10 },
    formLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6, letterSpacing: 0.2 },
    formInput: {
        fontSize: 14,
        fontWeight: '500',
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 11 : 9,
        borderRadius: 12,
        borderWidth: 1,
    },
    passwordWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 12,
    },
    statusSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statusOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusOptionText: { fontSize: 12, fontWeight: '700' },
    permissionsGrid: { gap: 8 },
    permRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    permInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
    permText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
    sheetActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    sheetBtnSecondary: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetBtnText: { fontSize: 14, fontWeight: '800' },
    sheetBtnPrimary: {
        flex: 1.4,
        flexDirection: 'row',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    sheetBtnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
