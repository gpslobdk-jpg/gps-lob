"use client";

import {
  BookOpen,
  CircleAlert,
  CloudRain,
  Music2,
  Square,
  Trees,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useTeacherSound } from "@/components/teacher-sound/TeacherSoundProvider";
import { useModalFocusTrap } from "@/components/ui/useModalFocusTrap";
import {
  getTeacherSoundAsset,
  TEACHER_SOUND_PRESETS,
  type TeacherSoundPreset,
  type TeacherSoundPresetId,
} from "@/lib/teacherSound/catalog";

type TeacherSoundControlProps = {
  variant: "hero" | "dashboard" | "floating";
};

const ATTRIBUTION_ASSET_IDS = ["afteraarsskov", "regn-ved-vinduet", "stille-klaver", "papir-1"] as const;

function PresetIcon({ preset }: { preset: TeacherSoundPreset }) {
  if (preset.id === "afteraarsskov") {
    return <Trees className="h-4 w-4" aria-hidden="true" />;
  }

  if (preset.id === "regn-ved-vinduet") {
    return <CloudRain className="h-4 w-4" aria-hidden="true" />;
  }

  if (preset.id === "stille-klaver") {
    return <Music2 className="h-4 w-4" aria-hidden="true" />;
  }

  return <BookOpen className="h-4 w-4" aria-hidden="true" />;
}

function isPresetSelected(
  preset: TeacherSoundPreset,
  values: {
    ambiencePresetId: TeacherSoundPresetId | null;
    musicEnabled: boolean;
  },
) {
  if (preset.musicAssetId) {
    return values.musicEnabled && values.ambiencePresetId === null;
  }

  return values.ambiencePresetId === preset.id && !values.musicEnabled;
}

