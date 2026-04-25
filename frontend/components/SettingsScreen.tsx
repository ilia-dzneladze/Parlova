import React, { useEffect, useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, RADIUS, SIZES, SPACING } from "../constants/theme";
import { DEFAULT_MODEL, MODELS, modelLabel } from "../src/utils/models";
import { getSetting, setSetting } from "../src/db/database";

const MODEL_KEY = "selected_model";

const SettingsScreen = () => {
    const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
    const [pickerOpen, setPickerOpen] = useState(false);

    useEffect(() => {
        (async () => {
            const stored = await getSetting(MODEL_KEY);
            if (stored && MODELS.some((m) => m.value === stored)) {
                setSelectedModel(stored);
            } else {
                await setSetting(MODEL_KEY, DEFAULT_MODEL);
            }
        })();
    }, []);

    const choose = async (value: string) => {
        setSelectedModel(value);
        setPickerOpen(false);
        await setSetting(MODEL_KEY, value);
    };

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Settings</Text>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.sectionHeader}>MODEL</Text>
                <View style={styles.group}>
                    <TouchableOpacity
                        style={styles.row}
                        onPress={() => setPickerOpen(true)}
                        activeOpacity={0.5}
                    >
                        <Text style={styles.rowLabel}>Conversation model</Text>
                        <View style={styles.rowValue}>
                            <Text style={styles.rowValueText} numberOfLines={1}>
                                {modelLabel(selectedModel)}
                            </Text>
                            <Ionicons name="chevron-down" size={18} color={COLORS.inkMuted} />
                        </View>
                    </TouchableOpacity>
                </View>
                <Text style={styles.sectionFooter}>
                    Choose the LLM that powers your conversations. Larger models are slower but may produce better responses.
                </Text>
            </ScrollView>

            <Modal
                visible={pickerOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setPickerOpen(false)}
            >
                <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
                    <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>Conversation model</Text>
                        {MODELS.map((m, i) => {
                            const isSelected = m.value === selectedModel;
                            const isLast = i === MODELS.length - 1;
                            return (
                                <TouchableOpacity
                                    key={m.value}
                                    onPress={() => choose(m.value)}
                                    activeOpacity={0.5}
                                    style={[styles.option, !isLast && styles.optionBorder]}
                                >
                                    <View style={{ flex: 1, paddingRight: SPACING[3] }}>
                                        <Text style={styles.optionLabel}>{m.label}</Text>
                                        {m.description && (
                                            <Text style={styles.optionDesc}>{m.description}</Text>
                                        )}
                                    </View>
                                    {isSelected && (
                                        <Ionicons name="checkmark" size={22} color={COLORS.primary} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </Pressable>
                </Pressable>
            </Modal>
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
    rowLabel: {
        fontFamily: FONTS.sansMedium,
        fontSize: SIZES.base,
        color: COLORS.ink,
    },
    rowValue: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING[1],
        maxWidth: "60%",
    },
    rowValueText: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.base,
        color: COLORS.inkMuted,
    },
    sectionFooter: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.inkMuted,
        paddingHorizontal: SPACING[4],
        paddingTop: SPACING[2],
        lineHeight: 20,
    },
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
    },
    sheet: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
        paddingHorizontal: SPACING[4],
        paddingTop: SPACING[2],
        paddingBottom: SPACING[8],
    },
    sheetHandle: {
        alignSelf: "center",
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.border,
        marginBottom: SPACING[3],
    },
    sheetTitle: {
        fontFamily: FONTS.sansSemi,
        fontSize: SIZES.lg,
        color: COLORS.ink,
        paddingVertical: SPACING[2],
    },
    option: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: SPACING[3],
    },
    optionBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    optionLabel: {
        fontFamily: FONTS.sansMedium,
        fontSize: SIZES.base,
        color: COLORS.ink,
    },
    optionDesc: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.inkMuted,
        marginTop: 2,
    },
});
