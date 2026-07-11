import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import AppBottomSheet from '@/components/AppBottomSheet';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import { resolveMediaUrl } from '@/utils/mediaUrl';

const TEXT = {
  title: 'Teknisyen Detay\u0131',
  subtitle: 'Operasyon ve yetki y\u00f6netimi',
  notFound: 'Teknisyen bulunamad\u0131.',
  noLocation: 'Konum bilgisi yok',
  defaultRole: 'Elektronik Servis Teknisyeni',
  phoneMissing: 'Bu teknisyen i\u00e7in telefon numaras\u0131 tan\u0131ml\u0131 de\u011fil.',
  actionError: '\u0130\u015flem ba\u015flat\u0131lamad\u0131.',
  loadError: 'Teknisyen bilgileri y\u00fcklenemedi.',
  permissionSaved: 'Teknisyen yetkileri g\u00fcncellendi.',
  permissionSaveError: 'Teknisyen yetkileri g\u00fcncellenemedi.',
  success: 'Ba\u015far\u0131l\u0131',
  error: 'Hata',
  missingInfo: 'Bilgi Eksik',
  online: '\u00c7evrimi\u00e7i',
  offline: '\u00c7evrimd\u0131\u015f\u0131',
  passive: 'Pasif',
  now: '\u015eimdi',
  justNow: 'Az \u00f6nce',
  serviceFallback: 'Servis Kayd\u0131',
  startDate: '\u0130\u015fe ba\u015flang\u0131\u00e7',
  lastSeen: 'Son g\u00f6r\u00fclme',
  permissions: 'Yetkiler',
  edit: 'D\u00fczenle',
  cancel: 'Vazge\u00e7',
  save: 'Kaydet',
  summary: '\u00d6zet',
  payrollSummary: 'Bordro \u00d6zeti',
  activeServices: 'Aktif Servisler',
  noActiveServices: 'Aktif servis bulunamad\u0131.',
  all: 'T\u00fcm\u00fc',
  call: 'Ara',
  message: 'Mesaj',
  location: 'Konum',
  shifts: 'Mesailer',
  completed: 'Tamamlanan',
  openServices: 'A\u00e7\u0131k Servis',
  performance: 'Performans',
  revenue: 'Tahsilat',
};

const PERMISSION_OPTIONS = [
  { key: 'can_manage_services', label: 'Servis Y\u00f6netimi', description: 'Servis kay\u0131tlar\u0131n\u0131 g\u00f6r\u00fcnt\u00fcler ve y\u00f6netir.', color: serviceBlue, icon: 'clipboard-text-outline' },
  { key: 'can_manage_customers', label: 'M\u00fc\u015fteri Y\u00f6netimi', description: 'M\u00fc\u015fteri bilgilerini a\u00e7ar ve g\u00fcnceller.', color: '#06B6D4', icon: 'account-group-outline' },
  { key: 'can_manage_inventory', label: '\u00dcr\u00fcn Y\u00f6netimi', description: 'Stok ve \u00fcr\u00fcn hareketlerini y\u00f6netir.', color: '#8B5CF6', icon: 'package-variant-closed' },
  { key: 'can_manage_users', label: 'Kullan\u0131c\u0131 Y\u00f6netimi', description: 'Kullan\u0131c\u0131 hesaplar\u0131 \u00fczerinde i\u015flem yapar.', color: '#EC4899', icon: 'account-cog-outline' },
  { key: 'can_manage_accounting', label: 'Muhasebe', description: 'Muhasebe ve finans ekranlar\u0131n\u0131 kullan\u0131r.', color: serviceOrange, icon: 'calculator-variant-outline' },
  { key: 'can_manage_notifications', label: 'Bildirimler', description: 'Bildirim g\u00f6nderim ve ak\u0131\u015flar\u0131n\u0131 y\u00f6netir.', color: '#0EA5E9', icon: 'bell-outline' },
  { key: 'can_manage_hr', label: '\u0130K \u0130\u015flemleri', description: '\u0130zin, bordro ve insan kaynaklar\u0131 kay\u0131tlar\u0131na eri\u015fir.', color: '#14B8A6', icon: 'briefcase-account-outline' },
  { key: 'can_manage_reports', label: 'Raporlama', description: 'Rapor ekranlar\u0131n\u0131 ve \u00e7\u0131kt\u0131lar\u0131n\u0131 a\u00e7ar.', color: '#7C3AED', icon: 'chart-box-outline' },
  { key: 'can_manage_settings', label: 'Ayarlar', description: '\u015eirket ve uygulama ayarlar\u0131n\u0131 y\u00f6netir.', color: '#64748B', icon: 'cog-outline' },
  { key: 'can_manage_technicians', label: 'Teknisyen Y\u00f6netimi', description: 'Teknisyen operasyonlar\u0131n\u0131 ve konumlar\u0131n\u0131 y\u00f6netir.', color: '#F43F5E', icon: 'shield-account-outline' },
];

