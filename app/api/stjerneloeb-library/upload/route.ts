import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient, ADMIN_ACCESS_MISSING_MESSAGE } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

export const maxDuration = 120;

const BUCKET_NAME = "stjerneloeb_pdfs";
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_TIMEOUT_MS = 60_000;

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 200);
}

function normalizeStoragePath(value: string) {
  const trimmed = value.trim().replace(/^\/+/, "");
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const publicPrefix = `/storage/v1/object/public/${BUCKET_NAME}/`;
      const signedPrefix = `/storage/v1/object/sign/${BUCKET_NAME}/`;
      const publicIndex = url.pathname.indexOf(publicPrefix);
      if (publicIndex >= 0) {
        return decodeURIComponent(url.pathname.slice(publicIndex + publicPrefix.length));
      }
      const signedIndex = url.pathname.indexOf(signedPrefix);
      if (signedIndex >= 0) {
        return decodeURIComponent(url.pathname.slice(signedIndex + signedPrefix.length));
      }
    } catch {
      return "";
    }
  }

  const bucketPrefix = `${BUCKET_NAME}/`;
  if (trimmed.startsWith(bucketPrefix)) {
    return trimmed.slice(bucketPrefix.length);
  }

  return trimmed;
}

function getFileNameFromPath(path: string) {
  return path.split("/").filter(Boolean).pop() || "upload.pdf";
}

export async function POST(req: Request) {
  const requestPath = new URL(req.url).pathname;
  let adminSupabase: ReturnType<typeof createAdminClient> = null;
  let storagePathToCleanUp = "";

  const cleanupUploadedStoragePath = async () => {
    if (adminSupabase && storagePathToCleanUp) {
      await adminSupabase.storage.from(BUCKET_NAME).remove([storagePathToCleanUp]).catch(() => undefined);
    }
  };

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

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Du skal være logget ind for at uploade." }, { status: 401 });
    }

    adminSupabase = createAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    let category = "";
    let storagePath = "";
    let fileName = "upload.pdf";
    let uploadedLegacyBuffer: Buffer | null = null;

    if (contentType.includes("application/json")) {
      const body = (await req.json().catch(() => null)) as
        | {
            filePath?: unknown;
            fileUrl?: unknown;
            category?: unknown;
          }
        | null;

      if (!body) {
        return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
      }

      category = asTrimmedString(body.category);
      const rawStorageValue = asTrimmedString(body.filePath) || asTrimmedString(body.fileUrl);
      storagePath = normalizeStoragePath(rawStorageValue);

      if (!storagePath) {
        return NextResponse.json({ error: "Filsti mangler." }, { status: 400 });
      }

      if (!storagePath.startsWith(`${user.id}/`)) {
        return NextResponse.json({ error: "Filstien matcher ikke den indloggede bruger." }, { status: 403 });
      }

      storagePathToCleanUp = storagePath;
      fileName = getFileNameFromPath(storagePath);
    } else {
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
      }

      category = asTrimmedString(formData.get("category"));
      const rawStorageValue = asTrimmedString(formData.get("filePath")) || asTrimmedString(formData.get("fileUrl")) || asTrimmedString(formData.get("path"));
      const fileEntry = formData.get("file");

      if (rawStorageValue) {
        storagePath = normalizeStoragePath(rawStorageValue);
        if (!storagePath) {
          return NextResponse.json({ error: "Filsti mangler." }, { status: 400 });
        }

        if (!storagePath.startsWith(`${user.id}/`)) {
          return NextResponse.json({ error: "Filstien matcher ikke den indloggede bruger." }, { status: 403 });
        }

        storagePathToCleanUp = storagePath;
        fileName = getFileNameFromPath(storagePath);
      } else {
        if (!(fileEntry instanceof File)) {
          return NextResponse.json({ error: "PDF-fil mangler." }, { status: 400 });
        }

        fileName = fileEntry.name || "upload.pdf";
        const mime = (fileEntry.type || "").toLowerCase();
        if (mime !== "application/pdf" && !fileName.toLowerCase().endsWith(".pdf")) {
          return NextResponse.json({ error: "Kun PDF-filer understøttes." }, { status: 400 });
        }

        const arrayBuffer = await fileEntry.arrayBuffer();
        uploadedLegacyBuffer = Buffer.from(arrayBuffer);
        if (uploadedLegacyBuffer.byteLength === 0) {
          return NextResponse.json({ error: "Tom eller ugyldig fil." }, { status: 400 });
        }

        storagePath = `${user.id}/${Date.now()}-${sanitizeFileName(fileName)}`;
        storagePathToCleanUp = storagePath;

        const { error: uploadError } = await adminSupabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, uploadedLegacyBuffer, { contentType: "application/pdf", upsert: false });

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
      }
    }

    const { data: downloadedFile, error: downloadError } = await adminSupabase.storage
      .from(BUCKET_NAME)
      .download(storagePath);

    if (downloadError || !downloadedFile) {
      await cleanupUploadedStoragePath();
      return NextResponse.json({ error: "Kunne ikke læse filen fra Supabase." }, { status: 404 });
    }

    const arrayBuffer = await downloadedFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.byteLength === 0) {
      await cleanupUploadedStoragePath();
      return NextResponse.json({ error: "Tom eller ugyldig fil." }, { status: 400 });
    }

    const { data: { publicUrl } } = adminSupabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

    const schema = z.object({ title: z.string().trim().min(1).max(160) }).strict();
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
      return NextResponse.json({ error: "Kunne ikke gemme metadata." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      item:
        inserted ?? {
          file_path: storagePath,
          original_name: fileName,
          ai_title: aiTitle,
          category,
          publicUrl,
        },
    });
  } catch (error) {
    if (adminSupabase && storagePathToCleanUp) {
      await adminSupabase.storage.from(BUCKET_NAME).remove([storagePathToCleanUp]).catch(() => undefined);
    }

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
