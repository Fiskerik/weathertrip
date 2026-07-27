"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import type { Coordinates, Recommendation } from "@weathertrip/shared";

type StopMarker = {
  label: string;
  coordinates: Coordinates;
  kind: "start" | "stop" | "destination";
  detail: string;
  segmentId?: string;
  segmentIndex?: number;
};

export default function RouteMap({
  recommendation,
  activeSegmentIndex = 0,
  onSelectSegment
}: {
  recommendation: Recommendation;
  activeSegmentIndex?: number;
  onSelectSegment?: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const routePath = useMemo(() => {
    const path = recommendation.routeMetrics.routePath;
    if (path.length >= 2) return path;
    return [
      { latitude: 59.3293, longitude: 18.0686 },
      recommendation.destination.coordinates
    ];
  }, [recommendation]);

  const stops = useMemo<StopMarker[]>(() => {
    const start = routePath[0] ?? { latitude: 59.3293, longitude: 18.0686 };
    const destination = routePath[routePath.length - 1] ?? recommendation.destination.coordinates;
    const itineraryStops = recommendation.itinerary.map((segment, index) => ({
      label: `Day ${segment.day}: ${segment.stopName}`,
      coordinates: segment.stopCoordinates,
      kind: "stop" as const,
      detail: segment.stopReason,
      segmentId: getItinerarySegmentId(index),
      segmentIndex: index
    }));
    const destinationSegmentId = getItinerarySegmentId(Math.max(0, recommendation.itinerary.length - 1));

    return [
      {
        label: "Start",
        coordinates: start,
        kind: "start",
        detail: "Trip departure point"
      },
      ...itineraryStops,
      {
        label: recommendation.destination.name,
        coordinates: destination,
        kind: "destination",
        detail: `${recommendation.routeMetrics.distanceKm} km total route`,
        segmentId: destinationSegmentId
      }
    ];
  }, [recommendation, routePath]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        zoomControl: false,
        scrollWheelZoom: false
      });
      L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(mapRef.current);
    }

    if (layerRef.current) {
      layerRef.current.clearLayers();
    } else {
      layerRef.current = L.layerGroup().addTo(mapRef.current);
    }

    const latLngs = routePath.map((point) => L.latLng(point.latitude, point.longitude));
    L.polyline(latLngs, {
      color: "#1f7a5a",
      opacity: 0.92,
      weight: 5,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(layerRef.current);

    const highlightedLeg = getSegmentLegPath(recommendation, routePath, activeSegmentIndex);
    if (highlightedLeg.length >= 2) {
      L.polyline(highlightedLeg.map((point) => L.latLng(point.latitude, point.longitude)), {
        color: "#c75f45",
        opacity: 0.96,
        weight: 8,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(layerRef.current);
    }

    stops.forEach((stop, index) => {
      const marker = L.marker([stop.coordinates.latitude, stop.coordinates.longitude], {
        icon: L.divIcon({
          className: `routeMarker routeMarker-${stop.kind}`,
          html: stop.kind === "stop" ? String(index) : stop.kind === "start" ? "S" : "D",
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      });
      marker.bindPopup(`<strong>${escapeHtml(stop.label)}</strong><br>${escapeHtml(stop.detail)}`);
      if (stop.segmentId) {
        marker.on("click", () => {
          if (typeof stop.segmentIndex === "number") {
            onSelectSegment?.(stop.segmentIndex);
          }
          scrollToItinerarySegment(stop.segmentId!);
        });
      }
      marker.addTo(layerRef.current!);
    });

    const bounds = L.latLngBounds(latLngs);
    mapRef.current.fitBounds(bounds.pad(0.18), { animate: false });
    mapRef.current.invalidateSize();
  }, [activeSegmentIndex, onSelectSegment, recommendation, routePath, stops]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  return (
    <div className="routeMapShell">
      <div className="routeMap" ref={containerRef} aria-label="Suggested trip route map" />
      <div className="mapLegend">
        <span><i className="legendStart" /> Start</span>
        <span><i className="legendStop" /> Stop</span>
        <span><i className="legendDestination" /> Destination</span>
      </div>
    </div>
  );
}

function getSegmentLegPath(
  recommendation: Recommendation,
  routePath: Coordinates[],
  segmentIndex: number
): Coordinates[] {
  const segment = recommendation.itinerary[segmentIndex];
  if (!segment) return [];

  const previousStop = segmentIndex === 0
    ? routePath[0]
    : recommendation.itinerary[segmentIndex - 1]?.stopCoordinates;
  const start = segment.startCoordinates ?? previousStop ?? routePath[0];
  const end = segment.stopCoordinates;
  if (!start || !end) return [];

  const startIndex = nearestRouteIndex(start, routePath);
  const endIndex = nearestRouteIndex(end, routePath);
  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);
  const routeSlice = routePath.slice(from, to + 1);
  return startIndex <= endIndex
    ? [start, ...routeSlice, end]
    : [start, ...routeSlice.reverse(), end];
}

function nearestRouteIndex(point: Coordinates, routePath: Coordinates[]): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  routePath.forEach((routePoint, index) => {
    const distance = (point.latitude - routePoint.latitude) ** 2 + (point.longitude - routePoint.longitude) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function scrollToItinerarySegment(segmentId: string): void {
  const element = document.getElementById(segmentId);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
  element.classList.add("itineraryCardFocus");
  window.setTimeout(() => element.classList.remove("itineraryCardFocus"), 1800);
}

function getItinerarySegmentId(index: number): string {
  return `itinerary-segment-${index}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}
