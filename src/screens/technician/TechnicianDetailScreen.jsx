import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import AppBottomSheet from '@/components/AppBottomSheet';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';

const ONLINE_GREEN = '#22C55E';
const PURPLE = '#8B5CF6';

const STATUS_META = {
    online: { label: 'Çevrimiçi', color: ONLINE_GREEN, bg: 'rgba(34,197,94,0.12)', dot: ONLINE_GREEN },
    offline: { label: 'Çevrimdışı', color: '#64748B', bg: 'rgba(100,116,139,0.12)', dot: '#94A3B8' },
    passive: { label: 'Pasif', color: serviceRed, bg: 'rgba(239,68,68,0.10)', dot: serviceRed },
};
const SVC_STATUS = {
    completed: { label: 'Tamamlandı', color: serviceGreen, bg: 'rgba(34,197,94,0.12)' },
    cancelled: { label: 'İptal', color: serviceRed, bg: 'rgba(239,68,68,0.10)' },
    in_progress: { label: 'Devam Ediyor', color: serviceBlue, bg: 'rgba(59,130,246,0.12)' },
    assigned: { label: 'Planlandı', color: serviceBlue, bg: 'rgba(59,130,246,0.10)' },
    new: { label: 'Yeni', color: serviceOrange, bg: 'rgba(249,115,22,0.12)' },
};
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

const money = (v) => '₺' + Number(v || 0).toLocaleString('tr-TR');
const pct = (v) => '%' + Number(v || 0);
const getName = (t) => t?.full_name || [t?.user?.first_name, t?.user?.last_name].filter(Boolean).join(' ') || t?.user?.email || 'Teknisyen';
const initials = (n) => String(n || 'T').split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
const statusKey = (t) => !t?.user?.is_active ? 'passive' : t?.is_online ? 'online' : 'offline';
const cleanPhone = (v) => String(v || '').replace(/[^0-9+]/g, '');
const fmtDate = (v) => { if (!v) return '-'; const d = new Date(v); if (isNaN(d)) return '-'; return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }); };
const fmtDT = (v) => { if (!v) return '-'; const d = new Date(v); if (isNaN(d)) return '-'; return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); };
const fmtLast = (v, on) => { if (on) return 'Şimdi'; if (!v) return '-'; const d = new Date(v); if (isNaN(d)) return '-'; const s = Math.floor((Date.now() - d) / 1000); if (s < 60) return 'Az önce'; if (s < 3600) return Math.floor(s / 60) + ' dk önce'; if (s < 86400) return Math.floor(s / 3600) + ' sa önce'; return fmtDT(v); };
const svcTitle = (s) => [s?.fault_description, [s?.device_brand, s?.device_model].filter(Boolean).join(' '), s?.customer_full_name, 'Servis Kaydı'].find(Boolean);
const svcSt = (s) => SVC_STATUS[s?.service_status || (s?.is_completed ? 'completed' : 'assigned')] || { label: 'Servis', color: serviceBlue, bg: 'rgba(59,130,246,0.10)' };
const attH = (r) => { if (!r?.start_time || !r?.end_time) return 0; const [sh, sm] = String(r.start_time).split(':').map(Number); const [eh, em] = String(r.end_time).split(':').map(Number); return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60); };

