"use client";

type SwitchProps = {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  className?: string;
  size?: "default" | "touch";
};

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  id,
  ariaLabel,
  ariaDescribedBy,
  className = "",
  size = "default",
}: SwitchProps) {
  const isTouchSize = size === "touch";

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={`relative inline-flex shrink-0 items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-55 ${
        isTouchSize ? "h-11 w-[4.75rem]" : "h-7 w-12"
      } ${
        checked
          ? "border-emerald-200/60 bg-emerald-400/85 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
          : "border-white/20 bg-slate-950/50"
      } ${className}`}
    >
      <span
        className={`pointer-events-none inline-block rounded-full bg-white shadow-lg transition-transform ${
          isTouchSize ? "h-9 w-9" : "h-5 w-5"
        } ${
          checked ? (isTouchSize ? "translate-x-9" : "translate-x-6") : "translate-x-1"
        }`}
      />
    </button>
  );
}
