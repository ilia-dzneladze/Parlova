import React, { useEffect, useRef } from "react";
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Easing,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS } from "../constants/theme";

type Props = {
    visible: boolean;
    onClose: () => void;
    original: string;
    corrected: string;
    explanation: string | null;
    loading: boolean;
    error: string | null;
};

type Block =
    | { kind: "heading"; text: string }
    | { kind: "paragraph"; segments: { text: string; bold: boolean }[] };

function parseExplanation(md: string): Block[] {
    const blocks: Block[] = [];
    const lines = md.split(/\r?\n/);
    let buffer: string[] = [];

    const flushParagraph = () => {
        if (!buffer.length) return;
        const text = buffer.join(" ").trim();
        buffer = [];
        if (!text) return;
        const segments: { text: string; bold: boolean }[] = [];
        const re = /\*\*([^*]+)\*\*/g;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
            if (m.index > last) segments.push({ text: text.slice(last, m.index), bold: false });
            segments.push({ text: m[1], bold: true });
            last = re.lastIndex;
        }
        if (last < text.length) segments.push({ text: text.slice(last), bold: false });
        blocks.push({ kind: "paragraph", segments });
    };

    for (const raw of lines) {
        const line = raw.trim();
        const headingMatch = line.match(/^\*\*(.+?)\*\*$/);
        if (headingMatch) {
            flushParagraph();
            blocks.push({ kind: "heading", text: headingMatch[1] });
            continue;
        }
        if (!line) {
            flushParagraph();
            continue;
        }
        buffer.push(line);
    }
    flushParagraph();
    return blocks;
}

const CorrectionSheet: React.FC<Props> = ({
    visible,
    onClose,
    original,
    corrected,
    explanation,
    loading,
    error,
}) => {
    const SHEET_HEIGHT = Math.round(Dimensions.get("window").height * 0.6);
    const anim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

    useEffect(() => {
        if (visible) {
            Animated.timing(anim, {
                toValue: 0,
                duration: 260,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }).start();
        } else {
            anim.setValue(SHEET_HEIGHT);
        }
    }, [visible]);

    const handleClose = () => {
        Animated.timing(anim, {
            toValue: SHEET_HEIGHT,
            duration: 200,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start(() => onClose());
    };

    const blocks = explanation ? parseExplanation(explanation) : [];

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <Pressable style={styles.backdrop} onPress={handleClose} />
            <Animated.View
                style={[
                    styles.sheet,
                    { height: SHEET_HEIGHT, transform: [{ translateY: anim }] },
                ]}
            >
                <View style={styles.handle} />
                <View style={styles.header}>
                    <Text style={styles.title}>Correction</Text>
                    <Pressable onPress={handleClose} hitSlop={12}>
                        <Ionicons name="close" size={24} color={COLORS.inkMuted} />
                    </Pressable>
                </View>

                <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
                    <Text style={styles.label}>You wrote</Text>
                    <Text style={[styles.quote, styles.quoteOriginal]}>{original}</Text>

                    <Text style={styles.label}>Corrected</Text>
                    <Text style={[styles.quote, styles.quoteCorrected]}>{corrected}</Text>

                    <View style={styles.divider} />

                    {loading && (
                        <View style={styles.loadingRow}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                            <Text style={styles.loadingText}>Thinking through the fix…</Text>
                        </View>
                    )}

                    {error && !loading && (
                        <Text style={styles.errorText}>{error}</Text>
                    )}

                    {!loading && !error && blocks.map((b, i) =>
                        b.kind === "heading" ? (
                            <Text key={i} style={styles.heading}>{b.text}</Text>
                        ) : (
                            <Text key={i} style={styles.paragraph}>
                                {b.segments.map((s, j) => (
                                    <Text key={j} style={s.bold ? styles.bold : undefined}>{s.text}</Text>
                                ))}
                            </Text>
                        )
                    )}
                </ScrollView>
            </Animated.View>
        </Modal>
    );
};

export default CorrectionSheet;

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
    sheet: {
        position: "absolute",
        left: 0, right: 0, bottom: 0,
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24,
    },
    handle: {
        alignSelf: "center", width: 40, height: 4, borderRadius: 2,
        backgroundColor: COLORS.borderInput, marginBottom: 8,
    },
    header: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
    },
    title: { fontFamily: FONTS.displaySemi, fontSize: 18, color: COLORS.ink },
    body: { flex: 1 },
    bodyContent: { paddingTop: 16, paddingBottom: 40 },
    label: {
        fontFamily: FONTS.sansMedium, fontSize: 12,
        color: COLORS.inkMuted, textTransform: "uppercase", letterSpacing: 0.5,
        marginBottom: 4,
    },
    quote: {
        fontFamily: FONTS.sans, fontSize: 16, lineHeight: 22, color: COLORS.ink,
        padding: 12, borderRadius: 12, marginBottom: 14,
    },
    quoteOriginal: { backgroundColor: COLORS.bg },
    quoteCorrected: { backgroundColor: COLORS.primaryPale, color: COLORS.ink },
    divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
    loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
    loadingText: { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.inkMuted },
    errorText: { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.error, paddingVertical: 12 },
    heading: {
        fontFamily: FONTS.displaySemi, fontSize: 15, color: COLORS.primaryDark,
        marginTop: 14, marginBottom: 4,
    },
    paragraph: { fontFamily: FONTS.sans, fontSize: 15, lineHeight: 22, color: COLORS.ink, marginBottom: 6 },
    bold: { fontFamily: FONTS.sansSemi },
});
