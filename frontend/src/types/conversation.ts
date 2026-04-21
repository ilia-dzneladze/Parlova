export interface Conversation {
    id: string;
    name: string;
    avatarColor: string;
    level: string;
    personaId: string;
    scenario: string;
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
    persona: string;
    questionFreq: number;
    lastMessage: string;
    messageCount: number;
    archivedAt: number;
}
