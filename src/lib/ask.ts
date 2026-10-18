import { formatWeekday } from "./format.ts";
import type { OpenAIEnv } from "./openai.ts";
import {
  ASK_REFUSAL,
  askRefusalResult,
  askValidationAnswer,
  completeAskQuestion,
  costHeaders,
  isAskRefusal,
  limitSentences,
  readTokenCount,
  sanitizeAskBody,
  shouldRefuseAsk,
  type AskGrounding,
  type AskResult,
} from "./ask-core.ts";

export {
  ASK_EMPTY,
  ASK_FAILED,
  ASK_INVALID,
  ASK_MAX_QUESTION_CHARS,
  ASK_MAX_REPLY_TOKENS,
  ASK_MAX_SENTENCES,
  ASK_REFUSAL,
  ASK_SYSTEM_PROMPT,
  ASK_TOO_LONG,
  ASK_UNAVAILABLE,
  askRefusalResult,
  askUserContent,
  askValidationAnswer,
  completeAskQuestion,
  costHeaders,
  isAskRefusal,
  limitSentences,
  readTokenCount,
  sanitizeAskBody,
  shouldRefuseAsk,
} from "./ask-core.ts";

export type { AskDay, AskGrounding, AskResult } from "./ask-core.ts";

export const ASK_RATE_LIMIT = 8;
export const ASK_RATE_WINDOW_MS = 10 * 60 * 1000;
export const BLAXEL_WORKSPACE = "hackatonhf2025";
export const BLAXEL_ASK_TIMEOUT_MS = 8_000;

export const ASK_RATE_LIMITED =
  "Ha hecho muchas preguntas seguidas. Intente en unos minutos.";
export const ASK_HEADER = "¿Tiene una pregunta?";
export const ASK_PLACEHOLDER = "Escriba su pregunta";
export const ASK_SOURCE = "Basado en el pronóstico y la foto de esta pantalla";
export const ASK_SHARE = "Compartir con mi agrónomo";
export const ASK_OTHER_CHIPS = [
  "¿Qué significa Probable?",
  "¿Cuándo fumigar?",
] as const;

export type AskBackend = "blaxel" | "direct";

export type AskAnswer = AskResult & { backend: AskBackend };

export type AskEnv = OpenAIEnv & {
  blaxelAskUrl?: string;
  blaxelApiKey?: string;
};

/** First Alto day in the week, as «¿Por qué el lunes es Alto?». Hidden when none is Alto. */
export function askChips(days: Array<{ date: string; level: string | null }>): string[] {
  const alto = days.find((day) => day.level === "alto");
  if (!alto) return [...ASK_OTHER_CHIPS];
  const weekday = formatWeekday(alto.date).toLocaleLowerCase("es-SV");
  return [`¿Por qué el ${weekday} es Alto?`, ...ASK_OTHER_CHIPS];
}

type HitMap = Map<string, number[]>;

const hits: HitMap = new Map();

export function resetAskRateLimit(): void {
  hits.clear();
}

export function clientIp(header: (name: string) => string | null): string {
  const cf = header("cf-connecting-ip")?.trim();
  if (cf) return cf.slice(0, 64);
  const forwarded = header("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first.slice(0, 64);
  return "local";
}

export function allowAsk(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < ASK_RATE_WINDOW_MS);
  if (recent.length >= ASK_RATE_LIMIT) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) {
    const oldest = hits.keys().next().value;
    if (oldest) hits.delete(oldest);
  }
  return true;
}

export function askHeaders(result: AskAnswer): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Agroclima-Backend": result.backend,
  });
  for (const [name, value] of Object.entries(costHeaders(result))) {
    headers.set(name, value);
  }
  return headers;
}

export async function answerQuestion(options: {
  body: unknown;
  env: AskEnv;
  ip: string;
  now?: number;
  fetchImpl?: typeof fetch;
}): Promise<AskAnswer> {
  const parsed = sanitizeAskBody(options.body);
  if (!parsed.ok) {
    return direct(quiet(400, askValidationAnswer(parsed.error), parsed.error));
  }

  if (!allowAsk(options.ip, options.now ?? Date.now())) {
    return direct(quiet(429, ASK_RATE_LIMITED, "rate_limited"));
  }

  if (shouldRefuseAsk(parsed.question)) return direct(askRefusalResult());

  const hosted = await askBlaxel(parsed.question, parsed.grounding, options.env, options.fetchImpl);
  if (hosted) return hosted;

  const result = await completeAskQuestion({
    question: parsed.question,
    grounding: parsed.grounding,
    env: options.env,
    fetchImpl: options.fetchImpl,
  });
  return direct(result);
}

function direct(result: AskResult): AskAnswer {
  return { ...result, backend: "direct" };
}

function quiet(
  status: number,
  answer: string,
  error: NonNullable<AskResult["error"]>,
): AskResult {
  return {
    ok: false,
    status,
    answer,
    error,
    refused: false,
    calledModel: false,
    latencyMs: 0,
    promptTokens: null,
    completionTokens: null,
  };
}

async function askBlaxel(
  question: string,
  grounding: AskGrounding,
  env: AskEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<AskAnswer | null> {
  const url = env.blaxelAskUrl?.trim() ?? "";
  const key = env.blaxelApiKey?.trim() ?? "";
  if (!url || !key) return null;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Blaxel-Authorization": `Bearer ${key}`,
        "X-Blaxel-Workspace": BLAXEL_WORKSPACE,
      },
      body: JSON.stringify({ question, grounding }),
      signal: AbortSignal.timeout(BLAXEL_ASK_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }
  return readBlaxelReply(payload);
}

function readBlaxelReply(payload: unknown): AskAnswer | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.answer !== "string" || !record.answer.trim()) return null;
  const refused = record.refused === true || isAskRefusal(record.answer);
  if (record.ok !== true && !refused) return null;
  if (typeof record.latencyMs !== "number" || !Number.isFinite(record.latencyMs) || record.latencyMs < 0) {
    return null;
  }
  const promptTokens = readTokenCount(record.promptTokens);
  const completionTokens = readTokenCount(record.completionTokens);
  const latencyMs = Math.round(record.latencyMs);
  if (refused) {
    return {
      ok: false,
      status: 200,
      answer: ASK_REFUSAL,
      error: "refused",
      refused: true,
      calledModel: true,
      latencyMs,
      promptTokens,
      completionTokens,
      backend: "blaxel",
    };
  }
  return {
    ok: true,
    status: 200,
    answer: limitSentences(record.answer),
    refused: false,
    calledModel: true,
    latencyMs,
    promptTokens,
    completionTokens,
    backend: "blaxel",
  };
}
