import { Ionicons } from "@expo/vector-icons";
import React, { useState, useRef, useEffect } from "react";
import {
    Alert,
    Animated,
    Easing,
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
import { useNavigation, useRoute, NavigationProp, RouteProp } from "@react-navigation/native";
import uuid from "react-native-uuid";
import { getMessages, saveMessages, appendMessage, archiveConversation, markAsRead, markAsUnread, ChatMessage } from "../src/db/database";
import { RootStackParamList } from "../src/types/navigation";
import { Message, SENT_COLOR, RECV_COLOR, DEFAULT_GREETING, formatTime, isLastInGroup, isFirstInGroup, showTimestamp } from "../src/utils/chat";

const API_BASE = 'https://overabusive-nonchimerically-marvella.ngrok-free.dev';

// Tweak this to adjust the gap between keyboard and input bar (negative = closer)
const KEYBOARD_OFFSET = -30;

const TypingDot = ({ delay }: { delay: number }) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(anim, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.delay(600 - delay),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);
    return (
        <Animated.View style={[
            styles.typingDot,
            { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
              opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1, 0.4] }) },
        ]} />
    );
};

const TypingIndicator = () => (
    <View style={[styles.messageRow, styles.rowAI, { marginTop: 8 }]}>
        <View style={styles.bubbleWrap}>
            <View style={[styles.bubble, styles.bubbleRecv, styles.typingBubble, { borderBottomLeftRadius: 4 }]}>
                <TypingDot delay={0} />
                <TypingDot delay={150} />
                <TypingDot delay={300} />
            </View>
        </View>
    </View>
);

const Chat = () => {
    const navigator = useNavigation<NavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, "Chat">>();
    const conversationId = route.params.conversationId;
    const scrollRef = useRef<ScrollView>(null);
    const messagesRef = useRef<Message[]>([]);
    const mountedRef = useRef(true);

    const [messages, setMessages] = useState<Message[]>([]);
    const [message, setMessage] = useState<string>("");
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        (async () => {
            await markAsRead(conversationId);
            const saved = await getMessages(conversationId);
            if (saved.length > 0) {
                setMessages(saved.map((m) => ({
                    id: m.id,
                    sender: m.sender,
                    content: m.content,
                    responseTime: m.responseTime,
                    timestamp: m.timestamp,
                })));
            } else {
                setMessages([{
                    id: uuid.v4() as string,
                    sender: "ai",
                    content: DEFAULT_GREETING,
                    timestamp: Date.now(),
                }]);
            }
        })();
    }, [conversationId]);

    useEffect(() => {
        const unsubscribe = navigator.addListener("beforeRemove", () => {
            const msgs: ChatMessage[] = messagesRef.current.map((m) => ({
                id: m.id,
                conversationId,
                sender: m.sender,
                content: m.content,
                responseTime: m.responseTime,
                timestamp: m.timestamp,
            }));
            saveMessages(conversationId, msgs);
        });
        return unsubscribe;
    }, [navigator, conversationId]);

    const handleSend = async () => {
        if(!message.trim()) return;

        const trimmed = message.trim();
        const currentHistory = [...messages];
        const userMsg: Message = {
            id: uuid.v4() as string,
            sender: "user",
            content: trimmed,
            timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setMessage("");
        setIsTyping(true);

        const doFetch = async () => {
            const minDelay = new Promise(r => setTimeout(r, 1500));
            try {
                const [response] = await Promise.all([
                    fetch(`${API_BASE}/api/chat`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
                        body: JSON.stringify({
                            message: trimmed,
                            history: currentHistory,
                        }),
                    }),
                    minDelay,
                ]);
                const data = await response.json();
                const aiMsg: Message = {
                    id: uuid.v4() as string,
                    sender: "ai",
                    content: data.response,
                    responseTime: data.time,
                    timestamp: Date.now(),
                };

                if (mountedRef.current) {
                    setIsTyping(false);
                    setMessages((prev) => [...prev, aiMsg]);
                } else {
                    await appendMessage({
                        ...aiMsg,
                        conversationId,
                    });
                    await markAsUnread(conversationId);
                }
            } catch (error) {
                if (mountedRef.current) {
                    setIsTyping(false);
                }
                console.error(error);
            }
        };
        doFetch();
    };

    const handleEndConversation = () => {
        Alert.alert(
            "End Conversation",
            "This conversation will be archived. Start a new one?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "End",
                    style: "destructive",
                    onPress: async () => {
                        const msgs: ChatMessage[] = messagesRef.current.map((m) => ({
                            id: m.id,
                            conversationId,
                            sender: m.sender,
                            content: m.content,
                            responseTime: m.responseTime,
                            timestamp: m.timestamp,
                        }));
                        await saveMessages(conversationId, msgs);
                        await archiveConversation(conversationId);
                        setMessages([{
                            id: uuid.v4() as string,
                            sender: "ai",
                            content: DEFAULT_GREETING,
                            timestamp: Date.now(),
                        }]);
                        setIsTyping(false);
                    },
                },
            ],
        );
    };

    return(
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={KEYBOARD_OFFSET}
        >
            <StatusBar barStyle="dark-content" backgroundColor="#F6F6F6" />
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigator.goBack()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={28} color={SENT_COLOR} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Penelope</Text>
                    <TouchableOpacity onPress={handleEndConversation} style={styles.endButton}>
                        <Text style={styles.endButtonText}>End</Text>
                    </TouchableOpacity>
                </View>

                {/* Chat Messages */}
                <ScrollView
                    ref={scrollRef}
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                >
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

                                    {msg.sender === "ai" && i > 0 && msg.responseTime !== undefined && (
                                        <Text style={styles.responseTime}>
                                            {msg.responseTime.toFixed(1)}s
                                        </Text>
                                    )}
                                </View>
                            </React.Fragment>
                        );
                    })}
                    {isTyping && <TypingIndicator />}
                </ScrollView>

                {/* Input Bar */}
                <View style={styles.inputBar}>
                    <View style={styles.inputPill}>
                        <TextInput
                            placeholder="iMessage"
                            placeholderTextColor="#8E8E93"
                            multiline
                            value={message}
                            onChangeText={setMessage}
                            style={styles.input}
                        />
                    </View>
                    <TouchableOpacity
                        onPress={handleSend}
                        style={[
                            styles.sendBtn,
                            message.trim() ? styles.sendActive : styles.sendInactive,
                        ]}
                        disabled={!message.trim()}
                    >
                        <Ionicons name="arrow-up" size={22} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

export default Chat;

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#F6F6F6",
    },
    safeArea: {
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
    endButton: {
        position: "absolute",
        right: 12,
        padding: 4,
    },
    endButtonText: {
        fontSize: 15,
        color: "#FF3B30",
        fontWeight: "500",
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

    /* Typing indicator */
    typingBubble: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    typingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#8E8E93",
    },

    /* Response time */
    responseTime: {
        fontSize: 11,
        color: "#8E8E93",
        marginTop: 2,
        paddingLeft: 4,
    },

    /* Input bar */
    inputBar: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
        backgroundColor: "#F6F6F6",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#C6C6C8",
    },
    inputPill: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#C7C7CC",
        backgroundColor: "#FFF",
        paddingHorizontal: 12,
    },
    input: {
        fontSize: 17,
        color: "#000",
        maxHeight: 100,
        minHeight: 36,
        paddingVertical: 8,
    },
    sendBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 2,
    },
    sendActive: {
        backgroundColor: SENT_COLOR,
    },
    sendInactive: {
        backgroundColor: "#C7C7CC",
    },
});
