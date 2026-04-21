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
import { getMessages, saveMessages, appendMessage, archiveConversation, markAsRead, markAsUnread, getConversation, saveQuestForConversation, getQuestForConversation, clearQuestForConversation, ChatMessage, getDictionaryUsage, incrementDictionaryUsage, searchDictCache, saveDictEntry, DictEntry } from "../src/db/database";
import { Conversation } from "../src/types/conversation";
import { RootStackParamList } from "../src/types/navigation";
import { Quest, EvaluationResult } from "../src/types/quest";
import { Message, SENT_COLOR, RECV_COLOR, DEFAULT_GREETING, formatTime, isLastInGroup, isFirstInGroup, showTimestamp } from "../src/utils/chat";
import QuestBriefing from "./QuestBriefing";
import QuestDebrief from "./QuestDebrief";
import { COLORS, FONTS } from "../constants/theme";

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

    // Quest state
    const [quest, setQuest] = useState<Quest | null>(null);
    const questRef = useRef<Quest | null>(null);
    const [showBriefing, setShowBriefing] = useState(false);
    const [showDebrief, setShowDebrief] = useState(false);

    // Dictionary state
    const DAILY_LIMIT = 5;
    const [dictVisible, setDictVisible] = useState(false);
    const [dictWord, setDictWord] = useState("");
    const [dictResults, setDictResults] = useState<DictEntry[]>([]);
    const [dictSelected, setDictSelected] = useState<DictEntry | null>(null);
    const [dictNotFound, setDictNotFound] = useState(false);
    const [dictDirection, setDictDirection] = useState<"de" | "en">("de");
    const [dictError, setDictError] = useState<string | null>(null);
    const [dictLoading, setDictLoading] = useState(false);
    const [dictCount, setDictCount] = useState(0);

    useEffect(() => {
        getDictionaryUsage().then(setDictCount);
    }, []);

    // Live search the local cache as user types
    const handleDictSearch = useCallback(async (text: string, dir?: "de" | "en") => {
        setDictWord(text);
        setDictSelected(null);
        setDictNotFound(false);
        setDictError(null);
        const trimmed = text.trim().toLowerCase();
        if (!trimmed) {
            setDictResults([]);
            return;
        }
        const direction = dir ?? dictDirection;
        const results = await searchDictCache(trimmed, direction);
        setDictResults(results);
        if (results.length === 0 || !results.some(r => r.word === trimmed)) {
            setDictNotFound(true);
        } else {
            setDictNotFound(false);
        }
    }, [dictDirection]);

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
            const resp = await fetch(
                `${API_BASE}/api/dictionary/${encodeURIComponent(trimmed)}?direction=${dictDirection}`,
                { headers: { "ngrok-skip-browser-warning": "true" } },
            );
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
                    headline: data.headline ?? null,
                    root: data.root ? JSON.stringify(data.root) : null,
                };
                await saveDictEntry(entry, dictDirection);
                // Save root form as its own independently-searchable cache entry (no usage charge)
                if (data.root) {
                    await saveDictEntry({
                        word: data.root.word,
                        translations: JSON.stringify(data.root.translations),
                        partOfSpeech: data.root.partOfSpeech,
                        gender: data.root.gender,
                        example: data.root.example,
                        headline: data.root.headline ?? null,
                        root: null,
                    }, "de");
                }
                setDictSelected(entry);
                setDictNotFound(false);
                const results = await searchDictCache(trimmed, dictDirection);
                setDictResults(results);
                const newCount = await incrementDictionaryUsage();
                setDictCount(newCount);
            }
        } catch {
            setDictError("Network error. Check your connection.");
        } finally {
            setDictLoading(false);
        }
    }, [dictWord, dictCount, dictDirection]);

    const SCREEN_HEIGHT = Dimensions.get("window").height;
    const SHEET_HEIGHT = SCREEN_HEIGHT * 0.5;
    const sheetAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

    const openDictionary = useCallback((prefill?: string) => {
        setDictSelected(null);
        setDictNotFound(false);
        setDictError(null);
        // Long-press from a message always uses DE→EN
        if (prefill) {
            setDictDirection("de");
            const word = prefill.trim().toLowerCase();
            setDictWord(word);
            searchDictCache(word, "de").then((results) => {
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
        questRef.current = quest;
    }, [quest]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        (async () => {
            await markAsRead(conversationId);
            const convo = await getConversation(conversationId);
            if (convo) setConversation(convo);
            const saved = await getMessages(conversationId);
            // "Fresh" = no messages, or only the default greeting
            const isFresh = saved.length === 0
                || (saved.length === 1 && saved[0].content === DEFAULT_GREETING);

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

            if (isFresh) {
                // Generate a new quest and persist it to SQLite
                try {
                    const resp = await fetch(`${API_BASE}/api/quest/generate`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "ngrok-skip-browser-warning": "true",
                        },
                        body: JSON.stringify({
                            level: convo?.level ?? "A1",
                            persona_name: convo?.name ?? conversationName,
                        }),
                    });
                    if (resp.ok) {
                        const questData: Quest = await resp.json();
                        await saveQuestForConversation(conversationId, questData);
                        setQuest(questData);
                        questRef.current = questData;
                        setShowBriefing(true);
                    }
                } catch {
                    // Quest generation failed — proceed without a quest
                }
            } else {
                // Restore quest from SQLite (handles app backgrounding / restart)
                const savedQuest = await getQuestForConversation(conversationId);
                if (savedQuest) {
                    setQuest(savedQuest);
                    questRef.current = savedQuest;
                }
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

        // Count user messages (including the one we just added)
        const userMsgCount = currentHistory.filter((m) => m.sender === "user").length + 1;

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
                            quest: questRef.current ?? undefined,
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

                    // Show follow-up / goodbye as a second bubble after a brief pause
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

                    // Conversation wrapped up — show debrief if quest active, otherwise archive
                    if (data.wrap_up && mountedRef.current) {
                        await new Promise(r => setTimeout(r, 2000));
                        if (mountedRef.current) {
                            if (quest) {
                                setShowDebrief(true);
                            } else {
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
                            }
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
                    if (data.wrap_up) {
                        await archiveConversation(conversationId);
                        await clearQuestForConversation(conversationId);
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
        doFetch();
    };

    const handleDebriefComplete = async (result: EvaluationResult) => {
        setShowDebrief(false);
        const msgs: ChatMessage[] = messagesRef.current.map((m) => ({
            id: m.id,
            conversationId,
            sender: m.sender,
            content: m.content,
            responseTime: m.responseTime,
            timestamp: m.timestamp,
        }));
        await saveMessages(conversationId, msgs);
        // Save debrief result into quest before archiving
        if (questRef.current) {
            const questWithResult = { ...questRef.current, debrief_result: result };
            await saveQuestForConversation(conversationId, questWithResult);
        }
        await archiveConversation(conversationId);
        await clearQuestForConversation(conversationId);
        setQuest(null);
        questRef.current = null;
        setMessages([{
            id: uuid.v4() as string,
            sender: "ai",
            content: DEFAULT_GREETING,
            timestamp: Date.now(),
        }]);
    };

    const handleEndConversation = () => {
        Alert.alert(
            "End Conversation",
            quest
                ? "Ready for your debrief?"
                : "This conversation will be archived. Start a new one?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: quest ? "Debrief" : "End",
                    style: quest ? "default" : "destructive",
                    onPress: async () => {
                        setIsTyping(false);
                        if (quest) {
                            setShowDebrief(true);
                        } else {
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
                        }
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
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigator.goBack()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={28} color={SENT_COLOR} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{conversationName}</Text>
                    <View style={styles.headerRight}>
                        {quest && (
                            <TouchableOpacity onPress={() => setShowBriefing(true)} style={styles.questBtn}>
                                <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
                            </TouchableOpacity>
                        )}
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
                        <Ionicons name="book-outline" size={24} color={dictCount >= DAILY_LIMIT ? COLORS.inkSubtle : COLORS.primary} />
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

                {/* Quest Briefing */}
                {quest && (
                    <QuestBriefing
                        quest={quest}
                        visible={showBriefing}
                        onDismiss={() => setShowBriefing(false)}
                    />
                )}

                {/* Quest Debrief */}
                {quest && (
                    <QuestDebrief
                        quest={quest}
                        visible={showDebrief}
                        onComplete={handleDebriefComplete}
                    />
                )}

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
                                height: SHEET_HEIGHT,
                            },
                        ]}>
                         {/* Drag handle */}
                         <View {...panResponder.panHandlers} style={styles.modalHandleArea}>
                            <View style={styles.modalHandle} />
                         </View>

                         <ScrollView
                             keyboardShouldPersistTaps="handled"
                             bounces={false}
                             style={{ flex: 1 }}
                             contentContainerStyle={{ paddingBottom: 40 }}
                         >
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Dictionary</Text>
                                <TouchableOpacity onPress={closeDictionary}>
                                    <Ionicons name="close-circle-outline" size={28} color={COLORS.inkMuted} />
                                </TouchableOpacity>
                            </View>

                            {/* Direction toggle */}
                            <View style={styles.dictToggleRow}>
                                <TouchableOpacity
                                    style={[styles.dictToggleBtn, dictDirection === "de" && styles.dictToggleActive]}
                                    onPress={() => {
                                        setDictDirection("de");
                                        setDictWord("");
                                        setDictResults([]);
                                        setDictSelected(null);
                                        setDictNotFound(false);
                                        setDictError(null);
                                    }}
                                >
                                    <Text style={[styles.dictToggleText, dictDirection === "de" && styles.dictToggleTextActive]}>
                                        DE → EN
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.dictToggleBtn, dictDirection === "en" && styles.dictToggleActive]}
                                    onPress={() => {
                                        setDictDirection("en");
                                        setDictWord("");
                                        setDictResults([]);
                                        setDictSelected(null);
                                        setDictNotFound(false);
                                        setDictError(null);
                                    }}
                                >
                                    <Text style={[styles.dictToggleText, dictDirection === "en" && styles.dictToggleTextActive]}>
                                        EN → DE
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.dictCounter}>
                                {dictCount >= DAILY_LIMIT
                                    ? "Daily limit reached. Come back tomorrow!"
                                    : `${dictCount} / ${DAILY_LIMIT} lookups used today`}
                            </Text>

                            {/* Search bar */}
                            <View style={styles.dictInputPill}>
                                <Ionicons name="search" size={16} color={COLORS.inkMuted} style={{ marginRight: 8 }} />
                                <TextInput
                                    placeholder={dictDirection === "de" ? "Search German words..." : "Search English words..."}
                                    placeholderTextColor={COLORS.inkSubtle}
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
                                const root = dictSelected.root ? JSON.parse(dictSelected.root) : null;
                                const rootTranslations: string[] | null = root ? (root.translations as string[]) : null;
                                return (
                                    <>
                                    <View style={styles.dictResultCard}>
                                        <View style={styles.dictResultHeader}>
                                            <View style={styles.dictResultWordRow}>
                                                <Text style={styles.dictResultWord}>{dictSelected.word}</Text>
                                                {dictSelected.headline && (
                                                    <Text style={styles.dictResultHeadline}> — {dictSelected.headline}</Text>
                                                )}
                                            </View>
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
                                    {root && rootTranslations && (
                                        <View style={[styles.dictResultCard, styles.dictRootCard]}>
                                            <View style={styles.dictResultHeader}>
                                                <Text style={styles.dictRootLabel}>Root form</Text>
                                                <View style={styles.dictResultWordRow}>
                                                    <Text style={styles.dictResultWord}>{root.word}</Text>
                                                    {root.headline && (
                                                        <Text style={styles.dictResultHeadline}> — {root.headline}</Text>
                                                    )}
                                                </View>
                                                {(root.partOfSpeech || root.gender) && (
                                                    <Text style={styles.dictResultMeta}>
                                                        {[root.partOfSpeech, root.gender].filter(Boolean).join(" · ")}
                                                    </Text>
                                                )}
                                            </View>
                                            <View style={styles.dictTranslations}>
                                                {rootTranslations.slice(0, 3).map((t: string, i: number) => (
                                                    <View key={i} style={styles.dictTransRow}>
                                                        <Text style={styles.dictBullet}>•</Text>
                                                        <Text style={styles.dictTransText}>{t}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                            {root.example && (
                                                <View style={styles.dictExampleBox}>
                                                    <Text style={styles.dictExampleLabel}>Example</Text>
                                                    <Text style={styles.dictExampleText}>{root.example}</Text>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                    </>
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
                                                <ActivityIndicator size="small" color={COLORS.primary} />
                                            ) : (
                                                <>
                                                    <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
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
        backgroundColor: COLORS.bg,
    },
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },

    /* Header */
    header: {
        height: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.borderInput,
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
    headerRight: {
        position: "absolute",
        right: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    questBtn: {
        padding: 4,
    },
    endButton: {
        padding: 4,
    },
    endButtonText: {
        fontFamily: FONTS.sansMedium,
        fontSize: 15,
        color: COLORS.error,
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
        fontFamily: FONTS.sansMedium,
        textAlign: "center",
        fontSize: 11,
        color: COLORS.inkMuted,
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
        fontFamily: FONTS.sans,
        fontSize: 17,
        lineHeight: 22,
    },
    textSent: {
        color: COLORS.white,
    },
    textRecv: {
        color: COLORS.ink,
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
        backgroundColor: COLORS.inkMuted,
    },

    /* Tapped timestamp */
    tappedTime: {
        fontSize: 11,
        color: COLORS.inkMuted,
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
        backgroundColor: COLORS.bg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.borderInput,
    },
    inputPill: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.inkSubtle,
        backgroundColor: COLORS.surface,
        paddingHorizontal: 12,
    },
    input: {
        fontFamily: FONTS.sans,
        fontSize: 17,
        color: COLORS.ink,
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
        backgroundColor: COLORS.inkSubtle,
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
        backgroundColor: COLORS.surface,
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
        backgroundColor: COLORS.border,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    modalTitle: {
        fontFamily: FONTS.displayBold,
        fontSize: 20,
        color: COLORS.ink,
        letterSpacing: -0.3,
    },

    /* Direction toggle */
    dictToggleRow: {
        flexDirection: "row",
        backgroundColor: COLORS.primaryPale,
        borderRadius: 10,
        padding: 2,
        marginBottom: 12,
    },
    dictToggleBtn: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: 8,
        alignItems: "center",
    },
    dictToggleActive: {
        backgroundColor: COLORS.surface,
        shadowColor: COLORS.ink,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    dictToggleText: {
        fontFamily: FONTS.sansMedium,
        fontSize: 14,
        color: COLORS.inkMuted,
    },
    dictToggleTextActive: {
        color: COLORS.ink,
    },

    /* Counter */
    dictCounter: {
        fontFamily: FONTS.sans,
        fontSize: 13,
        color: COLORS.inkMuted,
        marginBottom: 14,
    },

    /* Search */
    dictInputPill: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 12,
        backgroundColor: COLORS.primaryPale,
        paddingHorizontal: 12,
        marginBottom: 12,
    },
    dictInput: {
        fontFamily: FONTS.sans,
        fontSize: 16,
        color: COLORS.ink,
        height: 40,
    },

    /* Search results list */
    dictListContainer: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: COLORS.border,
    },
    dictListRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    dictListWord: {
        fontFamily: FONTS.sansMedium,
        fontSize: 17,
        color: COLORS.ink,
    },
    dictListPreview: {
        fontSize: 15,
        color: COLORS.inkMuted,
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
        fontFamily: FONTS.sansSemi,
        fontSize: 16,
        color: COLORS.primary,
    },

    /* Error */
    dictError: {
        fontSize: 15,
        color: COLORS.error,
        textAlign: "center",
        marginTop: 8,
    },

    /* Result card */
    dictResultCard: {
        backgroundColor: COLORS.primaryPale,
        borderRadius: 12,
        padding: 16,
    },
    dictResultHeader: {
        marginBottom: 10,
    },
    dictResultWordRow: {
        flexDirection: "row",
        alignItems: "baseline",
        flexWrap: "wrap",
    },
    dictResultWord: {
        fontFamily: FONTS.displayBold,
        fontSize: 22,
        color: COLORS.ink,
        letterSpacing: -0.3,
    },
    dictResultHeadline: {
        fontFamily: FONTS.displaySemi,
        fontSize: 18,
        color: COLORS.primary,
        letterSpacing: -0.2,
    },
    dictResultMeta: {
        fontSize: 14,
        color: COLORS.inkMuted,
        marginTop: 2,
    },
    dictRootCard: {
        marginTop: 10,
        backgroundColor: COLORS.bg,
    },
    dictRootLabel: {
        fontFamily: FONTS.sansMedium,
        fontSize: 11,
        color: COLORS.inkMuted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 2,
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
        color: COLORS.primary,
        lineHeight: 22,
    },
    dictTransText: {
        fontSize: 16,
        color: COLORS.ink,
        lineHeight: 22,
        flex: 1,
    },
    dictExampleBox: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.border,
        paddingTop: 10,
    },
    dictExampleLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: COLORS.inkMuted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    dictExampleText: {
        fontSize: 15,
        color: COLORS.ink,
        fontStyle: "italic",
        lineHeight: 20,
    },
});
