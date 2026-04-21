import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { getAllDictEntries, DictEntry } from "../src/db/database";
import { COLORS, FONTS, RADIUS, SIZES, SPACING } from "../constants/theme";

const WordList = () => {
    const navigator = useNavigation();
    const [entries, setEntries] = useState<DictEntry[]>([]);
    const [expanded, setExpanded] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            getAllDictEntries().then(setEntries);
        }, [])
    );

    const toggle = (word: string) => {
        setExpanded(prev => prev === word ? null : word);
    };

    const renderItem = ({ item }: { item: DictEntry }) => {
        const isOpen = expanded === item.word;
        const translations: string[] = JSON.parse(item.translations);
        return (
            <TouchableOpacity
                style={[styles.row, isOpen && styles.rowExpanded]}
                onPress={() => toggle(item.word)}
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

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigator.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={28} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My words</Text>
                <View style={{ width: 36 }} />
            </View>

            {entries.length === 0 ? (
                <View style={styles.empty}>
                    <Ionicons name="book-outline" size={48} color={COLORS.inkSubtle} />
                    <Text style={styles.emptyText}>No words yet</Text>
                    <Text style={styles.emptyHint}>Words you look up in chat will appear here.</Text>
                </View>
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={(item) => item.word}
                    renderItem={renderItem}
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
    list: { padding: SPACING[4], paddingBottom: SPACING[10] },
    row: {
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: SPACING[2],
        padding: SPACING[4],
    },
    rowExpanded: { backgroundColor: COLORS.surface },
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
