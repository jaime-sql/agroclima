import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nearestPlace, placeById } from "./places.ts";

describe("preset places", () => {
  it("resolves the three ids and rejects anything else", () => {
    assert.equal(placeById("santa-ana")?.name, "Santa Ana");
    assert.equal(placeById("ahuachapan")?.name, "Ahuachapán");
    assert.equal(placeById("chalatenango")?.name, "Chalatenango");
    assert.equal(placeById("san-salvador"), null);
  });

  it("picks the nearest preset seat from a coordinate", () => {
    assert.equal(nearestPlace(13.99, -89.56).id, "santa-ana");
    assert.equal(nearestPlace(13.92, -89.84).id, "ahuachapan");
    assert.equal(nearestPlace(14.04, -88.94).id, "chalatenango");
  });
});
