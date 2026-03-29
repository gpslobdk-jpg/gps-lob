"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  GRADE_LEVEL_OPTIONS,
  normalizeGradeLevels,
  toggleGradeLevelSelection,
  type GradeLevel,
} from "@/utils/gradeLevels";

type Tone = "rose" | "amber" | "indigo";

type Props = {
  selectedGradeLevels: GradeLevel[];
  onChange: (nextGradeLevels: GradeLevel[]) => void;
  tone: Tone;
  disabled?: boolean;
  compact?: boolean;
};

type PopoverPosition = {
  top: number;
  left: number;
  width: number;
};

const toneClassMap: Record<
  Tone,
  {
    shell: string;
    idle: string;
    selected: string;
  }
> = {
  rose: {
    shell: "border-rose-200/10 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    idle:
      "border-white/10 bg-white/[0.05] text-white/92 hover:border-rose-300/40 hover:bg-rose-400/10 hover:text-white",
    selected:
      "border-rose-200/65 bg-rose-400/18 text-rose-50 shadow-[0_16px_34px_rgba(244,63,94,0.18)]",
  },
  amber: {
    shell: "border-amber-200/10 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    idle:
      "border-white/10 bg-white/[0.05] text-white/92 hover:border-amber-300/40 hover:bg-amber-400/10 hover:text-white",
    selected:
      "border-amber-200/65 bg-amber-400/18 text-amber-50 shadow-[0_16px_34px_rgba(251,191,36,0.18)]",
  },
  indigo: {
    shell: "border-indigo-200/10 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    idle:
      "border-white/10 bg-white/[0.05] text-white/92 hover:border-indigo-300/40 hover:bg-indigo-500/12 hover:text-white",
    selected:
      "border-indigo-200/65 bg-indigo-500/18 text-indigo-50 shadow-[0_16px_34px_rgba(99,102,241,0.18)]",
  },
};

function formatSelectionSummary(selectedGradeLevels: GradeLevel[]) {
  const normalizedSelections = normalizeGradeLevels(selectedGradeLevels);

  if (normalizedSelections.length === 0) {
    return "Vælg klassetrin...";
  }

  if (normalizedSelections.length <= 2) {
    return normalizedSelections.join(", ");
  }

  return `${normalizedSelections[0]} + ${normalizedSelections.length - 1} mere`;
}

export default function GradeLevelMultiSelect({
  selectedGradeLevels,
  onChange,
  tone,
  disabled = false,
  compact = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const toneClasses = toneClassMap[tone];
  const isPopoverOpen = isOpen && !disabled;
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const normalizedSelections = useMemo(
    () => normalizeGradeLevels(selectedGradeLevels),
    [selectedGradeLevels]
  );
  const triggerLabel = useMemo(
    () => formatSelectionSummary(normalizedSelections),
    [normalizedSelections]
  );

  const updatePopoverPosition = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const horizontalMargin = 16;
    const verticalGap = 12;
    const preferredWidth = Math.max(triggerRect.width, compact ? 288 : 320);
    const maxWidth = Math.max(220, viewportWidth - horizontalMargin * 2);
    const width = Math.min(preferredWidth, maxWidth);
    const left = Math.min(
      Math.max(horizontalMargin, triggerRect.left),
      viewportWidth - width - horizontalMargin
    );

    const estimatedHeight = popoverRef.current?.offsetHeight ?? 260;
    const spaceBelow = viewportHeight - triggerRect.bottom;
    const shouldOpenUpwards = spaceBelow < estimatedHeight + 24 && triggerRect.top > estimatedHeight + 24;
    const top = shouldOpenUpwards
      ? Math.max(12, triggerRect.top - estimatedHeight - verticalGap)
      : Math.min(viewportHeight - estimatedHeight - 12, triggerRect.bottom + verticalGap);

    setPopoverPosition({
      top,
      left,
      width,
    });
  }, [compact]);

  const openPopover = () => {
    updatePopoverPosition();
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isPopoverOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;

      const target = event.target;
      const clickedOutsideTrigger =
        target instanceof Node && !containerRef.current.contains(target);
      const clickedOutsidePopover = target instanceof Node && !popoverRef.current?.contains(target);

      if (clickedOutsideTrigger && clickedOutsidePopover) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const syncPosition = () => {
      updatePopoverPosition();
    };

    const rafId = window.requestAnimationFrame(syncPosition);

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
    };
  }, [isPopoverOpen, updatePopoverPosition]);

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  const popoverContent = isPopoverOpen && portalTarget && popoverPosition
    ? createPortal(
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            top: `${popoverPosition.top}px`,
            left: `${popoverPosition.left}px`,
            width: `${popoverPosition.width}px`,
          }}
          className="z-50"
        >
          <div className="rounded-2xl border border-white/20 bg-black/40 p-3 shadow-[0_24px_60px_rgba(15,23,42,0.35)] backdrop-blur-md">
            <div className={`grid grid-cols-2 gap-2 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
              {GRADE_LEVEL_OPTIONS.map((option) => {
                const isSelected = normalizedSelections.includes(option);

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onChange(toggleGradeLevelSelection(normalizedSelections, option))}
                    aria-pressed={isSelected}
                    className={`flex min-h-11 items-center justify-between gap-2 rounded-[1.1rem] border px-3 py-2.5 text-left text-sm font-semibold backdrop-blur-md transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(15,23,42,0.18)] ${
                      isSelected ? toneClasses.selected : toneClasses.idle
                    }`}
                  >
                    <span className="truncate">{option}</span>
                    <span
                      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                        isSelected
                          ? "border-white/40 bg-white/14 text-white"
                          : "border-white/15 bg-white/4 text-transparent"
                      }`}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
              <p className="text-xs text-white/60">
                {normalizedSelections.length > 0
                  ? `${normalizedSelections.length} klassetrin valgt`
                  : "Ingen klassetrin valgt endnu"}
              </p>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/14"
              >
                Færdig
              </button>
            </div>
          </div>
        </div>,
        portalTarget
      )
    : null;

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isPopoverOpen}
        onClick={() => {
          if (isPopoverOpen) {
            setIsOpen(false);
            return;
          }

          openPopover();
        }}
        className={`flex w-full items-center justify-between gap-3 rounded-[1.35rem] border px-4 py-3 text-left backdrop-blur-md transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.14)] disabled:cursor-not-allowed disabled:opacity-40 ${toneClasses.shell} ${
          isPopoverOpen ? toneClasses.selected : toneClasses.idle
        } ${compact ? "min-h-12 px-3.5 py-3 text-sm sm:text-[15px]" : "min-h-14 text-base"}`}
      >
        <span className="min-w-0 flex-1 truncate font-semibold">{triggerLabel}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isPopoverOpen ? "rotate-180" : "rotate-0"}`}
        />
      </button>
      {popoverContent}
    </div>
  );
}
