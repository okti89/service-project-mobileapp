import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import WrapperContainer from '@/components/WrapperContainer';
import Header from '@/components/Header';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const RandevularScreen = () => {
    const { colors } = useTheme();

    return (
        <WrapperContainer bg={colors.background} withTabBar>
            <Header title="Randevular" centered borderBottom />

            <View style={styles.content}>
                <View
                    style={[
                        styles.iconWrap,
                        { backgroundColor: `${colors.primary}14` },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="calendar-clock-outline"
                        size={56}
                        color={colors.primary}
                    />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>
                    Randevular Ekranı
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Planlanmış randevular burada görüntülenecek.
                </Text>
            </View>
        </WrapperContainer>
    );
};

const styles = StyleSheet.create({
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.gutter,
        gap: spacing.m,
    },
    iconWrap: {
        width: 96,
        height: 96,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.s,
    },
    title: {
        ...typography.h2,
        fontSize: 20,
    },
    subtitle: {
        ...typography.bodySmall,
        textAlign: 'center',
        maxWidth: 280,
        lineHeight: 20,
    },
});

export default RandevularScreen;