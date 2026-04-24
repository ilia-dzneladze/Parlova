import * as SQLite from "expo-sqlite";
import uuid from "react-native-uuid";
import { Conversation, ArchivedConversation } from "../types/conversation";
import { Persona } from "../types/persona";
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

const PENELOPE_DEFAULT: Persona = {
    id: "penelope",
    name: "Penelope",
    description:
        'Pénélope "Penny" Dupont is a 20-year-old French woman originally from Lyon. ' +
        "She moved to Berlin two years ago for its vibrant art scene and now lives in Neukölln. " +
        "She shares a cramped, high-ceilinged Altbau apartment with Lukas, a 22-year-old German structural engineering student — " +
        "they are polar opposites (she is chaotic and spontaneous, he is hyper-organized) but get along surprisingly well over late-night beers. " +
        "She is in her 2nd year at UdK Berlin, studying Mixed Media and Installation Art; her current project uses found objects from the Berlin U-Bahn. " +
        'She works 15 hours a week as a barista at "Kaffee Schwarz," a third-wave coffee shop in Kreuzberg. ' +
        "Hobbies: shooting black-and-white film on her battered Nikon F3, scouring Mauerpark flea market for vintage postcards and weird textured fabrics, " +
        'curating hyper-specific Spotify playlists (e.g. "Drinking espresso while it rains on a Tuesday"), ' +
        "and going to underground techno clubs — though she usually stands in the back analyzing the lighting design rather than dancing. " +
        "She is a massive coffee snob (she considers drip coffee a crime against humanity). " +
        "She fiercely defends physical media — vinyl, film cameras, printed books — and hates corporate minimalist architecture. " +
        "She misses Lyon's food and its winding traboules (hidden passageways) but finds Lyon too traditional compared to Berlin. " +
        "Personality: warm, observant, slightly cynical but deeply passionate. Dry French humor mixed with Berlin directness. " +
        "She is genuinely curious about new people — she asks questions because she actually wants to know. " +
        'She sometimes slips in French filler words — "bref", "enfin", "putain" — when she forgets the German word.',
    level: "A1",
    questionFreq: 0.7,
    avatarColor: "#007AFF",
    source: "global",
    globalId: "penelope",
};

