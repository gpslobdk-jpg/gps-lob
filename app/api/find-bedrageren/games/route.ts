import { NextResponse } from "next/server";

import { RACE_TYPES } from "@/utils/gpsRuns";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

type CreateFindBedragerenGamePayload = {
  title?: unknown;
  subject?: unknown;
  secretWord?: unknown;
  impostorCount?: unknown;
};

type CreatedRunRow = {
  id: string;
};

const MAX_TITLE_LENGTH = 120;
const MAX_SUBJECT_LENGTH = 80;
const MAX_SECRET_WORD_LENGTH = 120;
const MIN_IMPOSTOR_COUNT = 1;
const MAX_IMPOSTOR_COUNT = 50;

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeImpostorCount(value: unknown) {
  const numberValue =
    typeof value === "number" ? value : Number(asTrimmedString(value));

  if (!Number.isInteger(numberValue)) {
    return null;
  }

  if (numberValue < MIN_IMPOSTOR_COUNT || numberValue > MAX_IMPOSTOR_COUNT) {
    return null;
  }

  return numberValue;
}

function toSafeLogError(error: unknown) {
  if (error instanceof Error) {
    return new Error(error.message);
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = asTrimmedString((error as { message?: unknown }).message);
    return new Error(message || "Find Bedrageren kunne ikke oprettes.");
  }

  return new Error("Find Bedrageren kunne ikke oprettes.");
}

export async function POST(request: Request) {
  const requestPath = new URL(request.url).pathname;
  let payload: CreateFindBedragerenGamePayload;

  try {
    payload = (await request.json()) as CreateFindBedragerenGamePayload;
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  const title = asTrimmedString(payload.title);
  const subject = asTrimmedString(payload.subject) || "Generelt";
  const secretWord = asTrimmedString(payload.secretWord);
  const impostorCount = normalizeImpostorCount(payload.impostorCount);

  if (!title || title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json({ error: "Giv aktiviteten en kort titel." }, { status: 400 });
  }

  if (subject.length > MAX_SUBJECT_LENGTH) {
    return NextResponse.json({ error: "Vælg et kort emne." }, { status: 400 });
  }

  if (!secretWord || secretWord.length > MAX_SECRET_WORD_LENGTH) {
    return NextResponse.json({ error: "Skriv et hemmeligt ord på højst 120 tegn." }, { status: 400 });
  }

  if (impostorCount === null) {
    return NextResponse.json({ error: "Vælg mindst 1 og højst 50 bedragere." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Du skal være logget ind." }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    if (!adminSupabase) {
      return NextResponse.json(
        { error: "Serveren mangler adgang til at gemme aktiviteten." },
        { status: 503 }
      );
    }

    const { data: run, error: runError } = await supabase
      .from("gps_runs")
      .insert({
        user_id: user.id,
        title,
        subject,
        description: "Eleverne får et hemmeligt ord. Bedragerne skal bluffe.",
        topic: subject,
        questions: [],
        race_type: RACE_TYPES.FIND_BEDRAGEREN,
      })
      .select("id")
      .single<CreatedRunRow>();

    if (runError || !run?.id) {
      throw runError ?? new Error("Kunne ikke oprette aktiviteten.");
    }

    const { error: gameError } = await adminSupabase
      .from("find_bedrageren_games")
      .insert({
        gps_run_id: run.id,
        secret_word: secretWord,
        impostor_count: impostorCount,
      });

    if (gameError) {
      const { error: cleanupError } = await adminSupabase
        .from("gps_runs")
        .delete()
        .eq("id", run.id)
        .eq("user_id", user.id);

      if (cleanupError) {
        console.warn("Kunne ikke rydde op efter Find Bedrageren-oprettelse.");
      }

      throw gameError;
    }

    return NextResponse.json({ runId: run.id });
  } catch (error) {
    console.error("Find Bedrageren-oprettelse fejlede.");
    await logHandledServerError({
      route: "/api/find-bedrageren/games",
      method: "POST",
      status: 500,
      error: toSafeLogError(error),
      requestPath,
      routeType: "route",
    });

    return NextResponse.json(
      { error: "Kunne ikke gemme aktiviteten lige nu." },
      { status: 500 }
    );
  }
}
