import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
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
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { COLORS, FONTS } from "../constants/theme";
import { API_BASE } from "../constants/api";
import {
    saveDictEntry,
    saveSentence,
    isSentenceSaved,
    getAllDictEntries,
    getAllSavedSentences,
    DictEntry,
    SavedSentence,
} from "../src/db/database";

type LookupEntry = {
    word: string;
    translations: string[];
    partOfSpeech: string | null;
    gender: string | null;
    example: string | null;
    headline: string | null;
    root: LookupEntry | null;
    source: "dict" | "translate";
};

type Props = {
    visible: boolean;
    onClose: () => void;
    initialText?: string;
    initialLang?: "de" | "en";
};

type Token = { kind: "word"; raw: string; clean: string } | { kind: "space"; raw: string };

const WORD_RE = /([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß''-]*)/;
const SINGLE_WORD_RE = /^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß''-]*$/;

function tokenize(text: string): Token[] {
    const parts = text.split(WORD_RE);
    const tokens: Token[] = [];
    for (const part of parts) {
        if (!part) continue;
        if (WORD_RE.test(part)) {
            tokens.push({ kind: "word", raw: part, clean: part.toLowerCase() });
        } else {
            tokens.push({ kind: "space", raw: part });
        }
    }
    return tokens;
}

