import * as SQLite from "expo-sqlite";
import uuid from "react-native-uuid";
import { Conversation, ArchivedConversation } from "../types/conversation";
import { DEFAULT_GREETING } from "../utils/chat";

export type ChatMessage = {
    id: string;
    conversationId: string;
    sender: "user" | "ai";
    content: string;
    responseTime?: number;
    timestamp: number;
};

let db: SQLite.SQLiteDatabase;

export async function initDB(): Promise<void> {
    db = await SQLite.openDatabaseAsync("parlova.db");
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            avatar_color TEXT NOT NULL,
            level TEXT NOT NULL DEFAULT 'A1',
            persona TEXT NOT NULL DEFAULT '',
            last_message TEXT NOT NULL DEFAULT '',
            timestamp TEXT NOT NULL DEFAULT '',
            unread INTEGER NOT NULL DEFAULT 0
        );
    `);
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY NOT NULL,
            conversation_id TEXT NOT NULL,
            sender TEXT NOT NULL,
            content TEXT NOT NULL,
            response_time REAL,
            timestamp INTEGER NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        );
    `);
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS archived_conversations (
            id TEXT PRIMARY KEY NOT NULL,
            conversation_id TEXT NOT NULL,
            name TEXT NOT NULL,
            avatar_color TEXT NOT NULL,
            level TEXT NOT NULL DEFAULT 'A1',
            persona TEXT NOT NULL DEFAULT '',
            last_message TEXT NOT NULL DEFAULT '',
            message_count INTEGER NOT NULL DEFAULT 0,
            archived_at INTEGER NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        );
    `);
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS archived_messages (
            id TEXT PRIMARY KEY NOT NULL,
            archive_id TEXT NOT NULL,
            sender TEXT NOT NULL,
            content TEXT NOT NULL,
            response_time REAL,
            timestamp INTEGER NOT NULL,
            FOREIGN KEY (archive_id) REFERENCES archived_conversations(id)
        );
    `);
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS dictionary_cache (
            word TEXT PRIMARY KEY NOT NULL,
            translations TEXT NOT NULL,
            part_of_speech TEXT,
            gender TEXT,
            example TEXT
        );
    `);
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS dictionary_usage (
            date TEXT PRIMARY KEY NOT NULL,
            count INTEGER NOT NULL DEFAULT 0
        );
    `);

    // Migrate existing tables: add persona column if missing
    const addColumnSafe = async (table: string, column: string, def: string) => {
        try {
            await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT NOT NULL DEFAULT '${def}'`);
        } catch {
            // Column already exists — ignore
        }
    };
    await addColumnSafe("conversations", "persona", "");
    await addColumnSafe("archived_conversations", "persona", "");

    // question_freq: how often this persona asks follow-up questions (0.0–1.0)
    const addRealColumnSafe = async (table: string, column: string, def: number) => {
        try {
            await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} REAL NOT NULL DEFAULT ${def}`);
        } catch {
            // Column already exists — ignore
        }
    };
    await addRealColumnSafe("conversations", "question_freq", 0.5);
    await addRealColumnSafe("archived_conversations", "question_freq", 0.5);
}

function rowToConversation(row: Record<string, unknown>): Conversation {
    return {
        id: row.id as string,
        name: row.name as string,
        avatarColor: row.avatar_color as string,
        level: row.level as string,
        persona: (row.persona as string) || "",
        questionFreq: (row.question_freq as number) ?? 0.5,
        lastMessage: row.last_message as string,
        timestamp: row.timestamp as string,
        unread: (row.unread as number) === 1,
    };
}

export async function getConversations(): Promise<Conversation[]> {
    const rows = await db.getAllAsync("SELECT * FROM conversations ORDER BY rowid ASC");
    return (rows as Record<string, unknown>[]).map(rowToConversation);
}

export async function getConversation(id: string): Promise<Conversation | null> {
    const row = await db.getFirstAsync<Record<string, unknown>>(
        "SELECT * FROM conversations WHERE id = ?", id,
    );
    return row ? rowToConversation(row) : null;
}

