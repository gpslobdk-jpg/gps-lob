import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import CategoryGalleryClient from "../CategoryGalleryClient";

const CATEGORY_LABELS: Record<string, string> = {
  indskoling: "Indskoling",
  mellemtrin: "Mellemtrin",
  udskoling: "Udskoling",
};

type LibraryRow = {
  ai_title: string | null;
  created_at: string | null;
  file_path: string | null;
  id: string;
  original_name: string | null;
  title?: string | null;
};

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const resolved = await params;
  const category = (resolved?.category ?? "").toLowerCase();
  const categoryLabel = CATEGORY_LABELS[category];
  if (!categoryLabel) {
    notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stjerneloeb_library")
    .select("id,file_path,original_name,ai_title,category,created_at")
    .eq("category", category)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not fetch stjerneloeb_library:", error);
  }

  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const items = (data ?? []).map((row: LibraryRow) => {
    const filePath = row.file_path ?? "";
    const publicUrl = filePath && baseUrl ? `${baseUrl}/storage/v1/object/public/stjerneloeb_pdfs/${encodeURIComponent(filePath)}` : null;
    return {
      id: row.id,
      ai_title: row.ai_title ?? row.title ?? "",
      original_name: row.original_name ?? "",
      publicUrl,
      created_at: row.created_at,
      file_path: filePath,
    };
  });

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f4f9ff_0%,#e2efff_100%)] px-6 py-8 text-slate-950 md:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard/opret/stjerneloeb/bibliotek"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-400 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200/70"
          >
            <ArrowLeft className="h-4 w-4" />
            Bibliotek
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800">
            <BookOpen className="h-4 w-4" />
            {categoryLabel}
          </span>
        </header>

        <section className="mt-12">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-sky-700">Stjerneløb · Bibliotek</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">{categoryLabel}</h1>
          <p className="mt-3 text-base font-medium leading-7 text-slate-600">Åbn et materiale eller se PDF&apos;en før print.</p>

          <CategoryGalleryClient items={items} />
        </section>
      </div>
    </main>
  );
}