function ABtn({ icon, label, onPress, colors }) {
    return <Pressable onPress={onPress} style={[S.ab, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name={icon} size={18} color={serviceBlue} /><Text style={[S.abl, { color: colors.textSecondary }]}>{label}</Text></Pressable>;
}
function SBox({ icon, color, label, value, colors }) {
    return <View style={[S.sb, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[S.si, { backgroundColor: color + '18' }]}><MaterialCommunityIcons name={icon} size={15} color={color} /></View><Text style={[S.sl, { color: colors.textSecondary }]}>{label}</Text><Text style={[S.sv, { color: colors.text }]} numberOfLines={1}>{value}</Text></View>;
}
function SHdr({ title, action, onAction, colors }) {
    return <View style={S.shr}><Text style={[S.st, { color: colors.text }]}>{title}</Text>{action ? <Pressable onPress={onAction}><Text style={[S.slink, { color: serviceBlue }]}>{action}</Text></Pressable> : null}</View>;
}
function PR({ item, enabled, colors }) {
    const activeColor = serviceGreen;
    return <View style={[S.pr, { backgroundColor: enabled ? activeColor + '12' : colors.surface, borderColor: enabled ? activeColor + '30' : colors.border }]}><View style={[S.pi, { backgroundColor: enabled ? activeColor : colors.textTertiary }]}><MaterialCommunityIcons name={item.icon} size={13} color='#fff' /></View><Text style={[S.pl, { color: enabled ? colors.text : colors.textSecondary }]}>{item.label}</Text><MaterialCommunityIcons name={enabled ? 'check-circle' : 'close-circle-outline'} size={16} color={enabled ? activeColor : colors.textTertiary} /></View>;
}
function PER({ item, value, onToggle, colors }) {
    return <Pressable onPress={() => onToggle(item.key)} style={[S.pr, { backgroundColor: value ? item.color + '12' : colors.surface, borderColor: value ? item.color + '30' : colors.border }]}><View style={[S.pi, { backgroundColor: value ? item.color : colors.textTertiary }]}><MaterialCommunityIcons name={item.icon} size={13} color='#fff' /></View><Text style={[S.pl, { color: value ? colors.text : colors.textSecondary, flex: 1 }]}>{item.label}</Text><View style={[S.swt, { backgroundColor: value ? item.color : colors.border }]}><View style={[S.swk, value && S.swko]} /></View></Pressable>;
}

export default function TechnicianDetailScreen({ navigation, route }) {
    const { colors } = useTheme();
    const { showToast } = useToast();
    const tid = route?.params?.technicianId || route?.params?.id || route?.params?.technician?.id || null;
    const [tech, setTech] = useState(route?.params?.technician || null);
    const [perf, setPerf] = useState(null);
    const [pays, setPays] = useState([]);
    const [att, setAtt] = useState([]);
    const [loading, setLoading] = useState(!route?.params?.technician);
    const [refreshing, setRefreshing] = useState(false);
    const [pSheet, setPSheet] = useState(false);
    const [draft, setDraft] = useState({});
    const [saving, setSaving] = useState(false);
    const TABS = ['Genel', 'Servisler', 'Yetkiler', 'Bordro'];
    const [tab, setTab] = useState('Genel');

    const fetch = useCallback(async () => {
        if (!tid) { setLoading(false); setRefreshing(false); return; }
        try {
            const now = new Date();
            const mo = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
            const [tR, pR, payR, aR] = await Promise.all([
                api.get(ENDPOINTS.TECHNICIAN.DETAIL(tid)),
                api.get(ENDPOINTS.REPORTS.TECHNICIAN_DETAIL(tid), { params: { year: now.getFullYear(), month: now.getMonth() + 1 } }).catch(() => ({ data: null })),
                api.get(ENDPOINTS.HR.PAYROLLS, { params: { technician: tid } }).catch(() => ({ data: [] })),
                api.get('technicians/attendance/', { params: { technician: tid, month: mo, include_shift: 'false' } }).catch(() => ({ data: [] })),
            ]);
            setTech(tR?.data || null);
            setPerf(pR?.data || null);
            const pl = Array.isArray(payR?.data) ? payR.data : (payR?.data?.results || []);
            setPays(pl.sort((a, b) => new Date(b.period_start || 0) - new Date(a.period_start || 0)));
            setAtt(Array.isArray(aR?.data) ? aR.data : []);
        } catch { showToast('error', 'Hata', 'Yükleme hatası.'); }
        finally { setLoading(false); setRefreshing(false); }
    }, [tid, showToast]);

    useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

    React.useEffect(() => {
        if (route?.params?.openPermissionsSheet && tech) {
            setDraft({ ...(tech?.permissions || {}) });
            setPSheet(true);
            navigation.setParams({ openPermissionsSheet: undefined });
        }
    }, [route?.params?.openPermissionsSheet, tech]);

    const p = useMemo(() => {
        const name = getName(tech);
        const sk = statusKey(tech);
        const perms = tech?.permissions || {};
        return { name, initials: initials(name), avatar: resolveMediaUrl(tech?.user?.avatar_url || tech?.user?.avatar || tech?.avatar), phone: tech?.user?.phone_number || '', role: tech?.title || tech?.user?.user_type_display || 'Servis Teknisyeni', email: tech?.user?.email || '', status: STATUS_META[sk] || STATUS_META.offline, isOnline: sk === 'online', perms };
    }, [tech]);

    const svcs = Array.isArray(perf?.services) ? perf.services : [];
    const actSvcs = svcs.filter((s) => !s?.is_completed && s?.service_status !== 'cancelled');
    const cc = Number(perf?.completed_services_count || 0);
    const pc = Number(perf?.pending_services_count || 0);
    const ts = cc + pc;
    const cr = ts ? Math.round((cc / ts) * 100) : 0;
    const rev = Number(perf?.total_revenue_generated || 0);
    const lp = pays[0] || null;
    const lv = att.filter((r) => ['leave', 'sick', 'offday'].includes(r?.status)).length;

    const call = (sc) => {
        const ph = cleanPhone(p.phone);
        if (!ph) { showToast('error', 'Eksik', 'Telefon numarası tanımlı değil.'); return; }
        if (sc === 'whatsapp') {
            let formattedPhone = ph;
            if (!formattedPhone.startsWith('+') && !formattedPhone.startsWith('90')) {
                formattedPhone = '90' + formattedPhone;
            }
            Linking.openURL(`whatsapp://send?phone=${formattedPhone.replace('+', '')}`).catch(() => {
                Linking.openURL(`https://wa.me/${formattedPhone.replace('+', '')}`).catch(() => {
                    showToast('error', 'Hata', 'WhatsApp açılamadı.');
                });
            });
        } else {
            Linking.openURL(sc + ':' + ph).catch(() => { });
        }
    };
    const openPE = () => { setDraft({ ...p.perms }); setPSheet(true); };
    const togP = (k) => setDraft((d) => ({ ...d, [k]: !d[k] }));
    const saveP = async () => {
        if (!tid) return; setSaving(true);
        try { const r = await api.patch(ENDPOINTS.TECHNICIAN.PERMISSIONS(tid), draft); const u = r?.data?.permissions || r?.data || draft; setTech((prev) => prev ? { ...prev, permissions: { ...(prev.permissions || {}), ...u } } : prev); setPSheet(false); showToast('success', 'Başarılı', 'Yetkiler güncellendi.'); }
        catch (e) { showToast('error', 'Hata', e?.response?.data?.detail || 'Hata.'); }
        finally { setSaving(false); }
    };

    if (loading && !tech) return <View style={[S.c, { backgroundColor: colors.backgroundSecondary }]}><ActivityIndicator size='large' color={serviceBlue} /></View>;
    if (!tech) return <View style={[S.c, { backgroundColor: colors.backgroundSecondary }]}><Text style={{ color: colors.textSecondary }}>Teknisyen bulunamadı.</Text></View>;

    const SRow = ({ s }) => { const st = svcSt(s); return <Pressable onPress={() => navigation.navigate('ServiceDetail', { serviceId: s.id, service: s })} style={[S.svr, { borderBottomColor: colors.border }]}><View style={[S.sdi, { backgroundColor: serviceBlue + '14' }]}><MaterialCommunityIcons name='tools' size={15} color={serviceBlue} /></View><View style={S.svb}><Text style={[S.svt, { color: colors.text }]} numberOfLines={1}>{svcTitle(s)}</Text><Text style={[S.svm, { color: colors.textSecondary }]} numberOfLines={1}>{fmtDT(s?.scheduled_date)}</Text></View><View style={[S.pill, { backgroundColor: st.bg }]}><Text style={[S.pillT, { color: st.color }]}>{st.label}</Text></View><MaterialCommunityIcons name='chevron-right' size={15} color={colors.textTertiary} /></Pressable>; };

    const G = () => <React.Fragment>
        <View style={S.sg}><SBox icon='calendar-check-outline' color={serviceBlue} label='Bu Ay Servis' value={String(ts)} colors={colors} /><SBox icon='check-circle-outline' color={serviceGreen} label='Tamamlanan' value={String(cc)} colors={colors} /><SBox icon='chart-line-variant' color={PURPLE} label='Performans' value={pct(cr)} colors={colors} /><SBox icon='cash-multiple' color={serviceOrange} label='Bu Ay Kazanç' value={money(rev)} colors={colors} /></View>
        <View style={[S.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><SHdr title='Aktif Servisler' action={actSvcs.length > 0 ? 'Tümünü Gör' : undefined} onAction={() => setTab('Servisler')} colors={colors} />{actSvcs.length === 0 ? <Text style={[S.empty, { color: colors.textSecondary }]}>Aktif servis yok.</Text> : actSvcs.slice(0, 4).map((s) => <SRow key={String(s.id)} s={s} />)}</View>

        {lp && <View style={[S.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><SHdr title='Bordro Özeti' colors={colors} /><View style={S.prows}><View style={S.prow}><Text style={[S.plabel, { color: colors.textSecondary }]}>Maaş</Text><Text style={[S.pval, { color: colors.text }]}>{money(lp?.base_salary)}</Text></View><View style={S.prow}><Text style={[S.plabel, { color: colors.textSecondary }]}>Prim</Text><Text style={[S.pval, { color: serviceGreen }]}>{money(lp?.total_premiums)}</Text></View><View style={S.prow}><Text style={[S.plabel, { color: colors.textSecondary }]}>Kesinti</Text><Text style={[S.pval, { color: serviceRed }]}>{money(lp?.total_deductions)}</Text></View><View style={[S.pdiv, { backgroundColor: colors.border }]} /><View style={S.prow}><Text style={[S.pnl, { color: colors.text }]}>Net Bordro</Text><Text style={[S.pn, { color: colors.text }]}>{money(lp?.net_salary)}</Text></View><Pressable onPress={() => navigation.navigate('AdminPayroll', { technicianId: tid, technicianName: p.name })} style={S.pdb}><MaterialCommunityIcons name='file-document-outline' size={13} color={serviceBlue} /><Text style={[S.pdt, { color: serviceBlue }]}>Bordro Detayı</Text><MaterialCommunityIcons name='chevron-right' size={13} color={serviceBlue} /></Pressable></View></View>}

        <View style={[S.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><SHdr title='İzin ve Mesai' colors={colors} /><View style={S.lr}><View style={S.li}><View style={[S.lib, { backgroundColor: serviceGreen + '14' }]}><MaterialCommunityIcons name='clock-outline' size={18} color={serviceGreen} /></View><Text style={[S.ll, { color: colors.textSecondary }]}>Mesai</Text><Text style={[S.lv, { color: colors.text }]}>{att.filter(r => r?.status === 'worked').length} gün</Text></View><View style={S.li}><View style={[S.lib, { backgroundColor: serviceOrange + '14' }]}><MaterialCommunityIcons name='calendar-check' size={18} color={serviceOrange} /></View><Text style={[S.ll, { color: colors.textSecondary }]}>İzin</Text><Text style={[S.lv, { color: colors.text }]}>{lv} gün</Text></View></View></View>
    </React.Fragment>;

    const Sv = () => <View style={[S.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><SHdr title='Tüm Servisler' colors={colors} />{svcs.length === 0 ? <Text style={[S.empty, { color: colors.textSecondary }]}>Servis yok.</Text> : svcs.slice(0, 20).map((s) => <SRow key={String(s.id)} s={s} />)}</View>;

    const Perm = () => <View style={[S.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><SHdr title='Yetkiler' action='Düzenle' onAction={openPE} colors={colors} /><View style={S.plist}>{PERMS.map((o) => <PR key={o.key} item={o} enabled={Boolean(p.perms[o.key])} colors={colors} />)}</View></View>;

    const Pay = () => <View style={[S.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><SHdr title='Bordro Kayıtları' action={pays.length > 0 ? 'Tümü' : undefined} onAction={() => navigation.navigate('AdminPayroll', { technicianId: tid, technicianName: p.name })} colors={colors} />{pays.length === 0 ? <Text style={[S.empty, { color: colors.textSecondary }]}>Bordro yok.</Text> : pays.slice(0, 6).map((py) => <Pressable key={String(py.id)} onPress={() => navigation.navigate('TechnicianPayrollDetail', { payrollId: py.id })} style={[S.plr, { borderBottomColor: colors.border }]}><View style={[S.pli, { backgroundColor: serviceBlue + '14' }]}><MaterialCommunityIcons name='calendar-text-outline' size={16} color={serviceBlue} /></View><View style={S.plb}><Text style={[S.plm, { color: colors.text }]}>{py?.period_start ? fmtDate(py.period_start) : '-'}</Text><Text style={[S.pls, { color: colors.textSecondary }]}>{py?.period_start && py?.period_end ? fmtDate(py.period_start) + ' - ' + fmtDate(py.period_end) : ''}</Text></View><Text style={[S.pla, { color: serviceGreen }]}>{money(py?.net_salary)}</Text><MaterialCommunityIcons name='chevron-right' size={15} color={colors.textTertiary} /></Pressable>)}</View>;

    return (
        <WrapperContainer>

            <View style={[S.screen, { backgroundColor: colors.backgroundSecondary }]}>
                <View style={[S.topBar, { backgroundColor: colors.backgroundSecondary }]}>
                    <Pressable onPress={() => navigation.goBack()} style={[S.ib, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name='arrow-left' size={22} color={serviceBlue} /></Pressable>
                    <View style={{ flex: 1 }}><Text style={[S.tbt, { color: colors.text }]}>Teknisyen Detayı</Text><Text style={[S.tbs, { color: colors.textSecondary }]}>Operasyon ve yetki yönetimi</Text></View>
                    <Pressable onPress={() => navigation.navigate('AdminEditTechnician', { technicianId: tid, technician: tech, onSuccess: (updated) => setTech(updated) })} style={[S.ib, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name='pencil-outline' size={22} color={serviceBlue} /></Pressable>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[S.scroll]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} colors={[serviceBlue]} />}>
                    <View style={[S.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={S.htop}>
                            <View style={S.aw}>{p.avatar ? <Image source={{ uri: p.avatar }} style={S.av} /> : <View style={[S.avf, { backgroundColor: serviceBlue + '18' }]}><Text style={[S.avi, { color: serviceBlue }]}>{p.initials}</Text></View>}<View style={[S.od, { backgroundColor: p.status.dot, borderColor: colors.surface }]} /></View>
                            <View style={S.hi}><Text style={[S.hn, { color: colors.text }]} numberOfLines={1}>{p.name}</Text><Text style={[S.hr2, { color: colors.textSecondary }]} numberOfLines={1}>{p.role}</Text>{p.email ? <Text style={[S.he, { color: colors.textTertiary }]} numberOfLines={1}>{p.email}</Text> : null}</View>
                            <View style={[S.badge, { backgroundColor: p.status.bg }]}><Text style={[S.badgeT, { color: p.status.color }]}>{p.status.label}</Text></View>
                        </View>
                        <View style={[S.div, { backgroundColor: colors.border }]} />
                        <View style={S.irow}>
                            <View style={S.iitem}><MaterialCommunityIcons name='clock-outline' size={14} color={colors.textSecondary} /><View><Text style={[S.ilabel, { color: colors.textSecondary }]}>İşe Başlangıç</Text><Text style={[S.ival, { color: colors.text }]}>{fmtDate(tech?.hire_date || tech?.created_at)}</Text></View></View>
                            <View style={S.iitem}><View style={[S.lsd, { backgroundColor: p.isOnline ? ONLINE_GREEN : '#94A3B8' }]} /><View><Text style={[S.ilabel, { color: colors.textSecondary }]}>Son Görülme</Text><Text style={[S.ival, { color: p.isOnline ? ONLINE_GREEN : colors.text }]}>{fmtLast(tech?.last_online, p.isOnline)}</Text></View></View>
                        </View>
                        <View style={S.ar}>
                            <ABtn icon='phone-outline' label='Ara' onPress={() => call('tel')} colors={colors} />
                            <ABtn icon='whatsapp' label='WhatsApp' onPress={() => call('whatsapp')} colors={colors} />
                            <ABtn icon='map-marker-radius-outline' label='Konum' onPress={() => navigation.navigate('TechnicianLocations', { technicianId: tid, technicianName: p.name })} colors={colors} />
                            <ABtn icon='clock-outline' label='Mesailer' onPress={() => navigation.navigate('TechnicianShifts', { technicianId: tid, technicianName: p.name })} colors={colors} />
                        </View>
                    </View>
                    <View style={[S.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>{TABS.map((t2) => <Pressable key={t2} onPress={() => setTab(t2)} style={[S.ti, tab === t2 && { borderBottomColor: serviceBlue, borderBottomWidth: 2 }]}><Text style={[S.tt, { color: tab === t2 ? serviceBlue : colors.textSecondary }, tab === t2 && S.tta]}>{t2}</Text></Pressable>)}</View>
                    {tab === 'Genel' && <G />}
                    {tab === 'Servisler' && <Sv />}
                    {tab === 'Yetkiler' && <Perm />}
                    {tab === 'Bordro' && <Pay />}
                </ScrollView>
                <AppBottomSheet visible={pSheet} onClose={() => setPSheet(false)} snapPoints={['80%']} wrapContent={false}>
                    <View style={[S.shc, { flex: 1 }]}>
                        <View style={S.shtr}><Text style={[S.shtt, { color: colors.text }]}>Yetki Düzenle</Text><Pressable onPress={() => setPSheet(false)}><MaterialCommunityIcons name='close' size={20} color={colors.textSecondary} /></Pressable></View>
                        <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[S.plist, { paddingBottom: 16 }]}>
                            {PERMS.map((o) => <PER key={o.key} item={o} value={Boolean(draft[o.key])} onToggle={togP} colors={colors} />)}
                            <View style={[S.shbs, { marginTop: 8 }]}><Pressable onPress={() => setPSheet(false)} style={[S.cbtn, { borderColor: colors.border }]}><Text style={[S.cbtnT, { color: colors.textSecondary }]}>Vazgeç</Text></Pressable><Pressable onPress={saveP} disabled={saving} style={[S.savbtn, { backgroundColor: serviceBlue, opacity: saving ? 0.7 : 1 }]}>{saving ? <ActivityIndicator size='small' color='#fff' /> : <Text style={S.savbtnT}>Kaydet</Text>}</Pressable></View>
                        </BottomSheetScrollView>
                    </View>
                </AppBottomSheet>
            </View>
        </WrapperContainer>

    );
}

const S = StyleSheet.create({
    screen: { flex: 1 }, c: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    topBar: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
    tbt: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 }, tbs: { fontSize: 13, fontWeight: '500', marginTop: 2 },
    ib: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: 16, gap: 14 },
    hero: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 14 },
    htop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    aw: { position: 'relative' }, av: { width: 72, height: 72, borderRadius: 22 },
    avf: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avi: { fontSize: 24, fontWeight: '800' },
    od: { position: 'absolute', right: 2, bottom: 2, width: 14, height: 14, borderRadius: 7, borderWidth: 2.5 },
    hi: { flex: 1, gap: 4 }, hn: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
    hr2: { fontSize: 13, fontWeight: '600' }, he: { fontSize: 12, fontWeight: '500' },
    badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }, badgeT: { fontSize: 11, fontWeight: '800' },
    div: { height: 1 }, irow: { flexDirection: 'row', gap: 24 },
    iitem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    ilabel: { fontSize: 11, fontWeight: '600' }, ival: { fontSize: 14, fontWeight: '800' },
    lsd: { width: 10, height: 10, borderRadius: 5 },
    ar: { flexDirection: 'row', gap: 8 },
    ab: { flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1, alignItems: 'center', gap: 5 },
    abl: { fontSize: 11, fontWeight: '700' },
    tabs: { flexDirection: 'row', borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
    ti: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tt: { fontSize: 13, fontWeight: '600' }, tta: { fontWeight: '800' },
    sg: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    sb: { width: '47%', borderRadius: 14, borderWidth: 1, padding: 10, gap: 4 },
    si: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    sl: { fontSize: 11, fontWeight: '600' }, sv: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
    card: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 10 },
    shr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    st: { fontSize: 17, fontWeight: '800' }, slink: { fontSize: 13, fontWeight: '700' },
    empty: { fontSize: 14, fontWeight: '600', paddingVertical: 8 },
    svr: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
    sdi: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    svb: { flex: 1, gap: 3 }, svt: { fontSize: 13, fontWeight: '700' }, svm: { fontSize: 11, fontWeight: '500' },
    pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 }, pillT: { fontSize: 11, fontWeight: '800' },
    tc: { flexDirection: 'row', gap: 10 },
    tcard: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 14, gap: 10 },
    cpw: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    cp: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 4 },
    cpt: { fontSize: 10, fontWeight: '700', maxWidth: 60 },
    prows: { gap: 8 }, prow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    plabel: { fontSize: 13, fontWeight: '600' }, pval: { fontSize: 13, fontWeight: '800' },
    pdiv: { height: 1, marginVertical: 2 }, pnl: { fontSize: 14, fontWeight: '700' }, pn: { fontSize: 16, fontWeight: '900' },
    pdb: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }, pdt: { fontSize: 12, fontWeight: '700', flex: 1 },
    lr: { flexDirection: 'row', gap: 14 }, li: { flex: 1, alignItems: 'center', gap: 6 },
    lib: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    ll: { fontSize: 11, fontWeight: '600', textAlign: 'center' }, lv: { fontSize: 18, fontWeight: '800' },
    plist: { gap: 8 },
    pr: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
    pi: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    pl: { flex: 1, fontSize: 13, fontWeight: '700' },
    plr: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
    pli: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    plb: { flex: 1, gap: 2 }, plm: { fontSize: 14, fontWeight: '700' }, pls: { fontSize: 11, fontWeight: '500' }, pla: { fontSize: 14, fontWeight: '800' },
    bbtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
    pbtn: { flex: 1, height: 52, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    pbtnT: { color: '#fff', fontSize: 15, fontWeight: '800' },
    sbtn: { flex: 1, height: 52, borderRadius: 18, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    sbtnT: { fontSize: 15, fontWeight: '800' },
    swt: { width: 42, height: 26, borderRadius: 999, paddingHorizontal: 3, justifyContent: 'center' },
    swk: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }, swko: { alignSelf: 'flex-end' },
    shc: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 14 },
    shtr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    shtt: { fontSize: 20, fontWeight: '800' },
    shbs: { flexDirection: 'row', gap: 12 },
    cbtn: { flex: 1, height: 50, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    cbtnT: { fontSize: 15, fontWeight: '700' },
    savbtn: { flex: 1.1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    savbtnT: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
