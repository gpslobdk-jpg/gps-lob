import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { PARTICIPANT_AUTH_STORAGE_KEY } from "@/utils/supabase/participantAuth";

type BrowserClientOptions = {
  headers?: Record<string, string>;
  authScope?: "default" | "participant";
};

let participantBrowserClient: SupabaseClient | undefined;

export function createClient(options: BrowserClientOptions = {}) {
  const isParticipantClient = options.authScope === "participant";
  const headers = {
    ...(options.headers ?? {}),
  };
  const hasHeaders = Object.keys(headers).length > 0;
  const reuseParticipantClient =
    isParticipantClient &&
    typeof window !== "undefined" &&
    typeof window.document !== "undefined" &&
    !hasHeaders;

  if (reuseParticipantClient && participantBrowserClient) {
    return participantBrowserClient;
  }

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(isParticipantClient
        ? {
            // The SDK singleton ignores later options, including storageKey.
            // Keep participant auth separate from the default browser client.
            isSingleton: false,
            auth: {
              storageKey: PARTICIPANT_AUTH_STORAGE_KEY,
            },
          }
        : {}),
      ...(hasHeaders
        ? {
            global: {
              headers,
            },
          }
        : {}),
    }
  );

  if (reuseParticipantClient) participantBrowserClient = client;
  return client;
}
