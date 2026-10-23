import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REASON_ALTO } from "./risk/assess.ts";
import {
  DETECTION_NOTE,
  DETECTION_NOTE_COLOR,
  ORIENTATION_TAG,
  buildWhyModel,
  whyReasons,
} from "./result-why.ts";

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

const day = { wetHours: 12, rain: 4.2, tmax: 24, engineReason: REASON_ALTO };

describe("why this result", () => {
  it("leads with the weather and keeps at most one leaf line", () => {
    const reasons = whyReasons({ ...day, label: "roya", leafDetail: "Seguro · 90 %" });
    assert.equal(reasons.length, 3);
    assert.match(reasons[0] ?? "", /12 h de humedad/);
    assert.equal(reasons[1], "Hojas mojadas muchas horas y clima tibio: la roya se pega fácil.");
    assert.equal(reasons[2], "Segunda opinión: manchas observadas en la hoja.");
    assert.equal(reasons.some((reason) => reason.includes("%")), false);
    const weatherOnly = whyReasons({ ...day, label: null, leafDetail: null, rain: 1, tmax: 22 });
    assert.equal(weatherOnly.length, 2);
    assert.equal(weatherOnly.some((reason) => reason.startsWith("Segunda opinión")), false);
  });

  it("shows the cited detection note and the technician button on every diagnosis", () => {
    assert.equal(ORIENTATION_TAG, "Orientativo \u2014 no es un diagnóstico");
    assert.equal(
      DETECTION_NOTE,
      "Detección de roya: acierto 73% (IC 95% 68\u201379%) en 252 fotos públicas de hojas de Brasil (BRACOL, CC BY 4.0), tomadas en laboratorio, no en El Salvador. Detecta 58% de las hojas con roya. No es un diagnóstico; consulte a un técnico.",
    );
    assert.ok(contrast(DETECTION_NOTE_COLOR, "#FFFFFF") >= 4.5);
    assert.ok(contrast(DETECTION_NOTE_COLOR, "#E7E5E4") >= 4.5);

    for (const label of ["roya", "sana", "otro", "retomar"] as const) {
      const model = buildWhyModel({
        label,
        leafDetail: label === "retomar" ? "La foto está borrosa." : null,
        diagnoseFailed: false,
        day: null,
      });
      assert.equal(model?.showTechnician, true, label);
      assert.equal(model?.detectionNote, DETECTION_NOTE, label);
      assert.equal(JSON.stringify(model?.reasons).includes("Alta"), false);
    }

    const failed = buildWhyModel({
      label: null,
      leafDetail: null,
      diagnoseFailed: true,
      day: null,
    });
    assert.equal(failed?.showTechnician, true);
    assert.equal(failed?.detectionNote, DETECTION_NOTE);

    const weather = buildWhyModel({
      label: null,
      leafDetail: null,
      diagnoseFailed: false,
      day: { wetHours: 8, rain: 1, tmax: 23, reason: REASON_ALTO },
    });
    assert.equal(weather?.showTechnician, false);
    assert.equal(weather?.detectionNote, null);
    assert.equal(weather?.reasons[0], "8 h de humedad.");
  });
});
