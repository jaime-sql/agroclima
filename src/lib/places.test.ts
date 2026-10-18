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
      assert.equal(
        record.coord_type === "town_centre" || record.coord_type === "slope_point",
        true,
        record.id,
      );
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
    assert.equal(placeById("santa-ana")?.coordType, "slope_point");
    assert.equal(placeById("santa-ana")?.latitude, 13.88);
    assert.equal(placeById("santa-ana")?.longitude, -89.61);
    assert.equal(placeById("santa-ana")?.elevation, 1432);
    assert.equal(placeById("ahuachapan")?.name, "Ahuachapán");
    assert.equal(placeById("ahuachapan")?.latitude, 13.855);
    assert.equal(placeById("ahuachapan")?.longitude, -89.835);
    assert.equal(placeById("ahuachapan")?.elevation, 1290);
    assert.equal(placeById("chalatenango")?.name, "Chalatenango");
    assert.equal(placeById("chalatenango")?.latitude, 14.33);
    assert.equal(placeById("chalatenango")?.longitude, -89.16);
    assert.equal(placeById("chalatenango")?.elevation, 1237);
    assert.equal(placeById("apaneca-ahuachapan")?.name, "Apaneca");
    assert.equal(placeById("apaneca-ahuachapan")?.coordType, "town_centre");
    assert.equal(placeById("apaneca-ahuachapan")?.latitude, 13.858822222);
    assert.equal(placeById("san-fernando-chalatenango")?.name, "San Fernando");
    assert.equal(placeById("san-fernando-chalatenango")?.department, "Chalatenango");
    assert.equal(placeById("san-fernando-morazan")?.name, "San Fernando");
    assert.equal(placeById("san-fernando-morazan")?.department, "Morazán");
    assert.equal(
      PLACES.some((place) => /cuscatlán/i.test(place.name) || /cuscatlán/i.test(place.department)),
      false,
    );
    assert.deepEqual(
      placesInDepartment("Santa Ana").map((place) => place.id),
      ["santa-ana"],
    );
    assert.equal(departmentNames().includes("Sonsonate"), true);
    assert.deepEqual(
      filterPlacesByName(placesInDepartment("Sonsonate"), "juayua").map((place) => place.id),
      ["juayua-sonsonate"],
    );
    assert.deepEqual(filterPlacesByName(placesInDepartment("Santa Ana"), "zzz"), []);
  });

  it("picks the nearest municipal point", () => {
    assert.equal(nearestPlace(13.88, -89.61).id, "santa-ana");
    assert.equal(nearestPlace(13.855, -89.835).id, "ahuachapan");
    assert.equal(nearestPlace(14.33, -89.16).id, "chalatenango");
    assert.equal(PLACES.length, 20);
  });
});
