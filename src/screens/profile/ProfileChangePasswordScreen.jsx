import React, { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import Header from '@/components/Header';
import WrapperContainer from '@/components/WrapperContainer';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import authService from '@/services/authService';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export default function ProfileChangePasswordScreen({ navigation }) {
    const { colors } = useTheme();
    const { showToast } = useToast();

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!oldPassword || !newPassword || !confirmPassword) {
            showToast('error', 'Hata', 'Tum alanlari doldurun.');
            return;
        }
        if (newPassword.length < 6) {
            showToast('error', 'Hata', 'Yeni parola en az 6 karakter olmali.');
            return;
        }
        if (newPassword !== confirmPassword) {
            showToast('error', 'Hata', 'Parola tekrar alani eslesmiyor.');
            return;
        }

        setSaving(true);
        try {
            const response = await authService.changePassword(oldPassword, newPassword);
            if (response?.detail || response?.success || !response?.response) {
                showToast('success', 'Basarili', 'Parolaniz guncellendi.');
                navigation.goBack();
                return;
            }
            throw response;
        } catch (error) {
            const detail = error?.response?.data?.detail || error?.detail || 'Parola degistirilemedi.';
            showToast('error', 'Hata', detail);
        } finally {
            setSaving(false);
        }
    };

    return (
        <WrapperContainer bg={colors.background}>
            <Header title="Parola Degistir" showBack borderBottom />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Mevcut Parola</Text>
                    <TextInput secureTextEntry value={oldPassword} onChangeText={setOldPassword} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]} placeholder="Mevcut parola" placeholderTextColor={colors.textTertiary} />
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Yeni Parola</Text>
                    <TextInput secureTextEntry value={newPassword} onChangeText={setNewPassword} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]} placeholder="Yeni parola" placeholderTextColor={colors.textTertiary} />
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Yeni Parola Tekrar</Text>
                    <TextInput secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]} placeholder="Yeni parola tekrar" placeholderTextColor={colors.textTertiary} />
                </View>

                <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary, opacity: saving || pressed ? 0.82 : 1 }]}>
                    {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Parolayi Guncelle</Text>}
                </Pressable>
            </ScrollView>
        </WrapperContainer>
    );
}

const styles = StyleSheet.create({
    content: {
        padding: spacing.gutter,
        gap: spacing.m,
        paddingBottom: spacing['5xl'],
    },
    card: {
        borderWidth: 1,
        borderRadius: 24,
        padding: spacing.l,
        gap: spacing.s,
    },
    label: {
        ...typography.caption,
        fontWeight: '700',
        marginTop: spacing.xs,
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: spacing.m,
        ...typography.body,
    },
    saveButton: {
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.s,
    },
    saveButtonText: {
        color: '#FFFFFF',
        ...typography.body,
        fontWeight: '800',
    },
});
