import { createBrowserClient } from '@supabase/ssr'

type BrowserClientOptions = {
  headers?: Record<string, string>
  participantId?: string | null
  sessionId?: string | null
}

export function createClient(options: BrowserClientOptions = {}) {
  const headers = {
    ...(options.headers ?? {}),
    ...(options.participantId ? { 'x-participant-id': options.participantId } : {}),
    ...(options.sessionId ? { 'x-session-id': options.sessionId } : {}),
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    Object.keys(headers).length > 0
      ? {
          global: {
            headers,
          },
        }
      : undefined
  )
}
