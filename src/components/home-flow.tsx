"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { dayCardReason, formatPhotoDate } from "@/lib/format";
import { downscalePhoto } from "@/lib/photo";
import {
  departmentNames,
  filterPlacesByName,
  placeById,
  placesInDepartment,
  PLACES,
} from "@/lib/places";
import {
  gpsScreen,
  type GpsScreen,
} from "@/lib/risk/gps";
import { pinCardLine } from "@/lib/risk/pin-card";
import { parseDepartmentMap, type DepartmentMapOk } from "@/lib/risk/department-catalog";
import { PlaceMap, type MapPinSummary } from "./place-map";
import { queHacerHoySpeech, todayRiskLevel } from "@/lib/que-hacer-hoy";
import { listenScript } from "@/lib/speech";
import { buildAgentSteps, planStepLine } from "@/lib/agent-steps";
import { actionPlanSpeech } from "@/lib/plan-speech";
import { buildWhyModel, worstDayDetail, type WhyModel } from "@/lib/result-why";
import { agronomistSharePayload, canShareFiles, whatsAppLink } from "@/lib/share";
import {
  CONTACTS_PENDING,
  diagnosisStatusCopy,
  FORECAST_MISSING_COPY,
  FORECAST_UNAVAILABLE_TITLE,
  GEO_DENIED_COPY,
  RETRY_LABEL,
  coffeeZoneLabel,
  riskSourceNote,
  riskStripSubtitle,
  showsActionPlan,
} from "@/lib/vision/copy";
import type { Diagnosis } from "@/lib/vision/diagnose";
import { AskBox } from "./ask-box";
import { AgentStepper } from "./agent-stepper";
import { DepartmentRiskMap } from "./department-map";
import { ListenButton } from "./listen-button";
import { QueHacerHoy } from "./que-hacer-hoy";
import { RiskPanel, type RiskView } from "./risk-panel";
import { OrientationTag, WhyPanel } from "./why-panel";

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
  if (diagnosis.label === "sana") return "Parece sana.";
  if (diagnosis.label === "otro") return "No parece roya.";
  return "Parece roya.";
}

