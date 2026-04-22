import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient, ADMIN_ACCESS_MISSING_MESSAGE } from "@/utils/supabase/admin";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

export const maxDuration = 120;

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_TIMEOUT_MS = 60_000;

function asTrimmedString(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 200);
}

export async function POST(req: Request) {
  const requestPath = new URL(req.url).pathname;

  try {
    if (!process.env.OPENAI_API_KEY) {
      await logHandledServerError({
        requestPath,
        route: requestPath,
        method: "POST",
        context: "stjpn_missing_openai_key",
        status: 500,
        error: "OPENAI_API_KEY mangler i miljøet.",
      });
      return NextResponse.json({ error: "OPENAI_API_KEY mangler i miljøet." }, { status: 500 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
    }

    const fileEntry = formData.get("file");
    const category = asTrimmedString(formData.get("category"));

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "PDF-fil mangler." }, { status: 400 });
    }

    const filename = fileEntry.name || "upload.pdf";
    const mime = (fileEntry.type || "").toLowerCase();
    if (mime !== "application/pdf" && !filename.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Kun PDF-filer understøttes." }, { status: 400 });
    }

    const arrayBuffer = await fileEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.byteLength === 0) {
      return NextResponse.json({ error: "Tom eller ugyldig fil." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Du skal være logget ind for at uploade." }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    const storagePath = `${user.id}/${Date.now()}-${sanitizeFileName(filename)}`;

    const { error: uploadError } = await adminSupabase.storage
      .from("stjerneloeb_pdfs")
      .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      console.error("Kunne ikke uploade stjerneloeb PDF:", uploadError);
      await logHandledServerError({
        route: "/api/stjerneloeb-library/upload",
        method: "POST",
        status: 500,
        error: uploadError,
        requestPath,
        routeType: "route",
      });
      return NextResponse.json({ error: "Kunne ikke uploade filen." }, { status: 500 });
    }

    const { data: { publicUrl } } = adminSupabase.storage.from("stjerneloeb_pdfs").getPublicUrl(storagePath);

    // Generate a short Danish title using the AI (return JSON with field `title`)
    const schema = z.object({ title: z.string().trim().min(1).max(160) }).strict();

    const systemPrompt = `Du er en dansk pædagogisk redaktør. Giv én kort, fængende og pædagogisk titel til et læringsmateriale (PDF). Returner KUN JSON med ét felt \"title\". Ingen forklaring.`;

    const userPrompt = `Filnavn: ${filename}\nKategori: ${category || "ikke angivet"}\nSkriv en kort dansk titel (maks 80 tegn). Returner kun JSON der matcher schema.`;

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema,
      schemaName: "StjernelobLibraryTitle",
      schemaDescription: "Et kort dansk titel-objekt med feltet title.",
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.6,
      timeout: OPENAI_TIMEOUT_MS,
      providerOptions: {
        openai: { strictJsonSchema: true },
      },
    });

    const aiTitle = (object.title || "").trim();

    const { data: inserted, error: insertError } = await adminSupabase
      .from("stjerneloeb_library")
      .insert({
        file_path: storagePath,
        original_name: filename,
        ai_title: aiTitle,
        category: category,
        created_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (insertError) {
      console.error("Kunne ikke gemme stjerneloeb-metadata:", insertError);
      await logHandledServerError({
        route: "/api/stjerneloeb-library/upload",
        method: "POST",
        status: 500,
        error: insertError,
        requestPath,
        routeType: "route",
      });
      return NextResponse.json({ error: "Kunne ikke gemme metadata." }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: inserted ?? { file_path: storagePath, original_name: filename, ai_title: aiTitle, category, publicUrl } });
  } catch (error) {
    console.error("stjerneloeb-library upload fejlede:", error);
    await logHandledServerError({
      route: "/api/stjerneloeb-library/upload",
      method: "POST",
      status: 500,
      error,
      requestPath,
    });
    return NextResponse.json({ error: "Upload fejlede." }, { status: 500 });
  }
}
