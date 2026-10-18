import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { formatWeekday } from "../format.ts";
import { pinCardLine } from "./pin-card.ts";
import type { RiskLevel } from "./types.ts";

const DATES = [
  "2026-10-18",
  "2026-10-19",
  "2026-10-20",
  "2026-10-21",
  "2026-10-22",
  "2026-10-23",
  "2026-10-24",
];

function days(levelFor: (date: string) => RiskLevel) {
  return DATES.map((date) => ({ date, level: levelFor(date) }));
}

describe("pin card line", () => {
  it("says the whole week when all 7 days share one level and names no day", () => {
    const line = pinCardLine(days(() => "alto"), "2026-10-18");
    assert.equal(line, "Toda la semana: alto");
    assert.equal(line?.includes("hoy"), false);
    assert.equal(line?.includes("Domingo"), false);
    assert.equal(pinCardLine(days(() => "medio")), "Toda la semana: medio");
  });

  it("says hoy when today is among the worst-level days", () => {
    const week = days((date) => (date === "2026-10-18" || date === "2026-10-23" ? "alto" : "medio"));
    assert.equal(pinCardLine(week, "2026-10-18"), "Peor día: hoy");
    const laterToday = days((date) =>
      date === "2026-10-19" || date === "2026-10-21" ? "alto" : "bajo",
    );
    assert.equal(pinCardLine(laterToday, "2026-10-21"), "Peor día: hoy");
  });

  it("names the earliest worst day when today is milder", () => {
    const week = days((date) => {
      if (date === "2026-10-20") return "alto";
      if (date === "2026-10-23") return "alto";
      if (date === "2026-10-22") return "medio";
      return "bajo";
    });
    assert.equal(pinCardLine(week, "2026-10-18"), `Peor día: ${formatWeekday("2026-10-20")}`);
    assert.equal(pinCardLine(week, "2026-10-18"), "Peor día: Martes");
  });

  it("names the first day at the highest level on a mixed week", () => {
    const levels: RiskLevel[] = ["bajo", "medio", "medio", "alto", "bajo", "medio", "bajo"];
    const week = DATES.map((date, index) => ({ date, level: levels[index] }));
    const line = pinCardLine(week, DATES[0]);
    assert.equal(line, `Peor día: ${formatWeekday("2026-10-21")}`);
    assert.equal(line, "Peor día: Miércoles");
    const shuffled = [
      { date: "2026-10-23", level: "alto" as const },
      { date: "2026-10-18", level: "bajo" as const },
      { date: "2026-10-21", level: "alto" as const },
    ];
    assert.equal(pinCardLine(shuffled, "2026-10-18"), "Peor día: Miércoles");
  });

  it("says the whole week when all seven days share a level", () => {
    for (const level of ["bajo", "medio", "alto"] as const) {
      assert.equal(pinCardLine(days(() => level), DATES[0]), `Toda la semana: ${level}`);
    }
  });

  it("does not pick a day that has no level", () => {
    const week = DATES.map((date, index) => ({
      date,
      level: (index === 0 || index === 2
        ? null
        : index === 3 || index === 5
          ? "medio"
          : "bajo") as RiskLevel | null,
    }));
    const line = pinCardLine(week, DATES[0]);
    assert.equal(line, `Peor día: ${formatWeekday("2026-10-21")}`);
    assert.equal(line, "Peor día: Miércoles");
    assert.equal(line?.includes(formatWeekday("2026-10-18")), false);
    assert.equal(line?.includes(formatWeekday("2026-10-20")), false);
    assert.equal(line?.includes("hoy"), false);

    const onlyLater = DATES.map((date, index) => ({
      date,
      level: index === 6 ? ("alto" as const) : null,
    }));
    assert.equal(pinCardLine(onlyLater), `Peor día: ${formatWeekday("2026-10-24")}`);
    assert.equal(pinCardLine(DATES.map((date) => ({ date, level: null }))), null);
  });

  it("is the only line both the pin card and the GPS card render", () => {
    const source = readFileSync("src/components/home-flow.tsx", "utf8");
    const calls = source.match(/pinCardLine\([^)]*\)/g) ?? [];
    assert.deepEqual(calls, ["pinCardLine(risk.days)", "pinCardLine(gpsRisk.days)"]);
    assert.match(source, /const worstLine = risk \? pinCardLine\(risk\.days\) : null/);
    assert.equal(/pinCard &&/.test(source), false);
    assert.equal(source.includes("Peor día"), false);
    assert.equal(source.includes("Toda la semana"), false);
  });

  it("gives a pin tap and the municipio picker the same line for the same days", () => {
    const levels: RiskLevel[] = ["bajo", "medio", "medio", "alto", "bajo", "medio", "bajo"];
    const week = DATES.map((date, index) => ({ date, level: levels[index] }));
    const pin = pinCardLine(week);
    const picker = pinCardLine(week.map((day) => ({ ...day })));
    assert.equal(pin, picker);
    assert.equal(picker, "Peor día: Miércoles");

    const uniform = days(() => "medio");
    assert.equal(pinCardLine(uniform), pinCardLine(uniform.map((day) => ({ ...day }))));
    assert.equal(pinCardLine(uniform), "Toda la semana: medio");
  });
});
