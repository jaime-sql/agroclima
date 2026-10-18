import { MUNICIPALITY_CENTRE_NOTE } from "../risk/gps.ts";

/** Visible copy from the mobile flow. Buttons and sentences stay in Spanish. */

export const DIAGNOSE_ERROR_COPY = "Algo salió mal. Intente otra vez.";

/** Shown only when the diagnosis API returns error "unavailable". */
export const DIAGNOSE_UNAVAILABLE_COPY = "El servicio no está disponible ahora.";

export const RETRY_LABEL = "Intentar de nuevo";

export const OFFLINE_COPY =
  'Sin señal. Su foto está guardada en este teléfono. Toque "Intentar de nuevo" cuando tenga señal.';

export function diagnosisStatusCopy(kind: "unavailable" | "offline" | "failed"): string {
  if (kind === "unavailable") return DIAGNOSE_UNAVAILABLE_COPY;
  if (kind === "offline") return OFFLINE_COPY;
  return DIAGNOSE_ERROR_COPY;
}

export const FORECAST_UNAVAILABLE_TITLE = "Pronóstico no disponible";

export const FORECAST_MISSING_COPY =
  "No pudimos obtener el pronóstico. Revise su señal e intente de nuevo.";

export const SIN_DATOS_WORD = "Sin datos";

export const SIN_DATOS_MARK = "–";

export const SIN_DATOS_CARD = "No hay pronóstico completo para este día.";

export function coffeeZoneLabel(placeName: string): string {
  return `Zona cafetalera de ${placeName}`;
}

/** Name on the GPS card for the nearest listed place. Pending Designer confirmation. */
export function gpsForecastLabel(placeName: string): string {
  return `Pronóstico de ${placeName}`;
}

export type RiskCoordType = "town_centre" | "slope_point";

/** Subtitle for the coordinate the forecast actually used. */
export function riskStripSubtitle(placeName: string, coordType?: RiskCoordType | null): string {
  if (coordType === "town_centre") return placeName;
  return `${coffeeZoneLabel(placeName)} · toque un día`;
}

/** The fungicide plan stays hidden when the leaf was not reviewed. */
export function showsActionPlan(
  diagnoseError: "unavailable" | "offline" | "failed" | null,
  planAllowed: boolean,
): boolean {
  if (diagnoseError) return false;
  return planAllowed;
}

export const RISK_ZONE_NOTE =
  "Clima de una zona cafetalera cercana, no de su finca";

/** The one source line on a place card. GPS keeps the zone note plus its own line. */
export function riskSourceNote(coordType?: RiskCoordType | null): string {
  return coordType === "town_centre" ? MUNICIPALITY_CENTRE_NOTE : RISK_ZONE_NOTE;
}

export const GEO_DENIED_COPY =
  "No pudimos usar su ubicación. Elija su municipio.";

export const ORIENTATION_ROYA =
  "Esto es una orientación, no un diagnóstico. Confirme con un agrónomo.";

export const ORIENTATION_SANA =
  "Esto es una orientación, no un diagnóstico.";

export const SANA_DETAIL =
  "No vemos señales de roya en esta hoja. Revise otras plantas cada semana.";

export const OTRO_DETAIL =
  "No parece roya, pero la hoja tiene algo. Esta app solo revisa roya.";

export const UNSURE_DETAIL =
  "No le damos un plan para no aconsejarle mal. Envíe el resultado a su agrónomo o cooperativa.";

export const CONTACTS_PENDING =
  "Contactos ISC / CENTA: pendiente de verificar";

export const CONFIRM_AGRONOMIST = "Confirme con un agrónomo";

export const RETAKE_COPY = {
  borrosa: {
    reason: "La foto está borrosa.",
    advice:
      "Sostenga el teléfono quieto con las dos manos. Toque la hoja en la pantalla para enfocar.",
  },
  no_hoja: {
    reason: "No vemos una hoja de café.",
    advice: "Ponga una sola hoja de café en el centro, sobre su mano o un papel.",
  },
  lejos: {
    reason: "La hoja está muy lejos.",
    advice: "Acérquese a un palmo de la hoja. Que la hoja llene la pantalla.",
  },
  otra: {
    reason: "No pudimos revisar esta foto.",
    advice:
      "Tome la foto de día, con buena luz y sin sol directo. Una sola hoja, de cerca.",
  },
} as const;

export type RetakeReason = keyof typeof RETAKE_COPY;
