import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DIAGNOSE_ERROR_COPY,
  DIAGNOSE_UNAVAILABLE_COPY,
  diagnosisStatusCopy,
  FORECAST_MISSING_COPY,
  FORECAST_UNAVAILABLE_TITLE,
  OFFLINE_COPY,
  RETRY_LABEL,
  SIN_DATOS_CARD,
  SIN_DATOS_MARK,
  SIN_DATOS_WORD,
} from "./copy.ts";
import { diagnoseImage, interpretDiagnosis, parseModelPayload } from "./diagnose.ts";

describe("diagnosis", () => {
  it("returns a structured unavailable error and does not call the network when the key is missing", async () => {
    let called = false;
    const result = await diagnoseImage({
      bytes: new Uint8Array([1, 2, 3]),
      mediaType: "image/jpeg",
      env: { apiKey: "", baseUrl: "https://example.test/v1", model: "vision" },
      fetchImpl: async () => {
        called = true;
        return new Response("no");
      },
    });
    assert.equal(called, false);
    assert.deepEqual(result, { ok: false, error: "unavailable" });
    assert.equal(DIAGNOSE_UNAVAILABLE_COPY, "El servicio no está disponible ahora.");
    assert.equal(diagnosisStatusCopy("unavailable"), DIAGNOSE_UNAVAILABLE_COPY);
    assert.equal(DIAGNOSE_ERROR_COPY, "Algo salió mal. Intente otra vez.");
    assert.equal(diagnosisStatusCopy("failed"), DIAGNOSE_ERROR_COPY);
    assert.equal(diagnosisStatusCopy("offline"), OFFLINE_COPY);
    assert.notEqual(DIAGNOSE_UNAVAILABLE_COPY, DIAGNOSE_ERROR_COPY);
    assert.equal(RETRY_LABEL, "Intentar de nuevo");
    assert.equal(SIN_DATOS_MARK, "–");
    assert.equal(SIN_DATOS_WORD, "Sin datos");
    assert.equal(SIN_DATOS_CARD, "No hay pronóstico completo para este día.");
    assert.equal(FORECAST_UNAVAILABLE_TITLE, "Pronóstico no disponible");
    assert.equal(
      FORECAST_MISSING_COPY,
      "No pudimos obtener el pronóstico. Revise su señal e intente de nuevo.",
    );
  });

  it("lets a retake win, and keeps a healthy leaf unsure below 0.85", () => {
    const blur = interpretDiagnosis("retomar", 0.99, "borrosa");
    assert.equal(blur.headline, "Repetir foto");
    assert.equal(blur.detail, "La foto está borrosa.");
    assert.equal(blur.band, "no_seguro");

    const lowHealthy = interpretDiagnosis("sana", 0.84, null);
    assert.equal(lowHealthy.band, "no_seguro");
    assert.match(lowHealthy.headline, /No seguro/);

    const healthy = interpretDiagnosis("sana", 0.85, null);
    assert.equal(healthy.band, "seguro");
    assert.equal(healthy.headline, "Parece sana");

    const probable = interpretDiagnosis("roya", 0.7, null);
    assert.equal(probable.band, "probable");
    assert.match(probable.detail, /Probable · 70 %/);
    assert.match(probable.detail, /Confirme con un agrónomo/);

    const sure = interpretDiagnosis("roya", 0.8, null);
    assert.equal(sure.band, "seguro");
    assert.equal(sure.detail, "Seguro · 80 %");

    const unsure = interpretDiagnosis("roya", 0.59, null);
    assert.equal(unsure.band, "no_seguro");
    assert.equal(unsure.card, null);
  });

  it("uses the generic retake when the model text is not the expected JSON", () => {
    const parsed = parseModelPayload("not json");
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.label, "retomar");
      assert.equal(parsed.retakeReason, "otra");
      assert.equal(parsed.detail, "No pudimos revisar esta foto.");
    }
  });

  it("does not invent a disease when the vendor answers with an HTTP error", async () => {
    const result = await diagnoseImage({
      bytes: new Uint8Array([9]),
      mediaType: "image/jpeg",
      env: {
        apiKey: "secret",
        baseUrl: "https://example.test/v1",
        model: "vision",
      },
      fetchImpl: async () => new Response("nope", { status: 500 }),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.label, "retomar");
      assert.equal(result.confidence, 0);
    }
  });
});
