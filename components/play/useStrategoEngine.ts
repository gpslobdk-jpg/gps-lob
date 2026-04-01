"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  Location,
  PlayStrategoState,
  StrategoDuelEvent,
  StrategoPresenceEntry,
  StrategoSelfPlayer,
} from "./types";
import { getDistance, toFiniteNumber } from "./playUtils";
import { createClient } from "@/utils/supabase/client";

const STRATEGO_TARGET_IN_SIGHT_DISTANCE_METERS = 20;
const STRATEGO_SAFE_ZONE_DISTANCE_METERS = 30;
const STRATEGO_DUEL_TRIGGER_COOLDOWN_MS = 3000;
const STRATEGO_DUEL_ERROR_TIMEOUT_MS = 3000;

type SupabaseBrowserClient = ReturnType<typeof createClient>;

type StrategoPresenceRow = {
  participant_id?: string | null;
  session_id?: string | null;
  team_code?: string | null;
  state?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  updated_at?: string | null;
};

type StrategoPlayerRow = {
  participant_id?: string | null;
  session_id?: string | null;
  team_code?: string | null;
  state?: string | null;
  rank_key?: string | null;
};

type StrategoGameRow = {
  red_base_lat?: number | string | null;
  red_base_lng?: number | string | null;
  blue_base_lat?: number | string | null;
  blue_base_lng?: number | string | null;
};

type StrategoGameBases = {
  red: Location | null;
  blue: Location | null;
};

type StrategoDuelEventRow = {
  id?: string | null;
  session_id?: string | null;
  winner_id?: string | null;
  loser_id?: string | null;
  attacker_id?: string | null;
  defender_id?: string | null;
  attacker_role_key?: string | null;
  defender_role_key?: string | null;
  is_draw?: boolean | null;
  created_at?: string | null;
};

type UseStrategoEngineParams = {
  enabled: boolean;
  isPaused: boolean;
  sessionId?: string;
  participantId?: string | null;
  myLoc: Location | null;
  supabase: SupabaseBrowserClient;
};

type UseStrategoEngineResult = PlayStrategoState & {
  clearDuelEvent: () => void;
  triggerDuel: (targetId: string) => Promise<void>;
};

function normalizePresenceEntry(row: StrategoPresenceRow | null | undefined): StrategoPresenceEntry | null {
  const participantId = typeof row?.participant_id === "string" ? row.participant_id : "";
  const sessionId = typeof row?.session_id === "string" ? row.session_id : "";
  const teamCode = typeof row?.team_code === "string" ? row.team_code : "";
  const state = typeof row?.state === "string" ? row.state : "";

  if (!participantId || !sessionId || !teamCode || !state) {
    return null;
  }

  return {
    participantId,
    sessionId,
    teamCode,
    state,
    lat: toFiniteNumber(row?.lat),
    lng: toFiniteNumber(row?.lng),
    updatedAt: typeof row?.updated_at === "string" ? row.updated_at : null,
  };
}

function normalizeSelfPlayer(row: StrategoPlayerRow | null | undefined): StrategoSelfPlayer | null {
  const participantId = typeof row?.participant_id === "string" ? row.participant_id : "";
  const sessionId = typeof row?.session_id === "string" ? row.session_id : "";
  const teamCode = typeof row?.team_code === "string" ? row.team_code : "";
  const state = typeof row?.state === "string" ? row.state : "";

  if (!participantId || !sessionId || !teamCode || !state) {
    return null;
  }

  return {
    participantId,
    sessionId,
    teamCode,
    state,
    rankKey: typeof row?.rank_key === "string" ? row.rank_key : null,
  };
}

function normalizeBaseLocation(latValue: unknown, lngValue: unknown): Location | null {
  const lat = toFiniteNumber(latValue);
  const lng = toFiniteNumber(lngValue);

  if (lat === null || lng === null) {
    return null;
  }

  return { lat, lng };
}

function normalizeStrategoGameBases(
  row: StrategoGameRow | null | undefined
): StrategoGameBases {
  return {
    red: normalizeBaseLocation(row?.red_base_lat, row?.red_base_lng),
    blue: normalizeBaseLocation(row?.blue_base_lat, row?.blue_base_lng),
  };
}

function getBaseLocationForTeam(
  teamCode: string | null | undefined,
  gameBases: StrategoGameBases
): Location | null {
  if (teamCode === "blue") {
    return gameBases.blue;
  }

  if (teamCode === "red") {
    return gameBases.red;
  }

  return null;
}

