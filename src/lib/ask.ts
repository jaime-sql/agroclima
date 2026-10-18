import { createHash, timingSafeEqual } from "node:crypto";
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
  askDayLabel,
  askValidationAnswer,
  completeAskQuestion,
  costHeaders,
  diagnosisMeaning,
  DIAGNOSIS_LEVEL_MEANINGS,
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

export type AskAnswer = AskResult & { backend: AskBackend | null };

export const ASK_BACKEND_UNAVAILABLE = "El servicio de preguntas no respondió.";

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

export function readAskForce(header: (name: string) => string | null): {
  forceBackend: string | null;
  evalToken: string | null;
} {
  return {
    forceBackend: header("x-agroclima-force-backend"),
    evalToken: header("x-agroclima-eval-token"),
  };
}

/** Honor a force header only when the eval token matches BLAXEL_API_KEY. Otherwise return null. */
export function forcedAskBackend(
  forceHeader: string | null | undefined,
  evalToken: string | null | undefined,
  blaxelApiKey: string | null | undefined,
): AskBackend | null {
  const secret = blaxelApiKey ?? "";
  if (!secret.trim()) return null;
  if (!sameSecret(evalToken ?? "", secret)) return null;
  const force = (forceHeader ?? "").trim();
  if (force === "direct" || force === "blaxel") return force;
  return null;
}

function sameSecret(token: string, secret: string): boolean {
  const left = createHash("sha256").update(token).digest();
  const right = createHash("sha256").update(secret).digest();
  return timingSafeEqual(left, right);
}

export function askHeaders(result: AskAnswer): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store",
  });
  if (result.backend) headers.set("X-Agroclima-Backend", result.backend);
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
  forceBackend?: string | null;
  evalToken?: string | null;
}): Promise<AskAnswer> {
  const parsed = sanitizeAskBody(options.body);
  if (!parsed.ok) {
    return direct(quiet(400, askValidationAnswer(parsed.error), parsed.error));
  }

  if (!allowAsk(options.ip, options.now ?? Date.now())) {
    return direct(quiet(429, ASK_RATE_LIMITED, "rate_limited"));
  }

  if (shouldRefuseAsk(parsed.question)) return direct(askRefusalResult());

  const forced = forcedAskBackend(options.forceBackend, options.evalToken, options.env.blaxelApiKey);
  if (forced === "direct") {
    return direct(await completeAsk(parsed.question, parsed.grounding, options));
  }
  if (forced === "blaxel") {
    const hosted = await askBlaxel(parsed.question, parsed.grounding, options.env, options.fetchImpl);
    return hosted ?? blaxelUnavailable();
  }

  const hosted = await askBlaxel(parsed.question, parsed.grounding, options.env, options.fetchImpl);
  if (hosted) return hosted;
  return direct(await completeAsk(parsed.question, parsed.grounding, options));
}

function completeAsk(
  question: string,
  grounding: AskGrounding,
  options: { env: AskEnv; fetchImpl?: typeof fetch },
): Promise<AskResult> {
  return completeAskQuestion({
    question,
    grounding,
    env: options.env,
    fetchImpl: options.fetchImpl,
  });
}

function blaxelUnavailable(): AskAnswer {
  return {
    ok: false,
    status: 502,
    answer: ASK_BACKEND_UNAVAILABLE,
    error: "backend_unavailable",
    refused: false,
    calledModel: false,
    latencyMs: 0,
    promptTokens: null,
    completionTokens: null,
    backend: null,
  };
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
