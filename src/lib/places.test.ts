import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  departmentNames,
  EL_SALVADOR_LATITUDE,
  EL_SALVADOR_LONGITUDE,
  filterPlacesByName,
  LOCATION_RECORDS,
  locationRecordErrors,
  nearestPlace,
  placeById,
  placesInDepartment,
  PLACES,
  PRESET_PLACE_IDS,
} from "./places.ts";

describe("locations file", () => {
  it("keeps unique ids inside El Salvador and a named source", () => {
    assert.deepEqual(locationRecordErrors(LOCATION_RECORDS), []);
    const ids = LOCATION_RECORDS.map((record) => record.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const record of LOCATION_RECORDS) {
      assert.equal(record.department.trim().length > 0, true, record.id);
      assert.equal(record.source.trim().length > 0, true, record.id);
      assert.equal(record.lat >= EL_SALVADOR_LATITUDE.min, true, record.id);
      assert.equal(record.lat <= EL_SALVADOR_LATITUDE.max, true, record.id);
      assert.equal(record.lon >= EL_SALVADOR_LONGITUDE.min, true, record.id);
      assert.equal(record.lon <= EL_SALVADOR_LONGITUDE.max, true, record.id);
    }
    for (const id of PRESET_PLACE_IDS) {
      assert.equal(placeById(id)?.id, id);
    }
    assert.equal(placeById("san-salvador"), null);
  });

  it("groups municipalities by department and filters accents", () => {
    assert.equal(placeById("santa-ana")?.name, "Santa Ana");
    assert.equal(placeById("santa-ana")?.department, "Santa Ana");
    assert.equal(placeById("ahuachapan")?.name, "Ahuachapán");
    assert.equal(placeById("chalatenango")?.name, "Chalatenango");
    assert.deepEqual(
      placesInDepartment("Santa Ana").map((place) => place.id),
      ["chalchuapa", "metapan", "santa-ana"],
    );
    assert.equal(departmentNames().includes("Sonsonate"), true);
    assert.deepEqual(
      filterPlacesByName(placesInDepartment("Sonsonate"), "juayua").map((place) => place.id),
      ["juayua"],
    );
    assert.deepEqual(filterPlacesByName(placesInDepartment("Santa Ana"), "zzz"), []);
  });

  it("picks the nearest municipal point", () => {
    assert.equal(nearestPlace(13.96, -89.56).id, "santa-ana");
    assert.equal(nearestPlace(13.96, -89.86).id, "ahuachapan");
    assert.equal(nearestPlace(14.04, -88.94).id, "chalatenango");
    assert.equal(PLACES.length >= 15, true);
  });
});
