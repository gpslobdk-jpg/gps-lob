import { UsersRound } from "lucide-react";

type StudentTeamBadgeProps = {
  color?: string | null;
  teamId?: string | null;
  label?: string;
};

const fallbackColors = ["#0ea5e9", "#2563eb", "#6366f1", "#f97316"];
const badgeSymbols = ["✦", "◆", "▲", "●"];
const hexColorPattern = /^#[0-9a-f]{6}$/i;

function stableNumber(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export default function StudentTeamBadge({
  color,
  teamId,
  label = "Dit hold",
}: StudentTeamBadgeProps) {
  const seed = stableNumber(teamId ?? label);
  const badgeColor = color && hexColorPattern.test(color)
    ? color
    : fallbackColors[seed % fallbackColors.length];
  const symbol = badgeSymbols[seed % badgeSymbols.length];

  return (
    <span
      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 bg-slate-950/82 px-3 py-1.5 text-xs font-bold text-white shadow-[0_10px_22px_rgba(2,6,23,0.3)] backdrop-blur-xl"
      data-testid="student-team-badge"
    >
      <span
        aria-hidden="true"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white shadow-sm"
        style={{ backgroundColor: badgeColor }}
      >
        {symbol}
      </span>
      <UsersRound aria-hidden="true" className="h-3.5 w-3.5 text-sky-100" />
      {label}
    </span>
  );
}
