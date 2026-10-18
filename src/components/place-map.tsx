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

const PIN_PX = 44;

const PIN_COLOR: Record<RiskLevel, string> = {
  alto: "#8A1C14",
  medio: "#8A6A00",
  bajo: "#1E5B2A",
};

const PIN_LETTER: Record<RiskLevel, string> = {
  alto: "A",
  medio: "M",
  bajo: "B",
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** "San Fernando: alto, viernes". The card keeps the full level word and day name. */
export function pinAriaLabel(name: string, level: RiskLevel | null, day: string | null): string {
  if (!level || !day) return name;
  return `${name}: ${level}, ${day.toLocaleLowerCase("es-SV")}`;
}

function pinHtml(name: string, level: RiskLevel | null, day: string | null, highlighted: boolean): string {
  const letter = level ? PIN_LETTER[level] : "·";
  const color = level ? PIN_COLOR[level] : "#57534e";
  const ring = highlighted ? "box-shadow:0 0 0 3px #111;" : "box-shadow:0 1px 2px rgba(0,0,0,.35);";
  return `<span role="img" aria-label="${escapeHtml(pinAriaLabel(name, level, day))}" style="display:flex;width:${PIN_PX}px;height:${PIN_PX}px;box-sizing:border-box;align-items:center;justify-content:center;border-radius:999px;background:${color};color:#fff;font:700 18px/1 ui-sans-serif,system-ui,sans-serif;${ring}">${letter}</span>`;
}

function pinIcon(
  leaflet: typeof import("leaflet"),
  name: string,
  summary: MapPinSummary,
  highlighted: boolean,
) {
  return leaflet.divIcon({
    className: "leaflet-div-icon agroclima-pin",
    html: pinHtml(name, summary.level, summary.day, highlighted),
    iconSize: [PIN_PX, PIN_PX],
    iconAnchor: [PIN_PX / 2, PIN_PX / 2],
  });
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
  const selectedRef = useRef<string | null>(null);

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
          minZoom: 6,
          maxZoom: 16,
        })
        .setView([13.8, -88.9], 8);
      const bounds = leaflet.latLngBounds(
        PLACES.map((place) => [place.latitude, place.longitude] as [number, number]),
      );
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
        const place = PLACES.find((item) => item.id === id);
        if (!marker || !summary || !place) return;
        const selected = selectedRef.current === id;
        const highlighted = selected || highlightRef.current === id;
        marker.setIcon(pinIcon(leaflet, place.name, summary, highlighted));
        marker.setZIndexOffset(selected ? 2000 : highlighted ? 1000 : 0);
        const icon = marker.getElement();
        if (!icon) return;
        icon.setAttribute("data-place-id", id);
        icon.setAttribute("role", "button");
        icon.setAttribute("aria-label", pinAriaLabel(place.name, summary.level, summary.day));
      }

      for (const place of PLACES) {
        const summary: MapPinSummary = { id: place.id, level: null, day: null };
        summaries.current.set(place.id, summary);
        const marker = leaflet
          .marker([place.latitude, place.longitude], {
            icon: pinIcon(leaflet, place.name, summary, false),
            keyboard: true,
            title: place.name,
          })
          .addTo(map);
        const icon = marker.getElement();
        icon?.setAttribute("data-place-id", place.id);
        icon?.setAttribute("role", "button");
        icon?.setAttribute("aria-label", place.name);
        marker.on("click", () => {
          selectedRef.current = place.id;
          paint(place.id);
          for (const otherId of markers.current.keys()) {
            if (otherId !== place.id) paint(otherId);
          }
          const current = summaries.current.get(place.id) ?? summary;
          onPickRef.current(place.id, current);
        });
        markers.current.set(place.id, marker);
      }

      map.invalidateSize();
      map.fitBounds(bounds, { padding: [22, 18] });
      map.setMinZoom(map.getZoom());

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
        const place = PLACES.find((item) => item.id === id);
        if (!summary || !place) continue;
        const selected = selectedRef.current === id;
        const highlighted = selected || highlightId === id;
        marker.setIcon(pinIcon(leaflet, place.name, summary, highlighted));
        marker.setZIndexOffset(selected ? 2000 : highlighted ? 1000 : 0);
        const icon = marker.getElement();
        icon?.setAttribute("data-place-id", id);
        icon?.setAttribute("role", "button");
        icon?.setAttribute("aria-label", pinAriaLabel(place.name, summary.level, summary.day));
      }
    });
  }, [highlightId]);

  return (
    <div
      id="mapa"
      ref={host}
      className="h-80 min-h-[20rem] w-full overflow-hidden rounded-2xl"
      role="application"
      aria-label="Mapa de El Salvador. Toque un municipio."
      tabIndex={-1}
    />
  );
}
