"use client";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sub?: string;
  /** Number shown in the pin (itinerary order). Omit for small dots. */
  n?: number;
  tone?: "plan" | "option" | "home" | "visited";
}

function pin(p: MapPoint, active: boolean) {
  const colors = { plan: "#8b3d81", option: "#a99bb0", home: "#2b1430", visited: "#5b6f95" };
  const color = colors[p.tone ?? "plan"];
  if (p.n == null) {
    const size = active ? 18 : 12;
    return L.divIcon({
      className: "",
      html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }
  const s = active ? 38 : 32;
  return L.divIcon({
    className: "",
    html: `<div style="width:${s}px;height:${s}px;border-radius:999px 999px 999px 0;transform:rotate(-45deg);background:${color};border:2.5px solid #fff;box-shadow:0 6px 16px rgba(43,20,48,.35);display:grid;place-items:center"><span style="transform:rotate(45deg);color:#fff;font:700 13px/1 system-ui">${p.n}</span></div>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s],
    popupAnchor: [0, -s],
  });
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const key = points.map((p) => p.id).join("|");
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 14);
    else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export default function MapView({
  points,
  route,
  activeId,
  onSelect,
  className,
}: {
  points: MapPoint[];
  /** Draw lines between these points in order. */
  route?: [number, number][];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const center: [number, number] = points.length ? [points[0].lat, points[0].lng] : [39.5, -98.35];
  return (
    <MapContainer center={center} zoom={points.length ? 13 : 4} scrollWheelZoom className={className} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {route && route.length > 1 && <Polyline positions={route} pathOptions={{ color: "#8b3d81", weight: 3, dashArray: "6 8", opacity: 0.8 }} />}
      {points.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={pin(p, p.id === activeId)}
          zIndexOffset={p.n != null ? 1000 : 0}
          eventHandlers={{ click: () => onSelect?.(p.id) }}
        >
          <Popup>
            <strong>{p.label}</strong>
            {p.sub && <div style={{ color: "#827a89" }}>{p.sub}</div>}
          </Popup>
        </Marker>
      ))}
      <FitBounds points={points} />
    </MapContainer>
  );
}
