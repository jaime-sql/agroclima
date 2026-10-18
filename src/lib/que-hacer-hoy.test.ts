import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueHacerHoy } from "../components/que-hacer-hoy.ts";
import {
  QUE_HACER_HOY_APPROVED,
  queHacerHoyCopy,
  queHacerHoyCorpus,
  queHacerHoySpeech,
  type AdviceLevel,
} from "./que-hacer-hoy.ts";

const LEVELS: AdviceLevel[] = ["alto", "medio", "bajo"];

const LEVEL_LINES = {
  alto: "Las condiciones de esta semana favorecen la roya. Revise sus hojas hoy.",
  medio: "Algunas condiciones pueden favorecer la roya. Revise sus hojas esta semana.",
  bajo: "Por ahora las condiciones favorecen poco a la roya. Siga revisando sus hojas.",
} as const;

const LIST = [
  "Revise sus lotes. Así decide a tiempo.",
  "Cuide que la sombra deje pasar luz y aire al cafetal.",
  "La poda da más ventilación a las plantas.",
  "Abone según el análisis de suelo.",
  "Antes de decidir cualquier tratamiento, consulte con un técnico de café.",
] as const;

const LATER =
  "Al terminar la cosecha, se aconseja iniciar la poda. No se recomienda podar la sombra de febrero a abril.";

const FOOTER = "Guía general. No reemplaza a su técnico.";

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Diagnosis result plus the week risk, the same block both screens mount. */
export function renderDiagnosisRiskPage(
  level: AdviceLevel | null,
  approved?: boolean,
): string {
  const speech = queHacerHoySpeech(level, approved);
  return renderToStaticMarkup(
    createElement(
      "main",
      null,
      createElement("h1", null, "Parece roya"),
      createElement("h2", null, "Riesgo de roya esta semana"),
      createElement(QueHacerHoy, { level, approved }),
      createElement("button", { type: "button", "data-escuchar": speech }, "Escuchar"),
    ),
  );
}

function listMarkup(level: AdviceLevel): string {
  const html = renderToStaticMarkup(createElement(QueHacerHoy, { level, approved: true }));
  const list = html.match(/<ol[\s\S]*<\/ol>/);
  assert.ok(list, `numbered list missing for ${level}`);
  return list[0];
}

describe("Qué hacer hoy gate", () => {
  it("hides every block string on the diagnosis and risk page while approval is off", () => {
    assert.equal(QUE_HACER_HOY_APPROVED, false);
    for (const level of [null, ...LEVELS] as const) {
      const page = renderDiagnosisRiskPage(level);
      assert.match(page, /Parece roya/);
      assert.match(page, /Riesgo de roya esta semana/);
      assert.match(page, /data-escuchar=""/);
      for (const text of queHacerHoyCorpus()) {
        assert.equal(page.includes(text), false, text);
      }
      assert.equal(queHacerHoySpeech(level), "");
      assert.equal(renderToStaticMarkup(createElement(QueHacerHoy, { level })), "");
    }
  });

  it("renders the approved copy, with only the level line changing", () => {
    const lists = LEVELS.map((level) => listMarkup(level));
    assert.equal(lists[0], lists[1]);
    assert.equal(lists[1], lists[2]);

    for (const level of LEVELS) {
      const page = renderDiagnosisRiskPage(level, true);
      const block = renderToStaticMarkup(
        createElement(QueHacerHoy, { level, approved: true }),
      );
      assert.match(page, /Qué hacer hoy/);
      assert.equal(page.includes(LEVEL_LINES[level]), true);
      for (const other of LEVELS) {
        if (other === level) continue;
        assert.equal(page.includes(LEVEL_LINES[other]), false);
      }
      for (const line of LIST) assert.equal(page.includes(line), true);
      assert.equal(page.includes(LATER), true);
      assert.equal(page.includes(FOOTER), true);
      assert.match(page, /Más adelante/);
      assert.equal(block.includes("<a "), false);
      assert.match(block, /<span>ANACAFE \(Guatemala\)<\/span>/);
      assert.match(block, /<span>CENTA \(El Salvador\)<\/span>/);
      assert.doesNotMatch(block, /S\d{2}/);
      assert.equal(queHacerHoySpeech(level, true), textOf(block));
      const spoken = page.match(/data-escuchar="([^"]*)"/)?.[1] ?? "";
      assert.equal(spoken.replaceAll("&quot;", '"'), queHacerHoySpeech(level, true));
    }
  });

  it("gives policy lines no source and keeps the level line unsourced", () => {
    const block = renderToStaticMarkup(
      createElement(QueHacerHoy, { level: "medio", approved: true }),
    );
    const policy = block.match(/<li data-policy="true">[\s\S]*?<\/li>/)?.[0] ?? "";
    assert.match(policy, /Antes de decidir cualquier tratamiento, consulte con un técnico de café\./);
    assert.equal(policy.includes("Fuente"), false);
    assert.equal(policy.includes("ANACAFE"), false);
    assert.equal(policy.includes("CENTA"), false);
    const levelLine = block.match(/<h2[^>]*>[\s\S]*?<\/h2>\s*<p>([\s\S]*?)<\/p>/)?.[1] ?? "";
    assert.equal(levelLine, LEVEL_LINES.medio);
    assert.equal(levelLine.includes("Fuente"), false);
  });
});

describe("Qué hacer hoy data file", () => {
  it("keeps the cited statements and leaves urls empty", () => {
    const copy = queHacerHoyCopy();
    assert.deepEqual(
      copy.list.map((item) => item.sources.map((source) => source.statement_id)),
      [["S07", "S08"], ["S12"], ["S17"], ["S14", "S24"], []],
    );
    assert.deepEqual(
      copy.list.map((item) => item.policy),
      [false, false, false, false, true],
    );
    assert.deepEqual(
      copy.later.sources.map((source) => source.statement_id),
      ["S21", "S15"],
    );
    const labels = [
      ...copy.list.flatMap((item) => item.sources),
      ...copy.later.sources,
    ];
    for (const source of labels) assert.equal(source.url, null);
    assert.equal(copy.list[0]?.text, LIST[0]);
    assert.equal(copy.later.text, LATER);
    assert.equal(copy.footer, FOOTER);
  });

  it("rejects the banned organization fragment, doses, and weather figures", () => {
    const raw = readFileSync(new URL("../data/que-hacer-hoy.json", import.meta.url), "utf8");
    assert.equal(raw.toLowerCase().includes("procaf"), false);
    assert.equal(/\d\s*°C/.test(raw), false);
    assert.equal(/\d\s*%/.test(raw), false);
    assert.equal(/\bdosis\b/i.test(raw), false);
    assert.equal(/\bfungicida\b/i.test(raw), false);
    assert.equal(/\bmililitro\b/i.test(raw), false);
  });
});
