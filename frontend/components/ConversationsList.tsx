import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
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
import { Conversation } from "../src/types/conversation";
import { initDB, seedIfEmpty, getConversations } from "../src/db/database";
import { RootStackParamList } from "../src/types/navigation";

const ConversationRow = ({ item, isLast }: { item: Conversation; isLast: boolean }) => {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();

    return (
        <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            onPress={() => navigation.navigate("Chat", { conversationId: item.id })}
        >
            {/* Unread dot */}
            <View style={styles.unreadCol}>
                {item.unread && <View style={styles.unreadDot} />}
            </View>

            {/* Avatar */}
            <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
                <Text style={styles.avatarText}>{item.name[0]}</Text>
            </View>

            {/* Text content */}
            <View style={[styles.textCol, !isLast && styles.separator]}>
                <View style={styles.topRow}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.time}>{item.timestamp}</Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>{item.lastMessage}</Text>
            </View>
        </TouchableOpacity>
    );
};

const AddContactRow = () => (
    <TouchableOpacity
        style={styles.row}
        activeOpacity={0.6}
        onPress={() => {}} // TODO: implement add contact
    >
        <View style={styles.unreadCol} />
        <View style={[styles.avatar, { backgroundColor: "#E5E5EA" }]}>
            <Ionicons name="add" size={28} color="#8E8E93" />
        </View>
        <View style={styles.textCol}>
            <Text style={styles.name}>Add Contact</Text>
        </View>
    </TouchableOpacity>
);

const ConversationsList = () => {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            await initDB();
            await seedIfEmpty();
            const data = await getConversations();
            setConversations(data);
            setLoading(false);
        })();
    }, []);

    // Refresh conversations when screen regains focus (e.g. returning from Chat)
    useFocusEffect(
        useCallback(() => {
            if (!loading) {
                getConversations().then(setConversations);
            }
        }, [loading])
    );

    if (loading) {
        return (
            <SafeAreaView style={[styles.root, styles.center]}>
                <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
                <ActivityIndicator size="large" color="#007AFF" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => {}} /* TODO: edit action */>
                    <Text style={styles.editBtn}>Edit</Text>
                </TouchableOpacity>
                <View style={styles.headerRight}>
                    <TouchableOpacity onPress={() => navigation.navigate("ArchiveList")}>
                        <Ionicons name="archive-outline" size={22} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {}} /* TODO: compose action */>
                        <Ionicons name="create-outline" size={24} color="#007AFF" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>Messages</Text>

            {/* Search bar */}
            <View style={styles.searchWrap}>
                <TouchableOpacity style={styles.searchBar} activeOpacity={1} onPress={() => {}} /* TODO: search */>
                    <Ionicons name="search" size={16} color="#8E8E93" />
                    <Text style={styles.searchPlaceholder}>Search</Text>
                </TouchableOpacity>
            </View>

            {/* Conversation list */}
            <FlatList
                data={conversations}
                keyExtractor={(c) => c.id}
                renderItem={({ item, index }) => (
                    <ConversationRow item={item} isLast={index === conversations.length - 1} />
                )}
                ListFooterComponent={<AddContactRow />}
                style={styles.list}
            />
        </SafeAreaView>
    );
};

export default ConversationsList;

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#FFF",
    },
    center: {
        alignItems: "center",
        justifyContent: "center",
    },

    /* Header */
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        height: 44,
    },
    editBtn: {
        fontSize: 17,
        color: "#007AFF",
    },
    headerRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
    },

    /* Title */
    title: {
        fontSize: 34,
        fontWeight: "bold",
        color: "#000",
        paddingHorizontal: 16,
        marginBottom: 8,
    },

    /* Search */
    searchWrap: {
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#E5E5EA",
        borderRadius: 10,
        paddingHorizontal: 8,
        height: 36,
        gap: 6,
    },
    searchPlaceholder: {
        fontSize: 17,
        color: "#8E8E93",
    },

    /* List */
    list: {
        flex: 1,
    },

    /* Row */
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingRight: 16,
        minHeight: 76,
    },

    /* Unread dot column */
    unreadCol: {
        width: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#007AFF",
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
});
