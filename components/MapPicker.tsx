"use client";

import "leaflet/dist/leaflet.css";

import { Crosshair, MapPin, Search } from "lucide-react";
import L from "leaflet";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Circle, LayersControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { createZoneKrigMarkerIcon } from "@/components/play/zoneMarkerHelper";

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

export type SavedZone = {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  label?: string;
};

type MapPickerProps = {
  center: MapCenter;
  pins: SavedPin[];
  zones?: SavedZone[];
  mapMode?: "default" | "zone-krig";
  onCenterChange?: (center: MapCenter) => void;
  onMapClick?: (center: MapCenter) => void;
  onPinClick?: (pinId: SavedPin["id"]) => void;
  onPinDragEnd?: (pinId: SavedPin["id"], center: MapCenter) => void;
  activePinLabel?: string | null;
  isAwaitingMapClick?: boolean;
  autoLocateOnLoad?: boolean;
};

type FocusRequest = {
  id: number;
  coords: [number, number];
  zoom?: number;
};

type GeolocationState = "idle" | "locating" | "unsupported" | "permission_denied" | "position_unavailable" | "timeout";

const DEFAULT_SEARCH_ZOOM = 15;
const DEFAULT_GEOLOCATION_ZOOM = 17;
const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const SATELLITE_TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_ATTRIBUTION = "Tiles &copy; Esri - Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";
const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10000,
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
      try {
        const current = map.getCenter();
        onCenterChange?.({ lat: current.lat, lng: current.lng });
      } catch (err) {
        // map may have been destroyed/unmounted
        console.warn("CenterReporter: failed to read center:", err);
      }
    };

    try {
      if (!map || !map.getContainer()) return;
      report();
      map.on("moveend", report);
    } catch (err) {
      console.warn("CenterReporter: failed to attach moveend:", err);
    }

    return () => {
      try {
        if (map && typeof map.off === "function") map.off("moveend", report);
      } catch (err) {
        // ignore
      }
    };
  }, [map, onCenterChange]);

  return null;
}

function FocusController({ request }: { request: FocusRequest | null }) {
  const map = useMap();

  useEffect(() => {
    if (!request) return;

    try {
      if (!map || !map.getContainer()) return;
      const coords = request.coords;
      if (!Array.isArray(coords) || coords.length < 2) return;
      const [lat, lng] = coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      map.flyTo([lat, lng], request.zoom ?? map.getZoom(), { animate: true, duration: 1.2 });
    } catch (err) {
      console.warn("FocusController: failed to flyTo:", err);
    }
  }, [map, request]);

  return null;
}

function centersMatch(a: MapCenter, b: MapCenter, tolerance = 0.00005) {
  return Math.abs(a.lat - b.lat) <= tolerance && Math.abs(a.lng - b.lng) <= tolerance;
}

function ExternalCenterController({ center }: { center: MapCenter }) {
  const map = useMap();

  useEffect(() => {
    try {
      if (!map || !map.getContainer()) return;
      if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return;
      const current = map.getCenter();
      if (centersMatch({ lat: current.lat, lng: current.lng }, center)) {
        return;
      }

      map.flyTo([center.lat, center.lng], map.getZoom(), { animate: true, duration: 1.2 });
    } catch (err) {
      console.warn("ExternalCenterController: failed to flyTo:", err);
    }
  }, [center, map]);

  return null;
}

