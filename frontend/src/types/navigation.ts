export type RootStackParamList = {
    Tabs: undefined;
    Chat: { conversationId: string };
    ArchiveList: undefined;
    ArchiveChat: { archiveId: string };
};

export type TabParamList = {
    HomeTab: undefined;
    Conversations: undefined;
    Me: undefined;
    Settings: undefined;
};
