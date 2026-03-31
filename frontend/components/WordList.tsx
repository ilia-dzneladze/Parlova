import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { getAllDictEntries, DictEntry } from "../src/db/database";

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
                        <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color="#8E8E93" />
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
                    <Ionicons name="chevron-back" size={28} color="#007AFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Words</Text>
                <View style={{ width: 36 }} />
            </View>

            {entries.length === 0 ? (
                <View style={styles.empty}>
                    <Ionicons name="book-outline" size={48} color="#C7C7CC" />
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
    safe: { flex: 1, backgroundColor: "#F2F2F7" },
    header: {
        height: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#C6C6C8",
        backgroundColor: "#F2F2F7",
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 17, fontWeight: "600", color: "#000" },
    list: { padding: 16, paddingBottom: 40 },
    row: {
        backgroundColor: "#FFF",
        borderRadius: 12,
        marginBottom: 8,
        padding: 14,
    },
    rowExpanded: {
        backgroundColor: "#FFF",
    },
    rowHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    word: { fontSize: 18, fontWeight: "600", color: "#000" },
    preview: { fontSize: 14, color: "#8E8E93", marginTop: 2 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    badge: {
        fontSize: 11,
        color: "#007AFF",
        backgroundColor: "#E8F0FE",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: "hidden",
        fontWeight: "500",
    },
    detail: { marginTop: 12 },
    transRow: { flexDirection: "row", gap: 6, marginBottom: 3 },
    bullet: { fontSize: 16, color: "#007AFF", lineHeight: 22 },
    transText: { fontSize: 16, color: "#000", lineHeight: 22, flex: 1 },
    exampleBox: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#C6C6C8",
        paddingTop: 10,
        marginTop: 8,
    },
    exampleLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "#8E8E93",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    exampleText: {
        fontSize: 15,
        color: "#3C3C43",
        fontStyle: "italic",
        lineHeight: 20,
    },
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    emptyText: { fontSize: 18, fontWeight: "600", color: "#8E8E93" },
    emptyHint: { fontSize: 14, color: "#8E8E93", textAlign: "center", paddingHorizontal: 40 },
});
