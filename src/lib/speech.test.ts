import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickSpanishVoice } from "./speech.ts";

describe("Spanish voice", () => {
  it("uses only es-US, then es-MX, then es-ES", () => {
    const voices = [
      { lang: "en-US", name: "en" },
      { lang: "es-ES", name: "es" },
      { lang: "es-MX", name: "mx" },
      { lang: "es-US", name: "us" },
    ];
    assert.equal(pickSpanishVoice(voices)?.name, "us");
    assert.equal(pickSpanishVoice(voices.filter((voice) => voice.name !== "us"))?.name, "mx");
    assert.equal(
      pickSpanishVoice([{ lang: "es_ES", name: "es" }])?.name,
      "es",
    );
    assert.equal(
      pickSpanishVoice([{ lang: "es-ES-x-local", name: "local" }])?.name,
      "local",
    );
    assert.equal(pickSpanishVoice([{ lang: "es", name: "generic" }]), null);
    assert.equal(pickSpanishVoice([{ lang: "es-SV", name: "sv" }]), null);
    assert.equal(pickSpanishVoice([{ lang: "en-US", name: "en" }]), null);
  });
});
