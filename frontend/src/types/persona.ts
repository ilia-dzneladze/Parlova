export interface Persona {
    id: string;
    name: string;
    description: string;
    level: string;
    questionFreq: number;
    avatarColor: string;
    source: 'global' | 'user';
    globalId?: string | null;
}
