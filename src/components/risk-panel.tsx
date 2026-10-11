"use client";

import { useState } from "react";
import { FORECAST_MISSING_COPY } from "@/lib/vision/copy";
import { formatSprayWindow, formatWeekday, levelMark, levelWord } from "@/lib/format";
import type { WeekAssessment } from "@/lib/risk/types";

export type RiskView = WeekAssessment & {
  place: { id: string; name: string };
};

const TONE = {
  alto: "bg-[#FDE2E1] text-[#8A1C14]",
  medio: "bg-[#FFF1C2] text-[#6B4B00]",
  bajo: "bg-[#DDF2E0] text-[#1E5B2A]",
} as const;

export function RiskPanel({
  risk,
  loading,
  failed,
  showPlan,
}: {
  risk: RiskView | null;
  loading: boolean;
  failed: boolean;
  showPlan: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const days = risk?.days ?? [];
  const day = days[selected] ?? days[0];

  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Riesgo de roya esta semana</h2>
        <p className="mt-1 text-lg">
          {risk ? `${risk.place.name} · toque un día` : "Toque un día"}
        </p>
      </div>
      {loading && !risk ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, index) => (
            <div
              key={index}
              className="flex h-[110px] items-center justify-center rounded-xl bg-[#E7E5E4] px-1 text-center text-[13px] font-bold text-[#57534E]"
            >
              Cargando
            </div>
          ))}
        </div>
      ) : null}
      {failed && !risk ? <p className="text-lg">{FORECAST_MISSING_COPY}</p> : null}
      {risk && day ? (
        <>
          <div className="grid grid-cols-7 gap-1">
            {days.map((item, index) => {
              const word = levelWord(item.level);
              return (
                <button
                  key={item.date}
                  type="button"
                  aria-label={`${formatWeekday(item.date)}, riesgo ${word.toLocaleLowerCase("es-SV")}`}
                  aria-pressed={index === selected}
                  className={`flex h-[110px] flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[13px] font-bold ${TONE[item.level]} ${index === selected ? "ring-2 ring-[#1E5B2A]" : ""}`}
                  onClick={() => setSelected(index)}
                >
                  <span aria-hidden="true">{levelMark(item.level)}</span>
                  <span>{word}</span>
                </button>
              );
            })}
          </div>
          <article className="rounded-2xl bg-white p-4 text-lg shadow-sm">
            <h3 className="text-xl font-semibold">
              {formatWeekday(day.date)}: {levelWord(day.level)}
            </h3>
            <p className="mt-2">{day.reason}</p>
          </article>
          <p className="text-lg">
            <a
              className="font-semibold text-[#1E5B2A] underline"
              href="https://doi.org/10.1007/s12571-015-0446-9"
              target="_blank"
              rel="noreferrer"
            >
              Fuente: Avelino et al. 2015 ↗
            </a>
          </p>
          <p className="text-lg">Pronóstico: Open-Meteo.</p>
          {showPlan ? (
            <div className="flex flex-col gap-3">
              <article className="rounded-2xl bg-white p-4">
                <h3 className="text-lg font-semibold">Qué</h3>
                <p className="mt-1 text-lg">
                  Clase de fungicida: {risk.plan.fungicideClasses.join(", ")}.
                </p>
              </article>
              <article className="rounded-2xl bg-white p-4">
                <h3 className="text-lg font-semibold">Cuánto</h3>
                <p className="mt-1 text-lg">{risk.plan.doseNote}</p>
              </article>
              <article className="rounded-2xl bg-[#DDF2E0] p-4 text-[#1E5B2A]">
                <h3 className="text-lg font-semibold">Cuándo</h3>
                <p className="mt-1 text-lg font-semibold">Próximo día seco para fumigar</p>
                <p className="mt-1 text-lg">☀ {formatSprayWindow(risk.plan.nextDryWindow)}</p>
              </article>
              <p className="text-lg">Use guantes y mascarilla. Lea la etiqueta.</p>
            </div>
          ) : (
            <p className="text-lg">Sin plan contra la roya para este resultado.</p>
          )}
          <p className="text-lg">{risk.footer}</p>
        </>
      ) : null}
    </section>
  );
}
