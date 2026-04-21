import React, { useCallback, useState } from "react";
import {
    Alert,
    FlatList,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect, NavigationProp } from "@react-navigation/native";
import { ArchivedConversation } from "../src/types/conversation";
import { getArchivedConversations, deleteArchivedConversation, formatTimestampForArchive } from "../src/db/database";
import { RootStackParamList } from "../src/types/navigation";
import { COLORS, FONTS, SIZES, SPACING } from "../constants/theme";

const ArchiveRow = ({ item, isLast, onDelete }: { item: ArchivedConversation; isLast: boolean; onDelete: (id: string) => void }) => {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();

    const handleDelete = () => {
        Alert.alert(
            "Delete chat",
            "This conversation will be permanently deleted.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => onDelete(item.id) },
            ],
        );
    };

    return (
        <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            onPress={() => navigation.navigate("ArchiveChat", { archiveId: item.id })}
            onLongPress={handleDelete}
        >
            <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
                <Text style={styles.avatarText}>{item.name[0]}</Text>
            </View>

            <View style={[styles.textCol, !isLast && styles.separator]}>
                <View style={styles.topRow}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.time}>{formatTimestampForArchive(item.archivedAt)}</Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>{item.lastMessage}</Text>
                <Text style={styles.msgCount}>{item.messageCount} messages</Text>
            </View>

            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
            </TouchableOpacity>
        </TouchableOpacity>
    );
};

const ArchiveList = () => {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();
    const [archives, setArchives] = useState<ArchivedConversation[]>([]);
    const [loaded, setLoaded] = useState(false);

    useFocusEffect(
        useCallback(() => {
            getArchivedConversations().then((data) => {
                setArchives(data);
                setLoaded(true);
            });
        }, [])
    );

    const handleDelete = async (archiveId: string) => {
        await deleteArchivedConversation(archiveId);
        setArchives((prev) => prev.filter((a) => a.id !== archiveId));
    };

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <Text style={styles.title}>Archive</Text>

            {loaded && archives.length === 0 ? (
                <View style={styles.empty}>
                    <Ionicons name="archive-outline" size={48} color={COLORS.inkSubtle} />
                    <Text style={styles.emptyText}>No archived conversations</Text>
                </View>
            ) : (
                <FlatList
                    data={archives}
                    keyExtractor={(a) => a.id}
                    renderItem={({ item, index }) => (
                        <ArchiveRow item={item} isLast={index === archives.length - 1} onDelete={handleDelete} />
                    )}
                    style={styles.list}
                />
            )}
        </SafeAreaView>
    );
};

export default ArchiveList;

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.surface },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: SPACING[1],
        height: 44,
    },
    backButton: { padding: SPACING[1] },
    title: {
        fontFamily: FONTS.displayBold,
        fontSize: SIZES["4xl"],
        color: COLORS.ink,
        letterSpacing: -0.8,
        paddingHorizontal: SPACING[4],
        marginBottom: SPACING[2],
    },
    list: { flex: 1 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: SPACING[4],
        paddingRight: SPACING[4],
        minHeight: 76,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: {
        fontFamily: FONTS.displayBold,
        color: COLORS.white,
        fontSize: SIZES["2xl"],
    },
    textCol: {
        flex: 1,
        paddingLeft: SPACING[3],
        paddingVertical: SPACING[2],
        justifyContent: "center",
    },
    separator: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    topRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 2,
    },
    name: {
        fontFamily: FONTS.sansSemi,
        fontSize: SIZES.base,
        color: COLORS.ink,
        flex: 1,
    },
    time: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.inkSubtle,
        marginLeft: SPACING[2],
    },
    preview: {
        fontFamily: FONTS.sans,
        fontSize: SIZES.sm,
        color: COLORS.inkMuted,
        lineHeight: 20,
    },
    msgCount: {
        fontFamily: FONTS.sansMedium,
        fontSize: SIZES.xs,
        color: COLORS.inkSubtle,
        marginTop: 2,
    },
    deleteBtn: { padding: SPACING[2] },
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: SPACING[3],
    },
    emptyText: {
        fontFamily: FONTS.sansMedium,
        fontSize: SIZES.base,
        color: COLORS.inkMuted,
    },
});
