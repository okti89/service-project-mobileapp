import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { serviceBlue } from '@/theme/color';

export default function ServiceDetail({ navigation }) {
    const { colors } = useTheme();

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}> 
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                <View style={[styles.icon, { backgroundColor: `${serviceBlue}14` }]}> 
                    <MaterialCommunityIcons name="clipboard-text-outline" size={30} color={serviceBlue} />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>Servis Detayı</Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>Harita içeren servis detayları mobil uygulamada kullanılabilir.</Text>
                <Pressable onPress={() => navigation.goBack()} style={[styles.button, { backgroundColor: serviceBlue }]}> 
                    <Text style={styles.buttonText}>Geri Dön</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: { width: '100%', maxWidth: 440, alignItems: 'center', padding: 28, borderWidth: 1, borderRadius: 16 },
    icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { fontSize: 20, fontWeight: '800' },
    description: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 8 },
    button: { marginTop: 22, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10 },
    buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
