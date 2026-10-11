import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEPARTMENTS, nearestPlace, PLACE_COORDINATES, placeById } from "./places.ts";

describe("preset places", () => {
  it("resolves the three ids and rejects anything else", () => {
    assert.equal(placeById("santa-ana")?.name, "Santa Ana");
    assert.equal(placeById("ahuachapan")?.name, "Ahuachapán");
    assert.equal(placeById("chalatenango")?.name, "Chalatenango");
    assert.equal(placeById("san-salvador"), null);
  });

  it("reads each seat from the single coordinate config", () => {
    assert.deepEqual(PLACE_COORDINATES, {
      "santa-ana": { latitude: 13.88, longitude: -89.61, elevation: 1432 },
      ahuachapan: { latitude: 13.855, longitude: -89.835, elevation: 1290 },
      chalatenango: { latitude: 14.33, longitude: -89.16, elevation: 1237 },
    });
    for (const place of DEPARTMENTS) {
      assert.deepEqual(
        { latitude: place.latitude, longitude: place.longitude, elevation: place.elevation },
        PLACE_COORDINATES[place.id],
      );
    }
  });

  it("picks the nearest preset seat from a coordinate", () => {
    assert.equal(nearestPlace(13.89, -89.62).id, "santa-ana");
    assert.equal(nearestPlace(13.86, -89.84).id, "ahuachapan");
    assert.equal(nearestPlace(14.32, -89.15).id, "chalatenango");
  });
});
