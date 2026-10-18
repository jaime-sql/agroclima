import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { LOCATION_RECORDS, PLACES, placeById } from "../places.ts";
import { assessForecast } from "./assess.ts";
import {
  FAR_GPS_NOTE,
  farGpsTitle,
  gpsScreen,
  MUNICIPALITY_CENTRE_NOTE,
  municipalityCentreNote,
  OUTSIDE_EL_SALVADOR_MESSAGE,
  parseGpsQuery,
  roundCoordinate,
} from "./gps.ts";
import { handleRiskQuery, loadPointRisk } from "./load.ts";
import { clearPlaceMapCache } from "./places-forecast.ts";
import { distanceKm, NEAREST_PIN_KM } from "./nearest.ts";
import type { OpenMeteoForecast } from "./types.ts";

const pins = PLACES.map((place) => ({
  id: place.id,
  latitude: place.latitude,
  longitude: place.longitude,
}));

describe("gps cases", () => {
  it("shows a normal strip and no pin when the phone is farther than 25 km", () => {
    assert.equal(NEAREST_PIN_KM, 25);
    const screen = gpsScreen({
      latitude: 13.48,
      longitude: -88.18,
      elevationM: 812,
      places: pins,
    });
    assert.equal(screen.kind, "far");
    if (screen.kind !== "far") return;
    assert.equal(screen.showStrip, true);
    assert.equal(screen.highlightId, null);
    assert.equal(screen.showMunicipalityNote, false);
    assert.equal(screen.title, farGpsTitle(812));
    assert.equal(screen.title, "Su ubicación (aproximada) · 812 m");
    assert.equal(
      screen.note,
      "No hay un pin cercano en el mapa. Puede elegir un municipio para comparar.",
    );
    assert.equal(screen.note, FAR_GPS_NOTE);
    assert.equal(screen.note.includes(MUNICIPALITY_CENTRE_NOTE), false);
  });

  it("rejects a GPS point outside El Salvador and does not show a strip", async () => {
    const screen = gpsScreen({
      latitude: 13,
      longitude: -89.5,
      elevationM: 10,
      places: pins,
    });
    assert.equal(screen.kind, "outside");
    assert.equal(screen.showStrip, false);
    assert.equal(screen.highlightId, null);
    assert.equal(screen.message, OUTSIDE_EL_SALVADOR_MESSAGE);
    assert.equal(
      screen.message,
      "Esta herramienta solo cubre El Salvador. Elija un municipio en el mapa.",
    );
    let called = false;
    const result = await handleRiskQuery(new URL("https://agroclima.test/api/risk?lat=13&lon=-89.5"), async () => {
      called = true;
      return Response.json({});
    });
    assert.equal(called, false);
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, {
      ok: false,
      error: "outside_el_salvador",
      message: OUTSIDE_EL_SALVADOR_MESSAGE,
    });
  });

  it("shows the municipality-centre note only after a pin or municipality is chosen", () => {
    assert.equal(
      municipalityCentreNote("pin", "town_centre"),
      "El pronóstico es para el centro del municipio, no para su finca.",
    );
    assert.equal(
      municipalityCentreNote("municipality", "town_centre"),
      MUNICIPALITY_CENTRE_NOTE,
    );
    assert.equal(municipalityCentreNote("gps", "town_centre"), null);
    assert.equal(municipalityCentreNote("pin", "slope_point"), null);
    assert.equal(municipalityCentreNote(null, "town_centre"), null);
    const far = gpsScreen({
      latitude: 13.48,
      longitude: -88.18,
      elevationM: 100,
      places: pins,
    });
    assert.equal(far.showMunicipalityNote, false);
  });

  it("highlights the nearest pin at 25 km and not beyond it", () => {
    const origin = { id: "solo", latitude: 13.7, longitude: -89.2 };
    const near = gpsScreen({
      latitude: 13.7,
      longitude: -89.2,
      elevationM: 900,
      places: [origin],
    });
    assert.equal(near.kind, "near");
    if (near.kind !== "near") return;
    assert.equal(near.highlightId, "solo");
    assert.equal(near.showStrip, true);
    assert.equal(near.showMunicipalityNote, false);
    const probeKm = distanceKm(13.7, -89.2, 13.9, -89.2);
    const atLimit = 13.7 + 0.2 * (NEAREST_PIN_KM / probeKm);
    const pastLimit = 13.7 + 0.2 * ((NEAREST_PIN_KM + 1) / probeKm);
    const limit = gpsScreen({
      latitude: atLimit,
      longitude: -89.2,
      elevationM: 900,
      places: [origin],
    });
    assert.equal(limit.kind, "near");
    const beyond = gpsScreen({
      latitude: pastLimit,
      longitude: -89.2,
      elevationM: 900,
      places: [origin],
    });
    assert.equal(beyond.kind, "far");
    if (beyond.kind !== "far") return;
    assert.equal(beyond.highlightId, null);
    assert.equal(beyond.showStrip, true);
  });
});

