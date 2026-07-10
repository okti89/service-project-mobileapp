import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
} from 'react';
import {
    ActivityIndicator,
    BackHandler,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { sp } from '@/theme/scale';
import { resolveMediaUrl } from '@/utils/mediaUrl';

const getInitials = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const TechnicianPickerSheet = forwardRef(({
    technicians = [],
    loading = false,
    submitting = false,
    selectedTechnicianId = null,
    includeUnassigned = true,
    onSelect,
}, ref) => {
    const { colors, isDark } = useTheme();
    const sheetRef = useRef(null);
    const isOpen = useRef(false);

    useImperativeHandle(ref, () => ({
        present: () => sheetRef.current?.present(),
        dismiss: () => sheetRef.current?.dismiss(),
    }));

    useEffect(() => {
        const backAction = () => {
            if (isOpen.current) {
                sheetRef.current?.dismiss();
                return true;
            }

            return false;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => subscription.remove();
    }, []);

    const snapPoints = useMemo(() => ['72%'], []);
    const secondaryText = isDark ? '#9BA2AF' : '#6B7280';
    const rowBg = isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF';
    const rowBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const sheetBg = isDark ? colors.surface : '#F8FAFC';

    const options = useMemo(
        () => [{ id: null, full_name: 'Atanmamış' }, ...technicians],
        [technicians]
    );

    const renderBackdrop = useCallback(
        (props) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                opacity={0.5}
                pressBehavior="close"
            />
        ),
        []
    );

    return (
        <BottomSheetModal
            ref={sheetRef}
            index={0}
            snapPoints={snapPoints}
            backdropComponent={renderBackdrop}
            handleComponent={null}
            enablePanDownToClose
            backgroundStyle={{
                backgroundColor: sheetBg,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
            }}
            onChange={(index) => {
                isOpen.current = index !== -1;
            }}
        >
            <BottomSheetScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.24)' : 'rgba(15,23,42,0.16)' }]} />

                <View style={styles.headerRow}>
                    <View style={styles.headerTextWrap}>
                        <Text style={[styles.title, { color: colors.text }]}>Teknisyen Listesi</Text>
                        <Text style={[styles.subtitle, { color: secondaryText }]}>Servise atanacak teknisyeni seçebilirsin.</Text>
                    </View>

                    <Pressable
                        onPress={() => sheetRef.current?.dismiss()}
                        hitSlop={10}
                        android_ripple={{ color: `${colors.primary}1A`, borderless: true, radius: 18 }}
                        style={({ pressed }) => [
                            styles.closeBtn,
                            {
                                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EEF2F7',
                                opacity: pressed ? 0.75 : 1,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
                    </Pressable>
                </View>

                {loading ? (
                    <View style={styles.stateBox}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.stateText, { color: secondaryText }]}>Teknisyenler yükleniyor...</Text>
                    </View>
                ) : (
                    <View style={styles.list}>
                        {options.map((item, index) => {
                            const id = item?.id ?? null;
                            const isSelected = selectedTechnicianId === id;
                            const label = item?.full_name || item?.user?.full_name || item?.user?.email || 'Teknisyen';
                            const detail = item?.status_display || (id ? 'Teknisyen' : 'Servisten teknisyen atamasını kaldır');
                            const avatarUri = resolveMediaUrl(item?.avatar || item?.avatar_url || item?.user?.avatar || item?.user?.avatar_url);
                            const initials = getInitials(label);

                            return (
                                <Pressable
                                    key={item?.id || `unassigned-${index}`}
                                    onPress={() => !submitting && onSelect?.(item)}
                                    disabled={submitting}
                                    style={({ pressed }) => [
                                        styles.row,
                                        {
                                            backgroundColor: rowBg,
                                            borderColor: isSelected ? colors.primary : rowBorder,
                                            opacity: pressed || submitting ? 0.82 : 1,
                                        },
                                    ]}
                                >
                                    {avatarUri ? (
                                        <Image source={{ uri: avatarUri }} style={[styles.avatar, { borderColor: isSelected ? colors.primary : rowBorder }]} />
                                    ) : (
                                        <View
                                            style={[
                                                styles.avatar,
                                                styles.avatarFallback,
                                                {
                                                    borderColor: isSelected ? colors.primary : rowBorder,
                                                    backgroundColor: isSelected ? `${colors.primary}18` : isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
                                                },
                                            ]}
                                        >
                                            <Text style={[styles.avatarText, { color: isSelected ? colors.primary : colors.textSecondary }]}>
                                                {initials}
                                            </Text>
                                        </View>
                                    )}

                                    <View style={styles.rowText}>
                                        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                                            {label}
                                        </Text>
                                        <Text style={[styles.detail, { color: secondaryText }]} numberOfLines={1}>
                                            {detail}
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.selection,
                                            {
                                                borderColor: isSelected ? colors.primary : rowBorder,
                                                backgroundColor: isSelected ? colors.primary : 'transparent',
                                            },
                                        ]}
                                    >
                                        {submitting && isSelected ? (
                                            <ActivityIndicator size={12} color="#FFFFFF" />
                                        ) : null}
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>
                )}
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
});

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.s,
        paddingBottom: sp(40),
    },
    handle: {
        alignSelf: 'center',
        width: 42,
        height: 4,
        borderRadius: 999,
        marginBottom: spacing.m,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.m,
        marginBottom: spacing.l,
    },
    headerTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        ...typography.h3,
        fontSize: 18,
        marginBottom: 4,
    },
    subtitle: {
        ...typography.bodySmall,
    },
    stateBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing['2xl'],
        gap: spacing.s,
    },
    stateText: {
        ...typography.bodySmall,
        textAlign: 'center',
    },
    list: {
        gap: spacing.s,
    },
    row: {
        minHeight: 64,
        borderWidth: 1,
        borderRadius: 18,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s + 2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.m,
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 1,
    },
    avatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    rowText: {
        flex: 1,
        minWidth: 0,
    },
    name: {
        ...typography.body,
        fontSize: 15,
        fontWeight: '700',
    },
    detail: {
        ...typography.bodySmall,
        marginTop: 2,
    },
    selection: {
        width: 20,
        height: 20,
        borderRadius: 999,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default TechnicianPickerSheet;
