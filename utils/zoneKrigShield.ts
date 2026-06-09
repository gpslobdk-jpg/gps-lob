export const MAX_ZONE_KRIG_SHIELD_SECONDS = 3 * 60;

export function formatZoneKrigShieldCountdown(
  shieldUntil: string | null | undefined,
  nowMs = Date.now()
) {
  if (!shieldUntil) return null;

  const shieldUntilMs = new Date(shieldUntil).getTime();
  if (!Number.isFinite(shieldUntilMs) || shieldUntilMs <= nowMs) return null;

  const remainingSeconds = Math.min(
    MAX_ZONE_KRIG_SHIELD_SECONDS,
    Math.max(0, Math.ceil((shieldUntilMs - nowMs) / 1000))
  );

  if (remainingSeconds <= 0) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
