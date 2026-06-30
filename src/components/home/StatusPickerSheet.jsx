import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import {
    ActivityIndicator,
    BackHandler,
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

const StatusPickerSheet = forwardRef(({
    statuses = [],
    loading = false,
    selectedStatusKey = null,
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

    const snapPoints = useMemo(() => ['62%'], []);
    const sheetBg = isDark ? colors.surface : '#F8FAFC';
    const rowBg = isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF';
    const rowBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const secondaryText = isDark ? '#9BA2AF' : '#6B7280';

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
            <BottomSheetScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.24)' : 'rgba(15,23,42,0.16)' }]} />

                <View style={styles.headerRow}>
                    <View style={styles.headerTextWrap}>
                        <Text style={[styles.title, { color: colors.text }]}>Servis Durumu</Text>
                        <Text style={[styles.subtitle, { color: secondaryText }]}>Servisin durumunu hızlıca güncelleyebilirsin.</Text>
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

                <View style={styles.list}>
                    {statuses.map((item) => {
                        const isSelected = selectedStatusKey === item.key;
                        return (
                            <Pressable
                                key={item.key}
                                onPress={() => !loading && onSelect?.(item)}
                                disabled={loading}
                                style={({ pressed }) => [
                                    styles.row,
                                    {
                                        backgroundColor: rowBg,
                                        borderColor: isSelected ? item.color : rowBorder,
                                        opacity: pressed || loading ? 0.82 : 1,
                                    },
                                ]}
                            >
                                <View style={[styles.colorBar, { backgroundColor: item.color }]} />
                                <View style={styles.rowText}>
                                    <Text style={[styles.name, { color: colors.text }]}>{item.label}</Text>
                                    <Text style={[styles.detail, { color: secondaryText }]}>{item.key}</Text>
                                </View>
                                <View
                                    style={[
                                        styles.selection,
                                        {
                                            borderColor: isSelected ? item.color : rowBorder,
                                            backgroundColor: isSelected ? item.color : 'transparent',
                                        },
                                    ]}
                                >
                                    {loading && isSelected ? (
                                        <ActivityIndicator size={12} color="#FFFFFF" />
                                    ) : null}
                                </View>
                            </Pressable>
                        );
                    })}
                </View>
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
});

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.s,
        paddingBottom: spacing['3xl'],
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
    list: {
        gap: spacing.s,
    },
    row: {
        minHeight: 58,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    colorBar: {
        width: 5,
        alignSelf: 'stretch',
    },
    rowText: {
        flex: 1,
        minWidth: 0,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s + 2,
    },
    name: {
        fontSize: 14,
        fontWeight: '800',
    },
    detail: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
        textTransform: 'uppercase',
    },
    selection: {
        width: 18,
        height: 18,
        borderWidth: 1,
        marginRight: spacing.m,
    },
});

export default StatusPickerSheet;
