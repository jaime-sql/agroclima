"use client";

import { useEffect, useRef } from "react";
import {
  EMPTY_PIN_COLOR,
  LEVEL_COLOR,
  LEVEL_LETTER,
  PIN_VISIBLE_PX,
  TAP_PX,
  clusterBubblePx,
  clusterPlaces,
  closestMetres,
  pixelsForMetres,
  shouldSpiderfy,
  spiderfyOffsets,
  worstLevel,
} from "@/lib/map/cluster";
import { PLACES } from "@/lib/places";
import type { RiskLevel } from "@/lib/risk/types";
import "leaflet/dist/leaflet.css";

export type MapPinSummary = {
  id: string;
  level: RiskLevel | null;
  day: string | null;
};

const PIN_COLOR: Record<RiskLevel, string> = LEVEL_COLOR;
const PIN_LETTER: Record<RiskLevel, string> = LEVEL_LETTER;

/** "San Fernando: alto, viernes". The card keeps the full level word and day name. */
export function pinAriaLabel(name: string, level: RiskLevel | null, day: string | null): string {
  if (!level || !day) return name;
  return `${name}: ${level}, ${day.toLocaleLowerCase("es-SV")}`;
}

function pinHtml(name: string, level: RiskLevel | null, day: string | null, highlighted: boolean): string {
  const letter = level ? PIN_LETTER[level] : "·";
  const color = level ? PIN_COLOR[level] : EMPTY_PIN_COLOR;
  const ring = highlighted ? "box-shadow:0 0 0 3px #111;" : "box-shadow:0 1px 2px rgba(0,0,0,.35);";
  return `<span aria-hidden="true" style="display:flex;width:${TAP_PX}px;height:${TAP_PX}px;align-items:center;justify-content:center;"><span style="display:flex;width:${PIN_VISIBLE_PX}px;height:${PIN_VISIBLE_PX}px;box-sizing:border-box;align-items:center;justify-content:center;border-radius:999px;background:${color};color:#fff;font:700 16px/1 ui-sans-serif,system-ui,sans-serif;${ring}">${letter}</span></span>`;
}

function clusterHtml(count: number, level: RiskLevel | null, highlighted: boolean): string {
  const letter = level ? PIN_LETTER[level] : "·";
  const color = level ? PIN_COLOR[level] : EMPTY_PIN_COLOR;
  const size = clusterBubblePx(count);
  const ring = highlighted ? "box-shadow:0 0 0 3px #111;" : "box-shadow:0 1px 2px rgba(0,0,0,.35);";
  return `<span aria-hidden="true" style="display:flex;width:${size}px;height:${size}px;box-sizing:border-box;align-items:center;justify-content:center;border-radius:999px;background:${color};color:#fff;font:700 15px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.02em;${ring}">${count} ${letter}</span>`;
}

