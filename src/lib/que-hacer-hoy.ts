import copy from "../data/que-hacer-hoy.json" with { type: "json" };

/** Owner gate. False until Jaime approves the visible copy. Not an env var. */
export const QUE_HACER_HOY_APPROVED = false;

export const QUE_HACER_HOY_TITLE = "Qué hacer hoy";
export const MAS_ADELANTE_TITLE = "Más adelante";
export const FUENTE_LABEL = "Fuente";

export type AdviceLevel = "alto" | "medio" | "bajo";

export type CitedLabel = {
  label: string;
  url: string | null;
};

export type QueHacerHoyItem = {
  id: string;
  text: string;
  policy: boolean;
  sources: CitedLabel[];
};

export type QueHacerHoyView = {
  title: string;
  levelLine: string;
  items: QueHacerHoyItem[];
  laterTitle: string;
  laterText: string;
  laterSources: CitedLabel[];
  footer: string;
};

type Source = {
  statement_id: string;
  label: string;
  url: string | null;
};

type CopyFile = {
  level_lines: Record<AdviceLevel, string>;
  list: Array<{
    id: string;
    text: string;
    sources: Source[];
    policy: boolean;
  }>;
  later: {
    text: string;
    sources: Source[];
  };
  footer: string;
};

const data = copy as CopyFile;

const LEVELS: readonly AdviceLevel[] = ["alto", "medio", "bajo"];

function isLevel(value: string | null | undefined): value is AdviceLevel {
  return value === "alto" || value === "medio" || value === "bajo";
}

/** First forecast day. The engine's week starts on today's local date. */
export function todayRiskLevel(
  risk: { days: Array<{ level: AdviceLevel | null }> } | null,
): AdviceLevel | null {
  const level = risk?.days[0]?.level ?? null;
  return isLevel(level) ? level : null;
}

function citedLabels(sources: Source[], policy = false): CitedLabel[] {
  if (policy) return [];
  const seen = new Set<string>();
  const labels: CitedLabel[] = [];
  for (const source of sources) {
    if (seen.has(source.label)) continue;
    seen.add(source.label);
    labels.push({ label: source.label, url: source.url });
  }
  return labels;
}

export function queHacerHoyView(
  level: AdviceLevel | null,
  approved: boolean = QUE_HACER_HOY_APPROVED,
): QueHacerHoyView | null {
  if (!approved || !isLevel(level)) return null;
  return {
    title: QUE_HACER_HOY_TITLE,
    levelLine: data.level_lines[level],
    items: data.list.map((item) => ({
      id: item.id,
      text: item.text,
      policy: item.policy,
      sources: citedLabels(item.sources, item.policy),
    })),
    laterTitle: MAS_ADELANTE_TITLE,
    laterText: data.later.text,
    laterSources: citedLabels(data.later.sources),
    footer: data.footer,
  };
}

function fuenteParts(sources: CitedLabel[]): string[] {
  if (sources.length === 0) return [];
  return [FUENTE_LABEL, ...sources.map((source) => source.label)];
}

/** Visible text, in screen order. Empty when the block is not rendered. */
export function queHacerHoySpeech(
  level: AdviceLevel | null,
  approved: boolean = QUE_HACER_HOY_APPROVED,
): string {
  const view = queHacerHoyView(level, approved);
  if (!view) return "";
  const parts = [view.title, view.levelLine];
  for (const item of view.items) {
    parts.push(item.text, ...fuenteParts(item.sources));
  }
  parts.push(view.laterTitle, view.laterText, ...fuenteParts(view.laterSources), view.footer);
  return parts.join(" ");
}

/** Every user-facing string this block can show. Used to prove the gate hides them. */
export function queHacerHoyCorpus(): string[] {
  const strings = [
    QUE_HACER_HOY_TITLE,
    MAS_ADELANTE_TITLE,
    FUENTE_LABEL,
    ...LEVELS.map((level) => data.level_lines[level]),
    ...data.list.map((item) => item.text),
    ...data.list.flatMap((item) => item.sources.map((source) => source.label)),
    data.later.text,
    ...data.later.sources.map((source) => source.label),
    data.footer,
  ];
  return [...new Set(strings)];
}

export function queHacerHoyCopy(): CopyFile {
  return data;
}
