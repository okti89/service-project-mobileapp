import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import WrapperContainer from "@/components/WrapperContainer";

const ProfileScreen = () => {
    const { colors, isDark } = useTheme();
    return (
        <WrapperContainer>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.text }}>ProfileScreen</Text>
            </View>
        </WrapperContainer>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
});

export default ProfileScreen;