import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DOSE_NOTE, FUNGICIDE_CLASSES, REASON_ALTO } from "./risk/assess.ts";
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

  it("shares only the coffee zone and the week when the leaf was not reviewed", () => {
    const payload = agronomistSharePayload({
      diagnoseError: "unavailable",
      summary: "No pudimos revisar la hoja.",
      placeName: "Santa Ana",
      photoDate: "11/10/2026",
      days: [
        {
          date: "2026-10-11",
          level: "alto",
          reason: REASON_ALTO,
          wetHours: 11,
          tmax: 24,
          rain: 6,
        },
        {
          date: "2026-10-12",
          level: null,
          reason: "«sin datos»",
          wetHours: 0,
          tmax: null,
          rain: null,
        },
      ],
    });
    assert.equal(payload.includePhoto, false);
    assert.equal(
      payload.text,
      "Zona cafetalera de Santa Ana. Dom 11: Alto. 11 horas húmedas, máx. 24 °C, lluvia 6 mm. «Hojas mojadas muchas horas y clima tibio: la roya se pega fácil.» Lun 12: Sin datos.",
    );
    assert.equal(payload.text.includes("No pudimos revisar la hoja"), false);
    assert.equal(payload.text.includes("Foto del"), false);

    const failed = agronomistSharePayload({
      diagnoseError: "failed",
      summary: "No pudimos revisar la hoja.",
      placeName: "Ahuachapán",
      photoDate: "11/10/2026",
      days: [],
      forecastUnavailable: true,
    });
    assert.equal(failed.includePhoto, false);
    assert.equal(failed.text.includes("No pudimos revisar la hoja"), false);
    assert.match(failed.text, /^Zona cafetalera de Ahuachapán\. Pronóstico no disponible\./);
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
