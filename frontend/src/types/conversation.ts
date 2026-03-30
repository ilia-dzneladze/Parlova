export interface Conversation {
    id: string;
    name: string;
    avatarColor: string;
    level: string;
    bio: string;
    lastMessage: string;
    timestamp: string;
    unread: boolean;
}

export interface ArchivedConversation {
    id: string;
    conversationId: string;
    name: string;
    avatarColor: string;
    level: string;
    bio: string;
    lastMessage: string;
    messageCount: number;
    archivedAt: number;
}
