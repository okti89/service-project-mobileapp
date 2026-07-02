import React from 'react';
import StarterScreen from '@/components/StarterScreen';

export default function AppearanceSettingsScreen({ navigation }) {
    return (
        <StarterScreen
            title="Gorunum ayarlari"
            subtitle="Tema, renk paleti ve arka plan secimleri icin ayarlar alani."
            badge="Tema"
            actions={[
                { label: 'Profile don', onPress: () => navigation.goBack() },
            ]}
        />
    );
}
