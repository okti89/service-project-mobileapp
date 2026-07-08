import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Keyboard, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import WrapperContainer from '@/components/WrapperContainer';
import CustomInput from '@/components/CustomInput';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const LoginScreen = ({ navigation }) => {
    const { colors, isDark } = useTheme();
    const { login } = useAuth();

    const [inputs, setInputs] = useState({ email: '', password: '' });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [backendError, setBackendError] = useState(null);

    useEffect(() => {
        const loadSavedCredentials = async () => {
            try {
                const savedEmail = await AsyncStorage.getItem('saved_email');
                const savedPassword = await AsyncStorage.getItem('saved_password');
                setInputs(prev => ({
                    ...prev,
                    email: savedEmail || '',
                    password: savedPassword || ''
                }));
            } catch (error) {
                console.error("Error loading saved credentials", error);
            }
        };

        loadSavedCredentials();
    }, []);

    const handleOnChange = (text, input) => {
        setInputs((prevState) => ({ ...prevState, [input]: text }));
        // Clear errors as soon as user types
        if (errors[input]) {
            setErrors((prevState) => ({ ...prevState, [input]: null }));
        }
        if (backendError) {
            setBackendError(null);
        }
    };

    const validate = () => {
        let isValid = true;
        if (!inputs.email) {
            handleError('Email alani boş birakilamaz', 'email');
            isValid = false;
        }
        if (!inputs.password) {
            handleError('Şifre alani boş birakilamaz', 'password');
            isValid = false;
        }
        return isValid;
    };

    const handleError = (error, input) => {
        setErrors((prevState) => ({ ...prevState, [input]: error }));
    };

    const handleLogin = async () => {
        Keyboard.dismiss();
        if (!validate()) return;
        setLoading(true);
        setBackendError(null);

        const result = await login(inputs.email, inputs.password);
        if (!result.success) {
            if (result.fieldErrors) {
                const freshErrors = {};
                Object.keys(result.fieldErrors).forEach((key) => {
                    if (key !== 'non_field_errors' && key !== 'detail') {
                        freshErrors[key] = Array.isArray(result.fieldErrors[key])
                            ? result.fieldErrors[key][0]
                            : result.fieldErrors[key];
                    }
                });

                if (Object.keys(freshErrors).length > 0) {
                    setErrors((prev) => ({ ...prev, ...freshErrors }));
                } else {
                    setBackendError(result.error || 'Giriş yapilamadi. Bilgilerinizi kontrol edin.');
                }
            } else {
                setBackendError(result.error || 'Giriş yapilamadi. Bilgilerinizi kontrol edin.');
            }
        }
        setLoading(false);
    };

    return (
        <LinearGradient colors={colors.gradients.background} style={styles.container}>
            <WrapperContainer
                bg="transparent"
                scroll
                keyboardAvoiding
                topOffset={spacing['4xl']}
                contentContainerStyle={styles.scrollContainer}
            >

                {/* Header Section */}
                <View style={styles.headerContainer}>
                    <View style={[styles.iconWrapper, { backgroundColor: isDark ? colors.primary + '20' : colors.primaryLight }]}>
                        <Image style={styles.logo} source={require('../../../assets/logo.png')} />


                    </View>
                    <Text style={[styles.title, { color: colors.text }]}>Hoş Geldiniz</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Devam etmek için giriş yapın</Text>
                </View>

                {/* Global Error Banner */}
                {backendError && (
                    <View style={[styles.errorBanner, { backgroundColor: colors.errorBg, borderColor: colors.error + '50' }]}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.error} style={styles.errorIcon} />
                        <Text style={[styles.errorBannerText, { color: colors.error }]}>{backendError}</Text>
                    </View>
                )}

                {/* Input Fields */}
                <View style={styles.formContainer}>
                    <CustomInput
                        label="Email"
                        icon="account-outline"
                        placeholder="Email adresinizi girin"
                        error={errors.email}
                        value={inputs.email}
                        onChangeText={(text) => handleOnChange(text, 'email')}
                        autoCapitalize="none"
                    />

                    <CustomInput
                        label="Parola"
                        icon="lock-outline"
                        placeholder="Parolanizi girin"
                        password
                        error={errors.password}
                        value={inputs.password}
                        onChangeText={(text) => handleOnChange(text, 'password')}
                    />

                    {/* Forgot Password */}
                    <TouchableOpacity
                        style={styles.forgotPasswordContainer}
                        onPress={() => navigation.navigate('ForgotPassword')}
                    >
                        <Text style={[styles.forgotPasswordText, { color: colors.text }]}>Şifremi Unuttum?</Text>
                    </TouchableOpacity>

                    {/* Login Button */}
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.primary, opacity: loading ? 0.8 : 1 }]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Text style={styles.buttonText}>Giriş Yap</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Footer Register Link */}
                <View style={styles.footerContainer}>
                    <Text style={[styles.footerText, { color: colors.textSecondary }]}>Hesabiniz yok mu? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                        <Text style={[styles.footerLink, { color: colors.primary }]}>Kayıt Ol</Text>
                    </TouchableOpacity>
                </View>

                {/* Keyboard Spacer */}
                <View style={{ height: 60 }} />

            </WrapperContainer>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
        paddingHorizontal: 24,
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    iconWrapper: {
        width: 150,
        height: 150,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    logo: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
        borderRadius: 30,

    },
    title: {
        fontSize: 32,
        fontFamily: typography.fontFamily.bold,
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 16,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 20,
    },
    errorIcon: {
        marginRight: 8,
    },
    errorBannerText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
    formContainer: {
        marginBottom: 24,
    },
    forgotPasswordContainer: {
        alignItems: 'flex-end',
        marginBottom: 30,
        marginTop: -6,
    },
    forgotPasswordText: {
        fontSize: 14,
        fontWeight: '600',
    },
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
    },
    buttonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    footerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 'auto',
    },
    footerText: {
        fontSize: 15,
    },
    footerLink: {
        fontSize: 15,
        fontWeight: 'bold',
    },
});

export default LoginScreen;
