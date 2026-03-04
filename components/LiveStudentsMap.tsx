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

function FitToLocations({ locations }: { locations: LiveStudentLocation[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) return;

    if (locations.length === 1) {
      map.flyTo([locations[0].lat, locations[0].lng], 15, {
        animate: true,
        duration: 1.2,
      });
      return;
    }

    const bounds = L.latLngBounds(locations.map((loc) => [loc.lat, loc.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [locations, map]);

  return null;
}

function studentIcon(name: string) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return L.divIcon({
    className: "",
    html: `<div style="width:34px;height:34px;border-radius:9999px;background:linear-gradient(135deg,#22d3ee,#a855f7);color:#fff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px rgba(34,211,238,0.45);border:1px solid rgba(255,255,255,0.45);">${initial}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

export default function LiveStudentsMap({ locations }: LiveStudentsMapProps) {
  return (
    <div className="h-full w-full">
      <MapContainer center={[55.6761, 12.5683]} zoom={13} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitToLocations locations={locations} />

        {locations.map((loc) => (
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
