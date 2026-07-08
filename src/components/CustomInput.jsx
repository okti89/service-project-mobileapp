import React, { useState, useRef } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

const CustomInput = ({
    label,
    icon,
    error,
    password,
    isPhone,
    value,
    onChangeText,
    onFocus = () => { },
    inputContainerStyle,
    disableSmartFormat = false,
    ...props
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [hidePassword, setHidePassword] = useState(password);
    const { colors } = useTheme();
    const inputRef = useRef(null);

    const formatTrPhone = (digits) => {
        if (!digits) return '';

        if (digits.startsWith('0')) {
            const d = digits.slice(0, 11);
            if (d.length <= 4) return d;
            if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
            if (d.length <= 9) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
            return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
        }

        if (digits.startsWith('5')) {
            const d = digits.slice(0, 10);
            if (d.length <= 3) return d;
            if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
            if (d.length <= 8) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
            return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
        }

        return digits;
    };

    const handleTextChange = (text) => {
        if (!onChangeText) return;

        if (password) {
            onChangeText(text);
            return;
        }

        if (disableSmartFormat) {
            onChangeText(text);
            return;
        }

        const stripped = text.replace(/\s/g, '');
        const isAllDigits = stripped.length > 0 && /^\d+$/.test(stripped);

        if (isPhone || isAllDigits) {
            const onlyDigits = (text || '').replace(/\D/g, '');
            onChangeText(formatTrPhone(onlyDigits));
        } else {
            onChangeText(text);
        }
    };

    const handleClear = () => {
        if (onChangeText) {
            onChangeText('');
        }
    };

    const numericLike = !password && !!(isPhone || ((value || '').replace(/\s/g, '').length > 0 && /^\d+$/.test((value || '').replace(/\s/g, ''))));
    const phoneMaxLength = ((value || '').replace(/\s/g, '').startsWith('0')) ? 14 : 13;

    return (
        <View style={styles.container}>
            {label && (
                <Text style={[styles.label, { color: error ? colors.error : (isFocused ? colors.primary : colors.textSecondary) }]}>
                    {label}
                </Text>
            )}
            <Pressable
                onPress={() => inputRef.current?.focus()}
                style={[
                    styles.inputContainer,
                    {
                        backgroundColor: '#FFFFFF',
                        borderColor: error ? colors.error : (isFocused ? colors.primary : colors.border),
                    },
                    inputContainerStyle,
                ]}
            >
                {icon && (
                    <MaterialCommunityIcons
                        name={icon}
                        size={22}
                        color={error ? colors.error : (isFocused ? colors.primary : colors.textTertiary)}
                        style={styles.icon}
                    />
                )}
                <TextInput
                    ref={inputRef}
                    style={[styles.input, { color: '#0F172A' }, props.style, props.multiline && { paddingRight: 32 }]}
                    autoCorrect={false}
                    onFocus={() => {
                        onFocus();
                        setIsFocused(true);
                    }}
                    onBlur={() => setIsFocused(false)}
                    secureTextEntry={hidePassword}
                    placeholderTextColor="#6B7280"
                    value={value}
                    onChangeText={handleTextChange}
                    keyboardType={isPhone ? 'phone-pad' : props.keyboardType}
                    maxLength={disableSmartFormat ? props.maxLength : (numericLike ? phoneMaxLength : props.maxLength)}
                    {...props}
                />
                {!password && value && value.length > 0 && isFocused && (
                    <TouchableOpacity
                        onPressIn={handleClear}
                        activeOpacity={0.9}
                        style={[styles.actionIcon, props.multiline && { position: 'absolute', right: 12, top: 12 }]}
                    >
                        <MaterialCommunityIcons name="close-circle" size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                )}
                {password && (
                    <TouchableOpacity onPress={() => setHidePassword(!hidePassword)}>
                        <MaterialCommunityIcons
                            name={hidePassword ? 'eye-outline' : 'eye-off-outline'}
                            size={22}
                            color={colors.textTertiary}
                            style={styles.eyeIcon}
                        />
                    </TouchableOpacity>
                )}
            </Pressable>
            {error && (
                <Text style={[styles.errorText, { color: colors.error }]}>
                    {error}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        marginBottom: 6,
        fontWeight: '500',
    },
    inputContainer: {
        height: 55,
        flexDirection: 'row',
        paddingHorizontal: 16,
        borderWidth: 1.5,
        borderRadius: 5,
        alignItems: 'center',
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
    },
    actionIcon: {
        paddingLeft: 10,
    },
    eyeIcon: {
        marginLeft: 10,
    },
    errorText: {
        marginTop: 6,
        fontSize: 12,
        fontWeight: '500',
    },
});

export default CustomInput;
