import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DOSE_NOTE, FUNGICIDE_CLASSES } from "./risk/assess.ts";
import { agronomistShareText, canShareFiles, whatsAppLink } from "./share.ts";

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
