"use client";

import { useState } from "react";
import {
  FORECAST_MISSING_COPY,
  FORECAST_UNAVAILABLE_TITLE,
  RETRY_LABEL,
  RISK_ZONE_NOTE,
  SIN_DATOS_CARD,
  SIN_DATOS_MARK,
  SIN_DATOS_WORD,
  riskStripSubtitle,
} from "@/lib/vision/copy";
import { dayCardReason, formatChipDate, formatSprayWindow, formatWeekday, levelMark, levelWord } from "@/lib/format";
import type { WeekAssessment } from "@/lib/risk/types";

export type RiskView = WeekAssessment & {
  place: { id: string; name: string };
};

const TONE = {
  alto: "bg-[#FDE2E1] text-[#8A1C14]",
  medio: "bg-[#FFF1C2] text-[#6B4B00]",
  bajo: "bg-[#DDF2E0] text-[#1E5B2A]",
} as const;

const chipSize = "h-[128px] min-h-12 min-w-12";

export function RiskPanel({
  risk,
  loading,
  failed,
  showPlan,
  onRetry,
}: {
  risk: RiskView | null;
  loading: boolean;
  failed: boolean;
  showPlan: boolean;
  onRetry?: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const days = risk?.days ?? [];
  const day = days[selected] ?? days[0];

  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Riesgo de roya esta semana</h2>
        {failed && !risk ? null : (
          <p className="mt-1">
            {risk ? riskStripSubtitle(risk.place.name) : "Toque un día"}
          </p>
        )}
      </div>
      {loading && !risk ? (
        <div aria-busy="true">
          <p>Cargando</p>
          <div className="mt-2 grid grid-cols-7 gap-0.5">
            {Array.from({ length: 7 }, (_, index) => (
              <div
                key={index}
                className={`${chipSize} rounded-xl bg-[#E7E5E4]`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      ) : null}
      {failed && !risk ? (
        <div className="flex flex-col gap-4">
          <h3 className="text-2xl font-semibold">{FORECAST_UNAVAILABLE_TITLE}</h3>
          <p>{FORECAST_MISSING_COPY}</p>
          {onRetry ? (
            <button
              type="button"
              className="min-h-14 w-full rounded-2xl bg-[#1E5B2A] px-4 text-lg font-semibold text-white"
              onClick={onRetry}
            >
              {RETRY_LABEL}
            </button>
          ) : null}
        </div>
      ) : null}
      {risk && day ? (
        <>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((item, index) => {
              const weekday = formatWeekday(item.date);
              const dayNumber = formatChipDate(item.date).split(" ")[1];
              if (item.level === null) {
                return (
                  <button
                    key={item.date}
                    type="button"
                    aria-label={`${weekday} ${dayNumber}, sin datos`}
                    aria-pressed={index === selected}
                    className={`flex ${chipSize} flex-col items-center justify-center gap-1 rounded-xl bg-[#E7E5E4] px-0.5 text-center font-bold text-[#1c1917] ${index === selected ? "ring-2 ring-[#1E5B2A]" : ""}`}
                    onClick={() => setSelected(index)}
                  >
                    <ChipDate date={item.date} />
                    <span className="text-2xl leading-none" aria-hidden="true">
                      {SIN_DATOS_MARK}
                    </span>
                    <span className="text-[12px] leading-tight">{SIN_DATOS_WORD}</span>
                  </button>
                );
              }
              const word = levelWord(item.level);
              return (
                <button
                  key={item.date}
                  type="button"
                  aria-label={`${weekday} ${dayNumber}, riesgo ${word.toLocaleLowerCase("es-SV")}`}
                  aria-pressed={index === selected}
                  className={`flex ${chipSize} flex-col items-center justify-center gap-1 rounded-xl px-0.5 font-bold ${TONE[item.level]} ${index === selected ? "ring-2 ring-[#1E5B2A]" : ""}`}
                  onClick={() => setSelected(index)}
                >
                  <ChipDate date={item.date} />
                  <span className="text-2xl leading-none" aria-hidden="true">
                    {levelMark(item.level)}
                  </span>
                  <span className="text-[12px] leading-none">{word}</span>
                </button>
              );
            })}
          </div>
          <p>{RISK_ZONE_NOTE}</p>
          <article className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-2xl font-semibold">
              {day.level === null
                ? formatWeekday(day.date)
                : `${formatWeekday(day.date)}: ${levelWord(day.level)}`}
            </h3>
            <p className="mt-2">{day.level === null ? SIN_DATOS_CARD : dayCardReason(day)}</p>
          </article>
          <a
            className="flex min-h-12 items-center font-semibold text-[#1E5B2A] underline"
            href="https://doi.org/10.1007/s12571-015-0446-9"
            target="_blank"
            rel="noreferrer"
          >
            Fuente: Avelino y otros, 2015 ↗
          </a>
          <p>Pronóstico: Open-Meteo.</p>
          {showPlan ? (
            <div className="flex flex-col gap-3">
              <article className="rounded-2xl bg-white p-4">
                <h3 className="text-2xl font-semibold">Qué</h3>
                <p className="mt-1">
                  Clase de fungicida: {risk.plan.fungicideClasses.join(", ")}.
                </p>
              </article>
              <article className="rounded-2xl bg-white p-4">
                <h3 className="text-2xl font-semibold">Cuánto</h3>
                <p className="mt-1">{risk.plan.doseNote}</p>
              </article>
              <article className="rounded-2xl bg-[#DDF2E0] p-4 text-[#1E5B2A]">
                <h3 className="text-2xl font-semibold">Cuándo</h3>
                <p className="mt-1 font-semibold">Próximo día seco para fumigar</p>
                <p className="mt-1">☀ {formatSprayWindow(risk.plan.nextDryWindow)}</p>
              </article>
              <p>Use guantes y mascarilla. Lea la etiqueta.</p>
            </div>
          ) : null}
          <p>{risk.footer}</p>
        </>
      ) : null}
    </section>
  );
}

function ChipDate({ date }: { date: string }) {
  return <span className="w-full text-center text-[18px] leading-none">{formatChipDate(date)}</span>;
}
