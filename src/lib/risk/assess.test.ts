import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assessDayRisk } from "./assess.ts";

describe("assessDayRisk", () => {
  it("keeps the day and does not score rust yet", () => {
    const result = assessDayRisk({
      date: "2026-10-10",
      humidityPct: 90,
      rainMm: 12,
      tempC: 22,
    });

    assert.deepEqual(result, {
      date: "2026-10-10",
      level: "bajo",
      reasons: [],
    });
  });
});