export default function TeacherSoundControl({ variant }: TeacherSoundControlProps) {
  const {
    ambiencePresetId,
    choosePreset,
    coordinationState,
    feedback,
    hasUsedSound,
    isAvailableOnRoute,
    isPlaying,
    materialSoundsEnabled,
    musicEnabled,
    setMaterialSoundsEnabled,
    setMusicEnabled,
    start,
    stop,
  } = useTeacherSound();
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const headingId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeDialog = useCallback(() => setIsOpen(false), []);
  const dialogRef = useModalFocusTrap<HTMLDivElement>({
    open: isOpen,
    onClose: closeDialog,
    initialFocusRef: closeButtonRef,
  });

  if (!isAvailableOnRoute) {
    return null;
  }

  const hero = variant === "hero";
  const compact = variant === "dashboard";
  const controlLabel = isPlaying ? "Lyd og ro spiller" : "Lyd og ro";
  const canStart = coordinationState === "ready";
  const selectedValues = { ambiencePresetId, musicEnabled };
  const startLabel = isPlaying ? "Lyd spiller" : hasUsedSound ? "Fortsæt lyd" : "Start lyd";
  const launcherClassName = compact
    ? "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#f4bb54]/55 bg-[#0b213a]/88 px-3 text-sm font-black text-white shadow-sm transition hover:bg-[#173f5c] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f4bb54]"
    : hero
      ? "inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-[#0b3353]/78 px-3 py-2 text-sm font-black text-white shadow-[0_8px_18px_rgba(0,0,0,0.16)] backdrop-blur transition hover:bg-[#174b6c] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f4bb54]"
      : "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#f4bb54]/55 bg-[#0b213a]/82 px-4 py-2 text-sm font-black text-white shadow-[0_12px_26px_rgba(0,0,0,0.18)] backdrop-blur transition hover:bg-[#173f5c] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#f4bb54]";

  return (
    <div
      data-testid="teacher-sound-control"
      className={hero ? "w-fit" : compact ? "w-fit" : "w-full sm:w-auto"}
    >
      <div className={hero || compact ? "flex items-center gap-1.5" : "flex items-center gap-2"}>
        <button
          type="button"
          data-testid={hero ? "teacher-sound-home-launcher" : "teacher-sound-launcher"}
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-haspopup="dialog"
          aria-label={hero ? controlLabel : undefined}
          onClick={() => setIsOpen((open) => !open)}
          className={launcherClassName}
        >
          {isPlaying ? <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" /> : <VolumeX className="h-4 w-4 shrink-0" aria-hidden="true" />}
          <span>{compact ? "Lyd" : hero ? "Lyd og ro" : controlLabel}</span>
          {hero ? (
            <span className={`h-2 w-2 rounded-full ${isPlaying ? "bg-[#b8e0c0] shadow-[0_0_0_3px_rgba(184,224,192,0.16)]" : "bg-[#f4bb54]"}`} aria-hidden="true" />
          ) : null}
        </button>

        {isPlaying ? (
          <button
            type="button"
            onClick={stop}
            data-testid="teacher-sound-stop"
            className={
              hero
                ? "inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/24 bg-[#0b213a]/72 text-white shadow-sm transition hover:bg-[#173f5c] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f4bb54]"
                : compact
                  ? "inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 text-xs font-black text-rose-800 shadow-sm transition hover:bg-rose-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                  : "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-rose-200 bg-white/94 px-4 py-2 text-sm font-black text-rose-800 shadow-sm transition hover:bg-rose-50 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white"
            }
            aria-label="Stop al lærerlyd"
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            {hero ? <span className="sr-only">Stop lyd</span> : <span>Stop lyd</span>}
          </button>
        ) : null}
      </div>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div data-testid="teacher-sound-overlay" className="fixed inset-0 z-[100] grid place-items-center p-4 sm:p-6">
              <button
                type="button"
                tabIndex={-1}
                aria-label="Luk Lyd og ro"
                onClick={closeDialog}
                className="absolute inset-0 cursor-default bg-[#061b3d]/56 backdrop-blur-[2px]"
              />
              <div
                ref={dialogRef}
                id={panelId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={headingId}
                tabIndex={-1}
                data-testid="teacher-sound-dialog"
                className="relative z-10 flex max-h-[min(42rem,calc(100vh-2rem))] w-[min(32rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.75rem] border border-[#d9c99f] bg-[#fffdf6] text-left text-[#0b213a] shadow-[0_28px_78px_rgba(7,25,45,0.38)]"
              >
                <div className="overflow-y-auto px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black tracking-[0.17em] text-[#8a5b18] uppercase">Lærerværktøj</p>
                      <h2 id={headingId} className="mt-1 text-xl font-black">Lyd og ro</h2>
                    </div>
                    <button
                      ref={closeButtonRef}
                      type="button"
                      onClick={closeDialog}
                      aria-label="Luk Lyd og ro"
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d9e5dc] bg-white text-[#0b4f74] transition hover:bg-[#edf4e7] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#0b4f74]"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
                    Intet starter af sig selv. Vælg en stemning, og start først, når du vil have lyd i rummet.
                  </p>

                  <fieldset className="mt-4">
                    <legend className="text-xs font-black tracking-[0.12em] text-[#496250] uppercase">Stemning</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {TEACHER_SOUND_PRESETS.map((preset) => {
                        const selected = isPresetSelected(preset, selectedValues);
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            disabled={!preset.available}
                            aria-pressed={selected}
                            onClick={() => choosePreset(preset.id)}
                            className={`min-h-20 rounded-2xl border px-3 py-3 text-left transition focus-visible:outline-3 focus-visible:outline-offset-2 ${selected ? "border-[#a96917] bg-[#f8e8bf] text-[#3c2b13]" : "border-[#d9e5dc] bg-white text-[#173c31] hover:border-[#b4c9b8] hover:bg-[#f6fbf4]"} ${!preset.available ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500 opacity-80" : ""}`}
                          >
                            <span className="flex items-center gap-2 text-sm font-black">
                              <PresetIcon preset={preset} />
                              {preset.title}
                            </span>
                            <span className="mt-1 block text-xs font-semibold leading-4 opacity-82">{preset.description}</span>
                            {!preset.available ? <span className="mt-2 block text-[10px] font-black tracking-[0.08em] uppercase">Afventer lydkilde</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="mt-4 grid gap-2 rounded-2xl border border-[#d9e5dc] bg-[#f8fbf4] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[#173c31]">Stille klaver</p>
                        <p className="text-xs font-semibold leading-4 text-slate-600">Kan lægges oven på naturlyden.</p>
                      </div>
                      <button
                        type="button"
                        aria-pressed={musicEnabled}
                        onClick={() => setMusicEnabled(!musicEnabled)}
                        className={`min-h-10 rounded-full px-3 text-xs font-black transition focus-visible:outline-3 focus-visible:outline-offset-2 ${musicEnabled ? "bg-[#0b4f74] text-white hover:bg-[#073d5a]" : "border border-[#bbcfbc] bg-white text-[#365a42] hover:bg-[#edf4e7]"}`}
                      >
                        {musicEnabled ? "Til" : "Fra"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-[#d9e5dc] pt-3">
                      <div>
                        <p className="text-sm font-black text-[#173c31]">Papir ved valg</p>
                        <p className="text-xs font-semibold leading-4 text-slate-600">Korte papirlyde ved bevidste valg — aldrig ved hover eller tastning.</p>
                      </div>
                      <button
                        type="button"
                        aria-pressed={materialSoundsEnabled}
                        onClick={() => setMaterialSoundsEnabled(!materialSoundsEnabled)}
                        className={`min-h-10 rounded-full px-3 text-xs font-black transition focus-visible:outline-3 focus-visible:outline-offset-2 ${materialSoundsEnabled ? "bg-[#0b4f74] text-white hover:bg-[#073d5a]" : "border border-[#bbcfbc] bg-white text-[#365a42] hover:bg-[#edf4e7]"}`}
                      >
                        {materialSoundsEnabled ? "Til" : "Fra"}
                      </button>
                    </div>
                  </div>

                  {coordinationState === "unavailable" ? (
                    <p role="alert" className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-950">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      Lyd forbliver slukket, når browseren ikke kan koordinere sikkert mellem faner.
                    </p>
                  ) : null}

                  {feedback ? <p role="status" className="mt-3 text-xs font-bold leading-5 text-slate-700">{feedback}</p> : null}

                  <div className="mt-4 border-t border-[#e4dcc8] pt-3 text-xs font-semibold leading-5 text-slate-600">
                    <p className="font-black text-[#173c31]">Lydkilder og licenser</p>
                    <ul className="mt-1.5 grid gap-1">
                      {ATTRIBUTION_ASSET_IDS.map((assetId) => {
                        const asset = getTeacherSoundAsset(assetId);
                        return (
                          <li key={asset.id}>
                            <a href={asset.attribution?.sourceUrl} target="_blank" rel="noreferrer" className="font-black text-[#0b4f74] underline decoration-[#f4bb54] underline-offset-2 hover:text-[#073d5a]">
                              {asset.attribution?.text}
                            </a>{" "}
                            <span>({asset.attribution?.license})</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                <div className="shrink-0 border-t border-[#e4dcc8] bg-[#fffdf6]/95 px-4 py-3 backdrop-blur-sm sm:px-5">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={!canStart || isPlaying}
                      onClick={start}
                      data-testid="teacher-sound-start"
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#0b4f74] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#073d5a] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#0b4f74]"
                    >
                      <Volume2 className="h-4 w-4" aria-hidden="true" />
                      {coordinationState === "checking" ? "Klargør lyd" : startLabel}
                    </button>
                    {isPlaying ? (
                      <button
                        type="button"
                        onClick={stop}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-black text-rose-800 transition hover:bg-rose-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                      >
                        <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                        Stop al lyd
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
