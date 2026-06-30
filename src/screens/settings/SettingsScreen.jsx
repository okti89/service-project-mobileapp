import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import WrapperContainer from '@/components/WrapperContainer'
import { useTheme } from '@/context/ThemeContext'
const SettingsScreen = () => {
    const { colors } = useTheme()
    return (
        <WrapperContainer
            showHeader={true}
            showTabbar={true}
            title='Ayarlar'
        >
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <Text style={[styles.title, { color: colors.text }]}>Ayarlar</Text>
            </View>
        </WrapperContainer>
    )
}

export default SettingsScreen

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
})
