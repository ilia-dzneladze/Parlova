import React from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { RootStackParamList } from "../src/types/navigation";
import { clearDictCache } from "../src/db/database";
import { COLORS, FONTS, RADIUS, SIZES, SPACING } from "../constants/theme";

const MeScreen = () => {
    const navigator = useNavigation<NavigationProp<RootStackParamList>>();

    const handleClearWords = () => {
        Alert.alert(
            "Clear all words",
            "This will permanently delete all saved dictionary words.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: async () => {
                        await clearDictCache();
                        Alert.alert("Done", "Dictionary cleared.");
                    },
                },
            ],
        );
    };

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Me</Text>
            </View>

            <ScrollView style={styles.content}>
                <Text style={styles.sectionHeader}>LEARNING</Text>
                <View style={styles.group}>
                    <TouchableOpacity
                        style={styles.row}
                        onPress={() => navigator.navigate("WordList")}
                        activeOpacity={0.5}
                    >
                        <View style={styles.rowLeft}>
                            <Ionicons name="book-outline" size={22} color={COLORS.primary} />
                            <Text style={styles.rowLabel}>My words</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.inkSubtle} />
                    </TouchableOpacity>
                </View>
                <Text style={styles.sectionFooter}>
                    All the words you've looked up in the dictionary.
                </Text>

                <Text style={styles.sectionHeader}>DATA</Text>
                <View style={styles.group}>
                    <TouchableOpacity
                        style={styles.row}
                        onPress={handleClearWords}
                        activeOpacity={0.5}
                    >
                        <View style={styles.rowLeft}>
                            <Ionicons name="trash-outline" size={22} color={COLORS.error} />
                            <Text style={[styles.rowLabel, { color: COLORS.error }]}>Clear all words</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default MeScreen;

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bg },
    header: {
        paddingHorizontal: SPACING[4],
        paddingTop: SPACING[2],
        paddingBottom: SPACING[2],
        backgroundColor: COLORS.bg,
    },
    headerTitle: {
        fontFamily: FONTS.displayBold,
        fontSize: SIZES["4xl"],
        color: COLORS.ink,
        letterSpacing: -0.8,
    },
    content: { flex: 1 },
    sectionHeader: {
        fontFamily: FONTS.sansSemi,
        fontSize: SIZES.xs,
        color: COLORS.primary,
        paddingHorizontal: SPACING[4],
        paddingTop: SPACING[6],
        paddingBottom: SPACING[2],
        letterSpacing: 1.2,
    },
    group: {
        marginHorizontal: SPACING[4],
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: "hidden",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: SPACING[3],
        paddingHorizontal: SPACING[4],
        minHeight: 48,
    },
    rowBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    rowLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING[3],
    },
    rowLabel: {
        fontFamily: FONTS.sansMedium,
        fontSize: SIZES.base,
        color: COLORS.ink,
    },
    sectionFooter: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.inkMuted,
        paddingHorizontal: SPACING[4],
        paddingTop: SPACING[2],
        lineHeight: 20,
    },
});
