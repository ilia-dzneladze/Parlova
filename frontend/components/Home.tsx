import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS, SHADOWS, SIZES, SPACING } from "../constants/theme";

type RootStackParamList = {
    Home: undefined;
    Chat: undefined;
};

const Home = () => {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();
    return (
        <SafeAreaView style={styles.root}>
            <View style={styles.brandRow}>
                <Image
                    source={require("../assets/brand/logomark-square.png")}
                    style={styles.logomark}
                />
                <Text style={styles.wordmark}>Parlova</Text>
            </View>

            <Text style={styles.headerText}>
                Learn languages with AI that actually talks like a human.
            </Text>

            <TouchableOpacity
                style={styles.cta}
                activeOpacity={0.9}
                onPress={() => navigation.navigate("Chat")}
            >
                <Text style={styles.ctaText}>Start practising German</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: COLORS.bg,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: SPACING[6],
    },
    brandRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING[2],
        marginBottom: SPACING[6],
    },
    logomark: {
        width: 36,
        height: 36,
        borderRadius: RADIUS.md,
    },
    wordmark: {
        fontFamily: FONTS.displayBold,
        fontSize: SIZES["2xl"],
        color: COLORS.primary,
        letterSpacing: -0.5,
    },
    headerText: {
        fontFamily: FONTS.displayBold,
        color: COLORS.ink,
        fontSize: SIZES["2xl"],
        lineHeight: 30,
        letterSpacing: -0.5,
        marginBottom: SPACING[8],
        textAlign: "center",
    },
    cta: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING[6],
        paddingVertical: SPACING[3],
        borderRadius: RADIUS.md,
        ...SHADOWS.card,
    },
    ctaText: {
        fontFamily: FONTS.sansSemi,
        color: COLORS.white,
        fontSize: SIZES.base,
    },
});

export default Home;
