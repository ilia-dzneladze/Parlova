import React from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Quest } from "../src/types/quest";
import { COLORS, FONTS, RADIUS, SHADOWS, SIZES, SPACING } from "../constants/theme";

interface Props {
    quest: Quest;
    visible: boolean;
    onDismiss: () => void;
    readOnly?: boolean;
}

const QuestBriefing = ({ quest, visible, onDismiss, readOnly }: Props) => {
    const lines = quest.briefing.split("\n").filter((l) => l.trim());
    const topicLine = lines.find((l) => l.startsWith("Topic:"));
    const findOutLines = lines.filter((l) => l.startsWith("- ") && !l.startsWith("- Find out:"));
    const goalLine = lines.find((l) => l.startsWith("Goal:"));

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <Pressable style={styles.overlay} onPress={onDismiss}>
                <Pressable style={styles.card} onPress={() => {}}>
                    <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} hitSlop={12}>
                        <Ionicons name="close" size={20} color={COLORS.inkSubtle} />
                    </TouchableOpacity>

                    <View style={styles.headerRow}>
                        <Ionicons name="document-text-outline" size={22} color={COLORS.primary} />
                        <Text style={styles.headerLabel}>CASE FILE</Text>
                    </View>

                    {topicLine && (
                        <Text style={styles.topic}>
                            {topicLine.replace("Topic: ", "")}
                        </Text>
                    )}

                    <View style={styles.divider} />

                    <Text style={styles.sectionLabel}>INTEL TO GATHER</Text>
                    {findOutLines.map((line, i) => (
                        <View key={i} style={styles.intelRow}>
                            <Ionicons name="help-circle-outline" size={18} color={COLORS.primary} />
                            <Text style={styles.intelText}>
                                {line.replace(/^- /, "")}
                            </Text>
                        </View>
                    ))}

                    <View style={styles.divider} />

                    <Text style={styles.sectionLabel}>YOUR MISSION</Text>
                    <View style={styles.missionRow}>
                        <Ionicons name="flag-outline" size={18} color={COLORS.primary} />
                        <Text style={styles.missionText}>
                            {goalLine ? goalLine.replace("Goal: ", "") : quest.end_goal}
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.startBtn} onPress={onDismiss}>
                        <Text style={styles.startBtnText}>{readOnly ? "Close" : "Start conversation"}</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

export default QuestBriefing;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(23,23,23,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: SPACING[6],
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.xl,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING[6],
        width: "100%",
        maxWidth: 360,
        ...SHADOWS.card,
    },
    closeBtn: {
        position: "absolute",
        top: 14,
        right: 14,
        zIndex: 1,
        padding: 4,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING[2],
        marginBottom: 4,
    },
    headerLabel: {
        fontFamily: FONTS.sansBold,
        fontSize: SIZES.xs,
        color: COLORS.primary,
        letterSpacing: 1.5,
    },
    topic: {
        fontFamily: FONTS.displayBold,
        fontSize: SIZES["2xl"],
        color: COLORS.ink,
        letterSpacing: -0.5,
        marginTop: SPACING[2],
        marginBottom: SPACING[1],
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: COLORS.border,
        marginVertical: SPACING[4],
    },
    sectionLabel: {
        fontFamily: FONTS.sansBold,
        fontSize: 11,
        color: COLORS.inkMuted,
        letterSpacing: 1.2,
        marginBottom: SPACING[3],
    },
    intelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING[2],
        marginBottom: SPACING[2],
    },
    intelText: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.base,
        color: COLORS.ink,
        flex: 1,
    },
    missionRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: SPACING[2],
    },
    missionText: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.base,
        color: COLORS.ink,
        flex: 1,
        lineHeight: 22,
    },
    startBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.md,
        paddingVertical: SPACING[3],
        alignItems: "center",
        marginTop: SPACING[6],
    },
    startBtnText: {
        fontFamily: FONTS.sansSemi,
        color: COLORS.white,
        fontSize: SIZES.base,
    },
});