const SERVICE_STATUS = {
  completed: { label: 'Tamamland\u0131', color: serviceGreen, bg: 'rgba(34,197,94,0.12)' },
  cancelled: { label: '\u0130ptal', color: serviceRed, bg: 'rgba(239,68,68,0.10)' },
  in_progress: { label: 'Devam Ediyor', color: serviceBlue, bg: 'rgba(59,130,246,0.12)' },
  assigned: { label: 'Planland\u0131', color: serviceBlue, bg: 'rgba(59,130,246,0.10)' },
  new: { label: 'Yeni', color: serviceOrange, bg: 'rgba(249,115,22,0.12)' },
};

const STATUS_META = {
  online: { label: TEXT.online, color: serviceGreen, bg: 'rgba(34,197,94,0.12)', dot: serviceGreen },
  offline: { label: TEXT.offline, color: '#64748B', bg: 'rgba(100,116,139,0.12)', dot: '#94A3B8' },
  passive: { label: TEXT.passive, color: serviceRed, bg: 'rgba(239,68,68,0.10)', dot: serviceRed },
};

const money = (value) => `\u20ba${Number(value || 0).toLocaleString('tr-TR')}`;
const count = (value) => Number(value || 0).toLocaleString('tr-TR');
const getFullName = (technician) => technician?.full_name || technician?.user?.full_name || [technician?.user?.first_name, technician?.user?.last_name].filter(Boolean).join(' ') || technician?.user?.email || 'Teknisyen';
const getInitials = (name) => String(name || 'T').split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
const getStatusKey = (technician) => (!technician?.user?.is_active ? 'passive' : technician?.is_online ? 'online' : 'offline');
const normalizePhone = (value) => String(value || '').replace(/[^\d+]/g, '');
const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
};
const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} • ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
};
const formatLastSeen = (value, isOnline) => {
  if (isOnline) return TEXT.now;
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return TEXT.justNow;
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  return formatDateTime(value);
};
const getServiceTitle = (service) => [service?.fault_description, [service?.device_brand, service?.device_model].filter(Boolean).join(' '), service?.customer_full_name, TEXT.serviceFallback].find(Boolean);
const getServiceStatus = (service) => SERVICE_STATUS[service?.service_status || (service?.is_completed ? 'completed' : 'assigned')] || { label: 'Servis', color: serviceBlue, bg: 'rgba(59,130,246,0.10)' };
const getAttendanceHours = (record) => {
  if (!record?.start_time || !record?.end_time) return 0;
  const [sh, sm] = String(record.start_time).split(':').map(Number);
  const [eh, em] = String(record.end_time).split(':').map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
};
function ActionButton({ icon, label, onPress, colors }) {
  return <Pressable onPress={onPress} style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name={icon} size={18} color={serviceBlue} /><Text style={[styles.actionText, { color: colors.textSecondary }]}>{label}</Text></Pressable>;
}
function StatCard({ icon, label, value, color, colors }) {
  return <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.statIcon, { backgroundColor: `${color}14` }]}><MaterialCommunityIcons name={icon} size={18} color={color} /></View><Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text><Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>{value}</Text></View>;
}
function PermissionRow({ item, enabled, colors }) {
  return <View style={[styles.permissionRow, { borderColor: enabled ? `${item.color}30` : colors.border, backgroundColor: enabled ? `${item.color}12` : colors.surface }]}><View style={[styles.permissionIcon, { backgroundColor: enabled ? item.color : colors.textTertiary }]}><MaterialCommunityIcons name={item.icon} size={14} color="#fff" /></View><View style={styles.permissionBody}><Text style={[styles.permissionTitle, { color: colors.text }]}>{item.label}</Text><Text style={[styles.permissionDescription, { color: colors.textSecondary }]}>{item.description}</Text></View><MaterialCommunityIcons name={enabled ? 'check-circle' : 'close-circle-outline'} size={18} color={enabled ? item.color : colors.textTertiary} /></View>;
}
function PermissionEditorRow({ item, value, onToggle, colors }) {
  return <Pressable onPress={() => onToggle(item.key)} style={[styles.permissionRow, { borderColor: value ? `${item.color}30` : colors.border, backgroundColor: value ? `${item.color}12` : colors.surface }]}><View style={[styles.permissionIcon, { backgroundColor: value ? item.color : colors.textTertiary }]}><MaterialCommunityIcons name={item.icon} size={14} color="#fff" /></View><View style={styles.permissionBody}><Text style={[styles.permissionTitle, { color: colors.text }]}>{item.label}</Text><Text style={[styles.permissionDescription, { color: colors.textSecondary }]}>{item.description}</Text></View><View style={[styles.switchTrack, { backgroundColor: value ? item.color : colors.border }]}><View style={[styles.switchKnob, value ? styles.switchKnobActive : null]} /></View></Pressable>;
}

