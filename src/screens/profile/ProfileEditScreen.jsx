import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import AppBottomSheet from '@/components/AppBottomSheet';
import Header from '@/components/Header';
import WrapperContainer from '@/components/WrapperContainer';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import authService from '@/services/authService';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const initialsOf = (label) => {
    return String(label || '')
        .trim()
        .split(/\s+/)
        .map((chunk) => chunk[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
};

const formatPhoneInput = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 12);
    if (!digits) return '';

    let local = digits;
    if (local.startsWith('90')) {
        local = local.slice(2);
    }
    if (local.startsWith('0')) {
        local = local.slice(1);
    }
    local = local.slice(0, 10);

    const parts = [];
    if (local.slice(0, 3)) parts.push(local.slice(0, 3));
    if (local.slice(3, 6)) parts.push(local.slice(3, 6));
    if (local.slice(6, 8)) parts.push(local.slice(6, 8));
    if (local.slice(8, 10)) parts.push(local.slice(8, 10));

    return local ? `0${parts.join(' ')}` : '';
};

function SourceOption({ icon, title, subtitle, colors, onPress, danger = false }) {
    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.sourceOption, { borderColor: colors.border, opacity: pressed ? 0.78 : 1 }]}>
            <View style={[styles.sourceIconWrap, { backgroundColor: danger ? `${colors.error}12` : `${colors.primary}12` }]}>
                <MaterialCommunityIcons name={icon} size={20} color={danger ? colors.error : colors.primary} />
            </View>
            <View style={styles.sourceContent}>
                <Text style={[styles.sourceTitle, { color: danger ? colors.error : colors.text }]}>{title}</Text>
                <Text style={[styles.sourceSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
        </Pressable>
    );
}

