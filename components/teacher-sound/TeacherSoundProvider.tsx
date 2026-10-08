"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  getTeacherSoundAsset,
  getTeacherSoundPreset,
  isTeacherSoundRoute,
  TEACHER_SOUND_CHANNEL_NAME,
  TEACHER_SOUND_CLAIM_STORAGE_KEY,
  TEACHER_SOUND_MATERIAL_ASSET_IDS,
  TEACHER_SOUND_STORAGE_KEY,
  type TeacherSoundAssetId,
  type TeacherSoundPresetId,
} from "@/lib/teacherSound/catalog";

type TeacherSoundPreferences = {
  musicEnabled: boolean;
  ambiencePresetId: TeacherSoundPresetId | null;
  materialSoundsEnabled: boolean;
};

type StoredTeacherSoundPreferences = TeacherSoundPreferences & {
  version: 1;
  hasUsedSound: boolean;
};

type CoordinationState = "checking" | "ready" | "unavailable";

type TeacherSoundContextValue = {
  ambiencePresetId: TeacherSoundPresetId | null;
  coordinationState: CoordinationState;
  feedback: string | null;
  hasUsedSound: boolean;
  isAvailableOnRoute: boolean;
  isPlaying: boolean;
  materialSoundsEnabled: boolean;
  musicEnabled: boolean;
  choosePreset: (presetId: TeacherSoundPresetId) => void;
  setAmbiencePreset: (presetId: TeacherSoundPresetId | null) => void;
  setMaterialSoundsEnabled: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  start: () => void;
  stop: () => void;
};

type AudioClaim = {
  ownerId: string;
  updatedAt: number;
};

type CoordinationMessage = {
  type: "claim" | "release" | "heartbeat";
  ownerId: string;
};

const DEFAULT_PREFERENCES: TeacherSoundPreferences = {
  musicEnabled: false,
  ambiencePresetId: "afteraarsskov",
  materialSoundsEnabled: false,
};
const CLAIM_TTL_MS = 45_000;
const HEARTBEAT_MS = 12_000;

const TeacherSoundContext = createContext<TeacherSoundContextValue | undefined>(undefined);

function isPresetId(value: unknown): value is TeacherSoundPresetId {
  return (
    value === "afteraarsskov" ||
    value === "regn-ved-vinduet" ||
    value === "stille-klaver" ||
    value === "bibliotekets-ro"
  );
}

function isAvailableAmbiencePreset(value: TeacherSoundPresetId | null) {
  if (!value) {
    return true;
  }

  return Boolean(getTeacherSoundPreset(value)?.available && getTeacherSoundPreset(value)?.ambienceAssetId);
}

function readStoredPreferences(): StoredTeacherSoundPreferences {
  try {
    const raw = window.localStorage.getItem(TEACHER_SOUND_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_PREFERENCES, version: 1, hasUsedSound: false };
    }

    const parsed = JSON.parse(raw) as Partial<StoredTeacherSoundPreferences>;
    const ambiencePresetId = isPresetId(parsed.ambiencePresetId)
      ? parsed.ambiencePresetId
      : DEFAULT_PREFERENCES.ambiencePresetId;

    return {
      version: 1,
      musicEnabled: Boolean(parsed.musicEnabled),
      ambiencePresetId: isAvailableAmbiencePreset(ambiencePresetId)
        ? ambiencePresetId
        : DEFAULT_PREFERENCES.ambiencePresetId,
      materialSoundsEnabled: Boolean(parsed.materialSoundsEnabled),
      hasUsedSound: Boolean(parsed.hasUsedSound),
    };
  } catch {
    return { ...DEFAULT_PREFERENCES, version: 1, hasUsedSound: false };
  }
}

