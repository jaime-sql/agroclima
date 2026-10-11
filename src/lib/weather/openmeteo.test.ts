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
      DEPARTMENTS.map((department) => [
        department.latitude,
        department.longitude,
        department.elevation,
      ]),
      [
        [13.88, -89.61, 1432],
        [13.855, -89.835, 1290],
        [14.33, -89.16, 1237],
      ],
    );

    const santaAna = DEPARTMENTS[0];
    const url = new URL(forecastUrl(santaAna.latitude, santaAna.longitude));
    assert.equal(url.origin + url.pathname, "https://api.open-meteo.com/v1/forecast");
    assert.equal(url.searchParams.get("latitude"), "13.88");
    assert.equal(url.searchParams.get("longitude"), "-89.61");
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