export function HomeFlow() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("foto");
  const [placeId, setPlaceId] = useState("");
  const [department, setDepartment] = useState("");
  const [municipalityQuery, setMunicipalityQuery] = useState("");
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
  const [gpsView, setGpsView] = useState<GpsScreen | null>(null);
  const [gpsRisk, setGpsRisk] = useState<RiskView | null>(null);
  const [gpsState, setGpsState] = useState<"idle" | "loading" | "failed">("idle");
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [departmentMap, setDepartmentMap] = useState<DepartmentMapOk | null>(null);
  const [departmentStatus, setDepartmentStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [departmentAttempt, setDepartmentAttempt] = useState(0);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/risk/departments");
        const payload = parseDepartmentMap(await response.json().catch(() => null));
        if (cancelled) return;
        if (!response.ok || !payload) {
          setDepartmentStatus("failed");
          return;
        }
        setDepartmentMap(payload);
        setDepartmentStatus("ready");
      } catch {
        if (!cancelled) setDepartmentStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [departmentAttempt]);

  function selectDepartment(value: string) {
    setDepartment(value);
    setSelectedDepartment(value);
    setMunicipalityQuery("");
    const current = placeById(placeId);
    if (current && current.department !== value) {
      setPlaceId("");
      setRisk(null);
    }
  }

  const place = placeById(placeId);
  const worstLine = risk ? pinCardLine(risk.days) : null;
  const planAllowed =
    diagnosis?.ok === true &&
    diagnosis.band !== "no_seguro" &&
    (diagnosis.label === "roya" || diagnosis.label === "sana") &&
    diagnoseError === null;
  const showRiskPlan = showsActionPlan(diagnoseError, planAllowed);
  const selectedDept = departmentMap?.departments.find((item) => item.name === selectedDepartment) ?? null;
  let climateLine: string | null = null;
  if (place && worstLine) {
    climateLine = `${place.name}: ${worstLine}`;
  } else if (selectedDept) {
    climateLine = selectedDept.level
      ? `${selectedDept.name}: ${selectedDept.label}`
      : `${selectedDept.name}: Sin datos`;
  }
  const diagnosisHeadline = diagnosis?.ok ? diagnosis.headline : null;
  const steps = buildAgentSteps({
    climateLine,
    photo: photo !== null,
    diagnosing,
    diagnosisHeadline,
    diagnoseErrorLine: diagnoseError ? diagnosisStatusCopy(diagnoseError) : null,
    planAllowed,
    planLine: planAllowed && risk ? planStepLine(risk.plan) : null,
  });
  const why = buildWhyModel({
    label: diagnosis?.ok ? diagnosis.label : null,
    leafDetail: diagnosis?.ok ? diagnosis.detail : null,
    diagnoseFailed: diagnoseError !== null,
    day: risk ? worstDayDetail(risk.days) : null,
  });

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

  function clearGps() {
    setGpsView(null);
    setGpsRisk(null);
    setGpsState("idle");
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoNote(GEO_DENIED_COPY);
      return;
    }
    setGeoNote(null);
    setGpsState("loading");
    setGpsView(null);
    setGpsRisk(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const early = gpsScreen({ latitude, longitude, elevationM: null, places: PLACES });
        if (early.kind === "outside") {
          setGpsView(early);
          setGpsState("idle");
          return;
        }
        void loadGps(latitude, longitude);
      },
      () => {
        setGpsState("idle");
        setGeoNote(GEO_DENIED_COPY);
      },
      { timeout: 8000, maximumAge: 0 },
    );
  }

  async function loadGps(latitude: number, longitude: number) {
    try {
      const response = await fetch(
        `/api/risk?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`,
      );
      const payload = (await response.json()) as
        | ({ ok: true; elevation_m: number | null } & RiskView)
        | { ok: false; error?: string };
      if (!response.ok || !payload.ok) {
        if (!payload.ok && payload.error === "outside_el_salvador") {
          setGpsView(gpsScreen({ latitude, longitude, elevationM: null, places: PLACES }));
          setGpsState("idle");
          return;
        }
        setGpsState("failed");
        return;
      }
      setGpsView(
        gpsScreen({
          latitude,
          longitude,
          elevationM: payload.elevation_m,
          places: PLACES,
        }),
      );
      setGpsRisk(payload);
      setGpsState("idle");
    } catch {
      setGpsState("failed");
    }
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
    coordType: place?.coordType ?? null,
    risk,
    riskFailed: riskState === "failed",
    planAllowed,
  });

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-3 py-6">
      <p className="font-semibold tracking-wide text-[#1E5B2A]">AgroClima</p>
      {step === "foto" ? (
        <>
        <DepartmentRiskMap
          status={departmentStatus}
          map={departmentMap}
          selected={selectedDepartment}
          onSelect={setSelectedDepartment}
          onRetry={() => {
            setDepartmentMap(null);
            setDepartmentStatus("loading");
            setDepartmentAttempt((value) => value + 1);
          }}
          onOpenMunicipalities={(name) => {
            selectDepartment(name);
            document.getElementById("lista-municipios")?.scrollIntoView({ block: "start" });
          }}
        />
        <AgentStepper steps={steps} />
        <FotoStep
          placeId={placeId}
          geoNote={geoNote}
          preview={preview}
          diagnosing={diagnosing}
          slow={slow}
          ready={Boolean(photo && placeId)}
          cameraRef={cameraRef}
          uploadRef={uploadRef}
          department={department}
          municipalityQuery={municipalityQuery}
          gpsView={gpsView}
          gpsRisk={gpsRisk}
          gpsState={gpsState}
          highlightId={gpsView?.kind === "near" ? gpsView.highlightId : null}
          coordType={place?.coordType ?? null}
          risk={risk}
          riskState={riskState}
          worstLine={worstLine}
          onRiskRetry={() => void loadRisk(placeId)}
          onDepartment={selectDepartment}
          onMunicipalityQuery={(value) => {
            setMunicipalityQuery(value);
            const visible = filterPlacesByName(placesInDepartment(department), value);
            if (placeId && !visible.some((item) => item.id === placeId)) {
              setPlaceId("");
            }
          }}
          onPlace={(id) => {
            setPlaceId(id);
            setMunicipalityQuery("");
            clearGps();
            void loadRisk(id);
          }}
          onPickPin={(id) => {
            const chosen = placeById(id);
            if (!chosen) return;
            setPlaceId(id);
            setDepartment(chosen.department);
            setMunicipalityQuery("");
            clearGps();
            void loadRisk(id);
          }}
          onLocate={useMyLocation}
          onFile={(file) => void takePhoto(file)}
          onReview={() => void review()}
        />
        </>
      ) : (
        <AgentStepper steps={steps} />
      )}
      {step === "resultado" ? (
        <ResultStep
          diagnosis={diagnosis}
          diagnoseError={diagnoseError}
          preview={preview}
          planAllowed={planAllowed}
          risk={risk}
          riskState={riskState}
          coordType={place?.coordType ?? null}
          onRetry={() => void review()}
          onRisk={() => setStep("riesgo")}
          onRiskRetry={() => void loadRisk(placeId)}
          onShare={() => void share()}
          onRetake={() => setStep("foto")}
          why={why}
          onConsult={() => void share()}
        />
      ) : null}
      {step === "riesgo" ? (
        <>
          {riskState === "failed" && diagnosis?.ok ? (
            <>
              <h1 className="text-[30px] font-semibold leading-tight">{diagnosis.headline}</h1>
              <OrientationTag />
              {diagnosis.detail ? <p>{diagnosis.detail}</p> : null}
            </>
          ) : null}
          <RiskPanel
            risk={risk}
            loading={riskState === "loading"}
            failed={riskState === "failed"}
            showPlan={riskState === "failed" ? false : showsActionPlan(diagnoseError, planAllowed)}
            onRetry={() => void loadRisk(placeId)}
            coordType={place?.coordType ?? null}
          />
          <QueHacerHoy level={todayRiskLevel(risk)} />
          {why ? <WhyPanel model={why} onConsult={() => void share()} /> : null}
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
          <RiskPanel
            risk={risk}
            loading={false}
            failed={false}
            showPlan
            coordType={place?.coordType ?? null}
          />
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
          {why ? <WhyPanel model={why} onConsult={() => void share()} /> : null}
          <button type="button" className={primary} onClick={() => setStep("compartir")}>
            Escuchar o compartir
          </button>
        </>
      ) : null}
      {step === "compartir" ? (
        <>
          {why?.showTechnician ? <OrientationTag /> : null}
          <ShareStep
            summary={shareSummary(diagnosis, diagnoseError)}
            placeName={place?.name ?? ""}
            spoken={spoken}
            onShare={() => void share()}
            onReset={reset}
          />
          {why ? <WhyPanel model={why} onConsult={() => void share()} /> : null}
        </>
      ) : null}
      <ListenButton text={spoken} />
    </main>
  );
}