describe("gps forecast", () => {
  it("rounds to 3 decimals and matches the engine level for a known fixture", async () => {
    const fixture = JSON.parse(
      readFileSync(path.join(process.cwd(), "test/fixtures/dr01_clear_low.json"), "utf8"),
    ) as OpenMeteoForecast;
    const parsed = parseGpsQuery("13.858822222", "-89.803980555");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.latitude, 13.859);
    assert.equal(parsed.longitude, -89.804);
    let called = "";
    const result = await loadPointRisk(parsed.latitude, parsed.longitude, async (input) => {
      called = String(input);
      return Response.json(fixture);
    });
    const expected = assessForecast(fixture);
    assert.equal(result.ok, true);
    if (!result.ok || !expected.available) return;
    assert.equal(result.days[0].level, expected.days[0].level);
    assert.equal(result.days[0].level, "bajo");
    assert.equal(result.elevation_m, 650);
    const url = new URL(called);
    assert.equal(url.searchParams.get("latitude"), "13.859");
    assert.equal(url.searchParams.get("longitude"), "-89.804");
    assert.equal(url.searchParams.get("elevation"), null);
    assert.equal(JSON.stringify(result).includes("13.859"), false);
  });

  it("returns the same week for a place id and that place's stored coordinate", async () => {
    clearPlaceMapCache();
    const fixture = readFixture();
    assert.equal(PLACES.length, 20);
    for (const place of PLACES) {
      const source = LOCATION_RECORDS.find((record) => record.id === place.id);
      assert.ok(source, place.id);
      if (!source) continue;
      assert.equal(place.latitude, roundCoordinate(source.lat), place.id);
      assert.equal(place.longitude, roundCoordinate(source.lon), place.id);

      let placeCalled = "";
      const byPlace = await handleRiskQuery(
        new URL(`https://agroclima.test/api/risk?place=${place.id}`),
        async (input) => {
          placeCalled = String(input);
          return Response.json(fixture);
        },
      );
      let pointCalled = "";
      const byPoint = await handleRiskQuery(
        new URL(
          `https://agroclima.test/api/risk?lat=${encodeURIComponent(String(place.latitude))}&lon=${encodeURIComponent(String(place.longitude))}`,
        ),
        async (input) => {
          pointCalled = String(input);
          return Response.json(fixture);
        },
      );
      assert.equal(byPlace.status, 200, place.id);
      assert.equal(byPoint.status, 200, place.id);
      assert.equal(byPlace.body.ok, true, place.id);
      assert.equal(byPoint.body.ok, true, place.id);
      if (!byPlace.body.ok || !byPoint.body.ok) continue;
      const placeUrl = new URL(placeCalled);
      const pointUrl = new URL(pointCalled);
      assert.equal(placeUrl.searchParams.get("latitude"), String(place.latitude), place.id);
      assert.equal(placeUrl.searchParams.get("longitude"), String(place.longitude), place.id);
      assert.equal(placeUrl.searchParams.get("latitude"), pointUrl.searchParams.get("latitude"), place.id);
      assert.equal(placeUrl.searchParams.get("longitude"), pointUrl.searchParams.get("longitude"), place.id);
      assert.equal(placeUrl.searchParams.get("elevation"), null, place.id);
      assert.equal(pointUrl.searchParams.get("elevation"), null, place.id);
      assert.deepEqual(byPlace.body.days, byPoint.body.days, place.id);
      assert.equal(byPlace.body.timezone, byPoint.body.timezone, place.id);
      assert.deepEqual(byPlace.body.plan, byPoint.body.plan, place.id);
      assert.equal(
        "elevation_m" in byPoint.body ? byPoint.body.elevation_m : null,
        fixture.elevation ?? null,
        place.id,
      );
    }
    clearPlaceMapCache();
  });

  it("still forecasts a listed place that sits just outside the polygon", async () => {
    const place = placeById("san-fernando-chalatenango");
    assert.ok(place);
    const result = await handleRiskQuery(
      new URL("https://agroclima.test/api/risk?place=san-fernando-chalatenango"),
      async () => Response.json(readFixture()),
    );
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
  });
});

function readFixture(): OpenMeteoForecast {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), "test/fixtures/dr01_clear_low.json"), "utf8"),
  ) as OpenMeteoForecast;
}
