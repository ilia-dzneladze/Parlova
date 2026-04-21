import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect, NavigationProp } from "@react-navigation/native";
import { Conversation } from "../src/types/conversation";
import { initDB, seedIfEmpty, getConversations, upsertPersona } from "../src/db/database";
import { Persona } from "../src/types/persona";
import { API_BASE, PERSONAS_API_KEY } from "../constants/api";
import { RootStackParamList } from "../src/types/navigation";
import { COLORS, FONTS, RADIUS, SIZES, SPACING } from "../constants/theme";

const ConversationRow = ({ item, isLast }: { item: Conversation; isLast: boolean }) => {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();

    return (
        <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            onPress={() => navigation.navigate("Chat", { conversationId: item.id, conversationName: item.name })}
        >
            {/* Unread dot */}
            <View style={styles.unreadCol}>
                {item.unread && <View style={styles.unreadDot} />}
            </View>

            {/* Avatar */}
            <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
                <Text style={styles.avatarText}>{item.name[0]}</Text>
            </View>

            {/* Text content */}
            <View style={[styles.textCol, !isLast && styles.separator]}>
                <View style={styles.topRow}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.time}>{item.timestamp}</Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>{item.lastMessage}</Text>
            </View>
        </TouchableOpacity>
    );
};


async function syncGlobalPersonas(): Promise<void> {
    try {
        const headers: Record<string, string> = { "ngrok-skip-browser-warning": "true" };
        if (PERSONAS_API_KEY) headers["x-api-key"] = PERSONAS_API_KEY;
        const resp = await fetch(`${API_BASE}/api/personas`, { headers });
        if (!resp.ok) return;
        const personas: Persona[] = await resp.json();
        for (const p of personas) await upsertPersona(p);
    } catch {
        // Silently fail — bundled defaults remain active
    }
}

const ConversationsList = () => {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            await initDB();
            await seedIfEmpty();
            const data = await getConversations();
            setConversations(data);
            setLoading(false);
            // Sync global personas from backend in the background
            syncGlobalPersonas();
        })();
    }, []);

    // Refresh conversations when screen regains focus (e.g. returning from Chat)
    useFocusEffect(
        useCallback(() => {
            if (!loading) {
                getConversations().then(setConversations);
            }
        }, [loading])
    );

    if (loading) {
        return (
            <SafeAreaView style={[styles.root, styles.center]}>
                <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />
                <ActivityIndicator size="large" color={COLORS.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => {}} /* TODO: edit action */>
                    <Text style={styles.editBtn}>Edit</Text>
                </TouchableOpacity>
                <View style={styles.headerRight}>
                    <TouchableOpacity onPress={() => navigation.navigate("ArchiveList")}>
                        <Ionicons name="archive-outline" size={22} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {}} /* TODO: compose action */>
                        <Ionicons name="create-outline" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>Messages</Text>

            {/* Search bar */}
            <View style={styles.searchWrap}>
                <TouchableOpacity style={styles.searchBar} activeOpacity={1} onPress={() => {}} /* TODO: search */>
                    <Ionicons name="search" size={16} color={COLORS.inkSubtle} />
                    <Text style={styles.searchPlaceholder}>Search</Text>
                </TouchableOpacity>
            </View>

            {/* Conversation list */}
            <FlatList
                data={conversations}
                keyExtractor={(c) => c.id}
                renderItem={({ item, index }) => (
                    <ConversationRow item={item} isLast={index === conversations.length - 1} />
                )}
                style={styles.list}
                ListFooterComponent={
                    <TouchableOpacity
                        style={styles.addUserBtn}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate("CreatePersona")}
                    >
                        <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                        <Text style={styles.addUserText}>Add Character</Text>
                    </TouchableOpacity>
                }
            />
        </SafeAreaView>
    );
};

export default ConversationsList;

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: COLORS.surface,
    },
    center: {
        alignItems: "center",
        justifyContent: "center",
    },

    /* Header */
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: SPACING[4],
        height: 44,
    },
    editBtn: {
        fontFamily: FONTS.sansMedium,
        fontSize: 17,
        color: COLORS.primary,
    },
    headerRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING[4],
    },

    /* Title */
    title: {
        fontFamily: FONTS.displayBold,
        fontSize: SIZES["4xl"],
        color: COLORS.ink,
        letterSpacing: -0.8,
        paddingHorizontal: SPACING[4],
        marginBottom: SPACING[2],
    },

    /* Search */
    searchWrap: {
        paddingHorizontal: SPACING[4],
        marginBottom: SPACING[2],
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.primaryPale,
        borderRadius: RADIUS.lg,
        paddingHorizontal: SPACING[2],
        height: 36,
        gap: 6,
    },
    searchPlaceholder: {
        fontFamily: FONTS.sans,
        fontSize: 16,
        color: COLORS.inkSubtle,
    },

    /* List */
    list: {
        flex: 1,
    },

    /* Add Character button */
    addUserBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING[2],
        paddingHorizontal: SPACING[4] + 20,
        paddingVertical: SPACING[4],
    },
    addUserText: {
        fontFamily: FONTS.sansMedium,
        fontSize: SIZES.base,
        color: COLORS.primary,
    },

    /* Row */
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingRight: SPACING[4],
        minHeight: 76,
    },

    /* Unread dot column */
    unreadCol: {
        width: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.primary,
    },

    /* Avatar */
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: {
        fontFamily: FONTS.displayBold,
        color: COLORS.white,
        fontSize: SIZES["2xl"],
    },

    /* Text column */
    textCol: {
        flex: 1,
        paddingLeft: SPACING[3],
        paddingVertical: SPACING[2],
        justifyContent: "center",
    },
    separator: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    topRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 2,
    },
    name: {
        fontFamily: FONTS.sansSemi,
        fontSize: SIZES.base,
        color: COLORS.ink,
        flex: 1,
    },
    time: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.inkSubtle,
        marginLeft: SPACING[2],
    },
    preview: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.inkMuted,
        lineHeight: 20,
    },
});
