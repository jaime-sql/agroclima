import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PLACES } from "../places.ts";
import { placesForecastUrl } from "../weather/openmeteo.ts";
import { assessForecast } from "./assess.ts";
import { handleRiskQuery } from "./load.ts";
import { formatWeekday } from "../format.ts";
import { clearPlaceMapCache, loadPlaceMap, readCachedPlaceRisk, worstDay } from "./places-forecast.ts";
import type { OpenMeteoForecast, RiskLevel, WeekAssessment } from "./types.ts";

function fixture(): OpenMeteoForecast {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), "test/fixtures/dr01_clear_low.json"), "utf8"),
  ) as OpenMeteoForecast;
}

describe("place map forecast", () => {
  it("scores every place from one cached Open-Meteo call", async () => {
    clearPlaceMapCache();
    const body = PLACES.map(() => fixture());
    let calls = 0;
    let called = "";
    const fetchImpl: typeof fetch = async (input) => {
      calls += 1;
      called = String(input);
      return Response.json(body);
    };
    const first = await loadPlaceMap(fetchImpl, 1_000);
    const second = await loadPlaceMap(fetchImpl, 1_000 + 60_000);
    assert.equal(calls, 1);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(first.places.length, 20);
    assert.deepEqual(second.places, first.places);
    const url = new URL(called);
    assert.equal(url.searchParams.get("latitude"), PLACES.map((place) => String(place.latitude)).join(","));
    assert.equal(url.searchParams.get("longitude"), PLACES.map((place) => String(place.longitude)).join(","));
    assert.equal(called, placesForecastUrl(PLACES));
    const expected = assessForecast(fixture()).days[0].level;
    for (const pin of first.places) {
      assert.equal(pin.level, expected, pin.id);
      assert.equal(pin.day, "Lunes");
      assert.equal("latitude" in pin, false);
    }
    const cached = readCachedPlaceRisk("apaneca-ahuachapan");
    assert.equal(cached?.days[0].level, expected);
    let placeCalls = 0;
    const fromCache = await handleRiskQuery(
      new URL("https://agroclima.test/api/risk?place=apaneca-ahuachapan"),
      async () => {
        placeCalls += 1;
        return Response.json(fixture());
      },
    );
    assert.equal(placeCalls, 0);
    assert.equal(fromCache.status, 200);
    const again = await loadPlaceMap(async () => {
      calls += 1;
      return Response.json(body);
    }, 1_000 + 31 * 60 * 1000);
    assert.equal(again.ok, true);
    assert.equal(calls, 2);
    clearPlaceMapCache();
  });

  it("names the earliest day that reaches the highest level", async () => {
    const sunday = scored("2026-10-18", "bajo");
    const tuesday = scored("2026-10-20", "alto");
    const friday = scored("2026-10-23", "medio");
    assert.deepEqual(worstDay([sunday, tuesday, friday]), {
      level: "alto",
      date: "2026-10-20",
    });
    assert.deepEqual(
      worstDay([scored("2026-10-20", "alto"), scored("2026-10-18", "alto"), friday]),
      { level: "alto", date: "2026-10-18" },
    );

    clearPlaceMapCache();
    const later = await loadPlaceMap(async () => Response.json(PLACES.map(() => weekForecast(["2026-10-20"]))), 5_000);
    assert.equal(later.ok, true);
    if (!later.ok) return;
    for (const pin of later.places) {
      assert.equal(pin.level, "alto", pin.id);
      assert.equal(pin.day, "Martes", pin.id);
      assert.equal(pin.day, formatWeekday("2026-10-20"));
      assert.notEqual(pin.day, "Domingo");
    }

    clearPlaceMapCache();
    const tied = await loadPlaceMap(
      async () => Response.json(PLACES.map(() => weekForecast(["2026-10-18", "2026-10-20"]))),
      6_000,
    );
    assert.equal(tied.ok, true);
    if (!tied.ok) return;
    for (const pin of tied.places) {
      assert.equal(pin.level, "alto", pin.id);
      assert.equal(pin.day, "Domingo", pin.id);
      assert.equal(pin.day, formatWeekday("2026-10-18"));
    }
    clearPlaceMapCache();
  });
});

function scored(date: string, level: RiskLevel): WeekAssessment["days"][number] {
  return {
    date,
    level,
    reason: "",
    score: level === "alto" ? 4 : level === "medio" ? 2 : 0,
    wetHours: level === "bajo" ? 0 : 6,
    tmax: 24,
    rain: 0,
    warmWetHours: level === "bajo" ? 0 : 6,
    optWetHours: level === "alto" ? 6 : 0,
    rainDay: false,
    latencyBand: level !== "bajo",
    consecutiveBonus: false,
  };
}

/** Dry week, with alto (score 4) on the named dates. Day 0 is Sunday 18 Oct 2026. */
function weekForecast(altoDates: readonly string[]): OpenMeteoForecast {
  const dates = [
    "2026-10-18",
    "2026-10-19",
    "2026-10-20",
    "2026-10-21",
    "2026-10-22",
    "2026-10-23",
    "2026-10-24",
  ];
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
  for (const date of dates) {
    const alto = altoDates.includes(date);
    daily.time.push(date);
    daily.temperature_2m_max.push(alto ? 24 : 30);
    daily.temperature_2m_min.push(18);
    daily.precipitation_sum.push(0);
    daily.precipitation_hours.push(0);
    daily.precipitation_probability_max.push(0);
    for (let hour = 0; hour < 24; hour += 1) {
      const wet = alto && hour < 6;
      hourly.time.push(`${date}T${String(hour).padStart(2, "0")}:00`);
      hourly.temperature_2m.push(wet ? 22 : 30);
      hourly.relative_humidity_2m.push(wet ? 95 : 50);
      hourly.precipitation.push(0);
      hourly.precipitation_probability.push(0);
    }
  }
  return { timezone: "America/El_Salvador", hourly, daily };
}
