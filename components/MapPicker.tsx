"use client";

import "leaflet/dist/leaflet.css";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronUp, Crosshair, Layers, MapPin, Search } from "lucide-react";
import L from "leaflet";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { createZoneKrigMarkerIcon } from "@/components/play/zoneMarkerHelper";
import { findOverlappingPinGroups } from "@/utils/pinProximity";

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

type BaseLayerId = "standard" | "satellite";

type BaseLayerOption = {
  id: BaseLayerId;
  label: string;
  description: string;
  url: string;
  attribution: string;
  previewBackground: string;
  previewAccentClassName: string;
};

const DEFAULT_SEARCH_ZOOM = 15;
const DEFAULT_GEOLOCATION_ZOOM = 17;
const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const SATELLITE_TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_ATTRIBUTION = "Tiles &copy; Esri - Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";
const MAP_LAYER_OPTIONS: BaseLayerOption[] = [
  {
    id: "standard",
    label: "Standardkort",
    description: "Klart kort med veje og byer",
    url: OSM_TILE_URL,
    attribution: OSM_ATTRIBUTION,
    previewBackground: "linear-gradient(135deg, rgba(248, 250, 252, 0.98), rgba(226, 232, 240, 0.92))",
    previewAccentClassName: "bg-cyan-400/85",
  },
  {
    id: "satellite",
    label: "Satellit",
    description: "Fotolag med detaljer fra luften",
    url: SATELLITE_TILE_URL,
    attribution: SATELLITE_ATTRIBUTION,
    previewBackground: "linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(51, 65, 85, 0.92))",
    previewAccentClassName: "bg-emerald-400/85",
  },
];
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

