export interface PersonaFact {
    key: string;
    label: string;
    value: string;
    reveal_hint: string;
}

export interface DebriefQuestion {
    type: "true_false" | "fill_blank";
    question: string;
    answer: string;
}

export interface Quest {
    id: string;
    level: string;
    topic: string;
    briefing: string;
    end_goal: string;
    persona_facts: PersonaFact[];
    debrief: DebriefQuestion[];
    debrief_result?: EvaluationResult;
}

export interface DebriefResult {
    question: string;
    user_answer: string;
    correct_answer: string;
    correct: boolean | "half";
}

export interface EvaluationResult {
    score: number;
    max_score: number;
    results: DebriefResult[];
}
