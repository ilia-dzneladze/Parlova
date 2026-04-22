import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Animated,
    ActivityIndicator,
    FlatList,
    PanResponder,
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
import { initDB, seedIfEmpty, getConversations, upsertPersona, archiveConversation, deleteConversation } from "../src/db/database";
import { Persona } from "../src/types/persona";
import { API_BASE, PERSONAS_API_KEY } from "../constants/api";
import { RootStackParamList } from "../src/types/navigation";
import { COLORS, FONTS, RADIUS, SIZES, SPACING } from "../constants/theme";

const ACTION_WIDTH = 75;   // width of each action button
const REVEAL = ACTION_WIDTH * 2;  // total swipe reveal (Archive + Delete)
const SWIPE_THRESHOLD = 50;

type RowAction = (id: string) => void;

const ConversationRow = React.memo(({
    item,
    isLast,
    onArchive,
    onDelete,
    onSwipeStart,
    onSwipeEnd,
}: {
    item: Conversation;
    isLast: boolean;
    onArchive: RowAction;
    onDelete: RowAction;
    onSwipeStart: () => void;
    onSwipeEnd: () => void;
}) => {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();
    const translateX = useRef(new Animated.Value(0)).current;
    const isOpenRef = useRef(false);

    const snapClose = useCallback(() => {
        Animated.spring(translateX, {
            toValue: 0, useNativeDriver: true, damping: 26, stiffness: 320, mass: 0.8,
        }).start();
        isOpenRef.current = false;
    }, [translateX]);

    const snapOpen = useCallback(() => {
        Animated.spring(translateX, {
            toValue: -REVEAL, useNativeDriver: true, damping: 26, stiffness: 320, mass: 0.8,
        }).start();
        isOpenRef.current = true;
    }, [translateX]);

    // tan(30°) ≈ 0.577 → horizontal wins when |dx| > |dy| / 0.577  ≈ |dy| * 1.732
    const HORIZONTAL_RATIO = 1.732;
    const MIN_MOVE = 8;

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, g) => {
                const absDx = Math.abs(g.dx);
                const absDy = Math.abs(g.dy);
                if (isOpenRef.current) {
                    // When open, claim any meaningful gesture so we can close on vertical or right-swipe
                    return absDx > MIN_MOVE || absDy > MIN_MOVE;
                }
                // When closed, only claim a left-swipe within 30° of horizontal
                return g.dx < -MIN_MOVE && absDx > absDy * HORIZONTAL_RATIO;
            },
            onMoveShouldSetPanResponderCapture: (_, g) => {
                const absDx = Math.abs(g.dx);
                const absDy = Math.abs(g.dy);
                if (isOpenRef.current) {
                    return absDx > MIN_MOVE || absDy > MIN_MOVE;
                }
                return g.dx < -MIN_MOVE && absDx > absDy * HORIZONTAL_RATIO;
            },
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: () => {
                translateX.stopAnimation();
                onSwipeStart();
            },
            onPanResponderMove: (_, g) => {
                if (isOpenRef.current) {
                    // Vertical motion → keep row still; we'll close on release
                    if (Math.abs(g.dy) > Math.abs(g.dx)) return;
                    const next = Math.max(-REVEAL, Math.min(0, -REVEAL + g.dx));
                    translateX.setValue(next);
                } else {
                    const next = Math.max(-REVEAL, Math.min(0, g.dx));
                    translateX.setValue(next);
                }
            },
            onPanResponderRelease: (_, g) => {
                if (isOpenRef.current) {
                    // Any vertical dominance or rightward swipe → close fully
                    if (Math.abs(g.dy) > Math.abs(g.dx) || g.dx > SWIPE_THRESHOLD) {
                        snapClose();
                    } else {
                        snapOpen();
                    }
                } else {
                    g.dx < -SWIPE_THRESHOLD ? snapOpen() : snapClose();
                }
                onSwipeEnd();
            },
            onPanResponderTerminate: () => {
                if (isOpenRef.current) snapOpen();
                else snapClose();
                onSwipeEnd();
            },
        })
    ).current;

    return (
        <View style={styles.rowContainer}>
            {/* Action buttons revealed by swipe */}
            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.actionArchive}
                    onPress={() => { snapClose(); onArchive(item.id); }}
                    activeOpacity={0.8}
                >
                    <Ionicons name="archive-outline" size={20} color={COLORS.white} />
                    <Text style={styles.actionLabel}>Archive</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.actionDelete}
                    onPress={() => { snapClose(); onDelete(item.id); }}
                    activeOpacity={0.8}
                >
                    <Ionicons name="trash-outline" size={20} color={COLORS.white} />
                    <Text style={styles.actionLabel}>Delete</Text>
                </TouchableOpacity>
            </View>

            {/* Sliding row content */}
            <Animated.View
                style={[styles.rowSlide, { transform: [{ translateX }] }]}
                {...panResponder.panHandlers}
            >
                <TouchableOpacity
                    style={styles.row}
                    activeOpacity={0.6}
                    onPress={() => {
                        if (isOpenRef.current) {
                            snapClose();
                        } else {
                            navigation.navigate("Chat", {
                                conversationId: item.id,
                                conversationName: item.name,
                            });
                        }
                    }}
                >
                    {/* Unread dot */}
                    <View style={styles.unreadCol}>
                        {item.unread && <View style={styles.unreadDot} />}
                    </View>

                    {/* Avatar */}
                    <View style={useMemo(() => [styles.avatar, { backgroundColor: item.avatarColor }], [item.avatarColor])}>
                        <Text style={styles.avatarText}>{item.name[0]}</Text>
                    </View>

                    {/* Text content */}
                    <View style={styles.textCol}>
                        <View style={styles.topRow}>
                            <View style={styles.nameRow}>
                                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                                {item.scenario && (
                                    <Text style={styles.scenarioTag} numberOfLines={1}> [{item.scenario}]</Text>
                                )}
                            </View>
                            <Text style={styles.time}>{item.timestamp}</Text>
                        </View>
                        <Text style={styles.preview} numberOfLines={1}>{item.lastMessage}</Text>
                    </View>
                    <View style={[styles.separator, styles.separatorTop]} />
                    <View style={[styles.separator, styles.separatorBottom]} />
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
});


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
    const [scrollEnabled, setScrollEnabled] = useState(true);

    const handleSwipeStart = useCallback(() => setScrollEnabled(false), []);
    const handleSwipeEnd = useCallback(() => setScrollEnabled(true), []);

    const refresh = useCallback(() => {
        getConversations().then(setConversations);
    }, []);

    useEffect(() => {
        (async () => {
            await initDB();
            await seedIfEmpty();
            const data = await getConversations();
            setConversations(data);
            setLoading(false);
            syncGlobalPersonas();
        })();
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (!loading) refresh();
        }, [loading, refresh])
    );

    const handleArchive = useCallback(async (id: string) => {
        await archiveConversation(id);
        await deleteConversation(id);
        refresh();
    }, [refresh]);

    const handleDelete = useCallback((id: string) => {
        Alert.alert(
            "Delete Conversation",
            "This will permanently delete the conversation and all its messages.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await deleteConversation(id);
                        refresh();
                    },
                },
            ],
        );
    }, [refresh]);

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
                <TouchableOpacity onPress={() => navigation.navigate("ArchiveList")}>
                        <Ionicons name="archive-outline" size={22} color={COLORS.primary} />
                </TouchableOpacity>
                <View style={styles.headerRight}>
                    <TouchableOpacity onPress={() => navigation.navigate("NewConversation")}>
                        <Ionicons name="create-outline" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>Messages</Text>

            {/* Search bar */}
            <View style={styles.searchWrap}>
                <TouchableOpacity style={styles.searchBar} activeOpacity={1} onPress={() => {}}>
                    <Ionicons name="search" size={16} color={COLORS.inkSubtle} />
                    <Text style={styles.searchPlaceholder}>Search</Text>
                </TouchableOpacity>
            </View>

            {/* Conversation list */}
            <FlatList
                data={conversations}
                keyExtractor={(c) => c.id}
                renderItem={({ item, index }) => (
                    <ConversationRow
                        item={item}
                        isLast={index === conversations.length - 1}
                        onArchive={handleArchive}
                        onDelete={handleDelete}
                        onSwipeStart={handleSwipeStart}
                        onSwipeEnd={handleSwipeEnd}
                    />
                )}
                scrollEnabled={scrollEnabled}
                style={styles.list}
            />
        </SafeAreaView>
    );
};

