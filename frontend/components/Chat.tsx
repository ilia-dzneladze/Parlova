import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Message = {
    sender: "user" | "ai";
    content: string;
    responseTime?: number;
}

const Chat = () => {
    const [messages, setMessages] = useState<Message[]>([{
        sender: "ai",
        content: "Hallo! Wie geht es dir?"
    }])
    const [message, setMessage] = useState<string>("");

    const handleSend = async () => {
        if(!message.trim()) return;

        const userMsg: Message = {
            sender: "user",
            content: message
        }
        setMessages((prev) => [...prev, userMsg]);
        setMessage("");

        try {
            const response = await fetch("https://overabusive-nonchimerically-marvella.ngrok-free.dev/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
                body: JSON.stringify({
                    message: message.trim(),
                    history: messages
                }),
            });
            const data = await response.json();
            const aiMsg: Message = {
                sender: "ai",
                content: data.response,
                responseTime: data.time
            }
            setMessages((prev) => [...prev, aiMsg]);
        } catch (error) {
            console.error(error);
        }
    }
    return(
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "black" }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <SafeAreaView style={{flex: 1}}>
                {/* Header */}
                <View style={{
                    padding: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: "gray",
                    alignItems: "center"
                }}>
                    <Text style={{
                        color: "white",
                        fontSize: 20,
                        fontWeight: "600"
                    }}>
                        Chat With Learner
                    </Text>
                </View>

                {/* Chat Messages */}
                <ScrollView style={{
                    flex: 1,
                    paddingHorizontal: 12
                }}>
                    {messages.map((message, index) => {
                        return (
                            <View key={index} style={[{
                                flexDirection: "row",
                                marginTop: 12},
                                message.sender === "user" ? {
                                    justifyContent: "flex-end"
                                } : {
                                    justifyContent: "flex-start"
                                }
                            ]}>
                                <View style={[{
                                    paddingHorizontal: 16,
                                    paddingVertical: 8,
                                    borderRadius: 12,
                                    maxWidth: "85%"
                                },
                                message.sender === "user" ? {
                                    backgroundColor: "#CC76A1",
                                } : {
                                    backgroundColor: "#DD9296",
                                }
                                ]}>
                                    <Text style={{
                                        color: "white",
                                        fontSize: 16,
                                    }}>
                                        {message.content}
                                    </Text>
                                    {message.sender === "ai" && index > 0 && message.responseTime !== undefined && (
                                        <Text style={{ color: "gray", fontSize: 11, marginTop: 4 }}>
                                            {message.responseTime.toFixed(1)}s
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )
                    }) }
                </ScrollView>
                {/* Input Section */}
                <View style={{
                    flexDirection: "row",
                    gap: 8,
                    alignItems: "flex-end",
                    backgroundColor: "black",
                    paddingTop: 8,
                    borderTopWidth: 1,
                    paddingHorizontal: 8,
                }}>
                    <TextInput 
                        placeholder="Type..."
                        placeholderTextColor={"#888B9C"}
                        multiline
                        value={message}
                        onChangeText={setMessage}
                        style={{
                            flex: 1,
                            maxHeight: 120,
                            minHeight: 40,
                            paddingVertical: 10,
                            paddingHorizontal: 15,
                            backgroundColor: "#292929",
                            color: "white",
                            fontSize: 18,
                            borderRadius: 12
                    }} />

                    <TouchableOpacity 
                        onPress={handleSend}
                        style = {{ 
                            backgroundColor: "white",
                            borderRadius: 999,
                            padding: 10
                        }}
                     >
                        <Ionicons name="send" size={20} color={"black"} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>    
        </KeyboardAvoidingView>
    );
};

export default Chat;

const styles = StyleSheet.create({})