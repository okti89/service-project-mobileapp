import { View, Text, StyleSheet } from 'react-native'
import React from 'react'
import WrapperContainer from '@/components/WrapperContainer'
import Header from '@/components/Header'

const ProfileScreen = () => {
    return (
        <WrapperContainer>
            <Header title='Profil' />
            <View style={styles.container}>
                <Text>ProfileScreen</Text>
            </View>
        </WrapperContainer>
    )
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
})
export default ProfileScreen