export default ConversationsList;

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.surface },
    center: { alignItems: "center", justifyContent: "center" },

    /* Header */
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: SPACING[4],
        height: 44,
    },
    editBtn: { fontFamily: FONTS.sansMedium, fontSize: 17, color: COLORS.primary },
    headerRight: { flexDirection: "row", alignItems: "center", gap: SPACING[4] },

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
    searchWrap: { paddingHorizontal: SPACING[4], marginBottom: SPACING[2] },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.primaryPale,
        borderRadius: RADIUS.lg,
        paddingHorizontal: SPACING[2],
        height: 36,
        gap: 6,
    },
    searchPlaceholder: { fontFamily: FONTS.sans, fontSize: 16, color: COLORS.inkSubtle },

    list: { flex: 1 },

    /* Swipeable row container */
    rowContainer: {
        overflow: "hidden",
        backgroundColor: COLORS.surface,
    },

    /* Action buttons (behind the row) */
    actions: {
        position: "absolute",
        top: 0,
        bottom: 0,
        right: 0,
        width: REVEAL,
        flexDirection: "row",
    },
    actionArchive: {
        width: ACTION_WIDTH,
        backgroundColor: "#4A8FC4",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
    },
    actionDelete: {
        width: ACTION_WIDTH,
        backgroundColor: COLORS.error,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
    },
    actionLabel: {
        fontFamily: FONTS.sansMedium,
        fontSize: 12,
        color: COLORS.white,
    },

    /* Sliding content */
    rowSlide: {
        backgroundColor: COLORS.surface,
    },

    /* Row */
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingRight: SPACING[4],
        paddingVertical: SPACING[3],
        minHeight: 80,
        backgroundColor: COLORS.surface,
    },

    /* Unread dot column */
    unreadCol: { width: 20, alignItems: "center", justifyContent: "center" },
    unreadDot: {
        width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary,
    },

    /* Avatar */
    avatar: {
        width: 50, height: 50, borderRadius: 30,
        alignItems: "center", justifyContent: "center",
    },
    avatarText: {
        fontFamily: FONTS.displayBold, color: COLORS.white, fontSize: SIZES["2xl"],
    },

    /* Text column */
    textCol: {
        flex: 1, paddingLeft: SPACING[3], paddingVertical: SPACING[2], justifyContent: "center",
    },
    separator: {
        position: "absolute",
        left: 20 + 50 + SPACING[3],
        right: -SPACING[4],
        height: StyleSheet.hairlineWidth,
        backgroundColor: COLORS.borderInput,
    },
    separatorTop: { top: 0 },
    separatorBottom: { bottom: 0 },
    topRow: {
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "baseline", marginBottom: 4,
    },
    nameRow: {
        flexDirection: "row",
        alignItems: "baseline",
        flex: 1,
        overflow: "hidden",
        marginRight: SPACING[2],
    },
    name: {
        fontFamily: FONTS.sansSemi, fontSize: SIZES.base, color: COLORS.ink, flexShrink: 1,
    },
    scenarioTag: {
        fontFamily: FONTS.sans, fontSize: SIZES.sm, color: COLORS.inkSubtle, flexShrink: 1,
    },
    time: {
        fontFamily: FONTS.sans, fontSize: SIZES.sm, color: COLORS.inkSubtle, marginLeft: SPACING[2],
    },
    preview: {
        fontFamily: FONTS.sans, fontSize: SIZES.sm, color: COLORS.inkMuted, lineHeight: 20,
    },
});