// Helper functions for coordinate validation and normalization
function toFiniteNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (s === "") return null;
    // Accept only full numeric strings (integers, decimals, scientific)
    const floatRe = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
    if (!floatRe.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function normalizeLatLng(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const nLat = toFiniteNumber(lat);
  const nLng = toFiniteNumber(lng);
  if (nLat === null || nLng === null) return null;
  if (nLat < -90 || nLat > 90) return null;
  if (nLng < -180 || nLng > 180) return null;
  return { lat: nLat, lng: nLng };
}

function isValidLatLngPair(lat: unknown, lng: unknown): boolean {
  return normalizeLatLng(lat, lng) !== null;
}

const FALLBACK_CENTER = { lat: 55.6761, lng: 12.5683 }; // Copenhagen fallback

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
        // Guard: only propagate if Leaflet gave us finite, in-range coordinates.
        // map.getCenter() can return NaN when the map container has zero size or
        // is not yet laid out (e.g. hidden <aside> on mobile). Passing NaN to
        // parent state would later reach assignPinFromCenter and corrupt question
        // coordinates, or cause "Invalid LatLng object: (NaN, NaN)" in Leaflet.
        const normalized = normalizeLatLng(current.lat, current.lng);
        if (normalized) {
          onCenterChange?.({ lat: normalized.lat, lng: normalized.lng });
        }
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
      const [rawLat, rawLng] = coords;
      const normalized = normalizeLatLng(rawLat, rawLng);
      if (!normalized) return;
      map.flyTo([normalized.lat, normalized.lng], request.zoom ?? map.getZoom(), { animate: true, duration: 1.2 });
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
      const normalized = normalizeLatLng(center?.lat, center?.lng);
      if (!normalized) return;
      const current = map.getCenter();
      if (centersMatch({ lat: current.lat, lng: current.lng }, normalized)) {
        return;
      }

      map.flyTo([normalized.lat, normalized.lng], map.getZoom(), { animate: true, duration: 1.2 });
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

function LayerPanelCloser({ onClose }: { onClose: () => void }) {
  const map = useMap();

  useEffect(() => {
    const handleMapClick = () => {
      onClose();
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, [map, onClose]);

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
  const [selectedBaseLayerId, setSelectedBaseLayerId] = useState<BaseLayerId>("standard");
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const focusRequestIdRef = useRef(0);
  const initialCenterRef = useRef<MapCenter>(center);
  const hasAutoLocateAttemptedRef = useRef(false);
  const hasExternalCenterOverrideRef = useRef(false);
  const geolocationRequestIdRef = useRef(0);
  const canDragPins = typeof onPinDragEnd === "function";
  const showPinDragHint = canDragPins && pins.length > 0 && !isAwaitingMapClick;
  const activeBaseLayer = MAP_LAYER_OPTIONS.find((layer) => layer.id === selectedBaseLayerId) ?? MAP_LAYER_OPTIONS[0];

  // Detect pins that are stacked on top of each other (within PIN_PROXIMITY_BLOCK_METERS).
  // When stacking is detected the warning banner takes precedence over the drag hint.
  const hasStackedPins = useMemo(() => {
    const pinsToCheck = pins.map((pin, i) => ({
      id: pin.id,
      number: i + 1,
      lat: pin.lat,
      lng: pin.lng,
    }));
    return findOverlappingPinGroups(pinsToCheck).length > 0;
  }, [pins]);

  const queueFocus = useCallback((coords: [number, number], zoom?: number) => {
    focusRequestIdRef.current += 1;
    setFocusRequest({ id: focusRequestIdRef.current, coords, zoom });
  }, []);

  // Ensure we always pass a safe center into Leaflet
  const safeCenter = normalizeLatLng(center?.lat, center?.lng) ?? FALLBACK_CENTER;

  const closeLayerPanel = useCallback(() => {
    setIsLayerPanelOpen(false);
  }, []);

  const selectBaseLayer = useCallback((layerId: BaseLayerId) => {
    setSelectedBaseLayerId(layerId);
    closeLayerPanel();
  }, [closeLayerPanel]);

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

          const normalized = normalizeLatLng(position.coords.latitude, position.coords.longitude);

          // Always stop locating state even if coords invalid
          if (geolocationRequestIdRef.current !== requestId) {
            setGeolocationState("idle");
            return;
          }

          if (!normalized) {
            setGeolocationState("idle");
            return; // invalid coords -> skip
          }

          const nextCenter: MapCenter = { lat: normalized.lat, lng: normalized.lng };

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

      <div className="pointer-events-none absolute bottom-4 left-4 z-1000 flex flex-col items-start gap-3">
        <div className="pointer-events-auto relative">
          <AnimatePresence>
            {isLayerPanelOpen ? (
              <motion.div
                id="map-layer-panel"
                key="map-layer-panel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-0 mb-3 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[20px] border border-white/10 bg-slate-950/92 p-3 shadow-[0_20px_45px_rgba(0,0,0,0.28)] backdrop-blur-xl"
              >
                <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/60">
                  Vælg korttype
                </div>

                <div className="space-y-2">
                  {MAP_LAYER_OPTIONS.map((layer) => {
                    const isActive = layer.id === selectedBaseLayerId;

                    return (
                      <button
                        key={layer.id}
                        type="button"
                        onClick={() => selectBaseLayer(layer.id)}
                        aria-pressed={isActive}
                        className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                          isActive
                            ? "border-emerald-300/35 bg-emerald-500/14 text-white shadow-[0_0_0_1px_rgba(110,231,183,0.12)]"
                            : "border-white/10 bg-white/5 text-slate-100/90 hover:border-white/15 hover:bg-white/10"
                        }`}
                      >
                        <div
                          className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border ${
                            isActive ? "border-emerald-200/60" : "border-white/10"
                          }`}
                          style={{ backgroundImage: layer.previewBackground }}
                        >
                          <div
                            className="absolute inset-0 opacity-70"
                            style={{
                              backgroundImage:
                                "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)",
                              backgroundSize: "11px 11px",
                            }}
                          />
                          <div className={`absolute right-1 top-1 h-2.5 w-2.5 rounded-full ${layer.previewAccentClassName}`} />
                          <div className={`absolute inset-x-2 bottom-2 h-1.5 rounded-full ${isActive ? "bg-emerald-300" : "bg-white/20"}`} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`truncate text-sm ${isActive ? "font-bold" : "font-semibold"}`}>{layer.label}</span>
                            {isActive ? (
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-200">
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            ) : null}
                          </div>
                          <p className={`mt-0.5 text-xs leading-5 ${isActive ? "text-white/80" : "text-slate-300/70"}`}>
                            {layer.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setIsLayerPanelOpen((open) => !open)}
            className="inline-flex min-h-12 items-center gap-3 rounded-[18px] border border-cyan-300/35 bg-slate-950/82 px-4 py-3 text-left text-cyan-50 shadow-[0_16px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl transition hover:bg-slate-900/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            aria-expanded={isLayerPanelOpen}
            aria-controls="map-layer-panel"
            aria-label="Vælg korttype"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-100 shadow-inner shadow-cyan-950/20">
              <Layers className="h-4 w-4" />
            </span>

            <span className="min-w-0 flex flex-col items-start leading-tight">
              <span className="text-sm font-semibold">Kortlag</span>
              <span className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-50/68">
                {activeBaseLayer.label}
              </span>
            </span>

            <ChevronUp className={`ml-1 h-4 w-4 shrink-0 text-cyan-50/72 transition ${isLayerPanelOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      <MapContainer
        center={[safeCenter.lat, safeCenter.lng]}
        zoom={15}
        className={`h-full w-full ${isAwaitingMapClick ? "cursor-crosshair" : ""}`}
        zoomControl
      >
        <LayerPanelCloser onClose={closeLayerPanel} />
        <TileLayer attribution={activeBaseLayer.attribution} url={activeBaseLayer.url} />
        <CenterReporter onCenterChange={onCenterChange} />
        <ExternalCenterController center={center} />
        <FocusController request={focusRequest} />
        <MapClickReporter onMapClick={onMapClick} />

        {pins
          .map((pin) => ({ pin, n: normalizeLatLng(pin.lat, pin.lng) }))
          .filter((p): p is { pin: SavedPin; n: { lat: number; lng: number } } => p.n !== null)
          .map(({ pin, n }) => (
            <Marker
              key={pin.id}
              position={[n.lat, n.lng]}
              icon={numberedPinIcon(pin.number, canDragPins)}
              draggable={canDragPins}
              autoPan={canDragPins}
              title={
                canDragPins
                  ? `Post ${pin.number}. Træk for at flytte eller klik for at åbne.`
                  : onPinClick
                  ? `Post ${pin.number}. Klik for at hoppe til posten.`
                  : `Post ${pin.number}`
              }
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

        {zones
          ?.map((zone) => ({ zone, n: normalizeLatLng(zone.lat, zone.lng) }))
          .filter((z): z is { zone: SavedZone; n: { lat: number; lng: number } } => z.n !== null)
          .map(({ zone, n }, index) => (
            <Fragment key={zone.id}>
              <Circle
                center={[n.lat, n.lng]}
                radius={zone.radius}
                pathOptions={{
                  color: "#22d3ee",
                  fillColor: "#22d3ee",
                  fillOpacity: 0.18,
                  weight: 2,
                }}
              />
              {mapMode === "zone-krig" && (
                <Marker
                  position={[n.lat, n.lng]}
                  icon={createZoneKrigMarkerIcon({
                    state: "neutral",
                    label: zone.label ?? `Zone ${index + 1}`,
                  })}
                  interactive={false}
                />
              )}
            </Fragment>
          ))}
      </MapContainer>

      {hasStackedPins && !activePinLabel ? (
        <div className="pointer-events-none absolute right-4 bottom-4 left-4 z-1000 rounded-2xl border border-amber-400/40 bg-slate-950/82 px-4 py-3 text-sm font-medium text-amber-100 shadow-[0_16px_32px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:left-auto sm:max-w-80">
          ⚠️ Mindst to poster overlapper på kortet. Brug &ldquo;Fjern placering&rdquo; i listen for at adskille dem.
        </div>
      ) : showPinDragHint ? (
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
