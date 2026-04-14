import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/adminClient";

const BOT_COUNT = 30;
const SIMULATION_DURATION_MS = 60_000; // 1 minut
const UPDATE_INTERVAL_MS = 2000; // Opdater hver 2. sekund
const START_LAT = 55.6761; // Eksempel-koordinat (København)
const START_LNG = 12.5683;

function randomDelta() {
  // Små variationer i meter
  return (Math.random() - 0.5) * 0.0005;
}

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId mangler" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const bots = Array.from({ length: BOT_COUNT }, (_, i) => ({
    name: `Bot ${i + 1}`,
    lat: START_LAT + randomDelta(),
    lng: START_LNG + randomDelta(),
  }));

  // Opret bots som participants
  for (const bot of bots) {
    await supabase.from("participants").upsert({
      session_id: sessionId,
      student_name: bot.name,
      lat: bot.lat,
      lng: bot.lng,
      updated_at: new Date().toISOString(),
    });
  }

  // Start simulation loop (ikke persistent på edge/serverless, men virker til hurtig test)
  let ticks = 0;
  const interval = setInterval(async () => {
    ticks++;
    for (const bot of bots) {
      bot.lat += randomDelta();
      bot.lng += randomDelta();
      await supabase.from("participants").update({
        lat: bot.lat,
        lng: bot.lng,
        updated_at: new Date().toISOString(),
      }).eq("session_id", sessionId).eq("student_name", bot.name);
    }
    if (ticks * UPDATE_INTERVAL_MS >= SIMULATION_DURATION_MS) {
      clearInterval(interval);
    }
  }, UPDATE_INTERVAL_MS);

  return NextResponse.json({ ok: true, bots: bots.map(b => b.name) });
}
