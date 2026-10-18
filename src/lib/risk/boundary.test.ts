import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { placeById } from "../places.ts";
import { distanceToElSalvadorKm, EL_SALVADOR_BUFFER_KM, insideElSalvador } from "./boundary.ts";
import { loadPlaceRisk } from "./load.ts";

type BoundaryPoint = {
  id: string;
  lat: number;
  lon: number;
  expected_inside: boolean;
};

const points = JSON.parse(
  readFileSync(path.join(process.cwd(), "test/fixtures/boundary_test_points.json"), "utf8"),
) as BoundaryPoint[];

describe("El Salvador boundary", () => {
  it("keeps all 13 points on the expected side of the 1 km buffer", () => {
    assert.equal(points.length, 13);
    assert.equal(EL_SALVADOR_BUFFER_KM, 1);
    for (const point of points) {
      assert.equal(
        insideElSalvador(point.lat, point.lon, EL_SALVADOR_BUFFER_KM),
        point.expected_inside,
        point.id,
      );
    }
  });

  it("leaves San Fernando, Chalatenango outside the polygon and inside the buffer", () => {
    const place = placeById("san-fernando-chalatenango");
    assert.ok(place);
    if (!place) return;
    const distance = distanceToElSalvadorKm(place.latitude, place.longitude);
    assert.equal(insideElSalvador(place.latitude, place.longitude, 0), false);
    assert.equal(distance > 0.05 && distance < 0.5, true, String(distance));
    assert.equal(insideElSalvador(place.latitude, place.longitude, EL_SALVADOR_BUFFER_KM), true);
  });

  it("does not run the polygon check on a listed place", async () => {
    const place = placeById("san-fernando-chalatenango");
    assert.ok(place);
    if (!place) return;
    assert.equal(insideElSalvador(place.latitude, place.longitude, 0), false);
    const result = await loadPlaceRisk(place.id, async () => Response.json(dryForecast()));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.place.id, "san-fernando-chalatenango");
  });
});

function dryForecast() {
  const hourly = {
    time: [] as string[],
    temperature_2m: [] as number[],
    relative_humidity_2m: [] as number[],
    precipitation: [] as number[],
    precipitation_probability: [] as number[],
  };
  const daily = {
    time: [] as string[],
    temperature_2m_max: [] as number[],
    temperature_2m_min: [] as number[],
    precipitation_sum: [] as number[],
    precipitation_hours: [] as number[],
    precipitation_probability_max: [] as number[],
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
