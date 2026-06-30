import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

const PermissionModal = ({
    visible,
    icon = 'bell-ring-outline',
    iconColor = '#F59E0B',
    title,
    description,
    bullets = [],
    primaryLabel = 'İzin Ver',
    secondaryLabel = 'Daha Sonra',
    dismissLabel = 'Bir Daha Gösterme',
    onPrimary,
    onSecondary,
    onDismissForever,
    loading = false,
    primaryDisabled = false,
}) => {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onSecondary}
        >
            <View style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(0,0,0,0.78)' : 'rgba(15,23,42,0.62)' }]}>
                <View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            marginTop: insets.top + 24,
                            marginBottom: insets.bottom + 24,
                        },
                    ]}
                >
                    <View style={styles.handle} />

                    <View style={[styles.iconWrap, { backgroundColor: `${iconColor}15`, borderColor: `${iconColor}40` }]}>
                        <MaterialCommunityIcons name={icon} size={44} color={iconColor} />
                    </View>

                    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                    <Text style={[styles.description, { color: colors.textSecondary }]}>
                        {description}
                    </Text>

                    {bullets.length ? (
                        <View style={styles.bullets}>
                            {bullets.map((bullet, index) => (
                                <View key={`${bullet}-${index}`} style={styles.bulletRow}>
                                    <View style={[styles.bulletDot, { backgroundColor: `${iconColor}30` }]}>
                                        <MaterialCommunityIcons
                                            name={bullet.icon || 'check'}
                                            size={12}
                                            color={iconColor}
                                        />
                                    </View>
                                    <View style={styles.bulletContent}>
                                        <Text style={[styles.bulletTitle, { color: colors.text }]}>
                                            {bullet.title}
                                        </Text>
                                        {bullet.description ? (
                                            <Text style={[styles.bulletDescription, { color: colors.textSecondary }]}>
                                                {bullet.description}
                                            </Text>
                                        ) : null}
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : null}

                    <View style={styles.actions}>
                        <Pressable
                            onPress={onPrimary}
                            disabled={loading || primaryDisabled}
                            style={({ pressed }) => [
                                styles.primaryBtn,
                                {
                                    backgroundColor: iconColor,
                                    opacity: pressed || loading || primaryDisabled ? 0.85 : 1,
                                },
                            ]}
                        >
                            <MaterialCommunityIcons name="shield-check-outline" size={18} color="#FFFFFF" />
                            <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
                        </Pressable>

                        <Pressable
                            onPress={onSecondary}
                            disabled={loading}
                            style={({ pressed }) => [
                                styles.secondaryBtn,
                                {
                                    borderColor: colors.border,
                                    backgroundColor: colors.surface,
                                    opacity: pressed || loading ? 0.85 : 1,
                                },
                            ]}
                        >
                            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                                {secondaryLabel}
                            </Text>
                        </Pressable>

                        {onDismissForever ? (
                            <Pressable
                                onPress={onDismissForever}
                                disabled={loading}
                                style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.7 }]}
                            >
                                <Text style={[styles.dismissBtnText, { color: colors.textTertiary }]}>
                                    {dismissLabel}
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default PermissionModal;

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        paddingHorizontal: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sheet: {
        width: '100%',
        maxWidth: 460,
        borderRadius: 24,
        borderWidth: 1,
        padding: 22,
        alignItems: 'center',
    },
    handle: {
        width: 44,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(0,0,0,0.12)',
        marginBottom: 18,
    },
    iconWrap: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        marginBottom: 18,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: -0.3,
        textAlign: 'center',
        marginBottom: 10,
    },
    description: {
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        fontWeight: '500',
        marginBottom: 18,
    },
    bullets: {
        alignSelf: 'stretch',
        gap: 12,
        marginBottom: 20,
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    bulletDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    bulletContent: {
        flex: 1,
    },
    bulletTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    bulletDescription: {
        fontSize: 12,
        lineHeight: 18,
    },
    actions: {
        alignSelf: 'stretch',
        gap: 10,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 14,
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    secondaryBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        borderRadius: 14,
        borderWidth: 1,
    },
    secondaryBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },
    dismissBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
    },
    dismissBtnText: {
        fontSize: 12,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});
