import { Text, StyleSheet, View } from 'react-native'
import React, { useEffect } from 'react'
import Header from '@/components/header/Header'
import WrapperContainer from '@/components/wrapper/WrapperContainer'
import { useRoute } from '@react-navigation/native'
import { useTheme } from '@/context/ThemeContext'
import AppText from '@/components/display/AppText'
import AppTextInput from '@/components/input/AppTextInput'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/theme'

const AdminTechnicianDetailScreen = ({ navigation }) => {
    const route = useRoute()
    const { id } = route.params || {}
    const { colors } = useTheme()

    useEffect(() => {
        console.log("AdminTechnicianDetailScreen", id)
    }, [id])
    return (
        <WrapperContainer
            header={
                <Header
                    title="Teknisyen Detay"
                    showBackButton
                />
            }
        >
            <AppText>AdminTechnicianDetailScreen</AppText>
        </WrapperContainer>
    )
}

export default AdminTechnicianDetailScreen

const styles = StyleSheet.create({})