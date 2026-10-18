import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PLACES } from "../places.ts";
import { placesForecastUrl } from "../weather/openmeteo.ts";
import { assessForecast } from "./assess.ts";
import { handleRiskQuery } from "./load.ts";
import { clearPlaceMapCache, loadPlaceMap, readCachedPlaceRisk } from "./places-forecast.ts";
import type { OpenMeteoForecast } from "./types.ts";

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
});