const LookupSheet: React.FC<Props> = ({
    visible,
    onClose,
    initialText,
    initialLang = "de",
}) => {
    const SCREEN_HEIGHT = Dimensions.get("window").height;
    const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.58);
    const sheetAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

    const [searchLang, setSearchLang] = useState<"de" | "en">(initialLang);
    const [searchInput, setSearchInput] = useState("");

    const [activeText, setActiveText] = useState<string>("");
    const [activeLang, setActiveLang] = useState<"de" | "en">(initialLang);
    const targetLang: "de" | "en" = activeLang === "de" ? "en" : "de";

    const [selectedWord, setSelectedWord] = useState<string | null>(null);
    const [lookupEntry, setLookupEntry] = useState<LookupEntry | null>(null);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupError, setLookupError] = useState<string | null>(null);

    const [sentenceTranslation, setSentenceTranslation] = useState<string | null>(null);
    const [sentenceLoading, setSentenceLoading] = useState(false);
    const [sentenceError, setSentenceError] = useState<string | null>(null);
    const [sentenceSaved, setSentenceSaved] = useState(false);

    const [savedWords, setSavedWords] = useState<DictEntry[]>([]);
    const [savedSentences, setSavedSentences] = useState<SavedSentence[]>([]);

    const loadSaved = useCallback(() => {
        getAllDictEntries().then(setSavedWords);
        getAllSavedSentences().then(setSavedSentences);
    }, []);

    useEffect(() => {
        if (!visible) return;
        setSelectedWord(null);
        setLookupEntry(null);
        setLookupError(null);
        setSentenceTranslation(null);
        setSentenceError(null);
        setSentenceSaved(false);
        setSearchInput("");
        setSearchLang(initialLang);
        setActiveText(initialText ?? "");
        setActiveLang(initialLang);
        loadSaved();
        sheetAnim.setValue(SHEET_HEIGHT);
        Animated.spring(sheetAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
        }).start();
    }, [visible, initialText, initialLang]);

    const close = useCallback(() => {
        Keyboard.dismiss();
        Animated.timing(sheetAnim, {
            toValue: SHEET_HEIGHT,
            duration: 240,
            useNativeDriver: true,
            easing: Easing.in(Easing.ease),
        }).start(() => onClose());
    }, [onClose, SHEET_HEIGHT]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
            onPanResponderMove: (_, g) => {
                if (g.dy > 0) sheetAnim.setValue(g.dy);
            },
            onPanResponderRelease: (_, g) => {
                if (g.dy > 80 || g.vy > 0.5) {
                    close();
                } else {
                    Animated.spring(sheetAnim, {
                        toValue: 0,
                        useNativeDriver: true,
                        damping: 20,
                        stiffness: 200,
                    }).start();
                }
            },
        }),
    ).current;

    const fetchLookup = async (clean: string, src: "de" | "en") => {
        setLookupEntry(null);
        setLookupError(null);
        setLookupLoading(true);
        try {
            const resp = await fetch(
                `${API_BASE}/api/lookup/${encodeURIComponent(clean)}?direction=${src}`,
                { headers: { "ngrok-skip-browser-warning": "true" } },
            );
            if (!resp.ok) {
                setLookupError(resp.status === 404 ? "Not found." : "Lookup failed.");
                return;
            }
            const data: LookupEntry = await resp.json();
            setLookupEntry(data);

            const entry: DictEntry = {
                word: data.word,
                translations: JSON.stringify(data.translations),
                partOfSpeech: data.partOfSpeech,
                gender: data.gender,
                example: data.example,
                headline: data.headline,
                root: data.root ? JSON.stringify(data.root) : null,
            };
            await saveDictEntry(entry, src);
            if (data.root) {
                await saveDictEntry({
                    word: data.root.word,
                    translations: JSON.stringify(data.root.translations),
                    partOfSpeech: data.root.partOfSpeech,
                    gender: data.root.gender,
                    example: data.root.example,
                    headline: data.root.headline,
                    root: null,
                }, src);
            }
            loadSaved();
        } catch {
            setLookupError("Network error.");
        } finally {
            setLookupLoading(false);
        }
    };

    const handleWordTap = (clean: string, langOverride?: "de" | "en") => {
        const src = langOverride ?? activeLang;
        setSelectedWord(clean);
        fetchLookup(clean, src);
    };

    const translateSentence = async (text: string, src: "de" | "en") => {
        const tgt: "de" | "en" = src === "de" ? "en" : "de";
        setSentenceLoading(true);
        setSentenceError(null);
        setSentenceSaved(false);
        try {
            const resp = await fetch(`${API_BASE}/api/translate`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
                body: JSON.stringify({ text, source: src, target: tgt }),
            });
            if (!resp.ok) {
                setSentenceError("Translation failed.");
                return;
            }
            const data = await resp.json();
            setSentenceTranslation(data.translated);
            const already = await isSentenceSaved(text, src, tgt);
            setSentenceSaved(already);
        } catch {
            setSentenceError("Network error.");
        } finally {
            setSentenceLoading(false);
        }
    };

    const handleTranslateActive = () => {
        if (!activeText) return;
        translateSentence(activeText, activeLang);
    };

    const handleSaveSentence = async () => {
        if (!sentenceTranslation) return;
        await saveSentence(activeText, sentenceTranslation, activeLang, targetLang);
        setSentenceSaved(true);
        loadSaved();
    };

    const handleSearchChange = (text: string) => {
        setSearchInput(text);
        if (text.length > 0) {
            setActiveText("");
            setSelectedWord(null);
            setLookupEntry(null);
            setLookupError(null);
            setSentenceTranslation(null);
            setSentenceError(null);
            setSentenceSaved(false);
        }
    };

    const handleSearchSubmit = () => {
        const trimmed = searchInput.trim();
        if (!trimmed) return;
        Keyboard.dismiss();
        setActiveText(trimmed);
        setActiveLang(searchLang);
        setSelectedWord(null);
        setLookupEntry(null);
        setLookupError(null);
        setSentenceTranslation(null);
        setSentenceError(null);
        setSentenceSaved(false);

        if (SINGLE_WORD_RE.test(trimmed)) {
            fetchLookup(trimmed.toLowerCase(), searchLang);
        } else {
            setTimeout(() => translateSentence(trimmed, searchLang), 0);
        }
    };

    const handlePickSavedWord = (word: string) => {
        setSearchInput("");
        Keyboard.dismiss();
        setActiveText(word);
        setActiveLang(searchLang);
        setSelectedWord(null);
        setSentenceTranslation(null);
        setSentenceError(null);
        setSentenceSaved(false);
        fetchLookup(word.toLowerCase(), searchLang);
    };

    const handlePickSavedSentence = (s: SavedSentence) => {
        setSearchInput("");
        Keyboard.dismiss();
        setActiveText(s.sourceText);
        setActiveLang(s.sourceLang as "de" | "en");
        setSelectedWord(null);
        setLookupEntry(null);
        setLookupError(null);
        setSentenceTranslation(s.translation);
        setSentenceError(null);
        setSentenceSaved(true);
    };

    const suggestions = useMemo(() => {
        const q = searchInput.trim().toLowerCase();
        if (!q) return { words: [] as DictEntry[], sentences: [] as SavedSentence[] };

        const wordPrefix: DictEntry[] = [];
        const wordOther: DictEntry[] = [];
        for (const w of savedWords) {
            const lw = w.word.toLowerCase();
            if (lw.startsWith(q)) wordPrefix.push(w);
            else if (lw.includes(q)) wordOther.push(w);
        }
        wordPrefix.sort((a, b) => a.word.toLowerCase().localeCompare(b.word.toLowerCase()));
        wordOther.sort((a, b) => a.word.toLowerCase().localeCompare(b.word.toLowerCase()));
        const words = [...wordPrefix, ...wordOther].slice(0, 5);

        const sentPrefix: SavedSentence[] = [];
        const sentOther: SavedSentence[] = [];
        for (const s of savedSentences) {
            const src = s.sourceText.toLowerCase();
            const tr = s.translation.toLowerCase();
            if (src.startsWith(q) || tr.startsWith(q)) sentPrefix.push(s);
            else if (src.includes(q) || tr.includes(q)) sentOther.push(s);
        }
        sentPrefix.sort((a, b) => a.sourceText.toLowerCase().localeCompare(b.sourceText.toLowerCase()));
        sentOther.sort((a, b) => a.sourceText.toLowerCase().localeCompare(b.sourceText.toLowerCase()));
        const sentences = [...sentPrefix, ...sentOther].slice(0, 3);

        return { words, sentences };
    }, [searchInput, savedWords, savedSentences]);

    const hasSuggestions = suggestions.words.length > 0 || suggestions.sentences.length > 0;
    const tokens = activeText ? tokenize(activeText) : [];
    const hasContent = activeText.trim().length > 0;
    const showSuggestionPanel = searchInput.trim().length > 0;
    const isSingleWordActive = hasContent && SINGLE_WORD_RE.test(activeText.trim()) && !selectedWord;
    const showInlineLookup = isSingleWordActive && (lookupLoading || lookupEntry !== null || lookupError !== null);

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={close}>
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <Pressable style={styles.dismissArea} onPress={close} />
                <Animated.View style={[
                    styles.sheet,
                    { transform: [{ translateY: sheetAnim }], height: SHEET_HEIGHT },
                ]}>
                    <View {...panResponder.panHandlers} style={styles.handleArea}>
                        <View style={styles.handle} />
                    </View>

                    <View style={styles.header}>
                        <Text style={styles.title}>Dictionary</Text>
                        <TouchableOpacity onPress={close}>
                            <Ionicons name="close-circle-outline" size={26} color={COLORS.inkMuted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 20 }}
                    >
                        <View style={styles.dirToggleRow}>
                            <TouchableOpacity
                                style={[styles.dirToggleBtn, searchLang === "de" && styles.dirToggleActive]}
                                onPress={() => setSearchLang("de")}
                            >
                                <Text style={[styles.dirToggleText, searchLang === "de" && styles.dirToggleTextActive]}>DE → EN</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.dirToggleBtn, searchLang === "en" && styles.dirToggleActive]}
                                onPress={() => setSearchLang("en")}
                            >
                                <Text style={[styles.dirToggleText, searchLang === "en" && styles.dirToggleTextActive]}>EN → DE</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchPill}>
                            <Ionicons name="search" size={16} color={COLORS.inkMuted} style={{ marginRight: 8 }} />
                            <TextInput
                                placeholder={searchLang === "de" ? "Word or sentence in German..." : "Word or sentence in English..."}
                                placeholderTextColor={COLORS.inkSubtle}
                                value={searchInput}
                                onChangeText={handleSearchChange}
                                onSubmitEditing={handleSearchSubmit}
                                returnKeyType="search"
                                autoCapitalize="none"
                                autoCorrect={false}
                                style={styles.searchInput}
                            />
                        </View>

                        {showSuggestionPanel && hasSuggestions && (
                            <View style={styles.suggestBox}>
                                <Text style={styles.suggestHint}>From your library</Text>
                                {suggestions.words.map(w => {
                                    const trs: string[] = (() => {
                                        try { return JSON.parse(w.translations); } catch { return []; }
                                    })();
                                    return (
                                        <TouchableOpacity
                                            key={`w:${w.word}`}
                                            style={styles.suggestRow}
                                            onPress={() => handlePickSavedWord(w.word)}
                                        >
                                            <Ionicons name="book-outline" size={16} color={COLORS.primary} />
                                            <Text style={styles.suggestWord}>{w.word}</Text>
                                            <Text style={styles.suggestSub} numberOfLines={1}>
                                                {trs.slice(0, 2).join(", ")}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                                {suggestions.sentences.map(s => (
                                    <TouchableOpacity
                                        key={`s:${s.id}`}
                                        style={styles.suggestRow}
                                        onPress={() => handlePickSavedSentence(s)}
                                    >
                                        <Ionicons name="chatbox-outline" size={16} color={COLORS.primary} />
                                        <Text style={styles.suggestSentence} numberOfLines={1}>
                                            {s.sourceText}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {showSuggestionPanel && (
                            <TouchableOpacity
                                style={styles.searchBtn}
                                onPress={handleSearchSubmit}
                            >
                                <Ionicons name="search" size={18} color={COLORS.white} />
                                <Text style={styles.searchBtnText}>Search</Text>
                            </TouchableOpacity>
                        )}

                        {hasContent && !isSingleWordActive && (
                            <View style={styles.messageCard}>
                                <Text style={styles.messageText}>
                                    {tokens.map((t, i) => {
                                        if (t.kind === "space") return <Text key={i}>{t.raw}</Text>;
                                        const isSelected = selectedWord === t.clean;
                                        return (
                                            <Text
                                                key={i}
                                                onPress={() => handleWordTap(t.clean)}
                                                style={[styles.wordToken, isSelected && styles.wordTokenActive]}
                                            >
                                                {t.raw}
                                            </Text>
                                        );
                                    })}
                                </Text>
                            </View>
                        )}

                        {showInlineLookup && (
                            <View style={styles.inlineLookupCard}>
                                {lookupLoading && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />}
                                {lookupError && <Text style={styles.errorText}>{lookupError}</Text>}
                                {lookupEntry && (
                                    <>
                                        <Text style={styles.inlineWord}>{lookupEntry.word}</Text>
                                        {(lookupEntry.partOfSpeech || lookupEntry.gender) && (
                                            <Text style={styles.popupMeta}>
                                                {[lookupEntry.partOfSpeech, lookupEntry.gender].filter(Boolean).join(" · ")}
                                            </Text>
                                        )}
                                        {lookupEntry.headline && (
                                            <Text style={styles.popupHeadline}>{lookupEntry.headline}</Text>
                                        )}
                                        <Text style={styles.sectionLabel}>Meaning</Text>
                                        <View style={styles.transList}>
                                            {lookupEntry.translations.map((t, i) => (
                                                <View key={i} style={styles.transRow}>
                                                    <Text style={styles.bullet}>•</Text>
                                                    <Text style={styles.transText}>{t}</Text>
                                                </View>
                                            ))}
                                        </View>
                                        {lookupEntry.example && (
                                            <>
                                                <Text style={styles.sectionLabel}>Example</Text>
                                                <Text style={styles.exampleText}>{lookupEntry.example}</Text>
                                            </>
                                        )}
                                        {lookupEntry.root && (
                                            <View style={styles.rootBlock}>
                                                <Text style={styles.sectionLabel}>Root form</Text>
                                                <Text style={styles.popupWordSmall}>{lookupEntry.root.word}</Text>
                                                {(lookupEntry.root.partOfSpeech || lookupEntry.root.gender) && (
                                                    <Text style={styles.popupMeta}>
                                                        {[lookupEntry.root.partOfSpeech, lookupEntry.root.gender].filter(Boolean).join(" · ")}
                                                    </Text>
                                                )}
                                                <View style={styles.transList}>
                                                    {lookupEntry.root.translations.slice(0, 3).map((t, i) => (
                                                        <View key={i} style={styles.transRow}>
                                                            <Text style={styles.bullet}>•</Text>
                                                            <Text style={styles.transText}>{t}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                                {lookupEntry.root.example && <Text style={styles.exampleText}>{lookupEntry.root.example}</Text>}
                                            </View>
                                        )}
                                        {lookupEntry.source === "translate" && (
                                            <Text style={styles.sourceHint}>via Google Translate</Text>
                                        )}
                                    </>
                                )}
                            </View>
                        )}

                        {hasContent && !SINGLE_WORD_RE.test(activeText.trim()) && (
                            <TouchableOpacity
                                style={styles.translateBtn}
                                onPress={handleTranslateActive}
                                disabled={sentenceLoading}
                            >
                                {sentenceLoading ? (
                                    <ActivityIndicator color={COLORS.white} />
                                ) : (
                                    <>
                                        <Ionicons name="language" size={18} color={COLORS.white} />
                                        <Text style={styles.translateBtnText}>
                                            {sentenceTranslation ? "Translate Again" : "Translate Whole Sentence"}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}

                        {sentenceError && <Text style={styles.errorText}>{sentenceError}</Text>}

                        {sentenceTranslation && (
                            <View style={styles.sentenceCard}>
                                <Text style={styles.sentenceLabel}>Translation</Text>
                                <Text style={styles.sentenceText}>{sentenceTranslation}</Text>
                                <TouchableOpacity
                                    style={[styles.saveBtn, sentenceSaved && styles.saveBtnDone]}
                                    onPress={handleSaveSentence}
                                    disabled={sentenceSaved}
                                >
                                    <Ionicons
                                        name={sentenceSaved ? "checkmark-circle" : "bookmark-outline"}
                                        size={18}
                                        color={sentenceSaved ? COLORS.white : COLORS.primary}
                                    />
                                    <Text style={[styles.saveBtnText, sentenceSaved && styles.saveBtnTextDone]}>
                                        {sentenceSaved ? "Saved" : "Save Translation"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </Animated.View>

                <WordPopup
                    visible={selectedWord !== null}
                    word={selectedWord}
                    loading={lookupLoading}
                    error={lookupError}
                    entry={lookupEntry}
                    onClose={() => {
                        setSelectedWord(null);
                        setLookupEntry(null);
                        setLookupError(null);
                    }}
                />
            </KeyboardAvoidingView>
        </Modal>
    );
};

const WordPopup: React.FC<{
    visible: boolean;
    word: string | null;
    loading: boolean;
    error: string | null;
    entry: LookupEntry | null;
    onClose: () => void;
}> = ({ visible, word, loading, error, entry, onClose }) => {
    if (!visible) return null;
    const root = entry?.root ?? null;

    return (
        <Pressable style={styles.popupBackdrop} onPress={onClose}>
            <Pressable style={styles.popupCard} onPress={(e) => e.stopPropagation()}>
                <View style={styles.popupHeader}>
                    <Text style={styles.popupWord}>{entry?.word ?? word ?? ""}</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={12}>
                        <Ionicons name="close" size={22} color={COLORS.inkMuted} />
                    </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ paddingBottom: 8 }}>
                    {loading && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />}
                    {error && <Text style={styles.errorText}>{error}</Text>}
                    {entry && (
                        <>
                            {(entry.partOfSpeech || entry.gender) && (
                                <Text style={styles.popupMeta}>
                                    {[entry.partOfSpeech, entry.gender].filter(Boolean).join(" · ")}
                                </Text>
                            )}
                            {entry.headline && (
                                <Text style={styles.popupHeadline}>{entry.headline}</Text>
                            )}

                            <Text style={styles.sectionLabel}>Meaning</Text>
                            <View style={styles.transList}>
                                {entry.translations.map((t, i) => (
                                    <View key={i} style={styles.transRow}>
                                        <Text style={styles.bullet}>•</Text>
                                        <Text style={styles.transText}>{t}</Text>
                                    </View>
                                ))}
                            </View>

                            {entry.example && (
                                <>
                                    <Text style={styles.sectionLabel}>Example</Text>
                                    <Text style={styles.exampleText}>{entry.example}</Text>
                                </>
                            )}

                            {root && (
                                <View style={styles.rootBlock}>
                                    <Text style={styles.sectionLabel}>Root form</Text>
                                    <Text style={styles.popupWordSmall}>{root.word}</Text>
                                    {(root.partOfSpeech || root.gender) && (
                                        <Text style={styles.popupMeta}>
                                            {[root.partOfSpeech, root.gender].filter(Boolean).join(" · ")}
                                        </Text>
                                    )}
                                    <View style={styles.transList}>
                                        {root.translations.slice(0, 3).map((t, i) => (
                                            <View key={i} style={styles.transRow}>
                                                <Text style={styles.bullet}>•</Text>
                                                <Text style={styles.transText}>{t}</Text>
                                            </View>
                                        ))}
                                    </View>
                                    {root.example && <Text style={styles.exampleText}>{root.example}</Text>}
                                </View>
                            )}

                            {entry.source === "translate" && (
                                <Text style={styles.sourceHint}>via Google Translate</Text>
                            )}
                        </>
                    )}
                </ScrollView>
            </Pressable>
        </Pressable>
    );
};

export default LookupSheet;

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
    dismissArea: { flex: 1 },
    sheet: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    handleArea: { paddingTop: 8, paddingBottom: 4, alignItems: "center" },
    handle: { width: 36, height: 5, borderRadius: 3, backgroundColor: COLORS.border },

    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingBottom: 6,
    },
    title: { fontFamily: FONTS.displayBold, fontSize: 18, color: COLORS.ink, letterSpacing: -0.3 },

    dirToggleRow: {
        flexDirection: "row",
        backgroundColor: COLORS.primaryPale,
        borderRadius: 10,
        padding: 2,
        marginBottom: 8,
    },
    dirToggleBtn: { flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: "center" },
    dirToggleActive: {
        backgroundColor: COLORS.surface,
        shadowColor: COLORS.ink,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    dirToggleText: { fontFamily: FONTS.sansMedium, fontSize: 13, color: COLORS.inkMuted },
    dirToggleTextActive: { color: COLORS.ink },

    searchPill: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 12,
        backgroundColor: COLORS.primaryPale,
        paddingHorizontal: 12,
        marginBottom: 10,
    },
    searchInput: {
        flex: 1,
        fontFamily: FONTS.sans,
        fontSize: 15,
        color: COLORS.ink,
        height: 40,
    },

    suggestBox: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: COLORS.border,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 10,
        backgroundColor: COLORS.bg,
    },
    suggestHint: {
        fontFamily: FONTS.sansMedium,
        fontSize: 11,
        color: COLORS.inkMuted,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        marginBottom: 6,
    },
    suggestRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 9,
    },
    suggestWord: {
        fontFamily: FONTS.sansSemi,
        fontSize: 16,
        color: COLORS.ink,
    },
    suggestSub: {
        fontFamily: FONTS.sans,
        fontSize: 14,
        color: COLORS.inkMuted,
        flex: 1,
    },
    suggestSentence: {
        fontFamily: FONTS.sans,
        fontSize: 15,
        color: COLORS.ink,
        flex: 1,
    },
    searchBtn: {
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        paddingVertical: 12,
        marginBottom: 10,
    },
    searchBtnText: { fontFamily: FONTS.sansSemi, fontSize: 15, color: COLORS.white },

    messageCard: {
        backgroundColor: COLORS.primaryPale,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
    },
    inlineLookupCard: {
        backgroundColor: COLORS.bg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: COLORS.border,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
    },
    inlineWord: {
        fontFamily: FONTS.displayBold,
        fontSize: 24,
        color: COLORS.ink,
        letterSpacing: -0.3,
        marginBottom: 4,
    },
    messageText: { fontFamily: FONTS.sans, fontSize: 16, lineHeight: 24, color: COLORS.ink },
    wordToken: {
        color: COLORS.ink,
        textDecorationLine: "underline",
        textDecorationStyle: "dotted",
        textDecorationColor: COLORS.primary,
    },
    wordTokenActive: {
        backgroundColor: COLORS.primary,
        color: COLORS.white,
    },

    translateBtn: {
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        paddingVertical: 12,
        marginBottom: 8,
    },
    translateBtnText: { fontFamily: FONTS.sansSemi, fontSize: 15, color: COLORS.white },

    sentenceCard: {
        backgroundColor: COLORS.bg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: COLORS.border,
        borderRadius: 12,
        padding: 14,
        marginTop: 4,
    },
    sentenceLabel: {
        fontFamily: FONTS.sansMedium,
        fontSize: 11,
        color: COLORS.inkMuted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    sentenceText: { fontFamily: FONTS.sans, fontSize: 16, lineHeight: 22, color: COLORS.ink },

    saveBtn: {
        flexDirection: "row",
        gap: 6,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: COLORS.primary,
        borderRadius: 10,
        paddingVertical: 9,
        marginTop: 10,
    },
    saveBtnDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    saveBtnText: { fontFamily: FONTS.sansSemi, fontSize: 14, color: COLORS.primary },
    saveBtnTextDone: { color: COLORS.white },

    errorText: { color: COLORS.error, fontFamily: FONTS.sans, fontSize: 14, marginVertical: 8, textAlign: "center" },

    popupBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
    },
    popupCard: {
        width: "100%",
        maxWidth: 420,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 20,
    },
    popupHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
    },
    popupWord: {
        fontFamily: FONTS.displayBold,
        fontSize: 26,
        color: COLORS.ink,
        letterSpacing: -0.4,
    },
    popupWordSmall: {
        fontFamily: FONTS.displaySemi,
        fontSize: 20,
        color: COLORS.ink,
        letterSpacing: -0.2,
        marginBottom: 2,
    },
    popupMeta: { fontSize: 13, color: COLORS.inkMuted, marginBottom: 4 },
    popupHeadline: {
        fontFamily: FONTS.displaySemi,
        fontSize: 17,
        color: COLORS.primary,
        marginBottom: 6,
    },
    sectionLabel: {
        fontFamily: FONTS.sansMedium,
        fontSize: 11,
        color: COLORS.inkMuted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginTop: 10,
        marginBottom: 6,
    },
    transList: { marginBottom: 2 },
    transRow: { flexDirection: "row", gap: 6, marginBottom: 3 },
    bullet: { fontSize: 16, color: COLORS.primary, lineHeight: 22 },
    transText: { fontSize: 16, color: COLORS.ink, lineHeight: 22, flex: 1 },
    exampleText: {
        fontSize: 15,
        color: COLORS.ink,
        fontStyle: "italic",
        lineHeight: 20,
        marginBottom: 4,
    },
    rootBlock: {
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.border,
    },
    sourceHint: {
        marginTop: 12,
        fontSize: 12,
        color: COLORS.inkMuted,
        textAlign: "center",
        fontStyle: "italic",
    },
});
