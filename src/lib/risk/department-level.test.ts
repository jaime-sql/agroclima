import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATTRIBUTION_COLOR,
  LEVEL_STYLE,
  MAP_ATTRIBUTION,
  NO_COFFEE_POINTS_COPY,
  PAGE_BACKGROUND,
  SIN_DATOS_FILL,
  SIN_DATOS_INK,
  aggregateDepartmentLevel,
  departmentDisplayName,
  formatSvClock,
  mapSourceLine,
} from "./department-level.ts";

function channel(hex: string, index: number): number {
  const value = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function contrast(foreground: string, background: string): number {
  const luminance = (hex: string) =>
    0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("department level", () => {
  it("uses the worst scored point and ignores missing forecasts", () => {
    assert.deepEqual(aggregateDepartmentLevel(["bajo", "alto", "medio"]), {
      level: "alto",
      count: 3,
      label: "alto · 3 puntos",
    });
    assert.deepEqual(aggregateDepartmentLevel(["bajo", null, undefined]), {
      level: "bajo",
      count: 1,
      label: "bajo · 1 punto",
    });
    assert.deepEqual(aggregateDepartmentLevel([null, undefined]), {
      level: null,
      count: 0,
      label: "Sin datos",
    });
    assert.equal(aggregateDepartmentLevel([]).label, "Sin datos");
  });

  it("strips the geoBoundaries prefix and keeps names that have none", () => {
    assert.equal(departmentDisplayName("Departamento de Ahuachapán"), "Ahuachapán");
    assert.equal(departmentDisplayName("La Libertad"), "La Libertad");
    assert.equal(departmentDisplayName("San Vicente"), "San Vicente");
  });

  it("formats the El Salvador clock in 24 hours", () => {
    assert.equal(formatSvClock(Date.parse("2026-10-23T21:45:00Z")), "15:45");
    assert.equal(formatSvClock(Date.parse("2026-01-15T18:00:00Z")), "12:00");
    assert.equal(formatSvClock(Date.parse("2026-10-23T06:05:00Z")), "00:05");
    assert.equal(
      mapSourceLine("15:45"),
      "Riesgo calculado con pronóstico de Open-Meteo · actualizado 15:45",
    );
  });

  it("keeps the attribution and risk colours at 4.5:1 or better", () => {
    assert.equal(MAP_ATTRIBUTION, "Límites: geoBoundaries / © OpenStreetMap, CC BY-SA");
    assert.equal(
      NO_COFFEE_POINTS_COPY,
      "Aún no tenemos puntos cafetaleros en este departamento.",
    );
    assert.ok(contrast(ATTRIBUTION_COLOR, PAGE_BACKGROUND) >= 4.5);
    assert.ok(contrast("#78716C", PAGE_BACKGROUND) < 4.5);
    assert.ok(contrast(SIN_DATOS_INK, SIN_DATOS_FILL) >= 4.5);
    for (const level of ["alto", "medio", "bajo"] as const) {
      assert.ok(contrast(LEVEL_STYLE[level].text, LEVEL_STYLE[level].fill) >= 4.5, level);
    }
  });
});
