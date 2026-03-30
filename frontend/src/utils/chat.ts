export type Message = {
    id: string;
    sender: "user" | "ai";
    content: string;
    responseTime?: number;
    timestamp: number;
};

export const SENT_COLOR = "#007AFF";
export const RECV_COLOR = "#E9E9EB";
export const TEN_MIN = 10 * 60 * 1000;
export const DEFAULT_GREETING = "Hallo! Wie geht es dir?";

export function formatTime(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const h = d.getHours() % 12 || 12;
    const m = d.getMinutes().toString().padStart(2, "0");
    const ap = d.getHours() >= 12 ? "PM" : "AM";
    const time = `${h}:${m} ${ap}`;
    if (d.toDateString() === now.toDateString()) return time;
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff < 7) {
        return `${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]} ${time}`;
    }
    return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear().toString().slice(-2)} ${time}`;
}

export function isLastInGroup(messages: Message[], i: number): boolean {
    return i === messages.length - 1 || messages[i].sender !== messages[i + 1].sender;
}

export function isFirstInGroup(messages: Message[], i: number): boolean {
    return i === 0 || messages[i].sender !== messages[i - 1].sender;
}

export function showTimestamp(messages: Message[], i: number): boolean {
    return i === 0 || messages[i].timestamp - messages[i - 1].timestamp >= TEN_MIN;
}
