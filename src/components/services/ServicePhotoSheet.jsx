import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ImageViewing from 'react-native-image-viewing';

import AppBottomSheet from '@/components/AppBottomSheet';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import { spacing } from '@/theme/spacing';

const parseError = (error, fallback) => {
    const data = error?.response?.data;
    if (typeof data === 'string') return data;
    if (data?.detail || data?.error) return data.detail || data.error;
    if (data && typeof data === 'object') {
        const first = Object.values(data)[0];
        if (Array.isArray(first)) return String(first[0] || fallback);
        if (typeof first === 'string') return first;
    }
    return error?.message || fallback;
};

function SourceButton({ icon, title, subtitle, color, colors, onPress }) {
    return <Pressable onPress={onPress} style={({ pressed }) => [styles.sourceButton, { borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}>
        <View style={[styles.sourceIcon, { backgroundColor: color + '16' }]}><MaterialCommunityIcons name={icon} size={21} color={color} /></View>
        <View style={styles.sourceCopy}><Text style={[styles.sourceTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.sourceSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text></View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
    </Pressable>;
}

export default function ServicePhotoSheet({ visible, onClose, service, photos = [], onCreate, onUpdate, onDelete }) {
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();
    const [editingPhoto, setEditingPhoto] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [galleryVisible, setGalleryVisible] = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);

    const galleryImages = photos.map((photo) => ({ uri: resolveMediaUrl(photo.image) }));

    const resetEditor = () => {
        setEditingPhoto(null);
        setSelectedImage(null);
        setDescription('');
        setDeleteConfirm(false);
    };

    useEffect(() => {
        if (!visible) {
            resetEditor();
            setGalleryVisible(false);
        }
    }, [visible]);

    const openEditor = (photo = null) => {
        setEditingPhoto(photo);
        setSelectedImage(null);
        setDescription(photo?.description || '');
        setDeleteConfirm(false);
    };

    const openGallery = (index) => {
        setGalleryIndex(index);
        setGalleryVisible(true);
    };

    const pickImage = async (source) => {
        const permission = source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            showToast('error', 'İzin Gerekli', source === 'camera' ? 'Fotoğraf çekmek için kamera izni gereklidir.' : 'Fotoğraf seçmek için galeri izni gereklidir.');
            return;
        }
        const result = source === 'camera'
            ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.Images, allowsEditing: false, quality: 0.8 })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.Images, allowsEditing: false, quality: 0.8 });
        const asset = result?.assets?.[0];
        if (result?.canceled || !asset?.uri) return;
        const mimeType = asset.mimeType || 'image/jpeg';
        setSelectedImage({
            uri: asset.uri,
            mimeType,
            fileName: asset.fileName || 'servis_fotografi_' + Date.now() + '.jpg',
        });
    };

    const handleSave = async () => {
        if (!service?.id) return;
        if (!editingPhoto && !selectedImage) {
            showToast('warning', 'Fotoğraf Seçin', 'Önce kamera veya galeriden bir fotoğraf seçin.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                description: description.trim(),
                ...(selectedImage ? { image: selectedImage } : {}),
            };
            if (editingPhoto?.id) {
                await onUpdate?.(editingPhoto.id, payload);
                showToast('success', 'Fotoğraf Güncellendi', 'Servis fotoğrafı güncellendi.');
            } else {
                await onCreate?.({ service: service.id, ...payload });
                showToast('success', 'Fotoğraf Eklendi', 'Servis fotoğrafı kaydedildi.');
            }
            resetEditor();
        } catch (error) {
            showToast('error', 'İşlem Başarısız', parseError(error, 'Fotoğraf kaydedilemedi.'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!editingPhoto?.id) return;
        setSaving(true);
        try {
            await onDelete?.(editingPhoto.id);
            showToast('success', 'Fotoğraf Silindi', 'Servis fotoğrafı silindi.');
            resetEditor();
        } catch (error) {
            showToast('error', 'Silinemedi', parseError(error, 'Fotoğraf silinemedi.'));
        } finally {
            setSaving(false);
        }
    };

    const editing = Boolean(editingPhoto || selectedImage);
    return <>
        <AppBottomSheet visible={visible} onClose={onClose} snapPoints={['84%']} wrapContent={false} keyboardBehavior="interactive">
        <BottomSheetScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
                <View style={styles.headerCopy}><Text style={[styles.title, { color: colors.text }]}>Servis Fotoğrafları</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>Cihazın durumu ve yapılan işlemler için fotoğraf ekleyin.</Text></View>
                <Pressable onPress={onClose} style={[styles.closeButton, { borderColor: colors.border }]} hitSlop={8}><MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} /></Pressable>
            </View>
            {!editing ? <>
                <View style={styles.sourceList}>
                    <SourceButton icon="camera-outline" title="Kamera ile çek" subtitle="Yeni servis fotoğrafı oluştur" color="#2563EB" colors={colors} onPress={() => pickImage('camera')} />
                    <SourceButton icon="image-outline" title="Galeriden seç" subtitle="Cihazınızdaki bir fotoğrafı ekle" color="#7C3AED" colors={colors} onPress={() => pickImage('gallery')} />
                </View>
                <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.text }]}>Eklenen Fotoğraflar</Text><Text style={[styles.photoCount, { color: colors.textSecondary }]}>{photos.length} kayıt</Text></View>
                {photos.length === 0 ? <View style={[styles.emptyState, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC' }]}><MaterialCommunityIcons name="image-outline" size={30} color={colors.textTertiary} /><Text style={[styles.emptyTitle, { color: colors.text }]}>Henüz fotoğraf eklenmedi</Text><Text style={[styles.emptyText, { color: colors.textSecondary }]}>Kamera veya galeri seçeneğiyle ilk fotoğrafı ekleyebilirsiniz.</Text></View> : <View style={styles.photoGrid}>{photos.map((photo, index) => <Pressable key={String(photo.id)} onPress={() => openGallery(index)} style={({ pressed }) => [styles.photoCard, { borderColor: colors.border, opacity: pressed ? 0.78 : 1 }]}><Image source={{ uri: resolveMediaUrl(photo.image) }} style={styles.photoImage} /><View style={styles.photoShade} /><View style={styles.photoNumber}><Text style={styles.photoNumberText}>{index + 1}</Text></View><Pressable onPress={(event) => { event.stopPropagation?.(); openEditor(photo); }} hitSlop={6} style={[styles.photoEditButton, { backgroundColor: colors.surface }]}><MaterialCommunityIcons name="pencil-outline" size={15} color={colors.primary} /></Pressable></Pressable>)}</View>}
            </> : <View style={styles.editor}>
                <View style={styles.editorTitleRow}><Pressable onPress={resetEditor} hitSlop={8} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={21} color={colors.primary} /></Pressable><Text style={[styles.sectionTitle, { color: colors.text }]}>{editingPhoto ? 'Fotoğrafı Düzenle' : 'Yeni Fotoğraf'}</Text></View>
                <Pressable onPress={() => pickImage('gallery')} style={[styles.preview, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC' }]}>{selectedImage?.uri || editingPhoto?.image ? <Image source={{ uri: selectedImage?.uri || resolveMediaUrl(editingPhoto.image) }} style={styles.previewImage} /> : null}<View style={styles.previewAction}><MaterialCommunityIcons name="image-edit-outline" size={18} color="#FFFFFF" /><Text style={styles.previewActionText}>Fotoğrafı Değiştir</Text></View></Pressable>
                <View style={styles.editorSources}><Pressable onPress={() => pickImage('camera')} style={[styles.compactSource, { borderColor: colors.border }]}><MaterialCommunityIcons name="camera-outline" size={18} color="#2563EB" /><Text style={[styles.compactSourceText, { color: colors.text }]}>Kamera</Text></Pressable><Pressable onPress={() => pickImage('gallery')} style={[styles.compactSource, { borderColor: colors.border }]}><MaterialCommunityIcons name="image-outline" size={18} color="#7C3AED" /><Text style={[styles.compactSourceText, { color: colors.text }]}>Galeri</Text></Pressable></View>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Açıklama</Text><BottomSheetTextInput value={description} onChangeText={setDescription} placeholder="Örn. İşlem öncesi cihaz görüntüsü" placeholderTextColor={colors.textTertiary} maxLength={255} multiline style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF' }]} />
                <Pressable disabled={saving} onPress={handleSave} style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary, opacity: saving || pressed ? 0.75 : 1 }]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <><MaterialCommunityIcons name="content-save-outline" size={19} color="#FFFFFF" /><Text style={styles.saveText}>Kaydet</Text></>}</Pressable>
                {editingPhoto ? (deleteConfirm ? <View style={styles.deleteConfirm}><Text style={styles.deleteConfirmText}>Bu fotoğraf kalıcı olarak silinecek. Emin misiniz?</Text><View style={styles.deleteActions}><Pressable disabled={saving} onPress={() => setDeleteConfirm(false)} style={styles.deleteCancel}><Text style={styles.deleteCancelText}>Vazgeç</Text></Pressable><Pressable disabled={saving} onPress={handleDelete} style={[styles.deleteButton, { opacity: saving ? 0.7 : 1 }]}><Text style={styles.deleteButtonText}>Sil</Text></Pressable></View></View> : <Pressable onPress={() => setDeleteConfirm(true)} style={styles.deleteTrigger}><MaterialCommunityIcons name="trash-can-outline" size={18} color="#DC2626" /><Text style={styles.deleteTriggerText}>Fotoğrafı Sil</Text></Pressable>) : null}
            </View>}
        </BottomSheetScrollView>
        </AppBottomSheet>
        <ImageViewing images={galleryImages} imageIndex={galleryIndex} visible={galleryVisible} onImageIndexChange={setGalleryIndex} onRequestClose={() => setGalleryVisible(false)} presentationStyle="fullScreen" />
    </>;
}

