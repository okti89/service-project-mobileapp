import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import CustomInput from '@/components/CustomInput';

const RegisterScreen = ({ navigation }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { register } = useAuth();

    const [inputs, setInputs] = useState({
        tenant_code: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        phone_number: '',
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [backendError, setBackendError] = useState(null);

    const toMessage = (v) => (Array.isArray(v) ? v[0] : v);
    const isTenantLikeMessage = (msg) => {
        const text = String(msg || '').toLowerCase();
        return (
            text.includes('tenant') ||
            text.includes('firma kod') ||
            (text.includes('firma') && text.includes('kod')) ||
            text.includes('geçersiz tenant') ||
            text.includes('gecersiz tenant')
        );
    };

    const normalizeFieldKey = (rawKey) => {
        const key = String(rawKey || '').trim();
        const lower = key.toLowerCase();

        const keyMap = {
            email: 'email',
            username: 'email',

            tenant_code: 'tenant_code',
            tenantcode: 'tenant_code',
            tenant: 'tenant_code',
            company_code: 'tenant_code',
            companycode: 'tenant_code',
            firma_kodu: 'tenant_code',
            firmakodu: 'tenant_code',
            code: 'tenant_code',

            first_name: 'first_name',
            firstname: 'first_name',
            name: 'first_name',

            last_name: 'last_name',
            lastname: 'last_name',
            surname: 'last_name',

            phone_number: 'phone_number',
            phonenumber: 'phone_number',
            phone: 'phone_number',
            gsm: 'phone_number',

            password: 'password',
            new_password: 'password',
        };

        return keyMap[key] || keyMap[lower] || null;
    };

    const handleOnChange = (text, input) => {
        setInputs((prev) => ({ ...prev, [input]: text }));
        if (errors[input]) setErrors((prev) => ({ ...prev, [input]: null }));
        if (backendError) setBackendError(null);
    };

    const validate = () => {
        let isValid = true;
        const newErrors = {};

        if (!inputs.tenant_code) {
            newErrors.tenant_code = 'Firma kodu zorunlu';
            isValid = false;
        }
        if (!inputs.email) {
            newErrors.email = 'E-posta adresi zorunlu';
            isValid = false;
        } else if (!inputs.email.includes('@')) {
            newErrors.email = 'Geçerli bir e-posta adresi girin';
            isValid = false;
        }
        if (!inputs.first_name) {
            newErrors.first_name = 'Adınız zorunlu';
            isValid = false;
        }
        if (!inputs.last_name) {
            newErrors.last_name = 'Soyadınız zorunlu';
            isValid = false;
        }
        if (!inputs.phone_number) {
            newErrors.phone_number = 'Telefon numaranız zorunlu';
            isValid = false;
        }
        if (!inputs.password) {
            newErrors.password = 'Parola zorunlu';
            isValid = false;
        } else if (inputs.password.length < 8) {
            newErrors.password = 'Parola en az 8 karakter olmalı';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleRegister = async () => {
        Keyboard.dismiss();
        if (!validate()) return;
        setLoading(true);
        setBackendError(null);

        try {
            const result = await register(
                inputs.email,
                inputs.password,
                inputs.phone_number,
                inputs.first_name,
                inputs.last_name,
                null,
                inputs.tenant_code
            );

            if (!result.success) {
                if (result.fieldErrors && typeof result.fieldErrors === 'object') {
                    const freshErrors = {};
                    const generalErrors = [];

                    Object.keys(result.fieldErrors).forEach((key) => {
                        const msg = toMessage(result.fieldErrors[key]);

                        if (key === 'non_field_errors' || key === 'detail') {
                            if (msg) {
                                if (isTenantLikeMessage(msg)) {
                                    freshErrors.tenant_code = msg;
                                } else {
                                    generalErrors.push(msg);
                                }
                            }
                            return;
                        }

                        const mapped = normalizeFieldKey(key);
                        if (mapped && Object.prototype.hasOwnProperty.call(inputs, mapped)) {
                            freshErrors[mapped] = msg;
                        } else if (msg) {
                            generalErrors.push(msg);
                        }
                    });

                    if (Object.keys(freshErrors).length > 0) {
                        setErrors((prev) => ({ ...prev, ...freshErrors }));
                    }

                    if (generalErrors.length > 0) {
                        setBackendError(generalErrors[0]);
                    } else if (Object.keys(freshErrors).length === 0) {
                        setBackendError(result.error || 'Kayıt işlemi başarısız oldu.');
                    }
                } else {
                    setBackendError(result.error || 'Kayıt işlemi başarısız oldu.');
                }
            }
        } catch (error) {
            setBackendError('Kayıt işlemi başarısız oldu.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient colors={colors.gradients.background} style={styles.container}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={[styles.scrollContainer, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <MaterialCommunityIcons name="arrow-left" size={28} color={colors.text} />
                    </TouchableOpacity>

                    <View style={styles.headerContainer}>
                        <Text style={[styles.title, { color: colors.text }]}>Hesap Oluştur</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Yeni bir servis asistanı hesabı başlatın</Text>
                    </View>

                    {backendError && (
                        <View style={[styles.errorBanner, { backgroundColor: colors.errorBg, borderColor: colors.error + '50' }]}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.error} style={styles.errorIcon} />
                            <Text style={[styles.errorBannerText, { color: colors.error }]}>{backendError}</Text>
                        </View>
                    )}

                    <View style={styles.formContainer}>
                        <CustomInput
                            label="Firma Kodu"
                            icon="office-building-outline"
                            placeholder="Firma Kodunuzu Giriniz"
                            error={errors.tenant_code}
                            value={inputs.tenant_code}
                            onChangeText={(text) => handleOnChange(text, 'tenant_code')}
                            autoCapitalize="none"
                        />

                        <CustomInput
                            label="E-Posta Adresi"
                            icon="email-outline"
                            placeholder="E-posta adresinizi giriniz"
                            error={errors.email}
                            value={inputs.email}
                            onChangeText={(text) => handleOnChange(text, 'email')}
                            autoCapitalize="none"
                        />

                        <View style={styles.row}>
                            <View style={styles.flexHalf}>
                                <CustomInput
                                    label="Ad"
                                    icon="account-outline"
                                    placeholder="Adınız"
                                    error={errors.first_name}
                                    value={inputs.first_name}
                                    onChangeText={(text) => handleOnChange(text, 'first_name')}
                                />
                            </View>
                            <View style={styles.spacer} />
                            <View style={styles.flexHalf}>
                                <CustomInput
                                    label="Soyad"
                                    icon="account-outline"
                                    placeholder="Soyadınız"
                                    error={errors.last_name}
                                    value={inputs.last_name}
                                    onChangeText={(text) => handleOnChange(text, 'last_name')}
                                />
                            </View>
                        </View>

                        <CustomInput
                            label="Telefon Numaranız"
                            icon="phone-outline"
                            placeholder="xxxx xxx xx xx"
                            keyboardType="phone-pad"
                            isPhone={true}
                            error={errors.phone_number}
                            value={inputs.phone_number}
                            onChangeText={(text) => handleOnChange(text, 'phone_number')}
                        />

                        <CustomInput
                            label="Parola"
                            icon="lock-outline"
                            placeholder="Güçlü bir parola belirleyin"
                            password
                            error={errors.password}
                            value={inputs.password}
                            onChangeText={(text) => handleOnChange(text, 'password')}
                        />

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.primary, opacity: loading ? 0.8 : 1 }]}
                            onPress={handleRegister}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.buttonText}>Kayıt Ol</Text>}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footerContainer}>
                        <Text style={[styles.footerText, { color: colors.textSecondary }]}>Zaten hesabın var mı? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={[styles.footerLink, { color: colors.primary }]}>Giriş Yap</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ height: 60 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    backButton: { alignSelf: 'flex-start', marginBottom: 20 },
    scrollContainer: { flexGrow: 1, paddingHorizontal: 24 },
    headerContainer: { marginBottom: 30 },
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 8, letterSpacing: 0.5 },
    subtitle: { fontSize: 16 },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 20,
    },
    errorIcon: { marginRight: 8 },
    errorBannerText: { flex: 1, fontSize: 14, fontWeight: '500' },
    formContainer: { marginBottom: 24 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    flexHalf: { flex: 1 },
    spacer: { width: 12 },
    button: {
        height: 55,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
        marginTop: 10,
    },
    buttonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
    footerContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 'auto' },
    footerText: { fontSize: 15 },
    footerLink: { fontSize: 15, fontWeight: 'bold' },
});

export default RegisterScreen;