function isInsideSafeZone(location: Location | null, baseLocation: Location | null) {
  if (!location || !baseLocation) {
    return false;
  }

  return (
    getDistance(location.lat, location.lng, baseLocation.lat, baseLocation.lng) <=
    STRATEGO_SAFE_ZONE_DISTANCE_METERS
  );
}

function normalizeDuelEvent(row: StrategoDuelEventRow | null | undefined): StrategoDuelEvent | null {
  const id = typeof row?.id === "string" ? row.id : "";
  const sessionId = typeof row?.session_id === "string" ? row.session_id : "";
  const attackerId = typeof row?.attacker_id === "string" ? row.attacker_id : "";
  const defenderId = typeof row?.defender_id === "string" ? row.defender_id : "";
  const attackerRoleKey =
    typeof row?.attacker_role_key === "string" ? row.attacker_role_key : "";
  const defenderRoleKey =
    typeof row?.defender_role_key === "string" ? row.defender_role_key : "";

  if (!id || !sessionId || !attackerId || !defenderId || !attackerRoleKey || !defenderRoleKey) {
    return null;
  }

  return {
    id,
    sessionId,
    winnerId: typeof row?.winner_id === "string" ? row.winner_id : null,
    loserId: typeof row?.loser_id === "string" ? row.loser_id : null,
    attackerId,
    defenderId,
    attackerRoleKey,
    defenderRoleKey,
    isDraw: row?.is_draw === true,
    createdAt: typeof row?.created_at === "string" ? row.created_at : null,
  };
}

function isLikelyNetworkMessage(message: string | null | undefined) {
  if (!message) {
    return false;
  }

  return /network|fetch|offline|timeout|timed out|connection/i.test(message);
}

