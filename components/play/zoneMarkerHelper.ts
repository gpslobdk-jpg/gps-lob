import L from "leaflet";

export type ZoneKrigMarkerState = "neutral" | "owner" | "selected";

type ZoneKrigMarkerOptions = {
  state: ZoneKrigMarkerState;
  label: string;
  teamColor?: string | null;
  isShielded?: boolean;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeHexColor(color?: string | null) {
  if (!color) return null;
  const trimmed = color.trim();
  const match = trimmed.match(/^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return null;

  if (trimmed.startsWith("#")) {
    return trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed;
  }

  return trimmed.length === 3
    ? `#${trimmed[0]}${trimmed[0]}${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}`
    : `#${trimmed}`;
}

function hexToRgb(color: string) {
  const normalized = normalizeHexColor(color);
  if (!normalized) {
    return { r: 34, g: 211, b: 238 };
  }

  const hex = normalized.slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function toRgba(color: string, alpha: number) {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexagonSvg() {
  return [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="relative z-10 h-6 w-6">',
    '<path d="M21 16V8a2 2 0 0 0-1-1.73l-6-3.46a2 2 0 0 0-2 0L6 6.27A2 2 0 0 0 5 8v8a2 2 0 0 0 1 1.73l6 3.46a2 2 0 0 0 2 0l6-3.46A2 2 0 0 0 21 16Z"/>',
    '</svg>',
  ].join("");
}

function shieldSvg() {
  return [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="relative z-10 h-6 w-6">',
    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    '</svg>',
  ].join("");
}

function targetSvg() {
  return [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="relative z-10 h-6 w-6">',
    '<circle cx="12" cy="12" r="4"/>',
    '<path d="M12 2v3"/>',
    '<path d="M12 19v3"/>',
    '<path d="M2 12h3"/>',
    '<path d="M19 12h3"/>',
    '</svg>',
  ].join("");
}

export function createZoneKrigMarkerIcon({
  state,
  label,
  teamColor,
  isShielded = false,
}: ZoneKrigMarkerOptions) {
  const safeLabel = escapeHtml(label);
  const ownerColor = normalizeHexColor(teamColor);
  const accentColor =
    state === "neutral"
      ? "#67e8f9"
      : state === "selected"
        ? ownerColor ?? "#fbbf24"
        : ownerColor ?? "#a78bfa";
  const ringGlow =
    state === "selected"
      ? toRgba(accentColor, 0.48)
      : state === "owner"
        ? toRgba(accentColor, 0.34)
        : "rgba(34, 211, 238, 0.28)";
  const labelBorder =
    state === "selected"
      ? "border-amber-300/70 text-amber-100"
      : state === "owner"
        ? "border-white/25 text-white"
        : "border-cyan-300/50 text-cyan-100";
  const badgeBorder =
    state === "selected"
      ? "border-amber-300/80"
      : state === "owner"
        ? "border-white/20"
        : "border-cyan-300/60";
  const badgeBackground =
    state === "selected"
      ? "bg-slate-950/95"
      : state === "owner"
        ? "bg-slate-950/95"
        : "bg-slate-950/90";
  const pulseClass = state === "selected" || isShielded ? "animate-pulse" : "";
  const svgMarkup =
    state === "selected" ? targetSvg() : state === "owner" ? shieldSvg() : hexagonSvg();

  return L.divIcon({
    className: "bg-transparent border-none",
    html: `
      <div class="pointer-events-none relative flex flex-col items-center justify-start overflow-visible" style="height:78px;width:76px;">
        <div class="absolute h-12 w-12 rounded-[1.15rem] blur-xl ${pulseClass}" style="top:5px;background:${ringGlow};"></div>
        <div class="relative mt-1 flex h-12 w-12 items-center justify-center rounded-[1.15rem] border ${badgeBorder} ${badgeBackground} shadow-2xl backdrop-blur-md">
          <div class="absolute rounded-[0.95rem] border border-white/8" style="inset:3px;"></div>
          <div class="absolute inset-0 rounded-[1.15rem]" style="box-shadow:0 0 28px ${ringGlow};"></div>
          <div class="relative flex h-full w-full items-center justify-center" style="color:${accentColor};">
            ${svgMarkup}
          </div>
          ${isShielded ? `<div class="absolute -right-1 -top-1 h-3 w-3 rounded-full border border-white/60 bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>` : ""}
        </div>
        <div class="mt-2 rounded-full border ${labelBorder} bg-slate-950/88 px-2.5 py-1 text-center text-[10px] font-black uppercase tracking-[0.22em] shadow-[0_10px_24px_rgba(2,6,23,0.45)] backdrop-blur-md" style="min-width:52px;">
          ${safeLabel}
        </div>
      </div>
    `,
    iconSize: [76, 78],
    iconAnchor: [38, 39],
  });
}