export default function TechnicianDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const technicianId = route?.params?.technicianId || route?.params?.id || route?.params?.technician?.id || null;
  const initialTechnician = route?.params?.technician || null;
  const [technician, setTechnician] = useState(initialTechnician);
  const [performance, setPerformance] = useState(null);
  const [payrolls, setPayrolls] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(!initialTechnician);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionsVisible, setPermissionsVisible] = useState(false);
  const [draftPermissions, setDraftPermissions] = useState({});
  const [savingPermissions, setSavingPermissions] = useState(false);

  const fetchData = useCallback(async () => {
    if (!technicianId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const [technicianRes, performanceRes, payrollRes, attendanceRes] = await Promise.all([
        api.get(ENDPOINTS.TECHNICIAN.DETAIL(technicianId)),
        api.get(ENDPOINTS.REPORTS.TECHNICIAN_DETAIL(technicianId), { params: { year: now.getFullYear(), month: now.getMonth() + 1 } }).catch(() => ({ data: null })),
        api.get(ENDPOINTS.HR.PAYROLLS, { params: { technician: technicianId } }).catch(() => ({ data: [] })),
        api.get('technicians/attendance/', { params: { technician: technicianId, month, include_shift: 'false' } }).catch(() => ({ data: [] })),
      ]);
      setTechnician(technicianRes?.data || null);
      setPerformance(performanceRes?.data || null);
      const payrollList = Array.isArray(payrollRes?.data) ? payrollRes.data : payrollRes?.data?.results || [];
      const attendanceList = Array.isArray(attendanceRes?.data) ? attendanceRes.data : [];
      setPayrolls(payrollList.slice().sort((a, b) => new Date(b.period_start || 0) - new Date(a.period_start || 0)));
      setAttendance(attendanceList.slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
    } catch (error) {
      console.log('Technician detail fetch error:', error?.response?.data || error?.message || error);
      showToast('error', TEXT.error, TEXT.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast, technicianId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const profile = useMemo(() => {
    const name = getFullName(technician);
    const permissions = technician?.permissions || {};
    const statusKey = getStatusKey(technician);
    return {
      name,
      initials: getInitials(name),
      avatar: resolveMediaUrl(technician?.user?.profile_picture || technician?.user?.avatar || technician?.user?.avatar_url || technician?.avatar),
      phone: technician?.user?.phone_number || technician?.phone_number || '',
      role: technician?.title || technician?.user?.user_type_display || TEXT.defaultRole,
      email: technician?.user?.email || technician?.email || '-',
      location: technician?.current_location?.address || technician?.location || technician?.address || TEXT.noLocation,
      permissions,
      status: STATUS_META[statusKey] || STATUS_META.offline,
      isOnline: statusKey === 'online',
      activePermissions: PERMISSION_OPTIONS.filter((item) => Boolean(permissions[item.key])),
    };
  }, [technician]);

  const services = Array.isArray(performance?.services) ? performance.services : [];
  const activeServices = services.filter((service) => !service?.is_completed && service?.service_status !== 'cancelled');
  const completedServices = Number(performance?.completed_services_count || 0);
  const pendingServices = Number(performance?.pending_services_count || 0);
  const totalServices = completedServices + pendingServices;
  const completionRate = totalServices ? Math.round((completedServices / totalServices) * 100) : 0;
  const latestPayroll = payrolls[0] || null;
  const leaveCount = attendance.filter((item) => ['leave', 'sick', 'offday'].includes(item?.status)).length;
  const overtimeHours = attendance.reduce((sum, item) => item?.status !== 'worked' ? sum : sum + Math.max(0, getAttendanceHours(item) - 9), 0);
  const collectionAmount = Number(performance?.total_revenue_generated || 0);

  const openPhoneUrl = (scheme) => {
    const phone = normalizePhone(profile.phone);
    if (!phone) {
      showToast('error', TEXT.missingInfo, TEXT.phoneMissing);
      return;
    }
    Linking.openURL(`${scheme}:${phone}`).catch(() => showToast('error', TEXT.error, TEXT.actionError));
  };
  const openPermissionEditor = () => { setDraftPermissions({ ...profile.permissions }); setPermissionsVisible(true); };
  const togglePermission = (key) => setDraftPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  const savePermissions = async () => {
    if (!technicianId) return;
    setSavingPermissions(true);
    try {
      const response = await api.patch(ENDPOINTS.TECHNICIAN.PERMISSIONS(technicianId), draftPermissions);
      const updatedPermissions = response?.data?.permissions || response?.data || draftPermissions;
      setTechnician((prev) => prev ? ({ ...prev, permissions: { ...(prev.permissions || {}), ...updatedPermissions } }) : prev);
      setPermissionsVisible(false);
      showToast('success', TEXT.success, TEXT.permissionSaved);
    } catch (error) {
      console.log('Technician permissions save error:', error?.response?.data || error?.message || error);
      showToast('error', TEXT.error, error?.response?.data?.detail || TEXT.permissionSaveError);
    } finally {
      setSavingPermissions(false);
    }
  };

  if (loading && !technician) return <View style={[styles.center, { backgroundColor: colors.backgroundSecondary }]}><ActivityIndicator size="large" color={serviceBlue} /></View>;
  if (!technician) return <View style={[styles.center, { backgroundColor: colors.backgroundSecondary }]}><Text style={{ color: colors.textSecondary }}>{TEXT.notFound}</Text></View>;

  return <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}><View style={[styles.header, { paddingTop: insets.top + 8 }]}><Pressable onPress={() => navigation.goBack()} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name="arrow-left" size={22} color={serviceBlue} /></Pressable><View style={styles.headerText}><Text style={[styles.headerTitle, { color: colors.text }]}>{TEXT.title}</Text><Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{TEXT.subtitle}</Text></View><Pressable onPress={openPermissionEditor} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name="shield-edit-outline" size={22} color={serviceBlue} /></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[serviceBlue]} />}><View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.heroTop}><View style={styles.avatarWrap}>{profile.avatar ? <Image source={{ uri: profile.avatar }} style={styles.avatar} /> : <View style={[styles.avatarFallback, { backgroundColor: `${serviceBlue}14` }]}><Text style={[styles.avatarText, { color: serviceBlue }]}>{profile.initials}</Text></View>}<View style={[styles.onlineDot, { backgroundColor: profile.status.dot, borderColor: colors.surface }]} /></View><View style={styles.heroBody}><Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{profile.name}</Text><Text style={[styles.role, { color: colors.textSecondary }]} numberOfLines={1}>{profile.role}</Text><Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>{profile.location}</Text><Text style={[styles.metaText, { color: colors.textTertiary }]} numberOfLines={1}>{profile.email}</Text></View><View style={[styles.statusBadge, { backgroundColor: profile.status.bg }]}><Text style={[styles.statusText, { color: profile.status.color }]}>{profile.status.label}</Text></View></View><View style={[styles.divider, { backgroundColor: colors.border }]} /><View style={styles.infoRow}><View style={styles.infoItem}><Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{TEXT.startDate}</Text><Text style={[styles.infoValue, { color: colors.text }]}>{formatDate(technician?.hire_date || technician?.created_at)}</Text></View><View style={styles.infoItem}><Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{TEXT.lastSeen}</Text><Text style={[styles.infoValue, { color: profile.isOnline ? serviceGreen : colors.text }]}>{formatLastSeen(technician?.last_online, profile.isOnline)}</Text></View></View><View style={styles.actionsRow}><ActionButton icon="phone-outline" label={TEXT.call} onPress={() => openPhoneUrl('tel')} colors={colors} /><ActionButton icon="message-text-outline" label={TEXT.message} onPress={() => openPhoneUrl('sms')} colors={colors} /><ActionButton icon="map-marker-radius-outline" label={TEXT.location} onPress={() => navigation.navigate('TechnicianLocations', { technicianId, technicianName: profile.name })} colors={colors} /><ActionButton icon="clock-outline" label={TEXT.shifts} onPress={() => navigation.navigate('TechnicianShifts', { technicianId, technicianName: profile.name })} colors={colors} /></View></View><View style={styles.statsGrid}><StatCard icon="clipboard-check-outline" label={TEXT.completed} value={count(completedServices)} color={serviceGreen} colors={colors} /><StatCard icon="progress-clock" label={TEXT.openServices} value={count(pendingServices)} color={serviceOrange} colors={colors} /><StatCard icon="chart-line-variant" label={TEXT.performance} value={`%${completionRate}`} color="#8B5CF6" colors={colors} /><StatCard icon="cash-multiple" label={TEXT.revenue} value={money(collectionAmount)} color={serviceBlue} colors={colors} /></View><View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.sectionTitle, { color: colors.text }]}>{TEXT.summary}</Text><View style={styles.summaryGrid}><View style={styles.summaryItem}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Toplam servis</Text><Text style={[styles.summaryValue, { color: colors.text }]}>{count(totalServices)}</Text></View><View style={styles.summaryItem}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Aktif yetki</Text><Text style={[styles.summaryValue, { color: colors.text }]}>{count(profile.activePermissions.length)}</Text></View><View style={styles.summaryItem}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Fazla mesai</Text><Text style={[styles.summaryValue, { color: colors.text }]}>{`${overtimeHours.toFixed(1)} sa`}</Text></View><View style={styles.summaryItem}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>İzin günü</Text><Text style={[styles.summaryValue, { color: colors.text }]}>{count(leaveCount)}</Text></View></View></View><View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.text }]}>{TEXT.payrollSummary}</Text><Pressable onPress={() => navigation.navigate('AdminPayroll', { technicianId, technicianName: profile.name })}><Text style={[styles.sectionLink, { color: serviceBlue }]}>{TEXT.all}</Text></Pressable></View><View style={styles.payrollRow}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Net ödeme</Text><Text style={[styles.payrollValue, { color: colors.text }]}>{money(latestPayroll?.net_salary)}</Text></View><View style={styles.payrollRow}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Maaş</Text><Text style={[styles.summaryText, { color: colors.text }]}>{money(latestPayroll?.base_salary)}</Text></View><View style={styles.payrollRow}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Prim</Text><Text style={[styles.summaryText, { color: serviceGreen }]}>{money(latestPayroll?.total_premiums)}</Text></View><View style={styles.payrollRow}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Kesinti</Text><Text style={[styles.summaryText, { color: serviceRed }]}>{money(latestPayroll?.total_deductions)}</Text></View></View><View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.text }]}>{TEXT.permissions}</Text><Pressable onPress={openPermissionEditor}><Text style={[styles.sectionLink, { color: serviceBlue }]}>{TEXT.edit}</Text></Pressable></View><View style={styles.listGap}>{PERMISSION_OPTIONS.map((item) => <PermissionRow key={item.key} item={item} enabled={Boolean(profile.permissions[item.key])} colors={colors} />)}</View></View><View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.text }]}>{TEXT.activeServices}</Text><Text style={[styles.sectionMeta, { color: colors.textSecondary }]}>{`${activeServices.length} kayıt`}</Text></View>{activeServices.length === 0 ? <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{TEXT.noActiveServices}</Text> : activeServices.slice(0, 4).map((service) => { const status = getServiceStatus(service); return <Pressable key={String(service.id)} onPress={() => navigation.navigate('ServiceDetail', { serviceId: service.id, service })} style={[styles.serviceRow, { borderBottomColor: colors.border }]}><View style={styles.serviceBody}><Text style={[styles.serviceTitle, { color: colors.text }]} numberOfLines={1}>{getServiceTitle(service)}</Text><Text style={[styles.serviceMeta, { color: colors.textSecondary }]} numberOfLines={1}>{formatDateTime(service?.scheduled_date)}</Text></View><View style={[styles.servicePill, { backgroundColor: status.bg }]}><Text style={[styles.servicePillText, { color: status.color }]}>{status.label}</Text></View></Pressable>; })}</View></ScrollView><AppBottomSheet visible={permissionsVisible} onClose={() => setPermissionsVisible(false)} snapPoints={['78%']}><View style={styles.sheetContent}><View style={styles.sectionHeader}><Text style={[styles.sheetTitle, { color: colors.text }]}>{`${TEXT.permissions} ${TEXT.edit}`}</Text><Pressable onPress={() => setPermissionsVisible(false)}><MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} /></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listGap}>{PERMISSION_OPTIONS.map((item) => <PermissionEditorRow key={item.key} item={item} value={Boolean(draftPermissions[item.key])} onToggle={togglePermission} colors={colors} />)}</ScrollView><View style={styles.sheetButtons}><Pressable onPress={() => setPermissionsVisible(false)} style={[styles.secondaryButton, { borderColor: colors.border }]}><Text style={[styles.secondaryText, { color: colors.textSecondary }]}>{TEXT.cancel}</Text></Pressable><Pressable onPress={savePermissions} disabled={savingPermissions} style={[styles.primaryButton, { backgroundColor: serviceBlue, opacity: savingPermissions ? 0.7 : 1 }]}>{savingPermissions ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryText}>{TEXT.save}</Text>}</Pressable></View></View></AppBottomSheet></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, header: { paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, headerText: { flex: 1 }, headerTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }, headerSubtitle: { marginTop: 4, fontSize: 14, fontWeight: '500' }, iconButton: { width: 46, height: 46, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, content: { paddingHorizontal: 20, gap: 16 }, heroCard: { borderRadius: 28, borderWidth: 1, padding: 18, gap: 16 }, heroTop: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' }, avatarWrap: { position: 'relative' }, avatar: { width: 82, height: 82, borderRadius: 26 }, avatarFallback: { width: 82, height: 82, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 28, fontWeight: '800' }, onlineDot: { position: 'absolute', right: 2, bottom: 2, width: 16, height: 16, borderRadius: 8, borderWidth: 3 }, heroBody: { flex: 1, gap: 6 }, name: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }, role: { fontSize: 15, fontWeight: '600' }, metaText: { fontSize: 13, fontWeight: '500' }, statusBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }, statusText: { fontSize: 12, fontWeight: '800' }, divider: { height: 1 }, infoRow: { flexDirection: 'row', gap: 12 }, infoItem: { flex: 1, gap: 4 }, infoLabel: { fontSize: 12, fontWeight: '600' }, infoValue: { fontSize: 15, fontWeight: '800' }, actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, actionButton: { flex: 1, minWidth: '23%', borderRadius: 18, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', gap: 6 }, actionText: { fontSize: 12, fontWeight: '700' }, statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, statCard: { width: '48%', borderRadius: 22, borderWidth: 1, padding: 16, gap: 10 }, statIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, statLabel: { fontSize: 13, fontWeight: '600' }, statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 }, section: { borderRadius: 26, borderWidth: 1, padding: 18, gap: 12 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }, sectionLink: { fontSize: 13, fontWeight: '700' }, sectionMeta: { fontSize: 13, fontWeight: '600' }, summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 }, summaryItem: { width: '50%', gap: 6 }, summaryLabel: { fontSize: 13, fontWeight: '600' }, summaryValue: { fontSize: 22, fontWeight: '800' }, payrollRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, payrollValue: { fontSize: 26, fontWeight: '900' }, summaryText: { fontSize: 15, fontWeight: '800' }, listGap: { gap: 10 }, permissionRow: { borderRadius: 18, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, permissionIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, permissionBody: { flex: 1, gap: 2 }, permissionTitle: { fontSize: 14, fontWeight: '700' }, permissionDescription: { fontSize: 12, lineHeight: 17, fontWeight: '500' }, serviceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, borderBottomWidth: 1 }, serviceBody: { flex: 1, gap: 4 }, serviceTitle: { fontSize: 14, fontWeight: '700' }, serviceMeta: { fontSize: 12, fontWeight: '500' }, servicePill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 }, servicePillText: { fontSize: 12, fontWeight: '800' }, emptyText: { fontSize: 14, fontWeight: '600' }, sheetContent: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 16 }, sheetTitle: { fontSize: 22, fontWeight: '800' }, sheetButtons: { flexDirection: 'row', gap: 12 }, secondaryButton: { flex: 1, height: 52, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, secondaryText: { fontSize: 15, fontWeight: '700' }, primaryButton: { flex: 1.1, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' }, switchTrack: { width: 46, height: 28, borderRadius: 999, paddingHorizontal: 3, justifyContent: 'center' }, switchKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' }, switchKnobActive: { alignSelf: 'flex-end' },
});
