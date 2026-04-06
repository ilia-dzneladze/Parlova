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

interface Props {
    quest: Quest;
    visible: boolean;
    onDismiss: () => void;
    readOnly?: boolean;
}

const QuestBriefing = ({ quest, visible, onDismiss, readOnly }: Props) => {
    // Parse briefing into structured parts
    const lines = quest.briefing.split("\n").filter((l) => l.trim());
    const topicLine = lines.find((l) => l.startsWith("Topic:"));
    const findOutLines = lines.filter((l) => l.startsWith("- ") && !l.startsWith("- Find out:"));
    const goalLine = lines.find((l) => l.startsWith("Goal:"));

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <Pressable style={styles.overlay} onPress={onDismiss}>
                <Pressable style={styles.card} onPress={() => {}}>
                    {/* Close X */}
                    <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} hitSlop={12}>
                        <Ionicons name="close" size={20} color="#8E8E93" />
                    </TouchableOpacity>

                    {/* Header */}
                    <View style={styles.headerRow}>
                        <Ionicons name="document-text-outline" size={22} color="#007AFF" />
                        <Text style={styles.headerLabel}>CASE FILE</Text>
                    </View>

                    {/* Topic */}
                    {topicLine && (
                        <Text style={styles.topic}>
                            {topicLine.replace("Topic: ", "")}
                        </Text>
                    )}

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Intel */}
                    <Text style={styles.sectionLabel}>INTEL TO GATHER</Text>
                    {findOutLines.map((line, i) => (
                        <View key={i} style={styles.intelRow}>
                            <Ionicons name="help-circle-outline" size={18} color="#FF9500" />
                            <Text style={styles.intelText}>
                                {line.replace(/^- /, "")}
                            </Text>
                        </View>
                    ))}

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Mission */}
                    <Text style={styles.sectionLabel}>YOUR MISSION</Text>
                    <View style={styles.missionRow}>
                        <Ionicons name="flag-outline" size={18} color="#34C759" />
                        <Text style={styles.missionText}>
                            {goalLine ? goalLine.replace("Goal: ", "") : quest.end_goal}
                        </Text>
                    </View>

                    {/* Start / Close button */}
                    <TouchableOpacity style={styles.startBtn} onPress={onDismiss}>
                        <Text style={styles.startBtnText}>{readOnly ? "Close" : "Start Conversation"}</Text>
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
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    card: {
        backgroundColor: "#FFF",
        borderRadius: 20,
        padding: 24,
        width: "100%",
        maxWidth: 360,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 12,
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
        gap: 8,
        marginBottom: 4,
    },
    headerLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: "#007AFF",
        letterSpacing: 1.5,
    },
    topic: {
        fontSize: 22,
        fontWeight: "700",
        color: "#000",
        marginTop: 8,
        marginBottom: 4,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "#C6C6C8",
        marginVertical: 16,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#8E8E93",
        letterSpacing: 1,
        marginBottom: 10,
    },
    intelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
    },
    intelText: {
        fontSize: 16,
        color: "#000",
        flex: 1,
    },
    missionRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
    },
    missionText: {
        fontSize: 16,
        color: "#000",
        flex: 1,
        lineHeight: 22,
    },
    startBtn: {
        backgroundColor: "#007AFF",
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 24,
    },
    startBtnText: {
        color: "#FFF",
        fontSize: 17,
        fontWeight: "600",
    },
});
