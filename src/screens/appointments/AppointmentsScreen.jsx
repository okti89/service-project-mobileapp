import React from "react";
import { Text, View } from "react-native";
import WrapperContainer from "@/components/WrapperContainer";
import { useTheme } from "@/context/ThemeContext";

const AppointmentsScreen = () => {
    const { colors } = useTheme();
    return (
        <WrapperContainer>
            <View style={{ backgroundColor: colors.background, flex: 1, justifyContent: "center", alignItems: "center" }}>
                <Text>AppointmentsScreen</Text>
            </View>
        </WrapperContainer>
    );
};

export default AppointmentsScreen;