function clusterLabel(count: number, level: RiskLevel | null): string {
  const noun = count === 1 ? "municipio" : "municipios";
  if (!level) return `${count} ${noun}`;
  return `${count} ${noun}, peor nivel ${level}`;
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
  const drawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    highlightRef.current = highlightId;
    drawRef.current?.();
  }, [highlightId]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const markerMap = markers.current;
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    let spiderIds: string[] = [];

    void import("leaflet").then((leaflet) => {
      if (cancelled || !element) return;
      const hostEl = element;
      map = leaflet
        .map(element, {
          maxBounds: leaflet.latLngBounds([12.7, -90.6], [14.7, -87.2]),
          maxBoundsViscosity: 1,
          minZoom: 6,
          maxZoom: 16,
        })
        .setView([13.8, -88.9], 8);
      (hostEl as HTMLDivElement & { mapView?: import("leaflet").Map }).mapView = map;
      const country = leaflet.latLngBounds(
        PLACES.map((place) => [place.latitude, place.longitude] as [number, number]),
      );
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 16,
        })
        .addTo(map);
      const layer = leaflet.layerGroup().addTo(map);

      function placeSummary(id: string): MapPinSummary {
        return summaries.current.get(id) ?? { id, level: null, day: null };
      }

      function markerElement(
        marker: import("leaflet").Marker,
        attributes: Record<string, string>,
      ) {
        const icon = marker.getElement();
        if (!icon) return;
        icon.classList.add("leaflet-div-icon");
        for (const [key, value] of Object.entries(attributes)) icon.setAttribute(key, value);
      }

      function addPin(
        place: (typeof PLACES)[number],
        latlng: import("leaflet").LatLngExpression,
        spider: boolean,
      ) {
        if (!map) return;
        const summary = placeSummary(place.id);
        const selected = selectedRef.current === place.id;
        const highlighted = selected || highlightRef.current === place.id;
        const marker = leaflet
          .marker(latlng, {
            icon: leaflet.divIcon({
              className: "leaflet-div-icon agroclima-pin",
              html: pinHtml(place.name, summary.level, summary.day, highlighted),
              iconSize: [TAP_PX, TAP_PX],
              iconAnchor: [TAP_PX / 2, TAP_PX / 2],
            }),
            keyboard: true,
            title: place.name,
            zIndexOffset: selected ? 2000 : highlighted ? 1000 : spider ? 500 : 0,
          })
          .addTo(layer);
        markerElement(marker, {
          "data-place-id": place.id,
          role: "button",
          "aria-label": pinAriaLabel(place.name, summary.level, summary.day),
        });
        marker.on("click", (event) => {
          leaflet.DomEvent.stopPropagation(event);
          selectedRef.current = place.id;
          spiderIds = [];
          draw();
          onPickRef.current(place.id, placeSummary(place.id));
        });
        markers.current.set(place.id, marker);
      }

      function draw() {
        if (!map) return;
        layer.clearLayers();
        markers.current.clear();
        const zoom = map.getZoom();
        hostEl.dataset.zoom = String(zoom);
        const spider = new Set(spiderIds);
        const open = PLACES.filter((place) => !spider.has(place.id));
        const groups = clusterPlaces(open, zoom);
        for (const group of groups) {
          if (group.length === 1) {
            const place = PLACES.find((item) => item.id === group[0].id);
            if (place) addPin(place, [place.latitude, place.longitude], false);
            continue;
          }
          const members = group.flatMap((item) => {
            const place = PLACES.find((candidate) => candidate.id === item.id);
            return place ? [place] : [];
          });
          const level = worstLevel(members.map((place) => placeSummary(place.id).level));
          const highlighted = members.some(
            (place) => place.id === selectedRef.current || place.id === highlightRef.current,
          );
          const size = clusterBubblePx(members.length);
          const latitude = members.reduce((sum, place) => sum + place.latitude, 0) / members.length;
          const longitude = members.reduce((sum, place) => sum + place.longitude, 0) / members.length;
          const marker = leaflet
            .marker([latitude, longitude], {
              icon: leaflet.divIcon({
                className: "leaflet-div-icon agroclima-cluster",
                html: clusterHtml(members.length, level, highlighted),
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
              }),
              keyboard: true,
              title: clusterLabel(members.length, level),
              zIndexOffset: highlighted ? 1000 : 0,
            })
            .addTo(layer);
          markerElement(marker, {
            "data-place-ids": members.map((place) => place.id).join(","),
            "data-count": String(members.length),
            "data-level": level ?? "",
            "data-letter": level ? PIN_LETTER[level] : "",
            role: "button",
            "aria-label": clusterLabel(members.length, level),
          });
          marker.on("click", (event) => {
            if (!map) return;
            leaflet.DomEvent.stopPropagation(event);
            const latitudeMid =
              members.reduce((sum, place) => sum + place.latitude, 0) / members.length;
            const gap = pixelsForMetres(closestMetres(members), latitudeMid, map.getMaxZoom());
            const openSpider = () => {
              spiderIds = members.map((place) => place.id);
              draw();
            };
            if (shouldSpiderfy(gap)) {
              openSpider();
              return;
            }
            spiderIds = [];
            const before = map.getZoom();
            map.fitBounds(
              leaflet.latLngBounds(
                members.map((place) => [place.latitude, place.longitude] as [number, number]),
              ),
              { padding: [24, 24], maxZoom: map.getMaxZoom(), animate: false },
            );
            if (map.getZoom() === before) openSpider();
          });
        }

        if (spiderIds.length > 0) {
          const members = spiderIds.flatMap((id) => {
            const place = PLACES.find((candidate) => candidate.id === id);
            return place ? [place] : [];
          });
          const latitude = members.reduce((sum, place) => sum + place.latitude, 0) / members.length;
          const longitude = members.reduce((sum, place) => sum + place.longitude, 0) / members.length;
          const origin = map.latLngToLayerPoint([latitude, longitude]);
          const offsets = spiderfyOffsets(members.length);
          members.forEach((place, index) => {
            const offset = offsets[index] ?? { x: 0, y: 0 };
            const latlng = map!.layerPointToLatLng(origin.add([offset.x, offset.y]));
            addPin(place, latlng, true);
          });
        }
      }

      drawRef.current = draw;
      map.on("zoomend", () => {
        if (map && spiderIds.length > 0 && map.getZoom() < map.getMaxZoom()) spiderIds = [];
        draw();
      });
      map.invalidateSize();
      map.fitBounds(country, { padding: [24, 24], animate: false });
      map.setMinZoom(map.getZoom());
      draw();

      void fetch("/api/risk/map")
        .then((response) => response.json())
        .then((body: { ok?: boolean; places?: MapPinSummary[] }) => {
          if (cancelled || !body.ok || !body.places) return;
          for (const pin of body.places) summaries.current.set(pin.id, pin);
          draw();
        })
        .catch(() => undefined);
    });

    return () => {
      cancelled = true;
      drawRef.current = null;
      (element as HTMLDivElement & { mapView?: import("leaflet").Map }).mapView = undefined;
      map?.remove();
      markerMap.clear();
    };
  }, []);

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
