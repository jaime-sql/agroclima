"use client";

import { DETECTION_NOTE_COLOR, ORIENTATION_TAG, type WhyModel } from "@/lib/result-why";

const primary =
  "min-h-14 w-full rounded-2xl bg-[#1E5B2A] px-4 text-lg font-semibold text-white";

/** Grey chip in place of a model confidence word or score. */
export function OrientationTag() {
  return (
    <p className="inline-flex w-fit items-center rounded-full bg-[#E7E5E4] px-3 py-1 text-[14px] font-semibold text-[#57534E]">
      {ORIENTATION_TAG}
    </p>
  );
}

export function WhyPanel({
  model,
  onConsult,
}: {
  model: WhyModel;
  onConsult?: () => void;
}) {
  return (
    <div id="por-que" className="flex flex-col gap-3">
      <details className="rounded-2xl bg-white p-4 shadow-sm">
        <summary className="flex min-h-14 cursor-pointer items-center text-lg font-semibold">
          ¿Por qué este resultado?
        </summary>
        <div className="mt-3 flex flex-col gap-2">
          {model.reasons.length > 0 ? (
            <ul className="list-disc pl-5">
              {model.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          {model.detectionNote ? (
            <p id="nota-deteccion" className="text-[12px] leading-5" style={{ color: DETECTION_NOTE_COLOR }}>
              {model.detectionNote}
            </p>
          ) : null}
        </div>
      </details>
      {model.showTechnician && onConsult ? (
        <button type="button" className={primary} onClick={onConsult}>
          Consultar a un técnico
        </button>
      ) : null}
    </div>
  );
}
