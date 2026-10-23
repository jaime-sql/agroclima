"use client";

import { useMemo } from "react";
import { useState } from "react";
import departmentsGeo from "../../data/dept_map/departments.geojson";
import { projectDepartments } from "@/lib/map/department-geometry";
import { levelWord } from "@/lib/format";
import {
  FORECAST_MISSING_COPY,
  FORECAST_UNAVAILABLE_TITLE,
  RETRY_LABEL,
} from "@/lib/vision/copy";
import { departmentCatalog, type DepartmentMapOk, type DepartmentView } from "@/lib/risk/department-catalog";
import {
  ATTRIBUTION_COLOR,
  LEVEL_STYLE,
  MAP_ATTRIBUTION,
  NO_COFFEE_POINTS_COPY,
  SEE_MUNICIPALITIES,
  SIN_DATOS_FILL,
  SIN_DATOS_INK,
  VIEW_AS_LIST,
  VIEW_AS_MAP,
  mapSourceLine,
} from "@/lib/risk/department-level";
import { buildWhyModel } from "@/lib/result-why";
import { WhyPanel } from "./why-panel";

const SHAPES = projectDepartments(departmentsGeo);
const CATALOG = new Map(departmentCatalog().map((entry) => [entry.name, entry]));

const primary =
  "min-h-14 w-full rounded-2xl bg-[#1E5B2A] px-4 text-lg font-semibold text-white";

type Paint = {
  fill: string;
  text: string;
  hatch: boolean;
  mapLabel: string;
  listLevel: string;
};

function paintFor(
  status: "loading" | "ready" | "failed",
  hasPoints: boolean,
  live: DepartmentView | null,
): Paint {
  if (!hasPoints) {
    return {
      fill: SIN_DATOS_FILL,
      text: SIN_DATOS_INK,
      hatch: true,
      mapLabel: "Sin datos",
      listLevel: "Sin datos",
    };
  }
  if (status === "ready" && live?.level) {
    const style = LEVEL_STYLE[live.level];
    return { fill: style.fill, text: style.text, hatch: false, mapLabel: live.label, listLevel: live.label };
  }
  if (status === "ready") {
    return {
      fill: SIN_DATOS_FILL,
      text: SIN_DATOS_INK,
      hatch: true,
      mapLabel: "Sin datos",
      listLevel: "Sin datos",
    };
  }
  return { fill: "#F7F4EF", text: SIN_DATOS_INK, hatch: false, mapLabel: "", listLevel: "" };
}

