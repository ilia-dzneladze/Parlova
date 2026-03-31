import React from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { RootStackParamList } from "../src/types/navigation";
import { clearDictCache, resetDictionaryUsageToday } from "../src/db/database";

const MeScreen = () => {
    const navigator = useNavigation<NavigationProp<RootStackParamList>>();

    const handleClearWords = () => {
        Alert.alert(
            "Clear All Words",
            "This will permanently delete all saved dictionary words.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: async () => {
                        await clearDictCache();
                        Alert.alert("Done", "Dictionary cleared.");
                    },
                },
            ],
        );
    };

    const handleResetUsage = () => {
        Alert.alert(
            "Reset Daily Lookups",
            "This will reset today's lookup count back to 0.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset",
                    style: "destructive",
                    onPress: async () => {
                        await resetDictionaryUsageToday();
                        Alert.alert("Done", "Daily lookups reset.");
                    },
                },
            ],
        );
    };

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Me</Text>
            </View>

            <ScrollView style={styles.content}>
                <Text style={styles.sectionHeader}>LEARNING</Text>
                <View style={styles.group}>
                    <TouchableOpacity
                        style={styles.row}
                        onPress={() => navigator.navigate("WordList")}
                        activeOpacity={0.5}
                    >
                        <View style={styles.rowLeft}>
                            <Ionicons name="book-outline" size={22} color="#007AFF" />
                            <Text style={styles.rowLabel}>My Words</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.sectionFooter}>
                    All the words you've looked up in the dictionary.
                </Text>

                <Text style={styles.sectionHeader}>DATA</Text>
                <View style={styles.group}>
                    <TouchableOpacity
                        style={[styles.row, styles.rowBorder]}
                        onPress={handleResetUsage}
                        activeOpacity={0.5}
                    >
                        <View style={styles.rowLeft}>
                            <Ionicons name="refresh-outline" size={22} color="#007AFF" />
                            <Text style={styles.rowLabel}>Reset Daily Lookups</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.row}
                        onPress={handleClearWords}
                        activeOpacity={0.5}
                    >
                        <View style={styles.rowLeft}>
                            <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                            <Text style={[styles.rowLabel, { color: "#FF3B30" }]}>Clear All Words</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default MeScreen;

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#F2F2F7" },
    header: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: "#F2F2F7",
    },
    headerTitle: { fontSize: 34, fontWeight: "700", color: "#000" },
    content: { flex: 1 },
    sectionHeader: {
        fontSize: 13,
        fontWeight: "400",
        color: "#6D6D72",
        paddingHorizontal: 16,
        paddingTop: 24,
        paddingBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    group: {
        marginHorizontal: 16,
        backgroundColor: "#FFF",
        borderRadius: 10,
        overflow: "hidden",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 44,
    },
    rowBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#C6C6C8",
    },
    rowLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    rowLabel: { fontSize: 17, color: "#000" },
    sectionFooter: {
        fontSize: 13,
        color: "#6D6D72",
        paddingHorizontal: 16,
        paddingTop: 8,
        lineHeight: 18,
    },
});
