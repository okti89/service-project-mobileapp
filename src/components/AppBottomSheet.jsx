import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import {
    BottomSheetBackdrop,
    BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

const AppBottomSheet = forwardRef(function AppBottomSheet({
    visible,
    onClose,
    children,
    snapPoints,
    enableDynamicSizing = false,
    contentContainerStyle,
    wrapContent = true,
    keyboardBehavior = 'padding',
    keyboardBlurBehavior = 'restore',
    backgroundStyle,
    handleIndicatorStyle,
}, ref) {
    const sheetRef = useRef(null);
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();

    useImperativeHandle(ref, () => ({
        present: () => {
            sheetRef.current?.present();
        },
        dismiss: () => {
            sheetRef.current?.dismiss();
        },
        close: () => {
            sheetRef.current?.dismiss();
        },
    }), []);

    const resolvedSnapPoints = useMemo(() => {
        if (enableDynamicSizing) return undefined;
        return snapPoints && snapPoints.length > 0 ? snapPoints : ['60%'];
    }, [enableDynamicSizing, snapPoints]);

    const [remountKey, setRemountKey] = useState(0);

    useEffect(() => {
        if (visible) {
            const frameId = requestAnimationFrame(() => {
                sheetRef.current?.present();
            });
            return () => cancelAnimationFrame(frameId);
        } else {
            sheetRef.current?.dismiss();
            setRemountKey(prev => prev + 1);
        }
    }, [visible]);

    useEffect(() => {
        if (!visible) return undefined;

        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            sheetRef.current?.dismiss();
            return true;
        });

        return () => {
            subscription.remove();
        };
    }, [visible, remountKey]);

    const handleDismiss = () => {
        onClose?.();
    };

    const renderBackdrop = (props) => (
        <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            pressBehavior="close"
            opacity={0.5}
        />
    );

    return (
        <BottomSheetModal
            key={remountKey}
            ref={sheetRef}
            index={0}
            snapPoints={resolvedSnapPoints}
            enableDynamicSizing={enableDynamicSizing}
            enablePanDownToClose
            animateOnMount
            topInset={insets.top + 12}
            onDismiss={handleDismiss}
            keyboardBehavior={keyboardBehavior}
            keyboardBlurBehavior={keyboardBlurBehavior}
            backgroundStyle={[
                styles.sheetBackground,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                },
                backgroundStyle,
            ]}
            handleIndicatorStyle={[
                styles.handleIndicator,
                {
                    backgroundColor: colors.textTertiary,
                },
                handleIndicatorStyle,
            ]}
            backdropComponent={renderBackdrop}
        >
            {wrapContent ? (
                <View
                    style={[
                        styles.content,
                        { paddingBottom: insets.bottom + 10 },
                        contentContainerStyle,
                    ]}
                >
                    <View style={styles.inner}>{children}</View>
                </View>
            ) : (
                children
            )}
        </BottomSheetModal>
    );
});

export default AppBottomSheet;

const styles = StyleSheet.create({
    sheetBackground: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        overflow: 'hidden',
    },
    handleIndicator: {
        width: 44,
        height: 5,
        borderRadius: 999,
    },
    content: {
        flex: 1,
    },
    inner: {
        flex: 1,
        flexShrink: 1,
    },
});
