import { createHash, timingSafeEqual } from "node:crypto";
import { formatWeekday } from "./format.ts";
import type { OpenAIEnv } from "./openai.ts";
import {
  ASK_REFUSAL,
  ASK_TRY_AGAIN,
  askRefusalResult,
  askValidationAnswer,
  classifyFetchFailure,
  completeAskQuestion,
  costHeaders,
  ensureWetHours,
  isAskRefusal,
  limitSentences,
  readTokenCount,
  sanitizeAskBody,
  shouldRefuseAsk,
  type AskAttemptOutcome,
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
  ASK_TRY_AGAIN,
  ASK_UNAVAILABLE,
  askRefusalResult,
  askUserContent,
  askDayLabel,
  askValidationAnswer,
  completeAskQuestion,
  costHeaders,
  diagnosisMeaning,
  DIAGNOSIS_LEVEL_MEANINGS,
  classifyFetchFailure,
  ensureWetHours,
  isAskRefusal,
  limitSentences,
  readTokenCount,
  sanitizeAskBody,
  shouldRefuseAsk,
} from "./ask-core.ts";

export type { AskAttemptOutcome, AskDay, AskGrounding, AskResult } from "./ask-core.ts";

export const ASK_RATE_LIMIT = 8;
export const ASK_RATE_WINDOW_MS = 10 * 60 * 1000;
export const BLAXEL_WORKSPACE = "hackatonhf2025";
/** Per-attempt cap for the Blaxel agent. */
export const BLAXEL_ASK_TIMEOUT_MS = 8_000;
/** Per-attempt cap for the direct OpenAI call. */
export const OPENAI_ASK_TIMEOUT_MS = 8_000;
/**
 * Wall clock for Blaxel plus the OpenAI fallback.
 * A fast reset may use one extra Blaxel attempt inside this budget.
 * Free-plan Workers allow 10 ms of CPU per request; time waiting on fetch is not CPU.
 * HTTP duration is uncapped while the client stays connected, so this budget is what
 * forces a JSON response before a hung fetch can drop the socket.
 * Worst case inside the budget: one fast reset, 8 s Blaxel, 8 s OpenAI.
 */
export const ASK_TOTAL_BUDGET_MS = 20_000;
/** Connection resets slower than this fall through instead of being retried. */
export const ASK_RESET_RETRY_MS = 1_500;

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
/** Shown while the ask box repeats a call that returned no JSON body. */
export const ASK_RETRYING = "Reintentando…";
/** Failure card after a drop, or after any response that already has a JSON body. */
export const ASK_CLIENT_FAILED = "No pudimos responder ahora. Intente de nuevo.";
export const ASK_RETRY_BUTTON = "Intentar de nuevo";

/**
 * One automatic retry, and only when the call returned no JSON body.
 * A JSON error (400, 429, 502, 504, or any other status with a body) is not retried.
 */
export function shouldRetryAskClient(attempt: number, hasJsonBody: boolean): boolean {
  return attempt === 1 && !hasJsonBody;
}

export type AskClientCard =
  | { kind: "answer"; text: string; refused: boolean }
  | { kind: "failure" };

/** A JSON body is never retried. Errors use the failure card. A refusal stays an answer. */
export function askClientCard(payload: unknown): AskClientCard {
  if (!payload || typeof payload !== "object") return { kind: "failure" };
  const record = payload as {
    ok?: unknown;
    answer?: unknown;
    refused?: unknown;
    error?: unknown;
  };
  const text = typeof record.answer === "string" ? record.answer : "";
  if (!text) return { kind: "failure" };
  const refused =
    record.refused === true || record.error === "refused" || text === ASK_REFUSAL;
  if (refused || record.ok === true) return { kind: "answer", text, refused };
  return { kind: "failure" };
}

export type AskBackend = "blaxel" | "direct";

export type AskAnswer = AskResult & {
  backend: AskBackend;
  attempts: number;
  firstAttempt: AskAttemptOutcome;
  retries: 0 | 1;
  wetHoursAppended: boolean;
};

export type AskBudgets = {
  blaxelMs?: number;
  openaiMs?: number;
  totalMs?: number;
  resetRetryMs?: number;
};

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

type AskLogEvent = "ask_backend" | "ask_retry" | "ask_wet_hours_appended" | "ask_handler";

/** PII-free counter line: event, backend, ms, and outcome when the call finished. */
export function logAskEvent(event: AskLogEvent, backend: string, ms: number, outcome?: string): void {
  const line: Record<string, string | number> = {
    event,
    backend,
    ms: Math.max(0, Math.round(ms)),
  };
  if (outcome) line.outcome = outcome;
  console.log(JSON.stringify(line));
}

