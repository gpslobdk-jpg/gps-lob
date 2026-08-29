import type { CharacterPostConfig } from "@/lib/characterPosts";

export type CharacterConversationStopReason =
  | "student_finished"
  | "time_limit"
  | "component_unmounted";

export type CharacterConversationStartInput = {
  config: CharacterPostConfig;
  // Deliberately semantic, not raw coordinates. The server can later derive
  // this approved place context from the current post.
  locationContext: {
    placeDescription: string;
  };
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
