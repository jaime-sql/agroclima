"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { dayCardReason, formatPhotoDate, formatSprayWindow } from "@/lib/format";
import { downscalePhoto } from "@/lib/photo";
import { DEPARTMENTS, nearestPlace, placeById } from "@/lib/places";
import { listenScript } from "@/lib/speech";
import { agronomistSharePayload, canShareFiles, whatsAppLink } from "@/lib/share";
import {
  CONTACTS_PENDING,
  diagnosisStatusCopy,
  FORECAST_MISSING_COPY,
  FORECAST_UNAVAILABLE_TITLE,
  GEO_DENIED_COPY,
  RETRY_LABEL,
  RISK_ZONE_NOTE,
  coffeeZoneLabel,
  riskStripSubtitle,
  showsActionPlan,
} from "@/lib/vision/copy";
import type { Diagnosis } from "@/lib/vision/diagnose";
import { AskBox } from "./ask-box";
import { ListenButton } from "./listen-button";
import { RiskPanel, type RiskView } from "./risk-panel";

type Step = "foto" | "resultado" | "riesgo" | "plan" | "compartir";
type DiagnoseError = "unavailable" | "offline" | "failed";

const primary =
  "min-h-14 w-full rounded-2xl bg-[#1E5B2A] px-4 text-lg font-semibold text-white";
const secondary =
  "min-h-14 w-full rounded-2xl bg-white px-4 text-lg font-semibold text-[#1E5B2A] ring-2 ring-[#1E5B2A]";
function shareSummary(
  diagnosis: Diagnosis | null,
  diagnoseError: DiagnoseError | null,
): string {
  if (diagnoseError || !diagnosis || !diagnosis.ok) return "No pudimos revisar la hoja.";
  if (diagnosis.label === "retomar") return "Hay que repetir la foto.";
  if (diagnosis.band === "no_seguro") return "No estamos seguros.";
  if (diagnosis.label === "sana") return "Parece sana (Seguro).";
  if (diagnosis.label === "otro") return "No parece roya.";
  const band = diagnosis.band === "probable" ? "Probable" : "Seguro";
  return `Parece roya (${band}).`;
}

