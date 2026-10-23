import { formatSprayWindow } from "./format.ts";
import type { ActionPlan } from "./risk/types.ts";

/** The written plan, read aloud. Same sentences the plan cards show. */
export function actionPlanSpeech(plan: ActionPlan): string {
  return [
    `Qué. Clase de fungicida: ${plan.fungicideClasses.join(", ")}.`,
    `Cuánto. ${plan.doseNote}.`,
    `Cuándo. Próximo día seco para fumigar. ${formatSprayWindow(plan.nextDryWindow)}.`,
    "Use guantes y mascarilla. Lea la etiqueta.",
  ].join(" ");
}
