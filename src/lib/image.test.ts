import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PHOTO_MAX_EDGE, scaledSize } from "./image.ts";

describe("photo downscale", () => {
  it("keeps a small photo and shrinks the long edge to the cap", () => {
    assert.deepEqual(scaledSize(800, 600, PHOTO_MAX_EDGE), {
      width: 800,
      height: 600,
    });
    assert.deepEqual(scaledSize(4000, 3000, PHOTO_MAX_EDGE), {
      width: 1280,
      height: 960,
    });
    assert.deepEqual(scaledSize(2000, 4000, 1000), {
      width: 500,
      height: 1000,
    });
  });
});
