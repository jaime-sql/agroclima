import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OMITTED_LEAF,
  OMITTED_PLAN_LEAF,
  OMITTED_PLAN_NO_PHOTO,
  SECOND_OPINION,
  buildAgentSteps,
  planStepLine,
} from "./agent-steps.ts";

const idle = {
  climateLine: null as string | null,
  photo: false,
  diagnosing: false,
  diagnosisHeadline: null as string | null,
  diagnoseErrorLine: null as string | null,
  planAllowed: false,
  planLine: null as string | null,
};

describe("agent steps", () => {
  it("keeps the leaf step as a second opinion", () => {
    const steps = buildAgentSteps(idle);
    assert.equal(steps[1]?.note, SECOND_OPINION);
    assert.equal(SECOND_OPINION, "Segunda opinión");
    assert.equal(steps[1]?.stateLabel, "Omitido");
    assert.equal(steps[1]?.result, OMITTED_LEAF);
    assert.equal(steps[2]?.result, OMITTED_PLAN_NO_PHOTO);
    assert.equal(steps[0]?.stateLabel, "En curso");
    assert.equal(steps[0]?.result, null);
  });

  it("marks climate and the leaf when each result exists, and skips a plan the leaf does not allow", () => {
    const ready = buildAgentSteps({
      ...idle,
      climateLine: "Ahuachapán: alto · 3 puntos",
      photo: true,
      diagnosisHeadline: "Parece roya",
      planAllowed: true,
      planLine: "Clase de fungicida: triazol. Sin ventana",
    });
    assert.equal(ready[0]?.stateLabel, "Listo");
    assert.equal(ready[0]?.result, "Ahuachapán: alto · 3 puntos");
    assert.equal(ready[1]?.result, "Parece roya");
    assert.equal(ready[1]?.note, SECOND_OPINION);
    assert.equal(ready[2]?.stateLabel, "Listo");

    const blocked = buildAgentSteps({
      ...idle,
      photo: true,
      diagnosisHeadline: "No estamos seguros",
      planAllowed: false,
    });
    assert.equal(blocked[2]?.stateLabel, "Omitido");
    assert.equal(blocked[2]?.result, OMITTED_PLAN_LEAF);
    assert.equal(planStepLine({ fungicideClasses: ["triazol"], doseNote: "etiqueta", nextDryWindow: null }).includes("triazol"), true);
  });
});
