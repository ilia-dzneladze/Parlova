import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, MessageSquare, User, Settings } from 'lucide-react-native';
import {
    useFonts as useBricolage,
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
    useFonts as useDMSans,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import ConversationsList from "@/components/ConversationsList";
import Chat from "@/components/Chat";
import ArchiveList from "@/components/ArchiveList";
import ArchiveChat from "@/components/ArchiveChat";
import HomeScreen from "@/components/HomeScreen";
import MeScreen from "@/components/MeScreen";
import SettingsScreen from "@/components/SettingsScreen";
import WordList from "@/components/WordList";
import CreatePersona from "@/components/CreatePersona";
import { COLORS } from "./constants/theme";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Conversations"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.inkSubtle,
        tabBarStyle: {
          borderTopColor: COLORS.border,
          backgroundColor: COLORS.white,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Conversations"
        component={ConversationsList}
        options={{
          tabBarLabel: "Chats",
          tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Me"
        component={MeScreen}
        options={{
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [bricolageLoaded] = useBricolage({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const [dmSansLoaded] = useDMSans({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  if (!bricolageLoaded || !dmSansLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ animation: "slide_from_right" }}>
          <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
          <Stack.Screen name="Chat" component={Chat} options={{ headerShown: false }} />
          <Stack.Screen name="ArchiveList" component={ArchiveList} options={{ headerShown: false }} />
          <Stack.Screen name="ArchiveChat" component={ArchiveChat} options={{ headerShown: false }} />
          <Stack.Screen name="WordList" component={WordList} options={{ headerShown: false }} />
          <Stack.Screen name="CreatePersona" component={CreatePersona} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
