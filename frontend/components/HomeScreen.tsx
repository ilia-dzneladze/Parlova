import React from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { ArrowRight, MessageSquare, Sparkles } from "lucide-react-native";
import { COLORS, FONTS, RADIUS, SHADOWS, SIZES, SPACING } from "../constants/theme";
import { TabParamList } from "../src/types/navigation";

const HomeScreen = () => {
    const navigation = useNavigation<NavigationProp<TabParamList>>();

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Logo + wordmark */}
                <View style={styles.brandRow}>
                    <Image
                        source={require("../assets/brand/logomark-square.png")}
                        style={styles.logomark}
                    />
                    <Text style={styles.wordmark}>Parlova</Text>
                </View>

                {/* Hero */}
                <View style={styles.hero}>
                    <Text style={styles.eyebrow}>German · A1</Text>
                    <Text style={styles.heroTitle}>
                        Learn languages with AI that actually talks like a human.
                    </Text>
                    <Text style={styles.heroSub}>
                        Like chatting with a friend who happens to be a native speaker.
                    </Text>

                    <TouchableOpacity
                        style={styles.cta}
                        activeOpacity={0.9}
                        onPress={() => navigation.navigate("Conversations")}
                    >
                        <Text style={styles.ctaText}>Start a conversation</Text>
                        <ArrowRight size={18} color={COLORS.white} strokeWidth={2.5} />
                    </TouchableOpacity>
                </View>

                {/* Feature cards */}
                <View style={styles.cards}>
                    <View style={styles.card}>
                        <View style={styles.cardIcon}>
                            <MessageSquare size={18} color={COLORS.primary} strokeWidth={2.5} />
                        </View>
                        <Text style={styles.cardTitle}>Chat, don't drill</Text>
                        <Text style={styles.cardBody}>
                            Every conversation feels natural — no flashcards, no grammar quizzes.
                        </Text>
                    </View>

                </View>

                <Text style={styles.footer}>© 2026 Parlova</Text>
            </ScrollView>
        </SafeAreaView>
    );
};

export default HomeScreen;

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bg },
    scroll: { padding: SPACING[6], paddingBottom: SPACING[10] },

    brandRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING[2],
        marginBottom: SPACING[8],
    },
    logomark: {
        width: 32,
        height: 32,
        borderRadius: RADIUS.md,
    },
    wordmark: {
        fontFamily: FONTS.displayBold,
        fontSize: SIZES.xl,
        color: COLORS.primary,
        letterSpacing: -0.5,
    },

    /* Hero */
    hero: {
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.xl,
        padding: SPACING[6],
        marginBottom: SPACING[6],
        ...SHADOWS.card,
    },
    eyebrow: {
        fontFamily: FONTS.sansSemi,
        fontSize: 11,
        letterSpacing: 1.5,
        color: COLORS.primaryPale,
        textTransform: "uppercase",
        marginBottom: SPACING[3],
        opacity: 0.9,
    },
    heroTitle: {
        fontFamily: FONTS.displayBold,
        fontSize: SIZES["3xl"],
        color: COLORS.white,
        lineHeight: 36,
        letterSpacing: -0.7,
        marginBottom: SPACING[3],
    },
    heroSub: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.base,
        color: COLORS.white,
        opacity: 0.9,
        lineHeight: 24,
        marginBottom: SPACING[6],
    },
    cta: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACING[2],
        backgroundColor: COLORS.primaryDark,
        paddingVertical: SPACING[3],
        paddingHorizontal: SPACING[5],
        borderRadius: RADIUS.md,
        alignSelf: "flex-start",
    },
    ctaText: {
        fontFamily: FONTS.sansSemi,
        fontSize: SIZES.base,
        color: COLORS.white,
    },

    /* Feature cards */
    cards: {
        gap: SPACING[3],
        marginBottom: SPACING[8],
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.xl,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING[5],
        ...SHADOWS.card,
    },
    cardIcon: {
        width: 36,
        height: 36,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.primaryPale,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: SPACING[3],
    },
    cardTitle: {
        fontFamily: FONTS.displaySemi,
        fontSize: SIZES.lg,
        color: COLORS.ink,
        marginBottom: SPACING[1],
    },
    cardBody: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.inkMuted,
        lineHeight: 20,
    },

    footer: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.xs,
        color: COLORS.inkSubtle,
        textAlign: "center",
    },
});
