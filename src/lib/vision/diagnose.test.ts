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
  RISK_ZONE_NOTE,
  SIN_DATOS_CARD,
  SIN_DATOS_MARK,
  SIN_DATOS_WORD,
  riskSourceNote,
  riskStripSubtitle,
  showsActionPlan,
} from "./copy.ts";
import { LOCATION_RECORDS, PLACES } from "../places.ts";
import { MUNICIPALITY_CENTRE_NOTE } from "../risk/gps.ts";
import { DEFAULT_OPENAI_MODEL } from "../openai.ts";
import { diagnoseImage, diagnosisForPage, interpretDiagnosis, parseModelPayload } from "./diagnose.ts";

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

  it("names the nearby coffee zone and keeps the three picker labels", () => {
    const names = PLACES.map((place) => place.name);
    for (const name of ["Santa Ana", "Ahuachapán", "Chalatenango"]) {
      assert.equal(names.includes(name), true, name);
    }
    assert.equal(
      riskStripSubtitle("Santa Ana"),
      "Zona cafetalera de Santa Ana · toque un día",
    );
    assert.equal(
      riskStripSubtitle("Ahuachapán"),
      "Zona cafetalera de Ahuachapán · toque un día",
    );
    assert.equal(
      riskStripSubtitle("Chalatenango"),
      "Zona cafetalera de Chalatenango · toque un día",
    );
    assert.equal(RISK_ZONE_NOTE, "Clima de una zona cafetalera cercana, no de su finca");
    assert.equal(riskSourceNote("slope_point"), RISK_ZONE_NOTE);
    assert.equal(showsActionPlan("unavailable", true), false);
    assert.equal(showsActionPlan("failed", true), false);
    assert.equal(showsActionPlan("offline", true), false);
    assert.equal(showsActionPlan(null, true), true);
    assert.equal(showsActionPlan(null, false), false);
  });

  it("shows one source line for every listed place", () => {
    assert.equal(LOCATION_RECORDS.length, 20);
    let townCentres = 0;
    let slopePoints = 0;
    for (const record of LOCATION_RECORDS) {
      const subtitle = riskStripSubtitle(record.name, record.coord_type);
      const note = riskSourceNote(record.coord_type);
      const lines = [RISK_ZONE_NOTE, MUNICIPALITY_CENTRE_NOTE].filter((line) => line === note);
      assert.equal(lines.length, 1, record.id);
      if (record.coord_type === "town_centre") {
        townCentres += 1;
        assert.equal(subtitle, record.name, record.id);
        assert.equal(subtitle.includes("Zona cafetalera"), false, record.id);
        assert.equal(note, MUNICIPALITY_CENTRE_NOTE, record.id);
      } else {
        slopePoints += 1;
        assert.equal(subtitle, `Zona cafetalera de ${record.name} · toque un día`, record.id);
        assert.equal(note, RISK_ZONE_NOTE, record.id);
      }
    }
    assert.equal(townCentres, 17);
    assert.equal(slopePoints, 3);
  });

  it("lets a retake win, and keeps a healthy leaf unsure below 0.85", () => {
    const blur = interpretDiagnosis("retomar", 0.99, "borrosa");
    assert.equal(blur.headline, "Repetir foto");
    assert.equal(blur.detail, "La foto está borrosa.");
    assert.equal(blur.band, "no_seguro");

    const lowHealthy = interpretDiagnosis("sana", 0.84, null);
    assert.equal(lowHealthy.band, "no_seguro");
    assert.equal(lowHealthy.headline, "No estamos seguros");
    assert.equal(visibleDiagnosis(lowHealthy).includes("%"), false);
    assert.equal(/\b(Alta|Media|Baja)\b/.test(visibleDiagnosis(lowHealthy)), false);

    const healthy = interpretDiagnosis("sana", 0.85, null);
    assert.equal(healthy.band, "seguro");
    assert.equal(healthy.headline, "Parece sana");
    assert.equal(healthy.detail.includes("%"), false);
    assert.equal(healthy.detail.includes("Seguro"), false);

    const probable = interpretDiagnosis("roya", 0.7, null);
    assert.equal(probable.band, "probable");
    assert.equal(probable.detail.includes("%"), false);
    assert.equal(/\b(Probable|Alta|Media|Baja)\b/.test(probable.detail), false);
    assert.match(probable.detail, /Confirme con un agrónomo/);

    const sure = interpretDiagnosis("roya", 0.8, null);
    assert.equal(sure.band, "seguro");
    assert.equal(sure.detail.includes("%"), false);
    assert.equal(`${sure.headline} ${sure.detail}`.includes("80"), false);
    assert.equal(/\b(Seguro|Alta)\b/.test(`${sure.headline} ${sure.detail}`), false);

    const unsure = interpretDiagnosis("roya", 0.59, null);
    assert.equal(unsure.band, "no_seguro");
    assert.equal(unsure.card, null);
    assert.equal(unsure.headline, "No estamos seguros");
    assert.equal(unsure.headline.includes("%"), false);
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

  it("calls gpt-4.1-mini on OpenAI when the key is set and the model is omitted", async () => {
    let url = "";
    let model = "";
    let authorization = "";
    const result = await diagnoseImage({
      bytes: new Uint8Array([1]),
      mediaType: "image/jpeg",
      env: { apiKey: "secret" },
      fetchImpl: async (input, init) => {
        url = String(input);
        const headers = new Headers(init?.headers);
        authorization = headers.get("authorization") ?? "";
        model = JSON.parse(String(init?.body)).model;
        return Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({ label: "sana", confidence: 0.9, retake_reason: null }),
              },
            },
          ],
        });
      },
    });
    assert.equal(url, "https://api.openai.com/v1/chat/completions");
    assert.equal(model, DEFAULT_OPENAI_MODEL);
    assert.equal(model, "gpt-4.1-mini");
    assert.equal(authorization, "Bearer secret");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.label, "sana");
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
      const page = diagnosisForPage(result);
      assert.equal("confidence" in page, false);
      assert.equal("percent" in page, false);
      assert.equal(JSON.stringify(page).includes("%"), false);
    }
  });
});

function visibleDiagnosis(result: ReturnType<typeof interpretDiagnosis>): string {
  return [result.headline, result.detail, result.advice ?? "", result.card ?? ""].join(" ");
}
