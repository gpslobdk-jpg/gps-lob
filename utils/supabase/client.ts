import { createBrowserClient } from "@supabase/ssr";

import { PARTICIPANT_AUTH_STORAGE_KEY } from "@/utils/supabase/participantAuth";

type BrowserClientOptions = {
  headers?: Record<string, string>;
  authScope?: "default" | "participant";
};

export function createClient(options: BrowserClientOptions = {}) {
  const isParticipantClient = options.authScope === "participant";
  const headers = {
    ...(options.headers ?? {}),
  };

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(isParticipantClient
        ? {
            auth: {
              storageKey: PARTICIPANT_AUTH_STORAGE_KEY,
            },
          }
        : {}),
      ...(Object.keys(headers).length > 0
        ? {
            global: {
              headers,
            },
          }
        : {}),
    }
  );
}
