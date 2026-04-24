import React, { useCallback, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import {
    getAllDictEntries,
    getAllSavedSentences,
    deleteSavedSentence,
    DictEntry,
    SavedSentence,
} from "../src/db/database";
import { COLORS, FONTS, RADIUS, SIZES, SPACING } from "../constants/theme";

type Tab = "words" | "sentences";

const WordList = () => {
    const navigator = useNavigation();
    const [tab, setTab] = useState<Tab>("words");
    const [entries, setEntries] = useState<DictEntry[]>([]);
    const [sentences, setSentences] = useState<SavedSentence[]>([]);
    const [expanded, setExpanded] = useState<string | null>(null);

    const reload = useCallback(() => {
        getAllDictEntries().then(setEntries);
        getAllSavedSentences().then(setSentences);
    }, []);

    useFocusEffect(
        useCallback(() => {
            reload();
        }, [reload])
    );

    const toggle = (key: string) => {
        setExpanded(prev => prev === key ? null : key);
    };

    const handleDeleteSentence = (id: string) => {
        Alert.alert("Delete sentence", "Remove this saved translation?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    await deleteSavedSentence(id);
                    reload();
                },
            },
        ]);
    };

    const renderWord = ({ item }: { item: DictEntry }) => {
        const isOpen = expanded === `w:${item.word}`;
        const translations: string[] = JSON.parse(item.translations);
        return (
            <TouchableOpacity
                style={styles.row}
                onPress={() => toggle(`w:${item.word}`)}
                activeOpacity={0.6}
            >
                <View style={styles.rowHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.word}>{item.word}</Text>
                        {!isOpen && (
                            <Text style={styles.preview} numberOfLines={1}>
                                {translations.slice(0, 2).join(", ")}
                            </Text>
                        )}
                    </View>
                    <View style={styles.metaRow}>
                        {item.gender && <Text style={styles.badge}>{item.gender}</Text>}
                        {item.partOfSpeech && <Text style={styles.badge}>{item.partOfSpeech}</Text>}
                        <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={COLORS.inkSubtle} />
                    </View>
                </View>
                {isOpen && (
                    <View style={styles.detail}>
                        {translations.map((t, i) => (
                            <View key={i} style={styles.transRow}>
                                <Text style={styles.bullet}>•</Text>
                                <Text style={styles.transText}>{t}</Text>
                            </View>
                        ))}
                        {item.example && (
                            <View style={styles.exampleBox}>
                                <Text style={styles.exampleLabel}>Example</Text>
                                <Text style={styles.exampleText}>{item.example}</Text>
                            </View>
                        )}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderSentence = ({ item }: { item: SavedSentence }) => {
        const isOpen = expanded === `s:${item.id}`;
        return (
            <TouchableOpacity
                style={styles.row}
                onPress={() => toggle(`s:${item.id}`)}
                onLongPress={() => handleDeleteSentence(item.id)}
                activeOpacity={0.6}
            >
                <View style={styles.rowHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.sentenceSource} numberOfLines={isOpen ? undefined : 2}>
                            {item.sourceText}
                        </Text>
                        {!isOpen && (
                            <Text style={styles.preview} numberOfLines={1}>
                                {item.translation}
                            </Text>
                        )}
                    </View>
                    <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={COLORS.inkSubtle} />
                </View>
                {isOpen && (
                    <View style={styles.detail}>
                        <Text style={styles.exampleLabel}>
                            {item.sourceLang.toUpperCase()} → {item.targetLang.toUpperCase()}
                        </Text>
                        <Text style={styles.transText}>{item.translation}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const showWords = tab === "words";
    const list = showWords ? entries : sentences;
    const isEmpty = list.length === 0;

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigator.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={28} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My library</Text>
                <View style={{ width: 36 }} />
            </View>

            <View style={styles.tabBar}>
                <TouchableOpacity
                    style={[styles.tab, showWords && styles.tabActive]}
                    onPress={() => { setTab("words"); setExpanded(null); }}
                >
                    <Text style={[styles.tabText, showWords && styles.tabTextActive]}>
                        Words ({entries.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, !showWords && styles.tabActive]}
                    onPress={() => { setTab("sentences"); setExpanded(null); }}
                >
                    <Text style={[styles.tabText, !showWords && styles.tabTextActive]}>
                        Sentences ({sentences.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {isEmpty ? (
                <View style={styles.empty}>
                    <Ionicons
                        name={showWords ? "book-outline" : "chatbox-ellipses-outline"}
                        size={48}
                        color={COLORS.inkSubtle}
                    />
                    <Text style={styles.emptyText}>
                        {showWords ? "No words yet" : "No sentences yet"}
                    </Text>
                    <Text style={styles.emptyHint}>
                        {showWords
                            ? "Words you tap in chat will appear here."
                            : "Saved sentence translations will appear here."}
                    </Text>
                </View>
            ) : showWords ? (
                <FlatList
                    data={entries}
                    keyExtractor={(item) => item.word}
                    renderItem={renderWord}
                    contentContainerStyle={styles.list}
                />
            ) : (
                <FlatList
                    data={sentences}
                    keyExtractor={(item) => item.id}
                    renderItem={renderSentence}
                    contentContainerStyle={styles.list}
                />
            )}
        </SafeAreaView>
    );
};

export default WordList;

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bg },
    header: {
        height: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: SPACING[1],
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.bg,
    },
    backBtn: { padding: SPACING[1] },
    headerTitle: {
        fontFamily: FONTS.displaySemi,
        fontSize: 17,
        color: COLORS.ink,
    },
    tabBar: {
        flexDirection: "row",
        backgroundColor: COLORS.primaryPale,
        borderRadius: RADIUS.md,
        padding: 3,
        marginHorizontal: SPACING[4],
        marginTop: SPACING[3],
        marginBottom: SPACING[1],
    },
    tab: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.md, alignItems: "center" },
    tabActive: {
        backgroundColor: COLORS.surface,
        shadowColor: COLORS.ink,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    tabText: { fontFamily: FONTS.sansMedium, fontSize: 14, color: COLORS.inkMuted },
    tabTextActive: { color: COLORS.ink },
    list: { padding: SPACING[4], paddingBottom: SPACING[10] },
    row: {
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: SPACING[2],
        padding: SPACING[4],
    },
    rowHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    word: {
        fontFamily: FONTS.displaySemi,
        fontSize: SIZES.lg,
        color: COLORS.ink,
    },
    sentenceSource: {
        fontFamily: FONTS.sansMedium,
        fontSize: SIZES.base,
        color: COLORS.ink,
        lineHeight: 22,
    },
    preview: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.inkMuted,
        marginTop: 2,
    },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    badge: {
        fontFamily: FONTS.sansSemi,
        fontSize: 11,
        color: COLORS.primaryDark,
        backgroundColor: COLORS.primaryPale,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: RADIUS.pill,
        overflow: "hidden",
        letterSpacing: 0.4,
        textTransform: "uppercase",
    },
    detail: { marginTop: SPACING[3] },
    transRow: { flexDirection: "row", gap: 6, marginBottom: 3 },
    bullet: { fontSize: 16, color: COLORS.primary, lineHeight: 22 },
    transText: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.base,
        color: COLORS.ink,
        lineHeight: 22,
        flex: 1,
    },
    exampleBox: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.border,
        paddingTop: SPACING[3],
        marginTop: SPACING[2],
    },
    exampleLabel: {
        fontFamily: FONTS.sansSemi,
        fontSize: SIZES.xs,
        color: COLORS.primary,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 4,
    },
    exampleText: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.ink,
        fontStyle: "italic",
        lineHeight: 20,
    },
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: SPACING[2],
    },
    emptyText: {
        fontFamily: FONTS.displaySemi,
        fontSize: SIZES.lg,
        color: COLORS.inkMuted,
    },
    emptyHint: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.inkMuted,
        textAlign: "center",
        paddingHorizontal: SPACING[10],
    },
});