export function useStrategoEngine({
  enabled,
  isPaused,
  sessionId,
  participantId,
  myLoc,
  supabase,
}: UseStrategoEngineParams): UseStrategoEngineResult {
  const [presenceEntries, setPresenceEntries] = useState<StrategoPresenceEntry[]>([]);
  const [selfPlayer, setSelfPlayer] = useState<StrategoSelfPlayer | null>(null);
  const [gameBases, setGameBases] = useState<StrategoGameBases>({ red: null, blue: null });
  const [targetInSightId, setTargetInSightId] = useState<string | null>(null);
  const [duelEvent, setDuelEvent] = useState<StrategoDuelEvent | null>(null);
  const [duelInFlight, setDuelInFlight] = useState(false);
  const [duelError, setDuelError] = useState<string | null>(null);
  const [isRealtimeRecovering, setIsRealtimeRecovering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duelInFlightRef = useRef(false);
  const duelCooldownUntilRef = useRef(0);
  const lastDuelEventIdRef = useRef<string | null>(null);
  const duelErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeSubscriptionStateRef = useRef({
    presence: false,
    duel: false,
  });

  const clearDuelError = useCallback(() => {
    if (duelErrorTimeoutRef.current) {
      clearTimeout(duelErrorTimeoutRef.current);
      duelErrorTimeoutRef.current = null;
    }

    setDuelError(null);
  }, []);

  const showDuelError = useCallback(
    (message: string) => {
      clearDuelError();
      setDuelError(message);
      duelErrorTimeoutRef.current = setTimeout(() => {
        setDuelError(null);
        duelErrorTimeoutRef.current = null;
      }, STRATEGO_DUEL_ERROR_TIMEOUT_MS);
    },
    [clearDuelError]
  );

  const refreshPresence = useCallback(async () => {
    if (!enabled || !sessionId) {
      setPresenceEntries([]);
      return;
    }

    const { data, error: presenceError } = await supabase
      .from("stratego_presence_view")
      .select("participant_id,session_id,team_code,state,lat,lng,updated_at")
      .eq("session_id", sessionId);

    if (presenceError) {
      setError(presenceError.message ?? "Kunne ikke hente Stratego-radaren.");
      return;
    }

    const normalizedEntries = ((data ?? []) as StrategoPresenceRow[])
      .map(normalizePresenceEntry)
      .filter((entry): entry is StrategoPresenceEntry => entry !== null);

    setPresenceEntries(normalizedEntries);
    setError(null);
  }, [enabled, sessionId, supabase]);

  const refreshSelfPlayer = useCallback(async () => {
    if (!enabled || !sessionId || !participantId) {
      setSelfPlayer(null);
      return;
    }

    const { data, error: playerError } = await supabase
      .from("stratego_players")
      .select("participant_id,session_id,team_code,state,rank_key")
      .eq("participant_id", participantId)
      .eq("session_id", sessionId)
      .maybeSingle<StrategoPlayerRow>();

    if (playerError) {
      setError(playerError.message ?? "Kunne ikke hente din Stratego-spiller.");
      return;
    }

    setSelfPlayer(normalizeSelfPlayer(data));
    setError(null);
  }, [enabled, participantId, sessionId, supabase]);

  const refreshGameBases = useCallback(async () => {
    if (!enabled || !sessionId) {
      setGameBases({ red: null, blue: null });
      return;
    }

    const { data, error: gameError } = await supabase
      .from("stratego_games")
      .select("red_base_lat,red_base_lng,blue_base_lat,blue_base_lng")
      .eq("session_id", sessionId)
      .maybeSingle<StrategoGameRow>();

    if (gameError) {
      setError(gameError.message ?? "Kunne ikke hente Stratego-baserne.");
      return;
    }

    setGameBases(normalizeStrategoGameBases(data));
    setError(null);
  }, [enabled, sessionId, supabase]);

  const refreshStrategoState = useCallback(async () => {
    await Promise.all([refreshPresence(), refreshSelfPlayer(), refreshGameBases()]);
  }, [refreshGameBases, refreshPresence, refreshSelfPlayer]);

  const updateRealtimeRecoveryState = useCallback(
    (channelKey: "presence" | "duel", status: string) => {
      if (status === "SUBSCRIBED") {
        realtimeSubscriptionStateRef.current[channelKey] = true;
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        realtimeSubscriptionStateRef.current[channelKey] = false;
      }

      setIsRealtimeRecovering(
        !(
          realtimeSubscriptionStateRef.current.presence &&
          realtimeSubscriptionStateRef.current.duel
        )
      );
    },
    []
  );

  useEffect(() => {
    return () => {
      if (duelErrorTimeoutRef.current) {
        clearTimeout(duelErrorTimeoutRef.current);
        duelErrorTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled || !sessionId || !participantId) {
      setPresenceEntries([]);
      setSelfPlayer(null);
      setGameBases({ red: null, blue: null });
      setTargetInSightId(null);
      setDuelEvent(null);
      setDuelInFlight(false);
      clearDuelError();
      setIsRealtimeRecovering(false);
      duelInFlightRef.current = false;
      duelCooldownUntilRef.current = 0;
      lastDuelEventIdRef.current = null;
      realtimeSubscriptionStateRef.current = {
        presence: false,
        duel: false,
      };
      setIsLoading(false);
      setError(null);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setIsRealtimeRecovering(true);
    realtimeSubscriptionStateRef.current = {
      presence: false,
      duel: false,
    };

    const loadInitialStrategoState = async () => {
      await refreshStrategoState();
      if (isActive) {
        setIsLoading(false);
      }
    };

    void loadInitialStrategoState();

    const presenceChannel = supabase
      .channel(`stratego-presence-${sessionId}-${participantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          if (!isActive) {
            return;
          }

          void refreshPresence();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stratego_players",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (!isActive) {
            return;
          }

          void refreshPresence();

          const changedParticipantId = (() => {
            const nextRow = (payload.new as { participant_id?: string | null } | null) ?? null;
            if (typeof nextRow?.participant_id === "string") {
              return nextRow.participant_id;
            }

            const oldRow = (payload.old as { participant_id?: string | null } | null) ?? null;
            return typeof oldRow?.participant_id === "string" ? oldRow.participant_id : null;
          })();

          if (changedParticipantId === participantId) {
            void refreshSelfPlayer();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stratego_games",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          if (!isActive) {
            return;
          }

          void refreshGameBases();
        }
      )
      .subscribe((status) => {
        if (!isActive) {
          return;
        }

        updateRealtimeRecoveryState("presence", status);
        if (status === "SUBSCRIBED") {
          void refreshStrategoState();
        }
      });

    const duelEventsChannel = supabase
      .channel(`stratego-duel-events-${sessionId}-${participantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stratego_duel_events",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (!isActive) {
            return;
          }

          const nextEvent = normalizeDuelEvent(payload.new as StrategoDuelEventRow | null);
          if (!nextEvent) {
            return;
          }

          if (nextEvent.id === lastDuelEventIdRef.current) {
            return;
          }

          if (nextEvent.attackerId !== participantId && nextEvent.defenderId !== participantId) {
            return;
          }

          lastDuelEventIdRef.current = nextEvent.id;
          duelCooldownUntilRef.current = Date.now() + STRATEGO_DUEL_TRIGGER_COOLDOWN_MS;
          duelInFlightRef.current = false;
          setDuelInFlight(false);
          clearDuelError();
          setDuelEvent(nextEvent);
          void refreshSelfPlayer();
          void refreshPresence();
        }
      )
      .subscribe((status) => {
        if (!isActive) {
          return;
        }

        updateRealtimeRecoveryState("duel", status);
        if (status === "SUBSCRIBED") {
          void refreshStrategoState();
        }
      });

    return () => {
      isActive = false;
      void supabase.removeChannel(presenceChannel);
      void supabase.removeChannel(duelEventsChannel);
    };
  }, [
    enabled,
    participantId,
    clearDuelError,
    refreshGameBases,
    refreshPresence,
    refreshStrategoState,
    refreshSelfPlayer,
    sessionId,
    supabase,
    updateRealtimeRecoveryState,
  ]);

  useEffect(() => {
    if (!enabled || !sessionId || !participantId) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void refreshStrategoState();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, participantId, refreshStrategoState, sessionId]);

  const selfPresence = useMemo(
    () => presenceEntries.find((entry) => entry.participantId === participantId) ?? null,
    [participantId, presenceEntries]
  );

  const effectiveSelfPlayer = selfPlayer
    ? selfPlayer
    : selfPresence
      ? {
          participantId: selfPresence.participantId,
          sessionId: selfPresence.sessionId,
          teamCode: selfPresence.teamCode,
          state: selfPresence.state,
          rankKey: null,
        }
      : null;

  const enemyPresence = useMemo(() => {
    if (!participantId || !effectiveSelfPlayer?.teamCode) {
      return [];
    }

    return presenceEntries.filter(
      (entry) =>
        entry.participantId !== participantId &&
        entry.teamCode !== effectiveSelfPlayer.teamCode &&
        entry.state === "alive"
    );
  }, [effectiveSelfPlayer?.teamCode, participantId, presenceEntries]);

  const allyPresence = useMemo(() => {
    if (!participantId || !effectiveSelfPlayer?.teamCode) {
      return [];
    }

    return presenceEntries.filter(
      (entry) =>
        entry.participantId !== participantId && entry.teamCode === effectiveSelfPlayer.teamCode
    );
  }, [effectiveSelfPlayer?.teamCode, participantId, presenceEntries]);

  const ownBaseLocation = useMemo(
    () => getBaseLocationForTeam(effectiveSelfPlayer?.teamCode, gameBases),
    [effectiveSelfPlayer?.teamCode, gameBases]
  );

  const isInSafeZone = useMemo(
    () => isInsideSafeZone(myLoc, ownBaseLocation),
    [myLoc, ownBaseLocation]
  );

  const targetInSight = useMemo(
    () => enemyPresence.find((entry) => entry.participantId === targetInSightId) ?? null,
    [enemyPresence, targetInSightId]
  );

  useEffect(() => {
    if (!enabled || !sessionId || !participantId || !myLoc) {
      setTargetInSightId(null);
      return;
    }

    if (effectiveSelfPlayer?.state !== "alive") {
      setTargetInSightId(null);
      duelInFlightRef.current = false;
      setDuelInFlight(false);
      return;
    }

    if (isInSafeZone) {
      setTargetInSightId(null);
      return;
    }

    if (isPaused || isRealtimeRecovering || duelEvent || duelInFlightRef.current) {
      setTargetInSightId(null);
      return;
    }

    const nearestEnemy = enemyPresence
      .map((enemy) => {
        if (enemy.lat === null || enemy.lng === null) {
          return null;
        }

        const enemyLocation = { lat: enemy.lat, lng: enemy.lng };
        if (
          isInsideSafeZone(enemyLocation, getBaseLocationForTeam(enemy.teamCode, gameBases))
        ) {
          return null;
        }

        return {
          enemy,
          distance: getDistance(myLoc.lat, myLoc.lng, enemyLocation.lat, enemyLocation.lng),
        };
      })
      .filter(
        (
          candidate
        ): candidate is {
          enemy: StrategoPresenceEntry;
          distance: number;
        } => candidate !== null
      )
      .sort((left, right) => left.distance - right.distance)[0];

    if (!nearestEnemy || nearestEnemy.distance > STRATEGO_TARGET_IN_SIGHT_DISTANCE_METERS) {
      setTargetInSightId(null);
      return;
    }

    setTargetInSightId((previous) =>
      previous === nearestEnemy.enemy.participantId ? previous : nearestEnemy.enemy.participantId
    );
  }, [
    duelEvent,
    effectiveSelfPlayer?.state,
    enabled,
    enemyPresence,
    gameBases,
    isInSafeZone,
    isPaused,
    isRealtimeRecovering,
    myLoc,
    participantId,
    sessionId,
  ]);

  const triggerDuel = useCallback(
    async (targetId: string) => {
      if (!enabled || !sessionId || !participantId || !myLoc || !targetId) {
        return;
      }

      if (effectiveSelfPlayer?.state !== "alive") {
        return;
      }

      if (isRealtimeRecovering) {
        setTargetInSightId(null);
        showDuelError("Netværksfejl - prøv igen");
        return;
      }

      if (isPaused) {
        setTargetInSightId(null);
        return;
      }

      if (isInSafeZone) {
        setTargetInSightId(null);
        return;
      }

      if (duelEvent || duelInFlightRef.current || Date.now() < duelCooldownUntilRef.current) {
        return;
      }

      const target = enemyPresence.find((entry) => entry.participantId === targetId) ?? null;
      if (!target || target.lat === null || target.lng === null) {
        setTargetInSightId(null);
        showDuelError("Målet er allerede i kamp");
        return;
      }

      const targetLocation = { lat: target.lat, lng: target.lng };
      if (
        isInsideSafeZone(targetLocation, getBaseLocationForTeam(target.teamCode, gameBases))
      ) {
        setTargetInSightId(null);
        showDuelError("Målet er allerede i kamp");
        return;
      }

      const distanceToTarget = getDistance(
        myLoc.lat,
        myLoc.lng,
        targetLocation.lat,
        targetLocation.lng
      );
      if (distanceToTarget > STRATEGO_TARGET_IN_SIGHT_DISTANCE_METERS) {
        setTargetInSightId(null);
        showDuelError("Målet er ude af rækkevidde");
        return;
      }

      clearDuelError();
      setError(null);
      duelInFlightRef.current = true;
      duelCooldownUntilRef.current = Date.now() + STRATEGO_DUEL_TRIGGER_COOLDOWN_MS;
      setDuelInFlight(true);

      try {
        const { data: duelResult, error: duelRpcError } = await supabase.rpc(
          "resolve_stratego_duel",
          {
          p_attacker_id: participantId,
          p_defender_id: targetId,
          p_session_id: sessionId,
          }
        );

        if (duelRpcError) {
          console.error("Kunne ikke afvikle Stratego-duel:", duelRpcError);
          showDuelError(
            isLikelyNetworkMessage(duelRpcError.message)
              ? "Netværksfejl - prøv igen"
              : "Målet er allerede i kamp"
          );
          return;
        }

        if (!duelResult) {
          showDuelError("Målet er allerede i kamp");
        }
      } catch (unexpectedError) {
        console.error("Uventet fejl under Stratego-duel:", unexpectedError);
        showDuelError(
          isLikelyNetworkMessage(
            unexpectedError instanceof Error ? unexpectedError.message : null
          )
            ? "Netværksfejl - prøv igen"
            : "Netværksfejl - prøv igen"
        );
      } finally {
        duelInFlightRef.current = false;
        setDuelInFlight(false);
        void refreshSelfPlayer();
        void refreshPresence();
      }
    },
    [
      duelEvent,
      effectiveSelfPlayer?.state,
      enabled,
      enemyPresence,
      gameBases,
      isInSafeZone,
      isPaused,
      isRealtimeRecovering,
      myLoc,
      participantId,
      clearDuelError,
      refreshPresence,
      refreshSelfPlayer,
      sessionId,
      showDuelError,
      supabase,
    ]
  );

  const clearDuelEvent = useCallback(() => {
    setDuelEvent(null);
  }, []);

  return {
    selfPlayer: effectiveSelfPlayer,
    selfPresence,
    allyPresence,
    enemyPresence,
    isInSafeZone,
    isRealtimeRecovering,
    targetInSight,
    duelEvent,
    duelInFlight,
    duelError,
    isLoading,
    error,
    clearDuelEvent,
    triggerDuel,
  };
}
