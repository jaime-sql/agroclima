import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { assessForecast } from "./assess.ts";
import {
  boundarySha256,
  departmentCatalog,
  departmentMapFromWeeks,
  locationsSha256,
  parseDepartmentMap,
} from "./department-catalog.ts";
import { worstDay } from "./pin-card.ts";
import { PLACES } from "../places.ts";

const WITH_POINTS: Record<string, number> = {
  "La Libertad": 5,
  Chalatenango: 4,
  Ahuachapán: 3,
  Usulután: 3,
  Morazán: 2,
  Sonsonate: 2,
  "Santa Ana": 1,
};

const WITHOUT_POINTS = [
  "Cabañas",
  "Cuscatlán",
  "La Paz",
  "La Unión",
  "San Miguel",
  "San Salvador",
  "San Vicente",
];

function sha256(path: string): string {
  // The published source files use LF. Git may check them out with CRLF on Windows,
  // so hash normalized text rather than the platform-specific working-tree bytes.
  const normalized = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(normalized).digest("hex");
}

describe("department catalog", () => {
  it("matches the pinned boundaries and the 20 coffee places", () => {
    assert.equal(sha256("data/dept_map/departments.geojson"), boundarySha256());
    assert.equal(sha256("src/data/locations.json"), locationsSha256());
    const catalog = departmentCatalog();
    assert.equal(catalog.length, 14);
    const byName = new Map(catalog.map((entry) => [entry.name, entry]));
    for (const [name, count] of Object.entries(WITH_POINTS)) {
      assert.equal(byName.get(name)?.locationIds.length, count, name);
      assert.equal(byName.get(name)?.hasPoints, true, name);
    }
    for (const name of WITHOUT_POINTS) {
      assert.equal(byName.get(name)?.hasPoints, false, name);
      assert.deepEqual(byName.get(name)?.locationIds, [], name);
    }
    const ids = catalog.flatMap((entry) => entry.locationIds);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids.slice().sort(), PLACES.map((place) => place.id).slice().sort());
    const geo = JSON.parse(readFileSync("data/dept_map/departments.geojson", "utf8")) as {
      features: Array<{ properties: { shapeName: string } }>;
    };
    assert.equal(geo.features.length, 14);
    assert.deepEqual(
      geo.features.map((feature) => feature.properties.shapeName).sort(),
      catalog.map((entry) => entry.shapeName).sort(),
    );
  });

  it("scores a department from the engine and leaves an empty one as Sin datos", () => {
    const high = assessForecast(
      JSON.parse(readFileSync("test/fixtures/dr03_clear_high.json", "utf8")),
    );
    const low = assessForecast(
      JSON.parse(readFileSync("test/fixtures/dr01_clear_low.json", "utf8")),
    );
    const medium = assessForecast(
      JSON.parse(readFileSync("test/fixtures/dr02_clear_medium.json", "utf8")),
    );
    assert.equal(worstDay(high.days)?.level, "alto");
    assert.equal(worstDay(medium.days)?.level, "medio");
    assert.equal(worstDay(low.days)?.level, "bajo");
    const weeks = new Map([
      ["apaneca-ahuachapan", high],
      ["concepcion-de-ataco-ahuachapan", high],
      ["ahuachapan", low],
    ]);
    const map = departmentMapFromWeeks(weeks, Date.parse("2026-10-23T21:45:00Z"));
    assert.equal(map.updatedLabel, "15:45");
    const ahuachapan = map.departments.find((item) => item.name === "Ahuachapán");
    assert.equal(ahuachapan?.label, "alto · 3 puntos");
    assert.equal(ahuachapan?.points.find((point) => point.id === "ahuachapan")?.level, "bajo");
    const cabanas = map.departments.find((item) => item.name === "Cabañas");
    assert.equal(cabanas?.label, "Sin datos");
    assert.equal(cabanas?.hasPoints, false);
    assert.deepEqual(cabanas?.points, []);
    assert.equal(parseDepartmentMap(map)?.departments.length, 14);
    assert.equal(parseDepartmentMap({ ok: false }), null);
  });
});
