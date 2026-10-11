import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayCardReason, dayFiguresLine, formatChipDate } from "./format.ts";

describe("risk tile date", () => {
  it("shows a short weekday and the day of the month", () => {
    assert.equal(formatChipDate("2026-10-11"), "Dom 11");
    assert.equal(formatChipDate("2026-10-12"), "Lun 12");
    assert.equal(formatChipDate("2026-10-13"), "Mar 13");
    assert.equal(formatChipDate("2026-10-14"), "Mié 14");
    assert.equal(formatChipDate("2026-10-15"), "Jue 15");
    assert.equal(formatChipDate("2026-10-16"), "Vie 16");
    assert.equal(formatChipDate("2026-10-17"), "Sáb 17");
  });
});

describe("day card reason", () => {
  it("uses the leaf-wetness line, then the rule sentence", () => {
    assert.equal(
      dayFiguresLine({ wetHours: 11, tmax: 24, rain: 6 }),
      "11 h de hoja mojada · máx. 24 °C · lluvia 6 mm",
    );
    assert.equal(
      dayCardReason({
        level: "alto",
        wetHours: 11,
        tmax: 24,
        rain: 6,
        reason: "«Hojas mojadas muchas horas y clima tibio: la roya se pega fácil.»",
      }),
      "11 h de hoja mojada · máx. 24 °C · lluvia 6 mm. «Hojas mojadas muchas horas y clima tibio: la roya se pega fácil.»",
    );
  });

  it("says sin dato for a missing figure and keeps a real zero", () => {
    const missingRain = dayFiguresLine({ wetHours: 11, tmax: 24, rain: null });
    assert.equal(missingRain, "11 h de hoja mojada · máx. 24 °C · lluvia: sin dato");
    assert.equal(missingRain.includes("lluvia 0"), false);
    assert.equal(
      dayFiguresLine({ wetHours: null, tmax: null, rain: 0 }),
      "hoja mojada: sin dato · máx.: sin dato · lluvia 0 mm",
    );
    const noHours = dayCardReason({
      level: null,
      wetHours: null,
      tmax: null,
      rain: null,
      reason: "«sin datos»",
    });
    assert.equal(noHours, "No hay pronóstico completo para este día.");
    assert.equal(/\d/.test(noHours), false);
  });
});
