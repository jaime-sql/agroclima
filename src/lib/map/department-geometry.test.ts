import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { MAP_TARGET_PX, projectDepartments, type DepartmentGeoJson } from "./department-geometry.ts";

describe("department geometry", () => {
  it("projects the 14 departments into the 390px column", () => {
    const geo = JSON.parse(readFileSync("data/dept_map/departments.geojson", "utf8")) as DepartmentGeoJson;
    const projected = projectDepartments(geo);
    assert.equal(projected.shapes.length, 14);
    assert.ok(projected.width >= MAP_TARGET_PX);
    for (const shape of projected.shapes) {
      assert.equal(Number.isFinite(shape.labelX), true, shape.name);
      assert.equal(Number.isFinite(shape.labelY), true, shape.name);
      assert.ok(shape.d.startsWith("M"), shape.name);
      assert.ok(shape.boxWidth > 0 && shape.boxHeight > 0, shape.name);
    }
    const narrow = projected.shapes.filter((shape) => shape.boxWidth < 44 || shape.boxHeight < 44);
    assert.ok(narrow.length > 0);
  });
});