export async function insertConversation(convo: Conversation): Promise<void> {
    await db.runAsync(
        `INSERT OR REPLACE INTO conversations (id, name, avatar_color, level, persona, question_freq, last_message, timestamp, unread)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        convo.id,
        convo.name,
        convo.avatarColor,
        convo.level,
        convo.persona,
        convo.questionFreq,
        convo.lastMessage,
        convo.timestamp,
        convo.unread ? 1 : 0,
    );
}

export async function deleteConversation(id: string): Promise<void> {
    await db.runAsync("DELETE FROM conversations WHERE id = ?", id);
}

export async function markAsRead(id: string): Promise<void> {
    await db.runAsync("UPDATE conversations SET unread = 0 WHERE id = ?", id);
}

export async function markAsUnread(id: string): Promise<void> {
    await db.runAsync("UPDATE conversations SET unread = 1 WHERE id = ?", id);
}

export async function updateLastMessage(id: string, message: string, timestamp: string): Promise<void> {
    await db.runAsync(
        "UPDATE conversations SET last_message = ?, timestamp = ? WHERE id = ?",
        message,
        timestamp,
        id,
    );
}

export async function seedIfEmpty(): Promise<void> {
    const result = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM conversations");
    if (result && result.count > 0) return;

    const PENELOPE_PERSONA = [
        "Penelope is a 20-year-old French girl who moved to Berlin six months ago to study art.",
        "She is learning German herself — she is an A1 speaker, just like the user. She is NOT a teacher.",
        "She lives in a small apartment in Kreuzberg with a roommate.",
        "She loves painting, going to galleries, listening to music (especially indie and electronic), clubbing on weekends, and finding cute cafés around the city.",
        "She has a cat named Minou that she brought from France.",
        "Personality: she is warm, bubbly, and genuinely curious about other people. She asks follow-up questions because she actually wants to know the answer. She also loves sharing stories about her own life — her classes, her weekend plans, funny things that happened to her.",
        "She sometimes mixes in a French word when she forgets the German one (like \"oh, comment dit-on... ich meine...\"), which makes her feel more real.",
    ].join(" ");

    const seeds: Conversation[] = [
        {
            id: uuid.v4() as string,
            name: "Penelope",
            avatarColor: "#007AFF",
            level: "A1",
            persona: PENELOPE_PERSONA,
            questionFreq: 0.7,
            lastMessage: DEFAULT_GREETING,
            timestamp: "10:32",
            unread: true,
        },
    ];

    for (const convo of seeds) {
        await insertConversation(convo);
    }
}

// ---- Messages ----

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
    const rows = await db.getAllAsync(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC",
        conversationId,
    );
    return (rows as Record<string, unknown>[]).map((row) => ({
        id: row.id as string,
        conversationId: row.conversation_id as string,
        sender: row.sender as "user" | "ai",
        content: row.content as string,
        responseTime: row.response_time as number | undefined,
        timestamp: row.timestamp as number,
    }));
}

export async function saveMessages(conversationId: string, messages: ChatMessage[]): Promise<void> {
    await db.withTransactionAsync(async () => {
        await db.runAsync("DELETE FROM messages WHERE conversation_id = ?", conversationId);
        for (const msg of messages) {
            await db.runAsync(
                `INSERT INTO messages (id, conversation_id, sender, content, response_time, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                msg.id,
                conversationId,
                msg.sender,
                msg.content,
                msg.responseTime ?? null,
                msg.timestamp,
            );
        }
    });
    if (messages.length > 0) {
        const last = messages[messages.length - 1];
        await updateLastMessage(conversationId, last.content, formatTimestampForList(last.timestamp));
    }
}

export async function appendMessage(msg: ChatMessage): Promise<void> {
    await db.runAsync(
        `INSERT OR REPLACE INTO messages (id, conversation_id, sender, content, response_time, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        msg.id,
        msg.conversationId,
        msg.sender,
        msg.content,
        msg.responseTime ?? null,
        msg.timestamp,
    );
    await updateLastMessage(msg.conversationId, msg.content, formatTimestampForList(msg.timestamp));
}

// ---- Archive ----

export async function archiveConversation(conversationId: string): Promise<string | null> {
    const convo = await db.getFirstAsync<Record<string, unknown>>(
        "SELECT * FROM conversations WHERE id = ?", conversationId,
    );
    if (!convo) return null;

    const msgCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?", conversationId,
    );
    // Don't archive if only the default greeting or no messages
    if (!msgCount || msgCount.count <= 1) return null;

    const archiveId = uuid.v4() as string;
    const lastMsg = await db.getFirstAsync<Record<string, unknown>>(
        "SELECT content FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT 1", conversationId,
    );

    await db.withTransactionAsync(async () => {
        await db.runAsync(
            `INSERT INTO archived_conversations (id, conversation_id, name, avatar_color, level, persona, question_freq, last_message, message_count, archived_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            archiveId,
            conversationId,
            convo.name as string,
            convo.avatar_color as string,
            convo.level as string,
            (convo.persona as string) || "",
            (convo.question_freq as number) ?? 0.5,
            (lastMsg?.content as string) ?? "",
            msgCount.count,
            Date.now(),
        );

        await db.runAsync(
            `INSERT INTO archived_messages (id, archive_id, sender, content, response_time, timestamp)
             SELECT id, ?, sender, content, response_time, timestamp FROM messages WHERE conversation_id = ?`,
            archiveId,
            conversationId,
        );

        await db.runAsync("DELETE FROM messages WHERE conversation_id = ?", conversationId);

        await db.runAsync(
            "UPDATE conversations SET last_message = ?, timestamp = ? WHERE id = ?",
            DEFAULT_GREETING,
            formatTimestampForList(Date.now()),
            conversationId,
        );
    });

    return archiveId;
}

