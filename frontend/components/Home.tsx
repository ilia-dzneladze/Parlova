import React from "react";
import { View, Text, Button, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FONT_FAMILY } from "../constants/theme";

type RootStackParamList = {
    Home: undefined;
    Chat: undefined;
};

const Home = () => {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>()
    return(
        <SafeAreaView style={styles.root}>
            <Text style={styles.headerText}>
                Learn Language Through Conversation
            </Text>
            <TouchableOpacity style={styles.goToConversation} onPress={() => navigation.navigate("Chat")}>
                <Text style={styles.centerText}>
                    Practice Your German!
                </Text>
            </TouchableOpacity>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "black",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "ui-rounded"
    },
    goToConversation: {
        backgroundColor: "white",
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25
    },
    centerText: {
        textAlign: "center",
        fontFamily: FONT_FAMILY
    },
    headerText: {
        color: "white",
        fontSize: 20,
        marginBottom: 30,
        textAlign: "center",
        fontFamily: FONT_FAMILY
    }
})

export default Home;