export async function initDB(): Promise<void> {
    db = await SQLite.openDatabaseAsync("parlova.db");

    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS personas (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            level TEXT NOT NULL DEFAULT 'A1',
            question_freq REAL NOT NULL DEFAULT 0.5,
            avatar_color TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'user',
            global_id TEXT
        );
    `);

    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            avatar_color TEXT NOT NULL,
            level TEXT NOT NULL DEFAULT 'A1',
            persona_id TEXT NOT NULL DEFAULT '',
            scenario TEXT NOT NULL DEFAULT 'Just Chatting',
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
            question_freq REAL NOT NULL DEFAULT 0.5,
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
        CREATE TABLE IF NOT EXISTS saved_sentences (
            id TEXT PRIMARY KEY NOT NULL,
            source_text TEXT NOT NULL,
            translation TEXT NOT NULL,
            source_lang TEXT NOT NULL,
            target_lang TEXT NOT NULL,
            saved_at INTEGER NOT NULL,
            UNIQUE(source_text, source_lang, target_lang)
        );
    `);
    await db.execAsync("DROP TABLE IF EXISTS dictionary_usage;");

    // ── Column migrations (safe to re-run) ──────────────────────────────────
    const addColumnSafe = async (table: string, column: string, def: string) => {
        try { await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT NOT NULL DEFAULT '${def}'`); }
        catch { /* already exists */ }
    };
    const addRealColumnSafe = async (table: string, column: string, def: number) => {
        try { await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} REAL NOT NULL DEFAULT ${def}`); }
        catch { /* already exists */ }
    };

    await addColumnSafe("conversations", "persona_id", "");
    await addColumnSafe("conversations", "scenario", "Just Chatting");
    // Legacy columns — kept to avoid migration errors on older DBs
    await addColumnSafe("conversations", "quest_json", "");
    await addColumnSafe("conversations", "persona", "");
    await addRealColumnSafe("conversations", "question_freq", 0.5);

    await addColumnSafe("archived_conversations", "persona", "");
    await addRealColumnSafe("archived_conversations", "question_freq", 0.5);
    // Legacy quest_json column — kept for older archives
    await addColumnSafe("archived_conversations", "quest_json", "");

    await addColumnSafe("dictionary_cache", "headline", "");
    await addColumnSafe("dictionary_cache", "root_entry", "");

    // ── Seed global personas ─────────────────────────────────────────────────
    await db.runAsync(
        `INSERT OR IGNORE INTO personas (id, name, description, level, question_freq, avatar_color, source, global_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        PENELOPE_DEFAULT.id,
        PENELOPE_DEFAULT.name,
        PENELOPE_DEFAULT.description,
        PENELOPE_DEFAULT.level,
        PENELOPE_DEFAULT.questionFreq,
        PENELOPE_DEFAULT.avatarColor,
        PENELOPE_DEFAULT.source,
        PENELOPE_DEFAULT.globalId ?? null,
    );

    await db.runAsync(
        "UPDATE conversations SET persona_id = 'penelope' WHERE name = 'Penelope' AND persona_id = ''",
    );
    // Ensure existing Penelope conversations have a scenario set
    await db.runAsync(
        "UPDATE conversations SET scenario = 'Just Chatting' WHERE scenario = '' OR scenario IS NULL",
    );
}

// ── Persona helpers ──────────────────────────────────────────────────────────

function rowToPersona(row: Record<string, unknown>): Persona {
    return {
        id: row.id as string,
        name: row.name as string,
        description: row.description as string,
        level: row.level as string,
        questionFreq: (row.question_freq as number) ?? 0.5,
        avatarColor: row.avatar_color as string,
        source: (row.source as "global" | "user") ?? "user",
        globalId: (row.global_id as string) || null,
    };
}

export async function getPersonas(): Promise<Persona[]> {
    const rows = await db.getAllAsync(
        "SELECT * FROM personas ORDER BY source ASC, name ASC",
    );
    return (rows as Record<string, unknown>[]).map(rowToPersona);
}

export async function getPersona(id: string): Promise<Persona | null> {
    const row = await db.getFirstAsync<Record<string, unknown>>(
        "SELECT * FROM personas WHERE id = ?", id,
    );
    return row ? rowToPersona(row) : null;
}

export async function upsertPersona(p: Persona): Promise<void> {
    await db.runAsync(
        `INSERT OR REPLACE INTO personas (id, name, description, level, question_freq, avatar_color, source, global_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        p.id, p.name, p.description, p.level, p.questionFreq, p.avatarColor, p.source, p.globalId ?? null,
    );
}

export async function insertPersona(p: Persona): Promise<void> {
    await db.runAsync(
        `INSERT INTO personas (id, name, description, level, question_freq, avatar_color, source, global_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        p.id, p.name, p.description, p.level, p.questionFreq, p.avatarColor, p.source, p.globalId ?? null,
    );
}

export async function deletePersona(id: string): Promise<void> {
    await db.runAsync("DELETE FROM personas WHERE id = ? AND source = 'user'", id);
}

// ── Conversations ────────────────────────────────────────────────────────────

function rowToConversation(row: Record<string, unknown>): Conversation {
    return {
        id: row.id as string,
        name: row.name as string,
        avatarColor: row.avatar_color as string,
        level: row.level as string,
        personaId: (row.persona_id as string) || "",
        scenario: (row.scenario as string) || "Just Chatting",
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
        `INSERT OR REPLACE INTO conversations (id, name, avatar_color, level, persona_id, scenario, last_message, timestamp, unread)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        convo.id,
        convo.name,
        convo.avatarColor,
        convo.level,
        convo.personaId,
        convo.scenario,
        convo.lastMessage,
        convo.timestamp,
        convo.unread ? 1 : 0,
    );
}

export async function deleteConversation(id: string): Promise<void> {
    await db.withTransactionAsync(async () => {
        await db.runAsync("DELETE FROM messages WHERE conversation_id = ?", id);
        await db.runAsync("DELETE FROM conversations WHERE id = ?", id);
    });
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
        message, timestamp, id,
    );
}

