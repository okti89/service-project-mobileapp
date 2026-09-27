import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { fs, sp } from '@/theme/scale';

export default function CompletedServicesToggle({ visible, count, onChange }) {
    const { colors } = useTheme();

    return (
        <Pressable
            onPress={() => onChange(!visible)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: visible }}
            accessibilityLabel="Tamamlanan servisleri göster"
            style={({ pressed }) => [styles.toggle, { opacity: pressed ? 0.7 : 1 }]}
        >
            <MaterialCommunityIcons
                name={visible ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={sp(21)}
                color={visible ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.label, { color: visible ? colors.primary : colors.textSecondary }]}>
                Tamamlananları göster{count > 0 ? ` (${count})` : ''}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    toggle: {
        minHeight: sp(40),
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp(7),
        alignSelf: 'flex-start',
    },
    label: {
        fontSize: fs(12),
        fontWeight: '600',
    },
});
