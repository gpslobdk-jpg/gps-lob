export type RaceTypeThemeKey =
  | "manuel"
  | "dansk"
  | "engelsk"
  | "matematik"
  | "foto"
  | "escape"
  | "rollespil"
  | "scanner"
  | "selfie";

export type RaceTypeTheme = {
  key: RaceTypeThemeKey;
  label: string;
  selectionCardClass: string;
  archiveCardClass: string;
  archiveHeaderClass: string;
  archiveAccentIconClass: string;
  archivePrimaryButtonClass: string;
  archiveGhostButtonClass: string;
  archiveGhostIconButtonClass: string;
  archiveDangerIconButtonClass: string;
  archiveStatusBadgeClass: string;
};

const ARCHIVE_DANGER_ICON_BUTTON_CLASS =
  "border border-rose-200 bg-white text-rose-700 shadow-sm hover:border-rose-300 hover:bg-rose-50";

const ARCHIVE_STATUS_BADGE_CLASS =
  "border border-white/15 bg-white/12 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]";

const RACE_TYPE_THEMES: Record<RaceTypeThemeKey, RaceTypeTheme> = {
  manuel: {
    key: "manuel",
    label: "Manuel",
    selectionCardClass:
      "border-emerald-400/40 bg-emerald-700 text-white shadow-xl shadow-emerald-950/25 hover:border-emerald-300/60 hover:bg-emerald-600 hover:shadow-2xl hover:shadow-emerald-950/35",
    archiveCardClass:
      "border-emerald-300/60 shadow-emerald-500/10 hover:shadow-emerald-500/20",
    archiveHeaderClass: "bg-emerald-700 text-white",
    archiveAccentIconClass: "text-emerald-700",
    archivePrimaryButtonClass:
      "border border-emerald-700 bg-emerald-700 text-white shadow-[0_12px_24px_rgba(4,120,87,0.18)] hover:bg-emerald-600",
    archiveGhostButtonClass:
      "border border-emerald-200 bg-white text-emerald-900 shadow-sm hover:border-emerald-300 hover:bg-emerald-50",
    archiveGhostIconButtonClass:
      "border border-emerald-200 bg-white text-emerald-800 shadow-sm hover:border-emerald-300 hover:bg-emerald-50",
    archiveDangerIconButtonClass: ARCHIVE_DANGER_ICON_BUTTON_CLASS,
    archiveStatusBadgeClass: ARCHIVE_STATUS_BADGE_CLASS,
  },
  dansk: {
    key: "dansk",
    label: "Dansk",
    selectionCardClass:
      "border-rose-400/40 bg-rose-700 text-white shadow-xl shadow-rose-950/25 hover:border-rose-300/60 hover:bg-rose-600 hover:shadow-2xl hover:shadow-rose-950/35",
    archiveCardClass: "border-rose-300/60 shadow-rose-500/10 hover:shadow-rose-500/20",
    archiveHeaderClass: "bg-rose-700 text-white",
    archiveAccentIconClass: "text-rose-700",
    archivePrimaryButtonClass:
      "border border-rose-700 bg-rose-700 text-white shadow-[0_12px_24px_rgba(190,24,93,0.18)] hover:bg-rose-600",
    archiveGhostButtonClass:
      "border border-rose-200 bg-white text-rose-900 shadow-sm hover:border-rose-300 hover:bg-rose-50",
    archiveGhostIconButtonClass:
      "border border-rose-200 bg-white text-rose-800 shadow-sm hover:border-rose-300 hover:bg-rose-50",
    archiveDangerIconButtonClass: ARCHIVE_DANGER_ICON_BUTTON_CLASS,
    archiveStatusBadgeClass: ARCHIVE_STATUS_BADGE_CLASS,
  },
  engelsk: {
    key: "engelsk",
    label: "Engelsk",
    selectionCardClass:
      "border-blue-300/45 bg-gradient-to-br from-blue-950 via-slate-900 to-red-950 text-white shadow-xl shadow-slate-950/35 hover:border-red-300/55 hover:shadow-2xl hover:shadow-slate-950/45",
    archiveCardClass:
      "border-blue-300/30 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white shadow-blue-950/20 hover:border-red-300/35 hover:shadow-blue-950/30",
    archiveHeaderClass: "bg-gradient-to-r from-blue-950 via-slate-900 to-red-950 text-white",
    archiveAccentIconClass: "text-blue-200",
    archivePrimaryButtonClass:
      "border border-red-400/40 bg-red-500 text-slate-950 shadow-[0_12px_24px_rgba(239,68,68,0.24)] hover:bg-red-400",
    archiveGhostButtonClass:
      "border border-blue-300/25 bg-slate-950 text-white shadow-sm hover:border-blue-200/35 hover:bg-blue-950/40",
    archiveGhostIconButtonClass:
      "border border-blue-300/25 bg-slate-950 text-blue-100 shadow-sm hover:border-blue-200/35 hover:bg-blue-950/40",
    archiveDangerIconButtonClass:
      "border border-red-300/35 bg-slate-950 text-red-300 shadow-sm hover:border-red-200/45 hover:bg-red-950/25",
    archiveStatusBadgeClass:
      "border border-white/12 bg-white/10 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]",
  },
  matematik: {
    key: "matematik",
    label: "Matematik",
    selectionCardClass:
      "border-blue-400/40 bg-blue-700 text-white shadow-xl shadow-blue-950/25 hover:border-blue-300/60 hover:bg-blue-600 hover:shadow-2xl hover:shadow-blue-950/35",
    archiveCardClass: "border-blue-300/60 shadow-blue-500/10 hover:shadow-blue-500/20",
    archiveHeaderClass: "bg-blue-700 text-white",
    archiveAccentIconClass: "text-blue-700",
    archivePrimaryButtonClass:
      "border border-blue-700 bg-blue-700 text-white shadow-[0_12px_24px_rgba(37,99,235,0.18)] hover:bg-blue-600",
    archiveGhostButtonClass:
      "border border-blue-200 bg-white text-blue-900 shadow-sm hover:border-blue-300 hover:bg-blue-50",
    archiveGhostIconButtonClass:
      "border border-blue-200 bg-white text-blue-800 shadow-sm hover:border-blue-300 hover:bg-blue-50",
    archiveDangerIconButtonClass: ARCHIVE_DANGER_ICON_BUTTON_CLASS,
    archiveStatusBadgeClass: ARCHIVE_STATUS_BADGE_CLASS,
  },
  foto: {
    key: "foto",
    label: "Foto",
    selectionCardClass:
      "border-sky-400/40 bg-sky-700 text-white shadow-xl shadow-sky-950/25 hover:border-sky-300/60 hover:bg-sky-600 hover:shadow-2xl hover:shadow-sky-950/35",
    archiveCardClass: "border-sky-300/60 shadow-sky-500/10 hover:shadow-sky-500/20",
    archiveHeaderClass: "bg-sky-700 text-white",
    archiveAccentIconClass: "text-sky-700",
    archivePrimaryButtonClass:
      "border border-sky-700 bg-sky-700 text-white shadow-[0_12px_24px_rgba(3,105,161,0.18)] hover:bg-sky-600",
    archiveGhostButtonClass:
      "border border-sky-200 bg-white text-sky-900 shadow-sm hover:border-sky-300 hover:bg-sky-50",
    archiveGhostIconButtonClass:
      "border border-sky-200 bg-white text-sky-800 shadow-sm hover:border-sky-300 hover:bg-sky-50",
    archiveDangerIconButtonClass: ARCHIVE_DANGER_ICON_BUTTON_CLASS,
    archiveStatusBadgeClass: ARCHIVE_STATUS_BADGE_CLASS,
  },
  escape: {
    key: "escape",
    label: "Escape",
    selectionCardClass:
      "border-amber-400/45 bg-amber-700 text-white shadow-xl shadow-amber-950/25 hover:border-amber-300/65 hover:bg-amber-600 hover:shadow-2xl hover:shadow-amber-950/35",
    archiveCardClass:
      "border-amber-300/60 shadow-amber-500/10 hover:shadow-amber-500/20",
    archiveHeaderClass: "bg-amber-700 text-white",
    archiveAccentIconClass: "text-amber-700",
    archivePrimaryButtonClass:
      "border border-amber-700 bg-amber-700 text-white shadow-[0_12px_24px_rgba(180,83,9,0.18)] hover:bg-amber-600",
    archiveGhostButtonClass:
      "border border-amber-200 bg-white text-amber-900 shadow-sm hover:border-amber-300 hover:bg-amber-50",
    archiveGhostIconButtonClass:
      "border border-amber-200 bg-white text-amber-800 shadow-sm hover:border-amber-300 hover:bg-amber-50",
    archiveDangerIconButtonClass: ARCHIVE_DANGER_ICON_BUTTON_CLASS,
    archiveStatusBadgeClass: ARCHIVE_STATUS_BADGE_CLASS,
  },
  rollespil: {
    key: "rollespil",
    label: "Rollespil",
    selectionCardClass:
      "border-violet-400/40 bg-violet-700 text-white shadow-xl shadow-violet-950/25 hover:border-violet-300/60 hover:bg-violet-600 hover:shadow-2xl hover:shadow-violet-950/35",
    archiveCardClass:
      "border-violet-300/60 shadow-violet-500/10 hover:shadow-violet-500/20",
    archiveHeaderClass: "bg-violet-700 text-white",
    archiveAccentIconClass: "text-violet-700",
    archivePrimaryButtonClass:
      "border border-violet-700 bg-violet-700 text-white shadow-[0_12px_24px_rgba(109,40,217,0.18)] hover:bg-violet-600",
    archiveGhostButtonClass:
      "border border-violet-200 bg-white text-violet-900 shadow-sm hover:border-violet-300 hover:bg-violet-50",
    archiveGhostIconButtonClass:
      "border border-violet-200 bg-white text-violet-800 shadow-sm hover:border-violet-300 hover:bg-violet-50",
    archiveDangerIconButtonClass: ARCHIVE_DANGER_ICON_BUTTON_CLASS,
    archiveStatusBadgeClass: ARCHIVE_STATUS_BADGE_CLASS,
  },
  scanner: {
    key: "scanner",
    label: "Scanner",
    selectionCardClass:
      "border-cyan-400/40 bg-cyan-700 text-white shadow-xl shadow-cyan-950/25 hover:border-cyan-300/60 hover:bg-cyan-600 hover:shadow-2xl hover:shadow-cyan-950/35",
    archiveCardClass: "border-cyan-300/60 shadow-cyan-500/10 hover:shadow-cyan-500/20",
    archiveHeaderClass: "bg-cyan-700 text-white",
    archiveAccentIconClass: "text-cyan-700",
    archivePrimaryButtonClass:
      "border border-cyan-700 bg-cyan-700 text-white shadow-[0_12px_24px_rgba(14,116,144,0.18)] hover:bg-cyan-600",
    archiveGhostButtonClass:
      "border border-cyan-200 bg-white text-cyan-900 shadow-sm hover:border-cyan-300 hover:bg-cyan-50",
    archiveGhostIconButtonClass:
      "border border-cyan-200 bg-white text-cyan-800 shadow-sm hover:border-cyan-300 hover:bg-cyan-50",
    archiveDangerIconButtonClass: ARCHIVE_DANGER_ICON_BUTTON_CLASS,
    archiveStatusBadgeClass: ARCHIVE_STATUS_BADGE_CLASS,
  },
  selfie: {
    key: "selfie",
    label: "Selfie",
    selectionCardClass:
      "border-rose-400/40 bg-rose-700 text-white shadow-xl shadow-rose-950/25 hover:border-rose-300/60 hover:bg-rose-600 hover:shadow-2xl hover:shadow-rose-950/35",
    archiveCardClass: "border-rose-300/60 shadow-rose-500/10 hover:shadow-rose-500/20",
    archiveHeaderClass: "bg-rose-700 text-white",
    archiveAccentIconClass: "text-rose-700",
    archivePrimaryButtonClass:
      "border border-rose-700 bg-rose-700 text-white shadow-[0_12px_24px_rgba(190,24,93,0.18)] hover:bg-rose-600",
    archiveGhostButtonClass:
      "border border-rose-200 bg-white text-rose-900 shadow-sm hover:border-rose-300 hover:bg-rose-50",
    archiveGhostIconButtonClass:
      "border border-rose-200 bg-white text-rose-800 shadow-sm hover:border-rose-300 hover:bg-rose-50",
    archiveDangerIconButtonClass: ARCHIVE_DANGER_ICON_BUTTON_CLASS,
    archiveStatusBadgeClass: ARCHIVE_STATUS_BADGE_CLASS,
  },
};

export function normalizeRaceTypeThemeKey(value: unknown): RaceTypeThemeKey {
  if (typeof value !== "string") return "manuel";

  switch (value.trim().toLocaleLowerCase("da-DK")) {
    case "gps":
    case "quiz":
    case "manuel":
    case "manual":
      return "manuel";
    case "dansk":
    case "danish":
      return "dansk";
    case "engelsk":
    case "english":
      return "engelsk";
    case "matematik":
    case "math":
      return "matematik";
    case "foto":
    case "photo":
      return "foto";
    case "escape":
    case "escape_room":
    case "escaperoom":
      return "escape";
    case "rollespil":
    case "roleplay":
    case "role_play":
    case "tidsmaskinen":
      return "rollespil";
    case "scanner":
    case "scan":
    case "bogscanner":
    case "bookscanner":
    case "qr":
    case "qrscanner":
      return "scanner";
    case "selfie":
      return "selfie";
    default:
      return "manuel";
  }
}

export function getRaceTypeTheme(value: unknown): RaceTypeTheme {
  return RACE_TYPE_THEMES[normalizeRaceTypeThemeKey(value)];
}
