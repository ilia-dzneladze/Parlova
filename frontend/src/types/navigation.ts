export type RootStackParamList = {
    Tabs: undefined;
    Chat: { conversationId: string; conversationName: string };
    ArchiveList: undefined;
    ArchiveChat: { archiveId: string };
    WordList: undefined;
    CreatePersona: undefined;
    NewConversation: undefined;
};

export type TabParamList = {
    HomeTab: undefined;
    Conversations: undefined;
    Me: undefined;
    Settings: undefined;
};
