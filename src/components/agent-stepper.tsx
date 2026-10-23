import type { AgentStep } from "@/lib/agent-steps";

export function AgentStepper({ steps }: { steps: AgentStep[] }) {
  return (
    <ol aria-label="Pasos" className="flex flex-col gap-3 border-l-4 border-[#1E5B2A] pl-4">
      {steps.map((step) => (
        <li key={step.id} className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-lg font-semibold">{step.title}</p>
          {step.note ? <p>{step.note}</p> : null}
          <p>{step.stateLabel}</p>
          {step.result ? <p>{step.result}</p> : null}
        </li>
      ))}
    </ol>
  );
}
