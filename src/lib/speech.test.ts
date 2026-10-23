import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AI_VOICE_DISCLOSURE,
  CONSULT_TECHNICIAN_SENTENCE,
  LISTEN_COPY,
  ORIENTATION_SENTENCE,
  PLAN_LISTEN_LABEL,
  SPOKEN_SUMMARY_MAX_CHARS,
  capSpokenText,
  listenScript,
  pickEsVoice,
  pickSpanishVoice,
  planListenText,
  spokenRiskSentence,
} from "./speech.ts";

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

  it("prefers es-SV for the plan, then es-US, es-MX, es-ES, then any es", () => {
    const voices = [
      { lang: "en-US", name: "en" },
      { lang: "es-ES", name: "es" },
      { lang: "es-AR", name: "ar" },
      { lang: "es-SV", name: "sv" },
    ];
    assert.equal(pickEsVoice(voices)?.name, "sv");
    assert.equal(pickEsVoice(voices.filter((voice) => voice.name !== "sv"))?.name, "es");
    assert.equal(pickEsVoice([{ lang: "es-MX", name: "mx" }, { lang: "es-US", name: "us" }])?.name, "us");
    assert.equal(pickEsVoice([{ lang: "es", name: "generic" }])?.name, "generic");
    assert.equal(pickEsVoice([{ lang: "en-US", name: "en" }]), null);
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

  it("caps the spoken summary at about 30 seconds and keeps the technician reminder", () => {
    assert.equal(PLAN_LISTEN_LABEL, "Escuchar plan");
    assert.equal(AI_VOICE_DISCLOSURE, "Voz generada por IA");
    assert.ok(SPOKEN_SUMMARY_MAX_CHARS <= 420);
    const spoken = planListenText({
      riskSentence: `Riesgo alto. ${"El peor día tiene muchas horas húmedas. ".repeat(40)}`,
      nextStep: `Siguiente paso: fumigar el jueves. ${"Lea la etiqueta. ".repeat(40)}`,
    });
    assert.ok([...spoken].length <= SPOKEN_SUMMARY_MAX_CHARS);
    assert.match(spoken, /Consulte a un técnico\.$/);
    assert.equal(spoken.endsWith(CONSULT_TECHNICIAN_SENTENCE), true);
    const typical = planListenText({
      riskSentence: "Riesgo alto. Peor día: jueves.",
      nextStep: "Siguiente paso: fumigar el jueves, de 08:00 a 16:00.",
    });
    assert.match(typical, /Riesgo alto/);
    assert.match(typical, /Siguiente paso/);
    assert.match(typical, /Consulte a un técnico/);
    assert.ok([...typical].length < 200);
    assert.ok([...typical].length <= SPOKEN_SUMMARY_MAX_CHARS);
    assert.equal(capSpokenText("hola", 2), "ho");
    assert.equal(
      spokenRiskSentence([
        { date: "2026-10-18", level: "alto" },
        { date: "2026-10-19", level: "alto" },
        { date: "2026-10-20", level: "alto" },
        { date: "2026-10-21", level: "alto" },
        { date: "2026-10-22", level: "alto" },
        { date: "2026-10-23", level: "alto" },
        { date: "2026-10-24", level: "alto" },
      ]),
      "Riesgo alto toda la semana.",
    );
    const capped = planListenText({
      riskSentence: spokenRiskSentence([
        { date: "2026-10-18", level: "bajo" },
        { date: "2026-10-19", level: "alto" },
        { date: "2026-10-20", level: "medio" },
        { date: "2026-10-21", level: "bajo" },
        { date: "2026-10-22", level: "bajo" },
        { date: "2026-10-23", level: "bajo" },
        { date: "2026-10-24", level: "bajo" },
      ]),
      nextStep: "Siguiente paso: fumigar el lunes, de 08:00 a 11:00.",
    });
    assert.match(capped, /^Riesgo alto/);
    assert.ok([...capped].length <= SPOKEN_SUMMARY_MAX_CHARS);
  });
});
