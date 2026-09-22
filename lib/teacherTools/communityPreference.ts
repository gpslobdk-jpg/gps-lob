export const COMMUNITY_INVITE_STORAGE_PREFIX = "skolegps.teacher-tools.facebook-invite.v1";
export const COMMUNITY_INVITE_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

type CommunityInviteSnoozedPreference = {
  version: 1;
  choice: "snoozed";
  until: number;
};

type CommunityInviteMemberPreference = {
  version: 1;
  choice: "member";
};

export type CommunityInvitePreference =
  | CommunityInviteSnoozedPreference
  | CommunityInviteMemberPreference;

function getStorage() {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isValidTeacherId(teacherId: string) {
  return teacherId.trim().length > 0;
}

function isCommunityInvitePreference(value: unknown): value is CommunityInvitePreference {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CommunityInvitePreference>;

  if (candidate.version !== 1) return false;
  if (candidate.choice === "member") return true;

  return candidate.choice === "snoozed"
    && typeof candidate.until === "number"
    && Number.isFinite(candidate.until)
    && candidate.until > 0;
}

export function getCommunityInviteStorageKey(teacherId: string) {
  return `${COMMUNITY_INVITE_STORAGE_PREFIX}.${encodeURIComponent(teacherId)}`;
}

export function readCommunityInvitePreference(teacherId: string) {
  if (!isValidTeacherId(teacherId)) return null;
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(getCommunityInviteStorageKey(teacherId));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    return isCommunityInvitePreference(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * This is a display preference, not a record of actual Facebook membership.
 * If local storage is unavailable, automatic prompting stays off so a teacher
 * is never repeatedly interrupted by a choice the browser cannot remember.
 */
export function shouldAutoShowCommunityInvite(teacherId: string, now = Date.now()) {
  if (!isValidTeacherId(teacherId)) return false;
  const storage = getStorage();
  if (!storage) return false;

  const preference = readCommunityInvitePreference(teacherId);
  if (!preference) return true;
  if (preference.choice === "member") return false;
  if (preference.until > now) return false;

  try {
    storage.removeItem(getCommunityInviteStorageKey(teacherId));
  } catch {
    // The expired preference is harmless if the browser declines the cleanup.
  }

  return true;
}

export function snoozeCommunityInvite(teacherId: string, now = Date.now()) {
  if (!isValidTeacherId(teacherId)) return;
  const storage = getStorage();
  if (!storage) return;
  if (readCommunityInvitePreference(teacherId)?.choice === "member") return;

  const preference: CommunityInviteSnoozedPreference = {
    version: 1,
    choice: "snoozed",
    until: now + COMMUNITY_INVITE_SNOOZE_MS,
  };

  try {
    storage.setItem(getCommunityInviteStorageKey(teacherId), JSON.stringify(preference));
  } catch {
    // The invitation is optional; a storage error must not block the dashboard.
  }
}

export function markCommunityInviteAlreadyMember(teacherId: string) {
  if (!isValidTeacherId(teacherId)) return;
  const storage = getStorage();
  if (!storage) return;

  const preference: CommunityInviteMemberPreference = {
    version: 1,
    choice: "member",
  };

  try {
    storage.setItem(getCommunityInviteStorageKey(teacherId), JSON.stringify(preference));
  } catch {
    // This remains a voluntary display preference when storage is unavailable.
  }
}
