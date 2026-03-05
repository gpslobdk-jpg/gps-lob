"use client";

import "leaflet/dist/leaflet.css";

import { Crosshair, MapPin, Search } from "lucide-react";
import L from "leaflet";
import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

type MapCenter = {
  lat: number;
  lng: number;
};

export type SavedPin = {
  id: string;
  lat: number;
  lng: number;
  number: number;
};

type MapPickerProps = {
  center: MapCenter;
  pins: SavedPin[];
  onCenterChange?: (center: MapCenter) => void;
};

type SearchResult = {
  lat: string;
  lon: string;
  display_name: string;
};

function CenterReporter({
  onCenterChange,
}: {
  onCenterChange?: (center: MapCenter) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const report = () => {
      const current = map.getCenter();
      onCenterChange?.({ lat: current.lat, lng: current.lng });
    };

    report();
    map.on("moveend", report);

    return () => {
      map.off("moveend", report);
    };
  }, [map, onCenterChange]);

  return null;
}

function MapController({ centerCoords }: { centerCoords: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (centerCoords) {
      map.flyTo(centerCoords, 15, { animate: true, duration: 1.5 });
    }
  }, [centerCoords, map]);

  return null;
}

function numberedPinIcon(number: number) {
  return L.divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:9999px;background:linear-gradient(135deg,#22d3ee,#3b82f6);color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 14px rgba(34,211,238,0.55);border:1px solid rgba(255,255,255,0.35);">${number}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export default function MapPicker({ center, pins, onCenterChange }: MapPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [targetCoords, setTargetCoords] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&countrycodes=dk`
        );
        const data = await res.json();
        setSearchResults(data);
      } catch (error) {
        console.error("Søgefejl:", error);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl">
      <div className="absolute top-4 left-1/2 z-[1000] w-full max-w-[300px] -translate-x-1/2 px-4 sm:max-w-md">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-emerald-600">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Søg efter by eller skole..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-emerald-100 bg-white/90 py-3 pr-4 pl-10 text-sm text-emerald-950 shadow-lg backdrop-blur-md transition-all placeholder:text-emerald-700/50 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          {isSearching && (
            <div className="absolute inset-y-0 right-4 flex items-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          )}
        </div>

        {searchResults.length > 0 && (
          <ul className="absolute top-full right-4 left-4 mt-2 overflow-hidden rounded-xl border border-emerald-100 bg-white/95 shadow-2xl backdrop-blur-xl">
            {searchResults.map((result, idx) => (
              <li
                key={idx}
                onClick={() => {
                  setTargetCoords([parseFloat(result.lat), parseFloat(result.lon)]);
                  setSearchResults([]);
                  setSearchQuery("");
                }}
                className="flex cursor-pointer items-start gap-3 border-b border-emerald-100 px-4 py-3 transition-colors last:border-0 hover:bg-emerald-50"
              >
                <MapPin size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                <span className="line-clamp-2 text-sm text-emerald-900">{result.display_name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <MapContainer
        center={[center.lat, center.lng]}
        zoom={15}
        className="h-full w-full"
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CenterReporter onCenterChange={onCenterChange} />
        <MapController centerCoords={targetCoords} />

        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={numberedPinIcon(pin.number)}
          />
        ))}
      </MapContainer>

      <Crosshair className="absolute inset-0 m-auto z-[400] pointer-events-none h-8 w-8 text-cyan-200 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
    </div>
  );
}
