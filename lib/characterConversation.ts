import type { CharacterPostConfig } from "@/lib/characterPosts";

export type CharacterConversationStopReason =
  | "student_finished"
  | "time_limit"
  | "component_unmounted"
  | "navigation"
  | "page_hidden"
  | "network_failure";

export type CharacterConversationStatus =
  "connecting" | "listening" | "speaking";

export type CharacterConversationErrorCode =
  | "UNSUPPORTED_BROWSER"
  | "MICROPHONE_DENIED"
  | "MICROPHONE_UNAVAILABLE"
  | "FEATURE_UNAVAILABLE"
  | "PARTICIPANT_UNAUTHORIZED"
  | "POST_UNAVAILABLE"
  | "POST_LOCKED"
  | "RATE_LIMITED"
  | "NETWORK_ERROR";

export class CharacterConversationError extends Error {
  readonly code: CharacterConversationErrorCode;

  constructor(code: CharacterConversationErrorCode) {
    super(code);
    this.name = "CharacterConversationError";
    this.code = code;
  }
}

export type CharacterConversationStartInput = {
  config: CharacterPostConfig;
  // Deliberately semantic, not raw coordinates. The server can later derive
  // this approved place context from the current post.
  locationContext: {
    placeDescription: string;
  };
  signal?: AbortSignal;
  sessionId?: string;
  postIndex?: number;
  onStatusChange?: (status: CharacterConversationStatus) => void;
  onEnded?: (reason: CharacterConversationStopReason) => void;
  onFailure?: (error: CharacterConversationError) => void;
};

export type CharacterConversationHandle = {
  startedAtMs: number;
  stop: (reason: CharacterConversationStopReason) => Promise<{
    durationSeconds: number;
  }>;
};

export interface CharacterConversationService {
  mode: "foundation" | "realtime";
  start: (
    input: CharacterConversationStartInput,
  ) => Promise<CharacterConversationHandle>;
}

/**
 * UI-only foundation adapter. It opens no microphone, socket or provider
 * connection and retains no audio, transcript, utterance or conversation log.
 */
export const foundationCharacterConversationService: CharacterConversationService = {
  mode: "foundation",
  async start() {
    const startedAtMs = Date.now();
    let stoppedAtMs: number | null = null;

    return {
      startedAtMs,
      async stop() {
        stoppedAtMs ??= Date.now();
        return {
          durationSeconds: Math.max(
            0,
            Math.round((stoppedAtMs - startedAtMs) / 1000),
          ),
        };
      },
    };
  },
};