function MapClickReporter({
  onMapClick,
}: {
  onMapClick?: (center: MapCenter) => void;
}) {
  useMapEvents({
    click(event) {
      onMapClick?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return null;
}

function numberedPinIcon(number: number, isDraggable = false) {
  return L.divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:9999px;background:linear-gradient(135deg,#22d3ee,#3b82f6);color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 14px rgba(34,211,238,0.55);border:1px solid rgba(255,255,255,0.35);cursor:${isDraggable ? "grab" : "pointer"};touch-action:none;">${number}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export default function MapPicker({
  center,
  pins,
  zones,
  mapMode = "default",
  onCenterChange,
  onMapClick,
  onPinClick,
  onPinDragEnd,
  activePinLabel,
  isAwaitingMapClick = false,
  autoLocateOnLoad = true,
}: MapPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [geolocationState, setGeolocationState] = useState<GeolocationState>("idle");
  const focusRequestIdRef = useRef(0);
  const initialCenterRef = useRef<MapCenter>(center);
  const hasAutoLocateAttemptedRef = useRef(false);
  const hasExternalCenterOverrideRef = useRef(false);
  const geolocationRequestIdRef = useRef(0);
  const canDragPins = typeof onPinDragEnd === "function";
  const showPinDragHint = canDragPins && pins.length > 0 && !isAwaitingMapClick;

  const queueFocus = useCallback((coords: [number, number], zoom?: number) => {
    focusRequestIdRef.current += 1;
    setFocusRequest({ id: focusRequestIdRef.current, coords, zoom });
  }, []);

  const locateUser = useCallback(
    (source: "auto" | "manual") => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setGeolocationState("unsupported");
        return;
      }

      if (source === "manual") {
        hasExternalCenterOverrideRef.current = true;
      }

      geolocationRequestIdRef.current += 1;
      const requestId = geolocationRequestIdRef.current;
      setGeolocationState("locating");

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (geolocationRequestIdRef.current !== requestId) return;

          const nextCenter: MapCenter = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          if (source === "auto" && hasExternalCenterOverrideRef.current) {
            setGeolocationState("idle");
            return;
          }

          setGeolocationState("idle");

          if (source === "manual" && onCenterChange) {
            onCenterChange(nextCenter);
            return;
          }

          queueFocus([nextCenter.lat, nextCenter.lng], DEFAULT_GEOLOCATION_ZOOM);
        },
        (error) => {
          if (geolocationRequestIdRef.current !== requestId) return;

          if (error.code === error.PERMISSION_DENIED || error.code === 1) {
            setGeolocationState("permission_denied");
            return;
          }

          if (error.code === error.POSITION_UNAVAILABLE || error.code === 2) {
            setGeolocationState("position_unavailable");
            return;
          }

          setGeolocationState("timeout");
        },
        GEOLOCATION_OPTIONS
      );
    },
    [onCenterChange, queueFocus]
  );

  useEffect(() => {
    if (hasAutoLocateAttemptedRef.current) {
      return;
    }

    if (!autoLocateOnLoad) {
      hasAutoLocateAttemptedRef.current = true;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      hasAutoLocateAttemptedRef.current = true;

      if (hasExternalCenterOverrideRef.current) {
        return;
      }

      locateUser("auto");
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoLocateOnLoad, locateUser]);

  useEffect(() => {
    if (hasAutoLocateAttemptedRef.current) {
      return;
    }

    if (!centersMatch(center, initialCenterRef.current)) {
      hasExternalCenterOverrideRef.current = true;
    }
  }, [center]);

  const geolocationMessage =
    geolocationState === "permission_denied"
      ? "Lokation er blokeret i browseren. Brug kortet manuelt eller tillad lokation og prøv igen."
      : geolocationState === "position_unavailable"
        ? "Vi kunne ikke finde din placering lige nu. Prøv igen om et øjeblik."
        : geolocationState === "timeout"
          ? "Lokationen tog for lang tid. Prøv igen."
          : geolocationState === "unsupported"
            ? "Denne browser understøtter ikke lokation i builder-kortet."
            : null;

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
    <div className={`relative h-full w-full overflow-hidden rounded-3xl ${isAwaitingMapClick ? "cursor-crosshair" : ""}`}>
      <div className="absolute top-4 left-1/2 z-1000 w-full max-w-75 -translate-x-1/2 px-4 sm:max-w-md">
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
                  queueFocus([parseFloat(result.lat), parseFloat(result.lon)], DEFAULT_SEARCH_ZOOM);
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

      <div className="absolute top-4 right-4 z-1000 flex flex-col items-end gap-2 px-4 sm:px-0">
        <button
          type="button"
          onClick={() => locateUser("manual")}
          className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/35 bg-slate-950/82 px-4 py-2.5 text-sm font-semibold text-cyan-50 shadow-[0_16px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl transition hover:bg-slate-900/90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={geolocationState === "locating"}
          aria-label="Find min placering på kortet"
        >
          <Crosshair className={`h-4 w-4 ${geolocationState === "locating" ? "animate-pulse" : ""}`} />
          <span>{geolocationState === "locating" ? "Finder dig..." : "Find mig"}</span>
        </button>

        {geolocationMessage ? (
          <div className="max-w-60 rounded-2xl border border-cyan-300/25 bg-slate-950/82 px-3 py-2 text-xs leading-5 text-cyan-50 shadow-[0_16px_32px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            {geolocationMessage}
          </div>
        ) : null}
      </div>

      <MapContainer
        center={[center.lat, center.lng]}
        zoom={15}
        className={`h-full w-full ${isAwaitingMapClick ? "cursor-crosshair" : ""}`}
        zoomControl
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Standardkort">
            <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellit">
            <TileLayer attribution={SATELLITE_ATTRIBUTION} url={SATELLITE_TILE_URL} />
          </LayersControl.BaseLayer>
        </LayersControl>
        <CenterReporter onCenterChange={onCenterChange} />
        <ExternalCenterController center={center} />
        <FocusController request={focusRequest} />
        <MapClickReporter onMapClick={onMapClick} />

        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={numberedPinIcon(pin.number, canDragPins)}
            draggable={canDragPins}
            autoPan={canDragPins}
            title={canDragPins ? `Post ${pin.number}. Træk for at flytte eller klik for at åbne.` : onPinClick ? `Post ${pin.number}. Klik for at hoppe til posten.` : `Post ${pin.number}`}
            eventHandlers={{
              click: () => {
                onPinClick?.(pin.id);
              },
              ...(canDragPins
                ? {
                    dragend: (event: L.LeafletEvent) => {
                      const nextLatLng = (event.target as L.Marker).getLatLng();
                      onPinDragEnd?.(pin.id, { lat: nextLatLng.lat, lng: nextLatLng.lng });
                    },
                  }
                : {}),
            }}
          />
        ))}

        {zones?.map((zone, index) => {
          const zoneCircle = (
            <Circle
              key={`${zone.id}-circle`}
              center={[zone.lat, zone.lng]}
              radius={zone.radius}
              pathOptions={{
                color: "#22d3ee",
                fillColor: "#22d3ee",
                fillOpacity: 0.18,
                weight: 2,
              }}
            />
          );

          if (mapMode !== "zone-krig") {
            return zoneCircle;
          }

          return (
            <Fragment key={zone.id}>
              {zoneCircle}
              <Marker
                position={[zone.lat, zone.lng]}
                icon={createZoneKrigMarkerIcon({
                  state: "neutral",
                  label: zone.label ?? `Zone ${index + 1}`,
                })}
                interactive={false}
              />
            </Fragment>
          );
        })}
      </MapContainer>

      {showPinDragHint ? (
        <div className="pointer-events-none absolute right-4 bottom-4 left-4 z-1000 rounded-2xl border border-cyan-300/35 bg-slate-950/82 px-4 py-3 text-sm font-medium text-cyan-50 shadow-[0_16px_32px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:left-auto sm:max-w-80">
          Tip: Træk i post-ikonet for at flytte det, eller klik på det for at hoppe til posten.
        </div>
      ) : null}

      {activePinLabel ? (
        <div className="pointer-events-none absolute right-4 bottom-4 left-4 z-1000 rounded-2xl border border-cyan-300/45 bg-slate-950/82 px-4 py-3 text-sm font-semibold text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.2)] backdrop-blur-xl">
          {activePinLabel}
        </div>
      ) : null}

      <Crosshair className="absolute inset-0 m-auto z-400 pointer-events-none h-8 w-8 text-cyan-200 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
    </div>
  );
}