export function DepartmentRiskMap({
  status,
  map,
  selected,
  onSelect,
  onRetry,
  onOpenMunicipalities,
}: {
  status: "loading" | "ready" | "failed";
  map: DepartmentMapOk | null;
  selected: string | null;
  onSelect: (name: string) => void;
  onRetry: () => void;
  onOpenMunicipalities: (name: string) => void;
}) {
  const [asList, setAsList] = useState(false);
  const liveByName = useMemo(
    () => new Map((map?.departments ?? []).map((item) => [item.name, item])),
    [map],
  );
  const selectedView = selected ? (liveByName.get(selected) ?? null) : null;
  const selectedEntry = selected ? (CATALOG.get(selected) ?? null) : null;

  return (
    <section id="mapa-departamentos" className="flex flex-col gap-3" aria-label="Mapa de departamentos">
      <button
        type="button"
        className="min-h-14 w-full rounded-2xl bg-white px-4 text-lg font-semibold text-[#1E5B2A] ring-2 ring-[#1E5B2A]"
        aria-pressed={asList}
        onClick={() => setAsList((current) => !current)}
      >
        {asList ? VIEW_AS_MAP : VIEW_AS_LIST}
      </button>
      {asList ? (
        <ul className="flex flex-col gap-2">
          {SHAPES.shapes.map((shape) => {
            const entry = CATALOG.get(shape.name);
            const live = liveByName.get(shape.name) ?? null;
            const paint = paintFor(status, entry?.hasPoints ?? false, live);
            const chip = paint.hatch
              ? "bg-[#E7E5E4] text-[#1C1917]"
              : live?.level
                ? LEVEL_STYLE[live.level].chip
                : "bg-white text-[#1C1917] ring-2 ring-[#E7E5E4]";
            return (
              <li key={shape.name}>
                <button
                  type="button"
                  className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-3 text-left text-base font-semibold ${chip}`}
                  style={
                    paint.hatch
                      ? {
                          backgroundImage:
                            "repeating-linear-gradient(135deg, #E7E5E4 0 4px, #D6D3D1 4px 6px)",
                        }
                      : undefined
                  }
                  aria-pressed={selected === shape.name}
                  onClick={() => onSelect(shape.name)}
                >
                  <span>{shape.name}</span>
                  {paint.listLevel ? <span>{paint.listLevel}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${SHAPES.width} ${SHAPES.height}`}
            className="block h-auto w-full"
            role="group"
            aria-label="Departamentos de El Salvador"
          >
            <defs>
              <pattern
                id="sin-datos-hatch"
                patternUnits="userSpaceOnUse"
                width="8"
                height="8"
                patternTransform="rotate(45)"
              >
                <rect width="8" height="8" fill={SIN_DATOS_FILL} />
                <line x1="0" y1="0" x2="0" y2="8" stroke="#D6D3D1" strokeWidth="3" />
              </pattern>
            </defs>
            {SHAPES.shapes.map((shape) => {
              const entry = CATALOG.get(shape.name);
              const live = liveByName.get(shape.name) ?? null;
              const paint = paintFor(status, entry?.hasPoints ?? false, live);
              const label = paint.mapLabel || shape.name;
              const pressed = selected === shape.name;
              return (
                <g
                  key={shape.name}
                  data-department={shape.name}
                  data-level={live?.level ?? (paint.hatch ? "sin-datos" : "pendiente")}
                  role="button"
                  tabIndex={0}
                  aria-label={`${shape.name}, ${label}`}
                  aria-pressed={pressed}
                  className="cursor-pointer"
                  onClick={() => onSelect(shape.name)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(shape.name);
                    }
                  }}
                >
                  <path
                    d={shape.d}
                    fill={paint.hatch ? "url(#sin-datos-hatch)" : paint.fill}
                    stroke={pressed ? "#1C1917" : "#44403C"}
                    strokeWidth={pressed ? 3 : 1}
                  />
                </g>
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0">
            {SHAPES.shapes.map((shape) => {
              const entry = CATALOG.get(shape.name);
              const live = liveByName.get(shape.name) ?? null;
              const paint = paintFor(status, entry?.hasPoints ?? false, live);
              return (
                <span
                  key={shape.name}
                  aria-hidden="true"
                  className="absolute w-24 -translate-x-1/2 -translate-y-1/2 text-center text-[14px] font-bold leading-tight"
                  style={{
                    left: `${(shape.labelX / SHAPES.width) * 100}%`,
                    top: `${(shape.labelY / SHAPES.height) * 100}%`,
                    color: paint.text,
                    textShadow: "0 0 2px #fff",
                  }}
                >
                  <span className="block">{shape.name}</span>
                  {paint.mapLabel ? <span className="block">{paint.mapLabel}</span> : null}
                </span>
              );
            })}
          </div>
        </div>
      )}
      <ul aria-label="Leyenda" className="flex flex-wrap gap-x-4 gap-y-2">
        {(["alto", "medio", "bajo"] as const).map((level) => (
          <li key={level} className="flex min-h-11 items-center gap-2 text-base font-semibold">
            <span
              aria-hidden="true"
              className="inline-block h-6 w-6 rounded"
              style={{ backgroundColor: LEVEL_STYLE[level].fill }}
            />
            <span style={{ color: LEVEL_STYLE[level].text }}>{levelWord(level)}</span>
          </li>
        ))}
        <li className="flex min-h-11 items-center gap-2 text-base font-semibold">
          <span
            aria-hidden="true"
            className="inline-block h-6 w-6 rounded"
            style={{
              backgroundColor: SIN_DATOS_FILL,
              backgroundImage: "repeating-linear-gradient(135deg, #E7E5E4 0 4px, #D6D3D1 4px 6px)",
            }}
          />
          <span className="text-[#1C1917]">Sin datos</span>
        </li>
      </ul>
      {status === "ready" && map ? <p>{mapSourceLine(map.updatedLabel)}</p> : null}
      <p className="text-[14px]" style={{ color: ATTRIBUTION_COLOR }}>
        {MAP_ATTRIBUTION}
      </p>
      {status === "loading" ? <p role="status">Cargando el mapa…</p> : null}
      {status === "failed" ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">{FORECAST_UNAVAILABLE_TITLE}</h2>
          <p>{FORECAST_MISSING_COPY}</p>
          <button type="button" className={primary} onClick={onRetry}>
            {RETRY_LABEL}
          </button>
        </div>
      ) : null}
      {selected && selectedEntry ? (
        <DepartmentCard
          name={selected}
          hasPoints={selectedEntry.hasPoints}
          status={status}
          live={selectedView}
          onOpenMunicipalities={onOpenMunicipalities}
        />
      ) : null}
    </section>
  );
}

function DepartmentCard({
  name,
  hasPoints,
  status,
  live,
  onOpenMunicipalities,
}: {
  name: string;
  hasPoints: boolean;
  status: "loading" | "ready" | "failed";
  live: DepartmentView | null;
  onOpenMunicipalities: (name: string) => void;
}) {
  const worst = live?.level ? (live.points.find((point) => point.level === live.level) ?? null) : null;
  const why =
    hasPoints && worst
      ? buildWhyModel({
          label: null,
          leafDetail: null,
          diagnoseFailed: false,
          day: {
            wetHours: worst.wetHours,
            rain: worst.rain,
            tmax: worst.tmax,
            reason: worst.reason ?? "",
          },
        })
      : null;
  const tone = live?.level ? LEVEL_STYLE[live.level] : null;

  return (
    <article id="ficha-departamento" className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-2xl font-semibold">{name}</h2>
      {!hasPoints ? <p>{NO_COFFEE_POINTS_COPY}</p> : null}
      {hasPoints && status === "loading" ? <p>Cargando el pronóstico…</p> : null}
      {hasPoints && status === "failed" ? <p>{FORECAST_MISSING_COPY}</p> : null}
      {hasPoints && status === "ready" && live ? (
        <>
          <p className={`text-lg font-semibold ${tone ? tone.chip : "bg-[#E7E5E4] text-[#1C1917]"} rounded-xl px-3 py-2`}>
            {live.label}
          </p>
          <ul className="flex flex-col gap-2">
            {live.points.map((point) => {
              const pointTone = point.level ? LEVEL_STYLE[point.level] : null;
              return (
                <li
                  key={point.id}
                  className={`flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-base font-semibold ${pointTone ? pointTone.chip : "bg-[#E7E5E4] text-[#1C1917]"}`}
                >
                  <span>{point.name}</span>
                  <span>{point.level ? levelWord(point.level) : "Sin datos"}</span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {hasPoints ? (
        <button type="button" className={primary} onClick={() => onOpenMunicipalities(name)}>
          {SEE_MUNICIPALITIES}
        </button>
      ) : null}
      {why ? <WhyPanel model={why} /> : null}
    </article>
  );
}
