import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shortSha } from "./build-sha.ts";

describe("build sha", () => {
  it("uses dev when no commit is injected", () => {
    assert.equal(shortSha(undefined), "dev");
    assert.equal(shortSha(""), "dev");
    assert.equal(shortSha("   "), "dev");
  });

  it("keeps the first 7 characters of GITHUB_SHA", () => {
    assert.equal(
      shortSha("beaa6efd1b6712c8b35a6f5395f85fcb43790ef7"),
      "beaa6ef",
    );
  });
});
