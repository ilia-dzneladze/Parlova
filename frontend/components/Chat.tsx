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
import { getMessages, saveMessages, appendMessage, archiveConversation, deleteConversation, markAsRead, markAsUnread, getConversation, getPersona, getSetting, saveCorrection, saveCorrectionExplanation, getCorrection, getCorrectionsForConversation, MessageCorrection, ChatMessage } from "../src/db/database";
import { DEFAULT_MODEL, MODELS } from "../src/utils/models";
import { Conversation } from "../src/types/conversation";
import { Persona } from "../src/types/persona";
import { RootStackParamList } from "../src/types/navigation";
import { Message, SENT_COLOR, RECV_COLOR, DEFAULT_GREETING, formatTime, isLastInGroup, isFirstInGroup, showTimestamp } from "../src/utils/chat";
import { COLORS, FONTS } from "../constants/theme";
import { API_BASE } from "../constants/api";
import LookupSheet from "./LookupSheet";
import CorrectionSheet from "./CorrectionSheet";

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
    const goBackToChats = () => {
        const nav = navigator as unknown as {
            popTo?: (name: string, params?: unknown) => void;
            navigate: (name: string, params?: unknown) => void;
        };
        if (typeof nav.popTo === "function") {
            nav.popTo("Tabs", { screen: "Conversations" });
        } else {
            nav.navigate("Tabs", { screen: "Conversations" });
        }
    };
    const { conversationId, conversationName } = route.params;
    const scrollRef = useRef<ScrollView>(null);
    const messagesRef = useRef<Message[]>([]);
    const mountedRef = useRef(true);
    const isEndedRef = useRef(false);
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [currentPersona, setCurrentPersona] = useState<Persona | null>(null);

    const [messages, setMessages] = useState<Message[]>([]);
    const [message, setMessage] = useState<string>("");
    const [isTyping, setIsTyping] = useState(false);
    const [tappedId, setTappedId] = useState<string | null>(null);
    const [lookupText, setLookupText] = useState<string | null>(null);
    const [searchVisible, setSearchVisible] = useState(false);
    const [corrections, setCorrections] = useState<Record<string, MessageCorrection>>({});
    const [activeCorrectionId, setActiveCorrectionId] = useState<string | null>(null);
    const [explainLoading, setExplainLoading] = useState(false);
    const [explainError, setExplainError] = useState<string | null>(null);
    const selectedModelRef = useRef<string>(DEFAULT_MODEL);

    useEffect(() => {
        (async () => {
            const stored = await getSetting("selected_model");
            if (stored && MODELS.some((m) => m.value === stored)) {
                selectedModelRef.current = stored;
            }
        })();
    }, []);

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
            const convo = await getConversation(conversationId);
            if (convo) {
                setConversation(convo);
                const p = await getPersona(convo.personaId);
                if (p) setCurrentPersona(p);
            }
            const saved = await getMessages(conversationId);
            const savedCorrections = await getCorrectionsForConversation(conversationId);
            setCorrections(savedCorrections);

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
            if (isEndedRef.current) return;
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
        if (!message.trim()) return;

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

        const userMsgCount = currentHistory.filter((m) => m.sender === "user").length + 1;

        const fetchCorrection = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/correct`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
                    body: JSON.stringify({
                        message: trimmed,
                        history: currentHistory,
                        level: currentPersona?.level ?? "A1",
                        model: selectedModelRef.current,
                    }),
                });
                const data = await res.json();
                const status: "good" | "corrected" = data.status === "corrected" ? "corrected" : "good";
                const corrected: string | null = status === "corrected" ? String(data.corrected ?? "").trim() || null : null;
                await saveCorrection(userMsg.id, status, corrected);
                if (mountedRef.current) {
                    setCorrections((prev) => ({
                        ...prev,
                        [userMsg.id]: {
                            messageId: userMsg.id,
                            status,
                            correctedText: corrected,
                            explanation: prev[userMsg.id]?.explanation ?? null,
                            createdAt: Date.now(),
                        },
                    }));
                }
            } catch (e) {
                console.warn("correction failed", e);
            }
        };

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
                            message_count: userMsgCount,
                            model: selectedModelRef.current,
                            persona: currentPersona ? {
                                name: currentPersona.name,
                                persona: currentPersona.description,
                                level: currentPersona.level,
                                question_freq: currentPersona.questionFreq,
                                scenario: conversation?.scenario ?? "Just Chatting",
                            } : undefined,
                        }),
                    }),
                    minDelay,
                ]);
                const data = await response.json();
                const rawBubbles: string[] = Array.isArray(data.bubbles) ? data.bubbles : [];
                const bubbles = rawBubbles.map((b) => String(b).trim()).filter(Boolean);
                const closing: string = typeof data.closing === "string" ? data.closing.trim() : "";

                const bubbleDelay = (text: string) => {
                    const chars = text.length;
                    return Math.min(2200, 400 + chars * 45 + Math.random() * 250);
                };

                if (mountedRef.current) {
                    for (let i = 0; i < bubbles.length; i++) {
                        if (!mountedRef.current) break;
                        if (i === 0) {
                            setIsTyping(false);
                        } else {
                            setIsTyping(true);
                            await new Promise((r) => setTimeout(r, bubbleDelay(bubbles[i])));
                            if (!mountedRef.current) break;
                            setIsTyping(false);
                        }
                        const msg: Message = {
                            id: uuid.v4() as string,
                            sender: "ai",
                            content: bubbles[i],
                            responseTime: i === 0 ? data.time : undefined,
                            timestamp: Date.now(),
                        };
                        setMessages((prev) => [...prev, msg]);
                    }

                    if (closing && mountedRef.current) {
                        setIsTyping(true);
                        await new Promise((r) => setTimeout(r, bubbleDelay(closing)));
                        if (mountedRef.current) {
                            setIsTyping(false);
                            setMessages((prev) => [...prev, {
                                id: uuid.v4() as string,
                                sender: "ai",
                                content: closing,
                                timestamp: Date.now(),
                            }]);
                        }
                    }

                    if (data.wrap_up && mountedRef.current) {
                        await new Promise(r => setTimeout(r, 2000));
                        if (mountedRef.current) {
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
                            await deleteConversation(conversationId);
                            isEndedRef.current = true;
                            goBackToChats();
                        }
                    }
                } else {
                    for (let i = 0; i < bubbles.length; i++) {
                        await appendMessage({
                            id: uuid.v4() as string,
                            conversationId,
                            sender: "ai",
                            content: bubbles[i],
                            responseTime: i === 0 ? data.time : undefined,
                            timestamp: Date.now(),
                        });
                    }
                    if (closing) {
                        await appendMessage({
                            id: uuid.v4() as string,
                            conversationId,
                            sender: "ai",
                            content: closing,
                            timestamp: Date.now(),
                        });
                    }
                    if (data.wrap_up) {
                        await archiveConversation(conversationId);
                        await deleteConversation(conversationId);
                    } else {
                        await markAsUnread(conversationId);
                    }
                }
            } catch (error) {
                if (mountedRef.current) {
                    setIsTyping(false);
                }
                console.error(error);
            }
        };
        fetchCorrection();
        doFetch();
    };

    const handleUserLongPress = async (msg: Message) => {
        const correction = corrections[msg.id];
        if (!correction || correction.status !== "corrected" || !correction.correctedText) return;

        setActiveCorrectionId(msg.id);
        setExplainError(null);

        if (correction.explanation) {
            setExplainLoading(false);
            return;
        }

        setExplainLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/correct/explain`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
                body: JSON.stringify({
                    original: msg.content,
                    corrected: correction.correctedText,
                    history: messagesRef.current.filter((m) => m.id !== msg.id),
                    level: currentPersona?.level ?? "A1",
                    model: selectedModelRef.current,
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const explanation: string = String(data.explanation ?? "").trim();
            if (!explanation) throw new Error("Empty explanation");
            await saveCorrectionExplanation(msg.id, explanation);
            if (mountedRef.current) {
                setCorrections((prev) => ({
                    ...prev,
                    [msg.id]: { ...prev[msg.id], explanation },
                }));
            }
        } catch (e) {
            console.warn("explain failed", e);
            if (mountedRef.current) {
                setExplainError("Couldn't load the explanation. Please try again.");
            }
        } finally {
            if (mountedRef.current) setExplainLoading(false);
        }
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
                        setIsTyping(false);
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
                        await deleteConversation(conversationId);
                        isEndedRef.current = true;
                        goBackToChats();
                    },
                },
            ],
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={KEYBOARD_OFFSET}
        >
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => goBackToChats()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={28} color={SENT_COLOR} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{conversationName}</Text>
                    <View style={styles.headerRight}>
                        <TouchableOpacity onPress={handleEndConversation} style={styles.endButton}>
                            <Text style={styles.endButtonText}>End</Text>
                        </TouchableOpacity>
                    </View>
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
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setTappedId(prev => prev === msg.id ? null : msg.id)}
                                    onLongPress={() => isUser ? handleUserLongPress(msg) : setLookupText(msg.content)}
                                    delayLongPress={350}
                                    style={[
                                        styles.messageRow,
                                        isUser ? styles.rowUser : styles.rowAI,
                                        { marginTop: first || tsVisible ? 8 : 2 },
                                    ]}
                                >
                                    <View style={styles.bubbleWrap}>
                                        <View style={[
                                            styles.bubble,
                                            isUser ? styles.bubbleSent : styles.bubbleRecv,
                                            last && isUser && { borderBottomRightRadius: 4 },
                                            last && !isUser && { borderBottomLeftRadius: 4 },
                                        ]}>
                                            <Text style={[styles.bubbleText, isUser ? styles.textSent : styles.textRecv]}>
                                                {msg.content}
                                            </Text>
                                            {isUser && corrections[msg.id] && (
                                                <>
                                                    <View style={styles.correctionDivider} />
                                                    {corrections[msg.id].status === "good" ? (
                                                        <View style={styles.correctionRow}>
                                                            <Ionicons name="checkmark-circle" size={14} color={COLORS.white} />
                                                            <Text style={styles.correctionGoodText}>Good Job!</Text>
                                                        </View>
                                                    ) : (
                                                        <Text style={styles.correctionText}>
                                                            {corrections[msg.id].correctedText}
                                                        </Text>
                                                    )}
                                                </>
                                            )}
                                        </View>
                                    </View>

                                    {tappedId === msg.id && (
                                        <Text style={styles.tappedTime}>
                                            {formatTime(msg.timestamp)}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </React.Fragment>
                        );
                    })}
                    {isTyping && <TypingIndicator />}
                </ScrollView>

                {/* Input Bar */}
                <View style={styles.inputBar}>
                    <TouchableOpacity onPress={() => setSearchVisible(true)} style={styles.dictBtn}>
                        <Ionicons name="book-outline" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <View style={styles.inputPill}>
                        <TextInput
                            placeholder="Type in German..."
                            placeholderTextColor={COLORS.inkSubtle}
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
                        <Ionicons name="arrow-up" size={22} color={COLORS.white} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <LookupSheet
                visible={lookupText !== null || searchVisible}
                initialText={lookupText ?? undefined}
                initialLang="de"
                onClose={() => {
                    setLookupText(null);
                    setSearchVisible(false);
                }}
            />

            <CorrectionSheet
                visible={activeCorrectionId !== null}
                onClose={() => setActiveCorrectionId(null)}
                original={activeCorrectionId ? (messagesRef.current.find((m) => m.id === activeCorrectionId)?.content ?? "") : ""}
                corrected={activeCorrectionId ? (corrections[activeCorrectionId]?.correctedText ?? "") : ""}
                explanation={activeCorrectionId ? (corrections[activeCorrectionId]?.explanation ?? null) : null}
                loading={explainLoading}
                error={explainError}
            />
        </KeyboardAvoidingView>
    );
};

