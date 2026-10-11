import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickSpanishVoice } from "./speech.ts";

describe("Spanish voice", () => {
  it("prefers es-US, then es-MX, then es-ES, and hides when none are Spanish", () => {
    const voices = [
      { lang: "en-US", name: "en" },
      { lang: "es-ES", name: "es" },
      { lang: "es-MX", name: "mx" },
      { lang: "es-US", name: "us" },
    ];
    assert.equal(pickSpanishVoice(voices)?.name, "us");
    assert.equal(
      pickSpanishVoice([{ lang: "es_ES", name: "es" }])?.name,
      "es",
    );
    assert.equal(pickSpanishVoice([{ lang: "en-US", name: "en" }]), null);
  });
});
