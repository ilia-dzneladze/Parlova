import React, { useCallback, useState } from "react";
import {
    Alert,
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
import { ArchivedConversation } from "../src/types/conversation";
import {
    getArchivedConversations,
    deleteArchivedConversation,
    formatTimestampForArchive,
    getLikedMessages,
    setMessageLiked,
    LikedMessage,
} from "../src/db/database";
import { RootStackParamList } from "../src/types/navigation";
import { COLORS, FONTS, SIZES, SPACING } from "../constants/theme";

type Tab = "conversations" | "liked";

const ArchiveRow = ({ item, isLast, onDelete }: { item: ArchivedConversation; isLast: boolean; onDelete: (id: string) => void }) => {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();

    const handleDelete = () => {
        Alert.alert(
            "Delete chat",
            "This conversation will be permanently deleted.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => onDelete(item.id) },
            ],
        );
    };

    return (
        <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            onPress={() => navigation.navigate("ArchiveChat", { archiveId: item.id })}
            onLongPress={handleDelete}
        >
            <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
                <Text style={styles.avatarText}>{item.name[0]}</Text>
            </View>

            <View style={[styles.textCol, !isLast && styles.separator]}>
                <View style={styles.topRow}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.time}>{formatTimestampForArchive(item.archivedAt)}</Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>{item.lastMessage}</Text>
                <Text style={styles.msgCount}>{item.messageCount} messages</Text>
            </View>

            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
            </TouchableOpacity>
        </TouchableOpacity>
    );
};

const LikedRow = ({ item, isLast, onUnlike }: { item: LikedMessage; isLast: boolean; onUnlike: (m: LikedMessage) => void }) => {
    const isUser = item.sender === "user";
    return (
        <View style={[styles.likedRow, !isLast && styles.separator]}>
            <View style={[styles.avatarSm, { backgroundColor: item.avatarColor }]}>
                <Text style={styles.avatarSmText}>{item.conversationName[0]}</Text>
            </View>
            <View style={styles.likedCol}>
                <View style={styles.topRow}>
                    <Text style={styles.likedSender} numberOfLines={1}>
                        {isUser ? "You" : item.conversationName}
                        {item.source === "archived" && <Text style={styles.archivedTag}>  · archived</Text>}
                    </Text>
                    <Text style={styles.time}>{formatTimestampForArchive(item.timestamp)}</Text>
                </View>
                <Text style={styles.likedContent} numberOfLines={3}>{item.content}</Text>
            </View>
            <TouchableOpacity onPress={() => onUnlike(item)} style={styles.heartBtn} hitSlop={8}>
                <Ionicons name="heart" size={20} color={COLORS.primary} />
            </TouchableOpacity>
        </View>
    );
};

