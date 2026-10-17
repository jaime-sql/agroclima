import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import { describe, it } from "node:test";
import { ASK_REFUSAL, ASK_SYSTEM_PROMPT, ASK_UNAVAILABLE } from "../../../src/lib/ask-core.ts";
import { askServiceEnv, createAskServer } from "./server.ts";

const QUESTION = "pregunta-secreta-no-loguear";
const KEY = "sk-test-do-not-log";

describe("agroclima-ask service", () => {
  it("reads the same OpenAI env names as the Worker", () => {
    assert.deepEqual(
      askServiceEnv({
        OPENAI_API_KEY: "secret",
        VISION_MODEL: "gpt-4.1-mini",
        VISION_API_BASE_URL: "https://example.test/v1",
      }),
      {
        apiKey: "secret",
        model: "gpt-4.1-mini",
        baseUrl: "https://example.test/v1",
      },
    );
  });

  it("answers GET /health with 200", async () => {
    const { base, close } = await listen(createAskServer());
    try {
      const response = await fetch(`${base}/health`);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), "ok");
    } finally {
      await close();
    }
  });

  it("re-validates the body and calls gpt-4.1-mini without logging the question or the key", async () => {
    const logs: string[] = [];
    const original = {
      log: console.log,
      info: console.info,
      debug: console.debug,
      warn: console.warn,
      error: console.error,
    };
    for (const method of ["log", "info", "debug", "warn", "error"] as const) {
      console[method] = (...args: unknown[]) => {
        logs.push(args.map((part) => (typeof part === "string" ? part : JSON.stringify(part))).join(" "));
      };
    }
    let model = "";
    let system = "";
    let user = "";
    let calls = 0;
    const server = createAskServer({
      env: { apiKey: KEY },
      fetchImpl: async (_input, init) => {
        calls += 1;
        const parsed = JSON.parse(String(init?.body)) as {
          model: string;
          messages: Array<{ content: string }>;
        };
        model = parsed.model;
        system = parsed.messages[0]?.content ?? "";
        user = parsed.messages[1]?.content ?? "";
        return Response.json({
          choices: [{ message: { content: "Probable significa que hay que confirmar. Consulte a su agrónomo." } }],
          usage: { prompt_tokens: 9, completion_tokens: 4 },
        });
      },
    });
    const { base, close } = await listen(server);
    try {
      const response = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `  ${QUESTION}  `,
          grounding: {
            place: "Zona cafetalera de Santa Ana",
            timezone: "America/El_Salvador",
            summary: "no enviar",
            days: [
              {
                date: "2026-10-12",
                level: "alto",
                score: 4,
                wetHours: 11,
                tmax: 24,
                rain: 6,
                reason: "Hojas mojadas muchas horas y clima tibio: la roya se pega fácil.",
                extra: "drop",
              },
            ],
            diagnosis: null,
          },
        }),
      });
      assert.equal(response.status, 200);
      const payload = (await response.json()) as {
        ok: boolean;
        answer: string;
        refused: boolean;
        promptTokens: number;
        completionTokens: number;
        latencyMs: number;
      };
      assert.equal(payload.ok, true);
      assert.equal(payload.refused, false);
      assert.equal(payload.answer, "Probable significa que hay que confirmar. Consulte a su agrónomo.");
      assert.equal(payload.promptTokens, 9);
      assert.equal(payload.completionTokens, 4);
      assert.equal(typeof payload.latencyMs, "number");
      assert.equal(calls, 1);
      assert.equal(model, "gpt-4.1-mini");
      assert.equal(system, ASK_SYSTEM_PROMPT);
      const datos = JSON.parse(user) as { datos: Record<string, unknown>; pregunta: string };
      assert.equal(datos.pregunta, QUESTION);
      assert.equal(datos.datos.summary, undefined);
      assert.equal(JSON.stringify(datos).includes("drop"), false);
      const printed = logs.join("\n");
      assert.equal(printed.includes(QUESTION), false);
      assert.equal(printed.includes(KEY), false);
    } finally {
      Object.assign(console, original);
      await close();
    }
  });

  it("does not call OpenAI for an invalid question or a missing key", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response("no");
    };
    const invalid = createAskServer({ env: { apiKey: KEY }, fetchImpl });
    const first = await listen(invalid);
    try {
      const response = await fetch(first.base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      });
      assert.equal(response.status, 400);
      const payload = (await response.json()) as { ok: boolean; refused: boolean; promptTokens: null };
      assert.equal(payload.ok, false);
      assert.equal(payload.refused, false);
      assert.equal(payload.promptTokens, null);
      assert.equal(calls, 0);
    } finally {
      await first.close();
    }

    const missing = createAskServer({ env: {}, fetchImpl });
    const second = await listen(missing);
    try {
      const response = await fetch(second.base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "¿Qué significa Probable?",
          grounding: { place: "Zona cafetalera de Santa Ana", timezone: null, days: [], diagnosis: null },
        }),
      });
      assert.equal(response.status, 503);
      const payload = (await response.json()) as { answer: string };
      assert.equal(payload.answer, ASK_UNAVAILABLE);
      assert.equal(calls, 0);
    } finally {
      await second.close();
    }
  });

  it("returns the shared refusal when the model refuses", async () => {
    const server = createAskServer({
      env: { apiKey: KEY, model: "", baseUrl: "" },
      fetchImpl: async (_input, init) => {
        const parsed = JSON.parse(String(init?.body)) as { model: string };
        assert.equal(parsed.model, "gpt-4.1-mini");
        const url = String(_input);
        assert.equal(url, "https://api.openai.com/v1/chat/completions");
        return Response.json({
          choices: [{ message: { content: `  ${ASK_REFUSAL}  ` } }],
          usage: { prompt_tokens: 2, completion_tokens: 1 },
        });
      },
    });
    const { base, close } = await listen(server);
    try {
      const response = await fetch(`${base}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "¿Y el maíz?", grounding: { place: "Santa Ana", days: [] } }),
      });
      assert.equal(response.status, 200);
      const payload = (await response.json()) as { ok: boolean; refused: boolean; answer: string };
      assert.equal(payload.ok, false);
      assert.equal(payload.refused, true);
      assert.equal(payload.answer, ASK_REFUSAL);
    } finally {
      await close();
    }
  });
});

async function listen(server: Server): Promise<{ base: string; close: () => Promise<void> }> {
  const listening = once(server, "listening");
  server.listen(0, "127.0.0.1");
  await listening;
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return {
    base: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