export function HomeFlow() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("foto");
  const [placeId, setPlaceId] = useState("");
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoTaken, setPhotoTaken] = useState<Date | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [diagnoseError, setDiagnoseError] = useState<DiagnoseError | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [slow, setSlow] = useState(false);
  const [risk, setRisk] = useState<RiskView | null>(null);
  const [riskState, setRiskState] = useState<"idle" | "loading" | "failed">("idle");

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const place = placeById(placeId);
  const planAllowed =
    diagnosis?.ok === true &&
    diagnosis.band !== "no_seguro" &&
    (diagnosis.label === "roya" || diagnosis.label === "sana") &&
    diagnoseError === null;
  const showRiskPlan = showsActionPlan(diagnoseError, planAllowed);

  async function takePhoto(file: File | undefined) {
    if (!file) return;
    const scaled = await downscalePhoto(file).catch(() => file);
    setPhoto(scaled);
    setPhotoTaken(new Date());
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(scaled);
    });
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoNote(GEO_DENIED_COPY);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPlaceId(nearestPlace(position.coords.latitude, position.coords.longitude).id);
        setGeoNote(null);
      },
      () => setGeoNote(GEO_DENIED_COPY),
      { timeout: 8000, maximumAge: 60_000 },
    );
  }

  async function loadRisk(id: string) {
    setRiskState("loading");
    setRisk(null);
    try {
      const response = await fetch(`/api/risk?place=${encodeURIComponent(id)}`);
      const payload = (await response.json()) as
        | ({ ok: true } & RiskView)
        | { ok: false };
      if (!response.ok || !payload.ok) {
        setRiskState("failed");
        return;
      }
      setRisk(payload);
      setRiskState("idle");
    } catch {
      setRiskState("failed");
    }
  }

  async function review() {
    if (!photo || !placeId) return;
    setDiagnosing(true);
    setSlow(false);
    setDiagnoseError(null);
    setDiagnosis(null);
    const timer = window.setTimeout(() => setSlow(true), 10_000);
    const riskTask = loadRisk(placeId);
    try {
      const form = new FormData();
      form.set("photo", photo);
      const response = await fetch("/api/diagnose", { method: "POST", body: form });
      const payload = (await response.json()) as Diagnosis | { ok: false; error: string };
      if (payload.ok) setDiagnosis(payload);
      else if (payload.error === "unavailable") setDiagnoseError("unavailable");
      else setDiagnoseError("failed");
      setStep("resultado");
    } catch {
      setDiagnoseError("offline");
      setStep("resultado");
    } finally {
      window.clearTimeout(timer);
      setDiagnosing(false);
      setSlow(false);
      await riskTask;
    }
  }

  async function share() {
    if (!place) return;
    const payload = agronomistSharePayload({
      diagnoseError,
      summary: shareSummary(diagnosis, diagnoseError),
      placeName: place.name,
      photoDate: photoTaken ? formatPhotoDate(photoTaken) : "",
      days: risk?.days ?? [],
      forecastUnavailable: riskState === "failed" && !risk,
    });
    if (payload.includePhoto && photo && photoTaken && canShareFiles(navigator.canShare?.bind(navigator), photo)) {
      try {
        await navigator.share({ files: [photo], text: payload.text, title: "AgroClima" });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    window.location.assign(whatsAppLink(payload.text));
  }

  function reset() {
    setStep("foto");
    setPhoto(null);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setPhotoTaken(null);
    setDiagnosis(null);
    setDiagnoseError(null);
    setRisk(null);
    setRiskState("idle");
  }

  const spoken = spokenText({
    step,
    diagnosis,
    diagnoseError,
    diagnosing,
    slow,
    placeName: place?.name ?? "",
    risk,
    riskFailed: riskState === "failed",
    planAllowed,
  });

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-3 py-6">
      <p className="font-semibold tracking-wide text-[#1E5B2A]">AgroClima</p>
      {step === "foto" ? (
        <FotoStep
          placeId={placeId}
          geoNote={geoNote}
          preview={preview}
          diagnosing={diagnosing}
          slow={slow}
          ready={Boolean(photo && placeId)}
          cameraRef={cameraRef}
          uploadRef={uploadRef}
          onPlace={setPlaceId}
          onLocate={useMyLocation}
          onFile={(file) => void takePhoto(file)}
          onReview={() => void review()}
        />
      ) : null}
      {step === "resultado" ? (
        <ResultStep
          diagnosis={diagnosis}
          diagnoseError={diagnoseError}
          preview={preview}
          planAllowed={planAllowed}
          risk={risk}
          riskState={riskState}
          onRetry={() => void review()}
          onRisk={() => setStep("riesgo")}
          onRiskRetry={() => void loadRisk(placeId)}
          onShare={() => void share()}
          onRetake={() => setStep("foto")}
        />
      ) : null}
      {step === "riesgo" ? (
        <>
          {riskState === "failed" && diagnosis?.ok ? (
            <>
              <h1 className="text-[30px] font-semibold leading-tight">{diagnosis.headline}</h1>
              <p>{diagnosis.detail}</p>
            </>
          ) : null}
          <RiskPanel
            risk={risk}
            loading={riskState === "loading"}
            failed={riskState === "failed"}
            showPlan={riskState === "failed" ? false : showsActionPlan(diagnoseError, planAllowed)}
            onRetry={() => void loadRisk(placeId)}
          />
          {riskState === "failed" ? (
            <button type="button" className={secondary} onClick={() => void share()}>
              Compartir con mi agrónomo
            </button>
          ) : showRiskPlan && planAllowed ? (
            <button type="button" className={primary} onClick={() => setStep("plan")}>
              Ver mi plan
            </button>
          ) : (
            <button type="button" className={primary} onClick={() => setStep("compartir")}>
              Escuchar o compartir
            </button>
          )}
        </>
      ) : null}
      {step === "plan" && risk ? (
        <>
          <h1 className="text-2xl font-semibold">Su plan</h1>
          <RiskPanel risk={risk} loading={false} failed={false} showPlan />
          <AskBox
            place={coffeeZoneLabel(risk.place.name)}
            timezone={risk.timezone}
            days={risk.days.slice(0, 7).map((day) => ({
              date: day.date,
              level: day.level,
              score: day.score,
              wetHours: day.wetHours,
              tmax: day.tmax,
              rain: day.rain,
              reason: day.reason,
            }))}
            diagnosis={
              diagnosis?.ok
                ? { headline: diagnosis.headline, detail: diagnosis.detail }
                : null
            }
            onShare={() => void share()}
          />
          <button type="button" className={primary} onClick={() => setStep("compartir")}>
            Escuchar o compartir
          </button>
        </>
      ) : null}
      {step === "compartir" ? (
        <ShareStep
          summary={shareSummary(diagnosis, diagnoseError)}
          placeName={place?.name ?? ""}
          spoken={spoken}
          onShare={() => void share()}
          onReset={reset}
        />
      ) : null}
      <ListenButton text={spoken} />
    </main>
  );
}

