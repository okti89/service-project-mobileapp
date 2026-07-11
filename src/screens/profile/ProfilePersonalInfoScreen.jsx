import React, { useMemo } from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import Header from '@/components/Header';
import WrapperContainer from '@/components/WrapperContainer';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { useTheme } from '@/context/ThemeContext';
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

const formatPhoneNumber = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '-';

    let local = digits;
    if (local.startsWith('90') && local.length >= 12) local = local.slice(2);
    if (local.startsWith('0') && local.length >= 11) local = local.slice(1);
    local = local.slice(0, 10);

    if (!local) return '-';

    const parts = [];
    if (local.slice(0, 3)) parts.push(local.slice(0, 3));
    if (local.slice(3, 6)) parts.push(local.slice(3, 6));
    if (local.slice(6, 8)) parts.push(local.slice(6, 8));
    if (local.slice(8, 10)) parts.push(local.slice(8, 10));

    return `0${parts.join(' ')}`;
};

function DetailRow({ label, value, colors, hideDivider = false }) {
    return (
        <View style={[styles.detailRow, !hideDivider && { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
        </View>
    );
}

export default function ProfilePersonalInfoScreen() {
    const { colors } = useTheme();
    const { userInfo } = useAuth();
    const { config } = useConfig();

    const fullName = userInfo?.full_name || [userInfo?.first_name, userInfo?.last_name].filter(Boolean).join(' ') || userInfo?.email || 'Kullanici';
    const avatarUri = resolveMediaUrl(userInfo?.avatar);
    const joinedDate = userInfo?.date_joined ? new Date(userInfo.date_joined).toLocaleDateString('tr-TR') : '-';
    const rows = useMemo(() => ([
        { label: 'Ad Soyad', value: fullName },
        { label: 'E-posta', value: userInfo?.email || '-' },
        { label: 'Telefon', value: formatPhoneNumber(userInfo?.phone_number) },
        { label: 'Rol', value: userInfo?.user_type_display || '-' },
        { label: 'Firma', value: config?.name || '-' },
        { label: 'Uyelik Tarihi', value: joinedDate },
    ]), [config?.name, fullName, joinedDate, userInfo?.email, userInfo?.phone_number, userInfo?.user_type_display]);

    return (
        <WrapperContainer bg={colors.background}>
            <Header title="Kisisel Bilgiler" showBack borderBottom />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatarFallback, { backgroundColor: `${colors.primary}16` }]}>
                            <Text style={[styles.avatarFallbackText, { color: colors.primary }]}>{initialsOf(fullName)}</Text>
                        </View>
                    )}
                    <Text style={[styles.heroName, { color: colors.text }]}>{fullName}</Text>
                    <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>{userInfo?.user_type_display || '-'}</Text>
                </View>

                <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {rows.map((row, index) => (
                        <DetailRow
                            key={row.label}
                            label={row.label}
                            value={row.value}
                            colors={colors}
                            hideDivider={index === rows.length - 1}
                        />
                    ))}
                </View>
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
    heroCard: {
        borderWidth: 1,
        borderRadius: 24,
        padding: spacing.xl,
        alignItems: 'center',
        gap: spacing.s,
    },
    avatar: {
        width: 104,
        height: 104,
        borderRadius: 30,
    },
    avatarFallback: {
        width: 104,
        height: 104,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarFallbackText: {
        fontSize: 32,
        fontWeight: '800',
    },
    heroName: {
        ...typography.h3,
        fontWeight: '800',
    },
    heroSubtitle: {
        ...typography.bodySmall,
    },
    detailCard: {
        borderWidth: 1,
        borderRadius: 24,
        paddingHorizontal: spacing.l,
    },
    detailRow: {
        paddingVertical: spacing.m,
        gap: 6,
    },
    detailLabel: {
        ...typography.caption,
        fontWeight: '700',
    },
    detailValue: {
        ...typography.body,
    },
});
