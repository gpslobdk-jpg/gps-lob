"use client";

import L from "leaflet";
import type { Marker as LeafletMarker } from "leaflet";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Marker, Popup } from "react-leaflet";

import type { Location } from "./types";

type GlidingPlayerMarkerProps = {
  location: Location;
  avatarUrl?: string;
  popupContent?: ReactNode;
};

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function createPlayerMarkerIcon(avatarUrl?: string) {
  if (avatarUrl) {
    const safeAvatarUrl = escapeAttribute(avatarUrl);

    return L.divIcon({
      className: "gpslob-player-dot-icon",
      html: `
        <div class="gpslob-player-avatar">
          <div class="gpslob-player-avatar__pulse"></div>
          <div class="gpslob-player-avatar__aura"></div>
          <div class="gpslob-player-avatar__frame">
            <img class="gpslob-player-avatar__image" src="${safeAvatarUrl}" alt="" />
          </div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  }

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

export default function GlidingPlayerMarker({
  location,
  avatarUrl,
  popupContent,
}: GlidingPlayerMarkerProps) {
  const markerRef = useRef<LeafletMarker | null>(null);
  const initialPositionRef = useRef<[number, number]>([location.lat, location.lng]);
  const icon = useMemo(() => createPlayerMarkerIcon(avatarUrl), [avatarUrl]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) {
      return;
    }

    marker.setLatLng([location.lat, location.lng]);
  }, [location.lat, location.lng]);

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

        .gpslob-player-avatar {
          position: relative;
          width: 48px;
          height: 48px;
        }

        .gpslob-player-dot__pulse,
        .gpslob-player-dot__halo,
        .gpslob-player-dot__core,
        .gpslob-player-avatar__pulse,
        .gpslob-player-avatar__aura,
        .gpslob-player-avatar__frame {
          position: absolute;
          border-radius: 999px;
          inset: 0;
        }

        .gpslob-player-avatar__pulse {
          background: rgba(34, 197, 94, 0.2);
          animation: gpslob-player-dot-pulse 2.2s ease-out infinite;
          transform-origin: center;
        }

        .gpslob-player-avatar__aura {
          inset: 2px;
          background: radial-gradient(circle, rgba(74, 222, 128, 0.4), rgba(22, 163, 74, 0.12));
          box-shadow: 0 0 15px 5px rgba(34, 197, 94, 0.38), 0 12px 26px rgba(22, 163, 74, 0.24);
        }

        .gpslob-player-avatar__frame {
          inset: 4px;
          overflow: hidden;
          border: 2px solid rgba(255, 255, 255, 0.96);
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.32), 0 10px 24px rgba(15, 23, 42, 0.28);
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(2, 6, 23, 0.98));
        }

        .gpslob-player-avatar__image {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
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