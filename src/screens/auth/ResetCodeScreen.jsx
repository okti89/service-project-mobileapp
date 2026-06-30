import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import authService from '@/services/authService';

const ResetCodeScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const email = route?.params?.email || '';

  const [digits, setDigits] = useState(['', '', '', '']);
  const inputRefs = useRef([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const code = digits.join('');

  const handleDigitChange = (text, index) => {
    const cleaned = (text || '').replace(/\D/g, '');

    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      if (error) setError('');
      return;
    }

    const next = [...digits];
    const chars = cleaned.split('');

    let cursor = index;
    for (let i = 0; i < chars.length && cursor < 4; i += 1) {
      next[cursor] = chars[i];
      cursor += 1;
    }

    setDigits(next);
    if (error) setError('');

    if (cursor < 4) {
      inputRefs.current[cursor]?.focus();
    } else {
      inputRefs.current[3]?.blur();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (code.length !== 4) {
      setError('Doğrulama kodu 4 haneli olmalıdır.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await authService.passwordResetVerify(email, code);
      navigation.navigate('ResetPassword', { email, verifiedCode: code });
    } catch (e) {
      const data = e?.response?.data || {};
      setError(data?.detail || 'Doğrulama kodu geçersiz veya süresi dolmuş.');
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
            <Text style={[styles.title, { color: colors.text }]}>Kodu Doğrula</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Email adresinize gelen 4 haneli doğrulama kodunu girin.</Text>

            <Text style={[styles.otpLabel, { color: colors.textSecondary }]}>Doğrulama Kodu</Text>
            <View style={styles.otpRow}>
              {digits.map((digit, index) => (
                <TextInput
                  key={`otp-${index}`}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  style={[
                    styles.otpInput,
                    {
                      borderColor: error ? colors.error : colors.border,
                      color: colors.text,
                      backgroundColor: colors.surface,
                    },
                  ]}
                  value={digit}
                  onChangeText={(text) => handleDigitChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  returnKeyType="done"
                  maxLength={4}
                  textAlign="center"
                />
              ))}
            </View>

            {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleVerify} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Doğrula</Text>}
            </TouchableOpacity>
          </View>
          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'flex-start' },
  backButton: { alignSelf: 'flex-start', marginBottom: 12 },
  formCard: { paddingVertical: 8 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  otpLabel: { fontSize: 14, marginBottom: 6, fontWeight: '500' },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  otpInput: {
    width: 62,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 24,
    fontWeight: '700',
  },
  error: { marginBottom: 12, fontSize: 13, fontWeight: '600' },
  primaryBtn: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default ResetCodeScreen;
