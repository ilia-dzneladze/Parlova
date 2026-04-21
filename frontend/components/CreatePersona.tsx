import React, { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import uuid from "react-native-uuid";
import { insertPersona } from "../src/db/database";
import { Persona } from "../src/types/persona";
import { RootStackParamList } from "../src/types/navigation";
import { COLORS, FONTS, RADIUS, SIZES, SPACING } from "../constants/theme";

const AVATAR_COLORS = [
    "#E05C6E",
    "#D4774A",
    "#C9A227",
    "#5BAD7F",
    "#4A8FC4",
    "#7B6FC4",
    "#C46FA0",
    "#6B7280",
];

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

const FREQ_OPTIONS: { label: string; sublabel: string; value: number }[] = [
    { label: "Quiet",    sublabel: "Rarely asks questions",  value: 0.3 },
    { label: "Balanced", sublabel: "Asks sometimes",         value: 0.55 },
    { label: "Curious",  sublabel: "Always wants to know",   value: 0.85 },
];

export default function CreatePersona() {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [level, setLevel] = useState<typeof LEVELS[number]>("A1");
    const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
    const [questionFreq, setQuestionFreq] = useState(0.55);

    const canSave = name.trim().length > 0 && description.trim().length > 0;

    async function handleSave() {
        if (!canSave) return;
        const persona: Persona = {
            id: uuid.v4() as string,
            name: name.trim(),
            description: description.trim(),
            level,
            questionFreq,
            avatarColor,
            source: "user",
            globalId: null,
        };
        await insertPersona(persona);
        navigation.goBack();
    }

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={26} color={COLORS.ink} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Character</Text>
                <View style={{ width: 26 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={0}
            >
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.avatarRow}>
                        <View style={[styles.avatarPreview, { backgroundColor: avatarColor }]}>
                            <Text style={styles.avatarInitial}>
                                {name.trim()[0]?.toUpperCase() ?? "?"}
                            </Text>
                        </View>
                        <View style={styles.colorPicker}>
                            {AVATAR_COLORS.map((c) => (
                                <TouchableOpacity
                                    key={c}
                                    style={[
                                        styles.colorSwatch,
                                        { backgroundColor: c },
                                        avatarColor === c && styles.colorSwatchSelected,
                                    ]}
                                    onPress={() => setAvatarColor(c)}
                                    activeOpacity={0.8}
                                />
                            ))}
                        </View>
                    </View>

                    <Text style={styles.label}>Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Marco, Sophie…"
                        placeholderTextColor={COLORS.inkSubtle}
                        value={name}
                        onChangeText={setName}
                        maxLength={40}
                        returnKeyType="next"
                    />

                    <Text style={styles.label}>About them</Text>
                    <Text style={styles.hint}>
                        Describe who they are — age, where they live, hobbies, personality. The richer the description, the more consistent the conversation.
                    </Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder={"e.g. Marco is a 26-year-old Italian barista living in Munich. He's laid-back, loves football, and is learning to cook his grandmother's recipes…"}
                        placeholderTextColor={COLORS.inkSubtle}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        textAlignVertical="top"
                    />

                    <Text style={styles.label}>Language Level</Text>
                    <View style={styles.segmentRow}>
                        {LEVELS.map((l) => (
                            <TouchableOpacity
                                key={l}
                                style={[styles.segmentBtn, level === l && styles.segmentBtnActive]}
                                onPress={() => setLevel(l)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.segmentText, level === l && styles.segmentTextActive]}>
                                    {l}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.label}>Conversation Style</Text>
                    <View style={styles.freqRow}>
                        {FREQ_OPTIONS.map((opt) => (
                            <TouchableOpacity
                                key={opt.label}
                                style={[styles.freqBtn, questionFreq === opt.value && styles.freqBtnActive]}
                                onPress={() => setQuestionFreq(opt.value)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.freqLabel, questionFreq === opt.value && styles.freqLabelActive]}>
                                    {opt.label}
                                </Text>
                                <Text style={[styles.freqSub, questionFreq === opt.value && styles.freqSubActive]}>
                                    {opt.sublabel}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={!canSave}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.saveBtnText}>Save Character</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.surface },

    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: SPACING[4],
        height: 52,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    headerTitle: { fontFamily: FONTS.displaySemi, fontSize: SIZES.lg, color: COLORS.ink },

    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: SPACING[4],
        paddingTop: SPACING[5],
        paddingBottom: SPACING[8],
        gap: SPACING[1],
    },

    avatarRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING[4],
        marginBottom: SPACING[4],
    },
    avatarPreview: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarInitial: { fontFamily: FONTS.displayBold, fontSize: SIZES["3xl"], color: COLORS.white },
    colorPicker: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: SPACING[2] },
    colorSwatch: { width: 30, height: 30, borderRadius: 15 },
    colorSwatchSelected: { borderWidth: 3, borderColor: COLORS.ink },

    label: {
        fontFamily: FONTS.sansSemi,
        fontSize: SIZES.sm,
        color: COLORS.inkMuted,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        marginTop: SPACING[4],
        marginBottom: SPACING[1],
    },
    hint: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.inkSubtle,
        lineHeight: 20,
        marginBottom: SPACING[2],
    },
    input: {
        borderWidth: 1,
        borderColor: COLORS.borderInput,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING[3],
        paddingVertical: SPACING[2] + 2,
        fontFamily: FONTS.sans,
        fontSize: SIZES.base,
        color: COLORS.ink,
        backgroundColor: COLORS.surface,
    },
    textArea: { minHeight: 130, paddingTop: SPACING[3], lineHeight: 22 },

    segmentRow: { flexDirection: "row", gap: SPACING[2], marginTop: SPACING[1] },
    segmentBtn: {
        flex: 1,
        paddingVertical: SPACING[2] + 2,
        borderRadius: RADIUS.md,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        alignItems: "center",
    },
    segmentBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryPale },
    segmentText: { fontFamily: FONTS.sansSemi, fontSize: SIZES.sm, color: COLORS.inkMuted },
    segmentTextActive: { color: COLORS.primary },

    freqRow: { flexDirection: "row", gap: SPACING[2], marginTop: SPACING[1] },
    freqBtn: {
        flex: 1,
        paddingVertical: SPACING[3],
        paddingHorizontal: SPACING[2],
        borderRadius: RADIUS.md,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        alignItems: "center",
        gap: 3,
    },
    freqBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryPale },
    freqLabel: { fontFamily: FONTS.sansSemi, fontSize: SIZES.sm, color: COLORS.inkMuted },
    freqLabelActive: { color: COLORS.primary },
    freqSub: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.inkSubtle, textAlign: "center" },
    freqSubActive: { color: COLORS.primaryDark },

    footer: {
        paddingHorizontal: SPACING[4],
        paddingVertical: SPACING[4],
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.border,
        backgroundColor: COLORS.surface,
    },
    saveBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.lg,
        paddingVertical: SPACING[3] + 2,
        alignItems: "center",
    },
    saveBtnDisabled: { opacity: 0.4 },
    saveBtnText: { fontFamily: FONTS.sansBold, fontSize: SIZES.base, color: COLORS.white },
});
