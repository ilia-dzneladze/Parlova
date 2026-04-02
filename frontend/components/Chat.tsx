import { Ionicons } from "@expo/vector-icons";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Easing,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    PanResponder,
    Platform,
    Pressable,
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
import { getMessages, saveMessages, appendMessage, archiveConversation, markAsRead, markAsUnread, getConversation, ChatMessage, getDictionaryUsage, incrementDictionaryUsage, searchDictCache, getDictEntry, saveDictEntry, DictEntry } from "../src/db/database";
import { Conversation } from "../src/types/conversation";
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
    const { conversationId, conversationName } = route.params;
    const scrollRef = useRef<ScrollView>(null);
    const messagesRef = useRef<Message[]>([]);
    const mountedRef = useRef(true);
    const [conversation, setConversation] = useState<Conversation | null>(null);

    const [messages, setMessages] = useState<Message[]>([]);
    const [message, setMessage] = useState<string>("");
    const [isTyping, setIsTyping] = useState(false);
    const [tappedId, setTappedId] = useState<string | null>(null);

    // Dictionary state
    const DAILY_LIMIT = 5;
    const [dictVisible, setDictVisible] = useState(false);
    const [dictWord, setDictWord] = useState("");
    const [dictResults, setDictResults] = useState<DictEntry[]>([]);
    const [dictSelected, setDictSelected] = useState<DictEntry | null>(null);
    const [dictNotFound, setDictNotFound] = useState(false);
    const [dictError, setDictError] = useState<string | null>(null);
    const [dictLoading, setDictLoading] = useState(false);
    const [dictCount, setDictCount] = useState(0);

    useEffect(() => {
        getDictionaryUsage().then(setDictCount);
    }, []);

    // Live search the local cache as user types
    const handleDictSearch = useCallback(async (text: string) => {
        setDictWord(text);
        setDictSelected(null);
        setDictNotFound(false);
        setDictError(null);
        const trimmed = text.trim().toLowerCase();
        if (!trimmed) {
            setDictResults([]);
            return;
        }
        const results = await searchDictCache(trimmed);
        setDictResults(results);
        // If user typed an exact word and it's not in cache, show "not found"
        if (results.length === 0 || !results.some(r => r.word === trimmed)) {
            setDictNotFound(true);
        } else {
            setDictNotFound(false);
        }
    }, []);

    // Select a cached word — costs a daily lookup
    const handleSelectCached = useCallback((entry: DictEntry) => {
        setDictSelected(entry);
        setDictNotFound(false);
        setDictError(null);
    }, []);

    // Add a new word via API — costs a daily lookup
    const handleAddWord = useCallback(async () => {
        const trimmed = dictWord.trim().toLowerCase();
        if (!trimmed || dictCount >= DAILY_LIMIT) return;

        setDictLoading(true);
        setDictError(null);

        try {
            const resp = await fetch(`${API_BASE}/api/dictionary/${encodeURIComponent(trimmed)}`, {
                headers: { "ngrok-skip-browser-warning": "true" },
            });
            if (resp.status === 404) {
                setDictError("Word not found in PONS. Try another spelling.");
            } else if (!resp.ok) {
                setDictError("Lookup failed. Try again later.");
            } else {
                const data = await resp.json();
                const entry: DictEntry = {
                    word: data.word,
                    translations: JSON.stringify(data.translations),
                    partOfSpeech: data.partOfSpeech,
                    gender: data.gender,
                    example: data.example,
                };
                await saveDictEntry(entry);
                setDictSelected(entry);
                setDictNotFound(false);
                // Refresh search results to include the new word
                const results = await searchDictCache(trimmed);
                setDictResults(results);
                const newCount = await incrementDictionaryUsage();
                setDictCount(newCount);
            }
        } catch {
            setDictError("Network error. Check your connection.");
        } finally {
            setDictLoading(false);
        }
    }, [dictWord, dictCount]);

    const SCREEN_HEIGHT = Dimensions.get("window").height;
    const SHEET_HEIGHT = SCREEN_HEIGHT * 0.55;
    const sheetAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

    const openDictionary = useCallback((prefill?: string) => {
        setDictSelected(null);
        setDictNotFound(false);
        setDictError(null);
        if (prefill) {
            const word = prefill.trim().toLowerCase();
            setDictWord(word);
            // Trigger local search for the prefilled word
            searchDictCache(word).then((results) => {
                setDictResults(results);
                setDictNotFound(!results.some(r => r.word === word));
            });
        } else {
            setDictWord("");
            setDictResults([]);
        }
        setDictVisible(true);
        Animated.spring(sheetAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
        }).start();
    }, []);

    const closeDictionary = useCallback(() => {
        Keyboard.dismiss();
        Animated.timing(sheetAnim, {
            toValue: SHEET_HEIGHT,
            duration: 250,
            useNativeDriver: true,
            easing: Easing.in(Easing.ease),
        }).start(() => setDictVisible(false));
    }, []);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
            onPanResponderMove: (_, g) => {
                if (g.dy > 0) sheetAnim.setValue(g.dy);
            },
            onPanResponderRelease: (_, g) => {
                if (g.dy > 80 || g.vy > 0.5) {
                    closeDictionary();
                } else {
                    Animated.spring(sheetAnim, {
                        toValue: 0,
                        useNativeDriver: true,
                        damping: 20,
                        stiffness: 200,
                    }).start();
                }
            },
        })
    ).current;

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
            if (convo) setConversation(convo);
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
                            persona: conversation ? {
                                name: conversation.name,
                                persona: conversation.persona,
                                level: conversation.level,
                                question_freq: conversation.questionFreq,
                            } : undefined,
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

                    // Show follow-up question as a second bubble after a brief pause
                    if (data.follow_up) {
                        setIsTyping(true);
                        await new Promise(r => setTimeout(r, 800 + Math.random() * 700));
                        if (mountedRef.current) {
                            const followUpMsg: Message = {
                                id: uuid.v4() as string,
                                sender: "ai",
                                content: data.follow_up,
                                timestamp: Date.now(),
                            };
                            setIsTyping(false);
                            setMessages((prev) => [...prev, followUpMsg]);
                        }
                    }
                } else {
                    await appendMessage({
                        ...aiMsg,
                        conversationId,
                    });
                    if (data.follow_up) {
                        await appendMessage({
                            id: uuid.v4() as string,
                            conversationId,
                            sender: "ai",
                            content: data.follow_up,
                            timestamp: Date.now(),
                        });
                    }
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
                    <Text style={styles.headerTitle}>{conversationName}</Text>
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
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setTappedId(prev => prev === msg.id ? null : msg.id)}
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
                                            {!isUser ? (
                                                <Text style={[styles.bubbleText, styles.textRecv]}>
                                                    {msg.content.split(/(\s+)/).map((part, j) => {
                                                        if (/^\s+$/.test(part)) return part;
                                                        const clean = part.replace(/[^a-zA-ZäöüÄÖÜß-]/g, "");
                                                        return (
                                                            <Text
                                                                key={j}
                                                                onLongPress={clean.length > 1 ? () => openDictionary(clean) : undefined}
                                                                style={styles.textRecv}
                                                            >
                                                                {part}
                                                            </Text>
                                                        );
                                                    })}
                                                </Text>
                                            ) : (
                                                <Text style={[styles.bubbleText, styles.textSent]}>
                                                    {msg.content}
                                                </Text>
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
                    <TouchableOpacity onPress={() => openDictionary()} style={styles.dictBtn}>
                        <Ionicons name="book-outline" size={24} color={dictCount >= DAILY_LIMIT ? "#C7C7CC" : "#007AFF"} />
                    </TouchableOpacity>
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

                {/* Dictionary Modal */}
                <Modal visible={dictVisible} animationType="fade" transparent>
                    <KeyboardAvoidingView
                        style={styles.modalOverlay}
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                    >
                        <Pressable
                            style={styles.modalDismissArea}
                            onPress={closeDictionary}
                        />
                        <Animated.View style={[
                            styles.modalSheet,
                            {
                                transform: [{ translateY: sheetAnim }],
                                maxHeight: SCREEN_HEIGHT * 0.55,
                                paddingBottom: 40,
                            },
                        ]}>
                         {/* Drag handle */}
                         <View {...panResponder.panHandlers} style={styles.modalHandleArea}>
                            <View style={styles.modalHandle} />
                         </View>

                         <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Dictionary</Text>
                                <TouchableOpacity onPress={closeDictionary}>
                                    <Ionicons name="close-circle-outline" size={28} color="#8E8E93" />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.dictCounter}>
                                {dictCount >= DAILY_LIMIT
                                    ? "Daily limit reached. Come back tomorrow!"
                                    : `${dictCount} / ${DAILY_LIMIT} lookups used today`}
                            </Text>

                            {/* Search bar */}
                            <View style={styles.dictInputPill}>
                                <Ionicons name="search" size={16} color="#8E8E93" style={{ marginRight: 8 }} />
                                <TextInput
                                    placeholder="Search your dictionary..."
                                    placeholderTextColor="#8E8E93"
                                    value={dictWord}
                                    onChangeText={handleDictSearch}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    style={[styles.dictInput, { flex: 1 }]}
                                />
                            </View>

                            {/* Error */}
                            {dictError && (
                                <Text style={styles.dictError}>{dictError}</Text>
                            )}

                            {/* Selected word result */}
                            {dictSelected && (() => {
                                const translations: string[] = JSON.parse(dictSelected.translations);
                                return (
                                    <View style={styles.dictResultCard}>
                                        <View style={styles.dictResultHeader}>
                                            <Text style={styles.dictResultWord}>{dictSelected.word}</Text>
                                            {(dictSelected.partOfSpeech || dictSelected.gender) && (
                                                <Text style={styles.dictResultMeta}>
                                                    {[dictSelected.partOfSpeech, dictSelected.gender].filter(Boolean).join(" · ")}
                                                </Text>
                                            )}
                                        </View>
                                        <View style={styles.dictTranslations}>
                                            {translations.map((t, i) => (
                                                <View key={i} style={styles.dictTransRow}>
                                                    <Text style={styles.dictBullet}>•</Text>
                                                    <Text style={styles.dictTransText}>{t}</Text>
                                                </View>
                                            ))}
                                        </View>
                                        {dictSelected.example && (
                                            <View style={styles.dictExampleBox}>
                                                <Text style={styles.dictExampleLabel}>Example</Text>
                                                <Text style={styles.dictExampleText}>{dictSelected.example}</Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })()}

                            {/* Search results list (when no word is selected) */}
                            {!dictSelected && dictWord.trim().length > 0 && (
                                <View style={styles.dictListContainer}>
                                    {dictResults.map((entry) => (
                                        <TouchableOpacity
                                            key={entry.word}
                                            style={styles.dictListRow}
                                            onPress={() => handleSelectCached(entry)}
                                        >
                                            <Text style={styles.dictListWord}>{entry.word}</Text>
                                            <Text style={styles.dictListPreview} numberOfLines={1}>
                                                {JSON.parse(entry.translations).slice(0, 2).join(", ")}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}

                                    {/* Add new word button */}
                                    {dictNotFound && dictCount < DAILY_LIMIT && (
                                        <TouchableOpacity
                                            style={styles.dictAddRow}
                                            onPress={handleAddWord}
                                            disabled={dictLoading}
                                        >
                                            {dictLoading ? (
                                                <ActivityIndicator size="small" color="#007AFF" />
                                            ) : (
                                                <>
                                                    <Ionicons name="add-circle-outline" size={22} color="#007AFF" />
                                                    <Text style={styles.dictAddText}>
                                                        Look up "{dictWord.trim().toLowerCase()}"
                                                    </Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                         </ScrollView>
                        </Animated.View>
                    </KeyboardAvoidingView>
                </Modal>
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

    /* Tapped timestamp */
    tappedTime: {
        fontSize: 11,
        color: "#8E8E93",
        marginTop: 2,
        paddingHorizontal: 4,
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

    /* Dictionary button */
    dictBtn: {
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 2,
    },

    /* Modal */
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.35)",
        justifyContent: "flex-end",
    },
    modalDismissArea: {
        flex: 1,
    },
    modalSheet: {
        backgroundColor: "#FFF",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingHorizontal: 20,
    },
    modalHandleArea: {
        paddingTop: 8,
        paddingBottom: 4,
        alignItems: "center",
    },
    modalHandle: {
        width: 36,
        height: 5,
        borderRadius: 3,
        backgroundColor: "#D1D1D6",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "600",
        color: "#000",
    },

    /* Counter */
    dictCounter: {
        fontSize: 13,
        color: "#8E8E93",
        marginBottom: 14,
    },

    /* Search */
    dictInputPill: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 12,
        backgroundColor: "#F2F2F7",
        paddingHorizontal: 12,
        marginBottom: 12,
    },
    dictInput: {
        fontSize: 16,
        color: "#000",
        height: 40,
    },

    /* Search results list */
    dictListContainer: {
        backgroundColor: "#FFF",
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#C6C6C8",
    },
    dictListRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#C6C6C8",
    },
    dictListWord: {
        fontSize: 17,
        fontWeight: "500",
        color: "#000",
    },
    dictListPreview: {
        fontSize: 15,
        color: "#8E8E93",
        flex: 1,
        textAlign: "right",
        marginLeft: 12,
    },
    dictAddRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    dictAddText: {
        fontSize: 16,
        color: "#007AFF",
        fontWeight: "500",
    },

    /* Error */
    dictError: {
        fontSize: 15,
        color: "#FF3B30",
        textAlign: "center",
        marginTop: 8,
    },

    /* Result card */
    dictResultCard: {
        backgroundColor: "#F2F2F7",
        borderRadius: 12,
        padding: 16,
    },
    dictResultHeader: {
        marginBottom: 10,
    },
    dictResultWord: {
        fontSize: 22,
        fontWeight: "700",
        color: "#000",
    },
    dictResultMeta: {
        fontSize: 14,
        color: "#8E8E93",
        marginTop: 2,
    },
    dictTranslations: {
        marginBottom: 10,
    },
    dictTransRow: {
        flexDirection: "row",
        gap: 6,
        marginBottom: 3,
    },
    dictBullet: {
        fontSize: 16,
        color: "#007AFF",
        lineHeight: 22,
    },
    dictTransText: {
        fontSize: 16,
        color: "#000",
        lineHeight: 22,
        flex: 1,
    },
    dictExampleBox: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#C6C6C8",
        paddingTop: 10,
    },
    dictExampleLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "#8E8E93",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    dictExampleText: {
        fontSize: 15,
        color: "#3C3C43",
        fontStyle: "italic",
        lineHeight: 20,
    },
});