function FotoStep({
  placeId,
  geoNote,
  preview,
  diagnosing,
  slow,
  ready,
  cameraRef,
  uploadRef,
  onPlace,
  onLocate,
  onFile,
  onReview,
}: {
  placeId: string;
  geoNote: string | null;
  preview: string | null;
  diagnosing: boolean;
  slow: boolean;
  ready: boolean;
  cameraRef: RefObject<HTMLInputElement | null>;
  uploadRef: RefObject<HTMLInputElement | null>;
  onPlace: (id: string) => void;
  onLocate: () => void;
  onFile: (file: File | undefined) => void;
  onReview: () => void;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Tome una foto de una hoja de café.
      </h1>
      <p>Una sola hoja, de cerca, con buena luz.</p>
      {preview ? (
        <div
          role="img"
          aria-label="Foto de la hoja"
          className="h-56 w-full rounded-2xl bg-cover bg-center"
          style={{ backgroundImage: `url("${preview}")` }}
        />
      ) : null}
      <input
        ref={cameraRef}
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      <input
        ref={uploadRef}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      <button type="button" className={primary} onClick={() => cameraRef.current?.click()}>
        Tomar foto de la hoja
      </button>
      <button type="button" className={secondary} onClick={() => uploadRef.current?.click()}>
        Subir foto
      </button>
      <label className="flex min-h-12 items-center font-semibold" htmlFor="municipio">
        ¿Dónde está su finca?
      </label>
      <select
        id="municipio"
        className="min-h-14 w-full rounded-2xl bg-white px-3 text-lg"
        value={placeId}
        onChange={(event) => onPlace(event.target.value)}
      >
        <option value="">Elija su municipio</option>
        {DEPARTMENTS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <button type="button" className={secondary} onClick={onLocate}>
        Usar mi ubicación
      </button>
      {geoNote ? <p>{geoNote}</p> : null}
      {diagnosing ? (
        <p role="status">
          {slow
            ? "Esto tarda un poco. Espere, por favor."
            : "Revisando su hoja…"}
        </p>
      ) : null}
      <button type="button" className={primary} disabled={!ready || diagnosing} onClick={onReview}>
        Revisar hoja
      </button>
    </>
  );
}

function ResultStep({
  diagnosis,
  diagnoseError,
  preview,
  planAllowed,
  risk,
  riskState,
  onRetry,
  onRisk,
  onRiskRetry,
  onShare,
  onRetake,
}: {
  diagnosis: Diagnosis | null;
  diagnoseError: DiagnoseError | null;
  preview: string | null;
  planAllowed: boolean;
  risk: RiskView | null;
  riskState: "idle" | "loading" | "failed";
  onRetry: () => void;
  onRisk: () => void;
  onRiskRetry: () => void;
  onShare: () => void;
  onRetake: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {preview ? (
        <div
          role="img"
          aria-label="Foto de la hoja"
          className="h-48 w-full rounded-2xl bg-cover bg-center"
          style={{ backgroundImage: `url("${preview}")` }}
        />
      ) : null}
      {diagnoseError ? (
        <>
          <h1 className="text-[30px] font-semibold leading-tight">
            {diagnosisStatusCopy(diagnoseError)}
          </h1>
          <button type="button" className={primary} onClick={onRetry}>
            {RETRY_LABEL}
          </button>
          <RiskPanel
            risk={risk}
            loading={riskState === "loading"}
            failed={riskState === "failed"}
            showPlan={showsActionPlan(diagnoseError, planAllowed)}
            onRetry={onRiskRetry}
          />
          <button type="button" className={secondary} onClick={onShare}>
            Compartir con mi agrónomo
          </button>
        </>
      ) : diagnosis?.ok ? (
        <DiagnosisBody
          diagnosis={diagnosis}
          planAllowed={planAllowed}
          onRisk={onRisk}
          onShare={onShare}
          onRetake={onRetake}
        />
      ) : null}
    </div>
  );
}

function DiagnosisBody({
  diagnosis,
  planAllowed,
  onRisk,
  onShare,
  onRetake,
}: {
  diagnosis: Extract<Diagnosis, { ok: true }>;
  planAllowed: boolean;
  onRisk: () => void;
  onShare: () => void;
  onRetake: () => void;
}) {
  const probable = diagnosis.band === "probable";
  return (
    <>
      <h1 className="text-[30px] font-semibold leading-tight" aria-live="polite">
        {diagnosis.headline}
      </h1>
      <p>{diagnosis.detail}</p>
      {diagnosis.advice ? (
        <article className="rounded-2xl bg-[#FFF1C2] p-4 text-[#6B4B00]">
          <h2 className="text-2xl font-semibold">Consejo</h2>
          <p className="mt-1">{diagnosis.advice}</p>
        </article>
      ) : null}
      {diagnosis.card ? (
        <article className="rounded-2xl bg-white p-4 shadow-sm">{diagnosis.card}</article>
      ) : null}
      {diagnosis.band === "no_seguro" && diagnosis.label !== "retomar" ? (
        <article className="rounded-2xl bg-[#E7E5E4] p-4">{CONTACTS_PENDING}</article>
      ) : null}
      {diagnosis.label === "retomar" ? (
        <button type="button" className={primary} onClick={onRetake}>
          Tome otra foto
        </button>
      ) : null}
      {diagnosis.band === "no_seguro" && diagnosis.label !== "retomar" ? (
        <>
          <button type="button" className={primary} onClick={onShare}>
            Compartir con mi agrónomo
          </button>
          <button type="button" className={secondary} onClick={onRetake}>
            Tome otra foto
          </button>
        </>
      ) : null}
      {probable && diagnosis.label !== "retomar" ? (
        <>
          <button type="button" className={primary} onClick={onShare}>
            Compartir con mi agrónomo
          </button>
          <button type="button" className={secondary} onClick={onRisk}>
            Ver riesgo de 7 días
          </button>
        </>
      ) : null}
      {planAllowed && !probable ? (
        <>
          <button type="button" className={primary} onClick={onRisk}>
            Ver riesgo de 7 días
          </button>
          <button type="button" className={secondary} onClick={onRetake}>
            Tomar otra foto
          </button>
        </>
      ) : null}
      {diagnosis.label === "otro" && diagnosis.band !== "no_seguro" && !probable ? (
        <>
          <button type="button" className={primary} onClick={onShare}>
            Compartir con mi agrónomo
          </button>
          <button type="button" className={secondary} onClick={onRisk}>
            Ver riesgo de 7 días
          </button>
        </>
      ) : null}
    </>
  );
}

function ShareStep({
  summary,
  placeName,
  spoken,
  onShare,
  onReset,
}: {
  summary: string;
  placeName: string;
  spoken: string;
  onShare: () => void;
  onReset: () => void;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold">Su resumen</h1>
      <article className="rounded-2xl bg-white p-4 shadow-sm">
        <p>{summary}</p>
        <p className="mt-2">Departamento: {placeName}.</p>
        <p className="mt-2">Es una orientación, no un diagnóstico.</p>
      </article>
      <ListenButton text={spoken} />
      <button type="button" className={primary} onClick={onShare}>
        Compartir con mi agrónomo
      </button>
      <button type="button" className={secondary} onClick={onShare}>
        Compartir por WhatsApp
      </button>
      <button type="button" className={secondary} onClick={onReset}>
        Empezar de nuevo
      </button>
    </>
  );
}

function spokenText(input: {
  step: Step;
  diagnosis: Diagnosis | null;
  diagnoseError: DiagnoseError | null;
  diagnosing: boolean;
  slow: boolean;
  placeName: string;
  risk: RiskView | null;
  riskFailed: boolean;
  planAllowed: boolean;
}): string {
  if (input.diagnosing) {
    return input.slow
      ? "Esto tarda un poco. Espere, por favor."
      : "Revisando su hoja.";
  }
  if (input.step === "foto") {
    return "Tome una foto de una hoja de café. Una sola hoja, de cerca, con buena luz.";
  }
  const result = resultSpeech(input.diagnosis, input.diagnoseError, input.riskFailed && !input.risk);
  const plan =
    input.risk && showsActionPlan(input.diagnoseError, input.planAllowed)
      ? planSpeech(input.risk)
      : null;
  const week = input.risk
    ? weekSpeech(input.risk, input.placeName)
    : input.riskFailed
      ? `${FORECAST_UNAVAILABLE_TITLE}. ${FORECAST_MISSING_COPY}`
      : null;
  return listenScript({ result, plan, week }) || "AgroClima";
}

function resultSpeech(
  diagnosis: Diagnosis | null,
  diagnoseError: DiagnoseError | null,
  forecastMissing: boolean,
): string | null {
  if (diagnoseError) {
    const status = diagnosisStatusCopy(diagnoseError);
    return forecastMissing
      ? `${status} ${FORECAST_UNAVAILABLE_TITLE}. ${FORECAST_MISSING_COPY}`
      : status;
  }
  if (!diagnosis?.ok) return null;
  const text = [diagnosis.headline, diagnosis.detail, diagnosis.advice, diagnosis.card]
    .filter(Boolean)
    .join(" ");
  return text || null;
}

function planSpeech(risk: RiskView): string {
  return [
    `Qué. Clase de fungicida: ${risk.plan.fungicideClasses.join(", ")}.`,
    `Cuánto. ${risk.plan.doseNote}.`,
    `Cuándo. Próximo día seco para fumigar. ${formatSprayWindow(risk.plan.nextDryWindow)}.`,
    "Use guantes y mascarilla. Lea la etiqueta.",
  ].join(" ");
}

function weekSpeech(risk: RiskView, placeName: string): string {
  const days = risk.days
    .map((day) =>
      day.level ? `${day.date} ${day.level}. ${dayCardReason(day)}` : `${day.date} sin datos.`,
    )
    .join(" ");
  return `${riskStripSubtitle(placeName)}. ${RISK_ZONE_NOTE}. ${days}`;
}
