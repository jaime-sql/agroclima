import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DOSE_NOTE, FUNGICIDE_CLASSES, RISK_CUTOFF_FOOTER } from "./assess.ts";
import { loadPlaceRisk } from "./load.ts";
import type { OpenMeteoForecast } from "./types.ts";

function dryWeek(): OpenMeteoForecast {
  const hourly: OpenMeteoForecast["hourly"] = {
    time: [],
    temperature_2m: [],
    relative_humidity_2m: [],
    precipitation: [],
    precipitation_probability: [],
  };
  const daily: OpenMeteoForecast["daily"] = {
    time: [],
    temperature_2m_max: [],
    temperature_2m_min: [],
    precipitation_sum: [],
    precipitation_hours: [],
    precipitation_probability_max: [],
  };
  for (let day = 0; day < 7; day += 1) {
    const date = `2026-10-${String(12 + day).padStart(2, "0")}`;
    daily.time.push(date);
    daily.temperature_2m_max.push(26);
    daily.temperature_2m_min.push(18);
    daily.precipitation_sum.push(0);
    daily.precipitation_hours.push(0);
    daily.precipitation_probability_max.push(10);
    for (let hour = 0; hour < 24; hour += 1) {
      hourly.time.push(`${date}T${String(hour).padStart(2, "0")}:00`);
      hourly.temperature_2m.push(24);
      hourly.relative_humidity_2m.push(50);
      hourly.precipitation.push(0);
      hourly.precipitation_probability.push(10);
    }
  }
  return { timezone: "America/El_Salvador", hourly, daily };
}

describe("place risk", () => {
  it("returns seven days, the class-only plan, and the footer without a numeric dose", async () => {
    const result = await loadPlaceRisk("santa-ana", async () => {
      return Response.json(dryWeek());
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.place.name, "Santa Ana");
    assert.equal(result.timezone, "America/El_Salvador");
    assert.equal(result.days.length, 7);
    assert.equal(result.days[0].wetHours, 0);
    assert.equal(result.days[0].tmax, 26);
    assert.equal(result.days[0].rain, 0);
    assert.equal(result.footer, RISK_CUTOFF_FOOTER);
    assert.deepEqual(result.plan.fungicideClasses, [...FUNGICIDE_CLASSES]);
    assert.equal(result.plan.doseNote, DOSE_NOTE);
    assert.equal(result.plan.nextDryWindow?.start, "2026-10-12T00:00");
    const rendered = JSON.stringify(result);
    assert.equal(/\d+\s*(kg|cc|ml)\b/i.test(rendered), false);
  });

  it("does not invent a week when the forecast call fails", async () => {
    const failed = await loadPlaceRisk("chalatenango", async () => {
      return new Response("down", { status: 503 });
    });
    assert.deepEqual(failed, { ok: false, error: "forecast_unavailable" });
    const unknown = await loadPlaceRisk("san-salvador", async () => {
      throw new Error("should not fetch");
    });
    assert.deepEqual(unknown, { ok: false, error: "unknown_place" });
  });
});