function FotoStep({
  placeId,
  department,
  municipalityQuery,
  geoNote,
  preview,
  diagnosing,
  slow,
  ready,
  cameraRef,
  uploadRef,
  gpsView,
  gpsRisk,
  gpsState,
  highlightId,
  coordType,
  risk,
  riskState,
  worstLine,
  onDepartment,
  onMunicipalityQuery,
  onPlace,
  onPickPin,
  onLocate,
  onFile,
  onReview,
  onRiskRetry,
}: {
  placeId: string;
  department: string;
  municipalityQuery: string;
  geoNote: string | null;
  preview: string | null;
  diagnosing: boolean;
  slow: boolean;
  ready: boolean;
  cameraRef: RefObject<HTMLInputElement | null>;
  uploadRef: RefObject<HTMLInputElement | null>;
  gpsView: GpsScreen | null;
  gpsRisk: RiskView | null;
  gpsState: "idle" | "loading" | "failed";
  highlightId: string | null;
  coordType: "town_centre" | "slope_point" | null;
  risk: RiskView | null;
  riskState: "idle" | "loading" | "failed";
  worstLine: string | null;
  onDepartment: (department: string) => void;
  onMunicipalityQuery: (query: string) => void;
  onPlace: (id: string) => void;
  onPickPin: (id: string, pin: MapPinSummary) => void;
  onLocate: () => void;
  onFile: (file: File | undefined) => void;
  onReview: () => void;
  onRiskRetry: () => void;
}) {
  const matches = filterPlacesByName(placesInDepartment(department), municipalityQuery);
  const municipalityValue = matches.some((place) => place.id === placeId) ? placeId : "";

  const gpsLine = gpsRisk ? pinCardLine(gpsRisk.days) : null;

  return (
    <>
      <button type="button" className={primary} onClick={onLocate}>
        Usar mi ubicación
      </button>
      {geoNote ? <p>{geoNote}</p> : null}
      {gpsState === "loading" ? <p role="status">Cargando el pronóstico…</p> : null}
      {gpsState === "failed" ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">{FORECAST_UNAVAILABLE_TITLE}</h2>
          <p>{FORECAST_MISSING_COPY}</p>
        </div>
      ) : null}
      {gpsView?.kind === "outside" ? <p>{gpsView.message}</p> : null}
      {gpsView?.kind === "far" && gpsRisk ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">{gpsView.title}</h2>
          {gpsLine ? <p className="text-lg font-semibold">{gpsLine}</p> : null}
          <RiskPanel risk={gpsRisk} loading={false} failed={false} showPlan={false} subtitle="Toque un día" />
          <p className="text-lg text-[#78716c]">{gpsView.note}</p>
        </div>
      ) : null}
      {gpsView?.kind === "near" && gpsRisk ? (
        <div className="flex flex-col gap-3">
          {gpsLine ? <p className="text-lg font-semibold">{gpsLine}</p> : null}
          <RiskPanel risk={gpsRisk} loading={false} failed={false} showPlan={false} subtitle="Toque un día" />
          <p className="text-lg">{gpsView.gridNote}</p>
        </div>
      ) : null}
      <PlaceMap highlightId={highlightId} onPick={onPickPin} />
      <a
        href="#lista-municipios"
        className="flex min-h-14 items-center text-lg font-semibold text-[#1E5B2A] underline"
      >
        Ver lista
      </a>
      {gpsView ? null : risk || riskState !== "idle" ? (
        <div className="flex flex-col gap-3">
          {worstLine ? <p className="text-lg font-semibold">{worstLine}</p> : null}
          <RiskPanel
            risk={risk}
            loading={riskState === "loading"}
            failed={riskState === "failed"}
            showPlan={false}
            onRetry={onRiskRetry}
            coordType={coordType}
          />
        </div>
      ) : null}
      <div id="lista-municipios" className="flex flex-col gap-3">
        <p className="text-lg font-semibold">O elija su municipio</p>
        <label className="text-lg font-semibold" htmlFor="departamento">
          Departamento
        </label>
        <select
          id="departamento"
          className="min-h-14 w-full rounded-2xl bg-white px-3 text-lg"
          value={department}
          onChange={(event) => onDepartment(event.target.value)}
        >
          <option value="">Elija su departamento</option>
          {departmentNames().map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <label className="text-lg font-semibold" htmlFor="buscar-municipio">
          Buscar municipio
        </label>
        <input
          id="buscar-municipio"
          className="min-h-14 w-full rounded-2xl bg-white px-3 text-lg disabled:opacity-60"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Escriba para filtrar"
          value={municipalityQuery}
          disabled={department === ""}
          onChange={(event) => onMunicipalityQuery(event.target.value)}
        />
        <label className="text-lg font-semibold" htmlFor="municipio">
          Municipio (ubicación aproximada)
        </label>
        <select
          id="municipio"
          className="min-h-14 w-full rounded-2xl bg-white px-3 text-lg disabled:opacity-60"
          value={municipalityValue}
          disabled={department === ""}
          onChange={(event) => onPlace(event.target.value)}
        >
          <option value="">Elija su municipio</option>
          {matches.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {department !== "" && municipalityQuery.trim() !== "" && matches.length === 0 ? (
          <p role="status">Ningún municipio con ese nombre.</p>
        ) : null}
      </div>
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
  coordType,
  onRetry,
  onRisk,
  onRiskRetry,
  onShare,
  onRetake,
  why,
  onConsult,
}: {
  diagnosis: Diagnosis | null;
  diagnoseError: DiagnoseError | null;
  preview: string | null;
  planAllowed: boolean;
  risk: RiskView | null;
  riskState: "idle" | "loading" | "failed";
  coordType: "town_centre" | "slope_point" | null;
  onRetry: () => void;
  onRisk: () => void;
  onRiskRetry: () => void;
  onShare: () => void;
  onRetake: () => void;
  why: WhyModel | null;
  onConsult: () => void;
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
          <OrientationTag />
          <button type="button" className={primary} onClick={onRetry}>
            {RETRY_LABEL}
          </button>
          <RiskPanel
            risk={risk}
            loading={riskState === "loading"}
            failed={riskState === "failed"}
            showPlan={showsActionPlan(diagnoseError, planAllowed)}
            onRetry={onRiskRetry}
            coordType={coordType}
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
      <QueHacerHoy level={todayRiskLevel(risk)} />
      {why ? <WhyPanel model={why} onConsult={onConsult} /> : null}
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
      <OrientationTag />
      {diagnosis.detail ? <p>{diagnosis.detail}</p> : null}
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
  coordType: "town_centre" | "slope_point" | null;
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
    ? weekSpeech(input.risk, input.placeName, input.coordType)
    : input.riskFailed
      ? `${FORECAST_UNAVAILABLE_TITLE}. ${FORECAST_MISSING_COPY}`
      : null;
  const advice =
    input.step === "resultado" || input.step === "riesgo"
      ? queHacerHoySpeech(todayRiskLevel(input.risk))
      : null;
  return listenScript({ result, plan, week, advice }) || "AgroClima";
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
  return actionPlanSpeech(risk.plan);
}

function weekSpeech(
  risk: RiskView,
  placeName: string,
  coordType: "town_centre" | "slope_point" | null,
): string {
  const days = risk.days
    .map((day) =>
      day.level ? `${day.date} ${day.level}. ${dayCardReason(day)}` : `${day.date} sin datos.`,
    )
    .join(" ");
  return `${riskStripSubtitle(placeName, coordType)}. ${riskSourceNote(coordType)}. ${days}`;
}