const styles = StyleSheet.create({
    scroll: { flex: 1 }, scrollContent: { paddingHorizontal: spacing.m, paddingBottom: spacing.xl + 56, gap: spacing.m },
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.s, paddingTop: spacing.xs }, headerCopy: { flex: 1, gap: 4 }, title: { fontSize: 18, fontWeight: '800' }, subtitle: { fontSize: 13, lineHeight: 19, fontWeight: '500' }, closeButton: { width: 34, height: 34, borderWidth: 1, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    sourceList: { gap: spacing.s }, sourceButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, padding: spacing.s + 2, borderWidth: 1, borderRadius: 16 }, sourceIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, sourceCopy: { flex: 1, gap: 2 }, sourceTitle: { fontSize: 14, fontWeight: '800' }, sourceSubtitle: { fontSize: 12, fontWeight: '500' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs }, sectionTitle: { fontSize: 15, fontWeight: '800' }, photoCount: { fontSize: 12, fontWeight: '700' }, emptyState: { alignItems: 'center', padding: spacing.l, borderWidth: 1, borderRadius: 16, gap: spacing.xs }, emptyTitle: { fontSize: 14, fontWeight: '800' }, emptyText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, photoCard: { width: '31.8%', aspectRatio: 1, overflow: 'hidden', borderWidth: 1, borderRadius: 14, backgroundColor: '#E2E8F0' }, photoImage: { width: '100%', height: '100%' }, photoShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.1)' }, photoNumber: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(15, 23, 42, 0.7)' }, photoNumberText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' }, photoEditButton: { position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#0F172A', shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    editor: { gap: spacing.s }, editorTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, backButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }, preview: { overflow: 'hidden', height: 230, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, previewImage: { width: '100%', height: '100%' }, previewAction: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(15, 23, 42, 0.78)' }, previewActionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' }, editorSources: { flexDirection: 'row', gap: spacing.s }, compactSource: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderWidth: 1, borderRadius: 12 }, compactSourceText: { fontSize: 13, fontWeight: '700' }, inputLabel: { fontSize: 12, fontWeight: '800', marginTop: spacing.xs }, input: { minHeight: 88, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 11, textAlignVertical: 'top', fontSize: 14 },
    saveButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13 }, saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' }, deleteTrigger: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10 }, deleteTriggerText: { color: '#DC2626', fontSize: 13, fontWeight: '800' }, deleteConfirm: { gap: spacing.s, borderWidth: 1, borderColor: '#FECACA', borderRadius: 13, padding: spacing.s + 2, backgroundColor: '#FEF2F2' }, deleteConfirmText: { color: '#991B1B', fontSize: 13, lineHeight: 18, fontWeight: '700' }, deleteActions: { flexDirection: 'row', gap: spacing.s }, deleteCancel: { flex: 1, alignItems: 'center', paddingVertical: 10, borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10 }, deleteCancelText: { color: '#B91C1C', fontSize: 13, fontWeight: '800' }, deleteButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#DC2626' }, deleteButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
