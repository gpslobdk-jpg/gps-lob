/**
 * Returns an unofficial "Skolegårds-Titel" based on the player's score ratio
 * and their average time spent per post.
 *
 * @param scoreRatio        - Fraction of maximum possible points earned (0.0–1.0+).
 * @param avgSecondsPerPost - Average seconds spent per post, or null when unknown.
 */
export function getGamerTitle(
  scoreRatio: number,
  avgSecondsPerPost: number | null,
): string {
  const isManyPoints = scoreRatio >= 0.6;
  // Under 3 minutes per post on average is considered fast.
  const isFast = avgSecondsPerPost !== null && avgSecondsPerPost < 180;

  if (isManyPoints && isFast) return "Speedrun Demon (Kæmpe W)";
  if (isManyPoints && !isFast) return "Tænkeren (Slow but steady, W Rizz)";
  if (!isManyPoints && isFast) return "Lynhurtig, men lidt forvirret (Cooked)";
  return "Skovturs-holdet (I nød i det mindste vejret, ikke?)";
}
