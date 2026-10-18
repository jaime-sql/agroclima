"use client";

import { useEffect, useRef } from "react";
import { PLACES } from "@/lib/places";
import type { RiskLevel } from "@/lib/risk/types";
import "leaflet/dist/leaflet.css";

export type MapPinSummary = {
  id: string;
  level: RiskLevel | null;
  day: string | null;
};

const PIN_COLOR: Record<RiskLevel, string> = {
  alto: "#8A1C14",
  medio: "#8A6A00",
  bajo: "#1E5B2A",
};

function pinHtml(level: RiskLevel | null, day: string | null, highlighted: boolean): string {
  const label = level ?? "sin datos";
  const color = level ? PIN_COLOR[level] : "#57534e";
  const ring = highlighted ? "box-shadow:0 0 0 3px #111;" : "";
  const dayLine = day ? `<span style="display:block;font-size:11px;font-weight:600;">${day}</span>` : "";
  return `<span style="display:block;min-width:52px;border-radius:12px;background:${color};color:#fff;text-align:center;padding:4px 6px;font:700 13px/1.1 ui-sans-serif,system-ui,sans-serif;${ring}">${label}${dayLine}</span>`;
}

export function PlaceMap({
  highlightId,
  onPick,
}: {
  highlightId: string | null;
  onPick: (id: string, pin: MapPinSummary) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick);
  const highlightRef = useRef(highlightId);
  const summaries = useRef(new Map<string, MapPinSummary>());
  const markers = useRef(new Map<string, import("leaflet").Marker>());

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    highlightRef.current = highlightId;
  }, [highlightId]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const markerMap = markers.current;
    let map: import("leaflet").Map | null = null;
    let cancelled = false;

    void import("leaflet").then((leaflet) => {
      if (cancelled || !element) return;
      map = leaflet
        .map(element, {
          maxBounds: leaflet.latLngBounds([12.7, -90.6], [14.7, -87.2]),
          maxBoundsViscosity: 1,
          minZoom: 8,
          maxZoom: 16,
        })
        .setView([13.8, -88.9], 8);
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 16,
        })
        .addTo(map);

      function paint(id: string) {
        const marker = markers.current.get(id);
        const summary = summaries.current.get(id);
        if (!marker || !summary) return;
        const icon = leaflet.divIcon({
          className: "leaflet-div-icon agroclima-pin",
          html: pinHtml(summary.level, summary.day, highlightRef.current === id),
          iconSize: [64, 36],
          iconAnchor: [32, 18],
        });
        marker.setIcon(icon);
      }

      for (const place of PLACES) {
        const summary: MapPinSummary = { id: place.id, level: null, day: null };
        summaries.current.set(place.id, summary);
        const marker = leaflet
          .marker([place.latitude, place.longitude], {
            icon: leaflet.divIcon({
              className: "leaflet-div-icon agroclima-pin",
              html: pinHtml(null, null, false),
              iconSize: [64, 36],
              iconAnchor: [32, 18],
            }),
            keyboard: true,
            title: place.name,
          })
          .addTo(map);
        marker.on("click", () => {
          const current = summaries.current.get(place.id) ?? summary;
          onPickRef.current(place.id, current);
        });
        markers.current.set(place.id, marker);
      }

      void fetch("/api/risk/map")
        .then((response) => response.json())
        .then((body: { ok?: boolean; places?: MapPinSummary[] }) => {
          if (cancelled || !body.ok || !body.places) return;
          for (const pin of body.places) {
            summaries.current.set(pin.id, pin);
            paint(pin.id);
          }
        })
        .catch(() => undefined);
    });

    return () => {
      cancelled = true;
      map?.remove();
      markerMap.clear();
    };
  }, []);

  useEffect(() => {
    void import("leaflet").then((leaflet) => {
      for (const [id, marker] of markers.current) {
        const summary = summaries.current.get(id);
        if (!summary) continue;
        marker.setIcon(
          leaflet.divIcon({
            className: "leaflet-div-icon agroclima-pin",
            html: pinHtml(summary.level, summary.day, highlightId === id),
            iconSize: [64, 36],
            iconAnchor: [32, 18],
          }),
        );
      }
    });
  }, [highlightId]);

  return (
    <div
      id="mapa"
      ref={host}
      className="h-80 w-full overflow-hidden rounded-2xl"
      role="application"
      aria-label="Mapa de El Salvador. Toque un municipio."
      tabIndex={-1}
    />
  );
}
