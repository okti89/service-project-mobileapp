import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const TechnicianFilterSheet = forwardRef(({
    technicians = [],
    selectedTechnicianId = null,
    onSelect,
}, ref) => {
    const { colors, isDark } = useTheme();
    const modalRef = useRef(null);
    const isOpenRef = useRef(false);
    const snapPoints = useMemo(() => ['72%'], []);

    useImperativeHandle(ref, () => ({
        present: () => modalRef.current?.present(),
        dismiss: () => modalRef.current?.dismiss(),
    }));

    useEffect(() => {
        const onBackPress = () => {
            if (isOpenRef.current) {
                modalRef.current?.dismiss();
                return true;
            }
            return false;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, []);

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

    const items = useMemo(
        () => ([
            { id: null, label: 'Tüm teknisyenler', subtitle: 'Filtreyi temizle' },
            ...technicians.map((item) => ({
                id: item?.id ?? item?.user ?? item?.user_id ?? null,
                label: item?.full_name || item?.name || item?.username || 'Teknisyen',
                subtitle: item?.phone_number || item?.email || null,
            })),
        ]),
        [technicians]
    );

    return (
        <BottomSheetModal
            ref={modalRef}
            index={0}
            snapPoints={snapPoints}
            backdropComponent={renderBackdrop}
            enablePanDownToClose
            handleComponent={null}
            onChange={(index) => {
                isOpenRef.current = index >= 0;
            }}
            backgroundStyle={{ backgroundColor: isDark ? colors.surface : '#FFFFFF' }}
        >
            <View style={[styles.container, { backgroundColor: isDark ? colors.surface : '#FFFFFF' }]}>
                <View
                    style={[
                        styles.handle,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.26)' : 'rgba(15,23,42,0.18)' },
                    ]}
                />

                <View style={styles.headerRow}>
                    <Text style={[styles.title, { color: colors.text }]}>Teknisyen Filtrele</Text>
                    <Pressable
                        onPress={() => modalRef.current?.dismiss()}
                        style={[
                            styles.closeButton,
                            { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                        ]}
                    >
                        <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
                    </Pressable>
                </View>

                <BottomSheetScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {items.map((item) => {
                        const active = selectedTechnicianId === item.id || (!selectedTechnicianId && item.id == null);
                        return (
                            <Pressable
                                key={item.id == null ? 'all' : String(item.id)}
                                onPress={() => {
                                    onSelect?.(item.id);
                                    modalRef.current?.dismiss();
                                }}
                                style={({ pressed }) => [
                                    styles.item,
                                    {
                                        backgroundColor: active
                                            ? (isDark ? `${colors.primary}18` : `${colors.primary}10`)
                                            : (isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF'),
                                        borderColor: active
                                            ? `${colors.primary}30`
                                            : (isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'),
                                        opacity: pressed ? 0.86 : 1,
                                    },
                                ]}
                            >
                                <View style={styles.itemTextWrap}>
                                    <Text style={[styles.itemLabel, { color: active ? colors.primary : colors.text }]}>
                                        {item.label}
                                    </Text>
                                    {item.subtitle ? (
                                        <Text style={[styles.itemSubtitle, { color: colors.textTertiary }]} numberOfLines={1}>
                                            {item.subtitle}
                                        </Text>
                                    ) : null}
                                </View>
                                {active ? (
                                    <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} />
                                ) : null}
                            </Pressable>
                        );
                    })}
                </BottomSheetScrollView>
            </View>
        </BottomSheetModal>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: spacing.gutter,
        paddingBottom: spacing.l,
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        marginTop: spacing.s,
        marginBottom: spacing.m,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.m,
    },
    title: {
        ...typography.h3,
        fontSize: 18,
        letterSpacing: -0.2,
    },
    closeButton: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
    },
    content: {
        gap: spacing.s,
        paddingBottom: spacing.xl,
    },
    item: {
        minHeight: 56,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s + 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.s,
    },
    itemTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    itemLabel: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    itemSubtitle: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 3,
    },
});

export default TechnicianFilterSheet;