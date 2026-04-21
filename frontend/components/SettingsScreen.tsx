import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, RADIUS, SIZES, SPACING } from "../constants/theme";

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
                                    <Ionicons name="checkmark" size={22} color={COLORS.primary} />
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
    safe: { flex: 1, backgroundColor: COLORS.bg },
    header: {
        paddingHorizontal: SPACING[4],
        paddingTop: SPACING[2],
        paddingBottom: SPACING[2],
        backgroundColor: COLORS.bg,
    },
    headerTitle: {
        fontFamily: FONTS.displayBold,
        fontSize: SIZES["4xl"],
        color: COLORS.ink,
        letterSpacing: -0.8,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: SPACING[10] },
    sectionHeader: {
        fontFamily: FONTS.sansSemi,
        fontSize: SIZES.xs,
        color: COLORS.primary,
        paddingHorizontal: SPACING[4],
        paddingTop: SPACING[6],
        paddingBottom: SPACING[2],
        letterSpacing: 1.2,
    },
    group: {
        marginHorizontal: SPACING[4],
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: "hidden",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: SPACING[3],
        paddingHorizontal: SPACING[4],
        minHeight: 48,
    },
    rowBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    rowLabel: {
        fontFamily: FONTS.sansMedium,
        fontSize: SIZES.base,
        color: COLORS.ink,
    },
    sectionFooter: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.inkMuted,
        paddingHorizontal: SPACING[4],
        paddingTop: SPACING[2],
        lineHeight: 20,
    },
});