export async function getArchivedConversations(): Promise<ArchivedConversation[]> {
    const rows = await db.getAllAsync("SELECT * FROM archived_conversations ORDER BY archived_at DESC");
    return (rows as Record<string, unknown>[]).map((row) => ({
        id: row.id as string,
        conversationId: row.conversation_id as string,
        name: row.name as string,
        avatarColor: row.avatar_color as string,
        level: row.level as string,
        persona: (row.persona as string) || "",
        questionFreq: (row.question_freq as number) ?? 0.5,
        lastMessage: row.last_message as string,
        messageCount: row.message_count as number,
        archivedAt: row.archived_at as number,
    }));
}

export async function getArchivedMessages(archiveId: string): Promise<ChatMessage[]> {
    const rows = await db.getAllAsync(
        "SELECT * FROM archived_messages WHERE archive_id = ? ORDER BY timestamp ASC",
        archiveId,
    );
    return (rows as Record<string, unknown>[]).map((row) => ({
        id: row.id as string,
        conversationId: archiveId,
        sender: row.sender as "user" | "ai",
        content: row.content as string,
        responseTime: row.response_time as number | undefined,
        timestamp: row.timestamp as number,
    }));
}

function formatTimestampForList(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        const h = d.getHours() % 12 || 12;
        const m = d.getMinutes().toString().padStart(2, "0");
        const ap = d.getHours() >= 12 ? "PM" : "AM";
        return `${h}:${m} ${ap}`;
    }
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff === 1) return "Yesterday";
    if (diff < 7) return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
    return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear().toString().slice(-2)}`;
}

export async function deleteArchivedConversation(archiveId: string): Promise<void> {
    await db.withTransactionAsync(async () => {
        await db.runAsync("DELETE FROM archived_messages WHERE archive_id = ?", archiveId);
        await db.runAsync("DELETE FROM archived_conversations WHERE id = ?", archiveId);
    });
}

export function formatTimestampForArchive(ts: number): string {
    return formatTimestampForList(ts);
}

// ---- Dictionary Cache ----

export type DictEntry = {
    word: string;
    translations: string;
    partOfSpeech: string | null;
    gender: string | null;
    example: string | null;
};

export async function searchDictCache(query: string): Promise<DictEntry[]> {
    const rows = await db.getAllAsync(
        "SELECT * FROM dictionary_cache WHERE word LIKE ? ORDER BY word ASC LIMIT 20",
        `${query}%`,
    );
    return (rows as Record<string, unknown>[]).map(rowToDictEntry);
}

export async function getDictEntry(word: string): Promise<DictEntry | null> {
    const row = await db.getFirstAsync<Record<string, unknown>>(
        "SELECT * FROM dictionary_cache WHERE word = ?", word,
    );
    return row ? rowToDictEntry(row) : null;
}

export async function saveDictEntry(entry: DictEntry): Promise<void> {
    await db.runAsync(
        `INSERT OR REPLACE INTO dictionary_cache (word, translations, part_of_speech, gender, example)
         VALUES (?, ?, ?, ?, ?)`,
        entry.word,
        entry.translations,
        entry.partOfSpeech,
        entry.gender,
        entry.example,
    );
}

function rowToDictEntry(row: Record<string, unknown>): DictEntry {
    return {
        word: row.word as string,
        translations: row.translations as string,
        partOfSpeech: (row.part_of_speech as string) || null,
        gender: (row.gender as string) || null,
        example: (row.example as string) || null,
    };
}

// ---- Dictionary Usage ----

function todayString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getDictionaryUsage(): Promise<number> {
    const today = todayString();
    const row = await db.getFirstAsync<{ count: number }>(
        "SELECT count FROM dictionary_usage WHERE date = ?", today,
    );
    return row?.count ?? 0;
}

export async function incrementDictionaryUsage(): Promise<number> {
    const today = todayString();
    await db.runAsync(
        `INSERT INTO dictionary_usage (date, count) VALUES (?, 1)
         ON CONFLICT(date) DO UPDATE SET count = count + 1`,
        today,
    );
    const row = await db.getFirstAsync<{ count: number }>(
        "SELECT count FROM dictionary_usage WHERE date = ?", today,
    );
    return row?.count ?? 1;
}

export async function getAllDictEntries(): Promise<DictEntry[]> {
    const rows = await db.getAllAsync(
        "SELECT * FROM dictionary_cache ORDER BY word ASC",
    );
    return (rows as Record<string, unknown>[]).map(rowToDictEntry);
}

export async function clearDictCache(): Promise<void> {
    await db.runAsync("DELETE FROM dictionary_cache");
}

export async function resetDictionaryUsageToday(): Promise<void> {
    const today = todayString();
    await db.runAsync("DELETE FROM dictionary_usage WHERE date = ?", today);
}
