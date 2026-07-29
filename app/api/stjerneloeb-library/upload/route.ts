import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createAdminClient,
  ADMIN_ACCESS_MISSING_MESSAGE,
} from "@/utils/supabase/admin";
import { getValidatedAdminAccess } from "@/utils/supabase/adminAccess";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

export const maxDuration = 120;

const BUCKET_NAME = "stjerneloeb_pdfs";
const OPENAI_TIMEOUT_MS = 60_000;

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 200);
}

function makeStoragePath(userId: string, fileName: string) {
  return `${userId}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
}

export async function POST(req: Request) {
  const requestPath = new URL(req.url).pathname;
  let adminSupabase: ReturnType<typeof createAdminClient> = null;
  let storagePathToCleanUp = "";

  const cleanupUploadedStoragePath = async () => {
    if (adminSupabase && storagePathToCleanUp) {
      await adminSupabase.storage
        .from(BUCKET_NAME)
        .remove([storagePathToCleanUp])
        .catch(() => undefined);
    }
  };

  try {
    const adminAccess = await getValidatedAdminAccess();
    if (!adminAccess.ok) {
      return NextResponse.json(
        { error: adminAccess.message },
        { status: adminAccess.status }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      await logHandledServerError({
        requestPath,
        route: requestPath,
        method: "POST",
        context: "stjpn_missing_openai_key",
        status: 500,
        error: "OPENAI_API_KEY mangler i miljøet.",
      });
      return NextResponse.json(
        { error: "OPENAI_API_KEY mangler i miljøet." },
        { status: 500 }
      );
    }

    adminSupabase = createAdminClient();
    if (!adminSupabase) {
      return NextResponse.json(
        { error: ADMIN_ACCESS_MISSING_MESSAGE },
        { status: 503 }
      );
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Upload skal sendes som multipart/form-data." },
        { status: 415 }
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Ugyldig forespørgsel." },
        { status: 400 }
      );
    }

    const category = asTrimmedString(formData.get("category"));
    const fileEntry = formData.get("file");
    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: "PDF-fil mangler." },
        { status: 400 }
      );
    }

    const fileName = fileEntry.name || "upload.pdf";
    const mime = (fileEntry.type || "").toLowerCase();
    if (
      mime !== "application/pdf" &&
      !fileName.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { error: "Kun PDF-filer understøttes." },
        { status: 400 }
      );
    }

    const arrayBuffer = await fileEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (
      buffer.byteLength === 0 ||
      buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
    ) {
      return NextResponse.json(
        { error: "Tom eller ugyldig PDF-fil." },
        { status: 400 }
      );
    }

    const storagePath = makeStoragePath(adminAccess.user.id, fileName);
    const { error: uploadError } = await adminSupabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

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
      return NextResponse.json(
        { error: "Kunne ikke uploade filen." },
        { status: 500 }
      );
    }

    storagePathToCleanUp = storagePath;
    const {
      data: { publicUrl },
    } = adminSupabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const schema = z
      .object({ title: z.string().trim().min(1).max(160) })
      .strict();
    const systemPrompt =
      'Du er en dansk pædagogisk redaktør. Giv én kort, fængende og pædagogisk titel til et læringsmateriale (PDF). Returner KUN JSON med ét felt "title". Ingen forklaring.';
    const userPrompt = `Filnavn: ${fileName}\nKategori: ${category || "ikke angivet"}\nSkriv en kort dansk titel (maks 80 tegn). Returner kun JSON der matcher schema.`;

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
        original_name: fileName,
        ai_title: aiTitle,
        category,
        created_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (insertError) {
      console.error("Kunne ikke gemme stjerneloeb-metadata:", insertError);
      await cleanupUploadedStoragePath();
      await logHandledServerError({
        route: "/api/stjerneloeb-library/upload",
        method: "POST",
        status: 500,
        error: insertError,
        requestPath,
        routeType: "route",
      });
      return NextResponse.json(
        { error: "Kunne ikke gemme metadata." },
        { status: 500 }
      );
    }

    storagePathToCleanUp = "";
    return NextResponse.json({
      success: true,
      item: inserted
        ? {
            ...inserted,
            publicUrl,
          }
        : {
          file_path: storagePath,
          original_name: fileName,
          ai_title: aiTitle,
          category,
          publicUrl,
        },
    });
  } catch (error) {
    await cleanupUploadedStoragePath();

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
