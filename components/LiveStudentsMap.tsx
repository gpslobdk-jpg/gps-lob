"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";

export type LiveStudentLocation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type LiveStudentsMapProps = {
  locations: LiveStudentLocation[];
};

function isValidCoord(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function FitToLocations({ locations }: { locations: LiveStudentLocation[] }) {
  const map = useMap();

  useEffect(() => {
    // Filter to only locations with valid coordinates before touching Leaflet.
    const valid = locations.filter((loc) => isValidCoord(loc.lat, loc.lng));
    if (valid.length === 0) return;

    try {
      if (!map || !map.getContainer()) return;

      if (valid.length === 1) {
        map.flyTo([valid[0].lat, valid[0].lng], 15, {
          animate: true,
          duration: 1.2,
        });
        return;
      }

      const bounds = L.latLngBounds(valid.map((loc) => [loc.lat, loc.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50] });
    } catch (err) {
      console.warn("LiveStudentsMap: failed to fit map to locations:", err);
    }
  }, [locations, map]);

  return null;
}

function studentIcon(name: string) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return L.divIcon({
    className: "",
    html: `<div style="width:34px;height:34px;border-radius:9999px;background:#f97316;color:#fff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.18);border:2px solid #fff;">${initial}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

export default function LiveStudentsMap({ locations }: LiveStudentsMapProps) {
  return (
    <div className="h-full w-full">
      <MapContainer center={[55.6761, 12.5683]} zoom={13} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        <FitToLocations locations={locations} />

        {locations.filter((loc) => isValidCoord(loc.lat, loc.lng)).map((loc) => (
          <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={studentIcon(loc.name)}>
            <Tooltip direction="top" offset={[0, -16]} opacity={1}>
              {loc.name}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
