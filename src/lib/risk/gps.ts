import { TOWN_CENTRE_NOTE } from "../vision/copy.ts";
import { EL_SALVADOR_BUFFER_KM, insideElSalvador } from "./boundary.ts";
import { nearestPin, type PinPoint } from "./nearest.ts";

export const OUTSIDE_EL_SALVADOR_MESSAGE =
  "Esta herramienta solo cubre El Salvador. Elija un municipio en el mapa.";

export const INVALID_GPS_MESSAGE = "No pudimos leer esa ubicación.";

export const FAR_GPS_NOTE =
  "No hay un pin cercano en el mapa. Puede elegir un municipio para comparar.";

export const MUNICIPALITY_CENTRE_NOTE = TOWN_CENTRE_NOTE;

export const GRID_POINT_NOTE =
  "Pronóstico del punto más cercano de la cuadrícula del clima. Puede quedar a varios kilómetros.";

export function farGpsTitle(elevationM: number): string {
  return `Su ubicación (aproximada) · ${elevationM} m`;
}

export function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export type GpsQuery =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; error: "invalid_point" | "outside_el_salvador"; message: string };

/** GPS query only. Listed places never pass through this check. */
export function parseGpsQuery(latRaw: string | null, lonRaw: string | null): GpsQuery {
  if (latRaw === null || lonRaw === null || latRaw.trim() === "" || lonRaw.trim() === "") {
    return { ok: false, error: "invalid_point", message: INVALID_GPS_MESSAGE };
  }
  const latitude = Number(latRaw);
  const longitude = Number(lonRaw);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, error: "invalid_point", message: INVALID_GPS_MESSAGE };
  }
  if (!insideElSalvador(latitude, longitude, EL_SALVADOR_BUFFER_KM)) {
    return { ok: false, error: "outside_el_salvador", message: OUTSIDE_EL_SALVADOR_MESSAGE };
  }
  return {
    ok: true,
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
  };
}

export type GpsScreen =
  | {
      kind: "outside";
      message: typeof OUTSIDE_EL_SALVADOR_MESSAGE;
      showStrip: false;
      highlightId: null;
      showMunicipalityNote: false;
    }
  | {
      kind: "far";
      title: string;
      note: typeof FAR_GPS_NOTE;
      showStrip: true;
      highlightId: null;
      showMunicipalityNote: false;
    }
  | {
      kind: "near";
      showStrip: true;
      highlightId: string;
      showMunicipalityNote: false;
      gridNote: typeof GRID_POINT_NOTE;
    };

/**
 * What the GPS button shows. The far case is a normal forecast, not an error.
 * Elevation is the Open-Meteo forecast point, in whole metres.
 */
export function gpsScreen(input: {
  latitude: number;
  longitude: number;
  elevationM: number | null;
  places: readonly PinPoint[];
}): GpsScreen {
  if (!insideElSalvador(input.latitude, input.longitude, EL_SALVADOR_BUFFER_KM)) {
    return {
      kind: "outside",
      message: OUTSIDE_EL_SALVADOR_MESSAGE,
      showStrip: false,
      highlightId: null,
      showMunicipalityNote: false,
    };
  }
  const nearest = nearestPin(input.latitude, input.longitude, input.places);
  if (!nearest) {
    const elevation =
      input.elevationM === null || !Number.isFinite(input.elevationM)
        ? null
        : Math.round(input.elevationM);
    return {
      kind: "far",
      title:
        elevation === null
          ? "Su ubicación (aproximada) · sin dato"
          : farGpsTitle(elevation),
      note: FAR_GPS_NOTE,
      showStrip: true,
      highlightId: null,
      showMunicipalityNote: false,
    };
  }
  return {
    kind: "near",
    showStrip: true,
    highlightId: nearest.id,
    showMunicipalityNote: false,
    gridNote: GRID_POINT_NOTE,
  };
}

/** Town-centre sentence. Hidden for GPS and for slope points. The card renders it once. */
export function municipalityCentreNote(
  source: "pin" | "municipality" | "gps" | null,
  coordType: "town_centre" | "slope_point" | null,
): string | null {
  if (source !== "pin" && source !== "municipality") return null;
  if (coordType !== "town_centre") return null;
  return MUNICIPALITY_CENTRE_NOTE;
}
