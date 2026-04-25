export type ModelOption = {
    label: string;
    value: string;
    description?: string;
};

export const MODELS: ModelOption[] = [
    {
        label: "Llama 3.3 (70B)",
        value: "llama-3.3-70b-versatile",
        description: "Default. Best balance of quality and speed.",
    },
    {
        label: "Llama 4 Scout (17B)",
        value: "meta-llama/llama-4-scout-17b-16e-instruct",
        description: "Faster, smaller. Lower quality on persona consistency.",
    },
    {
        label: "Qwen 3 (32B)",
        value: "qwen/qwen3-32b",
        description: "Strong multilingual. Mid-size.",
    },
];

export const DEFAULT_MODEL = MODELS[0].value;

export function modelLabel(value: string): string {
    return MODELS.find((m) => m.value === value)?.label ?? value;
}
