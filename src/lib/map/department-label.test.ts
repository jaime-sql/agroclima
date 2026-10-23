import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { MAP_TARGET_PX, projectDepartments, type DepartmentGeoJson } from "./department-geometry.ts";
import {
  DEPARTMENT_SHORT_NAME,
  labelRectsCollide,
  narrowDepartmentText,
  placeDepartmentLabels,
  shortDepartmentName,
} from "./department-label.ts";

const geo = JSON.parse(readFileSync("data/dept_map/departments.geojson", "utf8")) as DepartmentGeoJson;

describe("department map labels", () => {
  it("uses a short name only when the risk word does not fit, and La Libertad is La Lib.", () => {
    assert.equal(shortDepartmentName("La Libertad"), "La Lib.");
    assert.equal(DEPARTMENT_SHORT_NAME["La Libertad"], "La Lib.");
    assert.equal(narrowDepartmentText("Santa Ana", "Alto", 120), "Alto");
    assert.equal(narrowDepartmentText("La Libertad", "Sin datos", 80), "Sin datos");
    assert.equal(narrowDepartmentText("La Libertad", "Sin datos", 56), "La Lib.");
    assert.equal(narrowDepartmentText("Cuscatlán", "Sin datos", 20), "S/d");
  });

  it("keeps phone labels inside the shapes without leader lines", () => {
    const projected = projectDepartments(geo);
    const levels = new Map(projected.shapes.map((shape) => [shape.name, "Sin datos"]));
    levels.set("Santa Ana", "Alto");
    levels.set("Ahuachapán", "Alto");
    levels.set("Sonsonate", "Medio");
    levels.set("Chalatenango", "Alto");
    levels.set("Morazán", "Alto");
    levels.set("Usulután", "Alto");
    const placed = placeDepartmentLabels({
      shapes: projected.shapes,
      mapWidth: projected.width,
      mapHeight: projected.height,
      displayWidth: MAP_TARGET_PX,
      wide: false,
      levelFor: (name) => levels.get(name) ?? "Sin datos",
    });
    assert.equal(placed.length, 14);
    const byName = new Map(placed.map((label) => [label.name, label.text]));
    assert.equal(byName.get("Santa Ana"), "Alto");
    assert.equal(byName.get("La Libertad"), "Sin datos");
    assert.equal(byName.get("San Vicente"), "S. Vic.");
    assert.equal(byName.get("La Unión"), "La Un.");
    for (const label of placed) {
      assert.equal(label.text.includes("puntos"), false, label.name);
      assert.equal(label.text.includes("·"), false, label.name);
    }
    assert.equal(
      labelRectsCollide(projected.shapes, placed, projected.width, projected.height, MAP_TARGET_PX),
      false,
    );
  });

  it("uses the full department name once the map is wide", () => {
    const projected = projectDepartments(geo);
    const placed = placeDepartmentLabels({
      shapes: projected.shapes,
      mapWidth: projected.width,
      mapHeight: projected.height,
      displayWidth: 616,
      wide: true,
      levelFor: () => "Alto",
    });
    assert.deepEqual(
      placed.map((label) => label.text).sort(),
      projected.shapes.map((shape) => shape.name).sort(),
    );
    assert.equal(
      labelRectsCollide(projected.shapes, placed, projected.width, projected.height, 616),
      false,
    );
  });
});
