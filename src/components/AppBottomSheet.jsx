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
    keyboardBehavior = 'interactive',
    keyboardBlurBehavior = 'restore',
    backgroundStyle,
    handleIndicatorStyle,
}, ref) {
    const sheetRef = useRef(null);
    const [shouldRender, setShouldRender] = useState(visible);
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();

    useImperativeHandle(ref, () => ({
        present: () => {
            setShouldRender(true);
            requestAnimationFrame(() => {
                sheetRef.current?.present();
            });
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

    useEffect(() => {
        if (visible) {
            setShouldRender(true);
        }
    }, [visible]);

    useEffect(() => {
        if (!shouldRender) return undefined;

        let frameId = null;
        let nestedFrameId = null;

        if (visible) {
            frameId = requestAnimationFrame(() => {
                nestedFrameId = requestAnimationFrame(() => {
                    sheetRef.current?.present();
                });
            });
        } else {
            sheetRef.current?.dismiss();
        }

        return () => {
            if (frameId !== null) cancelAnimationFrame(frameId);
            if (nestedFrameId !== null) cancelAnimationFrame(nestedFrameId);
        };
    }, [shouldRender, visible]);

    useEffect(() => {
        if (!shouldRender) return undefined;
        if (visible) return undefined;

        const fallback = setTimeout(() => {
            setShouldRender(false);
        }, 600);

        return () => clearTimeout(fallback);
    }, [shouldRender, visible]);

    useEffect(() => {
        if (!shouldRender) return undefined;

        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            sheetRef.current?.dismiss();
            return true;
        });

        return () => {
            subscription.remove();
        };
    }, [shouldRender]);

    const handleDismiss = () => {
        setShouldRender(false);
        if (visible) {
            onClose?.();
        }
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

    if (!shouldRender) {
        return null;
    }

    return (
        <BottomSheetModal
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
