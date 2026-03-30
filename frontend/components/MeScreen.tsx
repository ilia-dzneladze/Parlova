import React from "react";
import { StyleSheet, Text, View } from "react-native";

const MeScreen = () => (
    <View style={styles.root}>
        <Text style={styles.text}>Me</Text>
    </View>
);

export default MeScreen;

const styles = StyleSheet.create({
    root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF" },
    text: { fontSize: 28, fontWeight: "600", color: "#000" },
});
