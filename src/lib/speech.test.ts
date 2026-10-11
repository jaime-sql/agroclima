import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LISTEN_COPY, ORIENTATION_SENTENCE, listenScript, pickSpanishVoice } from "./speech.ts";

describe("Spanish voice", () => {
  it("uses only es-US, then es-MX, then es-ES", () => {
    const voices = [
      { lang: "en-US", name: "en" },
      { lang: "es-ES", name: "es" },
      { lang: "es-MX", name: "mx" },
      { lang: "es-US", name: "us" },
    ];
    assert.equal(pickSpanishVoice(voices)?.name, "us");
    assert.equal(pickSpanishVoice(voices.filter((voice) => voice.name !== "us"))?.name, "mx");
    assert.equal(
      pickSpanishVoice([{ lang: "es_ES", name: "es" }])?.name,
      "es",
    );
    assert.equal(
      pickSpanishVoice([{ lang: "es-ES-x-local", name: "local" }])?.name,
      "local",
    );
    assert.equal(pickSpanishVoice([{ lang: "es", name: "generic" }]), null);
    assert.equal(pickSpanishVoice([{ lang: "es-SV", name: "sv" }]), null);
    assert.equal(pickSpanishVoice([{ lang: "en-US", name: "en" }]), null);
  });

  it("reads the result, then the plan, then the week, then the orientation", () => {
    assert.equal(LISTEN_COPY.idle, "▶ Escuchar");
    assert.equal(LISTEN_COPY.loading, "Preparando audio…");
    assert.equal(LISTEN_COPY.playing, "❚❚ Pausar");
    assert.equal(LISTEN_COPY.again, "▶ Escuchar otra vez");
    assert.equal(ORIENTATION_SENTENCE, "Es una orientación, no un diagnóstico.");
    assert.equal(
      listenScript({
        result: "Parece roya.",
        plan: "Cuánto. dosis según etiqueta / su agrónomo.",
        week: "Jueves alto.",
      }),
      "Parece roya. Cuánto. dosis según etiqueta / su agrónomo. Jueves alto. Es una orientación, no un diagnóstico.",
    );
    assert.equal(listenScript({ result: "  ", plan: null, week: null }), "");
  });
});
