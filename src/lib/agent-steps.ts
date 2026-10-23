import type { ActionPlan } from "./risk/types.ts";
import { formatSprayWindow } from "./format.ts";

export type AgentId = "clima" | "diagnostico" | "plan";
export type AgentStatus = "en_curso" | "listo" | "omitido";

export type AgentStep = {
  id: AgentId;
  title: string;
  state: AgentStatus;
  stateLabel: "En curso" | "Listo" | "Omitido";
  /** Leaf step only. The photo is a second opinion; the weather engine leads. */
  note: string | null;
  result: string | null;
};

const STATE_LABEL: Record<AgentStatus, AgentStep["stateLabel"]> = {
  en_curso: "En curso",
  listo: "Listo",
  omitido: "Omitido",
};

export const OMITTED_LEAF = "Sin foto de la hoja.";
export const OMITTED_PLAN_NO_PHOTO = "Sin foto, no hay plan.";
export const OMITTED_PLAN_LEAF = "No hay plan para esta hoja.";
export const SECOND_OPINION = "Segunda opinión";

function step(
  id: AgentId,
  title: string,
  state: AgentStatus,
  result: string | null,
  note: string | null = null,
): AgentStep {
  return { id, title, state, stateLabel: STATE_LABEL[state], note, result };
}

export function buildAgentSteps(input: {
  climateLine: string | null;
  photo: boolean;
  diagnosing: boolean;
  diagnosisHeadline: string | null;
  diagnoseErrorLine: string | null;
  planAllowed: boolean;
  planLine: string | null;
}): AgentStep[] {
  const climate = input.climateLine
    ? step("clima", "1 Clima", "listo", input.climateLine)
    : step("clima", "1 Clima", "en_curso", null);

  let leaf: AgentStep;
  if (input.diagnosing) {
    leaf = step("diagnostico", "2 Diagnóstico de hoja", "en_curso", null, SECOND_OPINION);
  } else if (input.diagnoseErrorLine) {
    leaf = step("diagnostico", "2 Diagnóstico de hoja", "listo", input.diagnoseErrorLine, SECOND_OPINION);
  } else if (input.diagnosisHeadline) {
    leaf = step("diagnostico", "2 Diagnóstico de hoja", "listo", input.diagnosisHeadline, SECOND_OPINION);
  } else if (!input.photo) {
    leaf = step("diagnostico", "2 Diagnóstico de hoja", "omitido", OMITTED_LEAF, SECOND_OPINION);
  } else leaf = step("diagnostico", "2 Diagnóstico de hoja", "en_curso", null, SECOND_OPINION);

  let plan: AgentStep;
  if (!input.photo) plan = step("plan", "3 Plan de acción", "omitido", OMITTED_PLAN_NO_PHOTO);
  else if (input.diagnoseErrorLine || (input.diagnosisHeadline && !input.planAllowed)) {
    plan = step("plan", "3 Plan de acción", "omitido", OMITTED_PLAN_LEAF);
  } else if (input.planLine) plan = step("plan", "3 Plan de acción", "listo", input.planLine);
  else plan = step("plan", "3 Plan de acción", "en_curso", null);

  return [climate, leaf, plan];
}

/** One line for the stepper. The spoken plan is the full Qué / Cuánto / Cuándo text. */
export function planStepLine(plan: ActionPlan): string {
  return `Clase de fungicida: ${plan.fungicideClasses.join(", ")}. ${formatSprayWindow(plan.nextDryWindow)}`;
}
