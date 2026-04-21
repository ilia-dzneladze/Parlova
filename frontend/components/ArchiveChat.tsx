import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, NavigationProp, RouteProp } from "@react-navigation/native";
import { getArchivedMessages, getArchivedConversation, parseQuestJson } from "../src/db/database";
import { ArchivedConversation } from "../src/types/conversation";
import { RootStackParamList } from "../src/types/navigation";
import { Message, SENT_COLOR, RECV_COLOR, formatTime, isLastInGroup, isFirstInGroup, showTimestamp } from "../src/utils/chat";
import QuestBriefing from "./QuestBriefing";
import QuestDebrief from "./QuestDebrief";
import { Quest } from "../src/types/quest";
import { COLORS, FONTS, SIZES, SPACING } from "../constants/theme";

const ArchiveChat = () => {
    const navigator = useNavigation<NavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, "ArchiveChat">>();
    const archiveId = route.params.archiveId;

    const [messages, setMessages] = useState<Message[]>([]);
    const [archive, setArchive] = useState<ArchivedConversation | null>(null);
    const [quest, setQuest] = useState<Quest | null>(null);
    const [showQuest, setShowQuest] = useState(false);
    const [showDebrief, setShowDebrief] = useState(false);

    useEffect(() => {
        (async () => {
            const [saved, meta] = await Promise.all([
                getArchivedMessages(archiveId),
                getArchivedConversation(archiveId),
            ]);
            setMessages(saved.map((m) => ({
                id: m.id,
                sender: m.sender,
                content: m.content,
                responseTime: m.responseTime,
                timestamp: m.timestamp,
            })));
            setArchive(meta);
            setQuest(parseQuestJson(meta?.questJson));
        })();
    }, [archiveId]);

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigator.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{archive?.name ?? "Archived"}</Text>
                {quest && (
                    <View style={styles.headerActions}>
                        <TouchableOpacity onPress={() => setShowDebrief(true)}>
                            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowQuest(true)}>
                            <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {messages.map((msg, i) => {
                    const isUser = msg.sender === "user";
                    const last = isLastInGroup(messages, i);
                    const first = isFirstInGroup(messages, i);
                    const tsVisible = showTimestamp(messages, i);

                    return (
                        <React.Fragment key={i}>
                            {tsVisible && (
                                <Text style={styles.timestamp}>
                                    {formatTime(msg.timestamp)}
                                </Text>
                            )}
                            <View style={[
                                styles.messageRow,
                                isUser ? styles.rowUser : styles.rowAI,
                                { marginTop: first || tsVisible ? 8 : 2 },
                            ]}>
                                <View style={styles.bubbleWrap}>
                                    <View style={[
                                        styles.bubble,
                                        isUser ? styles.bubbleSent : styles.bubbleRecv,
                                        last && isUser && { borderBottomRightRadius: 4 },
                                        last && !isUser && { borderBottomLeftRadius: 4 },
                                    ]}>
                                        <Text style={[
                                            styles.bubbleText,
                                            isUser ? styles.textSent : styles.textRecv,
                                        ]}>
                                            {msg.content}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </React.Fragment>
                    );
                })}
            </ScrollView>

            <View style={styles.footer}>
                <Ionicons name="archive-outline" size={16} color={COLORS.inkMuted} />
                <Text style={styles.footerText}>Archived conversation</Text>
            </View>

            {quest && (
                <QuestBriefing
                    quest={quest}
                    visible={showQuest}
                    onDismiss={() => setShowQuest(false)}
                    readOnly
                />
            )}
            {quest && (
                <QuestDebrief
                    quest={quest}
                    visible={showDebrief}
                    onComplete={() => setShowDebrief(false)}
                    savedResult={quest.debrief_result}
                />
            )}
        </SafeAreaView>
    );
};

export default ArchiveChat;

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    header: {
        height: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.bg,
    },
    backButton: {
        position: "absolute",
        left: 4,
        padding: 4,
    },
    headerTitle: {
        fontFamily: FONTS.displaySemi,
        fontSize: 17,
        color: COLORS.ink,
    },
    headerActions: {
        position: "absolute",
        right: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING[4],
    },
    scrollView: { flex: 1 },
    scrollContent: {
        paddingHorizontal: SPACING[4],
        paddingBottom: SPACING[2],
    },
    timestamp: {
        fontFamily: FONTS.sansMedium,
        textAlign: "center",
        fontSize: 11,
        color: COLORS.inkMuted,
        marginTop: SPACING[4],
        marginBottom: SPACING[1],
    },
    messageRow: { flexDirection: "column" },
    rowUser: { alignItems: "flex-end" },
    rowAI: { alignItems: "flex-start" },
    bubbleWrap: { maxWidth: "70%" },
    bubble: {
        borderRadius: 18,
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    bubbleSent: { backgroundColor: SENT_COLOR },
    bubbleRecv: { backgroundColor: RECV_COLOR },
    bubbleText: {
        fontFamily: FONTS.sans,
        fontSize: 17,
        lineHeight: 22,
    },
    textSent: { color: COLORS.bubbleTextSent },
    textRecv: { color: COLORS.bubbleTextRecv },
    footer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: SPACING[3],
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.border,
        backgroundColor: COLORS.bg,
    },
    footerText: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.inkMuted,
    },
});
