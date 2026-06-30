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

const ShiftStatusSheet = forwardRef(({
    shiftState,
    loading = false,
    actionLoading = false,
    onStart,
    onStop,
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

    const snapPoints = useMemo(() => ['82%'], []);
    const secondaryText = isDark ? '#9BA2AF' : '#6B7280';
    const panelBg = isDark ? colors.surface : '#F8FAFC';
    const rowBg = isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF';
    const rowBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const warningBg = isDark ? 'rgba(245,158,11,0.14)' : '#FFF7ED';
    const warningBorder = isDark ? 'rgba(245,158,11,0.28)' : '#FDBA74';

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

    const shouldStopShift = Boolean(shiftState?.isActiveToday || shiftState?.hasOvernightOpenShift);
    const primaryButtonLabel = shouldStopShift ? 'Mesaiyi Bitir' : 'Mesai Başlat';
    const primaryButtonAction = shouldStopShift ? onStop : onStart;
    const primaryButtonColor = shouldStopShift ? colors.error : colors.success;

    return (
        <BottomSheetModal
            ref={sheetRef}
            index={0}
            snapPoints={snapPoints}
            backdropComponent={renderBackdrop}
            handleComponent={null}
            enablePanDownToClose
            backgroundStyle={{
                backgroundColor: panelBg,
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
                        <Text style={[styles.title, { color: colors.text }]}>Mesai Durumu</Text>
                        <Text style={[styles.subtitle, { color: secondaryText }]}>Bugünkü mesaini buradan yönetebilirsin.</Text>
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

                <View style={[styles.heroCard, { backgroundColor: rowBg, borderColor: rowBorder }]}> 
                    <Text style={[styles.heroLabel, { color: secondaryText }]}>Durum</Text>
                    <Text style={[styles.heroStatus, { color: shiftState?.statusColor || colors.primary }]}> 
                        {shiftState?.statusLabel || 'Mesai Dışı'}
                    </Text>
                    <Text style={[styles.heroCounter, { color: colors.text }]}> 
                        {shiftState?.counterLabel || '--:--:--'}
                    </Text>
                    <Text style={[styles.heroMeta, { color: secondaryText }]}> 
                        {shiftState?.metaLabel || 'Bugün için mesai kaydı bulunmuyor.'}
                    </Text>
                </View>

                {Array.isArray(shiftState?.warnings) && shiftState.warnings.length > 0 ? (
                    <View style={styles.warningList}>
                        {shiftState.warnings.map((warning, index) => (
                            <View
                                key={`${warning}-${index}`}
                                style={[styles.warningCard, { backgroundColor: warningBg, borderColor: warningBorder }]}
                            >
                                <MaterialCommunityIcons name="alert-outline" size={16} color="#F59E0B" />
                                <Text style={[styles.warningText, { color: colors.text }]}>{warning}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                <View style={styles.infoList}>
                    <View style={[styles.infoRow, { backgroundColor: rowBg, borderColor: rowBorder }]}> 
                        <Text style={[styles.infoLabel, { color: secondaryText }]}>Bugünkü Mesai</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{shiftState?.todayScheduleLabel || 'Tanımlı değil'}</Text>
                    </View>
                    <View style={[styles.infoRow, { backgroundColor: rowBg, borderColor: rowBorder }]}> 
                        <Text style={[styles.infoLabel, { color: secondaryText }]}>Başlangıç</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{shiftState?.startLabel || '--:--'}</Text>
                    </View>
                    <View style={[styles.infoRow, { backgroundColor: rowBg, borderColor: rowBorder }]}> 
                        <Text style={[styles.infoLabel, { color: secondaryText }]}>Bitiş</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{shiftState?.endLabel || '--:--'}</Text>
                    </View>
                </View>

                <Pressable
                    onPress={primaryButtonAction}
                    disabled={loading || actionLoading}
                    style={({ pressed }) => [
                        styles.primaryButton,
                        {
                            backgroundColor: primaryButtonColor,
                            opacity: pressed || loading || actionLoading ? 0.82 : 1,
                        },
                    ]}
                >
                    {actionLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <MaterialCommunityIcons
                                name={shouldStopShift ? 'stop-circle-outline' : 'play-circle-outline'}
                                size={18}
                                color="#FFFFFF"
                            />
                            <Text style={styles.primaryButtonText}>{primaryButtonLabel}</Text>
                        </>
                    )}
                </Pressable>
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
});

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.s,
        paddingBottom: spacing.xl,
    },
    handle: {
        alignSelf: 'center',
        width: 42,
        height: 4,
        borderRadius: 999,
        marginBottom: spacing.s + 6,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.m,
        marginBottom: spacing.m + 2,
    },
    headerTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        ...typography.h3,
        fontSize: 18,
        marginBottom: 4,
    },
    subtitle: {
        ...typography.bodySmall,
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroCard: {
        borderRadius: 22,
        borderWidth: 1,
        paddingHorizontal: spacing.l,
        paddingVertical: spacing.m + 2,
        marginBottom: spacing.m + 2,
    },
    heroLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    heroStatus: {
        fontSize: 22,
        fontWeight: '800',
        marginTop: spacing.xs,
    },
    heroCounter: {
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: -0.8,
        marginTop: spacing.xs + 2,
    },
    heroMeta: {
        ...typography.bodySmall,
        marginTop: spacing.xs + 2,
    },
    warningList: {
        gap: spacing.s,
        marginBottom: spacing.m + 2,
    },
    warningCard: {
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.s,
    },
    warningText: {
        ...typography.bodySmall,
        flex: 1,
        lineHeight: 18,
    },
    infoList: {
        gap: spacing.s,
        marginBottom: spacing.m + 2,
    },
    infoRow: {
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s + 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.m,
    },
    infoLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    infoValue: {
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'right',
        flexShrink: 1,
    },
    primaryButton: {
        minHeight: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.s,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
});

export default ShiftStatusSheet;
