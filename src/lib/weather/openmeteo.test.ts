import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEPARTMENTS, forecastUrl } from "./openmeteo.ts";

describe("Open-Meteo request", () => {
  it("points at the three department seats and the rule fields, without calling the network", () => {
    assert.deepEqual(
      DEPARTMENTS.map((department) => department.name),
      ["Santa Ana", "Ahuachapán", "Chalatenango"],
    );
    assert.deepEqual(
      DEPARTMENTS.map((department) => [department.latitude, department.longitude]),
      [
        [13.98827, -89.55685],
        [13.92403, -89.84344],
        [14.04138, -88.93951],
      ],
    );

    const santaAna = DEPARTMENTS[0];
    const url = new URL(forecastUrl(santaAna.latitude, santaAna.longitude));
    assert.equal(url.origin + url.pathname, "https://api.open-meteo.com/v1/forecast");
    assert.equal(url.searchParams.get("latitude"), "13.98827");
    assert.equal(url.searchParams.get("longitude"), "-89.55685");
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
  });
});
