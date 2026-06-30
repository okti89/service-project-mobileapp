import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/context/ThemeContext';
import authService from '@/services/authService';
import CustomInput from '@/components/CustomInput';

const ResetPasswordScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const email = route?.params?.email || '';
  const verifiedCode = route?.params?.verifiedCode || '';

  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleReset = async () => {
    setError('');
    setInfo('');

    if (!password.trim()) {
      setError('Lütfen şifreyi eksiksiz doldurun.');
      return;
    }
    if (password.trim().length <= 8) {
      setError('Şifre en az 8 karakter uzunluğunda olmalıdır.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.passwordResetConfirm(email.trim(), verifiedCode.trim(), password);
      await AsyncStorage.setItem('saved_password', password);
      if (email?.trim() && email.includes('@')) {
        await AsyncStorage.setItem('saved_email', email.trim());
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (e) {
      const data = e?.response?.data || {};
      setError(data?.detail || data?.error || data.new_password || 'Şifre sıfırlama başarısız.');
    } finally {
      setIsSubmitting(false);
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

          <View style={styles.formCard}>
            <Text style={[styles.title, { color: colors.text }]}>Yeni Şifre</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Kod doğrulandı. Şimdi yeni şifrenizi belirleyin.</Text>

            <CustomInput
              label="Yeni Şifre"
              icon="lock-outline"
              password
              value={password}
              onChangeText={setPassword}
            />

            {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
            {info ? <Text style={[styles.info, { color: colors.success }]}>{info}</Text> : null}

            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleReset} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Şifreyi Güncelle</Text>}
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'flex-start',
  },
  backButton: { alignSelf: 'flex-start', marginBottom: 12 },
  formCard: {
    paddingVertical: 8,
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  error: { marginBottom: 12, fontSize: 13, fontWeight: '600' },
  info: { marginBottom: 12, fontSize: 13, fontWeight: '600' },
  primaryBtn: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default ResetPasswordScreen;
