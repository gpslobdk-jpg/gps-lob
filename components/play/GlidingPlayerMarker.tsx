"use client";

import L from "leaflet";
import type { Marker as LeafletMarker } from "leaflet";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Marker, Popup } from "react-leaflet";

import type { Location } from "./types";

type GlidingPlayerMarkerProps = {
  location: Location;
  popupContent?: ReactNode;
};

const PLAYER_MARKER_GLIDE_MS = 650;

function createBluePlayerDotIcon() {
  return L.divIcon({
    className: "gpslob-player-dot-icon",
    html: `
      <div class="gpslob-player-dot">
        <div class="gpslob-player-dot__pulse"></div>
        <div class="gpslob-player-dot__halo"></div>
        <div class="gpslob-player-dot__core"></div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

export default function GlidingPlayerMarker({
  location,
  popupContent,
}: GlidingPlayerMarkerProps) {
  const markerRef = useRef<LeafletMarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const initialPositionRef = useRef<[number, number]>([location.lat, location.lng]);
  const icon = useMemo(() => createBluePlayerDotIcon(), []);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) {
      return;
    }

    const from = marker.getLatLng();
    const to = L.latLng(location.lat, location.lng);

    if (from.lat === to.lat && from.lng === to.lng) {
      return;
    }

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const startedAt = window.performance.now();
    const startLat = from.lat;
    const startLng = from.lng;

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / PLAYER_MARKER_GLIDE_MS);
      const eased = easeOutCubic(progress);
      const nextLat = startLat + (to.lat - startLat) * eased;
      const nextLng = startLng + (to.lng - startLng) * eased;

      marker.setLatLng([nextLat, nextLng]);

      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [location.lat, location.lng]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <Marker
        position={initialPositionRef.current}
        icon={icon}
        ref={(instance) => {
          markerRef.current = instance;
        }}
      >
        {popupContent ? <Popup>{popupContent}</Popup> : null}
      </Marker>

      <style jsx global>{`
        .gpslob-player-dot-icon {
          background: transparent;
          border: 0;
        }

        .gpslob-player-dot {
          position: relative;
          width: 26px;
          height: 26px;
        }

        .gpslob-player-dot__pulse,
        .gpslob-player-dot__halo,
        .gpslob-player-dot__core {
          position: absolute;
          border-radius: 999px;
          inset: 0;
        }

        .gpslob-player-dot__pulse {
          background: rgba(59, 130, 246, 0.18);
          animation: gpslob-player-dot-pulse 1.8s ease-out infinite;
          transform-origin: center;
        }

        .gpslob-player-dot__halo {
          inset: 4px;
          background: rgba(59, 130, 246, 0.28);
          box-shadow: 0 0 0 7px rgba(59, 130, 246, 0.18), 0 10px 24px rgba(37, 99, 235, 0.28);
        }

        .gpslob-player-dot__core {
          inset: 7px;
          border: 2.5px solid rgba(255, 255, 255, 0.96);
          background: linear-gradient(180deg, #3b82f6, #2563eb);
          box-shadow: 0 0 0 1px rgba(30, 64, 175, 0.16);
        }

        @keyframes gpslob-player-dot-pulse {
          0% {
            transform: scale(0.82);
            opacity: 0.8;
          }

          70% {
            transform: scale(1.2);
            opacity: 0;
          }

          100% {
            transform: scale(1.24);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}