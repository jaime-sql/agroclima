import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DOSE_NOTE, FUNGICIDE_CLASSES } from "./risk/assess.ts";
import {
  agronomistSharePayload,
  agronomistShareText,
  canShareFiles,
  whatsAppLink,
} from "./share.ts";

describe("agronomist share", () => {
  it("builds a wa.me text link and does not put a numeric dose in the message", () => {
    const text = agronomistShareText({
      summary: "Parece roya (Probable).",
      placeName: "Santa Ana",
      photoDate: "12/10/2026",
    });
    assert.equal(
      text,
      "AgroClima: Parece roya (Probable). Foto del 12/10/2026. Departamento: Santa Ana. Es una orientación, no un diagnóstico.",
    );
    assert.equal(text.includes(DOSE_NOTE), false);
    assert.match(whatsAppLink(text), /^https:\/\/wa\.me\/\?text=/);
    assert.equal(
      decodeURIComponent(whatsAppLink(text).slice("https://wa.me/?text=".length)),
      text,
    );
    for (const name of FUNGICIDE_CLASSES) {
      assert.equal(text.includes(name), false);
    }
    assert.equal(/\d+\s*(kg|cc|ml|g)\b/i.test(text), false);
    assert.equal(
      agronomistSharePayload({
        diagnoseError: null,
        summary: "Parece roya (Probable).",
        placeName: "Santa Ana",
        photoDate: "12/10/2026",
        days: [],
      }).includePhoto,
      true,
    );
  });

  it("shares the collapsed week when the leaf was not reviewed", () => {
    const week = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"].map(
      (date) => ({ date, level: "alto" as const }),
    );
    const payload = agronomistSharePayload({
      diagnoseError: "unavailable",
      summary: "No pudimos revisar la hoja.",
      placeName: "Santa Ana",
      photoDate: "11/10/2026",
      days: week,
    });
    assert.equal(payload.includePhoto, false);
    assert.equal(
      payload.text,
      "AgroClima: Riesgo de roya esta semana en la zona cafetalera de Santa Ana: Alto lun\u2013dom. Es una orientación, no un diagnóstico.",
    );
    assert.equal(payload.text.includes("No pudimos revisar la hoja"), false);
    assert.equal(payload.text.includes("Foto del"), false);

    const mixed = agronomistSharePayload({
      diagnoseError: "failed",
      summary: "No pudimos revisar la hoja.",
      placeName: "Chalatenango",
      photoDate: "11/10/2026",
      days: [
        { date: "2026-10-12", level: "alto" },
        { date: "2026-10-13", level: "alto" },
        { date: "2026-10-14", level: "medio" },
        { date: "2026-10-15", level: null },
        { date: "2026-10-16", level: "bajo" },
        { date: "2026-10-17", level: "bajo" },
        { date: "2026-10-18", level: "bajo" },
      ],
    });
    assert.equal(
      mixed.text,
      "AgroClima: Riesgo de roya esta semana en la zona cafetalera de Chalatenango: Alto lun\u2013mar, Medio mié, Sin datos jue, Bajo vie\u2013dom. Es una orientación, no un diagnóstico.",
    );
    assert.equal(mixed.includePhoto, false);

    const failed = agronomistSharePayload({
      diagnoseError: "offline",
      summary: "No pudimos revisar la hoja.",
      placeName: "Ahuachapán",
      photoDate: "11/10/2026",
      days: [],
      forecastUnavailable: true,
    });
    assert.equal(failed.includePhoto, false);
    assert.equal(
      failed.text,
      "AgroClima: Riesgo de roya esta semana en la zona cafetalera de Ahuachapán: Pronóstico no disponible. Es una orientación, no un diagnóstico.",
    );
  });

  it("uses the file share path only when canShare accepts files", () => {
    const file = new File(["leaf"], "hoja.jpg", { type: "image/jpeg" });
    assert.equal(canShareFiles(undefined, file), false);
    assert.equal(
      canShareFiles(() => {
        throw new Error("unsupported");
      }, file),
      false,
    );
    assert.equal(
      canShareFiles((data) => data?.files?.length === 1, file),
      true,
    );
  });
});
