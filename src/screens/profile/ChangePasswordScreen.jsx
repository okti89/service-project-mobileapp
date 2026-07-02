import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import CustomInput from '@/components/CustomInput';
import authService from '@/services/authService';
import { serviceBlue, serviceGreen } from '@/theme/color';

const initialForm = {
    old_password: '',
    new_password: '',
    confirm_password: '',
};

const normalizeFieldError = (error) => {
    if (Array.isArray(error)) {
        return error.join(' ');
    }
    return error || '';
};

export default function ChangePasswordScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const [form, setForm] = useState(initialForm);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const passwordStrength = useMemo(() => {
        const value = form.new_password;
        let score = 0;

        if (value.length >= 8) score += 1;
        if (/[A-Z]/.test(value)) score += 1;
        if (/[0-9]/.test(value)) score += 1;
        if (/[^A-Za-z0-9]/.test(value)) score += 1;

        if (!value) return { label: 'Henüz girilmedi', color: colors.textTertiary, width: '0%' };
        if (score <= 1) return { label: 'Zayıf', color: '#EF4444', width: '33%' };
        if (score <= 3) return { label: 'Orta', color: '#F59E0B', width: '66%' };
        return { label: 'Güçlü', color: serviceGreen, width: '100%' };
    }, [colors.textTertiary, form.new_password]);

    const updateField = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined, non_field_errors: undefined }));
    };

    const validateForm = () => {
        const nextErrors = {};

        if (!form.old_password.trim()) {
            nextErrors.old_password = 'Mevcut şifrenizi girin.';
        }

        if (form.new_password.length < 6) {
            nextErrors.new_password = 'Yeni şifre en az 6 karakter olmalı.';
        }

        if (form.new_password && form.old_password === form.new_password) {
            nextErrors.new_password = 'Yeni şifre mevcut şifreyle aynı olamaz.';
        }

        if (form.confirm_password !== form.new_password) {
            nextErrors.confirm_password = 'Şifre tekrarı eşleşmiyor.';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setIsSubmitting(true);
        const response = await authService.changePassword(form.old_password, form.new_password);
        setIsSubmitting(false);

        if (response?.response) {
            const data = response.response.data || {};
            setErrors({
                old_password: normalizeFieldError(data.old_password),
                new_password: normalizeFieldError(data.new_password),
                non_field_errors: normalizeFieldError(data.non_field_errors || data.detail),
            });
            return;
        }

        if (response?.isAxiosError || response instanceof Error) {
            setErrors({
                non_field_errors: 'Şifre güncellenemedi. Bağlantınızı kontrol edip tekrar deneyin.',
            });
            return;
        }

        setForm(initialForm);
        Alert.alert('Şifre güncellendi', 'Hesap şifreniz başarıyla değiştirildi.', [
            { text: 'Tamam', onPress: () => navigation.goBack() },
        ]);
    };

    return (
        <KeyboardAvoidingView
            style={[styles.screen, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustKeyboardInsets
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.container,
                    {
                        paddingTop: insets.top + 16,
                        paddingBottom: Math.max(insets.bottom, 20) + 120,
                    },
                ]}
            >
                <View style={styles.header}>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        style={[styles.backButton, { borderColor: colors.border }]}
                    >
                        <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Şifre Değiştir</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <LinearGradient
                    colors={isDark ? ['#2D2D44', '#252538'] : ['#0066CC', '#0052A3']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.hero}
                >
                    <View style={styles.heroIcon}>
                        <MaterialCommunityIcons name="shield-key-outline" size={30} color="#FFFFFF" />
                    </View>
                    <View style={styles.heroTextWrap}>
                        <Text style={styles.heroTitle}>Hesap güvenliği</Text>
                        <Text style={styles.heroSubtitle}>
                            Şifrenizi düzenli aralıklarla güncellemeniz hesabınızı daha güvenli tutar.
                        </Text>
                    </View>
                </LinearGradient>

                <View style={[styles.formPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <CustomInput
                        label="Mevcut şifre"
                        icon="lock-outline"
                        password
                        value={form.old_password}
                        onChangeText={(value) => updateField('old_password', value)}
                        error={errors.old_password}
                        placeholder="Mevcut şifrenizi girin"
                        textContentType="password"
                        autoCapitalize="none"
                    />

                    <CustomInput
                        label="Yeni şifre"
                        icon="lock-plus-outline"
                        password
                        value={form.new_password}
                        onChangeText={(value) => updateField('new_password', value)}
                        error={errors.new_password}
                        placeholder="En az 8 karakter"
                        textContentType="newPassword"
                        autoCapitalize="none"
                    />

                    <View style={styles.strengthWrap}>
                        <View style={[styles.strengthTrack, { backgroundColor: colors.divider }]}>
                            <View
                                style={[
                                    styles.strengthFill,
                                    {
                                        width: passwordStrength.width,
                                        backgroundColor: passwordStrength.color,
                                    },
                                ]}
                            />
                        </View>
                        <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                            {passwordStrength.label}
                        </Text>
                    </View>

                    <CustomInput
                        label="Yeni şifre tekrar"
                        icon="lock-check-outline"
                        password
                        value={form.confirm_password}
                        onChangeText={(value) => updateField('confirm_password', value)}
                        error={errors.confirm_password}
                        placeholder="Yeni şifrenizi tekrar girin"
                        textContentType="newPassword"
                        autoCapitalize="none"
                    />

                    {!!errors.non_field_errors && (
                        <View style={[styles.errorBanner, { backgroundColor: `${colors.error}12` }]}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.error} />
                            <Text style={[styles.errorBannerText, { color: colors.error }]}>
                                {errors.non_field_errors}
                            </Text>
                        </View>
                    )}

                    <View style={[styles.infoBox, { backgroundColor: `${serviceBlue}10` }]}>
                        <MaterialCommunityIcons name="information-outline" size={20} color={serviceBlue} />
                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                            Güçlü bir şifre için büyük harf, rakam ve özel karakter kullanın.
                        </Text>
                    </View>

                    <Pressable
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                        style={({ pressed }) => [
                            styles.submitButton,
                            {
                                backgroundColor: serviceBlue,
                                opacity: isSubmitting || pressed ? 0.82 : 1,
                            },
                        ]}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="check-circle-outline" size={21} color="#FFFFFF" />
                                <Text style={styles.submitText}>Şifreyi Güncelle</Text>
                            </>
                        )}
                    </Pressable>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    container: {
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
    },
    headerSpacer: {
        width: 42,
    },
    hero: {
        minHeight: 132,
        borderRadius: 28,
        padding: 22,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 18,
        overflow: 'hidden',
    },
    heroIcon: {
        width: 58,
        height: 58,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    heroTextWrap: {
        flex: 1,
    },
    heroTitle: {
        color: '#FFFFFF',
        fontSize: 21,
        fontWeight: '800',
        marginBottom: 6,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.78)',
        fontSize: 13,
        lineHeight: 19,
        fontWeight: '500',
    },
    formPanel: {
        borderWidth: 1,
        borderRadius: 28,
        padding: 18,
    },
    strengthWrap: {
        marginTop: -4,
        marginBottom: 16,
    },
    strengthTrack: {
        height: 6,
        borderRadius: 999,
        overflow: 'hidden',
        marginBottom: 7,
    },
    strengthFill: {
        height: '100%',
        borderRadius: 999,
    },
    strengthText: {
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'right',
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        marginBottom: 14,
        gap: 8,
    },
    errorBannerText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
    },
    infoBox: {
        flexDirection: 'row',
        padding: 14,
        borderRadius: 18,
        marginBottom: 18,
        gap: 10,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 19,
        fontWeight: '600',
    },
    submitButton: {
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    submitText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
});
