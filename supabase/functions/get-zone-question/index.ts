import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  let session_id: string;
  let zone_id: string;

  try {
    const body = (await req.json()) as { session_id?: unknown; zone_id?: unknown };
    session_id = typeof body.session_id === "string" ? body.session_id.trim() : "";
    zone_id = typeof body.zone_id === "string" ? body.zone_id.trim() : "";
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!session_id || !zone_id) {
    return json({ error: "session_id and zone_id are required" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Resolve session → run
  const { data: session, error: sessionError } = await supabase
    .from("live_sessions")
    .select("run_id")
    .eq("id", session_id)
    .single();

  if (sessionError || !session) {
    return json({ error: "Session not found" }, 404);
  }

  // Resolve zone → question index
  const { data: zone, error: zoneError } = await supabase
    .from("game_zones")
    .select("zone_index")
    .eq("id", zone_id)
    .eq("session_id", session_id)
    .single();

  if (zoneError || !zone) {
    return json({ error: "Zone not found" }, 404);
  }

  // Fetch run questions
  const { data: run, error: runError } = await supabase
    .from("gps_runs")
    .select("questions")
    .eq("id", session.run_id)
    .single();

  if (runError || !run) {
    return json({ error: "Run not found" }, 404);
  }

  const questions = Array.isArray(run.questions) ? run.questions : [];
  const question = questions[zone.zone_index as number] ?? null;

  if (!question) {
    return json({ error: "No question at this zone index" }, 404);
  }

  return json({ question });
});
