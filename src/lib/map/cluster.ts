import type { RiskLevel } from "../risk/types.ts";

/** Invisible tap target. Clusters break apart before two of these touch. */
export const TAP_PX = 44;

/** Coloured circle drawn inside the tap target. */
export const PIN_VISIBLE_PX = 32;

export const LEVEL_RANK: Record<RiskLevel, number> = { bajo: 1, medio: 2, alto: 3 };

export const LEVEL_LETTER: Record<RiskLevel, string> = { alto: "A", medio: "M", bajo: "B" };

export const LEVEL_COLOR: Record<RiskLevel, string> = {
  alto: "#8A1C14",
  medio: "#8A6A00",
  bajo: "#1E5B2A",
};

export const EMPTY_PIN_COLOR = "#57534e";

export type MapPoint = {
  id: string;
  latitude: number;
  longitude: number;
};

/** Highest level in the list. Alto beats medio, medio beats bajo. */
export function worstLevel(levels: readonly (RiskLevel | null | undefined)[]): RiskLevel | null {
  let best: RiskLevel | null = null;
  for (const level of levels) {
    if (!level) continue;
    if (!best || LEVEL_RANK[level] > LEVEL_RANK[best]) best = level;
  }
  return best;
}

export function project(latitude: number, longitude: number, zoom: number): { x: number; y: number } {
  const sin = Math.sin((latitude * Math.PI) / 180);
  const scale = 256 * 2 ** zoom;
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/**
 * Single-linkage groups. Two places share a group when their centres are
 * under `radiusPx`, so the 44px tap areas are not both shown while they overlap.
 */
export function clusterPlaces<T extends MapPoint>(
  places: readonly T[],
  zoom: number,
  radiusPx = TAP_PX,
): T[][] {
  const parent = new Map(places.map((place) => [place.id, place.id]));
  const find = (id: string): string => {
    let current = id;
    while (parent.get(current) !== current) current = parent.get(current) as string;
    return current;
  };
  const union = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };
  const points = new Map(places.map((place) => [place.id, project(place.latitude, place.longitude, zoom)]));
  for (let i = 0; i < places.length; i += 1) {
    for (let j = i + 1; j < places.length; j += 1) {
      const left = points.get(places[i].id);
      const right = points.get(places[j].id);
      if (!left || !right) continue;
      if (Math.hypot(left.x - right.x, left.y - right.y) < radiusPx) union(places[i].id, places[j].id);
    }
  }
  const groups = new Map<string, T[]>();
  for (const place of places) {
    const root = find(place.id);
    const group = groups.get(root);
    if (group) group.push(place);
    else groups.set(root, [place]);
  }
  return [...groups.values()];
}

export function metresBetween(left: MapPoint, right: MapPoint): number {
  const earth = 6371000;
  const lat1 = (left.latitude * Math.PI) / 180;
  const lat2 = (right.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((right.longitude - left.longitude) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function closestMetres(places: readonly MapPoint[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < places.length; i += 1) {
    for (let j = i + 1; j < places.length; j += 1) {
      best = Math.min(best, metresBetween(places[i], places[j]));
    }
  }
  return best;
}

/** Ground metres that one pixel covers at this latitude and zoom. */
export function metresPerPixel(latitude: number, zoom: number): number {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
}

export function pixelsForMetres(metres: number, latitude: number, zoom: number): number {
  return metres / metresPerPixel(latitude, zoom);
}

/** True when the closest pair would still overlap at the map's highest zoom. */
export function shouldSpiderfy(closestPxAtMaxZoom: number, tapPx = TAP_PX): boolean {
  return closestPxAtMaxZoom < tapPx;
}

/** Pixel offsets whose neighbouring centres are at least a tap target apart. */
export function spiderfyOffsets(count: number, gapPx = TAP_PX + 4): { x: number; y: number }[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0, y: 0 }];
  if (count === 2) return [{ x: -gapPx / 2, y: 0 }, { x: gapPx / 2, y: 0 }];
  const radius = gapPx / (2 * Math.sin(Math.PI / count));
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

export function clusterBubblePx(count: number): number {
  return Math.max(TAP_PX, 28 + String(count).length * 14);
}

function channel(hex: string, shift: number): number {
  return parseInt(hex.slice(1), 16) >> shift & 255;
}

function linear(value: number): number {
  const unit = value / 255;
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return (
    0.2126 * linear(channel(hex, 16)) +
    0.7152 * linear(channel(hex, 8)) +
    0.0722 * linear(channel(hex, 0))
  );
}

/** WCAG contrast of a pin colour against its white letter. */
export function contrastOnWhite(hex: string): number {
  return (1.05) / (luminance(hex) + 0.05);
}
