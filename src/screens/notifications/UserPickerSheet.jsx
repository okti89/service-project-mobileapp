import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBottomSheet from '@/components/AppBottomSheet';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { semanticRadius } from '@/theme/radius';
import { resolveMediaUrl } from '@/utils/mediaUrl';

const ROLE_META = {
    admin: { label: 'Yonetici', color: '#0F2F5F' },
    technician: { label: 'Teknisyen', color: '#0284C7' },
    customer: { label: 'Musteri', color: '#7C3AED' },
};

const getFullName = (user) =>
    user?.full_name ||
    `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
    user?.email ||
    '';

const getInitials = (user) => {
    const fullName = getFullName(user);
    if (!fullName) return '?';
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const UserPickerSheet = forwardRef(function UserPickerSheet(
    { selectedIds, onConfirm, includeInactive = false },
    ref
) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [draftIds, setDraftIds] = useState([]);
    const [initialized, setInitialized] = useState(false);

    useImperativeHandle(ref, () => ({
        present: () => setVisible(true),
        dismiss: () => setVisible(false),
    }));

    useEffect(() => {
        if (visible && !initialized) {
            fetchUsers();
        } else if (visible) {
            setDraftIds([...selectedIds]);
        }
    }, [visible, initialized, selectedIds]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await api.get(ENDPOINTS.AUTH.USER_LIST, {
                params: includeInactive ? { include_inactive: true } : undefined,
            });
            const rows = Array.isArray(response?.data) ? response.data : [];
            const filteredRows = includeInactive
                ? rows
                : rows.filter((user) => user.is_active && user.approval_status !== 'rejected');
            setUsers(filteredRows);
            setDraftIds([...selectedIds]);
            setInitialized(true);
        } catch (error) {
            console.log('UserPicker fetch error:', error?.response?.data || error?.message);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        const term = search.trim().toLocaleLowerCase('tr-TR');
        const list = !term
            ? users
            : users.filter((user) => {
                const haystack = [getFullName(user), user.email, user.phone_number]
                    .filter(Boolean)
                    .join(' ')
                    .toLocaleLowerCase('tr-TR');
                return haystack.includes(term);
            });

        return [...list].sort((a, b) =>
            getFullName(a).localeCompare(getFullName(b), 'tr', { sensitivity: 'base' })
        );
    }, [users, search]);

    const toggle = (id) => {
        setDraftIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
    };

    const handleConfirm = () => {
        onConfirm?.(draftIds);
        setVisible(false);
    };

    const renderItem = ({ item }) => {
        const isSelected = draftIds.includes(item.id);
        const roleMeta = ROLE_META[item.user_type] || ROLE_META.customer;
        const fullName = getFullName(item);
        const avatarUri = resolveMediaUrl(item?.avatar || item?.avatar_url || item?.profile_photo || item?.user?.avatar || item?.user?.avatar_url || item?.user?.profile_photo);

        return (
            <Pressable
                onPress={() => toggle(item.id)}
                style={({ pressed }) => [
                    styles.row,
                    {
                        backgroundColor: isSelected ? `${colors.primary}10` : pressed ? colors.surfaceMuted : 'transparent',
                        borderBottomColor: colors.divider,
                    },
                ]}
            >
                {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: `${roleMeta.color}1A` }]}>
                        <Text style={[styles.avatarText, { color: roleMeta.color }]}>{getInitials(item)}</Text>
                    </View>
                )}
                <View style={styles.rowBody}>
                    <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{fullName || 'İsimsiz kullanıcı'}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textSecondary }]} numberOfLines={1}>{item.email || item.phone_number || '-'}</Text>
                </View>
                <View style={[styles.checkbox, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : 'transparent' }]}>
                    {isSelected ? <MaterialCommunityIcons name="check" size={14} color="#fff" /> : null}
                </View>
            </Pressable>
        );
    };

    return (
        <AppBottomSheet
            visible={visible}
            onClose={() => setVisible(false)}
            snapPoints={['85%']}
            backgroundStyle={{ backgroundColor: colors.surface }}
            handleIndicatorStyle={{ backgroundColor: colors.textTertiary }}
            wrapContent={false}
        >
            <View style={[styles.container, { backgroundColor: colors.surface }]}>
                <View style={[styles.header, { borderBottomColor: colors.divider }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Hedef Kullanıcı Seç</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{draftIds.length} kişi seçildi</Text>
                </View>

                <View style={[styles.searchWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="magnify" size={18} color={colors.textTertiary} />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="İsim, e-posta veya telefon ara"
                        placeholderTextColor={colors.textTertiary}
                        style={[styles.searchInput, { color: colors.text }]}
                    />
                    {search ? (
                        <Pressable onPress={() => setSearch('')} hitSlop={8}>
                            <MaterialCommunityIcons name="close" size={18} color={colors.textTertiary} />
                        </Pressable>
                    ) : null}
                </View>

                {loading ? (
                    <View style={styles.centerState}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : (
                    <BottomSheetFlatList
                        data={filtered}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderItem}
                        style={styles.list}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={[styles.listContent, { paddingBottom: 96 + insets.bottom }]}
                        ListEmptyComponent={<View style={styles.centerState}><Text style={{ color: colors.textTertiary }}>Kullanıcı bulunamadı</Text></View>}

                    />
                )}

                <View style={[styles.footer, { borderTopColor: colors.divider, backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, spacing.gutter) }]}>
                    <Pressable onPress={() => setVisible(false)} style={({ pressed }) => [styles.btn, { backgroundColor: 'transparent', borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}>
                        <Text style={[styles.btnText, { color: colors.textSecondary }]}>Vazgeç</Text>
                    </Pressable>
                    <Pressable onPress={handleConfirm} style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
                        <Text style={[styles.btnText, { color: '#fff' }]}>Onayla ({draftIds.length})</Text>
                    </Pressable>
                </View>
            </View>
        </AppBottomSheet>
    );
});

const styles = StyleSheet.create({
    container: { flex: 1, paddingBottom: 20 },
    header: { paddingHorizontal: spacing.gutter, paddingTop: spacing.s, paddingBottom: spacing.l, borderBottomWidth: StyleSheet.hairlineWidth },
    title: { ...typography.h3 },
    subtitle: { ...typography.caption, marginTop: 2 },
    searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.gutter, marginTop: spacing.l, paddingHorizontal: spacing.m, height: 44, borderRadius: semanticRadius.button, borderWidth: 1 },
    searchInput: { flex: 1, ...typography.bodySmall, paddingVertical: 0 },
    list: { flex: 1 },
    listContent: { paddingTop: spacing.s },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingVertical: spacing.m, paddingHorizontal: spacing.gutter, borderBottomWidth: StyleSheet.hairlineWidth },
    avatarImage: { width: 42, height: 42, borderRadius: 21 },
    avatarFallback: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 13, fontWeight: '700' },
    rowBody: { flex: 1 },
    rowName: { ...typography.bodySmall, fontWeight: '600' },
    rowMeta: { ...typography.caption, marginTop: 2 },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.gutter },
    footer: { flexDirection: 'row', gap: spacing.m, paddingTop: spacing.gutter, paddingHorizontal: spacing.gutter, borderTopWidth: StyleSheet.hairlineWidth },
    btn: { flex: 1, height: 48, borderRadius: semanticRadius.button, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    btnText: { ...typography.bodySmall, fontWeight: '700' },
});

export default UserPickerSheet;
