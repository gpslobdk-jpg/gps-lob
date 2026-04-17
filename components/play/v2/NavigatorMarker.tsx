/**
 * NavigatorMarker — Premium native-feel GPS navigation marker.
 *
 * Visual layers (bottom → top):
 *  1. Accuracy halo  — subtle breathing circle whose radius maps to GPS accuracy.
 *  2. Heading cone    — semi-transparent gradient "flashlight" that rotates with the compass.
 *  3. Outer ring      — white ring with soft shadow (pulse animation).
 *  4. Core dot        — emerald-600 that shifts to vibrant green when in-range.
 */

"use client";

import { memo, useMemo } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NavigatorMarkerProps {
  /** Latitude of the player. */
  lat: number;
  /** Longitude of the player. */
  lng: number;
  /** Compass heading in degrees 0-360 (null hides the cone). */
  heading: number | null;
  /** Raw GPS accuracy in meters (null hides the halo). */
  accuracy: number | null;
  /** True when the player is within unlock range of the target. */
  isInRange: boolean;
  /** Container dimensions used to place the marker (centered for now). */
  containerWidth: number;
  containerHeight: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pixel radius of the core dot. */
const DOT_RADIUS = 10;

/** Min/max pixel radius for the accuracy halo. */
const HALO_MIN_PX = 24;
const HALO_MAX_PX = 120;

/** Accuracy in meters that maps to HALO_MAX_PX. */
const HALO_MAX_ACCURACY_M = 150;

/** Length of the heading cone (px from center). */
const CONE_LENGTH = 64;

/** Half-angle of the cone in degrees. */
const CONE_HALF_ANGLE = 22;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function accuracyToRadius(accuracy: number | null): number {
  if (accuracy === null || accuracy <= 0) return HALO_MIN_PX;
  const ratio = clamp(accuracy / HALO_MAX_ACCURACY_M, 0, 1);
  return HALO_MIN_PX + ratio * (HALO_MAX_PX - HALO_MIN_PX);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Breathing accuracy halo. */
function AccuracyHalo({ radius, isInRange }: { radius: number; isInRange: boolean }) {
  const diameter = radius * 2;
  const color = isInRange ? "rgba(34,197,94,0.12)" : "rgba(16,185,129,0.10)";
  const borderColor = isInRange ? "rgba(34,197,94,0.25)" : "rgba(16,185,129,0.15)";

  return (
    <div
      className="absolute animate-[breath_3s_ease-in-out_infinite] rounded-full"
      style={{
        width: diameter,
        height: diameter,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        border: `1px solid ${borderColor}`,
        transition: "width 1.2s ease-out, height 1.2s ease-out, background 0.4s ease, border-color 0.4s ease",
      }}
    />
  );
}

/** Gradient heading cone ("flashlight"). */
function HeadingCone({ heading, isInRange }: { heading: number; isInRange: boolean }) {
  const coneColor = isInRange ? "rgba(34,197,94,0.35)" : "rgba(16,185,129,0.25)";

  // Build a triangle-like clip path using CSS clip-path polygon.
  // The cone point is at the center (50%, 50%). The two outer edges
  // are at `CONE_LENGTH` px away at ±CONE_HALF_ANGLE from heading.
  // We use a conic-gradient rotated by heading for the fill.

  const style = useMemo(
    () => ({
      width: CONE_LENGTH * 2,
      height: CONE_LENGTH * 2,
      top: "50%",
      left: "50%",
      transform: `translate(-50%, -50%) rotate(${heading}deg)`,
      transition: "transform 0.1s linear",
      background: `conic-gradient(
        from -${CONE_HALF_ANGLE}deg at 50% 50%,
        transparent 0deg,
        ${coneColor} ${CONE_HALF_ANGLE}deg,
        transparent ${CONE_HALF_ANGLE * 2}deg
      )`,
      clipPath: `polygon(
        50% 50%,
        ${50 - Math.sin((CONE_HALF_ANGLE * Math.PI) / 180) * 50}% ${50 - Math.cos((CONE_HALF_ANGLE * Math.PI) / 180) * 50}%,
        50% 0%,
        ${50 + Math.sin((CONE_HALF_ANGLE * Math.PI) / 180) * 50}% ${50 - Math.cos((CONE_HALF_ANGLE * Math.PI) / 180) * 50}%
      )`,
      opacity: 0.9,
    }),
    [heading, coneColor],
  );

  return <div className="pointer-events-none absolute" style={style} />;
}

/** Pulsing core dot with white ring. */
function CoreDot({ isInRange }: { isInRange: boolean }) {
  const dotSize = DOT_RADIUS * 2;
  const ringSize = dotSize + 8;

  return (
    <>
      {/* White ring + shadow */}
      <div
        className="absolute animate-[pulse-ring_2s_cubic-bezier(0.4,0,0.6,1)_infinite] rounded-full"
        style={{
          width: ringSize,
          height: ringSize,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(255,255,255,0.9)",
          boxShadow: isInRange
            ? "0 0 20px 4px rgba(34,197,94,0.5), 0 0 40px 8px rgba(34,197,94,0.2)"
            : "0 0 12px 3px rgba(16,185,129,0.3), 0 0 24px 6px rgba(16,185,129,0.1)",
          transition: "box-shadow 0.4s ease",
        }}
      />

      {/* Core emerald dot */}
      <div
        className="absolute rounded-full"
        style={{
          width: dotSize,
          height: dotSize,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: isInRange
            ? "linear-gradient(135deg, #22c55e, #4ade80)"
            : "linear-gradient(135deg, #059669, #10b981)",
          boxShadow: isInRange
            ? "0 0 10px 2px rgba(34,197,94,0.6)"
            : "0 0 6px 1px rgba(16,185,129,0.4)",
          transition: "background 0.4s ease, box-shadow 0.4s ease",
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const NavigatorMarker = memo(function NavigatorMarker({
  heading,
  accuracy,
  isInRange,
}: NavigatorMarkerProps) {
  const haloRadius = accuracyToRadius(accuracy);

  // The marker is absolutely positioned in the center of its parent container.
  // The parent is expected to be `position: relative` and fills the map area.
  // When maps are integrated, lat/lng will be projected to pixel coords. For now,
  // the marker is fixed at the center with CSS motion-smoothing built in.

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        // Motion smoothing: float between GPS updates
        transition: "top 0.8s cubic-bezier(0.34,1.56,0.64,1), left 0.8s cubic-bezier(0.34,1.56,0.64,1)",
        width: 0,
        height: 0,
      }}
    >
      {/* Layer 1: Accuracy halo */}
      <AccuracyHalo radius={haloRadius} isInRange={isInRange} />

      {/* Layer 2: Heading cone */}
      {heading !== null && <HeadingCone heading={heading} isInRange={isInRange} />}

      {/* Layer 3+4: Ring + core dot */}
      <CoreDot isInRange={isInRange} />
    </div>
  );
});

export default NavigatorMarker;
