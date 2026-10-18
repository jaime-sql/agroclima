"use client";

import { createElement, Fragment, type ReactNode } from "react";
import {
  QUE_HACER_HOY_APPROVED,
  queHacerHoyView,
  type AdviceLevel,
  type CitedLabel,
} from "../lib/que-hacer-hoy.ts";

const sectionClass = "flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm";

export function QueHacerHoy({
  level,
  approved = QUE_HACER_HOY_APPROVED,
}: {
  level: AdviceLevel | null;
  approved?: boolean;
}): ReactNode {
  const view = queHacerHoyView(level, approved);
  if (!view) return null;

  return createElement(
    "section",
    { className: sectionClass, "aria-labelledby": "que-hacer-hoy-titulo" },
    createElement(
      "h2",
      { id: "que-hacer-hoy-titulo", className: "text-2xl font-semibold" },
      view.title,
    ),
    createElement("p", null, view.levelLine),
    createElement(
      "ol",
      { className: "list-decimal space-y-3 pl-6" },
      view.items.map((item) =>
        createElement(
          "li",
          { key: item.id, "data-policy": item.policy ? "true" : "false" },
          createElement("p", null, item.text),
          item.policy ? null : fuenteRow(item.sources),
        ),
      ),
    ),
    createElement(
      "div",
      null,
      createElement("p", { className: "text-lg font-semibold" }, view.laterTitle),
      createElement("p", { className: "text-lg" }, view.laterText),
      fuenteRow(view.laterSources),
    ),
    createElement("p", null, view.footer),
  );
}

function fuenteRow(sources: CitedLabel[]): ReactNode {
  if (sources.length === 0) return null;
  return createElement(
    "p",
    { className: "mt-1" },
    createElement("span", { className: "font-semibold" }, "Fuente"),
    ...sources.map((source, index) =>
      createElement(
        Fragment,
        { key: `${source.label}-${index}` },
        " ",
        source.url
          ? createElement(
              "a",
              {
                href: source.url,
                className: "font-semibold text-[#1E5B2A] underline",
                target: "_blank",
                rel: "noreferrer",
              },
              source.label,
            )
          : createElement("span", null, source.label),
      ),
    ),
  );
}
