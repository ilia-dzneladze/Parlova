import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const MODELS = [
    { label: "Llama 4 Scout (17B)", value: "meta-llama/llama-4-scout-17b-16e-instruct" },
    { label: "Qwen 3 (32B)", value: "qwen/qwen3-32b" },
];

const SettingsScreen = () => {
    const [selectedModel, setSelectedModel] = useState(MODELS[0].value);

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Settings</Text>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {/* Model Selection */}
                <Text style={styles.sectionHeader}>MODEL</Text>
                <View style={styles.group}>
                    {MODELS.map((model, i) => {
                        const isSelected = selectedModel === model.value;
                        const isLast = i === MODELS.length - 1;
                        return (
                            <TouchableOpacity
                                key={model.value}
                                style={[styles.row, !isLast && styles.rowBorder]}
                                onPress={() => setSelectedModel(model.value)}
                                activeOpacity={0.5}
                            >
                                <Text style={styles.rowLabel}>{model.label}</Text>
                                {isSelected && (
                                    <Ionicons name="checkmark" size={22} color="#007AFF" />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <Text style={styles.sectionFooter}>
                    Choose the LLM that powers your conversations. Larger models are slower but may produce better responses.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
};

export default SettingsScreen;

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: "#F2F2F7",
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: "#F2F2F7",
    },
    headerTitle: {
        fontSize: 34,
        fontWeight: "700",
        color: "#000",
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
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
    rowLabel: {
        fontSize: 17,
        color: "#000",
    },
    sectionFooter: {
        fontSize: 13,
        color: "#6D6D72",
        paddingHorizontal: 16,
        paddingTop: 8,
        lineHeight: 18,
    },
});
