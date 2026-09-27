import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { serviceBlue } from '@/theme/color';

export default function RouteMapModal({ visible, onClose, customerName }) {
    const { colors } = useTheme();

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="map-outline" size={28} color={serviceBlue} />
                    <Text style={[styles.title, { color: colors.text }]}>Rota Haritası</Text>
                    <Text style={[styles.description, { color: colors.textSecondary }]}>Rota görünümü mobil uygulamada kullanılabilir{customerName ? `: ${customerName}` : ''}.</Text>
                    <Pressable onPress={onClose} style={[styles.button, { backgroundColor: serviceBlue }]}>
                        <Text style={styles.buttonText}>Kapat</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
    card: { width: '100%', maxWidth: 420, alignItems: 'center', padding: 24, borderWidth: 1, borderRadius: 16 },
    title: { fontSize: 18, fontWeight: '800', marginTop: 10 },
    description: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 7 },
    button: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 9 },
    buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
