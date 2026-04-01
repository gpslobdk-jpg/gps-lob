const PREMIUM_PLAN_TYPES = new Set(["pro", "school", "beta"]);

export type AccessProfile = {
  plan_type?: string | null;
  access_expires_at?: string | null;
  has_used_free_trial?: boolean | null;
};

export function isPaywallEnabled() {
  return process.env.NEXT_PUBLIC_PAYWALL_ENABLED === "true";
}

export function hasPremiumAccess(profile: AccessProfile | null): boolean {
  const normalizedPlan = profile?.plan_type?.trim().toLocaleLowerCase("da-DK") ?? "";
  if (!PREMIUM_PLAN_TYPES.has(normalizedPlan)) {
    return false;
  }

  const expiresAt = profile?.access_expires_at?.trim() ?? "";
  if (!expiresAt) {
    return false;
  }

  const expiryDate = new Date(expiresAt);
  if (Number.isNaN(expiryDate.getTime())) {
    return false;
  }

  return expiryDate.getTime() > Date.now();
}

export function canCreatePremiumRun(profile: AccessProfile | null): boolean {
  if (hasPremiumAccess(profile)) {
    return true;
  }

  return profile?.has_used_free_trial !== true;
}
