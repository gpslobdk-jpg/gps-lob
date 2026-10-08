"use client";

import {
  BookOpen,
  CircleAlert,
  CloudRain,
  Music2,
  SlidersHorizontal,
  Square,
  Trees,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useId, useState } from "react";

import { useTeacherSound } from "@/components/teacher-sound/TeacherSoundProvider";
import {
  getTeacherSoundAsset,
  TEACHER_SOUND_PRESETS,
  type TeacherSoundPreset,
  type TeacherSoundPresetId,
} from "@/lib/teacherSound/catalog";

type TeacherSoundControlProps = {
  variant: "homepage" | "dashboard" | "floating";
};

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
    setAmbiencePreset,
    setMaterialSoundsEnabled,
    setMusicEnabled,
    start,
    stop,
  } = useTeacherSound();
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const headingId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      setIsOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  if (!isAvailableOnRoute) {
    return null;
  }

  const compact = variant === "dashboard";
  const homepage = variant === "homepage";
  const controlLabel = isPlaying ? "Lyd og ro spiller" : "Lyd og ro";
  const canStart = coordinationState === "ready";
  const selectedValues = { ambiencePresetId, musicEnabled };
  const startLabel = isPlaying ? "Lyd spiller" : hasUsedSound ? "Fortsæt lyd" : "Start lyd";

  return (
    <div className={`relative ${compact ? "" : homepage ? "w-full max-w-xl" : "w-full sm:w-auto"}`} data-testid="teacher-sound-control">
      <div className={compact ? "flex items-center gap-1.5" : homepage ? "flex w-full flex-col items-stretch gap-2" : "flex items-center gap-2"}>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-label={homepage ? controlLabel : undefined}
          aria-describedby={homepage ? descriptionId : undefined}
          onClick={() => setIsOpen((open) => !open)}
          className={
            compact
              ? "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#f4bb54]/55 bg-[#0b213a]/88 px-3 text-sm font-black text-white shadow-sm transition hover:bg-[#173f5c] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f4bb54]"
              : homepage
                ? "group inline-flex min-h-[5.75rem] w-full items-center gap-3 rounded-3xl border border-[#f4bb54]/80 bg-[#fffdf7]/95 p-3 text-left text-[#0b213a] shadow-[0_16px_32px_rgba(0,0,0,0.22)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#f4bb54] sm:p-4"
              : "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#f4bb54]/55 bg-[#0b213a]/82 px-4 py-2 text-sm font-black text-white shadow-[0_12px_26px_rgba(0,0,0,0.18)] backdrop-blur transition hover:bg-[#173f5c] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#f4bb54]"
          }
        >
          {homepage ? (
            <>
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0b4f74] text-white shadow-sm" aria-hidden="true">
                {isPlaying ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-black">Lyd og ro</span>
                <span id={descriptionId} className="mt-0.5 block text-xs font-semibold leading-5 text-slate-700 sm:text-sm">
                  Vælg musik, naturlyde eller bløde papirlyde. Intet starter af sig selv.
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e7efe3] px-3 py-2 text-xs font-black text-[#173c31] transition group-hover:bg-[#d9e5dc]">
                {isPlaying ? "Spiller" : "Vælg lyd"}
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </>
          ) : (
            <>
              {isPlaying ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
              <span>{compact ? "Lyd" : controlLabel}</span>
              <SlidersHorizontal className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
            </>
          )}
        </button>

        {isPlaying ? (
          <button
            type="button"
            onClick={stop}
            data-testid="teacher-sound-stop"
            className={
              compact
                ? "inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 text-xs font-black text-rose-800 shadow-sm transition hover:bg-rose-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                : homepage
                  ? "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-rose-200 bg-white/94 px-4 py-2 text-sm font-black text-rose-800 shadow-sm transition hover:bg-rose-50 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white"
                : "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-rose-200 bg-white/94 px-4 py-2 text-sm font-black text-rose-800 shadow-sm transition hover:bg-rose-50 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white"
            }
            aria-label="Stop al lærerlyd"
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            <span>Stop lyd</span>
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <section
          id={panelId}
          aria-labelledby={headingId}
          className={`absolute z-[90] mt-3 flex max-h-[calc(100vh-6rem)] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[1.6rem] border border-[#d9c99f] bg-[#fffdf6] text-left text-[#0b213a] shadow-[0_24px_70px_rgba(7,25,45,0.3)] ${compact ? "right-0" : homepage ? "left-0" : "left-0 sm:left-auto sm:right-0"}`}
        >
          <div className="overflow-y-auto px-4 pt-4 pb-4">
            <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black tracking-[0.17em] text-[#8a5b18] uppercase">Lærerværktøj</p>
              <h2 id={headingId} className="mt-1 text-lg font-black">Lyd og ro</h2>
            </div>
            <span className="rounded-full bg-[#edf4e7] px-3 py-1 text-[10px] font-black tracking-[0.12em] text-[#365a42] uppercase">
              Stilhed først
            </span>
            </div>

            <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
              Intet starter af sig selv. Vælg en stemning, og start først når du vil have lyd i rummet.
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
                <p className="text-xs font-semibold leading-4 text-slate-600">Kan blandes med natur- eller rumlyd.</p>
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

            <label className="grid gap-1.5 border-t border-[#d9e5dc] pt-3 text-sm font-black text-[#173c31]">
              Natur- eller rumlyd
              <select
                value={ambiencePresetId ?? ""}
                onChange={(event) => setAmbiencePreset((event.target.value || null) as TeacherSoundPresetId | null)}
                className="min-h-10 rounded-xl border border-[#bbcfbc] bg-white px-3 text-sm font-semibold text-[#173c31] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#0b4f74]"
              >
                <option value="">Ingen natur- eller rumlyd</option>
                <option value="afteraarsskov">Efterårsskov</option>
                <option value="regn-ved-vinduet">Regn ved vinduet</option>
                <option value="bibliotekets-ro" disabled>
                  Bibliotekets ro — afventer lydkilde
                </option>
              </select>
            </label>

            <div className="flex items-center justify-between gap-3 border-t border-[#d9e5dc] pt-3">
              <div>
                <p className="text-sm font-black text-[#173c31]">Papir ved valg</p>
                <p className="text-xs font-semibold leading-4 text-slate-600">Valgfri, korte papirlyde ved bevidste valg. Aldrig ved hover eller tastning.</p>
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

            <details className="mt-4 border-t border-[#e4dcc8] pt-3">
            <summary className="cursor-pointer text-xs font-black text-[#0b4f74] underline decoration-[#f4bb54] underline-offset-4">
              Lydkilder og licenser
            </summary>
            <ul className="mt-3 grid gap-2 text-xs font-semibold leading-5 text-slate-600">
              {["afteraarsskov", "regn-ved-vinduet", "stille-klaver", "papir-1"].map((assetId) => {
                const asset = getTeacherSoundAsset(assetId as "afteraarsskov" | "regn-ved-vinduet" | "stille-klaver" | "papir-1");
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
            <p className="mt-3 text-xs font-semibold leading-5 text-slate-600">
              Den komplette assetbrief ligger i projektets dokumentation. Bibliotekets ro er bevidst ikke afspilningsklar, før en stemmefri og rettighedsafklaret optagelse er gennemgået.
            </p>
            </details>
          </div>

          <div className="shrink-0 border-t border-[#e4dcc8] bg-[#fffdf6]/95 px-4 py-3 backdrop-blur-sm">
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
        </section>
      ) : null}
    </div>
  );
}
