import React, { useState, useEffect, useMemo } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import api from '@/api/axios';
import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import { serviceBlue, serviceGreen, serviceOrange, serviceRed } from '@/theme/color';

const ANNOUNCEMENT_TEMPLATES = [
    {
        id: 'maintenance',
        name: 'Bakım Bilgilendirmesi',
        title: 'Planlı bakım duyurusu',
        message: 'Sistem bakımımız bu gece 23:00 - 01:00 arasında gerçekleştirilecektir.',
        icon: 'wrench-clock',
        color: serviceOrange,
    },
    {
        id: 'campaign',
        name: 'Kampanya Duyurusu',
        title: 'Yeni kampanya başladı',
        message: 'Bu hafta servis işlemlerinde yüzde 10 indirim fırsatı sizi bekliyor.',
        icon: 'bullhorn',
        color: serviceGreen,
    },
    {
        id: 'urgent',
        name: 'Acil Bilgilendirme',
        title: 'Önemli sistem uyarısı',
        message: 'Bazı işlemlerde gecikme yaşanabilir. Ekip sorunu çözmek için çalışıyor.',
        icon: 'alert-decagram',
        color: serviceRed,
    }
];

export default function AdminNotificationsScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { showToast } = useToast();

    // Sekmeler: 'compose', 'templates', 'history'
    const [activeTab, setActiveTab] = useState('compose');
    
    // Veri Yükleme
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [sentHistory, setSentHistory] = useState([]);

    // Form Elemanları
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [sendToAll, setSendToAll] = useState(true);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [sendPush, setSendPush] = useState(true);
    const [sendEmail, setSendEmail] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Klavye Yüksekliği (Tasarım Kaymalarını Önlemek İçin)
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => setKeyboardHeight(e.endCoordinates.height)
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardHeight(0)
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // Kullanıcıları Çekme
    useEffect(() => {
        const fetchUsers = async () => {
            setLoadingUsers(true);
            try {
                const response = await api.get('/accounts/admin/users/');
                setUsers(Array.isArray(response.data) ? response.data : []);
            } catch (err) {
                console.log('Fetch users error:', err);
                showToast('error', 'Hata', 'Kullanıcı listesi alınamadı.');
            } finally {
                setLoadingUsers(false);
            }
        };
        fetchUsers();
    }, [showToast]);

    // Aktif ve Filtrelenmiş Kullanıcılar
    const activeUsers = useMemo(() => users.filter((u) => u.is_active), [users]);
    
    const filteredUsers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return activeUsers;
        return activeUsers.filter((u) => {
            const nameMatch = u.full_name?.toLowerCase().includes(query);
            const emailMatch = u.email?.toLowerCase().includes(query);
            const phoneMatch = u.phone_number?.includes(query);
            return nameMatch || emailMatch || phoneMatch;
        });
    }, [activeUsers, searchQuery]);

    const selectedCount = sendToAll ? activeUsers.length : selectedUserIds.length;
    const isFormValid = title.trim() && message.trim() && selectedCount > 0 && (sendPush || sendEmail);

    const toggleUserSelection = (userId) => {
        setSelectedUserIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const handleSelectAllFiltered = () => {
        const filteredIds = filteredUsers.map((u) => u.id);
        const allSelected = filteredIds.every((id) => selectedUserIds.includes(id));

        if (allSelected) {
            setSelectedUserIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
        } else {
            setSelectedUserIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
        }
    };

    const handleApplyTemplate = (tpl) => {
        setTitle(tpl.title);
        setMessage(tpl.message);
        setActiveTab('compose');
        showToast('success', 'Şablon Seçildi', `${tpl.name} şablonu uygulandı.`);
    };

    const handleSendNotification = async () => {
        if (!isFormValid || submitting) return;

        Alert.alert(
            'Bildirimi Gönder',
            `${selectedCount} kişiye bu bildirimi göndermek istediğinize emin misiniz?`,
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Gönder',
                    onPress: async () => {
                        setSubmitting(true);
                        const payload = {
                            title: title.trim(),
                            message: message.trim(),
                            send_to_all: sendToAll,
                            user_ids: sendToAll ? [] : selectedUserIds,
                            send_push: sendPush,
                            send_email: sendEmail
                        };

                        try {
                            const res = await api.post('/notifications/admin/notifications/send/', payload);
                            const msg = res?.data?.detail || 'Bildirim başarıyla gönderildi.';
                            showToast('success', 'Başarılı', msg);

                            // Gönderim Geçmişine Ekle
                            setSentHistory((prev) => [
                                {
                                    id: String(Date.now()),
                                    title: title.trim(),
                                    message: message.trim(),
                                    recipientCount: selectedCount,
                                    channels: { push: sendPush, email: sendEmail },
                                    sentToAll: sendToAll,
                                    sentAt: new Date().toISOString()
                                },
                                ...prev
                            ]);

                            // Formu Temizle
                            setTitle('');
                            setMessage('');
                            setSelectedUserIds([]);
                            setSendToAll(true);
                            setSendPush(true);
                            setSendEmail(false);
                            setSearchQuery('');
                            setActiveTab('history');
                        } catch (err) {
                            console.log('Send notification error:', err);
                            const errMsg = err?.response?.data?.detail || err?.response?.data?.error || 'Bildirim gönderilemedi.';
                            showToast('error', 'Hata', errMsg);
                        } finally {
                            setSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    const border = colors.border;
    const cardBg = colors.surface;

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES} style={{ backgroundColor: colors.background }}>
            <Header title="Bildirim & Duyuru Yönetimi" showBack borderBottom />

            {/* Sekme Seçiciler */}
            <View style={[styles.tabContainer, { borderColor: border, backgroundColor: cardBg }]}>
                <Pressable
                    onPress={() => setActiveTab('compose')}
                    style={[styles.tabBtn, activeTab === 'compose' && [styles.tabActiveBtn, { backgroundColor: serviceBlue }]]}
                >
                    <Text style={[styles.tabBtnText, { color: activeTab === 'compose' ? '#FFF' : colors.textSecondary }]}>
                        Duyuru Gönder
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => setActiveTab('templates')}
                    style={[styles.tabBtn, activeTab === 'templates' && [styles.tabActiveBtn, { backgroundColor: serviceBlue }]]}
                >
                    <Text style={[styles.tabBtnText, { color: activeTab === 'templates' ? '#FFF' : colors.textSecondary }]}>
                        Şablonlar
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => setActiveTab('history')}
                    style={[styles.tabBtn, activeTab === 'history' && [styles.tabActiveBtn, { backgroundColor: serviceBlue }]]}
                >
                    <Text style={[styles.tabBtnText, { color: activeTab === 'history' ? '#FFF' : colors.textSecondary }]}>
                        Geçmiş ({sentHistory.length})
                    </Text>
                </Pressable>
            </View>

            {/* ─── 1. DUYURU GÖNDER SEKME DETAYI ─── */}
            {activeTab === 'compose' && (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={0}
                >
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={[styles.scrollContent, { paddingBottom: keyboardHeight + insets.bottom + 30 }]}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.formContainer}>
                            
                            {/* Bildirim Başlığı */}
                            <View style={[styles.inputGroup, { backgroundColor: cardBg, borderColor: border }]}>
                                <View style={styles.inputHeader}>
                                    <MaterialCommunityIcons name="format-title" size={16} color={serviceBlue} />
                                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Bildirim Başlığı</Text>
                                </View>
                                <TextInput
                                    value={title}
                                    onChangeText={setTitle}
                                    style={[styles.textInput, { color: colors.text }]}
                                    placeholder="Örn: Önemli Sistem Güncellemesi"
                                    placeholderTextColor={colors.textTertiary}
                                />
                            </View>

                            {/* Bildirim Mesajı */}
                            <View style={[styles.inputGroup, { backgroundColor: cardBg, borderColor: border }]}>
                                <View style={styles.inputHeader}>
                                    <MaterialCommunityIcons name="email-open-outline" size={16} color={serviceOrange} />
                                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Mesaj / Duyuru İçeriği</Text>
                                </View>
                                <TextInput
                                    value={message}
                                    onChangeText={setMessage}
                                    multiline
                                    numberOfLines={4}
                                    style={[styles.textInput, { color: colors.text, height: 80, textAlignVertical: 'top' }]}
                                    placeholder="Duyuru detaylarını buraya yazın..."
                                    placeholderTextColor={colors.textTertiary}
                                />
                            </View>

                            {/* Alıcı Türü */}
                            <View style={[styles.optionCard, { backgroundColor: cardBg, borderColor: border }]}>
                                <Text style={[styles.optionTitle, { color: colors.text }]}>Alıcı Seçimi</Text>
                                <View style={styles.rowActions}>
                                    <Pressable
                                        onPress={() => setSendToAll(true)}
                                        style={[
                                            styles.choiceBtn,
                                            sendToAll && { backgroundColor: `${serviceBlue}12`, borderColor: serviceBlue }
                                        ]}
                                    >
                                        <MaterialCommunityIcons
                                            name={sendToAll ? 'radiobox-marked' : 'radiobox-blank'}
                                            size={18}
                                            color={sendToAll ? serviceBlue : colors.textTertiary}
                                        />
                                        <Text style={[styles.choiceText, { color: sendToAll ? serviceBlue : colors.text }]}>Herkese Gönder</Text>
                                    </Pressable>

                                    <Pressable
                                        onPress={() => setSendToAll(false)}
                                        style={[
                                            styles.choiceBtn,
                                            !sendToAll && { backgroundColor: `${serviceBlue}12`, borderColor: serviceBlue }
                                        ]}
                                    >
                                        <MaterialCommunityIcons
                                            name={!sendToAll ? 'radiobox-marked' : 'radiobox-blank'}
                                            size={18}
                                            color={!sendToAll ? serviceBlue : colors.textTertiary}
                                        />
                                        <Text style={[styles.choiceText, { color: !sendToAll ? serviceBlue : colors.text }]}>Özel Seçim</Text>
                                    </Pressable>
                                </View>
                            </View>

                            {/* Kullanıcı Seçim Listesi (Özel Seçim ise) */}
                            {!sendToAll && (
                                <View style={[styles.listContainer, { backgroundColor: cardBg, borderColor: border }]}>
                                    <View style={styles.listHeader}>
                                        <Text style={[styles.optionTitle, { color: colors.text }]}>Kullanıcı Seçimi ({selectedUserIds.length})</Text>
                                        <Pressable onPress={handleSelectAllFiltered} style={styles.selectAllBtn}>
                                            <Text style={[styles.selectAllText, { color: serviceBlue }]}>Filtrelenenleri Seç</Text>
                                        </Pressable>
                                    </View>

                                    {/* Arama Barı */}
                                    <View style={[styles.searchBox, { borderColor: border }]}>
                                        <MaterialCommunityIcons name="magnify" size={18} color={colors.textTertiary} />
                                        <TextInput
                                            value={searchQuery}
                                            onChangeText={setSearchQuery}
                                            placeholder="Kullanıcı adı, e-posta veya tel..."
                                            placeholderTextColor={colors.textTertiary}
                                            style={[styles.searchInput, { color: colors.text }]}
                                        />
                                    </View>

                                    {loadingUsers ? (
                                        <ActivityIndicator size="small" color={serviceBlue} style={{ marginVertical: 20 }} />
                                    ) : filteredUsers.length === 0 ? (
                                        <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>Kullanıcı bulunamadı.</Text>
                                    ) : (
                                        <ScrollView style={styles.usersScrollView} nestedScrollEnabled>
                                            {filteredUsers.map((user) => {
                                                const isSelected = selectedUserIds.includes(user.id);
                                                return (
                                                    <Pressable
                                                        key={user.id}
                                                        onPress={() => toggleUserSelection(user.id)}
                                                        style={[styles.userRow, { borderBottomColor: border }]}
                                                    >
                                                        <MaterialCommunityIcons
                                                            name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                                            size={20}
                                                            color={isSelected ? serviceBlue : colors.textTertiary}
                                                        />
                                                        <View style={styles.userInfo}>
                                                            <Text style={[styles.userNameText, { color: colors.text }]}>{user.full_name}</Text>
                                                            <Text style={[styles.userSubText, { color: colors.textSecondary }]}>
                                                                {user.email || user.phone_number || '-'}
                                                            </Text>
                                                        </View>
                                                    </Pressable>
                                                );
                                            })}
                                        </ScrollView>
                                    )}
                                </View>
                            )}

                            {/* Gönderim Kanalları */}
                            <View style={[styles.optionCard, { backgroundColor: cardBg, borderColor: border }]}>
                                <Text style={[styles.optionTitle, { color: colors.text }]}>Gönderim Kanalları</Text>
                                <View style={{ gap: 8, marginTop: 8 }}>
                                    <Pressable
                                        onPress={() => setSendPush(!sendPush)}
                                        style={styles.switchRow}
                                    >
                                        <Text style={[styles.choiceText, { color: colors.text }]}>Uygulama İçi / Mobil Bildirim (Push Notification)</Text>
                                        <MaterialCommunityIcons
                                            name={sendPush ? 'toggle-switch' : 'toggle-switch-off-outline'}
                                            size={32}
                                            color={sendPush ? serviceGreen : colors.textTertiary}
                                        />
                                    </Pressable>

                                    <Pressable
                                        onPress={() => setSendEmail(!sendEmail)}
                                        style={styles.switchRow}
                                    >
                                        <Text style={[styles.choiceText, { color: colors.text }]}>E-Posta Gönder</Text>
                                        <MaterialCommunityIcons
                                            name={sendEmail ? 'toggle-switch' : 'toggle-switch-off-outline'}
                                            size={32}
                                            color={sendEmail ? serviceGreen : colors.textTertiary}
                                        />
                                    </Pressable>
                                </View>
                            </View>

                            {/* Gönderim Butonu */}
                            <Pressable
                                onPress={handleSendNotification}
                                disabled={!isFormValid || submitting}
                                style={({ pressed }) => [
                                    styles.submitBtn,
                                    { backgroundColor: isFormValid ? serviceBlue : colors.textTertiary },
                                    (pressed || submitting) && { opacity: 0.8 }
                                ]}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <>
                                        <MaterialCommunityIcons name="send" size={18} color="#FFF" />
                                        <Text style={styles.submitBtnText}>Duyuruyu Yayınla ({selectedCount})</Text>
                                    </>
                                )}
                            </Pressable>

                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            )}

            {/* ─── 2. ŞABLONLAR SEKME DETAYI ─── */}
            {activeTab === 'templates' && (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={{ gap: 12 }}>
                        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                            Aşağıdaki hazır bildirim şablonlarını hızlıca seçerek doğrudan doldurulmuş olarak yayına alabilirsiniz.
                        </Text>

                        {ANNOUNCEMENT_TEMPLATES.map((tpl) => (
                            <Pressable
                                key={tpl.id}
                                onPress={() => handleApplyTemplate(tpl)}
                                style={({ pressed }) => [
                                    styles.templateCard,
                                    { backgroundColor: cardBg, borderColor: border, opacity: pressed ? 0.9 : 1 }
                                ]}
                            >
                                <View style={[styles.templateIconWrap, { backgroundColor: `${tpl.color}15` }]}>
                                    <MaterialCommunityIcons name={tpl.icon} size={22} color={tpl.color} />
                                </View>
                                <View style={{ flex: 1, gap: 4 }}>
                                    <Text style={[styles.templateName, { color: colors.text }]}>{tpl.name}</Text>
                                    <Text style={[styles.templateTitleText, { color: colors.textSecondary }]}>{tpl.title}</Text>
                                    <Text style={[styles.templateDesc, { color: colors.textTertiary }]} numberOfLines={2}>{tpl.message}</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
                            </Pressable>
                        ))}
                    </View>
                </ScrollView>
            )}

            {/* ─── 3. GÖNDERİM GEÇMİŞİ SEKME DETAYI ─── */}
            {activeTab === 'history' && (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {sentHistory.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="history" size={42} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Geçmişte gönderilen duyuru bulunmamaktadır.</Text>
                        </View>
                    ) : (
                        <View style={{ gap: 12 }}>
                            {sentHistory.map((history) => (
                                <View key={history.id} style={[styles.historyCard, { backgroundColor: cardBg, borderColor: border }]}>
                                    <View style={styles.historyCardHeader}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <MaterialCommunityIcons name="bullhorn-outline" size={16} color={serviceBlue} />
                                            <Text style={[styles.historyTitleText, { color: colors.text }]}>{history.title}</Text>
                                        </View>
                                        <Text style={[styles.historyDateText, { color: colors.textTertiary }]}>
                                            {dayjs(history.sentAt).format('DD MMM, HH:mm')}
                                        </Text>
                                    </View>

                                    <Text style={[styles.historyMsgText, { color: colors.textSecondary }]}>{history.message}</Text>

                                    <View style={styles.historyFooter}>
                                        <View style={[styles.recipientBadge, { backgroundColor: `${serviceBlue}10` }]}>
                                            <MaterialCommunityIcons name="account-multiple-outline" size={13} color={serviceBlue} />
                                            <Text style={[styles.recipientBadgeText, { color: serviceBlue }]}>
                                                {history.sentToAll ? 'Herkese' : `${history.recipientCount} Kişi`}
                                            </Text>
                                        </View>

                                        <View style={{ flexDirection: 'row', gap: 6, marginLeft: 'auto' }}>
                                            {history.channels.push && (
                                                <View style={[styles.channelBadge, { backgroundColor: `${serviceGreen}10` }]}>
                                                    <Text style={{ fontSize: 9, fontWeight: '800', color: serviceGreen }}>PUSH</Text>
                                                </View>
                                            )}
                                            {history.channels.email && (
                                                <View style={[styles.channelBadge, { backgroundColor: `${serviceOrange}10` }]}>
                                                    <Text style={{ fontSize: 9, fontWeight: '800', color: serviceOrange }}>E-POSTA</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>
            )}

        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

    // Sekmeler
    tabContainer: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 3,
        borderWidth: 1,
        marginHorizontal: 16,
        marginTop: 10,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 9,
    },
    tabActiveBtn: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1.5,
    },
    tabBtnText: { fontSize: 11, fontWeight: '800' },

    formContainer: { gap: 12, marginTop: 10 },
    sectionSubtitle: { fontSize: 12, fontWeight: '600', marginBottom: 8, lineHeight: 18 },

    // Inputs
    inputGroup: {
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 6,
    },
    inputHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    inputLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    textInput: { fontSize: 14, fontWeight: '700', padding: 0, margin: 0 },

    // Option Cards
    optionCard: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        gap: 10,
    },
    optionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

    rowActions: { flexDirection: 'row', gap: 10 },
    choiceBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderColor: 'transparent',
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 10,
    },
    choiceText: { fontSize: 11, fontWeight: '800' },

    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },

    // User Select List
    listContainer: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        gap: 10,
    },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectAllBtn: { paddingVertical: 2 },
    selectAllText: { fontSize: 11, fontWeight: '800' },

    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 38,
        gap: 6,
    },
    searchInput: { flex: 1, fontSize: 12, fontWeight: '600', padding: 0 },
    emptyListText: { fontSize: 11, fontWeight: '600', textAlign: 'center', paddingVertical: 20 },

    usersScrollView: { maxHeight: 180, marginTop: 4 },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 10,
    },
    userInfo: { flex: 1 },
    userNameText: { fontSize: 12, fontWeight: '800' },
    userSubText: { fontSize: 10, fontWeight: '600', marginTop: 2 },

    // Submit
    submitBtn: {
        flexDirection: 'row',
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 8,
    },
    submitBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800' },

    // Templates
    templateCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        gap: 12,
    },
    templateIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    templateName: { fontSize: 13, fontWeight: '800' },
    templateTitleText: { fontSize: 11, fontWeight: '700' },
    templateDesc: { fontSize: 11, fontWeight: '600', lineHeight: 15 },

    // History
    historyCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        gap: 8,
    },
    historyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyTitleText: { fontSize: 13, fontWeight: '800', flex: 1 },
    historyDateText: { fontSize: 10, fontWeight: '600' },
    historyMsgText: { fontSize: 11, fontWeight: '600', lineHeight: 16 },

    historyFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    recipientBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        gap: 4,
    },
    recipientBadgeText: { fontSize: 10, fontWeight: '800' },
    channelBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5,
    },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 8 },
    emptyText: { fontSize: 12, fontWeight: '600', textAlign: 'center', width: '80%' },
});
