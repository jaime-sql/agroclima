import { departmentDisplayName } from "../risk/department-level.ts";

/** CSS pixels of the map column at a 390px viewport with the page's px-3 padding. */
export const MAP_TARGET_PX = 366;

export type DepartmentGeoJson = {
  features: Array<{
    properties?: { shapeName?: string };
    geometry?: { type?: string; coordinates?: unknown };
  }>;
};

export type DepartmentShape = {
  name: string;
  d: string;
  labelX: number;
  labelY: number;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
};

export type ProjectedDepartments = {
  width: number;
  height: number;
  shapes: DepartmentShape[];
};

type Ring = number[][];

function asPolygons(geometry: { type?: string; coordinates?: unknown }): Ring[][] {
  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
    return [geometry.coordinates as Ring[]];
  }
  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates as Ring[][];
  }
  return [];
}

function ringArea(ring: Ring): number {
  let sum = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x0, y0] = ring[index];
    const [x1, y1] = ring[index + 1];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

function ringCentroid(ring: Ring): [number, number] {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x0, y0] = ring[index];
    const [x1, y1] = ring[index + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-8) {
    const count = Math.max(1, ring.length - 1);
    let sx = 0;
    let sy = 0;
    for (let index = 0; index < count; index += 1) {
      sx += ring[index][0];
      sy += ring[index][1];
    }
    return [sx / count, sy / count];
  }
  return [cx / (6 * area), cy / (6 * area)];
}

function ringPath(ring: Ring): string {
  return (
    ring
      .map((point, index) => {
        const command = index === 0 ? "M" : "L";
        return `${command}${point[0].toFixed(1)} ${point[1].toFixed(1)}`;
      })
      .join("") + "Z"
  );
}

/** Project pinned department polygons into a 390px-wide map. One unit is about one pixel. */
export function projectDepartments(geojson: DepartmentGeoJson): ProjectedDepartments {
  const features = geojson.features.flatMap((feature) => {
    const shapeName = feature.properties?.shapeName;
    const geometry = feature.geometry;
    if (!shapeName || !geometry) return [];
    const polygons = asPolygons(geometry);
    if (polygons.length === 0) return [];
    return [{ name: departmentDisplayName(shapeName), polygons }];
  });

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const feature of features) {
    for (const polygon of feature.polygons) {
      for (const ring of polygon) {
        for (const point of ring) {
          minLon = Math.min(minLon, point[0]);
          maxLon = Math.max(maxLon, point[0]);
          minLat = Math.min(minLat, point[1]);
          maxLat = Math.max(maxLat, point[1]);
        }
      }
    }
  }

  const pad = 8;
  const innerW = MAP_TARGET_PX;
  const lonSpan = Math.max(maxLon - minLon, 1e-6);
  const latSpan = Math.max(maxLat - minLat, 1e-6);
  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const innerH = (innerW * latSpan) / (lonSpan * Math.cos(midLat));
  const width = innerW + pad * 2;
  const height = innerH + pad * 2;
  const project = (lon: number, lat: number): [number, number] => [
    pad + ((lon - minLon) / lonSpan) * innerW,
    pad + ((maxLat - lat) / latSpan) * innerH,
  ];

  const shapes = features.map((feature) => {
    let bestRing: Ring | null = null;
    let bestArea = -1;
    const projectedPolygons: Ring[][] = [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const polygon of feature.polygons) {
      const projected = polygon.map((ring) => ring.map((point) => project(point[0], point[1])));
      projectedPolygons.push(projected);
      const outer = projected[0];
      if (!outer) continue;
      for (const point of outer) {
        minX = Math.min(minX, point[0]);
        maxX = Math.max(maxX, point[0]);
        minY = Math.min(minY, point[1]);
        maxY = Math.max(maxY, point[1]);
      }
      const area = Math.abs(ringArea(outer));
      if (area > bestArea) {
        bestArea = area;
        bestRing = outer;
      }
    }
    const [labelX, labelY] = bestRing ? ringCentroid(bestRing) : [minX, minY];
    const d = projectedPolygons
      .map((polygon) => polygon.map((ring) => ringPath(ring)).join(""))
      .join("");
    return {
      name: feature.name,
      d,
      labelX,
      labelY,
      boxX: minX,
      boxY: minY,
      boxWidth: maxX - minX,
      boxHeight: maxY - minY,
    };
  });

  return { width, height, shapes };
}
