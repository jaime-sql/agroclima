import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import {
  ASK_FAILED,
  ASK_INVALID,
  ASK_TOO_LONG,
  askRefusalResult,
  askValidationAnswer,
  completeAskQuestion,
  sanitizeAskBody,
  shouldRefuseAsk,
  type AskResult,
} from "../../../src/lib/ask-core.ts";
import type { OpenAIEnv } from "../../../src/lib/openai.ts";

const MAX_BODY = 20_000;

export type AskHttpBody = {
  ok: boolean;
  answer: string;
  refused: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
};

export function askServiceEnv(source: Record<string, string | undefined>): OpenAIEnv {
  return {
    apiKey: source.OPENAI_API_KEY,
    baseUrl: source.VISION_API_BASE_URL,
    model: source.VISION_MODEL,
  };
}

export function createAskServer(options?: {
  fetchImpl?: typeof fetch;
  env?: OpenAIEnv;
}): Server {
  return createServer((req, res) => {
    void handleAskRequest(req, res, options).catch(() => {
      if (!res.headersSent) send(res, 500, idle(ASK_FAILED));
    });
  });
}

export async function handleAskRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options?: { fetchImpl?: typeof fetch; env?: OpenAIEnv },
): Promise<void> {
  const path = (req.url ?? "").split("?")[0];
  if (req.method === "GET" && path === "/health") {
    res.writeHead(200, { "Cache-Control": "no-store" });
    res.end("ok");
    return;
  }
  if (req.method !== "POST" || path !== "/") {
    send(res, 404, idle(ASK_INVALID));
    return;
  }

  const raw = await readBody(req);
  if (!raw.ok) {
    send(res, 400, idle(raw.reason === "too_long" ? ASK_TOO_LONG : ASK_INVALID));
    return;
  }
  let body: unknown;
  try {
    body = JSON.parse(raw.text);
  } catch {
    send(res, 400, idle(ASK_INVALID));
    return;
  }
  const parsed = sanitizeAskBody(body);
  if (!parsed.ok) {
    send(res, 400, idle(askValidationAnswer(parsed.error)));
    return;
  }
  if (shouldRefuseAsk(parsed.question)) {
    const blocked = askRefusalResult();
    send(res, blocked.status, fromResult(blocked));
    return;
  }

  const result = await completeAskQuestion({
    question: parsed.question,
    grounding: parsed.grounding,
    env: options?.env ?? askServiceEnv(process.env as Record<string, string | undefined>),
    fetchImpl: options?.fetchImpl,
  });
  send(res, result.status, fromResult(result));
}

function fromResult(result: AskResult): AskHttpBody {
  return {
    ok: result.ok,
    answer: result.answer,
    refused: result.refused,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    latencyMs: result.latencyMs,
  };
}

function idle(answer: string): AskHttpBody {
  return {
    ok: false,
    answer,
    refused: false,
    promptTokens: null,
    completionTokens: null,
    latencyMs: 0,
  };
}

function send(res: ServerResponse, status: number, body: AskHttpBody): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<{ ok: true; text: string } | { ok: false; reason: "too_long" | "invalid" }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (value: { ok: true; text: string } | { ok: false; reason: "too_long" | "invalid" }) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    req.on("data", (chunk: Buffer | string) => {
      const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      size += buf.length;
      if (size > MAX_BODY) {
        req.destroy();
        finish({ ok: false, reason: "too_long" });
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => finish({ ok: true, text: Buffer.concat(chunks).toString("utf8") }));
    req.on("error", () => finish({ ok: false, reason: "invalid" }));
  });
}