export default Chat;

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    safeArea: { flex: 1, backgroundColor: COLORS.bg },

    header: {
        height: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.borderInput,
        backgroundColor: COLORS.bg,
    },
    backButton: { position: "absolute", left: 4, padding: 4 },
    headerTitle: { fontFamily: FONTS.displaySemi, fontSize: 17, color: COLORS.ink },
    headerRight: { position: "absolute", right: 12, flexDirection: "row", alignItems: "center", gap: 12 },
    endButton: { padding: 4 },
    endButtonText: { fontFamily: FONTS.sansMedium, fontSize: 15, color: COLORS.error },

    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 8 },
    timestamp: {
        fontFamily: FONTS.sansMedium, textAlign: "center", fontSize: 11,
        color: COLORS.inkMuted, marginTop: 16, marginBottom: 4,
    },

    messageRow: { flexDirection: "column" },
    rowUser: { alignItems: "flex-end" },
    rowAI: { alignItems: "flex-start" },

    bubbleWrap: { maxWidth: "70%" },
    bubble: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 16 },
    bubbleSent: { backgroundColor: SENT_COLOR },
    bubbleRecv: { backgroundColor: RECV_COLOR },
    bubbleText: { fontFamily: FONTS.sans, fontSize: 17, lineHeight: 22 },
    textSent: { color: COLORS.white },
    textRecv: { color: COLORS.ink },

    correctionDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "rgba(255,255,255,0.45)",
        marginVertical: 8,
    },
    correctionRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    correctionGoodText: {
        fontFamily: FONTS.sansMedium, fontSize: 13,
        color: COLORS.white, opacity: 0.95,
    },
    correctionText: {
        fontFamily: FONTS.sans, fontSize: 15, lineHeight: 20,
        color: COLORS.white, opacity: 0.92, fontStyle: "italic",
    },

    typingBubble: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 14, paddingHorizontal: 16 },
    typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.inkMuted },

    tappedTime: { fontSize: 11, color: COLORS.inkMuted, marginTop: 2, paddingHorizontal: 4 },

    inputBar: {
        flexDirection: "row", alignItems: "flex-end", gap: 6,
        paddingHorizontal: 8, paddingVertical: 6,
        backgroundColor: COLORS.bg,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderInput,
    },
    inputPill: {
        flex: 1, borderRadius: 20, borderWidth: 1, borderColor: COLORS.inkSubtle,
        backgroundColor: COLORS.surface, paddingHorizontal: 12,
    },
    input: {
        fontFamily: FONTS.sans, fontSize: 17, color: COLORS.ink,
        maxHeight: 100, minHeight: 36, paddingVertical: 8,
    },
    sendBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 2 },
    sendActive: { backgroundColor: SENT_COLOR },
    sendInactive: { backgroundColor: COLORS.inkSubtle },
    dictBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", marginBottom: 2 },
});
