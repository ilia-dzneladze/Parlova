import React, { useState } from "react";
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Quest, EvaluationResult } from "../src/types/quest";
import { COLORS, FONTS, RADIUS, SHADOWS, SIZES, SPACING } from "../constants/theme";

interface Props {
    quest: Quest;
    visible: boolean;
    onComplete: (result: EvaluationResult) => void;
    savedResult?: EvaluationResult;
}

// Brand-palette score tiers: rose-deep → strawberry → blush → primaryDark
const STAR_COLORS = [COLORS.primaryDark, COLORS.primary, COLORS.primaryLight, COLORS.primaryDark];

function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

const QuestDebrief = ({ quest, visible, onComplete, savedResult }: Props) => {
    const [answers, setAnswers] = useState<string[]>(
        savedResult
            ? savedResult.results.map((r) => r.user_answer)
            : quest.debrief.map(() => "")
    );
    const [result, setResult] = useState<EvaluationResult | null>(savedResult ?? null);

    const allAnswered = answers.every((a) => a.trim().length > 0);

    const handleSubmit = () => {
        if (!allAnswered) return;
        let totalScore = 0;
        const results = quest.debrief.map((q, i) => {
            const userAns = answers[i].trim().toLowerCase();
            const correctAns = q.answer.trim().toLowerCase();
            let correct: boolean | "half";
            if (q.type === "true_false") {
                correct = userAns === correctAns;
            } else {
                if (userAns === correctAns) correct = true;
                else if (levenshtein(userAns, correctAns) === 1) correct = "half";
                else correct = false;
            }
            totalScore += correct === true ? 1 : correct === "half" ? 0.5 : 0;
            return { question: q.question, user_answer: answers[i], correct_answer: q.answer, correct };
        });
        setResult({ score: totalScore, max_score: quest.debrief.length, results });
    };

    const handleDone = () => {
        if (result) onComplete(result);
    };

    const setAnswer = (index: number, value: string) => {
        setAnswers((prev) => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    };

    const starColor = result ? STAR_COLORS[Math.floor(result.score)] ?? COLORS.primary : COLORS.border;

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <View style={styles.root}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.headerRow}>
                        <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.primary} />
                        <Text style={styles.headerLabel}>DEBRIEF</Text>
                    </View>
                    <Text style={styles.subtitle}>
                        {result ? "Here's how you did" : "What did you learn?"}
                    </Text>

                    {result && (
                        <View style={styles.starsRow}>
                            {Array.from({ length: result.max_score }).map((_, i) => {
                                const earned = result.score - i;
                                const name = earned >= 1 ? "star" : earned >= 0.5 ? "star-half" : "star-outline";
                                const color = earned >= 0.5 ? starColor : COLORS.border;
                                return <Ionicons key={i} name={name} size={36} color={color} />;
                            })}
                        </View>
                    )}

                    {quest.debrief.map((q, i) => {
                        const r = result?.results[i];

                        return (
                            <View key={i} style={styles.questionCard}>
                                <Text style={styles.questionText}>{q.question}</Text>

                                {q.type === "true_false" ? (
                                    <View style={styles.tfRow}>
                                        {["true", "false"].map((val) => {
                                            const selected = answers[i] === val;
                                            const isCorrect = r && r.correct_answer === val;
                                            const isWrong = r && selected && !r.correct;

                                            const btnStyle = [
                                                styles.tfBtn,
                                                r && isCorrect && styles.tfCorrect,
                                                r && isWrong && styles.tfWrong,
                                                !r && selected && styles.tfSelected,
                                            ];

                                            return (
                                                <TouchableOpacity
                                                    key={val}
                                                    style={btnStyle}
                                                    onPress={() => !result && setAnswer(i, val)}
                                                    disabled={!!result}
                                                >
                                                    <Text style={[
                                                        styles.tfText,
                                                        (selected && !result) && styles.tfTextSelected,
                                                        (r && isCorrect) && styles.tfTextCorrect,
                                                        (r && isWrong) && styles.tfTextWrong,
                                                    ]}>
                                                        {val === "true" ? "Richtig" : "Falsch"}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <View>
                                        <TextInput
                                            style={[
                                                styles.fillInput,
                                                r && r.correct === true && styles.fillCorrect,
                                                r && r.correct === "half" && styles.fillHalf,
                                                r && r.correct === false && styles.fillWrong,
                                            ]}
                                            placeholder="Your answer..."
                                            placeholderTextColor={COLORS.inkSubtle}
                                            value={answers[i]}
                                            onChangeText={(t) => !result && setAnswer(i, t)}
                                            editable={!result}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        {r && r.correct === "half" && (
                                            <Text style={styles.halfLabel}>
                                                Almost! Correct: {r.correct_answer}
                                            </Text>
                                        )}
                                        {r && r.correct === false && (
                                            <Text style={styles.correctLabel}>
                                                Correct: {r.correct_answer}
                                            </Text>
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })}

                    {!result ? (
                        <TouchableOpacity
                            style={[styles.submitBtn, !allAnswered && styles.submitDisabled]}
                            onPress={handleSubmit}
                            disabled={!allAnswered}
                        >
                            <Text style={styles.submitText}>Submit answers</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
                            <Text style={styles.doneText}>Done</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
};

export default QuestDebrief;

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    content: {
        padding: SPACING[6],
        paddingTop: SPACING[16],
        paddingBottom: SPACING[10],
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING[2],
        marginBottom: SPACING[1],
    },
    headerLabel: {
        fontFamily: FONTS.sansBold,
        fontSize: SIZES.xs,
        color: COLORS.primary,
        letterSpacing: 1.5,
    },
    subtitle: {
        fontFamily: FONTS.displayBold,
        fontSize: SIZES["2xl"],
        color: COLORS.ink,
        letterSpacing: -0.5,
        marginTop: SPACING[2],
        marginBottom: SPACING[6],
    },
    starsRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: SPACING[2],
        marginBottom: SPACING[8],
    },
    questionCard: {
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.xl,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING[5],
        marginBottom: SPACING[4],
        ...SHADOWS.card,
    },
    questionText: {
        fontFamily: FONTS.displaySemi,
        fontSize: SIZES.base,
        color: COLORS.ink,
        marginBottom: SPACING[3],
        lineHeight: 23,
    },
    tfRow: {
        flexDirection: "row",
        gap: SPACING[3],
    },
    tfBtn: {
        flex: 1,
        paddingVertical: SPACING[3],
        borderRadius: RADIUS.md,
        alignItems: "center",
        backgroundColor: COLORS.primaryPale,
        borderWidth: 1.5,
        borderColor: "transparent",
    },
    tfSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryPale,
    },
    tfCorrect: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryPale,
    },
    tfWrong: {
        borderColor: COLORS.error,
        backgroundColor: COLORS.errorBg,
    },
    tfText: {
        fontFamily: FONTS.sansSemi,
        fontSize: SIZES.base,
        color: COLORS.inkMuted,
    },
    tfTextSelected: { color: COLORS.primaryDark },
    tfTextCorrect: { color: COLORS.primaryDark },
    tfTextWrong: { color: COLORS.error },

    fillInput: {
        fontFamily: FONTS.sans,
        borderWidth: 1.5,
        borderColor: COLORS.borderInput,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING[4],
        paddingVertical: SPACING[3],
        fontSize: SIZES.base,
        color: COLORS.ink,
        backgroundColor: COLORS.surface,
    },
    fillCorrect: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryPale,
    },
    fillHalf: {
        borderColor: COLORS.primaryLight,
        backgroundColor: COLORS.primaryPale,
    },
    fillWrong: {
        borderColor: COLORS.error,
        backgroundColor: COLORS.errorBg,
    },
    halfLabel: {
        fontFamily: FONTS.sansSemi,
        fontSize: SIZES.sm,
        color: COLORS.primaryDark,
        marginTop: 6,
    },
    correctLabel: {
        fontFamily: FONTS.sansSemi,
        fontSize: SIZES.sm,
        color: COLORS.error,
        marginTop: 6,
    },
    submitBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.md,
        paddingVertical: SPACING[4],
        alignItems: "center",
        marginTop: SPACING[2],
    },
    submitDisabled: { opacity: 0.5 },
    submitText: {
        fontFamily: FONTS.sansSemi,
        color: COLORS.white,
        fontSize: SIZES.base,
    },
    doneBtn: {
        backgroundColor: COLORS.primaryDark,
        borderRadius: RADIUS.md,
        paddingVertical: SPACING[4],
        alignItems: "center",
        marginTop: SPACING[2],
    },
    doneText: {
        fontFamily: FONTS.sansSemi,
        color: COLORS.white,
        fontSize: SIZES.base,
    },
});
