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
import { getArchivedMessages, getArchivedConversation } from "../src/db/database";
import { ArchivedConversation } from "../src/types/conversation";
import { RootStackParamList } from "../src/types/navigation";
import { Message, SENT_COLOR, RECV_COLOR, formatTime, isLastInGroup, isFirstInGroup, showTimestamp } from "../src/utils/chat";
import QuestBriefing from "./QuestBriefing";
import { Quest } from "../src/types/quest";

const ArchiveChat = () => {
    const navigator = useNavigation<NavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, "ArchiveChat">>();
    const archiveId = route.params.archiveId;

    const [messages, setMessages] = useState<Message[]>([]);
    const [archive, setArchive] = useState<ArchivedConversation | null>(null);
    const [quest, setQuest] = useState<Quest | null>(null);
    const [showQuest, setShowQuest] = useState(false);

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
            if (meta?.questJson) {
                try { setQuest(JSON.parse(meta.questJson)); } catch { /* ignore */ }
            }
        })();
    }, [archiveId]);

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#F6F6F6" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigator.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color={SENT_COLOR} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{archive?.name ?? "Archived"}</Text>
                {quest && (
                    <TouchableOpacity onPress={() => setShowQuest(true)} style={styles.questBtn}>
                        <Ionicons name="document-text-outline" size={20} color="#007AFF" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Messages */}
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

            {/* Footer */}
            <View style={styles.footer}>
                <Ionicons name="archive-outline" size={16} color="#8E8E93" />
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
        </SafeAreaView>
    );
};

export default ArchiveChat;

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#F6F6F6",
    },

    /* Header */
    header: {
        height: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#C6C6C8",
        backgroundColor: "#F6F6F6",
    },
    backButton: {
        position: "absolute",
        left: 4,
        padding: 4,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "600",
        color: "#000",
    },
    questBtn: {
        position: "absolute",
        right: 12,
        padding: 4,
    },

    /* Message list */
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    timestamp: {
        textAlign: "center",
        fontSize: 11,
        color: "#8E8E93",
        marginTop: 16,
        marginBottom: 4,
    },

    /* Row */
    messageRow: {
        flexDirection: "column",
    },
    rowUser: {
        alignItems: "flex-end",
    },
    rowAI: {
        alignItems: "flex-start",
    },

    /* Bubble */
    bubbleWrap: {
        maxWidth: "70%",
    },
    bubble: {
        borderRadius: 18,
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    bubbleSent: {
        backgroundColor: SENT_COLOR,
    },
    bubbleRecv: {
        backgroundColor: RECV_COLOR,
    },
    bubbleText: {
        fontSize: 17,
        lineHeight: 22,
    },
    textSent: {
        color: "#FFF",
    },
    textRecv: {
        color: "#000",
    },

    /* Footer */
    footer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#C6C6C8",
        backgroundColor: "#F6F6F6",
    },
    footerText: {
        fontSize: 14,
        color: "#8E8E93",
    },
});
