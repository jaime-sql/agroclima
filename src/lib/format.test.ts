import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayCardReason, formatChipDate } from "./format.ts";

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
  it("starts with that day's wet hours, maximum, and rain, then the rule sentence", () => {
    assert.equal(
      dayCardReason({
        wetHours: 11,
        tmax: 24,
        rain: 6,
        reason: "«Hojas mojadas muchas horas y clima tibio: la roya se pega fácil.»",
      }),
      "11 horas húmedas, máx. 24 °C, lluvia 6 mm. «Hojas mojadas muchas horas y clima tibio: la roya se pega fácil.»",
    );
    assert.equal(
      dayCardReason({
        wetHours: 1,
        tmax: 24.4,
        rain: 0,
        reason: "«Día seco: la roya casi no avanza.»",
      }),
      "1 hora húmeda, máx. 24.4 °C, lluvia 0 mm. «Día seco: la roya casi no avanza.»",
    );
  });
});
