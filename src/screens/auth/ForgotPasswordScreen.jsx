import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import CustomInput from '@/components/CustomInput';
import authService from '@/services/authService';

const ForgotPasswordScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [contactInfo, setContactInfo] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const navigateTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (navigateTimeoutRef.current) {
      clearTimeout(navigateTimeoutRef.current);
      navigateTimeoutRef.current = null;
    }
    if (!contactInfo) {
      setError('Lütfen kayıtlı email adresinizi giriniz.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await authService.passwordResetRequest(contactInfo);

      setSuccessMessage('Doğrulama kodu email adresinize gönderildi.');
      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current);
      }
      navigateTimeoutRef.current = setTimeout(() => {
        navigation.navigate('ResetCode', { email: contactInfo.trim() });
      }, 400);
    } catch (err) {
      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current);
        navigateTimeoutRef.current = null;
      }
      const data = err.response?.data;
      if (data && data.email) {
        setError(Array.isArray(data.email) ? data.email[0] : data.email);
      } else {
        setError(data?.detail || data?.email?.[0] || 'Talebiniz alınamadı. Lütfen daha sonra tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (navigateTimeoutRef.current) {
      clearTimeout(navigateTimeoutRef.current);
      navigateTimeoutRef.current = null;
    }
    navigation.goBack();
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
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <MaterialCommunityIcons name="arrow-left" size={28} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerContainer}>
            <View style={[styles.iconWrapper, { backgroundColor: isDark ? colors.primary + '20' : colors.primaryLight }]}>
              <MaterialCommunityIcons name="lock-reset" size={60} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Şifremi Unuttum</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Sisteme kayıtlı iletişim bilginizi girin.</Text>
          </View>

          {error && (
            <View style={[styles.banner, { backgroundColor: colors.errorBg, borderColor: colors.error + '50' }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.error} style={styles.bannerIcon} />
              <Text style={[styles.bannerText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          {successMessage && (
            <View style={[styles.banner, { backgroundColor: colors.successBg, borderColor: colors.success + '50' }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.success} style={styles.bannerIcon} />
              <Text style={[styles.bannerText, { color: colors.success }]}>{successMessage}</Text>
            </View>
          )}

          <View style={styles.formContainer}>
            <CustomInput
              label="Email adresi"
              icon="email-outline"
              placeholder="Email adresinizi giriniz"
              error={null}
              value={contactInfo}
              onChangeText={(text) => {
                setContactInfo(text);
                setError(null);
              }}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary, opacity: loading ? 0.8 : 1 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.buttonText}>Gönder</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.footerContainer}>
            <TouchableOpacity onPress={handleBack} style={styles.backToLoginBtn}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.footerLink, { color: colors.primary }]}>Giriş Ekranına Dön</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  bannerIcon: {
    marginRight: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  formContainer: {
    marginBottom: 24,
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
    marginTop: 10,
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
  backToLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  footerLink: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ForgotPasswordScreen;

