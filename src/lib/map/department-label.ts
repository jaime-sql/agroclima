import type { DepartmentShape } from "./department-geometry.ts";

/** Phone labels stay readable and inside the shape. Desktop uses the full name. */
export const NARROW_FONT_PX = 12;
export const WIDE_FONT_PX = 13;

/**
 * Used only when the risk word does not fit in the shape.
 * «La Lib.» is the short form of La Libertad.
 */
export const DEPARTMENT_SHORT_NAME: Record<string, string> = {
  "La Libertad": "La Lib.",
  "San Salvador": "S. Salv.",
  "San Vicente": "S. Vic.",
  "Chalatenango": "Chalate.",
  Ahuachapán: "Ahuach.",
  Cuscatlán: "Cuscat.",
  Sonsonate: "Sonson.",
  Usulután: "Usul.",
  "Santa Ana": "Sta. Ana",
  "San Miguel": "S. Mig.",
  "La Unión": "La Un.",
  Morazán: "Morazán",
  "La Paz": "La Paz",
  Cabañas: "Cabañas",
};

export function shortDepartmentName(name: string): string {
  return DEPARTMENT_SHORT_NAME[name] ?? name;
}

/** Width of a bold sans label, in CSS pixels. Conservative so neighbours keep a gap. */
export function estimateLabelWidth(text: string, fontPx: number): number {
  let width = 0;
  for (const char of text) {
    if (char === " ") width += fontPx * 0.34;
    else if (char === "." || char === "/" || char === "·") width += fontPx * 0.36;
    else if (char === char.toLowerCase() && char !== char.toUpperCase()) width += fontPx * 0.6;
    else width += fontPx * 0.72;
  }
  return Math.ceil(width);
}

export type PlacedLabel = {
  name: string;
  text: string;
  /** Percent of the map width, for the label centre. */
  left: number;
  /** Percent of the map height, for the label centre. */
  top: number;
  fontPx: number;
  maxWidth: number;
};

type Box = { x: number; y: number; w: number; h: number };
type Draft = { name: string; text: string; x: number; y: number; w: number; h: number; fontPx: number; box: Box };

function fits(text: string, fontPx: number, boxWidth: number): boolean {
  return estimateLabelWidth(text, fontPx) <= boxWidth - 4;
}

/** Risk word when it fits. Otherwise a short name, and only then a still shorter mark. */
export function narrowDepartmentText(name: string, level: string, boxWidth: number): string {
  const word = level.trim();
  if (!word) return "";
  if (fits(word, NARROW_FONT_PX, boxWidth)) return word;
  const short = shortDepartmentName(name);
  if (short !== word && fits(short, NARROW_FONT_PX, boxWidth)) return short;
  if (word === "Sin datos") return "S/d";
  return word;
}

function labelSize(text: string, fontPx: number, boxWidth: number): { w: number; h: number } {
  const natural = estimateLabelWidth(text, fontPx);
  const width = Math.min(Math.max(natural, fontPx), Math.max(boxWidth - 2, fontPx));
  const lines = Math.max(1, Math.ceil(natural / Math.max(width, 1)));
  return { w: width, h: lines * fontPx * 1.2 };
}

function overlaps(left: Draft, right: Draft): boolean {
  return (
    left.x < right.x + right.w &&
    left.x + left.w > right.x &&
    left.y < right.y + right.h &&
    left.y + left.h > right.y
  );
}

function clamp(draft: Draft): void {
  const { box } = draft;
  if (draft.w >= box.w) {
    draft.x = box.x;
    draft.w = box.w;
  } else {
    draft.x = Math.min(Math.max(draft.x, box.x), box.x + box.w - draft.w);
  }
  if (draft.h >= box.h) {
    draft.y = box.y;
    draft.h = box.h;
  } else {
    draft.y = Math.min(Math.max(draft.y, box.y), box.y + box.h - draft.h);
  }
}

function separate(drafts: Draft[]): void {
  for (let pass = 0; pass < 48; pass += 1) {
    let moved = false;
    for (let i = 0; i < drafts.length; i += 1) {
      for (let j = i + 1; j < drafts.length; j += 1) {
        const left = drafts[i];
        const right = drafts[j];
        if (!left || !right || !overlaps(left, right)) continue;
        const overlapX = Math.min(left.x + left.w, right.x + right.w) - Math.max(left.x, right.x);
        const overlapY = Math.min(left.y + left.h, right.y + right.h) - Math.max(left.y, right.y);
        if (overlapX < overlapY) {
          const push = overlapX / 2 + 0.5;
          const leftward = left.x + left.w / 2 <= right.x + right.w / 2;
          left.x += leftward ? -push : push;
          right.x += leftward ? push : -push;
        } else {
          const push = overlapY / 2 + 0.5;
          const upward = left.y + left.h / 2 <= right.y + right.h / 2;
          left.y += upward ? -push : push;
          right.y += upward ? push : -push;
        }
        clamp(left);
        clamp(right);
        moved = true;
      }
    }
    if (!moved) return;
  }
}

