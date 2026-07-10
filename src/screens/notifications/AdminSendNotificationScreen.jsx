import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
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
import { useRoute } from '@react-navigation/native';

import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import Header from '@/components/Header';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { semanticRadius } from '@/theme/radius';
import { serviceBlue, serviceOrange } from '@/theme/color';
import UserPickerSheet from './UserPickerSheet';

const MAX_TITLE = 120;
const MAX_MESSAGE = 500;

const Section = ({ title, hint, colors, children }) => (
    <View style={styles.section}>
        <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
                {hint ? <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>{hint}</Text> : null}
            </View>
        </View>
        {children}
    </View>
);

const SwitchRow = ({ icon, iconColor, title, description, value, onValueChange, colors }) => (
    <View style={[styles.switchRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <View style={[styles.switchIcon, { backgroundColor: `${iconColor}1A` }]}>
            <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={[styles.switchTitle, { color: colors.text }]}>{title}</Text>
            {description ? <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>{description}</Text> : null}
        </View>
        <Switch
            value={value}
            onValueChange={onValueChange}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
        />
    </View>
);

export default function AdminSendNotificationScreen({ route }) {
    const { colors } = useTheme();
    const { showToast } = useToast();
    const routeParams = useRoute()?.params || {};
    const presetUser = routeParams?.presetUser || route?.params?.presetUser || null;

    const pickerRef = useRef(null);
    const [activeTab, setActiveTab] = useState('compose');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [sendPush, setSendPush] = useState(true);
    const [sendEmail, setSendEmail] = useState(false);
    const [sendToAll, setSendToAll] = useState(true);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        if (presetUser?.id) {
            setSendToAll(false);
            setSelectedUserIds([presetUser.id]);
        }
    }, [presetUser?.id]);

    const selectedCount = sendToAll ? 'Tüm aktif kullanıcılar' : `${selectedUserIds.length} kişi`;
    const isFormValid = title.trim().length > 0 && message.trim().length > 0 && (sendToAll || selectedUserIds.length > 0) && (sendPush || sendEmail);

    const resetForm = () => {
        setTitle('');
        setMessage('');
        setSendPush(true);
        setSendEmail(false);
        setSendToAll(!presetUser);
        setSelectedUserIds(presetUser?.id ? [presetUser.id] : []);
    };

    const handlePickedUsers = (ids) => {
        setSelectedUserIds(ids);
        if (ids.length > 0) setSendToAll(false);
    };

    const handleSubmit = async () => {
        if (submitting || !isFormValid) return;

        const payload = {
            title: title.trim(),
            message: message.trim(),
            send_to_all: sendToAll,
            user_ids: sendToAll ? [] : selectedUserIds,
            send_push: sendPush,
            send_email: sendEmail,
        };

        const confirmText = sendToAll
            ? 'Tum aktif kullanıcılara bu bildirimi göndermek istediğinize emin misiniz?'
            : `${selectedUserIds.length} kişiye bu bildirimi göndermek istediğinize emin misiniz?`;

        const proceed = await new Promise((resolve) => {
            Alert.alert('Onayla', confirmText, [
                { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Gönder', onPress: () => resolve(true) },
            ]);
        });
        if (!proceed) return;

        setSubmitting(true);
        try {
            const response = await api.post(ENDPOINTS.NOTIFICATIONS.ADMIN_SEND, payload);
            const successMessage = response?.data?.detail || `${sendToAll ? 'Tüm aktif kullanıcılara' : `${selectedUserIds.length} kişiye`} bildirim gönderildi.`;

            showToast('success', 'Gönderildi', successMessage);
            setHistory((prev) => [
                {
                    id: Date.now(),
                    title: title.trim(),
                    message: message.trim(),
                    recipientLabel: selectedCount,
                    sendPush,
                    sendEmail,
                    sentAt: new Date().toISOString(),
                },
                ...prev,
            ]);

            resetForm();
            setActiveTab('history');
        } catch (error) {
            const data = error?.response?.data;
            let msg = 'Gönderim sırasında hata oluştu.';
            if (typeof data?.detail === 'string') msg = data.detail;
            else if (typeof data === 'object' && data) {
                const first = Object.values(data).find((v) => v);
                if (Array.isArray(first)) msg = String(first[0]);
                else if (typeof first === 'string') msg = first;
            }
            showToast('error', 'Hata', msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <WrapperContainer bg={colors.background} edges={NO_BOTTOM_EDGES}>
            <Header title="Bildirim Gönder" showBack backVariant="minimal" centered borderBottom />

            <View style={[styles.tabBar, { borderBottomColor: colors.divider }]}>
                {[
                    { key: 'compose', label: 'Yeni Oluştur', icon: 'plus-circle-outline' },
                    { key: 'history', label: `Geçmiş (${history.length})`, icon: 'history' },
                ].map((tab) => {
                    const active = activeTab === tab.key;
                    return (
                        <Pressable
                            key={tab.key}
                            onPress={() => setActiveTab(tab.key)}
                            style={[styles.tabItem, { borderBottomColor: active ? colors.primary : 'transparent' }]}
                        >
                            <MaterialCommunityIcons name={tab.icon} size={16} color={active ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.tabLabel, { color: active ? colors.primary : colors.textSecondary, fontWeight: active ? '700' : '500' }]}>
                                {tab.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {activeTab === 'compose' ? (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={0}>
                    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                        <Section title="Başlık" colors={colors}>
                            <View style={[styles.inputBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <TextInput
                                    value={title}
                                    onChangeText={(t) => setTitle(t.slice(0, MAX_TITLE))}
                                    placeholder="Örn: Planlı bakım bilgilendirmesi"
                                    placeholderTextColor={colors.textTertiary}
                                    style={[styles.input, { color: colors.text }]}
                                    maxLength={MAX_TITLE}
                                />
                            </View>
                            <Text style={[styles.counter, { color: colors.textTertiary }]}>{title.length}/{MAX_TITLE}</Text>
                        </Section>

                        <Section title="Mesaj" colors={colors}>
                            <View style={[styles.inputBox, styles.textarea, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <TextInput
                                    value={message}
                                    onChangeText={(t) => setMessage(t.slice(0, MAX_MESSAGE))}
                                    placeholder="Duyurunuzu buraya yazın..."
                                    placeholderTextColor={colors.textTertiary}
                                    style={[styles.input, styles.textareaInput, { color: colors.text }]}
                                    multiline
                                    textAlignVertical="top"
                                    maxLength={MAX_MESSAGE}
                                />
                            </View>
                            <Text style={[styles.counter, { color: colors.textTertiary }]}>{message.length}/{MAX_MESSAGE}</Text>
                        </Section>

                        <Section title="Gönderim Kanalları" colors={colors}>
                            <View style={{ gap: spacing.s }}>
                                <SwitchRow icon="bell-ring-outline" iconColor={serviceOrange} title="Uygulama Bildirimi" description="Anlık push notification ile ulaşır" value={sendPush} onValueChange={setSendPush} colors={colors} />
                                <SwitchRow icon="email-outline" iconColor={serviceBlue} title="E-posta Bildirimi" description="Daha detaylı bilgi için e-posta gönderir" value={sendEmail} onValueChange={setSendEmail} colors={colors} />
                            </View>
                        </Section>

                        <Section title="Hedef Kitle" colors={colors}>
                            <SwitchRow
                                icon="account-group-outline"
                                iconColor={serviceBlue}
                                title="Tüm aktif kullanıcılara gönder"
                                description="Sistemdeki tüm aktif kullanıcılara ulaşır"
                                value={sendToAll}
                                onValueChange={(v) => {
                                    setSendToAll(v);
                                    if (v) setSelectedUserIds([]);
                                }}
                                colors={colors}
                            />

                            {!sendToAll ? (
                                <Pressable
                                    onPress={() => pickerRef.current?.present()}
                                    style={({ pressed }) => [styles.pickerBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
                                >
                                    <MaterialCommunityIcons name="account-multiple-check-outline" size={18} color={colors.primary} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.pickerBtnTitle, { color: colors.text }]}>
                                            {selectedUserIds.length > 0 ? `${selectedUserIds.length} kişi seçildi` : 'Kullanıcı Seç'}
                                        </Text>
                                        <Text style={[styles.pickerBtnDesc, { color: colors.textSecondary }]}>
                                            {selectedUserIds.length > 0 ? 'Listeyi değiştirmek için dokunun' : 'Hedef kitleyi tek tek seçin'}
                                        </Text>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
                                </Pressable>
                            ) : null}
                        </Section>

                        <Section title="Canlı Önizleme" hint="Kullanıcı tarafında böyle görünecek" colors={colors}>
                            <View style={[styles.previewCard, { backgroundColor: `${serviceBlue}0A`, borderColor: `${serviceBlue}55` }]}>
                                <View style={styles.previewHeader}>
                                    <View style={[styles.previewIcon, { backgroundColor: `${serviceBlue}1F` }]}>
                                        <MaterialCommunityIcons name="bullhorn-outline" size={16} color={serviceBlue} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.previewTitle, { color: colors.text }]} numberOfLines={1}>{title.trim() || 'Bildirim başlığı'}</Text>
                                        <Text style={[styles.previewMeta, { color: colors.textSecondary }]}>Bildirim önizlemesi</Text>
                                    </View>
                                </View>
                                <Text style={[styles.previewBody, { color: colors.text }]}>{message.trim() || 'Mesaj içeriği burada görünecek.'}</Text>
                                <View style={styles.previewFooter}>
                                    <View style={styles.previewFooterLeft}>
                                        <MaterialCommunityIcons name="account-multiple-outline" size={12} color={colors.textTertiary} />
                                        <Text style={[styles.previewFooterText, { color: colors.textTertiary }]}>{String(selectedCount)}</Text>
                                    </View>
                                    <View style={styles.previewFooterRight}>
                                        {sendPush ? <MaterialCommunityIcons name="bell-ring-outline" size={12} color={serviceOrange} /> : null}
                                        {sendEmail ? <MaterialCommunityIcons name="email-outline" size={12} color={serviceBlue} /> : null}
                                    </View>
                                </View>
                            </View>
                        </Section>

                        <View style={{ height: spacing['4xl'] }} />
                    </ScrollView>

                    <View style={[styles.stickyBar, { backgroundColor: colors.surface, borderTopColor: colors.divider }]}>
                        <Pressable
                            onPress={handleSubmit}
                            disabled={!isFormValid || submitting}
                            style={({ pressed }) => [styles.sendBtn, { backgroundColor: !isFormValid || submitting ? colors.disabled : colors.primary, opacity: pressed ? 0.85 : 1 }]}
                        >
                            {submitting ? <ActivityIndicator color="#fff" /> : <><MaterialCommunityIcons name="send" size={18} color="#fff" /><Text style={styles.sendBtnText}>Gönder ({sendToAll ? 'Tüm aktif' : selectedUserIds.length})</Text></>}
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>
            ) : (
                <ScrollView contentContainerStyle={styles.scroll}>
                    {history.length === 0 ? (
                        <View style={styles.emptyHistory}>
                            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
                                <MaterialCommunityIcons name="history" size={36} color={colors.textTertiary} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>Henüz gönderim yapılmadı</Text>
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Bu oturumda gönderdiğiniz bildirimler burada listelenir.</Text>
                            <Pressable onPress={() => setActiveTab('compose')} style={({ pressed }) => [styles.emptyBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
                                <Text style={styles.emptyBtnText}>Yeni Bildirim Oluştur</Text>
                            </Pressable>
                        </View>
                    ) : history.map((entry) => (
                        <View key={entry.id} style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={styles.historyHeader}>
                                <View style={[styles.historyIcon, { backgroundColor: `${serviceBlue}1A` }]}>
                                    <MaterialCommunityIcons name="bullhorn-outline" size={18} color={serviceBlue} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>{entry.title}</Text>
                                    <Text style={[styles.historyMeta, { color: colors.textSecondary }]}>{new Date(entry.sentAt).toLocaleString('tr-TR')}</Text>
                                </View>
                            </View>
                            <Text style={[styles.historyMessage, { color: colors.text }]} numberOfLines={3}>{entry.message}</Text>
                            <View style={styles.historyChips}>
                                <View style={[styles.pill, { backgroundColor: colors.surfaceMuted }]}>
                                    <MaterialCommunityIcons name="account-multiple-outline" size={11} color={colors.textSecondary} />
                                    <Text style={[styles.pillText, { color: colors.textSecondary }]}>{String(entry.recipientLabel)}</Text>
                                </View>
                                {entry.sendPush ? <View style={[styles.pill, { backgroundColor: `${serviceOrange}1A` }]}><MaterialCommunityIcons name="bell-ring-outline" size={11} color={serviceOrange} /><Text style={[styles.pillText, { color: serviceOrange }]}>Push</Text></View> : null}
                                {entry.sendEmail ? <View style={[styles.pill, { backgroundColor: `${serviceBlue}1A` }]}><MaterialCommunityIcons name="email-outline" size={11} color={serviceBlue} /><Text style={[styles.pillText, { color: serviceBlue }]}>E-posta</Text></View> : null}
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}

            <UserPickerSheet ref={pickerRef} selectedIds={selectedUserIds} onConfirm={handlePickedUsers} />
        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
    tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.m, borderBottomWidth: 2 },
    tabLabel: { ...typography.bodySmall },
    scroll: { padding: spacing.gutter, gap: spacing.l, paddingBottom: spacing['5xl'] },
    section: { gap: spacing.s },
    sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    sectionTitle: { ...typography.body, fontWeight: '700' },
    sectionHint: { ...typography.caption, marginTop: 2 },
    inputBox: { borderWidth: 1, borderRadius: semanticRadius.input, paddingHorizontal: spacing.m },
    textarea: { minHeight: 110, paddingTop: spacing.m, paddingBottom: spacing.m },
    input: { ...typography.body, paddingVertical: spacing.m },
    textareaInput: { minHeight: 90 },
    counter: { ...typography.caption, textAlign: 'right' },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, padding: spacing.m, borderRadius: semanticRadius.button, borderWidth: 1 },
    switchIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    switchTitle: { ...typography.bodySmall, fontWeight: '600' },
    switchDesc: { ...typography.caption, marginTop: 2 },
    pickerBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, padding: spacing.m, borderRadius: semanticRadius.button, borderWidth: 1, marginTop: spacing.s },
    pickerBtnTitle: { ...typography.bodySmall, fontWeight: '700' },
    pickerBtnDesc: { ...typography.caption, marginTop: 2 },
    previewCard: { padding: spacing.m, borderRadius: semanticRadius.card, borderWidth: 1, gap: spacing.s },
    previewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
    previewIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    previewTitle: { ...typography.bodySmall, fontWeight: '700' },
    previewMeta: { ...typography.caption, marginTop: 1 },
    previewBody: { ...typography.bodySmall },
    previewFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.xs },
    previewFooterLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    previewFooterRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    previewFooterText: { ...typography.caption },
    stickyBar: { paddingHorizontal: spacing.gutter, paddingTop: spacing.m, paddingBottom: spacing.l, borderTopWidth: StyleSheet.hairlineWidth },
    sendBtn: { height: 52, borderRadius: semanticRadius.button, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    sendBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },
    emptyHistory: { alignItems: 'center', paddingVertical: spacing['5xl'], gap: spacing.m },
    emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { ...typography.h3 },
    emptyText: { ...typography.bodySmall, textAlign: 'center' },
    emptyBtn: { marginTop: spacing.m, paddingHorizontal: spacing.xl, paddingVertical: spacing.m, borderRadius: semanticRadius.button },
    emptyBtnText: { ...typography.bodySmall, color: '#fff', fontWeight: '700' },
    historyCard: { padding: spacing.m, borderRadius: semanticRadius.card, borderWidth: 1, gap: spacing.s },
    historyHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
    historyIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    historyTitle: { ...typography.bodySmall, fontWeight: '700' },
    historyMeta: { ...typography.caption, marginTop: 1 },
    historyMessage: { ...typography.bodySmall },
    historyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    pillText: { ...typography.caption, fontWeight: '700' },
});