export default function ProfileEditScreen({ navigation }) {
    const { colors } = useTheme();
    const { userInfo, checkAuth } = useAuth();
    const { showToast } = useToast();
    const insets = useSafeAreaInsets();

    const [firstName, setFirstName] = useState(userInfo?.first_name || '');
    const [lastName, setLastName] = useState(userInfo?.last_name || '');
    const [email, setEmail] = useState(userInfo?.email || '');
    const [phone, setPhone] = useState(formatPhoneInput(userInfo?.phone_number || ''));
    const [avatarUri, setAvatarUri] = useState(resolveMediaUrl(userInfo?.avatar));
    const [saving, setSaving] = useState(false);
    const [photoSheetVisible, setPhotoSheetVisible] = useState(false);

    const fullName = useMemo(() => [firstName, lastName].filter(Boolean).join(' ') || email || 'Kullanıcı', [email, firstName, lastName]);

    const requestPermissions = async () => {
        const camera = await ImagePicker.requestCameraPermissionsAsync();
        const gallery = await ImagePicker.requestMediaLibraryPermissionsAsync();
        return {
            cameraGranted: camera.granted,
            galleryGranted: gallery.granted,
        };
    };

    const closePhotoSheet = () => setPhotoSheetVisible(false);

    const pickAvatar = async (source) => {
        closePhotoSheet();

        const permissions = await requestPermissions();
        if ((source === 'camera' && !permissions.cameraGranted) || (source === 'gallery' && !permissions.galleryGranted)) {
            showToast('error', 'İzin Gerekli', 'Kamera ve galeri izinleri gereklidir.');
            return;
        }

        const options = {
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.85,
        };

        const result = source === 'camera'
            ? await ImagePicker.launchCameraAsync(options)
            : await ImagePicker.launchImageLibraryAsync(options);

        if (!result.canceled && result.assets?.length) {
            setAvatarUri(result.assets[0].uri);
        }
    };

    const handleSave = async () => {
        if (!firstName.trim() || !lastName.trim() || !email.trim()) {
            showToast('error', 'Hata', 'Ad, soyad ve e-posta zorunludur.');
            return;
        }

        setSaving(true);
        try {
            const response = await authService.updateProfile({
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                email: email.trim(),
                phone_number: phone.trim(),
                avatarUri: avatarUri && !avatarUri.startsWith('http') ? avatarUri : undefined,
            });

            if (response?.id || response?.email) {
                await checkAuth?.({ silent: true });
                showToast('success', 'Başarılı', 'Profil bilgileri güncellendi.');
                navigation.goBack();
                return;
            }

            throw response;
        } catch (error) {
            const detail = error?.response?.data?.detail || error?.detail || 'Profil güncellenemedi.';
            showToast('error', 'Hata', detail);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <WrapperContainer bg={colors.background}>
                <Header title="Profili Düzenle" showBack borderBottom />
                <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 24}
                >
                    <ScrollView
                        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.xl) + spacing['5xl'] }]}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="interactive"
                        contentInsetAdjustmentBehavior="always"
                        automaticallyAdjustKeyboardInsets
                    >
                        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Pressable onPress={() => setPhotoSheetVisible(true)} style={styles.avatarWrap}>
                                {avatarUri ? (
                                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                                ) : (
                                    <View style={[styles.avatarFallback, { backgroundColor: `${colors.primary}16` }]}>
                                        <Text style={[styles.avatarFallbackText, { color: colors.primary }]}>{initialsOf(fullName)}</Text>
                                    </View>
                                )}
                                <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
                                    <MaterialCommunityIcons name="camera-outline" size={14} color="#FFFFFF" />
                                </View>
                            </Pressable>
                            <Text style={[styles.photoLabel, { color: colors.textSecondary }]}>Profil fotoğrafını değiştir</Text>
                        </View>

                        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Ad</Text>
                            <TextInput value={firstName} onChangeText={setFirstName} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]} placeholder="Ad" placeholderTextColor={colors.textTertiary} />
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Soyad</Text>
                            <TextInput value={lastName} onChangeText={setLastName} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]} placeholder="Soyad" placeholderTextColor={colors.textTertiary} />
                            <Text style={[styles.label, { color: colors.textSecondary }]}>E-posta</Text>
                            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]} placeholder="E-posta" placeholderTextColor={colors.textTertiary} />
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Telefon</Text>
                            <TextInput value={phone} onChangeText={(value) => setPhone(formatPhoneInput(value))} keyboardType="phone-pad" style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]} placeholder="05xx xxx xx xx" placeholderTextColor={colors.textTertiary} />
                        </View>

                        <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary, opacity: saving || pressed ? 0.82 : 1 }]}>
                            {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Kaydet</Text>}
                        </Pressable>
                    </ScrollView>
                </KeyboardAvoidingView>
            </WrapperContainer>

            <AppBottomSheet
                visible={photoSheetVisible}
                onClose={closePhotoSheet}
                snapPoints={['50%']}
            >
                <View style={styles.sheetContent}>
                    <View style={[styles.sheetIcon, { backgroundColor: `${colors.primary}12` }]}>
                        <MaterialCommunityIcons name="image-edit-outline" size={24} color={colors.primary} />
                    </View>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>Profil fotoğrafı</Text>
                    <Text style={[styles.sheetDescription, { color: colors.textSecondary }]}>Fotoğraf kaynağını seçin.</Text>

                    <View style={styles.sheetOptions}>
                        <SourceOption
                            icon="camera-outline"
                            title="Kamera"
                            subtitle="Yeni bir fotoğraf çek"
                            colors={colors}
                            onPress={() => pickAvatar('camera')}
                        />
                        <SourceOption
                            icon="image-outline"
                            title="Galeri"
                            subtitle="Mevcut fotoğraflar arasından seç"
                            colors={colors}
                            onPress={() => pickAvatar('gallery')}
                        />
                    </View>
                </View>
            </AppBottomSheet>
        </>
    );
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    content: {
        padding: spacing.gutter,
        gap: spacing.m,
        flexGrow: 1,
    },
    card: {
        borderWidth: 1,
        borderRadius: 20,
        padding: spacing.l,
        gap: spacing.s,
    },
    avatarWrap: {
        alignSelf: 'center',
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 24,
    },
    avatarFallback: {
        width: 80,
        height: 80,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarFallbackText: {
        fontSize: 24,
        fontWeight: '800',
    },
    editBadge: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    photoLabel: {
        ...typography.bodySmall,
        textAlign: 'center',
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
    sheetContent: {
        paddingHorizontal: spacing.l,
        paddingTop: spacing.s,
    },
    sheetIcon: {
        width: 52,
        height: 52,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: spacing.m,
    },
    sheetTitle: {
        ...typography.h3,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 6,
    },
    sheetDescription: {
        ...typography.bodySmall,
        textAlign: 'center',
        marginBottom: spacing.l,
    },
    sheetOptions: {
        gap: spacing.s,
    },
    sourceOption: {
        borderWidth: 1,
        borderRadius: 18,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.m,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
    },
    sourceIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sourceContent: {
        flex: 1,
        gap: 2,
    },
    sourceTitle: {
        ...typography.body,
        fontWeight: '700',
    },
    sourceSubtitle: {
        ...typography.caption,
    },
});