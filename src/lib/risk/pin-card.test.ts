import assert from "node:assert/strict";
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
});
