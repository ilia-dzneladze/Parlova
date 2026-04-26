export type ModelOption = {
    label: string;
    value: string;
    description?: string;
};

export const MODELS: ModelOption[] = [
    {
        label: "Gemini 2.5 Flash",
        value: "gemini",
        description: "Default. Google via Vertex.",
    },
    {
        label: "Claude Haiku 4.5",
        value: "haiku",
        description: "Anthropic via Vertex. Requires quota.",
    },
    {
        label: "GPT-4.1 mini",
        value: "gpt4mini",
        description: "OpenAI. Strong instruction following.",
    },
];

export const DEFAULT_MODEL = MODELS[0].value;

export function modelLabel(value: string): string {
    return MODELS.find((m) => m.value === value)?.label ?? value;
}
