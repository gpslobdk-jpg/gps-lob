"use client";

import {
  GRADE_LEVEL_OPTIONS,
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

const toneClassMap: Record<
  Tone,
  {
    idle: string;
    selected: string;
  }
> = {
  rose: {
    idle:
      "border-white/10 bg-white/4 text-white hover:border-rose-300/40 hover:bg-rose-400/10",
    selected:
      "border-rose-200/65 bg-rose-400/18 text-rose-50 shadow-[0_12px_24px_rgba(244,63,94,0.18)]",
  },
  amber: {
    idle:
      "border-white/10 bg-white/4 text-white hover:border-amber-300/40 hover:bg-amber-400/10",
    selected:
      "border-amber-200/65 bg-amber-400/18 text-amber-50 shadow-[0_12px_24px_rgba(251,191,36,0.18)]",
  },
  indigo: {
    idle:
      "border-white/10 bg-white/4 text-white hover:border-indigo-300/40 hover:bg-indigo-500/12",
    selected:
      "border-indigo-200/65 bg-indigo-500/18 text-indigo-50 shadow-[0_12px_24px_rgba(99,102,241,0.18)]",
  },
};

export default function GradeLevelMultiSelect({
  selectedGradeLevels,
  onChange,
  tone,
  disabled = false,
  compact = false,
}: Props) {
  const toneClasses = toneClassMap[tone];

  return (
    <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {GRADE_LEVEL_OPTIONS.map((option) => {
        const isSelected = selectedGradeLevels.includes(option);

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(toggleGradeLevelSelection(selectedGradeLevels, option))}
            disabled={disabled}
            aria-pressed={isSelected}
            className={`w-full rounded-[1.4rem] border px-4 py-4 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              isSelected ? toneClasses.selected : toneClasses.idle
            } ${compact ? "text-sm sm:text-[15px]" : ""}`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