function readClaim() {
  try {
    const raw = window.localStorage.getItem(TEACHER_SOUND_CLAIM_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AudioClaim>;
    if (typeof parsed.ownerId !== "string" || typeof parsed.updatedAt !== "number") {
      return null;
    }

    return { ownerId: parsed.ownerId, updatedAt: parsed.updatedAt } satisfies AudioClaim;
  } catch {
    return null;
  }
}

function getPlaybackAssetIds(preferences: TeacherSoundPreferences) {
  const assetIds: TeacherSoundAssetId[] = [];

  if (preferences.musicEnabled) {
    assetIds.push("stille-klaver");
  }

  if (preferences.ambiencePresetId) {
    const preset = getTeacherSoundPreset(preferences.ambiencePresetId);
    if (preset?.available && preset.ambienceAssetId) {
      assetIds.push(preset.ambienceAssetId);
    }
  }

  return assetIds;
}

function createOwnerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `teacher-sound-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * The one teacher-audio owner. It is intentionally mounted at root level so
 * Next client navigation can retain the same media elements and playback
 * position. It creates no Audio object or source URL until a teacher presses
 * the explicit start action.
 */
export function TeacherSoundProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // `usePathname()` can be null while the App Router starts on the server.
  // Render the opt-in control in that short state; audio itself remains
  // unavailable until the client effect below has confirmed the route.
  const isAvailableOnRoute = !pathname || isTeacherSoundRoute(pathname);
  const [preferences, setPreferences] = useState<TeacherSoundPreferences>(DEFAULT_PREFERENCES);
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);
  const [hasUsedSound, setHasUsedSound] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [coordinationState, setCoordinationState] = useState<CoordinationState>("checking");
  const [feedback, setFeedback] = useState<string | null>(null);
  const playersRef = useRef(new Map<TeacherSoundAssetId, HTMLAudioElement>());
  const isPlayingRef = useRef(false);
  const isAvailableOnRouteRef = useRef(false);
  const ownsClaimRef = useRef(false);
  const ownerIdRef = useRef<string | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const coordinationReadyRef = useRef(false);
  const materialIndexRef = useRef(0);

  const updatePlaying = useCallback((next: boolean) => {
    isPlayingRef.current = next;
    setIsPlaying(next);
  }, []);

  const releaseClaim = useCallback(() => {
    const ownerId = ownerIdRef.current;
    if (!ownerId) {
      return;
    }

    try {
      const claim = readClaim();
      if (claim?.ownerId === ownerId) {
        window.localStorage.removeItem(TEACHER_SOUND_CLAIM_STORAGE_KEY);
      }
      channelRef.current?.postMessage({ type: "release", ownerId } satisfies CoordinationMessage);
    } catch {
      // Audio has already been stopped locally. A failed release must not make
      // a later tab start audio optimistically.
    } finally {
      ownsClaimRef.current = false;
    }
  }, []);

  const pauseAll = useCallback(
    ({ reset, release }: { reset: boolean; release: boolean }) => {
      for (const player of playersRef.current.values()) {
        try {
          player.pause();
          if (reset) {
            player.currentTime = 0;
          }
        } catch {
          // A stale media element is never allowed to disturb the teacher UI.
        }
      }

      updatePlaying(false);
      if (release) {
        releaseClaim();
      }
    },
    [releaseClaim, updatePlaying],
  );

  const pauseForContinuation = useCallback(
    (message: string) => {
      if (isPlayingRef.current) {
        pauseAll({ reset: false, release: true });
      }
      setHasUsedSound(true);
      setFeedback(message);
    },
    [pauseAll],
  );

  const markCoordinationUnavailable = useCallback(
    (message: string) => {
      coordinationReadyRef.current = false;
      setCoordinationState("unavailable");
      pauseAll({ reset: false, release: true });
      setFeedback(message);
    },
    [pauseAll],
  );

  useEffect(() => {
    const stored = readStoredPreferences();
    setPreferences({
      musicEnabled: stored.musicEnabled,
      ambiencePresetId: stored.ambiencePresetId,
      materialSoundsEnabled: stored.materialSoundsEnabled,
    });
    setHasUsedSound(stored.hasUsedSound);
    setHasLoadedPreferences(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedPreferences) {
      return;
    }

    const stored: StoredTeacherSoundPreferences = {
      ...preferences,
      version: 1,
      hasUsedSound,
    };

    try {
      window.localStorage.setItem(TEACHER_SOUND_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // The teacher can still choose sound for this visit when storage is off.
    }
  }, [hasLoadedPreferences, hasUsedSound, preferences]);

  useEffect(() => {
    const routeIsAllowed = isAvailableOnRoute;
    isAvailableOnRouteRef.current = routeIsAllowed;

    if (!routeIsAllowed && isPlayingRef.current) {
      pauseForContinuation("Lyd er sat på pause uden for lærerfladen.");
    }
  }, [isAvailableOnRoute, pauseForContinuation]);

  useEffect(() => {
    ownerIdRef.current = createOwnerId();
    const ownerId = ownerIdRef.current;
    let channel: BroadcastChannel | null = null;

    const pauseForOtherOwner = () => {
      if (!isPlayingRef.current) {
        return;
      }

      pauseForContinuation("Lyd er sat på pause, fordi en anden fane bruger Lyd og ro.");
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== TEACHER_SOUND_CLAIM_STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        const claim = JSON.parse(event.newValue) as Partial<AudioClaim>;
        if (claim.ownerId && claim.ownerId !== ownerId) {
          pauseForOtherOwner();
        }
      } catch {
        pauseForOtherOwner();
      }
    };

    try {
      if (typeof BroadcastChannel === "undefined") {
        throw new Error("BROADCAST_CHANNEL_UNAVAILABLE");
      }

      // Probe synchronous localStorage access up front. If a browser blocks
      // it, cross-tab ownership cannot be verified and we stay silent.
      const probeKey = `${TEACHER_SOUND_CLAIM_STORAGE_KEY}.probe`;
      window.localStorage.setItem(probeKey, ownerId);
      if (window.localStorage.getItem(probeKey) !== ownerId) {
        throw new Error("LOCAL_STORAGE_UNAVAILABLE");
      }
      window.localStorage.removeItem(probeKey);

      channel = new BroadcastChannel(TEACHER_SOUND_CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<CoordinationMessage>) => {
        const message = event.data;
        if (!message || message.ownerId === ownerId) {
          return;
        }

        if (message.type === "claim" || message.type === "heartbeat") {
          pauseForOtherOwner();
        }
      };
      channelRef.current = channel;
      coordinationReadyRef.current = true;
      setCoordinationState("ready");
      window.addEventListener("storage", onStorage);
    } catch {
      channel?.close();
      channelRef.current = null;
      coordinationReadyRef.current = false;
      setCoordinationState("unavailable");
      setFeedback("Lyd er slået fra, fordi sikker koordinering mellem faner ikke er tilgængelig.");
    }

    return () => {
      window.removeEventListener("storage", onStorage);
      pauseAll({ reset: false, release: true });
      channel?.close();
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
      coordinationReadyRef.current = false;
    };
  }, [pauseAll, pauseForContinuation]);

  useEffect(() => {
    const stopForHiddenPage = () => {
      if (document.hidden && isPlayingRef.current) {
        pauseForContinuation("Lyd er sat på pause, mens fanen ikke er synlig.");
      }
    };

    const stopForPageExit = () => {
      pauseAll({ reset: false, release: true });
    };

    document.addEventListener("visibilitychange", stopForHiddenPage);
    window.addEventListener("pagehide", stopForPageExit);
    return () => {
      document.removeEventListener("visibilitychange", stopForHiddenPage);
      window.removeEventListener("pagehide", stopForPageExit);
    };
  }, [pauseAll, pauseForContinuation]);

  useEffect(() => {
    const heartbeat = window.setInterval(() => {
      const ownerId = ownerIdRef.current;
      if (!ownerId || !ownsClaimRef.current || !isPlayingRef.current) {
        return;
      }

      try {
        const claim: AudioClaim = { ownerId, updatedAt: Date.now() };
        window.localStorage.setItem(TEACHER_SOUND_CLAIM_STORAGE_KEY, JSON.stringify(claim));
        channelRef.current?.postMessage({ type: "heartbeat", ownerId } satisfies CoordinationMessage);
      } catch {
        markCoordinationUnavailable(
          "Lyd er sat på pause, fordi sikker koordinering mellem faner fejlede.",
        );
      }
    }, HEARTBEAT_MS);

    return () => window.clearInterval(heartbeat);
  }, [markCoordinationUnavailable]);

  const claimPlaybackOwnership = useCallback(() => {
    const ownerId = ownerIdRef.current;
    if (!ownerId || !coordinationReadyRef.current || !channelRef.current) {
      markCoordinationUnavailable(
        "Lyd er slået fra, fordi sikker koordinering mellem faner ikke er tilgængelig.",
      );
      return false;
    }

    try {
      const currentClaim = readClaim();
      const otherTabIsActive =
        currentClaim &&
        currentClaim.ownerId !== ownerId &&
        Date.now() - currentClaim.updatedAt < CLAIM_TTL_MS;

      if (otherTabIsActive) {
        setFeedback("Lyd spiller allerede i en anden fane. Stop den dér, før du starter her.");
        return false;
      }

      const claim: AudioClaim = { ownerId, updatedAt: Date.now() };
      window.localStorage.setItem(TEACHER_SOUND_CLAIM_STORAGE_KEY, JSON.stringify(claim));
      const confirmation = readClaim();
      if (confirmation?.ownerId !== ownerId) {
        setFeedback("Lyd blev ikke startet, fordi en anden fane tog over.");
        return false;
      }

      ownsClaimRef.current = true;
      channelRef.current.postMessage({ type: "claim", ownerId } satisfies CoordinationMessage);
      return true;
    } catch {
      markCoordinationUnavailable(
        "Lyd er slået fra, fordi sikker koordinering mellem faner fejlede.",
      );
      return false;
    }
  }, [markCoordinationUnavailable]);

  const ensurePlayer = useCallback((assetId: TeacherSoundAssetId) => {
    const existing = playersRef.current.get(assetId);
    if (existing) {
      return existing;
    }

    const asset = getTeacherSoundAsset(assetId);
    const player = new Audio();
    player.preload = "none";
    player.loop = asset.loop;
    player.volume = asset.volume;
    // This assignment occurs only after the direct start interaction.
    player.src = asset.src;
    playersRef.current.set(assetId, player);
    return player;
  }, []);

  const applyPlaybackFromUserGesture = useCallback(
    (nextPreferences: TeacherSoundPreferences) => {
      const activeAssetIds = new Set(getPlaybackAssetIds(nextPreferences));
      if (activeAssetIds.size === 0) {
        pauseAll({ reset: false, release: true });
        setFeedback("Vælg musik eller natur-/rumlyd, før du starter.");
        return;
      }

      for (const [assetId, player] of playersRef.current) {
        if (!activeAssetIds.has(assetId)) {
          try {
            player.pause();
          } catch {
            // Silence remains safe if an old media element has been discarded.
          }
        }
      }

      const attempts = [...activeAssetIds].map((assetId) => {
        const player = ensurePlayer(assetId);
        try {
          return Promise.resolve(player.play());
        } catch {
          return Promise.reject(new Error("TEACHER_AUDIO_PLAY_FAILED"));
        }
      });

      updatePlaying(true);
      void Promise.allSettled(attempts).then((results) => {
        if (results.some((result) => result.status === "fulfilled")) {
          setFeedback(null);
          return;
        }

        pauseAll({ reset: false, release: true });
        setFeedback("Browseren kunne ikke starte lyden. Prøv igen med en ny lydhandling.");
      });
    },
    [ensurePlayer, pauseAll, updatePlaying],
  );

  const playMaterialFeedback = useCallback(() => {
    if (!isPlayingRef.current || !preferences.materialSoundsEnabled || document.hidden) {
      return;
    }

    const assetId =
      TEACHER_SOUND_MATERIAL_ASSET_IDS[
        materialIndexRef.current % TEACHER_SOUND_MATERIAL_ASSET_IDS.length
      ];
    materialIndexRef.current += 1;

    try {
      const player = ensurePlayer(assetId);
      player.pause();
      player.currentTime = 0;
      void player.play().catch(() => {
        // Materialelyde er valgfri og må altid falde tilbage til stilhed.
      });
    } catch {
      // A missing optional material sound must not affect the ambience.
    }
  }, [ensurePlayer, preferences.materialSoundsEnabled]);

  const start = useCallback(() => {
    if (!isAvailableOnRouteRef.current) {
      setFeedback("Lyd og ro er kun tilgængelig på lærerflader.");
      return;
    }

    if (!claimPlaybackOwnership()) {
      return;
    }

    setHasUsedSound(true);
    applyPlaybackFromUserGesture(preferences);
  }, [applyPlaybackFromUserGesture, claimPlaybackOwnership, preferences]);

  const stop = useCallback(() => {
    pauseAll({ reset: true, release: true });
    setHasUsedSound(false);
    setFeedback("Al lærerlyd er stoppet.");
  }, [pauseAll]);

  const updatePreferencesFromUserAction = useCallback(
    (nextPreferences: TeacherSoundPreferences, shouldPlayMaterial = true) => {
      setPreferences(nextPreferences);
      if (!isPlayingRef.current) {
        return;
      }

      // This runs directly in a teacher click/change handler, so browser
      // autoplay policy still sees a deliberate sound interaction.
      applyPlaybackFromUserGesture(nextPreferences);
      if (shouldPlayMaterial) {
        playMaterialFeedback();
      }
    },
    [applyPlaybackFromUserGesture, playMaterialFeedback],
  );

  const choosePreset = useCallback(
    (presetId: TeacherSoundPresetId) => {
      const preset = getTeacherSoundPreset(presetId);
      if (!preset?.available) {
        setFeedback(preset?.unavailableReason ?? "Denne lyd er ikke klar endnu.");
        return;
      }

      updatePreferencesFromUserAction({
        ...preferences,
        musicEnabled: Boolean(preset.musicAssetId),
        ambiencePresetId: preset.ambienceAssetId ? presetId : null,
      });
    },
    [preferences, updatePreferencesFromUserAction],
  );

  const setMusicEnabled = useCallback(
    (enabled: boolean) => {
      updatePreferencesFromUserAction({ ...preferences, musicEnabled: enabled });
    },
    [preferences, updatePreferencesFromUserAction],
  );

  const setAmbiencePreset = useCallback(
    (presetId: TeacherSoundPresetId | null) => {
      if (presetId && !isAvailableAmbiencePreset(presetId)) {
        setFeedback(getTeacherSoundPreset(presetId)?.unavailableReason ?? "Denne lyd er ikke klar endnu.");
        return;
      }

      updatePreferencesFromUserAction({ ...preferences, ambiencePresetId: presetId });
    },
    [preferences, updatePreferencesFromUserAction],
  );

  const setMaterialSoundsEnabled = useCallback(
    (enabled: boolean) => {
      updatePreferencesFromUserAction(
        { ...preferences, materialSoundsEnabled: enabled },
        false,
      );
    },
    [preferences, updatePreferencesFromUserAction],
  );

  const value = useMemo<TeacherSoundContextValue>(
    () => ({
      ambiencePresetId: preferences.ambiencePresetId,
      coordinationState,
      feedback,
      hasUsedSound,
      isAvailableOnRoute,
      isPlaying,
      materialSoundsEnabled: preferences.materialSoundsEnabled,
      musicEnabled: preferences.musicEnabled,
      choosePreset,
      setAmbiencePreset,
      setMaterialSoundsEnabled,
      setMusicEnabled,
      start,
      stop,
    }),
    [
      choosePreset,
      coordinationState,
      feedback,
      hasUsedSound,
      isAvailableOnRoute,
      isPlaying,
      preferences.ambiencePresetId,
      preferences.materialSoundsEnabled,
      preferences.musicEnabled,
      setAmbiencePreset,
      setMaterialSoundsEnabled,
      setMusicEnabled,
      start,
      stop,
    ],
  );

  return <TeacherSoundContext.Provider value={value}>{children}</TeacherSoundContext.Provider>;
}

export function useTeacherSound() {
  const context = useContext(TeacherSoundContext);
  if (!context) {
    throw new Error("useTeacherSound skal bruges inde i TeacherSoundProvider.");
  }

  return context;
}