export function askHeaders(result: AskAnswer): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store",
  });
  headers.set("X-Agroclima-Backend", result.backend);
  headers.set("X-Agroclima-Attempts", String(result.attempts));
  headers.set("X-Agroclima-First-Attempt", result.firstAttempt);
  headers.set("X-Agroclima-Retries", result.retries === 1 ? "1" : "0");
  headers.set("X-Agroclima-Wet-Hours-Appended", result.wetHoursAppended ? "true" : "false");
  for (const [name, value] of Object.entries(costHeaders(result))) {
    headers.set(name, value);
  }
  return headers;
}

/** Headers for a response that never reached a backend call. */
export function askGuardHeaders(): Headers {
  return askHeaders({
    ok: false,
    status: 400,
    answer: "",
    refused: false,
    calledModel: false,
    latencyMs: 0,
    promptTokens: null,
    completionTokens: null,
    backend: "direct",
    attempts: 0,
    firstAttempt: "none",
    retries: 0,
    wetHoursAppended: false,
  });
}

type AskTrace = {
  attempts: number;
  firstAttempt: AskAttemptOutcome;
  lastOutcome: AskAttemptOutcome;
  retries: 0 | 1;
};

type Budget = {
  blaxelMs: number;
  openaiMs: number;
  resetRetryMs: number;
  cap: (limit: number) => number;
};

type BackendCall = {
  outcome: AskAttemptOutcome;
  ms: number;
  answer: AskResult | null;
};

export async function answerQuestion(options: {
  body: unknown;
  env: AskEnv;
  ip: string;
  now?: number;
  fetchImpl?: typeof fetch;
  forceBackend?: string | null;
  evalToken?: string | null;
  budgets?: AskBudgets;
}): Promise<AskAnswer> {
  const trace = emptyTrace();
  const parsed = sanitizeAskBody(options.body);
  if (!parsed.ok) {
    return seal(quiet(400, askValidationAnswer(parsed.error), parsed.error), "direct", trace);
  }

  if (!allowAsk(options.ip, options.now ?? Date.now())) {
    return seal(quiet(429, ASK_RATE_LIMITED, "rate_limited"), "direct", trace);
  }

  if (shouldRefuseAsk(parsed.question)) return seal(askRefusalResult(), "direct", trace);

  const budget = createBudget(options.budgets);
  const fetchImpl = options.fetchImpl ?? fetch;
  const started = Date.now();
  try {
    const forced = forcedAskBackend(options.forceBackend, options.evalToken, options.env.blaxelApiKey);
    if (forced === "direct") {
      const result = await askDirect(parsed.question, parsed.grounding, options.env, fetchImpl, budget, trace);
      return finish(result, "direct", trace, parsed.grounding);
    }
    if (forced === "blaxel") {
      const hosted = await askHosted(parsed.question, parsed.grounding, options.env, fetchImpl, budget, trace);
      if (hosted) return finish(hosted, "blaxel", trace, parsed.grounding);
      if (trace.attempts === 0) noteAttempt(trace, "blaxel", "error", 0);
      return seal(transportFailure(trace.lastOutcome), "blaxel", trace);
    }

    const hosted = await askHosted(parsed.question, parsed.grounding, options.env, fetchImpl, budget, trace);
    if (hosted) return finish(hosted, "blaxel", trace, parsed.grounding);
    const result = await askDirect(parsed.question, parsed.grounding, options.env, fetchImpl, budget, trace);
    return finish(result, "direct", trace, parsed.grounding);
  } catch {
    logAskEvent("ask_handler", "direct", Date.now() - started, "error");
    if (trace.attempts === 0) {
      trace.attempts = 1;
      trace.firstAttempt = "error";
      trace.lastOutcome = "error";
    }
    return seal(transportFailure(trace.lastOutcome === "none" ? "error" : trace.lastOutcome), "direct", trace);
  }
}

function emptyTrace(): AskTrace {
  return { attempts: 0, firstAttempt: "none", lastOutcome: "none", retries: 0 };
}

function createBudget(options?: AskBudgets): Budget {
  const totalMs = options?.totalMs ?? ASK_TOTAL_BUDGET_MS;
  const started = Date.now();
  return {
    blaxelMs: options?.blaxelMs ?? BLAXEL_ASK_TIMEOUT_MS,
    openaiMs: options?.openaiMs ?? OPENAI_ASK_TIMEOUT_MS,
    resetRetryMs: options?.resetRetryMs ?? ASK_RESET_RETRY_MS,
    cap(limit: number) {
      return Math.min(limit, Math.max(0, totalMs - (Date.now() - started)));
    },
  };
}

function noteAttempt(trace: AskTrace, backend: AskBackend, outcome: AskAttemptOutcome, ms: number): void {
  if (trace.attempts === 0) trace.firstAttempt = outcome;
  trace.lastOutcome = outcome;
  trace.attempts += 1;
  logAskEvent("ask_backend", backend, ms, outcome);
}

function seal(result: AskResult, backend: AskBackend, trace: AskTrace): AskAnswer {
  return {
    ...result,
    backend,
    attempts: trace.attempts,
    firstAttempt: trace.attempts === 0 ? "none" : trace.firstAttempt,
    retries: trace.retries,
    wetHoursAppended: false,
  };
}

