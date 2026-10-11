export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

export type OpenAIEnv = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export type ResolvedOpenAI = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export function resolveOpenAI(env: OpenAIEnv): ResolvedOpenAI | null {
  const apiKey = env.apiKey?.trim() ?? "";
  if (!apiKey) return null;
  const baseUrl = (env.baseUrl?.trim() || DEFAULT_OPENAI_BASE_URL).replace(/\/$/, "");
  const model = env.model?.trim() || DEFAULT_OPENAI_MODEL;
  return { apiKey, baseUrl, model };
}
