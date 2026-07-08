import React, { useRef, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import HomeHeader from "@/components/home/HomeHeader";
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';

const HomeScreen = ({ navigation }) => {
    const { colors } = useTheme();
    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES}>
            <HomeHeader />
            <View style={styles.container}>
                <Text style={colors.text}>HomeScreen</Text>
            </View>
        </WrapperContainer>
    )
}
export default HomeScreen

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    }
})