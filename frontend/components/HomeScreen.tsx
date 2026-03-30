import React from "react";
import { StyleSheet, Text, View } from "react-native";

const HomeScreen = () => (
    <View style={styles.root}>
        <Text style={styles.text}>Home</Text>
    </View>
);

export default HomeScreen;

const styles = StyleSheet.create({
    root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF" },
    text: { fontSize: 28, fontWeight: "600", color: "#000" },
});
