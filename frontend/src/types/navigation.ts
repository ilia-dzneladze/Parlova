import { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
    Tabs: NavigatorScreenParams<TabParamList> | undefined;
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
