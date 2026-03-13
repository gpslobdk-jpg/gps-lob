export type RaceTypeThemeKey =
  | "manuel"
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
  archiveSecondaryButtonClass: string;
  archiveMutedButtonClass: string;
  archiveIconButtonClass: string;
};

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
      "border border-emerald-400/40 bg-emerald-700 text-white shadow-[0_16px_32px_rgba(4,120,87,0.26)] hover:bg-emerald-600",
    archiveSecondaryButtonClass:
      "border border-emerald-400/30 bg-emerald-800 text-white shadow-[0_14px_28px_rgba(6,78,59,0.22)] hover:bg-emerald-700",
    archiveMutedButtonClass:
      "border border-emerald-400/25 bg-slate-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.2)] hover:bg-slate-900",
    archiveIconButtonClass:
      "border border-emerald-400/25 bg-emerald-800 text-white hover:bg-emerald-700",
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
      "border border-sky-400/40 bg-sky-700 text-white shadow-[0_16px_32px_rgba(3,105,161,0.26)] hover:bg-sky-600",
    archiveSecondaryButtonClass:
      "border border-sky-400/30 bg-sky-800 text-white shadow-[0_14px_28px_rgba(7,89,133,0.22)] hover:bg-sky-700",
    archiveMutedButtonClass:
      "border border-sky-400/25 bg-slate-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.2)] hover:bg-slate-900",
    archiveIconButtonClass: "border border-sky-400/25 bg-sky-800 text-white hover:bg-sky-700",
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
      "border border-amber-400/40 bg-amber-700 text-white shadow-[0_16px_32px_rgba(180,83,9,0.28)] hover:bg-amber-600",
    archiveSecondaryButtonClass:
      "border border-amber-400/30 bg-amber-800 text-white shadow-[0_14px_28px_rgba(146,64,14,0.24)] hover:bg-amber-700",
    archiveMutedButtonClass:
      "border border-amber-400/25 bg-slate-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.2)] hover:bg-slate-900",
    archiveIconButtonClass:
      "border border-amber-400/25 bg-amber-800 text-white hover:bg-amber-700",
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
      "border border-violet-400/40 bg-violet-700 text-white shadow-[0_16px_32px_rgba(109,40,217,0.26)] hover:bg-violet-600",
    archiveSecondaryButtonClass:
      "border border-violet-400/30 bg-violet-800 text-white shadow-[0_14px_28px_rgba(91,33,182,0.22)] hover:bg-violet-700",
    archiveMutedButtonClass:
      "border border-violet-400/25 bg-slate-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.2)] hover:bg-slate-900",
    archiveIconButtonClass:
      "border border-violet-400/25 bg-violet-800 text-white hover:bg-violet-700",
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
      "border border-cyan-400/40 bg-cyan-700 text-white shadow-[0_16px_32px_rgba(14,116,144,0.26)] hover:bg-cyan-600",
    archiveSecondaryButtonClass:
      "border border-cyan-400/30 bg-cyan-800 text-white shadow-[0_14px_28px_rgba(21,94,117,0.22)] hover:bg-cyan-700",
    archiveMutedButtonClass:
      "border border-cyan-400/25 bg-slate-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.2)] hover:bg-slate-900",
    archiveIconButtonClass: "border border-cyan-400/25 bg-cyan-800 text-white hover:bg-cyan-700",
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
      "border border-rose-400/40 bg-rose-700 text-white shadow-[0_16px_32px_rgba(190,24,93,0.26)] hover:bg-rose-600",
    archiveSecondaryButtonClass:
      "border border-rose-400/30 bg-rose-800 text-white shadow-[0_14px_28px_rgba(159,18,57,0.22)] hover:bg-rose-700",
    archiveMutedButtonClass:
      "border border-rose-400/25 bg-slate-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.2)] hover:bg-slate-900",
    archiveIconButtonClass: "border border-rose-400/25 bg-rose-800 text-white hover:bg-rose-700",
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