export async function seedIfEmpty(): Promise<void> {
    const result = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM conversations");
    if (result && result.count > 0) return;

    await insertConversation({
        id: uuid.v4() as string,
        name: PENELOPE_DEFAULT.name,
        avatarColor: PENELOPE_DEFAULT.avatarColor,
        level: PENELOPE_DEFAULT.level,
        personaId: PENELOPE_DEFAULT.id,
        scenario: "Just Chatting",
        lastMessage: DEFAULT_GREETING,
        timestamp: "10:32",
        unread: true,
    });
}

// ── Messages ─────────────────────────────────────────────────────────────────

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
                msg.id, conversationId, msg.sender, msg.content, msg.responseTime ?? null, msg.timestamp,
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
        msg.id, msg.conversationId, msg.sender, msg.content, msg.responseTime ?? null, msg.timestamp,
    );
    await updateLastMessage(msg.conversationId, msg.content, formatTimestampForList(msg.timestamp));
}

// ── Archive ──────────────────────────────────────────────────────────────────

export async function archiveConversation(conversationId: string): Promise<string | null> {
    const convo = await db.getFirstAsync<Record<string, unknown>>(
        "SELECT * FROM conversations WHERE id = ?", conversationId,
    );
    if (!convo) return null;

    const msgCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?", conversationId,
    );
    if (!msgCount || msgCount.count <= 1) return null;

    const personaSnap = await db.getFirstAsync<{ description: string; question_freq: number }>(
        "SELECT description, question_freq FROM personas WHERE id = ?",
        convo.persona_id as string,
    );

    const archiveId = uuid.v4() as string;
    const lastMsg = await db.getFirstAsync<Record<string, unknown>>(
        "SELECT content FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT 1", conversationId,
    );

    await db.withTransactionAsync(async () => {
        await db.runAsync(
            `INSERT INTO archived_conversations
             (id, conversation_id, name, avatar_color, level, persona, question_freq, last_message, message_count, archived_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            archiveId,
            conversationId,
            convo.name as string,
            convo.avatar_color as string,
            convo.level as string,
            personaSnap?.description ?? "",
            personaSnap?.question_freq ?? 0.5,
            (lastMsg?.content as string) ?? "",
            msgCount.count,
            Date.now(),
        );

        await db.runAsync(
            `INSERT INTO archived_messages (id, archive_id, sender, content, response_time, timestamp)
             SELECT id, ?, sender, content, response_time, timestamp FROM messages WHERE conversation_id = ?`,
            archiveId, conversationId,
        );

        await db.runAsync("DELETE FROM messages WHERE conversation_id = ?", conversationId);
    });

    return archiveId;
}

function rowToArchivedConversation(row: Record<string, unknown>): ArchivedConversation {
    return {
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
    };
}

export async function getArchivedConversations(): Promise<ArchivedConversation[]> {
    const rows = await db.getAllAsync("SELECT * FROM archived_conversations ORDER BY archived_at DESC");
    return (rows as Record<string, unknown>[]).map(rowToArchivedConversation);
}

export async function getArchivedConversation(archiveId: string): Promise<ArchivedConversation | null> {
    const row = await db.getFirstAsync<Record<string, unknown>>(
        "SELECT * FROM archived_conversations WHERE id = ?", archiveId,
    );
    return row ? rowToArchivedConversation(row) : null;
}

export async function getArchivedMessages(archiveId: string): Promise<ChatMessage[]> {
    const rows = await db.getAllAsync(
        "SELECT * FROM archived_messages WHERE archive_id = ? ORDER BY timestamp ASC", archiveId,
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

export async function deleteArchivedConversation(archiveId: string): Promise<void> {
    await db.withTransactionAsync(async () => {
        await db.runAsync("DELETE FROM archived_messages WHERE archive_id = ?", archiveId);
        await db.runAsync("DELETE FROM archived_conversations WHERE id = ?", archiveId);
    });
}

export function formatTimestampForArchive(ts: number): string {
    return formatTimestampForList(ts);
}

// ── Dictionary Cache ─────────────────────────────────────────────────────────

export type DictEntry = {
    word: string;
    translations: string;
    partOfSpeech: string | null;
    gender: string | null;
    example: string | null;
    headline: string | null;
    root: string | null;
};

function dictKey(word: string, direction: "de" | "en"): string {
    return direction === "en" ? `en:${word}` : word;
}

export async function searchDictCache(query: string, direction: "de" | "en" = "de"): Promise<DictEntry[]> {
    const rows = await db.getAllAsync(
        "SELECT * FROM dictionary_cache WHERE word LIKE ? ORDER BY word ASC LIMIT 20",
        `${dictKey(query, direction)}%`,
    );
    return (rows as Record<string, unknown>[]).map((r) => rowToDictEntry(r, direction));
}

export async function getDictEntry(word: string, direction: "de" | "en" = "de"): Promise<DictEntry | null> {
    const row = await db.getFirstAsync<Record<string, unknown>>(
        "SELECT * FROM dictionary_cache WHERE word = ?", dictKey(word, direction),
    );
    return row ? rowToDictEntry(row, direction) : null;
}

export async function saveDictEntry(entry: DictEntry, direction: "de" | "en" = "de"): Promise<void> {
    await db.runAsync(
        `INSERT OR REPLACE INTO dictionary_cache (word, translations, part_of_speech, gender, example, headline, root_entry)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        dictKey(entry.word, direction),
        entry.translations, entry.partOfSpeech, entry.gender, entry.example, entry.headline, entry.root,
    );
}

function rowToDictEntry(row: Record<string, unknown>, direction: "de" | "en" = "de"): DictEntry {
    const rawWord = row.word as string;
    return {
        word: direction === "en" ? rawWord.replace(/^en:/, "") : rawWord,
        translations: row.translations as string,
        partOfSpeech: (row.part_of_speech as string) || null,
        gender: (row.gender as string) || null,
        example: (row.example as string) || null,
        headline: (row.headline as string) || null,
        root: (row.root_entry as string) || null,
    };
}

export async function getAllDictEntries(): Promise<DictEntry[]> {
    const rows = await db.getAllAsync("SELECT * FROM dictionary_cache ORDER BY word ASC");
    return (rows as Record<string, unknown>[]).map((r) => {
        const word = r.word as string;
        const direction = word.startsWith("en:") ? "en" : "de";
        return rowToDictEntry(r, direction);
    });
}

export async function clearDictCache(): Promise<void> {
    await db.runAsync("DELETE FROM dictionary_cache");
}

// ── Saved Sentences ──────────────────────────────────────────────────────────

export type SavedSentence = {
    id: string;
    sourceText: string;
    translation: string;
    sourceLang: "de" | "en";
    targetLang: "de" | "en";
    savedAt: number;
};

export function normalizeSentence(text: string): string {
    return text.trim().replace(/\s+/g, " ");
}

export async function saveSentence(
    sourceText: string,
    translation: string,
    sourceLang: "de" | "en",
    targetLang: "de" | "en",
): Promise<void> {
    const normalized = normalizeSentence(sourceText);
    const id = `${sourceLang}:${targetLang}:${normalized}`;
    await db.runAsync(
        `INSERT OR IGNORE INTO saved_sentences
         (id, source_text, translation, source_lang, target_lang, saved_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        id, normalized, translation, sourceLang, targetLang, Date.now(),
    );
}

export async function isSentenceSaved(
    sourceText: string,
    sourceLang: "de" | "en",
    targetLang: "de" | "en",
): Promise<boolean> {
    const normalized = normalizeSentence(sourceText);
    const row = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM saved_sentences
         WHERE source_text = ? AND source_lang = ? AND target_lang = ?`,
        normalized, sourceLang, targetLang,
    );
    return !!row;
}

export async function getAllSavedSentences(): Promise<SavedSentence[]> {
    const rows = await db.getAllAsync(
        "SELECT * FROM saved_sentences ORDER BY saved_at DESC",
    );
    return (rows as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        sourceText: r.source_text as string,
        translation: r.translation as string,
        sourceLang: r.source_lang as "de" | "en",
        targetLang: r.target_lang as "de" | "en",
        savedAt: r.saved_at as number,
    }));
}

export async function deleteSavedSentence(id: string): Promise<void> {
    await db.runAsync("DELETE FROM saved_sentences WHERE id = ?", id);
}

// ── Timestamp helpers ─────────────────────────────────────────────────────────

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
    if (diff < 7) return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(-2)}`;
}