function finish(result: AskResult, backend: AskBackend, trace: AskTrace, grounding: AskGrounding): AskAnswer {
  const traced = seal(result, backend, trace);
  if (!traced.ok || traced.refused) return traced;
  const ensured = ensureWetHours(traced.answer, grounding);
  if (!ensured.appended) return traced;
  logAskEvent("ask_wet_hours_appended", backend, traced.latencyMs);
  return { ...traced, answer: ensured.answer, wetHoursAppended: true };
}

function transportFailure(outcome: AskAttemptOutcome): AskResult {
  const timeout = outcome === "timeout";
  return {
    ok: false,
    status: timeout ? 504 : 502,
    answer: ASK_TRY_AGAIN,
    error: timeout ? "timeout" : "failed",
    refused: false,
    calledModel: false,
    latencyMs: 0,
    promptTokens: null,
    completionTokens: null,
    attemptOutcome: outcome,
  };
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

async function askHosted(
  question: string,
  grounding: AskGrounding,
  env: AskEnv,
  fetchImpl: typeof fetch,
  budget: Budget,
  trace: AskTrace,
): Promise<AskResult | null> {
  const url = env.blaxelAskUrl?.trim() ?? "";
  const key = env.blaxelApiKey?.trim() ?? "";
  if (!url || !key) return null;

  const once = () => callBlaxel(question, grounding, url, key, fetchImpl, budget.cap(budget.blaxelMs));
  const first = await once();
  noteAttempt(trace, "blaxel", first.outcome, first.ms);
  if (first.answer) return first.answer;
  if (first.outcome === "reset" && trace.retries === 0 && first.ms <= budget.resetRetryMs) {
    trace.retries = 1;
    logAskEvent("ask_retry", "blaxel", first.ms);
    const second = await once();
    noteAttempt(trace, "blaxel", second.outcome, second.ms);
    if (second.answer) return second.answer;
  }
  return null;
}

async function askDirect(
  question: string,
  grounding: AskGrounding,
  env: AskEnv,
  fetchImpl: typeof fetch,
  budget: Budget,
  trace: AskTrace,
): Promise<AskResult> {
  const once = () => callOpenAI(question, grounding, env, fetchImpl, budget.cap(budget.openaiMs));
  let call = await once();
  if (call.outcome !== "none") noteAttempt(trace, "direct", call.outcome, call.ms);
  if (call.outcome === "reset" && trace.retries === 0 && call.ms <= budget.resetRetryMs) {
    trace.retries = 1;
    logAskEvent("ask_retry", "direct", call.ms);
    call = await once();
    if (call.outcome !== "none") noteAttempt(trace, "direct", call.outcome, call.ms);
  }
  return call.answer ?? transportFailure(call.outcome);
}

async function callOpenAI(
  question: string,
  grounding: AskGrounding,
  env: AskEnv,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<BackendCall> {
  if (timeoutMs <= 0) return { outcome: "timeout", ms: 0, answer: transportFailure("timeout") };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const answer = await completeAskQuestion({
      question,
      grounding,
      env,
      fetchImpl,
      signal: controller.signal,
    });
    const ms = Date.now() - started;
    const outcome = answer.attemptOutcome ?? "error";
    if (controller.signal.aborted && outcome !== "ok" && outcome !== "none") {
      return {
        outcome: "timeout",
        ms,
        answer: {
          ...answer,
          ...transportFailure("timeout"),
          latencyMs: ms,
          calledModel: true,
        },
      };
    }
    return { outcome, ms, answer };
  } catch (err) {
    const ms = Date.now() - started;
    const outcome = classifyFetchFailure(err, controller.signal.aborted);
    const answer = transportFailure(outcome);
    answer.latencyMs = ms;
    answer.calledModel = true;
    return { outcome, ms, answer };
  } finally {
    clearTimeout(timer);
  }
}

async function callBlaxel(
  question: string,
  grounding: AskGrounding,
  url: string,
  key: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<BackendCall> {
  if (timeoutMs <= 0) return { outcome: "timeout", ms: 0, answer: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Blaxel-Authorization": `Bearer ${key}`,
        "X-Blaxel-Workspace": BLAXEL_WORKSPACE,
      },
      body: JSON.stringify({ question, grounding }),
      signal: controller.signal,
    });
    const ms = Date.now() - started;
    if (!response.ok) return { outcome: `http_${response.status}`, ms, answer: null };
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { outcome: "error", ms, answer: null };
    }
    const answer = readBlaxelReply(payload);
    if (!answer) return { outcome: "error", ms, answer: null };
    return { outcome: "ok", ms, answer };
  } catch (err) {
    const ms = Date.now() - started;
    return { outcome: classifyFetchFailure(err, controller.signal.aborted), ms, answer: null };
  } finally {
    clearTimeout(timer);
  }
}

function readBlaxelReply(payload: unknown): AskResult | null {
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
      attemptOutcome: "ok",
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
    attemptOutcome: "ok",
  };
}
