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

interface Props {
    quest: Quest;
    visible: boolean;
    onComplete: (result: EvaluationResult) => void;
}

const STAR_COLORS = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759"];

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

const QuestDebrief = ({ quest, visible, onComplete }: Props) => {
    const [answers, setAnswers] = useState<string[]>(
        quest.debrief.map(() => "")
    );
    const [result, setResult] = useState<EvaluationResult | null>(null);

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

    const starColor = result ? STAR_COLORS[Math.floor(result.score)] ?? "#34C759" : "#C6C6C8";

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <View style={styles.root}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header */}
                    <View style={styles.headerRow}>
                        <Ionicons name="shield-checkmark-outline" size={22} color="#007AFF" />
                        <Text style={styles.headerLabel}>DEBRIEF</Text>
                    </View>
                    <Text style={styles.subtitle}>
                        {result ? "Here's how you did" : "What did you learn?"}
                    </Text>

                    {/* Stars (shown after submit) */}
                    {result && (
                        <View style={styles.starsRow}>
                            {Array.from({ length: result.max_score }).map((_, i) => {
                                const earned = result.score - i;
                                const name = earned >= 1 ? "star" : earned >= 0.5 ? "star-half" : "star-outline";
                                const color = earned >= 0.5 ? starColor : "#D1D1D6";
                                return <Ionicons key={i} name={name} size={36} color={color} />;
                            })}
                        </View>
                    )}

                    {/* Questions */}
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

                                            let btnStyle = styles.tfBtn;
                                            if (r) {
                                                if (isCorrect) btnStyle = { ...styles.tfBtn, ...styles.tfCorrect };
                                                else if (isWrong) btnStyle = { ...styles.tfBtn, ...styles.tfWrong };
                                            } else if (selected) {
                                                btnStyle = { ...styles.tfBtn, ...styles.tfSelected };
                                            }

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
                                            placeholderTextColor="#C7C7CC"
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

                    {/* Submit / Done button */}
                    {!result ? (
                        <TouchableOpacity
                            style={[styles.submitBtn, !allAnswered && styles.submitDisabled]}
                            onPress={handleSubmit}
                            disabled={!allAnswered}
                        >
                            <Text style={styles.submitText}>Submit Answers</Text>
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
    root: {
        flex: 1,
        backgroundColor: "#F6F6F6",
    },
    content: {
        padding: 24,
        paddingTop: 60,
        paddingBottom: 40,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 4,
    },
    headerLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: "#007AFF",
        letterSpacing: 1.5,
    },
    subtitle: {
        fontSize: 24,
        fontWeight: "700",
        color: "#000",
        marginTop: 8,
        marginBottom: 24,
    },
    starsRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
        marginBottom: 28,
    },

    /* Question card */
    questionCard: {
        backgroundColor: "#FFF",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    questionText: {
        fontSize: 17,
        fontWeight: "600",
        color: "#000",
        marginBottom: 14,
        lineHeight: 23,
    },

    /* True/False */
    tfRow: {
        flexDirection: "row",
        gap: 12,
    },
    tfBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: "center",
        backgroundColor: "#F2F2F7",
        borderWidth: 2,
        borderColor: "transparent",
    },
    tfSelected: {
        borderColor: "#007AFF",
        backgroundColor: "#EBF5FF",
    },
    tfCorrect: {
        borderColor: "#34C759",
        backgroundColor: "#EAFBEF",
    },
    tfWrong: {
        borderColor: "#FF3B30",
        backgroundColor: "#FFF0EF",
    },
    tfText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#8E8E93",
    },
    tfTextSelected: {
        color: "#007AFF",
    },
    tfTextCorrect: {
        color: "#34C759",
    },
    tfTextWrong: {
        color: "#FF3B30",
    },

    /* Fill blank */
    fillInput: {
        borderWidth: 1,
        borderColor: "#D1D1D6",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 17,
        color: "#000",
        backgroundColor: "#FAFAFA",
    },
    fillCorrect: {
        borderColor: "#34C759",
        backgroundColor: "#EAFBEF",
    },
    fillHalf: {
        borderColor: "#FF9500",
        backgroundColor: "#FFF8EE",
    },
    fillWrong: {
        borderColor: "#FF3B30",
        backgroundColor: "#FFF0EF",
    },
    halfLabel: {
        fontSize: 14,
        color: "#FF9500",
        fontWeight: "600",
        marginTop: 6,
    },
    correctLabel: {
        fontSize: 14,
        color: "#FF3B30",
        fontWeight: "600",
        marginTop: 6,
    },

    /* Buttons */
    submitBtn: {
        backgroundColor: "#007AFF",
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
        marginTop: 8,
    },
    submitDisabled: {
        opacity: 0.4,
    },
    submitText: {
        color: "#FFF",
        fontSize: 17,
        fontWeight: "600",
    },
    doneBtn: {
        backgroundColor: "#34C759",
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
        marginTop: 8,
    },
    doneText: {
        color: "#FFF",
        fontSize: 17,
        fontWeight: "600",
    },
});
