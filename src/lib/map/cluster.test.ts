import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLACES } from "../places.ts";
import {
  LEVEL_COLOR,
  LEVEL_LETTER,
  TAP_PX,
  closestMetres,
  clusterPlaces,
  contrastOnWhite,
  pixelsForMetres,
  project,
  shouldSpiderfy,
  spiderfyOffsets,
  worstLevel,
} from "./cluster.ts";

describe("map clusters", () => {
  it("paints a cluster with the worst level inside it", () => {
    assert.equal(worstLevel(["bajo", "medio", "alto"]), "alto");
    assert.equal(worstLevel(["bajo", "medio"]), "medio");
    assert.equal(worstLevel(["bajo", "bajo"]), "bajo");
    assert.equal(worstLevel(["medio", null, "bajo"]), "medio");
    assert.equal(LEVEL_LETTER.alto, "A");
    assert.equal(LEVEL_LETTER.medio, "M");
    assert.equal(LEVEL_LETTER.bajo, "B");
  });

  it("keeps overlapping tap targets together and separates them once 1.8 km fits", () => {
    const crowded = clusterPlaces(PLACES, 8);
    assert.ok(crowded.some((group) => group.length > 1));
    for (const group of crowded) {
      if (group.length < 2) continue;
      const close = group.some((place, index) =>
        group.slice(index + 1).some((other) => {
          const left = project(place.latitude, place.longitude, 8);
          const right = project(other.latitude, other.longitude, 8);
          return Math.hypot(left.x - right.x, left.y - right.y) < TAP_PX;
        }),
      );
      assert.equal(close, true, group.map((place) => place.id).join(","));
    }
    const separated = clusterPlaces(PLACES, 12);
    assert.equal(separated.length, PLACES.length);
    for (let i = 0; i < PLACES.length; i += 1) {
      for (let j = i + 1; j < PLACES.length; j += 1) {
        const left = project(PLACES[i].latitude, PLACES[i].longitude, 12);
        const right = project(PLACES[j].latitude, PLACES[j].longitude, 12);
        assert.ok(Math.hypot(left.x - right.x, left.y - right.y) >= TAP_PX);
      }
    }
    const closest = closestMetres(PLACES);
    assert.ok(closest < 2000);
    assert.ok(pixelsForMetres(closest, 14.3, 11) < TAP_PX);
    assert.ok(pixelsForMetres(closest, 14.3, 12) >= TAP_PX);
  });

  it("spiderfies only when max zoom would still overlap, with gaps of a tap target", () => {
    assert.equal(shouldSpiderfy(TAP_PX - 1), true);
    assert.equal(shouldSpiderfy(TAP_PX), false);
    for (const count of [2, 3, 5]) {
      const offsets = spiderfyOffsets(count);
      assert.equal(offsets.length, count);
      for (let i = 0; i < offsets.length; i += 1) {
        for (let j = i + 1; j < offsets.length; j += 1) {
          const distance = Math.hypot(offsets[i].x - offsets[j].x, offsets[i].y - offsets[j].y);
          assert.ok(distance >= TAP_PX - 0.01, `${count} ${distance}`);
        }
      }
    }
  });

  it("keeps white letters above the AA contrast floor", () => {
    const ratios = {
      alto: contrastOnWhite(LEVEL_COLOR.alto),
      medio: contrastOnWhite(LEVEL_COLOR.medio),
      bajo: contrastOnWhite(LEVEL_COLOR.bajo),
    };
    assert.equal(ratios.alto.toFixed(2), "9.30");
    assert.equal(ratios.medio.toFixed(2), "5.07");
    assert.equal(ratios.bajo.toFixed(2), "8.12");
  });

  it("fits one cluster and three separate pins in a 390px frame", () => {
    const zoom = 10.8;
    const groups = clusterPlaces(PLACES, zoom);
    const groupOf = (id: string) => groups.find((group) => group.some((place) => place.id === id));
    const cluster = groupOf("jayaque-la-libertad");
    assert.deepEqual(
      cluster?.map((place) => place.id).sort(),
      ["jayaque-la-libertad", "talnique-la-libertad"],
    );
    const pins = ["comasagua-la-libertad", "santa-tecla-la-libertad", "tepecoyo-la-libertad"].map((id) => {
      const group = groupOf(id);
      assert.equal(group?.length, 1, id);
      return group![0];
    });
    const pointOf = (group: readonly { latitude: number; longitude: number }[]) => {
      const latitude = group.reduce((sum, place) => sum + place.latitude, 0) / group.length;
      const longitude = group.reduce((sum, place) => sum + place.longitude, 0) / group.length;
      return project(latitude, longitude, zoom);
    };
    const points = [pointOf(cluster!), ...pins.map((place) => project(place.latitude, place.longitude, zoom))];
    const width = Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
    const height = Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
    assert.ok(width <= 366 - TAP_PX, String(width));
    assert.ok(height <= 320 - TAP_PX, String(height));
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const distance = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
        assert.ok(distance >= TAP_PX, String(distance));
      }
    }
  });
});
