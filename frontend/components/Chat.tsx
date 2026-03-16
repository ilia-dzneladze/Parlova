import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Message = {
    sender: "user" | "ai";
    content: string;
}

const Chat = () => {
    const [messages, setMessages] = useState<Message[]>([{
        sender: "ai",
        content: "Hallo! Wie geht es dir?"
    }])
    const [message, setMessage] = useState<string>("");
    const [history, setHistory] = useState<Message[]>([]);

    const handleSend = async () => {
        if(!message.trim()) return;

        const userMsg: Message = {
            sender: "user",
            content: message
        }
        setMessages((prev) => [...prev, userMsg]);
        setMessage("");

        try {
            const response = await fetch("http://localhost:8000/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: message.trim() }),
            });
            const data = await response.json();
            console.log("DATA:", JSON.stringify(data));
            alert(JSON.stringify(data));
            const aiMsg: Message = {
                sender: "ai",
                content: data.response
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
                        Chat With Roxis
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
                                },
                                message.sender === "user" ? {
                                    backgroundColor: "#CC76A1",
                                    maxWidth: "85%"
                                } : {
                                    backgroundColor: "#DD9296",
                                    maxWidth: "85%"
                                }
                                ]}>
                                    <Text style={{ 
                                        color: "white",
                                        fontSize: 16, 
                                    }}>
                                        {message.content}
                                    </Text>
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
                        placeholder="Ask Anything!"
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