const ArchiveList = () => {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();
    const [tab, setTab] = useState<Tab>("conversations");
    const [archives, setArchives] = useState<ArchivedConversation[]>([]);
    const [liked, setLiked] = useState<LikedMessage[]>([]);
    const [loaded, setLoaded] = useState(false);

    useFocusEffect(
        useCallback(() => {
            (async () => {
                const [a, l] = await Promise.all([
                    getArchivedConversations(),
                    getLikedMessages(),
                ]);
                setArchives(a);
                setLiked(l);
                setLoaded(true);
            })();
        }, [])
    );

    const handleDelete = async (archiveId: string) => {
        await deleteArchivedConversation(archiveId);
        setArchives((prev) => prev.filter((a) => a.id !== archiveId));
        setLiked((prev) => prev.filter((m) => !(m.source === "archived" && m.conversationId === archiveId)));
    };

    const handleUnlike = async (m: LikedMessage) => {
        await setMessageLiked(m.id, false, m.source === "archived");
        setLiked((prev) => prev.filter((x) => x.id !== m.id));
    };

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <Text style={styles.title}>Archive</Text>

            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, tab === "conversations" && styles.tabActive]}
                    onPress={() => setTab("conversations")}
                >
                    <Text style={[styles.tabText, tab === "conversations" && styles.tabTextActive]}>
                        Conversations
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, tab === "liked" && styles.tabActive]}
                    onPress={() => setTab("liked")}
                >
                    <Text style={[styles.tabText, tab === "liked" && styles.tabTextActive]}>
                        Liked
                    </Text>
                </TouchableOpacity>
            </View>

            {tab === "conversations" ? (
                loaded && archives.length === 0 ? (
                    <View style={styles.empty}>
                        <Ionicons name="archive-outline" size={48} color={COLORS.inkSubtle} />
                        <Text style={styles.emptyText}>No archived conversations</Text>
                    </View>
                ) : (
                    <FlatList
                        data={archives}
                        keyExtractor={(a) => a.id}
                        renderItem={({ item, index }) => (
                            <ArchiveRow item={item} isLast={index === archives.length - 1} onDelete={handleDelete} />
                        )}
                        style={styles.list}
                    />
                )
            ) : (
                loaded && liked.length === 0 ? (
                    <View style={styles.empty}>
                        <Ionicons name="heart-outline" size={48} color={COLORS.inkSubtle} />
                        <Text style={styles.emptyText}>No liked messages yet</Text>
                        <Text style={styles.emptyHint}>Double-tap a message to like it.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={liked}
                        keyExtractor={(m) => m.id}
                        renderItem={({ item, index }) => (
                            <LikedRow item={item} isLast={index === liked.length - 1} onUnlike={handleUnlike} />
                        )}
                        style={styles.list}
                    />
                )
            )}
        </SafeAreaView>
    );
};

export default ArchiveList;

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.surface },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: SPACING[1],
        height: 44,
    },
    backButton: { padding: SPACING[1] },
    title: {
        fontFamily: FONTS.displayBold,
        fontSize: SIZES["4xl"],
        color: COLORS.ink,
        letterSpacing: -0.8,
        paddingHorizontal: SPACING[4],
        marginBottom: SPACING[2],
    },
    tabs: {
        flexDirection: "row",
        paddingHorizontal: SPACING[4],
        gap: SPACING[2],
        marginBottom: SPACING[3],
    },
    tab: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 999,
        backgroundColor: COLORS.bg,
    },
    tabActive: { backgroundColor: COLORS.primary },
    tabText: {
        fontFamily: FONTS.sansMedium,
        fontSize: SIZES.sm,
        color: COLORS.inkMuted,
    },
    tabTextActive: { color: COLORS.white },

    list: { flex: 1 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: SPACING[4],
        paddingRight: SPACING[4],
        minHeight: 76,
    },
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
    msgCount: {
        fontFamily: FONTS.sansMedium,
        fontSize: SIZES.xs,
        color: COLORS.inkSubtle,
        marginTop: 2,
    },
    deleteBtn: { padding: SPACING[2] },

    likedRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingHorizontal: SPACING[4],
        paddingVertical: SPACING[3],
        gap: SPACING[3],
    },
    avatarSm: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: "center", justifyContent: "center",
    },
    avatarSmText: {
        fontFamily: FONTS.displaySemi,
        color: COLORS.white,
        fontSize: SIZES.sm,
    },
    likedCol: { flex: 1 },
    likedSender: {
        fontFamily: FONTS.sansSemi,
        fontSize: SIZES.sm,
        color: COLORS.ink,
        flex: 1,
    },
    archivedTag: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.xs,
        color: COLORS.inkSubtle,
    },
    likedContent: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.base,
        color: COLORS.ink,
        lineHeight: 22,
        marginTop: 2,
    },
    heartBtn: { padding: 4 },

    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: SPACING[2],
    },
    emptyText: {
        fontFamily: FONTS.sansMedium,
        fontSize: SIZES.base,
        color: COLORS.inkMuted,
    },
    emptyHint: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.inkSubtle,
    },
});
