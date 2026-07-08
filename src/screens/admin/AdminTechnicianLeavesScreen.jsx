import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';
import AppBottomSheet from '@/components/AppBottomSheet';
import TechnicianPickerSheet from '@/components/home/TechnicianPickerSheet';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
const MONTHS_TR = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const YEARS = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
};

const getTechnicianName = (tech) => {
    if (!tech) return '';
    const u = tech.user;
    if (!u) return '';
    return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '';
};

const ATTENDANCE_STATUSES = [
    { value: 'leave', label: 'İzinli', color: serviceOrange, icon: 'calendar-account-outline' },
    { value: 'sick', label: 'Raporlu', color: serviceRed, icon: 'medical-bag' },
    { value: 'offday', label: 'Resmi Tatil', color: serviceBlue, icon: 'calendar-star' },
    { value: 'absent', label: 'Devamsız', color: '#64748B', icon: 'account-alert-outline' },
];

export default function AdminTechnicianLeavesScreen({ navigation, route }) {
    const { technicianId } = route.params || {};
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();

    const techPickerRef = useRef(null);
    const [technicians, setTechnicians] = useState([]);
    const [loadingTechs, setLoadingTechs] = useState(false);
    const [selectedTechId, setSelectedTechId] = useState(technicianId || null);

    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [selectedFilter, setSelectedFilter] = useState(null);

    // Form States
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [editingRecordId, setEditingRecordId] = useState(null);
    const [formDay, setFormDay] = useState(() => new Date().getDate());
    const [formMonth, setFormMonth] = useState(() => new Date().getMonth());
    const [formYear, setFormYear] = useState(() => new Date().getFullYear());
    const [formStatus, setFormStatus] = useState('leave');
    const [formStartHour, setFormStartHour] = useState(8);
    const [formStartMinute, setFormStartMinute] = useState(30);
    const [formEndHour, setFormEndHour] = useState(18);
    const [formEndMinute, setFormEndMinute] = useState(0);
    const [formNote, setFormNote] = useState('');
    const [pickerMode, setPickerMode] = useState(null); // 'date' | 'start_time' | 'end_time' | null
    const [submitting, setSubmitting] = useState(false);

    const selectedTech = technicians.find(t => String(t.id) === String(selectedTechId)) || null;

    const fetchTechnicians = useCallback(async () => {
        setLoadingTechs(true);
        try {
            const response = await api.get(ENDPOINTS.TECHNICIAN.LIST);
            const list = Array.isArray(response.data) ? response.data : [];
            setTechnicians(list);
            if (list.length > 0 && !selectedTechId) {
                setSelectedTechId(list[0].id);
            }
        } catch (err) {
            console.error('Fetch technicians error:', err);
            showToast('error', 'Hata', 'Teknisyen listesi yüklenemedi.');
        } finally {
            setLoadingTechs(false);
        }
    }, [selectedTechId, showToast]);

    const fetchAttendance = useCallback(async (isRefresh = false) => {
        if (!selectedTechId) return;
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const response = await api.get('technicians/attendance/', {
                params: {
                    technician: selectedTechId,
                    month: currentMonth,
                    include_shift: 'false',
                }
            });
            setRecords(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            console.error('Fetch attendance error:', err);
            showToast('error', 'Hata', 'İzin ve devam kayıtları yüklenemedi.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedTechId, currentMonth, showToast]);

    useEffect(() => {
        fetchTechnicians();
    }, []);

    useEffect(() => {
        fetchAttendance();
    }, [selectedTechId, currentMonth]);

    const handleMonthChange = (direction) => {
        const [year, month] = currentMonth.split('-').map(Number);
        let nextYear = year;
        let nextMonth = month + direction;

        if (nextMonth > 12) {
            nextMonth = 1;
            nextYear += 1;
        } else if (nextMonth < 1) {
            nextMonth = 12;
            nextYear -= 1;
        }

        setCurrentMonth(`${nextYear}-${String(nextMonth).padStart(2, '0')}`);
    };

    const handleOpenAddForm = () => {
        setEditingRecordId(null);
        const today = new Date();
        setFormDay(today.getDate());
        setFormMonth(today.getMonth());
        setFormYear(today.getFullYear());
        setFormStatus('leave');
        setFormStartHour(8);
        setFormStartMinute(30);
        setFormEndHour(18);
        setFormEndMinute(0);
        setFormNote('');
        setPickerMode(null);
        setIsFormVisible(true);
    };

    const handleOpenEditForm = (record) => {
        if (record.is_derived) {
            showToast('info', 'Bilgi', 'Bu kayıt mesai başlangıç/bitişinden otomatik türetilmiştir. Düzenlemek için mesailer sekmesini kullanın.');
            return;
        }
        setEditingRecordId(record.id);
        const d = new Date(record.date);
        setFormDay(d.getDate());
        setFormMonth(d.getMonth());
        setFormYear(d.getFullYear());
        setFormStatus(record.status);
        setFormNote(record.note || '');

        if (record.start_time) {
            const [h, m] = record.start_time.split(':').map(Number);
            setFormStartHour(h);
            setFormStartMinute(m);
        } else {
            setFormStartHour(8);
            setFormStartMinute(30);
        }

        if (record.end_time) {
            const [h, m] = record.end_time.split(':').map(Number);
            setFormEndHour(h);
            setFormEndMinute(m);
        } else {
            setFormEndHour(18);
            setFormEndMinute(0);
        }

        setPickerMode(null);
        setIsFormVisible(true);
    };

    const handleSave = async () => {
        if (!selectedTechId) {
            showToast('error', 'Hata', 'Lütfen bir teknisyen seçin.');
            return;
        }

        setSubmitting(true);
        try {
            const dateStr = `${formYear}-${String(formMonth + 1).padStart(2, '0')}-${String(formDay).padStart(2, '0')}`;
            const startTimeStr = formStatus === 'worked' ? `${String(formStartHour).padStart(2, '0')}:${String(formStartMinute).padStart(2, '0')}:00` : null;
            const endTimeStr = formStatus === 'worked' ? `${String(formEndHour).padStart(2, '0')}:${String(formEndMinute).padStart(2, '0')}:00` : null;

            const payload = {
                technician: selectedTechId,
                date: dateStr,
                status: formStatus,
                start_time: startTimeStr,
                end_time: endTimeStr,
                note: formNote,
            };

            if (editingRecordId) {
                await api.patch(`technicians/attendance/${editingRecordId}/`, payload);
                showToast('success', 'Başarılı', 'Kayıt başarıyla güncellendi.');
            } else {
                await api.post('technicians/attendance/', payload);
                showToast('success', 'Başarılı', 'Yeni izin/devam kaydı başarıyla eklendi.');
            }

            setIsFormVisible(false);
            fetchAttendance();
        } catch (err) {
            console.error('Save attendance error:', err?.response?.data || err);
            const msg = err?.response?.data?.detail || 'Kayıt kaydedilirken hata oluştu.';
            showToast('error', 'Hata', msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = () => {
        if (!editingRecordId) return;

        Alert.alert(
            'Kayıt Sil',
            'Bu izin/devam kaydını silmek istediğinize emin misiniz?',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            await api.delete(`technicians/attendance/${editingRecordId}/`);
                            showToast('success', 'Başarılı', 'Kayıt silindi.');
                            setIsFormVisible(false);
                            fetchAttendance();
                        } catch (err) {
                            console.error('Delete attendance error:', err);
                            showToast('error', 'Hata', 'Kayıt silinemedi.');
                        } finally {
                            setSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    // Calculate summaries
    const summary = records.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, { leave: 0, sick: 0, offday: 0, absent: 0, worked: 0 });

    const formatMonthTitle = (monthStr) => {
        const [y, m] = monthStr.split('-').map(Number);
        return `${MONTHS_TR[m - 1]} ${y}`;
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </Pressable>
                <View style={styles.headerTitleContainer}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Teknisyen İzinleri</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>İzin ve Devamsızlık Yönetimi</Text>
                </View>
                <Pressable onPress={handleOpenAddForm} style={[styles.addBtn, { borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="plus" size={22} color={serviceOrange} />
                </Pressable>
            </View>

            {/* Technician Picker Card */}
            <Pressable
                onPress={() => techPickerRef.current?.present()}
                style={[styles.techCard, { backgroundColor: isDark ? colors.surface : '#FFFFFF', borderColor: colors.border }]}
            >
                <View style={styles.techAvatarWrap}>
                    {selectedTech?.user?.profile_picture ? (
                        <Image source={{ uri: resolveMediaUrl(selectedTech.user.profile_picture) }} style={styles.techAvatar} />
                    ) : (
                        <View style={[styles.techAvatarPlaceholder, { backgroundColor: colors.border }]}>
                            <MaterialCommunityIcons name="account" size={24} color={colors.textTertiary} />
                        </View>
                    )}
                </View>
                <View style={styles.techInfo}>
                    <Text style={[styles.techName, { color: colors.text }]}>
                        {selectedTech ? getTechnicianName(selectedTech) : 'Teknisyen Seçin'}
                    </Text>
                    <Text style={[styles.techRole, { color: colors.textSecondary }]}>
                        {selectedTech?.user?.email || 'İzin kayıtlarını görüntülemek için tıklayın'}
                    </Text>
                </View>
                <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textTertiary} />
            </Pressable>

            {/* Month Navigator */}
            <View style={[styles.monthNav, { borderColor: colors.border }]}>
                <Pressable onPress={() => handleMonthChange(-1)} style={styles.monthNavBtn}>
                    <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
                </Pressable>
                <Text style={[styles.monthNavTitle, { color: colors.text }]}>{formatMonthTitle(currentMonth)}</Text>
                <Pressable onPress={() => handleMonthChange(1)} style={styles.monthNavBtn}>
                    <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text} />
                </Pressable>
            </View>

            {/* Summaries Panel */}
            <View style={styles.summaryContainer}>
                {ATTENDANCE_STATUSES.map(statusObj => {
                    const count = summary[statusObj.value] || 0;
                    const isSelected = selectedFilter === statusObj.value;
                    return (
                        <Pressable
                            key={statusObj.value}
                            onPress={() => setSelectedFilter(prev => prev === statusObj.value ? null : statusObj.value)}
                            style={[
                                styles.summaryCard,
                                {
                                    backgroundColor: isSelected
                                        ? `${statusObj.color}15`
                                        : isDark ? colors.surface : '#FFFFFF',
                                    borderColor: isSelected ? statusObj.color : colors.border
                                }
                            ]}
                        >
                            <View style={[styles.summaryIndicator, { backgroundColor: statusObj.color }]} />
                            <Text style={[styles.summaryCount, { color: isSelected ? statusObj.color : colors.text }]}>{count}</Text>
                            <Text style={[styles.summaryLabel, { color: isSelected ? statusObj.color : colors.textSecondary }]}>{statusObj.label}</Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={serviceOrange} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Kayıtlar yükleniyor...</Text>
                </View>
            ) : (
                <FlatList
                    data={records.filter(item => {
                        if (selectedFilter) {
                            return item.status === selectedFilter;
                        }
                        // Default filter: only show actual leaves/absences (exclude worked shifts from daily list noise)
                        return item.status !== 'worked';
                    })}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => {
                        const statusObj = ATTENDANCE_STATUSES.find(s => s.value === item.status) || ATTENDANCE_STATUSES[0];
                        return (
                            <Pressable
                                onPress={() => handleOpenEditForm(item)}
                                style={({ pressed }) => [
                                    styles.recordRow,
                                    {
                                        backgroundColor: isDark ? colors.surface : '#FFFFFF',
                                        borderColor: colors.border,
                                        opacity: pressed ? 0.8 : 1,
                                    }
                                ]}
                            >
                                <View style={[styles.statusLeftBar, { backgroundColor: statusObj.color }]} />
                                <View style={styles.recordContent}>
                                    <View style={styles.recordHeader}>
                                        <Text style={[styles.recordDate, { color: colors.text }]}>
                                            {dayjs(item.date).locale('tr').format('D MMMM YYYY, dddd')}
                                        </Text>
                                        <View style={[styles.statusBadge, { backgroundColor: `${statusObj.color}15` }]}>
                                            <MaterialCommunityIcons name={statusObj.icon} size={14} color={statusObj.color} style={{ marginRight: 4 }} />
                                            <Text style={[styles.statusBadgeText, { color: statusObj.color }]}>
                                                {statusObj.label}
                                            </Text>
                                        </View>
                                    </View>

                                    {item.status === 'worked' && (item.start_time || item.end_time) && (
                                        <Text style={[styles.recordTime, { color: colors.textSecondary }]}>
                                            Saatler: {item.start_time ? item.start_time.substring(0, 5) : '--:--'} - {item.end_time ? item.end_time.substring(0, 5) : '--:--'}
                                        </Text>
                                    )}

                                    {item.note ? (
                                        <Text style={[styles.recordNote, { color: colors.textTertiary }]} numberOfLines={2}>
                                            {item.note}
                                        </Text>
                                    ) : null}

                                    {item.is_derived && (
                                        <View style={styles.derivedBadge}>
                                            <MaterialCommunityIcons name="auto-fix" size={12} color={colors.textTertiary} style={{ marginRight: 4 }} />
                                            <Text style={[styles.derivedBadgeText, { color: colors.textTertiary }]}>Mesai Kaydından</Text>
                                        </View>
                                    )}
                                </View>
                            </Pressable>
                        );
                    }}
                    contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => fetchAttendance(true)} colors={[serviceOrange]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <MaterialCommunityIcons name="calendar-blank" size={48} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                {selectedFilter
                                    ? `"${ATTENDANCE_STATUSES.find(s => s.value === selectedFilter)?.label}" durumunda filtreli kayıt bulunamadı.`
                                    : 'Bu aya ait izin veya devamsızlık kaydı bulunamadı.'}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Form Sheet */}
            <AppBottomSheet
                visible={isFormVisible}
                onClose={() => setIsFormVisible(false)}
                snapPoints={['75%']}
                contentContainerStyle={styles.formContainer}
                wrapContent={true}
            >
                <View style={[styles.formHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.formTitle, { color: colors.text }]}>
                        {editingRecordId ? 'Kayıt Düzenle' : 'Yeni İzin / Devam Kaydı'}
                    </Text>
                    <Pressable onPress={() => setIsFormVisible(false)} style={styles.formCloseBtn}>
                        <MaterialCommunityIcons name="close" size={22} color={colors.text} />
                    </Pressable>
                </View>

                <BottomSheetScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 24 }}
                >
                    <View style={styles.formBody}>
                        {/* Date Input */}
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tarih</Text>
                        <Pressable
                            onPress={() => setPickerMode(pickerMode === 'date' ? null : 'date')}
                            style={[styles.formInputBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: colors.border }]}
                        >
                            <MaterialCommunityIcons name="calendar" size={18} color={serviceOrange} style={{ marginRight: 8 }} />
                            <Text style={[styles.formInputText, { color: colors.text }]}>
                                {`${formDay} ${MONTHS_TR[formMonth]} ${formYear}`}
                            </Text>
                            <MaterialCommunityIcons name={pickerMode === 'date' ? "chevron-up" : "chevron-down"} size={16} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
                        </Pressable>

                        {/* Date Picker Wheels */}
                        {pickerMode === 'date' && (
                            <View style={[styles.spinnerContainer, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }]}>
                                <View style={styles.spinnerColumn}>
                                    <Pressable onPress={() => {
                                        const max = getDaysInMonth(formMonth, formYear);
                                        setFormDay(prev => prev >= max ? 1 : prev + 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-up" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerValue, { color: colors.text }]}>
                                        {String(formDay).padStart(2, '0')}
                                    </Text>
                                    <Pressable onPress={() => {
                                        const max = getDaysInMonth(formMonth, formYear);
                                        setFormDay(prev => prev <= 1 ? max : prev - 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-down" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerLabel, { color: colors.textSecondary }]}>Gün</Text>
                                </View>

                                <View style={{ width: 1, height: '50%', backgroundColor: colors.border }} />

                                <View style={[styles.spinnerColumn, { flex: 1.8 }]}>
                                    <Pressable onPress={() => {
                                        setFormMonth(prev => prev >= 11 ? 0 : prev + 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-up" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerValue, { color: colors.text }]} numberOfLines={1}>
                                        {MONTHS_TR[formMonth]}
                                    </Text>
                                    <Pressable onPress={() => {
                                        setFormMonth(prev => prev <= 0 ? 11 : prev - 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-down" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerLabel, { color: colors.textSecondary }]}>Ay</Text>
                                </View>

                                <View style={{ width: 1, height: '50%', backgroundColor: colors.border }} />

                                <View style={styles.spinnerColumn}>
                                    <Pressable onPress={() => {
                                        setFormYear(prev => prev + 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-up" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerValue, { color: colors.text }]}>
                                        {formYear}
                                    </Text>
                                    <Pressable onPress={() => {
                                        setFormYear(prev => prev - 1);
                                    }} style={styles.spinnerArrow}>
                                        <MaterialCommunityIcons name="chevron-down" size={26} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.spinnerLabel, { color: colors.textSecondary }]}>Yıl</Text>
                                </View>
                            </View>
                        )}

                        {/* Status Grid Selection */}
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 20 }]}>İzin / Devam Durumu</Text>
                        <View style={styles.statusGrid}>
                            {ATTENDANCE_STATUSES.map(s => {
                                const isSelected = formStatus === s.value;
                                return (
                                    <Pressable
                                        key={s.value}
                                        onPress={() => setFormStatus(s.value)}
                                        style={[
                                            styles.statusGridCard,
                                            {
                                                backgroundColor: isSelected ? `${s.color}10` : isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
                                                borderColor: isSelected ? s.color : colors.border,
                                            }
                                        ]}
                                    >
                                        <View style={[styles.statusIconWrap, { backgroundColor: isSelected ? s.color : isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }]}>
                                            <MaterialCommunityIcons
                                                name={s.icon}
                                                size={18}
                                                color={isSelected ? '#FFFFFF' : colors.textSecondary}
                                            />
                                        </View>
                                        <Text style={[styles.statusCardLabel, { color: isSelected ? s.color : colors.text }]}>
                                            {s.label}
                                        </Text>
                                        {isSelected && (
                                            <View style={[styles.statusCardCheck, { backgroundColor: s.color }]}>
                                                <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
                                            </View>
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* Note Input Card */}
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 20 }]}>Açıklama / Gerekçe</Text>
                        <View style={[styles.noteInputWrapper, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF' }]}>
                            <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.textTertiary} style={styles.noteIcon} />
                            <TextInput
                                value={formNote}
                                onChangeText={setFormNote}
                                placeholder="İzin nedeni, açıklama veya gerekçe yazın..."
                                placeholderTextColor={colors.textTertiary}
                                multiline
                                numberOfLines={3}
                                style={[styles.noteTextInput, { color: colors.text }]}
                            />
                        </View>
                    </View>

                    {/* Actions */}
                    <View style={[styles.formActions, editingRecordId && { flexDirection: 'row', gap: 10 }, { marginTop: 24 }]}>
                        {editingRecordId && (
                            <Pressable
                                onPress={handleDelete}
                                disabled={submitting}
                                style={({ pressed }) => [
                                    styles.deleteBtn,
                                    {
                                        borderColor: serviceRed,
                                        opacity: pressed || submitting ? 0.8 : 1,
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons name="trash-can-outline" size={20} color={serviceRed} style={{ marginRight: 6 }} />
                                <Text style={[styles.deleteBtnText, { color: serviceRed }]}>Sil</Text>
                            </Pressable>
                        )}
                        <Pressable
                            onPress={handleSave}
                            disabled={submitting}
                            style={({ pressed }) => [
                                styles.submitBtn,
                                {
                                    flex: editingRecordId ? 1 : 1,
                                    backgroundColor: serviceOrange,
                                    opacity: pressed || submitting ? 0.8 : 1,
                                },
                            ]}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="check" size={20} color="#fff" style={{ marginRight: 6 }} />
                                    <Text style={styles.submitBtnText}>
                                        {editingRecordId ? 'Güncelle' : 'Kaydet'}
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                </BottomSheetScrollView>
            </AppBottomSheet>

            {/* Technician Picker Sheet */}
            <TechnicianPickerSheet
                ref={techPickerRef}
                technicians={technicians}
                loading={loadingTechs}
                selectedTechnicianId={selectedTechId}
                includeUnassigned={false}
                onSelect={(tech) => {
                    setSelectedTechId(tech.id);
                    techPickerRef.current?.dismiss();
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleContainer: {
        flex: 1,
        marginLeft: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
    },
    headerSubtitle: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 1,
    },
    addBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    techCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 8,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
    },
    techAvatarWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        overflow: 'hidden',
    },
    techAvatar: {
        width: '100%',
        height: '100%',
    },
    techAvatarPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    techInfo: {
        flex: 1,
        marginLeft: 12,
    },
    techName: {
        fontSize: 14,
        fontWeight: '800',
    },
    techRole: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 1,
    },
    monthNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: 16,
        marginTop: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    monthNavBtn: {
        padding: 4,
    },
    monthNavTitle: {
        fontSize: 14,
        fontWeight: '900',
    },
    summaryContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginTop: 12,
        gap: 6,
        flexWrap: 'wrap',
    },
    summaryCard: {
        flex: 1,
        minWidth: '18%',
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    summaryIndicator: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
    },
    summaryCount: {
        fontSize: 15,
        fontWeight: '900',
    },
    summaryLabel: {
        fontSize: 9,
        fontWeight: '700',
        marginTop: 2,
        textAlign: 'center',
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    loadingText: {
        fontSize: 13,
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    recordRow: {
        flexDirection: 'row',
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 10,
        overflow: 'hidden',
        minHeight: 70,
    },
    statusLeftBar: {
        width: 5,
    },
    recordContent: {
        flex: 1,
        padding: 12,
    },
    recordRowPressed: {
        opacity: 0.8,
    },
    recordHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    recordDate: {
        fontSize: 13,
        fontWeight: '800',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    recordTime: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
    },
    recordNote: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 6,
        lineHeight: 14,
    },
    derivedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    derivedBadgeText: {
        fontSize: 9,
        fontWeight: '700',
    },
    emptyWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        gap: 12,
    },
    emptyText: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        maxWidth: '80%',
    },
    formContainer: {
        paddingHorizontal: 16,
    },
    formHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    formTitle: {
        fontSize: 16,
        fontWeight: '900',
    },
    formCloseBtn: {
        padding: 4,
    },
    formBody: {
        paddingTop: 16,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '800',
        marginBottom: 6,
    },
    formInputBtn: {
        height: 48,
        borderRadius: 12,
        borderWidth: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    formInputText: {
        fontSize: 13,
        fontWeight: '700',
    },
    statusChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statusChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1.5,
    },
    statusChipText: {
        fontSize: 12,
        fontWeight: '800',
    },
    timeRow: {
        flexDirection: 'row',
        marginTop: 16,
    },
    noteInput: {
        height: 72,
        borderWidth: 1.5,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        fontWeight: '600',
        textAlignVertical: 'top',
    },
    formActions: {
        flexDirection: 'row',
    },
    submitBtn: {
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        minWidth: 120,
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
    },
    deleteBtn: {
        flex: 0.8,
        height: 48,
        borderRadius: 14,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    deleteBtnText: {
        fontSize: 14,
        fontWeight: '800',
    },
    spinnerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: 18,
        height: 150,
        marginTop: 10,
        marginBottom: 10,
        paddingHorizontal: 16,
        gap: 12,
    },
    spinnerColumn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    spinnerArrow: {
        padding: 6,
    },
    spinnerValue: {
        fontSize: 18,
        fontWeight: '900',
        marginVertical: 4,
        textAlign: 'center',
    },
    spinnerLabel: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginTop: 2,
    },
    statusGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    statusGridCard: {
        width: '48%',
        flexGrow: 1,
        minWidth: '45%',
        borderWidth: 1.5,
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
        gap: 10,
    },
    statusIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusCardLabel: {
        fontSize: 13,
        fontWeight: '800',
    },
    statusCardCheck: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noteInputWrapper: {
        borderWidth: 1.5,
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        minHeight: 80,
    },
    noteIcon: {
        marginRight: 8,
        marginTop: 2,
    },
    noteTextInput: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        textAlignVertical: 'top',
        padding: 0,
    },
});
