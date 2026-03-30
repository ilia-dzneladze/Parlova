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

const ArchiveRow = ({ item, isLast, onDelete }: { item: ArchivedConversation; isLast: boolean; onDelete: (id: string) => void }) => {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();

    const handleDelete = () => {
        Alert.alert(
            "Delete Chat",
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
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
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
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#007AFF" />
                </TouchableOpacity>
            </View>

            <Text style={styles.title}>Archive</Text>

            {loaded && archives.length === 0 ? (
                <View style={styles.empty}>
                    <Ionicons name="archive-outline" size={48} color="#C7C7CC" />
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
    root: {
        flex: 1,
        backgroundColor: "#FFF",
    },

    /* Header */
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 4,
        height: 44,
    },
    backButton: {
        padding: 4,
    },

    /* Title */
    title: {
        fontSize: 34,
        fontWeight: "bold",
        color: "#000",
        paddingHorizontal: 16,
        marginBottom: 8,
    },

    /* List */
    list: {
        flex: 1,
    },

    /* Row */
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 16,
        paddingRight: 16,
        minHeight: 76,
    },

    /* Avatar */
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: {
        color: "#FFF",
        fontSize: 24,
        fontWeight: "600",
    },

    /* Text column */
    textCol: {
        flex: 1,
        paddingLeft: 12,
        paddingVertical: 10,
        justifyContent: "center",
    },
    separator: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#C6C6C8",
    },
    topRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 2,
    },
    name: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000",
        flex: 1,
    },
    time: {
        fontSize: 14,
        color: "#8E8E93",
        marginLeft: 8,
    },
    preview: {
        fontSize: 14,
        color: "#8E8E93",
        lineHeight: 20,
    },
    msgCount: {
        fontSize: 12,
        color: "#AEAEB2",
        marginTop: 2,
    },
    deleteBtn: {
        padding: 8,
    },

    /* Empty state */
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
    },
    emptyText: {
        fontSize: 17,
        color: "#8E8E93",
    },
});
