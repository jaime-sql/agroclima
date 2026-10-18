import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { placeById, PLACES } from "../places.ts";
import { forecastUrl } from "./openmeteo.ts";

describe("Open-Meteo request", () => {
  it("uses each municipal point and the rule fields, without sending elevation", () => {
    const santaAna = placeById("santa-ana");
    assert.ok(santaAna);
    const url = new URL(forecastUrl(santaAna.latitude, santaAna.longitude));
    assert.equal(url.origin + url.pathname, "https://api.open-meteo.com/v1/forecast");
    assert.equal(url.searchParams.get("latitude"), String(santaAna.latitude));
    assert.equal(url.searchParams.get("longitude"), String(santaAna.longitude));
    assert.equal(url.searchParams.get("timezone"), "America/El_Salvador");
    assert.equal(url.searchParams.get("forecast_days"), "7");
    assert.equal(
      url.searchParams.get("hourly"),
      "temperature_2m,relative_humidity_2m,precipitation,precipitation_probability",
    );
    assert.equal(
      url.searchParams.get("daily"),
      "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_hours,precipitation_probability_max",
    );
    assert.equal(url.searchParams.get("dew_point_2m"), null);
    assert.equal(url.searchParams.get("elevation"), null);
    for (const place of PLACES) {
      const placeUrl = new URL(forecastUrl(place.latitude, place.longitude));
      assert.equal(placeUrl.searchParams.get("latitude"), String(place.latitude));
      assert.equal(placeUrl.searchParams.get("elevation"), null);
    }
  });
});
