import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatChipDate } from "./format.ts";

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
