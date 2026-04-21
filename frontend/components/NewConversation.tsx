import React, { useState, useEffect, useRef } from "react";
import {
    Animated,
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
import { getPersonas, insertPersona, insertConversation } from "../src/db/database";
import { Persona } from "../src/types/persona";
import { RootStackParamList } from "../src/types/navigation";
import { DEFAULT_GREETING } from "../src/utils/chat";
import { COLORS, FONTS, RADIUS, SIZES, SPACING } from "../constants/theme";

const SCENARIO_PRESETS = [
    "Just Chatting",
    "Job Interview",
    "At a Café",
    "Doctor's Appointment",
    "Meeting the Neighbours",
    "At a Restaurant",
    "First Day at Work",
];

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
    { label: "Quiet",    sublabel: "Rarely asks",    value: 0.3 },
    { label: "Balanced", sublabel: "Asks sometimes", value: 0.55 },
    { label: "Curious",  sublabel: "Always asks",    value: 0.85 },
];

export default function NewConversation() {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();

    const [personas, setPersonas] = useState<Persona[]>([]);
    const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);

    const [scenario, setScenario] = useState("Just Chatting");
    const [customScenario, setCustomScenario] = useState("");
    const [isCustom, setIsCustom] = useState(false);

    // New persona fields
    const [newName, setNewName] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newLevel, setNewLevel] = useState<typeof LEVELS[number]>("A1");
    const [newAvatarColor, setNewAvatarColor] = useState(AVATAR_COLORS[0]);
    const [newQuestionFreq, setNewQuestionFreq] = useState(0.55);

    const expandAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        getPersonas().then(setPersonas);
    }, []);

    useEffect(() => {
        Animated.timing(expandAnim, {
            toValue: isAddingNew ? 1 : 0,
            duration: 220,
            useNativeDriver: false,
        }).start();
    }, [isAddingNew]);

    const activeScenario = isCustom ? customScenario.trim() : scenario;
    const newPersonaReady = isAddingNew && newName.trim().length > 0 && newDescription.trim().length > 0;
    const existingPersonaReady = !isAddingNew && selectedPersonaId !== null;
    const canStart = activeScenario.length > 0 && (newPersonaReady || existingPersonaReady);

    function selectPreset(preset: string) {
        setScenario(preset);
        setIsCustom(false);
    }

    function selectCustom() {
        setIsCustom(true);
        setScenario("");
    }

    function toggleAddNew() {
        if (isAddingNew) {
            setIsAddingNew(false);
            setSelectedPersonaId(null);
        } else {
            setIsAddingNew(true);
            setSelectedPersonaId(null);
        }
    }

    function selectExistingPersona(id: string) {
        setSelectedPersonaId(id);
        setIsAddingNew(false);
    }

    async function handleStart() {
        if (!canStart) return;

        let persona: Persona;

        if (isAddingNew) {
            persona = {
                id: uuid.v4() as string,
                name: newName.trim(),
                description: newDescription.trim(),
                level: newLevel,
                questionFreq: newQuestionFreq,
                avatarColor: newAvatarColor,
                source: "user",
                globalId: null,
            };
            await insertPersona(persona);
        } else {
            persona = personas.find(p => p.id === selectedPersonaId)!;
        }

        const conversationId = uuid.v4() as string;
        await insertConversation({
            id: conversationId,
            name: persona.name,
            avatarColor: persona.avatarColor,
            level: persona.level,
            personaId: persona.id,
            scenario: activeScenario,
            lastMessage: DEFAULT_GREETING,
            timestamp: "Now",
            unread: true,
        });

        navigation.navigate("Chat", { conversationId, conversationName: persona.name });
    }

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={26} color={COLORS.ink} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Conversation</Text>
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
                    {/* ── Scenario ── */}
                    <Text style={styles.sectionLabel}>Scenario</Text>
                    <Text style={styles.sectionHint}>
                        Set the context for this conversation. The character will stay in it naturally.
                    </Text>

                    <View style={styles.chipsWrap}>
                        {SCENARIO_PRESETS.map((preset) => (
                            <TouchableOpacity
                                key={preset}
                                style={[styles.chip, !isCustom && scenario === preset && styles.chipActive]}
                                onPress={() => selectPreset(preset)}
                                activeOpacity={0.75}
                            >
                                <Text style={[styles.chipText, !isCustom && scenario === preset && styles.chipTextActive]}>
                                    {preset}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={[styles.chip, isCustom && styles.chipActive]}
                            onPress={selectCustom}
                            activeOpacity={0.75}
                        >
                            <Text style={[styles.chipText, isCustom && styles.chipTextActive]}>Custom…</Text>
                        </TouchableOpacity>
                    </View>

                    {isCustom && (
                        <TextInput
                            style={[styles.input, styles.textArea, { marginTop: SPACING[2] }]}
                            placeholder={"e.g. You are a grumpy landlord showing an apartment. It's raining outside and you want to leave early."}
                            placeholderTextColor={COLORS.inkSubtle}
                            value={customScenario}
                            onChangeText={setCustomScenario}
                            multiline
                            textAlignVertical="top"
                            autoFocus
                        />
                    )}

                    {/* ── Character ── */}
                    <Text style={[styles.sectionLabel, { marginTop: SPACING[6] }]}>Character</Text>
                    <Text style={styles.sectionHint}>
                        Choose who you want to chat with. The same character can be reused across different conversations.
                    </Text>

                    {personas.map((p) => {
                        const selected = selectedPersonaId === p.id;
                        return (
                            <TouchableOpacity
                                key={p.id}
                                style={[styles.personaCard, selected && styles.personaCardSelected]}
                                onPress={() => selectExistingPersona(p.id)}
                                activeOpacity={0.75}
                            >
                                <View style={[styles.personaAvatar, { backgroundColor: p.avatarColor }]}>
                                    <Text style={styles.personaAvatarText}>{p.name[0].toUpperCase()}</Text>
                                </View>
                                <View style={styles.personaInfo}>
                                    <Text style={styles.personaName}>{p.name}</Text>
                                    <Text style={styles.personaLevel}>{p.level}</Text>
                                </View>
                                {selected && (
                                    <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                                )}
                            </TouchableOpacity>
                        );
                    })}

                    {/* Add New */}
                    <TouchableOpacity
                        style={[styles.addNewCard, isAddingNew && styles.addNewCardActive]}
                        onPress={toggleAddNew}
                        activeOpacity={0.75}
                    >
                        <Ionicons
                            name={isAddingNew ? "remove-circle-outline" : "add-circle-outline"}
                            size={22}
                            color={isAddingNew ? COLORS.inkMuted : COLORS.primary}
                        />
                        <Text style={[styles.addNewText, isAddingNew && styles.addNewTextActive]}>
                            {isAddingNew ? "Cancel" : "Add New"}
                        </Text>
                    </TouchableOpacity>

                    {/* Inline new persona form */}
                    <Animated.View style={{ opacity: expandAnim, overflow: "hidden" }}>
                        {isAddingNew && (
                            <View style={styles.newPersonaForm}>
                                {/* Avatar preview + color picker */}
                                <View style={styles.avatarRow}>
                                    <View style={[styles.avatarPreview, { backgroundColor: newAvatarColor }]}>
                                        <Text style={styles.avatarInitial}>
                                            {newName.trim()[0]?.toUpperCase() ?? "?"}
                                        </Text>
                                    </View>
                                    <View style={styles.colorPicker}>
                                        {AVATAR_COLORS.map((c) => (
                                            <TouchableOpacity
                                                key={c}
                                                style={[
                                                    styles.colorSwatch,
                                                    { backgroundColor: c },
                                                    newAvatarColor === c && styles.colorSwatchSelected,
                                                ]}
                                                onPress={() => setNewAvatarColor(c)}
                                                activeOpacity={0.8}
                                            />
                                        ))}
                                    </View>
                                </View>

                                <Text style={styles.fieldLabel}>Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Marco, Sophie…"
                                    placeholderTextColor={COLORS.inkSubtle}
                                    value={newName}
                                    onChangeText={setNewName}
                                    maxLength={40}
                                    returnKeyType="next"
                                />

                                <Text style={styles.fieldLabel}>About them</Text>
                                <Text style={styles.fieldHint}>
                                    Age, where they live, personality, quirks. The richer the description, the more consistent the character.
                                </Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    placeholder={"e.g. Marco is a 26-year-old Italian barista living in Munich. He's laid-back, loves football, and is learning to cook his grandmother's recipes…"}
                                    placeholderTextColor={COLORS.inkSubtle}
                                    value={newDescription}
                                    onChangeText={setNewDescription}
                                    multiline
                                    textAlignVertical="top"
                                />

                                <Text style={styles.fieldLabel}>Language Level</Text>
                                <View style={styles.segmentRow}>
                                    {LEVELS.map((l) => (
                                        <TouchableOpacity
                                            key={l}
                                            style={[styles.segmentBtn, newLevel === l && styles.segmentBtnActive]}
                                            onPress={() => setNewLevel(l)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[styles.segmentText, newLevel === l && styles.segmentTextActive]}>
                                                {l}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.fieldLabel}>Conversation Style</Text>
                                <View style={styles.freqRow}>
                                    {FREQ_OPTIONS.map((opt) => (
                                        <TouchableOpacity
                                            key={opt.label}
                                            style={[styles.freqBtn, newQuestionFreq === opt.value && styles.freqBtnActive]}
                                            onPress={() => setNewQuestionFreq(opt.value)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[styles.freqLabel, newQuestionFreq === opt.value && styles.freqLabelActive]}>
                                                {opt.label}
                                            </Text>
                                            <Text style={[styles.freqSub, newQuestionFreq === opt.value && styles.freqSubActive]}>
                                                {opt.sublabel}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}
                    </Animated.View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
                        onPress={handleStart}
                        disabled={!canStart}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.startBtnText}>Start Chatting</Text>
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
    },

    sectionLabel: {
        fontFamily: FONTS.sansSemi,
        fontSize: SIZES.sm,
        color: COLORS.inkMuted,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        marginBottom: SPACING[1],
    },
    sectionHint: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.inkSubtle,
        lineHeight: 20,
        marginBottom: SPACING[3],
    },

    // Scenario chips
    chipsWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: SPACING[2],
    },
    chip: {
        paddingHorizontal: SPACING[3],
        paddingVertical: SPACING[2],
        borderRadius: RADIUS.pill,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
    },
    chipActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryPale,
    },
    chipText: {
        fontFamily: FONTS.sansMedium,
        fontSize: SIZES.sm,
        color: COLORS.inkMuted,
    },
    chipTextActive: {
        color: COLORS.primary,
    },

    // Inputs
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
    textArea: {
        minHeight: 110,
        paddingTop: SPACING[3],
        lineHeight: 22,
    },

    // Persona cards
    personaCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING[3],
        padding: SPACING[3],
        borderRadius: RADIUS.md,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        marginBottom: SPACING[2],
    },
    personaCardSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryPale,
    },
    personaAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
    },
    personaAvatarText: {
        fontFamily: FONTS.displayBold,
        fontSize: SIZES.lg,
        color: COLORS.white,
    },
    personaInfo: { flex: 1 },
    personaName: { fontFamily: FONTS.sansSemi, fontSize: SIZES.base, color: COLORS.ink },
    personaLevel: { fontFamily: FONTS.sans, fontSize: SIZES.sm, color: COLORS.inkMuted, marginTop: 2 },

    // Add New row
    addNewCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING[2],
        padding: SPACING[3],
        borderRadius: RADIUS.md,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderStyle: "dashed",
        backgroundColor: COLORS.surface,
        marginBottom: SPACING[2],
    },
    addNewCardActive: {
        borderColor: COLORS.inkSubtle,
        borderStyle: "solid",
    },
    addNewText: {
        fontFamily: FONTS.sansMedium,
        fontSize: SIZES.base,
        color: COLORS.primary,
    },
    addNewTextActive: {
        color: COLORS.inkMuted,
    },

    // Inline new persona form
    newPersonaForm: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.md,
        padding: SPACING[4],
        backgroundColor: COLORS.bg,
        marginBottom: SPACING[2],
        gap: SPACING[1],
    },

    avatarRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING[4],
        marginBottom: SPACING[3],
    },
    avatarPreview: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarInitial: {
        fontFamily: FONTS.displayBold,
        fontSize: SIZES["2xl"],
        color: COLORS.white,
    },
    colorPicker: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: SPACING[2] },
    colorSwatch: { width: 28, height: 28, borderRadius: 14 },
    colorSwatchSelected: { borderWidth: 3, borderColor: COLORS.ink },

    fieldLabel: {
        fontFamily: FONTS.sansSemi,
        fontSize: SIZES.sm,
        color: COLORS.inkMuted,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        marginTop: SPACING[3],
        marginBottom: SPACING[1],
    },
    fieldHint: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.inkSubtle,
        lineHeight: 20,
        marginBottom: SPACING[2],
    },

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
    startBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.lg,
        paddingVertical: SPACING[3] + 2,
        alignItems: "center",
    },
    startBtnDisabled: { opacity: 0.4 },
    startBtnText: { fontFamily: FONTS.sansBold, fontSize: SIZES.base, color: COLORS.white },
});