function stillOverlaps(drafts: Draft[]): boolean {
  for (let i = 0; i < drafts.length; i += 1) {
    for (let j = i + 1; j < drafts.length; j += 1) {
      const left = drafts[i];
      const right = drafts[j];
      if (left && right && overlaps(left, right)) return true;
    }
  }
  return false;
}

function shorter(name: string, level: string, current: string): string | null {
  const short = shortDepartmentName(name);
  if (current !== short && short.length < current.length) return short;
  if (level === "Sin datos" && current !== "S/d") return "S/d";
  if (current !== level && level.length < current.length && level.length <= 5) return level;
  return null;
}

/**
 * Labels inside the department shapes.
 * Narrow maps show the risk level, with a short name only when that word does not fit.
 * Wide maps show the full department name. Nothing is drawn on a leader line.
 */
export function placeDepartmentLabels(input: {
  shapes: readonly DepartmentShape[];
  mapWidth: number;
  mapHeight: number;
  displayWidth: number;
  wide: boolean;
  levelFor: (name: string) => string;
}): PlacedLabel[] {
  const scale = input.displayWidth / input.mapWidth;
  const drafts: Draft[] = input.shapes.flatMap((shape) => {
    const level = input.levelFor(shape.name);
    const boxWidth = shape.boxWidth * scale;
    const boxHeight = shape.boxHeight * scale;
    const text = input.wide ? shape.name : narrowDepartmentText(shape.name, level, boxWidth);
    if (!text) return [];
    const fontPx = input.wide ? WIDE_FONT_PX : NARROW_FONT_PX;
    const size = labelSize(text, fontPx, boxWidth);
    const box = {
      x: shape.boxX * scale,
      y: shape.boxY * scale,
      w: boxWidth,
      h: boxHeight,
    };
    const draft: Draft = {
      name: shape.name,
      text,
      x: shape.labelX * scale - size.w / 2,
      y: shape.labelY * scale - size.h / 2,
      w: size.w,
      h: size.h,
      fontPx,
      box,
    };
    clamp(draft);
    return [draft];
  });

  separate(drafts);
  if (!input.wide) {
    for (let attempt = 0; attempt < 8 && stillOverlaps(drafts); attempt += 1) {
      let changed = false;
      for (const draft of drafts) {
        const level = input.levelFor(draft.name);
        const next = shorter(draft.name, level, draft.text);
        if (!next || next === draft.text) continue;
        const size = labelSize(next, draft.fontPx, draft.box.w);
        draft.text = next;
        draft.w = size.w;
        draft.h = size.h;
        draft.x = draft.box.x + (draft.box.w - size.w) / 2;
        draft.y = draft.box.y + (draft.box.h - size.h) / 2;
        clamp(draft);
        changed = true;
      }
      if (!changed) break;
      separate(drafts);
    }
  }

  return drafts.map((draft) => ({
    name: draft.name,
    text: draft.text,
    left: ((draft.x + draft.w / 2) / input.displayWidth) * 100,
    top: ((draft.y + draft.h / 2) / (input.mapHeight * scale)) * 100,
    fontPx: draft.fontPx,
    maxWidth: (draft.box.w / input.displayWidth) * 100,
  }));
}

export function labelRectsCollide(
  shapes: readonly DepartmentShape[],
  placed: readonly PlacedLabel[],
  mapWidth: number,
  mapHeight: number,
  displayWidth: number,
): boolean {
  const scale = displayWidth / mapWidth;
  const displayHeight = mapHeight * scale;
  const rects = placed.flatMap((label) => {
    const shape = shapes.find((item) => item.name === label.name);
    if (!shape || !label.text) return [];
    const boxWidth = shape.boxWidth * scale;
    const size = labelSize(label.text, label.fontPx, boxWidth);
    const cx = (label.left / 100) * displayWidth;
    const cy = (label.top / 100) * displayHeight;
    return [{ x: cx - size.w / 2, y: cy - size.h / 2, w: size.w, h: size.h, name: label.name }];
  });
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const left = rects[i];
      const right = rects[j];
      if (!left || !right) continue;
      const gap = 1;
      if (
        left.x + gap < right.x + right.w &&
        left.x + left.w > right.x + gap &&
        left.y + gap < right.y + right.h &&
        left.y + left.h > right.y + gap
      ) {
        return true;
      }
    }
  }
  return false;
}
